const Ride = require('../models/Ride');
const RouteDeviation = require('../models/RouteDeviation');
const Booking = require('../models/Booking');
const Emergency = require('../models/Emergency');
const SearchLog = require('../models/SearchLog');
const RouteAlert = require('../models/RouteAlert');
const turf = require('@turf/turf');
const axios = require('axios');
const { generateDemandForecast } = require('../utils/supplyPredictor');
const { computeFleetAnalytics, computeSurgeZones } = require('../utils/rideAnalytics');
const {
    SERVICE_AREAS, isValidCoordinates, isWithinBBox, matchesCityFilter,
    classifyRide, getNearestServiceArea,
} = require('../utils/serviceAreas');

// Build legacy-compatible CITY_PRESETS from the shared SERVICE_AREAS authority
const CITY_PRESETS = Object.fromEntries(
    Object.entries(SERVICE_AREAS).map(([key, area]) => [
        key === 'delhi_ncr' ? 'delhi' : key,
        { lng: area.center[0], lat: area.center[1], name: area.name, bbox: area.bbox }
    ])
);

const computeRideRevenue = (ride) => {
    const pricePerSeat = ride?.pricing?.pricePerSeat || 0;
    const totalSeats = ride?.pricing?.totalSeats || 0;
    const availableSeats = ride?.pricing?.availableSeats;
    const occupiedSeats = Number.isFinite(availableSeats)
        ? Math.max(totalSeats - availableSeats, 0)
        : totalSeats;

    return ride?.pricing?.totalEarnings || (pricePerSeat * Math.max(occupiedSeats, 1));
};

/**
 * @desc    Get comprehensive geospatial data for Bird Eye View
 * @route   GET /api/admin/analytics/bird-eye
 * @access  Private/Admin
 */
