/**
 * Route Matching Utility
 * Simple and correct algorithm for matching passenger routes with rider routes
 * Uses polyline geometry matching - checks if pickup/dropoff are ON the driver's route
 */

const axios = require('axios');
const helpers = require('./helpers');

class RouteMatching {
    constructor() {
        this.OSRM_URL = process.env.OSRM_API_URL || 'https://router.project-osrm.org';
        // How far from the route polyline a point can be and still be considered "on route"
        this.ROUTE_PROXIMITY_THRESHOLD = 5; // 5 km from route line
        
    }

    /**
     * Check if a point is near a route polyline
     * @param {Array} point - [lon, lat]
     * @param {Array} routeCoordinates - Array of [lon, lat] points (polyline)
     * @param {number} threshold - Distance threshold in km
     * @returns {object} Match result with closest point info
     */
    isPointOnRoute(point, routeCoordinates, threshold = this.ROUTE_PROXIMITY_THRESHOLD) {
        let minDistance = Infinity;
        let closestIndex = -1;
        let closestPoint = null;

        // Check distance to each segment of the route polyline
        for (let i = 0; i < routeCoordinates.length - 1; i++) {
            const segmentStart = routeCoordinates[i];
            const segmentEnd = routeCoordinates[i + 1];
            
            // Find closest point on this segment
            const closest = this.closestPointOnSegment(point, segmentStart, segmentEnd);
            const distance = helpers.calculateDistance(
                point[1], point[0],
                closest[1], closest[0]
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
                closestPoint = closest;
            }
        }

        return {
            isOnRoute: minDistance <= threshold,
            distance: minDistance,
            closestIndex: closestIndex,
            closestPoint: closestPoint
        };
    }

    /**
     * Find closest point on a line segment to a given point
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

        // Project point onto line, clamped to segment
        const t = Math.max(0, Math.min(1, 
            ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
        ));

        return [x1 + t * dx, y1 + t * dy];
    }

    /**
     * Main matching function - check if passenger route matches driver's route
     * 
     * Logic:
     * 1. Is passenger pickup ON the driver's route polyline? (within threshold)
     * 2. Is passenger dropoff ON the driver's route polyline? (within threshold)
     * 3. Does dropoff come AFTER pickup along the route? (same direction)
     * 
     * @param {object} passengerRoute - { pickup: [lon, lat], dropoff: [lon, lat] }
     * @param {object} rideRoute - { geometry: { coordinates: [[lon, lat]...] }, distance: km }
     * @returns {object} Match result
     */
    matchRoutes(passengerRoute, rideRoute) {
        const { pickup, dropoff } = passengerRoute;
        const routeCoords = rideRoute.geometry?.coordinates;

        // Validate route has geometry
        if (!routeCoords || routeCoords.length < 2) {
            return {
                isMatch: false,
                reason: 'Invalid route geometry'
            };
        }


        // Step 1: Check if PICKUP is on the route
        const pickupResult = this.isPointOnRoute(pickup, routeCoords);
        
        if (!pickupResult.isOnRoute) {
            return {
                isMatch: false,
                reason: `Pickup is ${pickupResult.distance.toFixed(1)}km from route (max ${this.ROUTE_PROXIMITY_THRESHOLD}km)`
            };
        }

        // Step 2: Check if DROPOFF is on the route
        const dropoffResult = this.isPointOnRoute(dropoff, routeCoords);
        
        if (!dropoffResult.isOnRoute) {
            return {
                isMatch: false,
                reason: `Dropoff is ${dropoffResult.distance.toFixed(1)}km from route (max ${this.ROUTE_PROXIMITY_THRESHOLD}km)`
            };
        }

        // Step 3: Check direction - dropoff must come AFTER pickup along the route
        if (dropoffResult.closestIndex <= pickupResult.closestIndex) {
            return {
                isMatch: false,
                reason: 'Wrong direction - dropoff is before pickup on route'
            };
        }

        // Calculate segment distance (pickup to dropoff along route)
        const segmentDistance = this.calculateRouteSegmentDistance(
            routeCoords,
            pickupResult.closestIndex,
            dropoffResult.closestIndex
        );

        // Calculate direct distance (straight line)
        const directDistance = helpers.calculateDistance(
            pickup[1], pickup[0],
            dropoff[1], dropoff[0]
        );

        // Calculate match score based on how close points are to the route
        const pickupScore = Math.max(0, 50 - (pickupResult.distance / this.ROUTE_PROXIMITY_THRESHOLD) * 50);
        const dropoffScore = Math.max(0, 50 - (dropoffResult.distance / this.ROUTE_PROXIMITY_THRESHOLD) * 50);
        const matchScore = Math.round(pickupScore + dropoffScore);

        return {
            isMatch: true,
            matchScore: Math.max(50, matchScore), // Minimum 50 for any valid match
            matchQuality: this.getMatchQuality(matchScore),
            pickupPoint: {
                coordinates: pickupResult.closestPoint,
                distanceFromRoute: pickupResult.distance,
                routeIndex: pickupResult.closestIndex
            },
            dropoffPoint: {
                coordinates: dropoffResult.closestPoint,
                distanceFromRoute: dropoffResult.distance,
                routeIndex: dropoffResult.closestIndex
            },
            segmentDistance: segmentDistance,
            directDistance: directDistance
        };
    }

    /**
     * Calculate distance along route between two indices
     */
    calculateRouteSegmentDistance(coordinates, startIndex, endIndex) {
        let distance = 0;
        
        for (let i = startIndex; i < endIndex && i < coordinates.length - 1; i++) {
            const [lon1, lat1] = coordinates[i];
            const [lon2, lat2] = coordinates[i + 1];
            distance += helpers.calculateDistance(lat1, lon1, lat2, lon2);
        }
        
        return distance;
    }

    /**
     * Get match quality label
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
     */
    findMatchingRides(passengerRoute, availableRides, maxResults = 20) {
        const matches = [];


        for (const ride of availableRides) {
            // Skip if ride doesn't have route geometry
            if (!ride.route?.geometry?.coordinates || ride.route.geometry.coordinates.length < 2) {
                continue;
            }


            // Match using polyline
            const matchResult = this.matchRoutes(passengerRoute, ride.route);

            if (matchResult.isMatch) {
                matches.push({
                    ride: ride,
                    matchDetails: matchResult
                });
            } else {
            }
        }

        // Sort by match score (descending)
        matches.sort((a, b) => b.matchDetails.matchScore - a.matchDetails.matchScore);

        return matches.slice(0, maxResults);
    }

    /**
     * Get route from OSRM
     */
    async getRoute(coordinates) {
        try {
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
     * Check if current location deviates from planned route
     */
    checkRouteDeviation(currentLocation, plannedRoute, threshold = this.ROUTE_PROXIMITY_THRESHOLD) {
        const result = this.isPointOnRoute(currentLocation, plannedRoute, threshold);
        
        return {
            isDeviated: !result.isOnRoute,
            distance: result.distance,
            threshold: threshold
        };
    }
}

module.exports = new RouteMatching();
