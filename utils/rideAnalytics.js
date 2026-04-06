/**
 * Ride Analytics Engine — Ola/Uber-grade metrics computed from raw data
 * 
 * From breadcrumbs alone (coords + timestamps + speed):
 *   - Speed: avg, max, min, percentiles, distribution
 *   - Events: hard braking, rapid acceleration, speeding violations  
 *   - Stops: count, total idle time, idle locations
 *   - Route: efficiency ratio, detour %, actual vs planned distance
 *   - Segments: speed per road segment for speed heatmap
 *
 * From rides + bookings:
 *   - Revenue: per km, per hour, per seat-km (unit economics)
 *   - Time: wait time, ETA accuracy, response time
 *   - Fleet: utilization, supply-demand ratio, dead km
 *   - Patterns: hourly, daily distribution, peak analysis
 */

const turf = require('@turf/turf');

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const CITY_SPEED_LIMIT_KMH = 60;       // Default city speed limit
const HIGHWAY_SPEED_LIMIT_KMH = 100;
const HARD_BRAKE_THRESHOLD = -15;       // km/h per second (deceleration)
const RAPID_ACCEL_THRESHOLD = 12;       // km/h per second (acceleration)  
const IDLE_SPEED_THRESHOLD = 3;         // km/h — below this = stopped/idle
const MIN_IDLE_DURATION_SEC = 30;       // Minimum seconds to count as a stop
const SPEEDING_BUFFER_KMH = 10;        // Allow 10 km/h over limit before flagging