const getBirdEyeData = async (req, res) => {
    try {
        const { startDate, endDate, city } = req.query;
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);
        const hasDateFilter = Object.keys(dateFilter).length > 0;

        const cityPreset = city && CITY_PRESETS[city.toLowerCase()] ? CITY_PRESETS[city.toLowerCase()] : null;
        const cityBBox = cityPreset?.bbox || null;

        // 1. ARC LAYER: Origin->Destination ride corridors
        const completedQuery = { status: 'COMPLETED' };
        if (hasDateFilter) completedQuery.createdAt = dateFilter;

        let completedRides = await Ride.find(completedQuery)
            .sort({ createdAt: -1 })
            .limit(3000)
            .select('route.start route.destination pricing tracking.breadcrumbs tracking.currentLocation rider status createdAt schedule.departureTime route.distance route.duration')
            .populate('rider', 'profile.firstName profile.lastName');

        completedRides = completedRides.filter(ride => matchesCityFilter(
            cityBBox,
            ride.route?.start?.coordinates,
            ride.route?.destination?.coordinates,
            ride.tracking?.currentLocation?.coordinates
        ));

        const arcData = completedRides
            .filter(r => r.route?.start?.coordinates && r.route?.destination?.coordinates)
            .map(ride => {
                const totalSeats = ride.pricing?.totalSeats || 1;
                const availableSeats = ride.pricing?.availableSeats;
                const occupiedSeats = Number.isFinite(availableSeats)
                    ? Math.max(totalSeats - availableSeats, 1)
                    : totalSeats;

                return {
                    source: ride.route.start.coordinates,
                    target: ride.route.destination.coordinates,
                    sourceName: ride.route.start.address || '',
                    targetName: ride.route.destination.address || '',
                    value: occupiedSeats,
                    price: ride.pricing?.pricePerSeat || 0,
                    totalPrice: computeRideRevenue(ride),
                    distance: ride.route?.distance || 0,
                    duration: ride.route?.duration || 0,
                    timestamp: new Date(ride.createdAt).getTime(),
                    hour: new Date(ride.createdAt).getHours()
                };
            });

        // 2-5. BOOKING DATA: Heatmap, Pickups, Dropoffs
        const bookingQuery = {};
        if (hasDateFilter) bookingQuery.createdAt = dateFilter;
        let bookings = await Booking.find(bookingQuery)
            .populate('ride', 'route.start.coordinates route.destination.coordinates route.duration')
            .limit(5000)
            .select('seatsBooked status createdAt pickupPoint dropoffPoint totalPrice payment.totalAmount');

        bookings = bookings.filter(booking => matchesCityFilter(
            cityBBox,
            booking.pickupPoint?.coordinates,
            booking.dropoffPoint?.coordinates,
            booking.ride?.route?.start?.coordinates,
            booking.ride?.route?.destination?.coordinates
        ));

        const heatmapData = [];
        const pickupPoints = [];
        const dropoffPoints = [];

        bookings.forEach(b => {
            const fareValue = b.totalPrice || b.payment?.totalAmount || 0;
            if (b.ride?.route?.start?.coordinates) {
                heatmapData.push({
                    coordinates: b.ride.route.start.coordinates,
                    weight: b.seatsBooked || 1,
                    timestamp: new Date(b.createdAt).getTime()
                });
            }
            if (b.pickupPoint?.coordinates) {
                pickupPoints.push({
                    coordinates: b.pickupPoint.coordinates,
                    weight: b.seatsBooked || 1,
                    fare: fareValue,
                    status: b.status
                });
            }
            if (b.dropoffPoint?.coordinates) {
                dropoffPoints.push({
                    coordinates: b.dropoffPoint.coordinates,
                    weight: b.seatsBooked || 1,
                    fare: fareValue,
                    status: b.status
                });
            }
        });

        // 6-8. LIVE TELEMETRY: Drivers, Routes, Breadcrumbs
        let activeRides = await Ride.find({ status: { $in: ['ACTIVE', 'IN_PROGRESS'] } })
            .select('route.start route.destination route.geometry tracking rider schedule.departureTime pricing.totalSeats pricing.availableSeats pricing.pricePerSeat')
            .populate('rider', 'profile.firstName profile.lastName');

        activeRides = activeRides.filter(ride => matchesCityFilter(
            cityBBox,
            ride.route?.start?.coordinates,
            ride.route?.destination?.coordinates,
            ride.tracking?.currentLocation?.coordinates
        ));

        const liveTelemetry = [];
        const activeRoutes = [];
        const breadcrumbTrails = [];

        activeRides.filter(r => r.route?.start?.coordinates).forEach(ride => {
            const loc = ride.tracking?.currentLocation?.coordinates || ride.route.start.coordinates;
            const driverName = ride.rider ? `${ride.rider.profile?.firstName || ''} ${ride.rider.profile?.lastName || ''}`.trim() : 'Unknown';

            liveTelemetry.push({
                coordinates: loc,
                driverName,
                id: ride._id,
                speed: ride.tracking?.currentLocation?.speed || 0,
                heading: ride.tracking?.heading || 0,
                startCoords: ride.route.start.coordinates,
                destCoords: ride.route.destination?.coordinates,
                passengers: Number.isFinite(ride.pricing?.availableSeats)
                    ? Math.max((ride.pricing?.totalSeats || 0) - ride.pricing.availableSeats, 0)
                    : (ride.pricing?.totalSeats || 0),
                startAddress: ride.route.start.address || '',
                destAddress: ride.route.destination?.address || '',
                updatedAt: ride.tracking?.currentLocation?.timestamp || new Date().toISOString()
            });

            if (ride.route?.geometry?.coordinates?.length > 1) {
                activeRoutes.push({
                    id: ride._id,
                    path: ride.route.geometry.coordinates,
                    driverName,
                    startAddress: ride.route.start.address || '',
                    destAddress: ride.route.destination?.address || ''
                });
            }

            if (ride.tracking?.breadcrumbs?.length > 1) {
                const validWaypoints = ride.tracking.breadcrumbs
                    .filter(bc => bc.coordinates)
                    .map((bc, i, arr) => ({
                        coordinates: bc.coordinates,
                        timestamp: bc.timestamp
                            ? new Date(bc.timestamp).getTime()
                            : Date.now() - (arr.length - i) * 5000
                    }));

                if (validWaypoints.length > 1) {
                    const minTs = validWaypoints[0].timestamp;
                    breadcrumbTrails.push({
                        id: ride._id,
                        driverName,
                        waypoints: validWaypoints.map(w => ({
                            coordinates: w.coordinates,
                            timestamp: (w.timestamp - minTs) / 1000
                        })),
                        totalDuration: (validWaypoints[validWaypoints.length - 1].timestamp - minTs) / 1000
                    });
                }
            }
        });

        // 9. DANGER ZONES: Route Deviations
        const devQuery = { severity: { $in: ['HIGH', 'CRITICAL'] } };
        if (hasDateFilter) devQuery.createdAt = dateFilter;

        let deviations = await RouteDeviation.find(devQuery)
            .sort({ createdAt: -1 })
            .limit(500)
            .select('deviationLocation.coordinates expectedLocation.coordinates deviationType severity deviationDistance duration createdAt ride metadata');

        deviations = deviations.filter(deviation => matchesCityFilter(
            cityBBox,
            deviation.deviationLocation?.coordinates,
            deviation.expectedLocation?.coordinates
        ));

        const dangerZones = deviations
            .filter(d => d.deviationLocation?.coordinates)
            .map(d => ({
                coordinates: d.deviationLocation.coordinates,
                expectedCoordinates: d.expectedLocation?.coordinates || null,
                type: d.deviationType || 'ROUTE_DEVIATION',
                severity: d.severity,
                distance: d.deviationDistance || 0,
                duration: d.duration || 0,
                rideId: d.ride,
                speed: d.metadata?.speed || null,
                heading: d.metadata?.heading || null,
                timestamp: d.createdAt ? new Date(d.createdAt).getTime() : null
            }));

        // 10. EMERGENCY SOS LOCATIONS
        let emergencies = [];
        try {
            let sosEvents = await Emergency.find({ status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] } })
                .limit(100)
                .select('location type status severity user createdAt description adminNotes')
                .populate('user', 'profile.firstName profile.lastName phone');

            sosEvents = sosEvents.filter(event => matchesCityFilter(
                cityBBox,
                event.location?.coordinates?.coordinates || event.location?.coordinates
            ));

            emergencies = sosEvents
                .filter(e => e.location?.coordinates?.coordinates || e.location?.coordinates)
                .map(e => {
                    const userName = e.user
                        ? `${e.user.profile?.firstName || ''} ${e.user.profile?.lastName || ''}`.trim()
                        : 'Unknown';
                    return {
                        coordinates: e.location?.coordinates?.coordinates || e.location?.coordinates,
                        type: e.type || 'SOS',
                        status: e.status,
                        severity: e.severity || 'HIGH',
                        userId: e.user?._id || e.user,
                        userName,
                        phone: e.user?.phone || '',
                        description: e.description || '',
                        adminNotes: e.adminNotes || '',
                        timestamp: e.createdAt ? new Date(e.createdAt).getTime() : null
                    };
                });
        } catch (_) { /* Emergency model may not exist */ }

        // 11. UNFULFILLED DEMAND: Searches with 0 results
        let unfulfilledDemand = [];
        try {
            const searchQuery = { resultsCount: 0 };
            if (hasDateFilter) searchQuery.createdAt = dateFilter;

            let noResultSearches = await SearchLog.find(searchQuery)
                .sort({ createdAt: -1 })
                .limit(2000)
                .select('searchParams.origin searchParams.destination searchParams.date searchParams.seats createdAt');

            noResultSearches = noResultSearches.filter(search => matchesCityFilter(
                cityBBox,
                search.searchParams?.origin?.coordinates,
                search.searchParams?.destination?.coordinates
            ));

            unfulfilledDemand = noResultSearches
                .filter(s => s.searchParams?.origin?.coordinates?.length === 2)
                .map(s => ({
                    originCoords: s.searchParams.origin.coordinates,
                    destCoords: s.searchParams.destination?.coordinates || null,
                    originAddress: s.searchParams.origin.address || '',
                    destAddress: s.searchParams.destination?.address || '',
                    seats: s.searchParams.seats || 1,
                    searchDate: s.searchParams.date,
                    timestamp: new Date(s.createdAt).getTime()
                }));
        } catch (_) { /* SearchLog model may not exist */ }

        // 12. ROUTE ALERT ZONES: Subscribed corridors where users want rides
        let routeAlerts = [];
        try {
            let alerts = await RouteAlert.find({
                active: true,
                expiresAt: { $gt: new Date() }
            })
                .limit(500)
                .select('origin destination radiusKm user schedule createdAt minSeats maxPricePerSeat triggerCount lastTriggered expiresAt active')
                .populate('user', 'profile.firstName');

            alerts = alerts.filter(alert => matchesCityFilter(
                cityBBox,
                alert.origin?.coordinates?.coordinates,
                alert.destination?.coordinates?.coordinates
            ));

            routeAlerts = alerts
                .filter(a => a.origin?.coordinates?.coordinates?.length === 2)
                .map(a => ({
                    originCoords: a.origin.coordinates.coordinates,
                    destCoords: a.destination?.coordinates?.coordinates || null,
                    originAddress: a.origin.address || '',
                    destAddress: a.destination?.address || '',
                    radiusKm: a.radiusKm || 5,
                    userName: a.user?.profile?.firstName || 'User',
                    minSeats: a.minSeats || 1,
                    maxPricePerSeat: a.maxPricePerSeat ?? null,
                    triggerCount: a.triggerCount || 0,
                    lastTriggered: a.lastTriggered || null,
                    expiresAt: a.expiresAt || null,
                    schedule: a.schedule || null,
                    timestamp: a.createdAt ? new Date(a.createdAt).getTime() : null
                }));
        } catch (_) { /* RouteAlert model may not exist */ }

        // 13. DENSITY + REVENUE DATA
        const rideDensity = {};
        completedRides.filter(r => r.route?.start?.coordinates).forEach(r => {
            const lng = Math.round(r.route.start.coordinates[0] * 200) / 200;
            const lat = Math.round(r.route.start.coordinates[1] * 200) / 200;
            const key = `${lng},${lat}`;
            if (!rideDensity[key]) {
                rideDensity[key] = { coordinates: [lng, lat], count: 0, totalRevenue: 0 };
            }
            rideDensity[key].count++;
            rideDensity[key].totalRevenue += computeRideRevenue(r);
        });
        const densityData = Object.values(rideDensity);

        // 14. HOURLY DEMAND DISTRIBUTION
        const hourlyDistribution = Array(24).fill(null).map((_, i) => ({
            hour: i, rides: 0, revenue: 0, avgDistance: 0, _totalDist: 0
        }));

        arcData.forEach(a => {
            const h = a.hour;
            if (h >= 0 && h < 24) {
                hourlyDistribution[h].rides++;
                hourlyDistribution[h].revenue += a.totalPrice || 0;
                hourlyDistribution[h]._totalDist += a.distance || 0;
            }
        });

        hourlyDistribution.forEach(h => {
            h.avgDistance = h.rides > 0 ? Math.round(h._totalDist / h.rides * 10) / 10 : 0;
            delete h._totalDist;
        });

        const peakHour = hourlyDistribution.reduce((max, h) => h.rides > max.rides ? h : max, hourlyDistribution[0]);

        // SUMMARY STATS
        const totalRevenue = arcData.reduce((s, a) => s + (a.totalPrice || 0), 0);
        const avgDistance = arcData.length ? (arcData.reduce((s, a) => s + (a.distance || 0), 0) / arcData.length) : 0;
        const avgDuration = arcData.length ? (arcData.reduce((s, a) => s + (a.duration || 0), 0) / arcData.length) : 0;

        // Auto-detect center from data if no city preset
        let detectedCenter = null;
        if (!cityPreset && arcData.length > 0) {
            const avgLng = arcData.reduce((s, a) => s + a.source[0], 0) / arcData.length;
            const avgLat = arcData.reduce((s, a) => s + a.source[1], 0) / arcData.length;
            detectedCenter = { lng: Math.round(avgLng * 10000) / 10000, lat: Math.round(avgLat * 10000) / 10000 };
        }

        // ═══ FLEET ANALYTICS: Ola/Uber-grade metrics from breadcrumbs ═══
        const fleetAnalytics = computeFleetAnalytics(completedRides, bookings);

        // ═══ SURGE ZONES: supply vs demand ratio ═══
        const driverLocations = liveTelemetry.map(d => d.coordinates);
        const demandLocations = [
            ...heatmapData.map(h => h.coordinates),
            ...unfulfilledDemand.map(d => d.originCoords)
        ];
        const surgeZones = computeSurgeZones(driverLocations, demandLocations);

        res.status(200).json({
            success: true,
            data: {
                arcData,
                heatmapData,
                liveTelemetry,
                dangerZones,
                emergencies,
                activeRoutes,
                breadcrumbTrails,
                pickupPoints,
                dropoffPoints,
                densityData,
                unfulfilledDemand,
                routeAlerts,
                hourlyDistribution,
                cityPresets: CITY_PRESETS,
                serviceAreas: SERVICE_AREAS,
                detectedCenter: cityPreset || detectedCenter,
                // NEW: Ola/Uber-grade analytics
                speedSegments: fleetAnalytics.speedSegments,
                hardBrakeEvents: fleetAnalytics.allHardBrakes,
                rapidAccelEvents: fleetAnalytics.allRapidAccelEvents,
                speedingEvents: fleetAnalytics.allSpeedingEvents,
                idleZones: fleetAnalytics.allIdleZones,
                surgeZones,
                stats: {
                    city: cityPreset?.name || 'All Cities',
                    totalRides: completedRides.length,
                    activeDrivers: liveTelemetry.length,
                    activeRides: activeRides.length,
                    demandSignals: heatmapData.length,
                    dangerZones: dangerZones.length,
                    emergencies: emergencies.length,
                    totalRevenue,
                    avgDistance: Math.round(avgDistance * 10) / 10,
                    avgDuration: Math.round(avgDuration),
                    avgFare: arcData.length > 0 ? Math.round(totalRevenue / arcData.length) : 0,
                    averageOccupancy: fleetAnalytics.avgOccupancy,
                    busiestArea: [...densityData].sort((a, b) => b.count - a.count)[0] || null,
                    unfulfilledSearches: unfulfilledDemand.length,
                    routeAlertCount: routeAlerts.length,
                    peakHour: peakHour.hour,
                    peakHourRides: peakHour.rides,
                    liveRoutes: activeRoutes.length,
                    trailsCount: breadcrumbTrails.length,
                    // NEW: Ola/Uber metrics
                    fleetAvgSpeed: fleetAnalytics.fleetAvgSpeed,
                    fleetMaxSpeed: fleetAnalytics.fleetMaxSpeed,
                    speedViolations: fleetAnalytics.speedViolationCount,
                    hardBrakeCount: fleetAnalytics.hardBrakeTotal,
                    rapidAccelCount: fleetAnalytics.rapidAccelTotal,
                    drivingScore: fleetAnalytics.avgDrivingScore,
                    revenuePerKm: fleetAnalytics.revenuePerKm,
                    revenuePerHour: fleetAnalytics.revenuePerHour,
                    revenuePerSeatKm: fleetAnalytics.revenuePerSeatKm,
                    avgWaitTimeMin: fleetAnalytics.avgWaitTimeMin,
                    avgETAAccuracy: fleetAnalytics.avgETAAccuracy,
                    avgResponseTimeMin: fleetAnalytics.avgResponseTimeMin,
                    completionRate: fleetAnalytics.completionRate,
                    cancellationRate: fleetAnalytics.cancellationRate,
                    noShowRate: fleetAnalytics.noShowRate,
                    avgIdleMinPerRide: fleetAnalytics.avgIdlePerRide,
                    avgRouteEfficiency: fleetAnalytics.avgRouteEfficiency,
                    avgDetourPercent: fleetAnalytics.avgDetourPercent,
                    avgRidesPerDriver: fleetAnalytics.avgRidesPerDriver,
                    surgeZoneCount: surgeZones.filter(z => z.isSurge).length,
                    fleetSpeedDistribution: fleetAnalytics.fleetSpeedDistribution,
                    hourlyMetrics: fleetAnalytics.hourlyMetrics,
                    driverLeaderboard: fleetAnalytics.driverLeaderboard?.slice(0, 10)
                }
            }
        });

    } catch (error) {
        console.error('Bird Eye Data Error:', error);
        res.status(500).json({ success: false, message: 'Server Error aggregating geospatial data' });
    }
};

