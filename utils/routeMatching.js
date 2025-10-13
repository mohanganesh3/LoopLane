/**
 * Route Matching Utility
 * Advanced algorithm for matching passenger routes with rider routes
 * Uses OSRM for routing and calculations for proximity matching
 */

const axios = require('axios');
const helpers = require('./helpers');

class RouteMatching {
    constructor() {
        this.OSRM_URL = process.env.OSRM_API_URL || 'https://router.project-osrm.org';
        this.DEVIATION_THRESHOLD = parseFloat(process.env.ROUTE_DEVIATION_THRESHOLD) || 10; // km for intermediate points (increased for highways)
        this.ENDPOINT_THRESHOLD = parseFloat(process.env.ROUTE_ENDPOINT_THRESHOLD) || 20; // km tolerance for start/end matching
        this.MAX_DETOUR_PERCENT = 20; // Maximum 20% detour allowed
        this.EXACT_MATCH_EPSILON = 0.5; // km - for detecting exact waypoint matches
        
        console.log('🔧 [RouteMatching] Initialized with thresholds:');
        console.log(`   DEVIATION_THRESHOLD: ${this.DEVIATION_THRESHOLD} km`);
        console.log(`   ENDPOINT_THRESHOLD: ${this.ENDPOINT_THRESHOLD} km`);
        console.log(`   EXACT_MATCH_EPSILON: ${this.EXACT_MATCH_EPSILON} km`);
    }

    /**
     * Check if a point is near a route line
     * @param {Array} point - [lon, lat]
     * @param {Array} routeCoordinates - Array of [lon, lat] points
     * @param {number} threshold - Distance threshold in km
     * @returns {object} Match result
     */
    isPointNearRoute(point, routeCoordinates, threshold = this.DEVIATION_THRESHOLD) {
        // First, check for exact/near matches at waypoints (prioritize exact coordinate matches)
        for (let i = 0; i < routeCoordinates.length; i++) {
            const [lon, lat] = routeCoordinates[i];
            const dist = helpers.calculateDistance(
                point[1], point[0],
                lat, lon
            );
            
            // If point is very close to a waypoint (within 500m), return it immediately
            if (dist < this.EXACT_MATCH_EPSILON) {
                return {
                    isNear: true,
                    distance: dist,
                    closestIndex: i,
                    closestPoint: routeCoordinates[i],
                    isExactMatch: true
                };
            }
        }

        let minDistance = Infinity;
        let closestIndex = -1;
        let closestPoint = null;

        // Check distance to each segment of the route
        for (let i = 0; i < routeCoordinates.length - 1; i++) {
            const segmentStart = routeCoordinates[i];
            const segmentEnd = routeCoordinates[i + 1];
            
            const distance = this.pointToSegmentDistance(
                point,
                segmentStart,
                segmentEnd
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
                closestPoint = this.closestPointOnSegment(point, segmentStart, segmentEnd);
            }
        }

        return {
            isNear: minDistance <= threshold,
            distance: minDistance,
            closestIndex: closestIndex,
            closestPoint: closestPoint,
            isExactMatch: false
        };
    }

    /**
     * Calculate distance from point to line segment
     * @param {Array} point - [lon, lat]
     * @param {Array} segmentStart - [lon, lat]
     * @param {Array} segmentEnd - [lon, lat]
     * @returns {number} Distance in km
     */
    pointToSegmentDistance(point, segmentStart, segmentEnd) {
        const closestPoint = this.closestPointOnSegment(point, segmentStart, segmentEnd);
        return helpers.calculateDistance(
            point[1], point[0],
            closestPoint[1], closestPoint[0]
        );
    }

    /**
     * Find closest point on line segment to given point
     * @param {Array} point - [lon, lat]
     * @param {Array} segmentStart - [lon, lat]
     * @param {Array} segmentEnd - [lon, lat]
     * @returns {Array} Closest point [lon, lat]
     */
    closestPointOnSegment(point, segmentStart, segmentEnd) {
        const [px, py] = point;
        const [x1, y1] = segmentStart;
        const [x2, y2] = segmentEnd;

        const dx = x2 - x1;
        const dy = y2 - y1;

        if (dx === 0 && dy === 0) {
            return segmentStart;
        }

        const t = Math.max(0, Math.min(1, 
            ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
        ));

        return [x1 + t * dx, y1 + t * dy];
    }