// ═══════════════════════════════════════════════════════
// CORE: Compute speed between two consecutive breadcrumbs
// ═══════════════════════════════════════════════════════
function haversineDistance(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeSegmentSpeed(bc1, bc2) {
  const distKm = haversineDistance(bc1.coordinates, bc2.coordinates);
  const t1 = bc1.timestamp instanceof Date ? bc1.timestamp.getTime() : new Date(bc1.timestamp).getTime();
  const t2 = bc2.timestamp instanceof Date ? bc2.timestamp.getTime() : new Date(bc2.timestamp).getTime();
  const timeDiffHours = Math.abs(t2 - t1) / (1000 * 3600);
  const timeDiffSec = Math.abs(t2 - t1) / 1000;

  if (timeDiffHours === 0 || timeDiffSec < 1) return null;

  const speedKmh = distKm / timeDiffHours;
  // Sanity: GPS jitter can cause huge speeds — cap at 200 km/h
  if (speedKmh > 200) return null;

  return {
    distKm,
    timeDiffSec,
    speedKmh,
    midpoint: [
      (bc1.coordinates[0] + bc2.coordinates[0]) / 2,
      (bc1.coordinates[1] + bc2.coordinates[1]) / 2
    ]
  };
}

// ═══════════════════════════════════════════════════════
// PER-RIDE ANALYTICS: Analyze a single ride's breadcrumbs
// ═══════════════════════════════════════════════════════
function analyzeRideBreadcrumbs(breadcrumbs, routeDistance, routeDuration) {
  if (!breadcrumbs || breadcrumbs.length < 2) {
    return {
      totalDistance: 0, totalDuration: 0,
      avgSpeed: 0, maxSpeed: 0, minSpeed: 0,
      speedPercentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
      hardBrakeEvents: [], rapidAccelEvents: [], speedingEvents: [],
      stops: [], totalIdleTimeSec: 0, stopCount: 0,
      routeEfficiency: 0, detourPercent: 0,
      segments: [], speedDistribution: {}
    };
  }

  const validBreadcrumbs = breadcrumbs.filter(bc =>
    bc.coordinates?.length === 2 && bc.timestamp
  );

  if (validBreadcrumbs.length < 2) {
    return analyzeRideBreadcrumbs([], routeDistance, routeDuration);
  }

  // Sort by timestamp
  validBreadcrumbs.sort((a, b) => {
    const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
    const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
    return ta - tb;
  });

  const segments = [];
  const speeds = [];
  const hardBrakeEvents = [];
  const rapidAccelEvents = [];
  const speedingEvents = [];
  let totalDistance = 0;
  let totalIdleTimeSec = 0;
  let currentIdleStart = null;
  let currentIdleCoord = null;
  const stops = [];

  for (let i = 1; i < validBreadcrumbs.length; i++) {
    const prev = validBreadcrumbs[i - 1];
    const curr = validBreadcrumbs[i];
    const seg = computeSegmentSpeed(prev, curr);

    if (!seg) continue;

    segments.push({
      from: prev.coordinates,
      to: curr.coordinates,
      midpoint: seg.midpoint,
      speedKmh: seg.speedKmh,
      distKm: seg.distKm,
      timeSec: seg.timeDiffSec
    });

    totalDistance += seg.distKm;
    speeds.push(seg.speedKmh);

    // ─── Detect hard braking & rapid acceleration ───
    if (i >= 2) {
      const prevSeg = segments[segments.length - 2];
      if (prevSeg) {
        const speedDelta = seg.speedKmh - prevSeg.speedKmh;
        const avgTimeSec = (seg.timeDiffSec + prevSeg.timeSec) / 2;
        const accelRate = avgTimeSec > 0 ? speedDelta / avgTimeSec : 0;

        if (accelRate < HARD_BRAKE_THRESHOLD / 1) {
          hardBrakeEvents.push({
            coordinates: seg.midpoint,
            speedBefore: prevSeg.speedKmh,
            speedAfter: seg.speedKmh,
            deceleration: Math.abs(accelRate),
            timestamp: curr.timestamp
          });
        }

        if (accelRate > RAPID_ACCEL_THRESHOLD / 1) {
          rapidAccelEvents.push({
            coordinates: seg.midpoint,
            speedBefore: prevSeg.speedKmh,
            speedAfter: seg.speedKmh,
            acceleration: accelRate,
            timestamp: curr.timestamp
          });
        }
      }
    }

    // ─── Detect speeding ───
    if (seg.speedKmh > CITY_SPEED_LIMIT_KMH + SPEEDING_BUFFER_KMH) {
      speedingEvents.push({
        coordinates: seg.midpoint,
        speed: seg.speedKmh,
        limit: CITY_SPEED_LIMIT_KMH,
        excess: seg.speedKmh - CITY_SPEED_LIMIT_KMH,
        timestamp: curr.timestamp
      });
    }

    // ─── Detect idle/stops ───
    // Use stored speed if available, otherwise computed
    const effectiveSpeed = curr.speed != null ? curr.speed : seg.speedKmh;

    if (effectiveSpeed < IDLE_SPEED_THRESHOLD) {
      if (!currentIdleStart) {
        currentIdleStart = prev.timestamp;
        currentIdleCoord = prev.coordinates;
      }
    } else {
      if (currentIdleStart) {
        const idleEndTs = prev.timestamp instanceof Date ? prev.timestamp.getTime() : new Date(prev.timestamp).getTime();
        const idleStartTs = currentIdleStart instanceof Date ? currentIdleStart.getTime() : new Date(currentIdleStart).getTime();
        const idleDuration = (idleEndTs - idleStartTs) / 1000;

        if (idleDuration >= MIN_IDLE_DURATION_SEC) {
          stops.push({
            coordinates: currentIdleCoord,
            durationSec: idleDuration,
            startTime: currentIdleStart,
            endTime: prev.timestamp
          });
          totalIdleTimeSec += idleDuration;
        }
        currentIdleStart = null;
        currentIdleCoord = null;
      }
    }
  }

  // Close any remaining idle period
  if (currentIdleStart) {
    const lastBc = validBreadcrumbs[validBreadcrumbs.length - 1];
    const idleEndTs = lastBc.timestamp instanceof Date ? lastBc.timestamp.getTime() : new Date(lastBc.timestamp).getTime();
    const idleStartTs = currentIdleStart instanceof Date ? currentIdleStart.getTime() : new Date(currentIdleStart).getTime();
    const idleDuration = (idleEndTs - idleStartTs) / 1000;
    if (idleDuration >= MIN_IDLE_DURATION_SEC) {
      stops.push({
        coordinates: currentIdleCoord,
        durationSec: idleDuration,
        startTime: currentIdleStart,
        endTime: lastBc.timestamp
      });
      totalIdleTimeSec += idleDuration;
    }
  }

  // ─── Speed statistics ───
  speeds.sort((a, b) => a - b);
  const nonZeroSpeeds = speeds.filter(s => s > IDLE_SPEED_THRESHOLD);
  const avgSpeed = nonZeroSpeeds.length > 0
    ? nonZeroSpeeds.reduce((s, v) => s + v, 0) / nonZeroSpeeds.length
    : 0;
  const maxSpeed = speeds.length > 0 ? speeds[speeds.length - 1] : 0;
  const minSpeed = nonZeroSpeeds.length > 0 ? nonZeroSpeeds[0] : 0;

  const percentile = (arr, p) => {
    if (arr.length === 0) return 0;
    const idx = Math.ceil(arr.length * p / 100) - 1;
    return arr[Math.max(0, Math.min(idx, arr.length - 1))];
  };

  const speedPercentiles = {
    p10: percentile(speeds, 10),
    p25: percentile(speeds, 25),
    p50: percentile(speeds, 50),
    p75: percentile(speeds, 75),
    p90: percentile(speeds, 90)
  };

  // Speed distribution (buckets of 10 km/h)
  const speedDistribution = {};
  speeds.forEach(s => {
    const bucket = Math.floor(s / 10) * 10;
    const label = `${bucket}-${bucket + 10}`;
    speedDistribution[label] = (speedDistribution[label] || 0) + 1;
  });

  // ─── Route efficiency ───
  const firstCoord = validBreadcrumbs[0].coordinates;
  const lastCoord = validBreadcrumbs[validBreadcrumbs.length - 1].coordinates;
  const straightLineKm = haversineDistance(firstCoord, lastCoord);
  const routeEfficiency = totalDistance > 0 ? (straightLineKm / totalDistance) * 100 : 0;

  // Detour % compared to planned route
  const detourPercent = routeDistance > 0
    ? ((totalDistance - routeDistance) / routeDistance) * 100
    : 0;

  // Total ride duration
  const firstTs = validBreadcrumbs[0].timestamp instanceof Date
    ? validBreadcrumbs[0].timestamp.getTime()
    : new Date(validBreadcrumbs[0].timestamp).getTime();
  const lastTs = validBreadcrumbs[validBreadcrumbs.length - 1].timestamp instanceof Date
    ? validBreadcrumbs[validBreadcrumbs.length - 1].timestamp.getTime()
    : new Date(validBreadcrumbs[validBreadcrumbs.length - 1].timestamp).getTime();
  const totalDurationSec = (lastTs - firstTs) / 1000;

  return {
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalDuration: totalDurationSec,
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    maxSpeed: Math.round(maxSpeed * 10) / 10,
    minSpeed: Math.round(minSpeed * 10) / 10,
    speedPercentiles,
    hardBrakeEvents,
    rapidAccelEvents,
    speedingEvents,
    stops,
    totalIdleTimeSec: Math.round(totalIdleTimeSec),
    stopCount: stops.length,
    routeEfficiency: Math.round(routeEfficiency * 10) / 10,
    detourPercent: Math.round(detourPercent * 10) / 10,
    segments,
    speedDistribution,
    waypointCount: validBreadcrumbs.length
  };
}

// ═══════════════════════════════════════════════════════
// FLEET ANALYTICS: Aggregate all rides for Ola/Uber dashboards
// ═══════════════════════════════════════════════════════
function computeFleetAnalytics(rides, bookings) {
  const result = {
    // Speed metrics (fleet-wide)
    fleetAvgSpeed: 0,
    fleetMaxSpeed: 0,
    speedViolationCount: 0,
    hardBrakeTotal: 0,
    rapidAccelTotal: 0,

    // Driving behavior score (0-100)
    avgDrivingScore: 0,

    // Idle & efficiency
    totalIdleMinutes: 0,
    avgIdlePerRide: 0,
    avgRouteEfficiency: 0,
    avgDetourPercent: 0,

    // Revenue unit economics
    revenuePerKm: 0,
    revenuePerHour: 0,
    revenuePerSeatKm: 0,

    // Fleet utilization
    fleetUtilization: 0,  // % of active drivers on ride
    avgRidesPerDriver: 0,
    avgDriverEarningPerHour: 0,

    // Time metrics
    avgWaitTimeMin: 0,     // booking confirmed → pickup
    avgETAAccuracy: 0,     // estimated vs actual duration %
    avgResponseTimeMin: 0, // rider response time to booking

    // Completion & cancellation
    completionRate: 0,
    cancellationRate: 0,
    noShowRate: 0,

    // Trip characteristics
    avgTripDistanceKm: 0,
    avgTripDurationMin: 0,
    avgOccupancy: 0,       // seats booked / total seats
    deadKmPercent: 0,      // km driven without passengers

    // Per-ride analytics (for detailed view)
    rideAnalytics: [],

    // Speed segments for heatmap (aggregated from all rides)
    speedSegments: [],

    // All driving events
    allHardBrakes: [],
    allRapidAccelEvents: [],
    allSpeedingEvents: [],
    allIdleZones: [],

    // Speed distribution (fleet-wide)
    fleetSpeedDistribution: {},

    // Hourly patterns
    hourlyMetrics: Array(24).fill(null).map((_, i) => ({
      hour: i,
      rides: 0,
      avgSpeed: 0,
      revenue: 0,
      _speeds: [],
      _rev: 0
    })),

    // Driver leaderboard
    driverStats: {}
  };

  if (!rides || rides.length === 0) return result;

  let totalSpeeds = [];
  let totalRevenueAll = 0;
  let totalDistanceAll = 0;
  let totalDurationAll = 0;
  let totalSeatsBooked = 0;
  let totalSeatsAvailable = 0;
  let ridesWithBreadcrumbs = 0;
  let routeEfficiencies = [];
  let detourPercents = [];
  let idleTimes = [];
  const uniqueDrivers = new Set();

  rides.forEach(ride => {
    const riderId = ride.rider?._id?.toString() || ride.rider?.toString() || 'unknown';
    uniqueDrivers.add(riderId);

    const routeDist = ride.route?.distance || 0;
    const routeDur = ride.route?.duration || 0;
    const pricePerSeat = ride.pricing?.pricePerSeat || 0;
    const totalSeats = ride.pricing?.totalSeats || 1;
    const bookedSeats = totalSeats - (ride.pricing?.availableSeats || 0);
    const rideRevenue = pricePerSeat * bookedSeats;
    const hour = ride.createdAt ? new Date(ride.createdAt).getHours() : 0;

    totalSeatsAvailable += totalSeats;
    totalSeatsBooked += bookedSeats;
    totalRevenueAll += rideRevenue;
    totalDistanceAll += routeDist;
    totalDurationAll += routeDur;

    // Hourly metrics
    if (hour >= 0 && hour < 24) {
      result.hourlyMetrics[hour].rides++;
      result.hourlyMetrics[hour]._rev += rideRevenue;
    }

    // Driver stats
    if (!result.driverStats[riderId]) {
      result.driverStats[riderId] = {
        name: ride.rider?.profile
          ? `${ride.rider.profile.firstName || ''} ${ride.rider.profile.lastName || ''}`.trim()
          : 'Driver',
        rides: 0, revenue: 0, totalDistance: 0,
        avgSpeed: 0, maxSpeed: 0,
        hardBrakes: 0, speedViolations: 0,
        _speeds: []
      };
    }
    result.driverStats[riderId].rides++;
    result.driverStats[riderId].revenue += rideRevenue;
    result.driverStats[riderId].totalDistance += routeDist;

    // Analyze breadcrumbs if available
    if (ride.tracking?.breadcrumbs?.length > 1) {
      ridesWithBreadcrumbs++;
      const analytics = analyzeRideBreadcrumbs(
        ride.tracking.breadcrumbs, routeDist, routeDur
      );

      result.rideAnalytics.push({
        rideId: ride._id,
        driverName: result.driverStats[riderId].name,
        ...analytics
      });

      // Aggregate speed data
      if (analytics.avgSpeed > 0) {
        totalSpeeds.push(analytics.avgSpeed);
        result.driverStats[riderId]._speeds.push(analytics.avgSpeed);
        if (analytics.maxSpeed > result.driverStats[riderId].maxSpeed) {
          result.driverStats[riderId].maxSpeed = analytics.maxSpeed;
        }
      }

      // Aggregate events
      result.hardBrakeTotal += analytics.hardBrakeEvents.length;
      result.rapidAccelTotal += analytics.rapidAccelEvents.length;
      result.speedViolationCount += analytics.speedingEvents.length;
      result.driverStats[riderId].hardBrakes += analytics.hardBrakeEvents.length;
      result.driverStats[riderId].speedViolations += analytics.speedingEvents.length;

      // Collect events for map layers
      analytics.hardBrakeEvents.forEach(e => {
        result.allHardBrakes.push({ ...e, rideId: ride._id, driverName: result.driverStats[riderId].name });
      });
      analytics.rapidAccelEvents.forEach(e => {
        result.allRapidAccelEvents.push({ ...e, rideId: ride._id, driverName: result.driverStats[riderId].name });
      });
      analytics.speedingEvents.forEach(e => {
        result.allSpeedingEvents.push({ ...e, rideId: ride._id, driverName: result.driverStats[riderId].name });
      });
      analytics.stops.forEach(s => {
        if (s.durationSec > 60) {
          result.allIdleZones.push({ ...s, rideId: ride._id, driverName: result.driverStats[riderId].name });
        }
      });

      // Speed segments for heatmap (sample every Nth to limit data)
      const step = Math.max(1, Math.floor(analytics.segments.length / 50));
      for (let i = 0; i < analytics.segments.length; i += step) {
        result.speedSegments.push({
          from: analytics.segments[i].from,
          to: analytics.segments[i].to,
          midpoint: analytics.segments[i].midpoint,
          speed: analytics.segments[i].speedKmh,
          distKm: analytics.segments[i].distKm,
          timeSec: analytics.segments[i].timeSec
        });
      }

      // Fleet speed distribution
      Object.entries(analytics.speedDistribution).forEach(([bucket, count]) => {
        result.fleetSpeedDistribution[bucket] = (result.fleetSpeedDistribution[bucket] || 0) + count;
      });

      // Hourly speed
      if (hour >= 0 && hour < 24) {
        result.hourlyMetrics[hour]._speeds.push(analytics.avgSpeed);
      }

      // Route efficiency / detour
      if (analytics.routeEfficiency > 0) routeEfficiencies.push(analytics.routeEfficiency);
      if (analytics.detourPercent !== 0) detourPercents.push(analytics.detourPercent);
      idleTimes.push(analytics.totalIdleTimeSec);

      if (analytics.maxSpeed > result.fleetMaxSpeed) {
        result.fleetMaxSpeed = analytics.maxSpeed;
      }
    }
  });

  // ─── Compute booking metrics ───
  let waitTimesMin = [];
  let responseTimesMin = [];
  let etaAccuracies = [];
  let completedCount = 0;
  let cancelledCount = 0;
  let noShowCount = 0;

  if (bookings && bookings.length > 0) {
    bookings.forEach(b => {
      // Status counts
      if (b.status === 'COMPLETED' || b.status === 'DROPPED_OFF') completedCount++;
      else if (b.status === 'CANCELLED') cancelledCount++;
      else if (b.status === 'NO_SHOW') noShowCount++;

      // Wait time: confirmed → picked up
      if (b.riderResponse?.respondedAt && b.journey?.startedAt) {
        const waitMs = new Date(b.journey.startedAt).getTime() - new Date(b.riderResponse.respondedAt).getTime();
        if (waitMs > 0 && waitMs < 3600000) { // < 1 hour sanity
          waitTimesMin.push(waitMs / 60000);
        }
      }

      // Response time
      if (b.riderResponse?.responseTime) {
        responseTimesMin.push(b.riderResponse.responseTime);
      }

      // ETA accuracy
      if (b.journey?.duration && b.ride?.route?.duration) {
        const actual = b.journey.duration;
        const estimated = b.ride.route.duration;
        if (estimated > 0) {
          etaAccuracies.push(Math.abs(actual - estimated) / estimated * 100);
        }
      }
    });
  }

  // ─── Final aggregations ───
  const totalBookings = bookings?.length || 0;
  const numDrivers = uniqueDrivers.size || 1;

  result.fleetAvgSpeed = totalSpeeds.length > 0
    ? Math.round(totalSpeeds.reduce((s, v) => s + v, 0) / totalSpeeds.length * 10) / 10
    : 0;

  result.totalIdleMinutes = Math.round(idleTimes.reduce((s, v) => s + v, 0) / 60);
  result.avgIdlePerRide = idleTimes.length > 0
    ? Math.round(idleTimes.reduce((s, v) => s + v, 0) / idleTimes.length / 60 * 10) / 10
    : 0;

  result.avgRouteEfficiency = routeEfficiencies.length > 0
    ? Math.round(routeEfficiencies.reduce((s, v) => s + v, 0) / routeEfficiencies.length * 10) / 10
    : 0;

  result.avgDetourPercent = detourPercents.length > 0
    ? Math.round(detourPercents.reduce((s, v) => s + v, 0) / detourPercents.length * 10) / 10
    : 0;

  // Revenue unit economics
  result.revenuePerKm = totalDistanceAll > 0
    ? Math.round(totalRevenueAll / totalDistanceAll * 100) / 100
    : 0;

  const totalHours = totalDurationAll / 60;
  result.revenuePerHour = totalHours > 0
    ? Math.round(totalRevenueAll / totalHours * 100) / 100
    : 0;

  const totalSeatKm = totalDistanceAll * (totalSeatsBooked || 1);
  result.revenuePerSeatKm = totalSeatKm > 0
    ? Math.round(totalRevenueAll / totalSeatKm * 100) / 100
    : 0;

  // Fleet utilization & per-driver
  result.avgRidesPerDriver = Math.round(rides.length / numDrivers * 10) / 10;
  result.avgDriverEarningPerHour = totalHours > 0 && numDrivers > 0
    ? Math.round(totalRevenueAll / numDrivers / (totalHours / rides.length) * 100) / 100
    : 0;

  // Time metrics
  result.avgWaitTimeMin = waitTimesMin.length > 0
    ? Math.round(waitTimesMin.reduce((s, v) => s + v, 0) / waitTimesMin.length * 10) / 10
    : 0;

  result.avgETAAccuracy = etaAccuracies.length > 0
    ? Math.round(100 - etaAccuracies.reduce((s, v) => s + v, 0) / etaAccuracies.length)
    : 0;

  result.avgResponseTimeMin = responseTimesMin.length > 0
    ? Math.round(responseTimesMin.reduce((s, v) => s + v, 0) / responseTimesMin.length * 10) / 10
    : 0;

  // Completion rates
  result.completionRate = totalBookings > 0
    ? Math.round(completedCount / totalBookings * 1000) / 10
    : 0;
  result.cancellationRate = totalBookings > 0
    ? Math.round(cancelledCount / totalBookings * 1000) / 10
    : 0;
  result.noShowRate = totalBookings > 0
    ? Math.round(noShowCount / totalBookings * 1000) / 10
    : 0;

  // Trip characteristics
  result.avgTripDistanceKm = rides.length > 0
    ? Math.round(totalDistanceAll / rides.length * 10) / 10
    : 0;
  result.avgTripDurationMin = rides.length > 0
    ? Math.round(totalDurationAll / rides.length * 10) / 10
    : 0;
  result.avgOccupancy = totalSeatsAvailable > 0
    ? Math.round(totalSeatsBooked / totalSeatsAvailable * 1000) / 10
    : 0;

  // Driving score (0-100): penalize for events
  const eventPenalty = Math.min(50,
    (result.hardBrakeTotal * 5 + result.speedViolationCount * 3 + result.rapidAccelTotal * 2) /
    Math.max(1, ridesWithBreadcrumbs)
  );
  result.avgDrivingScore = Math.max(0, Math.round(100 - eventPenalty));

  // Driver stats: compute avg speeds
  Object.values(result.driverStats).forEach(d => {
    d.avgSpeed = d._speeds.length > 0
      ? Math.round(d._speeds.reduce((s, v) => s + v, 0) / d._speeds.length * 10) / 10
      : 0;
    delete d._speeds;
  });

  // Hourly: finalize
  result.hourlyMetrics.forEach(h => {
    h.avgSpeed = h._speeds.length > 0
      ? Math.round(h._speeds.reduce((s, v) => s + v, 0) / h._speeds.length * 10) / 10
      : 0;
    h.revenue = Math.round(h._rev);
    delete h._speeds;
    delete h._rev;
  });

  // Limit arrays for response size
  result.allHardBrakes = result.allHardBrakes.slice(0, 500);
  result.allSpeedingEvents = result.allSpeedingEvents.slice(0, 500);
  result.allIdleZones = result.allIdleZones.slice(0, 300);
  result.speedSegments = result.speedSegments.slice(0, 3000);

  // Convert driverStats to sorted leaderboard
  result.driverLeaderboard = Object.entries(result.driverStats)
    .map(([id, stats]) => ({ driverId: id, ...stats }))
    .sort((a, b) => b.rides - a.rides)
    .slice(0, 50);
  delete result.driverStats;

  // Limit per-ride analytics
  result.rideAnalytics = result.rideAnalytics.slice(0, 100);

  return result;
}

// ═══════════════════════════════════════════════════════
// SUPPLY-DEMAND RATIO PER ZONE (Surge Detection)
// ═══════════════════════════════════════════════════════
function computeSurgeZones(activeDriverLocations, recentSearchLocations, gridSizeKm = 2) {
  if (!activeDriverLocations?.length && !recentSearchLocations?.length) {
    return [];
  }

  // Create a simple grid
  const allCoords = [...(activeDriverLocations || []), ...(recentSearchLocations || [])];
  if (allCoords.length === 0) return [];

  const lngs = allCoords.map(c => c[0]);
  const lats = allCoords.map(c => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const lngStep = gridSizeKm / 111; // ~111 km per degree longitude
  const latStep = gridSizeKm / 111;

  const zones = [];

  for (let lng = minLng; lng <= maxLng; lng += lngStep) {
    for (let lat = minLat; lat <= maxLat; lat += latStep) {
      const supply = (activeDriverLocations || []).filter(c =>
        c[0] >= lng && c[0] < lng + lngStep &&
        c[1] >= lat && c[1] < lat + latStep
      ).length;

      const demand = (recentSearchLocations || []).filter(c =>
        c[0] >= lng && c[0] < lng + lngStep &&
        c[1] >= lat && c[1] < lat + latStep
      ).length;

      if (supply > 0 || demand > 0) {
        const ratio = supply > 0 ? demand / supply : demand > 0 ? demand * 2 : 0;
        const surgeMultiplier = ratio > 3 ? 2.5 : ratio > 2 ? 2.0 : ratio > 1.5 ? 1.5 : 1.0;

        zones.push({
          coordinates: [lng + lngStep / 2, lat + latStep / 2],
          supply,
          demand,
          ratio: Math.round(ratio * 100) / 100,
          surgeMultiplier,
          isSurge: surgeMultiplier > 1.0
        });
      }
    }
  }

  return zones;
}

module.exports = {
  analyzeRideBreadcrumbs,
  computeFleetAnalytics,
  computeSurgeZones,
  haversineDistance,
  CITY_SPEED_LIMIT_KMH,
  IDLE_SPEED_THRESHOLD
};