exports.getBirdEyeData = getBirdEyeData;
exports.getGodsEyeData = getBirdEyeData;

/**
 * @desc    Get Isochrone Polygon for reachability zones
 * @route   GET /api/admin/analytics/isochrone
 * @access  Private/Admin
 */
exports.getIsochrone = async (req, res) => {
    try {
        const { lng, lat, minutes = 15 } = req.query;
        if (!lng || !lat) return res.status(400).json({ success: false, message: 'Coordinates (lng, lat) required' });

        const centerLng = parseFloat(lng);
        const centerLat = parseFloat(lat);
        const mins = parseInt(minutes, 10);
        const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

        if (mapboxToken) {
            const url = `https://api.mapbox.com/isochrone/v1/mapbox/driving/${centerLng},${centerLat}?contours_minutes=${mins}&polygons=true&access_token=${mapboxToken}`;
            const response = await axios.get(url);
            return res.status(200).json({ success: true, data: response.data });
        }

        // Turf.js fallback - organic irregular polygon
        const avgSpeedKmH = 20;
        const radiusKm = (avgSpeedKmH / 60) * mins;
        const center = [centerLng, centerLat];

        const numPoints = 36;
        const coords = [];
        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 360;
            const variation = 0.7 + Math.random() * 0.6;
            const r = radiusKm * variation;
            const dest = turf.destination(center, r, angle, { units: 'kilometers' });
            coords.push(dest.geometry.coordinates);
        }
        coords.push(coords[0]);

        const polygon = turf.polygon([coords], {
            contour: mins,
            fill: 'rgba(14,173,105,0.15)',
            'fill-opacity': 0.2,
            stroke: '#0ead69',
            'stroke-width': 2
        });

        return res.status(200).json({
            success: true,
            data: {
                type: 'FeatureCollection',
                features: [polygon]
            }
        });
    } catch (error) {
        console.error('Isochrone Error:', error);
        res.status(500).json({ success: false, message: 'Server Error generating isochrone' });
    }
};