    /**
     * Match simple route (2 points) with passenger route
     * Uses proximity matching instead of exact route matching
     * @param {object} passengerRoute - { pickup: [lon, lat], dropoff: [lon, lat] }
     * @param {object} rideRoute - { geometry: { coordinates: [[lon, lat]...] }, distance: km }
     * @returns {object} Match result
     */
    matchSimpleRoute(passengerRoute, rideRoute) {
        const { pickup, dropoff } = passengerRoute;
        const [rideStart, rideEnd] = rideRoute.geometry.coordinates;

        console.log('Simple route matching:');
        console.log('  Passenger pickup:', pickup);
        console.log('  Passenger dropoff:', dropoff);
        console.log('  Ride start:', rideStart);
        console.log('  Ride end:', rideEnd);

        // Calculate distances
        const pickupToStart = helpers.calculateDistance(
            pickup[1], pickup[0],
            rideStart[1], rideStart[0]
        );
        const dropoffToEnd = helpers.calculateDistance(
            dropoff[1], dropoff[0],
            rideEnd[1], rideEnd[0]
        );

        console.log('  Pickup to start distance:', pickupToStart, 'km');
        console.log('  Dropoff to end distance:', dropoffToEnd, 'km');

        // More lenient threshold for simple routes (20km)
        const SIMPLE_ROUTE_THRESHOLD = 20;

        // Check if pickup is near ride start and dropoff is near ride end
        if (pickupToStart > SIMPLE_ROUTE_THRESHOLD || dropoffToEnd > SIMPLE_ROUTE_THRESHOLD) {
            console.log('  ❌ FAILED: Endpoints too far apart');
            return {
                isMatch: false,
                reason: 'Route endpoints too far apart',
                pickupDistance: pickupToStart,
                dropoffDistance: dropoffToEnd
            };
        }

        // Calculate direct distance for passenger and ride
        const passengerDistance = helpers.calculateDistance(
            pickup[1], pickup[0],
            dropoff[1], dropoff[0]
        );

        const rideDistance = helpers.calculateDistance(
            rideStart[1], rideStart[0],
            rideEnd[1], rideEnd[0]
        );

        // Calculate similarity (distances should be similar)
        const distanceDiff = Math.abs(passengerDistance - rideDistance);
        const distanceSimilarity = 1 - (distanceDiff / Math.max(passengerDistance, rideDistance));

        // Require at least 70% similarity
        if (distanceSimilarity < 0.7) {
            return {
                isMatch: false,
                reason: 'Routes too dissimilar',
                similarity: distanceSimilarity
            };
        }

        // Calculate match score
        const proximityScore = 100 - (pickupToStart / SIMPLE_ROUTE_THRESHOLD) * 30 - (dropoffToEnd / SIMPLE_ROUTE_THRESHOLD) * 30;
        const similarityScore = distanceSimilarity * 40;
        const matchScore = Math.round(proximityScore + similarityScore);

        return {
            isMatch: true,
            matchScore: Math.max(0, Math.min(100, matchScore)),
            matchQuality: this.getMatchQuality(matchScore),
            pickupPoint: {
                coordinates: rideStart,
                distanceFromRoute: pickupToStart,
                routeIndex: 0
            },
            dropoffPoint: {
                coordinates: rideEnd,
                distanceFromRoute: dropoffToEnd,
                routeIndex: 1
            },
            segmentDistance: rideDistance,
            directDistance: passengerDistance,
            detourPercent: 0
        };
    }