/**
 * @desc    Get Real Weather Data for city grid
 * @route   GET /api/admin/analytics/weather
 * @access  Private/Admin
 * Uses OpenWeatherMap API if OPENWEATHER_API_KEY is set, otherwise enhanced simulation
 */
exports.getWeatherGrid = async (req, res) => {
    try {
        const { city } = req.query;
        const isAllCities = !city || city.toLowerCase() === 'all';
        const presets = isAllCities
            ? Object.values(CITY_PRESETS)
            : [CITY_PRESETS[city.toLowerCase()] || CITY_PRESETS.chennai];

        const primaryPreset = presets[0];
        const apiKey = process.env.OPENWEATHER_API_KEY;

        // Fetch weather info for each city center
        const weatherInfoMap = new Map();
        for (const preset of presets) {
            let weatherInfo = null;
            if (apiKey) {
                try {
                    const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${preset.lat}&lon=${preset.lng}&appid=${apiKey}&units=metric`;
                    const response = await axios.get(owmUrl, { timeout: 5000 });
                    const d = response.data;
                    weatherInfo = {
                        temp: d.main?.temp || 30,
                        humidity: d.main?.humidity || 70,
                        windSpeed: d.wind?.speed || 0,
                        windDeg: d.wind?.deg || 0,
                        clouds: d.clouds?.all || 0,
                        condition: d.weather?.[0]?.main || 'Clear',
                        description: d.weather?.[0]?.description || '',
                        rain1h: d.rain?.['1h'] || 0,
                        visibility: d.visibility || 10000,
                        icon: d.weather?.[0]?.icon || '01d'
                    };
                } catch (apiErr) {
                    console.warn(`OpenWeatherMap API failed for ${preset.name}, using simulation:`, apiErr.message);
                }
            }
            weatherInfoMap.set(preset.name, weatherInfo);
        }

        // Generate hex grids for each city and merge
        let allWeatherFeatures = [];
        for (const preset of presets) {
            const hexSize = isAllCities ? 1.5 : 1.0; // slightly larger hexes for all-cities to keep count manageable
            const bbox = [preset.lng - 0.15, preset.lat - 0.15, preset.lng + 0.15, preset.lat + 0.15];
            const hexgrid = turf.hexGrid(bbox, hexSize, { units: 'kilometers' });
            const weatherInfo = weatherInfoMap.get(preset.name);
            const centerLng = preset.lng;
            const centerLat = preset.lat;

        let weatherFeatures;

        if (weatherInfo) {
            // Real weather: apply uniform conditions with spatial variation
            const baseRain = weatherInfo.rain1h;
            const isRainy = ['Rain', 'Drizzle', 'Thunderstorm'].includes(weatherInfo.condition);
            const isStorming = weatherInfo.condition === 'Thunderstorm';

            weatherFeatures = hexgrid.features.map(feature => {
                const centroid = turf.centroid(feature).geometry.coordinates;
                const distFromCenter = turf.distance([centerLng, centerLat], centroid, { units: 'kilometers' });
                const variation = (Math.random() * 0.4 - 0.2);
                let rainIntensity = isRainy
                    ? Math.max(0, Math.min(100, baseRain * 10 + (Math.random() * 30) - distFromCenter * 2))
                    : Math.max(0, weatherInfo.clouds * 0.3 + variation * 20);

                let condition = 'CLEAR';
                if (isStorming && rainIntensity > 40) condition = 'STORM';
                else if (isRainy || rainIntensity > 30) condition = 'RAIN';

                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        condition, temperature: Math.round(weatherInfo.temp + (Math.random() * 2 - 1)),
                        humidity: weatherInfo.humidity,
                        windSpeed: Math.round(weatherInfo.windSpeed * 10) / 10,
                        rainIntensity: Math.round(rainIntensity),
                        visibility: weatherInfo.visibility, realData: true
                    }
                };
            });
        } else {
            // Enhanced simulation for Indian cities
            const hour = new Date().getHours();
            const month = new Date().getMonth();
            const isMonsoon = month >= 5 && month <= 9;
            const isEvening = hour >= 16 && hour <= 20;
            const baseRainProb = isMonsoon ? 0.6 : 0.15;
            const hasRain = Math.random() < baseRainProb;
            const stormCenter = hasRain
                ? [centerLng + (Math.random() * 0.2 - 0.1), centerLat + (Math.random() * 0.2 - 0.1)]
                : null;

            weatherFeatures = hexgrid.features.map(feature => {
                const centroid = turf.centroid(feature).geometry.coordinates;
                let rainIntensity = 0;
                let condition = 'CLEAR';

                if (hasRain && stormCenter) {
                    const stormDist = turf.distance(stormCenter, centroid, { units: 'kilometers' });
                    rainIntensity = Math.max(0, 100 - (stormDist * 6));
                    rainIntensity += (Math.random() * 20 - 10);
                    rainIntensity = Math.max(0, Math.min(100, rainIntensity));
                    if (rainIntensity > 70) condition = 'STORM';
                    else if (rainIntensity > 25) condition = 'RAIN';
                }

                const baseTemp = isMonsoon ? 28 : (month >= 2 && month <= 5 ? 35 : 26);
                const temp = baseTemp + (Math.random() * 4 - 2) - (isEvening ? 3 : 0);

                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        condition, temperature: Math.round(temp),
                        humidity: hasRain ? 80 + Math.round(Math.random() * 15) : 55 + Math.round(Math.random() * 20),
                        windSpeed: Math.round((3 + Math.random() * 8) * 10) / 10,
                        rainIntensity: Math.round(rainIntensity),
                        visibility: rainIntensity > 70 ? 3000 : rainIntensity > 30 ? 6000 : 10000,
                        realData: false
                    }
                };
            });
        }

            allWeatherFeatures = allWeatherFeatures.concat(weatherFeatures);
        }

        const activeFeatures = allWeatherFeatures.filter(f =>
            f.properties.rainIntensity > 10 || f.properties.condition !== 'CLEAR'
        );

        // Use primary preset weather for summary
        const primaryWeather = weatherInfoMap.get(primaryPreset.name);

        res.status(200).json({
            success: true,
            data: {
                type: 'FeatureCollection',
                features: activeFeatures.length > 0 ? activeFeatures : allWeatherFeatures.slice(0, 50)
            },
            meta: {
                city: isAllCities ? 'All Cities' : primaryPreset.name,
                realData: !!primaryWeather,
                source: primaryWeather ? 'OpenWeatherMap' : 'Simulation',
                citiesCovered: presets.map(p => p.name),
                timestamp: new Date().toISOString(),
                summary: primaryWeather || { condition: 'CLEAR', temperature: 30 }
            }
        });
    } catch (error) {
        console.error('Weather Grid Error:', error);
        res.status(500).json({ success: false, message: 'Server Error generating weather grid' });
    }
};

/**
 * @desc    Get 24h Predictive Supply Forecast
 * @route   GET /api/admin/analytics/forecast
 * @access  Private/Admin
 */
exports.getSupplyForecast = async (req, res) => {
    try {
        const { city } = req.query;
        const isAllCities = !city || city.toLowerCase() === 'all';
        const presets = isAllCities
            ? Object.values(CITY_PRESETS)
            : [CITY_PRESETS[city.toLowerCase()] || CITY_PRESETS.chennai];

        // Generate forecast for each city and merge
        const allForecasts = [];
        for (const preset of presets) {
            const cityForecast = await generateDemandForecast({
                centerLng: preset.lng,
                centerLat: preset.lat,
                bbox: preset.bbox
            });
            allForecasts.push(...cityForecast);
        }

        res.status(200).json({
            success: true,
            data: allForecasts,
            meta: {
                city: isAllCities ? 'All Cities' : presets[0].name,
                citiesCovered: presets.map(p => p.name)
            }
        });
    } catch (error) {
        console.error('Forecast Error:', error);
        res.status(500).json({ success: false, message: 'Server Error generating forecast' });
    }
};

/**
 * @desc    Get detailed ride analytics — Ola/Uber-grade metrics
 * @route   GET /api/admin/analytics/ride-analytics
 * @access  Private/Admin
 * 
 * Returns: per-ride speed analysis, fleet metrics, driver leaderboard,
 *          surge zones, speed distribution, driving events
 */
exports.getRideAnalytics = async (req, res) => {
    try {
        const { startDate, endDate, limit = 500 } = req.query;
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);
        const hasDateFilter = Object.keys(dateFilter).length > 0;

        // Get rides with full breadcrumb data for analysis
        const rideQuery = { status: { $in: ['COMPLETED', 'IN_PROGRESS'] } };
        if (hasDateFilter) rideQuery.createdAt = dateFilter;

        const rides = await Ride.find(rideQuery)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit, 10))
            .select('route pricing tracking rider status createdAt schedule')
            .populate('rider', 'profile.firstName profile.lastName');

        // Get matching bookings for unit economics
        const rideIds = rides.map(r => r._id);
        const bookings = await Booking.find({ ride: { $in: rideIds } })
            .select('status seatsBooked totalPrice riderResponse journey ride')
            .populate('ride', 'route.duration');

        const analytics = computeFleetAnalytics(rides, bookings);

        // Also compute surge from live data
        const liveRides = await Ride.find({ status: { $in: ['ACTIVE', 'IN_PROGRESS'] } })
            .select('tracking.currentLocation.coordinates route.start.coordinates');
        const driverLocs = liveRides
            .map(r => r.tracking?.currentLocation?.coordinates || r.route?.start?.coordinates)
            .filter(Boolean);

        let searchLocs = [];
        try {
            const recentSearches = await SearchLog.find({
                createdAt: { $gte: new Date(Date.now() - 3600000) }
            }).select('searchParams.origin.coordinates').limit(1000);
            searchLocs = recentSearches
                .filter(s => s.searchParams?.origin?.coordinates?.length === 2)
                .map(s => s.searchParams.origin.coordinates);
        } catch (_) {}

        const surgeZones = computeSurgeZones(driverLocs, searchLocs);

        res.status(200).json({
            success: true,
            data: {
                // Fleet-wide metrics
                fleetAvgSpeed: analytics.fleetAvgSpeed,
                fleetMaxSpeed: analytics.fleetMaxSpeed,
                speedViolations: analytics.speedViolationCount,
                hardBrakeCount: analytics.hardBrakeTotal,
                rapidAccelCount: analytics.rapidAccelTotal,
                drivingScore: analytics.avgDrivingScore,

                // Unit economics
                revenuePerKm: analytics.revenuePerKm,
                revenuePerHour: analytics.revenuePerHour,
                revenuePerSeatKm: analytics.revenuePerSeatKm,
                avgRidesPerDriver: analytics.avgRidesPerDriver,
                avgDriverEarningPerHour: analytics.avgDriverEarningPerHour,

                // Time metrics
                avgWaitTimeMin: analytics.avgWaitTimeMin,
                avgETAAccuracy: analytics.avgETAAccuracy,
                avgResponseTimeMin: analytics.avgResponseTimeMin,

                // Completion
                completionRate: analytics.completionRate,
                cancellationRate: analytics.cancellationRate,
                noShowRate: analytics.noShowRate,

                // Trip characteristics
                avgTripDistanceKm: analytics.avgTripDistanceKm,
                avgTripDurationMin: analytics.avgTripDurationMin,
                avgOccupancy: analytics.avgOccupancy,
                avgRouteEfficiency: analytics.avgRouteEfficiency,
                avgDetourPercent: analytics.avgDetourPercent,
                avgIdleMinPerRide: analytics.avgIdlePerRide,
                totalIdleMinutes: analytics.totalIdleMinutes,

                // Map layers
                speedSegments: analytics.speedSegments,
                hardBrakeEvents: analytics.allHardBrakes,
                rapidAccelEvents: analytics.allRapidAccelEvents,
                speedingEvents: analytics.allSpeedingEvents,
                idleZones: analytics.allIdleZones,
                surgeZones,

                // Distributions & patterns
                fleetSpeedDistribution: analytics.fleetSpeedDistribution,
                hourlyMetrics: analytics.hourlyMetrics,

                // Driver leaderboard
                driverLeaderboard: analytics.driverLeaderboard,

                // Per-ride breakdown (limited)
                rideAnalytics: analytics.rideAnalytics,

                meta: {
                    ridesAnalyzed: rides.length,
                    bookingsAnalyzed: bookings.length,
                    timestamp: new Date().toISOString()
                }
            }
        });
    } catch (error) {
        console.error('Ride Analytics Error:', error);
        res.status(500).json({ success: false, message: 'Server Error computing ride analytics' });
    }
};