    /**
     * Match passenger route (C→D) with rider route (A→B)
     * @param {object} passengerRoute - { pickup: [lon, lat], dropoff: [lon, lat] }
     * @param {object} rideRoute - { geometry: { coordinates: [[lon, lat]...] }, distance: km }
     * @returns {object} Match result
```
     */
    matchRoutes(passengerRoute, rideRoute) {
        const { pickup, dropoff } = passengerRoute;
        const { coordinates: routeCoords } = rideRoute.geometry;

        // Validate route has sufficient data
        if (!routeCoords || routeCoords.length < 2) {
            return {
                isMatch: false,
                reason: 'Invalid route geometry (insufficient coordinates)'
            };
        }

        // For routes with only 2 points AND short distance, use proximity-based matching
        // This should be rare since OSRM provides detailed geometry
        const directDist = helpers.calculateDistance(
            routeCoords[0][1], routeCoords[0][0],
            routeCoords[routeCoords.length - 1][1], routeCoords[routeCoords.length - 1][0]
        );
        
        if (routeCoords.length === 2 && directDist < 50) {
            // Only use simple matching for very short routes (< 50km)
            return this.matchSimpleRoute(passengerRoute, rideRoute);
        }

        const rideStart = routeCoords[0];
        const rideEnd = routeCoords[routeCoords.length - 1];

        // Check if pickup point is near the route
        console.log('🔍 [Match Debug] Checking pickup point...');
        let pickupMatch = this.isPointNearRoute(pickup, routeCoords);
        console.log(`  Pickup near route? ${pickupMatch.isNear}, distance: ${pickupMatch.distance?.toFixed(2)} km, threshold: ${this.DEVIATION_THRESHOLD} km`);

        if (!pickupMatch.isNear) {
            const pickupToStart = helpers.calculateDistance(pickup[1], pickup[0], rideStart[1], rideStart[0]);
            const pickupToEnd = helpers.calculateDistance(pickup[1], pickup[0], rideEnd[1], rideEnd[0]);

            if (pickupToStart <= this.ENDPOINT_THRESHOLD) {
                pickupMatch = {
                    isNear: true,
                    distance: pickupToStart,
                    closestIndex: 0,
                    closestPoint: rideStart
                };
            } else if (pickupToEnd <= this.ENDPOINT_THRESHOLD) {
                pickupMatch = {
                    isNear: true,
                    distance: pickupToEnd,
                    closestIndex: routeCoords.length - 1,
                    closestPoint: rideEnd
                };
            } else {
                return {
                    isMatch: false,
                    reason: 'Pickup location not on route',
                    pickupDistance: Math.min(pickupMatch.distance, pickupToStart, pickupToEnd)
                };
            }
        }

        // Check if dropoff point is near the route
        let dropoffMatch = this.isPointNearRoute(dropoff, routeCoords);

        if (!dropoffMatch.isNear) {
            const dropoffToStart = helpers.calculateDistance(dropoff[1], dropoff[0], rideStart[1], rideStart[0]);
            const dropoffToEnd = helpers.calculateDistance(dropoff[1], dropoff[0], rideEnd[1], rideEnd[0]);

            if (dropoffToEnd <= this.ENDPOINT_THRESHOLD) {
                dropoffMatch = {
                    isNear: true,
                    distance: dropoffToEnd,
                    closestIndex: routeCoords.length - 1,
                    closestPoint: rideEnd
                };
            } else if (dropoffToStart <= this.ENDPOINT_THRESHOLD) {
                dropoffMatch = {
                    isNear: true,
                    distance: dropoffToStart,
                    closestIndex: 0,
                    closestPoint: rideStart
                };
            } else {
                return {
                    isMatch: false,
                    reason: 'Dropoff location not on route',
                    dropoffDistance: Math.min(dropoffMatch.distance, dropoffToStart, dropoffToEnd)
                };
            }
        }

        // Check if dropoff comes after pickup on the route
        if (dropoffMatch.closestIndex <= pickupMatch.closestIndex) {
            return {
                isMatch: false,
                reason: 'Dropoff comes before pickup on route',
                pickupIndex: pickupMatch.closestIndex,
                dropoffIndex: dropoffMatch.closestIndex
            };
        }

        // Calculate segment distance (pickup to dropoff along route)
        const segmentDistance = this.calculateRouteSegmentDistance(
            routeCoords,
            pickupMatch.closestIndex,
            dropoffMatch.closestIndex
        );

        // Calculate direct distance
        const directDistance = helpers.calculateDistance(
            pickup[1], pickup[0],
            dropoff[1], dropoff[0]
        );

        // Calculate detour percentage
        const detourPercent = ((segmentDistance - directDistance) / directDistance) * 100;

        // Calculate match score (0-100)
        const matchScore = this.calculateMatchScore({
            pickupDistance: Math.min(pickupMatch.distance, this.DEVIATION_THRESHOLD),
            dropoffDistance: Math.min(dropoffMatch.distance, this.DEVIATION_THRESHOLD),
            detourPercent: detourPercent
        });

        return {
            isMatch: true,
            matchScore: matchScore,
            matchQuality: this.getMatchQuality(matchScore),
            pickupPoint: {
                coordinates: pickupMatch.closestPoint,
                distanceFromRoute: pickupMatch.distance,
                routeIndex: pickupMatch.closestIndex
            },
            dropoffPoint: {
                coordinates: dropoffMatch.closestPoint,
                distanceFromRoute: dropoffMatch.distance,
                routeIndex: dropoffMatch.closestIndex
            },
            segmentDistance: segmentDistance,
            directDistance: directDistance,
            detourPercent: Math.round(detourPercent * 100) / 100
        };
    }

    /**
     * Calculate distance along route between two indices
     * @param {Array} coordinates - Route coordinates
     * @param {number} startIndex - Start index
     * @param {number} endIndex - End index
     * @returns {number} Distance in km
     */
    calculateRouteSegmentDistance(coordinates, startIndex, endIndex) {
        let distance = 0;
        
        for (let i = startIndex; i < endIndex; i++) {
            const [lon1, lat1] = coordinates[i];
            const [lon2, lat2] = coordinates[i + 1];
            distance += helpers.calculateDistance(lat1, lon1, lat2, lon2);
        }
        
        return distance;
    }

    /**
     * Calculate match score based on various factors
     * @param {object} params - Match parameters
     * @returns {number} Score (0-100)
     */
    calculateMatchScore({ pickupDistance, dropoffDistance, detourPercent }) {
        let score = 100;

        // Deduct points based on pickup distance from route
        score -= (pickupDistance / this.DEVIATION_THRESHOLD) * 20;

        // Deduct points based on dropoff distance from route
        score -= (dropoffDistance / this.DEVIATION_THRESHOLD) * 20;

        // Deduct points based on detour percentage
        score -= (detourPercent / this.MAX_DETOUR_PERCENT) * 40;

        // Ensure score is between 0 and 100
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Get match quality label
     * @param {number} score - Match score
     * @returns {string} Quality label
     */
    getMatchQuality(score) {
        if (score >= 90) return 'PERFECT';
        if (score >= 75) return 'EXCELLENT';
        if (score >= 60) return 'GOOD';
        if (score >= 40) return 'FAIR';
        return 'POOR';
    }

    /**
     * Find all matching rides for a passenger route
     * @param {object} passengerRoute - Passenger route details
     * @param {Array} availableRides - Array of available rides
     * @param {number} maxResults - Maximum results to return
     * @returns {Array} Matched rides sorted by score
     */
    findMatchingRides(passengerRoute, availableRides, maxResults = 20) {
        const matches = [];

        for (const ride of availableRides) {
            // Skip if ride doesn't have route geometry
            if (!ride.route || !ride.route.geometry || !ride.route.geometry.coordinates) {
                continue;
            }

            const matchResult = this.matchRoutes(passengerRoute, ride.route);

            if (matchResult.isMatch) {
                matches.push({
                    ride: ride,
                    matchDetails: matchResult
                });
            }
        }

        // Sort by match score (descending)
        matches.sort((a, b) => b.matchDetails.matchScore - a.matchDetails.matchScore);

        // Return top matches
        return matches.slice(0, maxResults);
    }

    /**
     * Get route from OSRM
     * @param {Array} coordinates - Array of [lon, lat] points
     * @returns {Promise<object>} Route data
     */
    async getRoute(coordinates) {
        try {
            // Format coordinates for OSRM
            const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
            
            const url = `${this.OSRM_URL}/route/v1/driving/${coordString}`;
            const params = {
                overview: 'full',
                geometries: 'geojson',
                steps: false
            };

            const response = await axios.get(url, { params });
            
            if (response.data.code !== 'Ok') {
                throw new Error('OSRM routing failed');
            }

            const route = response.data.routes[0];
            
            return {
                geometry: route.geometry,
                distance: route.distance / 1000, // Convert to km
                duration: route.duration / 60 // Convert to minutes
            };
        } catch (error) {
            console.error('OSRM routing error:', error.message);
            throw new Error('Failed to calculate route');
        }
    }

    /**
     * Calculate ETA for a point on route
     * @param {Array} routeCoordinates - Route coordinates
     * @param {number} pointIndex - Index of point on route
     * @param {number} totalDuration - Total route duration in minutes
     * @returns {number} ETA in minutes from start
     */
    calculateETA(routeCoordinates, pointIndex, totalDuration) {
        const totalDistance = this.calculateRouteSegmentDistance(
            routeCoordinates,
            0,
            routeCoordinates.length - 1
        );

        const distanceToPoint = this.calculateRouteSegmentDistance(
            routeCoordinates,
            0,
            pointIndex
        );

        return (distanceToPoint / totalDistance) * totalDuration;
    }

    /**
     * Check if current location deviates from planned route
     * @param {Array} currentLocation - [lon, lat]
     * @param {Array} plannedRoute - Route coordinates
     * @param {number} threshold - Deviation threshold in km
     * @returns {object} Deviation check result
     */
    checkRouteDeviation(currentLocation, plannedRoute, threshold = this.DEVIATION_THRESHOLD) {
        const result = this.isPointNearRoute(currentLocation, plannedRoute, threshold);
        
        return {
            isDeviated: !result.isNear,
            distance: result.distance,
            threshold: threshold,
            severity: this.getDeviationSeverity(result.distance, threshold)
        };
    }

    /**
     * Get deviation severity level
     * @param {number} distance - Deviation distance
     * @param {number} threshold - Threshold
     * @returns {string} Severity level
     */
    getDeviationSeverity(distance, threshold) {
        if (distance <= threshold) return 'NONE';
        if (distance <= threshold * 2) return 'LOW';
        if (distance <= threshold * 4) return 'MEDIUM';
        return 'HIGH';
    }
}

module.exports = new RouteMatching();
