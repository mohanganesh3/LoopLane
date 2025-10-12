/**
 * Advanced Geo-Fencing Utility
 * Implements intelligent location monitoring, route deviation detection,
 * safe/danger zones, and predictive safety analytics
 * Enhanced with real-time boundary checks and alert system
 */

const turf = require('@turf/turf');

class GeoFencing {
    /**
     * Configuration constants
     */
    static CONSTANTS = {
        // Deviation thresholds
        MINOR_DEVIATION_METERS: 500,      // Yellow alert
        MAJOR_DEVIATION_METERS: 1000,     // Orange alert
        CRITICAL_DEVIATION_METERS: 2000,  // Red alert
        
        // Time windows
        SUSPICIOUS_STOP_DURATION: 600,    // 10 minutes
        EXTENDED_STOP_DURATION: 1800,     // 30 minutes
        
        // Speed thresholds (km/h)
        MIN_SPEED: 5,
        MAX_URBAN_SPEED: 60,
        MAX_HIGHWAY_SPEED: 120,
        DANGEROUS_SPEED: 140,
        
        // Safe zone radius
        SAFE_ZONE_RADIUS: 100,            // 100 meters
        
        // Alert cooldown
        ALERT_COOLDOWN_MS: 300000         // 5 minutes between similar alerts
    };

    /**
     * Check if location is within route corridor
     * @param {Object} currentLocation - { lat, lng }
     * @param {Array} routeGeometry - Array of [lng, lat] coordinates
     * @param {Number} corridorWidth - Width in meters
     * @returns {Object} - { withinCorridor, nearestPoint, distance, deviation }
     */
    static isWithinRouteCorridor(currentLocation, routeGeometry, corridorWidth = 500) {
        if (!currentLocation || !routeGeometry || routeGeometry.length === 0) {
            return { withinCorridor: false, distance: null, deviation: 'UNKNOWN' };
        }

        try {
            // Create point from current location
            const point = turf.point([currentLocation.lng, currentLocation.lat]);
            
            // Create line from route geometry
            const line = turf.lineString(routeGeometry);
            
            // Find nearest point on route
            const snapped = turf.nearestPointOnLine(line, point);
            const distance = turf.distance(point, snapped, { units: 'meters' });
            
            // Determine deviation level
            let deviation = 'NONE';
            let withinCorridor = true;
            
            if (distance > this.CONSTANTS.CRITICAL_DEVIATION_METERS) {
                deviation = 'CRITICAL';
                withinCorridor = false;
            } else if (distance > this.CONSTANTS.MAJOR_DEVIATION_METERS) {
                deviation = 'MAJOR';
                withinCorridor = false;
            } else if (distance > this.CONSTANTS.MINOR_DEVIATION_METERS) {
                deviation = 'MINOR';
            }
            
            return {
                withinCorridor,
                nearestPoint: snapped.geometry.coordinates,
                distance: Math.round(distance),
                deviation,
                bearing: this.calculateBearing(currentLocation, {
                    lng: snapped.geometry.coordinates[0],
                    lat: snapped.geometry.coordinates[1]
                })
            };
        } catch (error) {
            console.error('Error checking route corridor:', error);
            return { withinCorridor: false, distance: null, deviation: 'ERROR' };
        }
    }

    /**
     * Calculate bearing between two points
     */
    static calculateBearing(from, to) {
        const fromPoint = turf.point([from.lng, from.lat]);
        const toPoint = turf.point([to.lng, to.lat]);
        return turf.bearing(fromPoint, toPoint);
    }

    /**
     * Check if vehicle is in a safe zone
     * @param {Object} location - { lat, lng }
     * @param {Array} safeZones - Array of safe zone objects
     * @returns {Object} - { inSafeZone, zone, distance }
     */
    static checkSafeZones(location, safeZones = []) {
        if (!location || safeZones.length === 0) {
            return { inSafeZone: false, zone: null, distance: null };
        }

        const point = turf.point([location.lng, location.lat]);
        
        for (const zone of safeZones) {
            const zoneCenter = turf.point([zone.coordinates[0], zone.coordinates[1]]);
            const distance = turf.distance(point, zoneCenter, { units: 'meters' });
            
            if (distance <= zone.radius) {
                return {
                    inSafeZone: true,
                    zone: zone.name,
                    distance: Math.round(distance),
                    zoneType: zone.type
                };
            }
        }
        
        return { inSafeZone: false, zone: null, distance: null };
    }

    /**
     * Check if vehicle is in a danger zone
     * @param {Object} location - { lat, lng }
     * @param {Array} dangerZones - Array of danger zone polygons
     * @returns {Object} - { inDangerZone, zone, riskLevel }
     */
    static checkDangerZones(location, dangerZones = []) {
        if (!location || dangerZones.length === 0) {
            return { inDangerZone: false, zone: null, riskLevel: 'NONE' };
        }

        const point = turf.point([location.lng, location.lat]);
        
        for (const zone of dangerZones) {
            let polygon;
            
            // Handle different polygon formats
            if (zone.polygon) {
                polygon = turf.polygon([zone.polygon]);
            } else if (zone.coordinates) {
                polygon = turf.polygon([zone.coordinates]);
            } else {
                continue;
            }
            
            if (turf.booleanPointInPolygon(point, polygon)) {
                return {
                    inDangerZone: true,
                    zone: zone.name,
                    riskLevel: zone.riskLevel || 'HIGH',
                    reason: zone.reason || 'High-risk area',
                    recommendations: zone.recommendations || []
                };
            }
        }
        
        return { inDangerZone: false, zone: null, riskLevel: 'NONE' };
    }

    /**
     * Detect unusual stops
     * @param {Array} locationHistory - Array of location updates with timestamps
     * @returns {Object} - { suspiciousStop, duration, location }
     */
    static detectUnusualStops(locationHistory) {
        if (!locationHistory || locationHistory.length < 2) {
            return { suspiciousStop: false, duration: 0 };
        }

        const recentPoints = locationHistory.slice(-10); // Last 10 points
        
        // Check if vehicle is stationary
        let isStationary = true;
        const referencePoint = recentPoints[0];
        const stationaryRadius = 50; // meters
        
        for (let i = 1; i < recentPoints.length; i++) {
            const point1 = turf.point([referencePoint.coordinates[0], referencePoint.coordinates[1]]);
            const point2 = turf.point([recentPoints[i].coordinates[0], recentPoints[i].coordinates[1]]);
            const distance = turf.distance(point1, point2, { units: 'meters' });
            
            if (distance > stationaryRadius) {
                isStationary = false;
                break;
            }
        }
        
        if (!isStationary) {
            return { suspiciousStop: false, duration: 0 };
        }
        
        // Calculate stop duration
        const duration = (recentPoints[recentPoints.length - 1].timestamp - recentPoints[0].timestamp) / 1000;
        
        const suspiciousStop = duration >= this.CONSTANTS.SUSPICIOUS_STOP_DURATION;
        const criticalStop = duration >= this.CONSTANTS.EXTENDED_STOP_DURATION;
        
        return {
            suspiciousStop,
            criticalStop,
            duration: Math.round(duration),
            location: {
                lng: referencePoint.coordinates[0],
                lat: referencePoint.coordinates[1]
            },
            severity: criticalStop ? 'CRITICAL' : (suspiciousStop ? 'WARNING' : 'NORMAL')
        };
    }

    /**
     * Analyze speed patterns
     * @param {Array} locationHistory - Array with speed data
     * @returns {Object} - { abnormalSpeed, type, value, severity }
     */
    static analyzeSpeedPatterns(locationHistory) {
        if (!locationHistory || locationHistory.length === 0) {
            return { abnormalSpeed: false, type: null, value: 0 };
        }

        const recentPoints = locationHistory.slice(-5);
        const speeds = recentPoints.map(p => p.speed || 0).filter(s => s > 0);
        
        if (speeds.length === 0) {
            return { abnormalSpeed: false, type: null, value: 0 };
        }
        
        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        const maxSpeed = Math.max(...speeds);
        
        // Check for dangerous speeds
        if (maxSpeed > this.CONSTANTS.DANGEROUS_SPEED) {
            return {
                abnormalSpeed: true,
                type: 'DANGEROUS_SPEED',
                value: Math.round(maxSpeed),
                severity: 'CRITICAL',
                message: `Excessive speed detected: ${Math.round(maxSpeed)} km/h`
            };
        }
        
        // Check for too slow (possible distress)
        if (avgSpeed > 0 && avgSpeed < this.CONSTANTS.MIN_SPEED) {
            return {
                abnormalSpeed: true,
                type: 'TOO_SLOW',
                value: Math.round(avgSpeed),
                severity: 'WARNING',
                message: `Unusually slow movement: ${Math.round(avgSpeed)} km/h`
            };
        }
        
        // Check speed variance (erratic driving)
        const variance = speeds.reduce((sum, speed) => {
            return sum + Math.pow(speed - avgSpeed, 2);
        }, 0) / speeds.length;
        
        const stdDev = Math.sqrt(variance);
        
        if (stdDev > 30) {
            return {
                abnormalSpeed: true,
                type: 'ERRATIC_DRIVING',
                value: Math.round(stdDev),
                severity: 'WARNING',
                message: 'Erratic speed changes detected'
            };
        }
        
        return { abnormalSpeed: false, type: 'NORMAL', value: Math.round(avgSpeed) };
    }

    /**
     * Calculate ETA with traffic and deviation
     * @param {Object} currentLocation - Current position
     * @param {Object} destination - Destination coordinates
     * @param {Array} routeGeometry - Route geometry
     * @param {Number} averageSpeed - Average speed in km/h
     * @returns {Object} - { eta, distance, delay }
     */
    static calculateETA(currentLocation, destination, routeGeometry, averageSpeed = 40) {
        if (!currentLocation || !destination) {
            return { eta: null, distance: null, delay: 0 };
        }

        try {
            const currentPoint = turf.point([currentLocation.lng, currentLocation.lat]);
            const destPoint = turf.point([destination.lng, destination.lat]);
            
            // Calculate remaining distance
            const remainingDistance = turf.distance(currentPoint, destPoint, { units: 'kilometers' });
            
            // Calculate ETA in minutes
            const etaMinutes = (remainingDistance / averageSpeed) * 60;
            const etaDate = new Date(Date.now() + (etaMinutes * 60 * 1000));
            
            // Check if off route
            let delay = 0;
            if (routeGeometry && routeGeometry.length > 0) {
                const corridorCheck = this.isWithinRouteCorridor(currentLocation, routeGeometry);
                if (!corridorCheck.withinCorridor) {
                    // Add delay for deviation
                    delay = Math.round(corridorCheck.distance / 1000 * 2); // 2 minutes per km deviation
                }
            }
            
            return {
                eta: etaDate,
                etaMinutes: Math.round(etaMinutes + delay),
                remainingDistance: Math.round(remainingDistance * 10) / 10,
                delay: delay,
                onSchedule: delay < 10
            };
        } catch (error) {
            console.error('Error calculating ETA:', error);
            return { eta: null, distance: null, delay: 0 };
        }
    }

    /**
     * Create safe zone buffer around route
     * @param {Array} routeGeometry - Route line coordinates
     * @param {Number} bufferKm - Buffer distance in kilometers
     * @returns {Object} - GeoJSON polygon
     */
    static createRouteBuffer(routeGeometry, bufferKm = 0.5) {
        try {
            const line = turf.lineString(routeGeometry);
            const buffered = turf.buffer(line, bufferKm, { units: 'kilometers' });
            return buffered;
        } catch (error) {
            console.error('Error creating route buffer:', error);
            return null;
        }
    }

    /**
     * Detect if route enters high-risk areas
     * @param {Array} routeGeometry - Planned route
     * @param {Array} dangerZones - Known danger zones
     * @returns {Array} - List of intersections with risk info
     */
    static analyzeRouteRisks(routeGeometry, dangerZones) {
        if (!routeGeometry || dangerZones.length === 0) {
            return [];
        }

        const risks = [];
        const route = turf.lineString(routeGeometry);
        
        dangerZones.forEach(zone => {
            try {
                const polygon = turf.polygon([zone.coordinates || zone.polygon]);
                const intersection = turf.lineIntersect(route, polygon);
                
                if (intersection.features.length > 0) {
                    risks.push({
                        zoneName: zone.name,
                        riskLevel: zone.riskLevel || 'MEDIUM',
                        intersectionPoints: intersection.features.length,
                        recommendation: zone.recommendations || 'Exercise caution in this area',
                        coordinates: intersection.features[0].geometry.coordinates
                    });
                }
            } catch (error) {
                console.error('Error analyzing zone:', zone.name, error);
            }
        });
        
        return risks;
    }

    /**
     * Generate heatmap data for incident-prone areas
     * @param {Array} incidents - Historical incidents with locations
     * @param {Object} bounds - Map bounds
     * @returns {Array} - Heatmap points with intensity
     */
    static generateIncidentHeatmap(incidents, bounds) {
        if (!incidents || incidents.length === 0) {
            return [];
        }

        const heatmapData = incidents.map(incident => {
            return {
                lat: incident.location.coordinates[1],
                lng: incident.location.coordinates[0],
                intensity: this.calculateIncidentSeverity(incident),
                type: incident.type,
                timestamp: incident.timestamp
            };
        });
        
        return heatmapData;
    }

    /**
     * Calculate incident severity score
     */
    static calculateIncidentSeverity(incident) {
        const severityScores = {
            'SOS': 8,
            'ACCIDENT': 10,
            'MEDICAL': 9,
            'THREAT': 10,
            'BREAKDOWN': 3,
            'ROUTE_DEVIATION': 5,
            'OTHER': 4
        };
        
        return severityScores[incident.type] || 5;
    }

    /**
     * Predictive analytics: Estimate risk score for a route
     * @param {Array} routeGeometry - Planned route
     * @param {Object} timeOfDay - Hour of travel
     * @param {Array} historicalData - Past incidents
     * @returns {Object} - Risk assessment
     */
    static predictRouteRisk(routeGeometry, timeOfDay, historicalData = []) {
        let riskScore = 0;
        const riskFactors = [];
        
        // Time of day risk (night travel is riskier)
        if (timeOfDay >= 22 || timeOfDay <= 5) {
            riskScore += 30;
            riskFactors.push('Late night travel');
        } else if (timeOfDay >= 18 || timeOfDay <= 7) {
            riskScore += 15;
            riskFactors.push('Early morning/evening travel');
        }
        
        // Route length (longer routes = higher risk)
        const route = turf.lineString(routeGeometry);
        const routeLength = turf.length(route, { units: 'kilometers' });
        
        if (routeLength > 200) {
            riskScore += 25;
            riskFactors.push('Long distance journey');
        } else if (routeLength > 100) {
            riskScore += 15;
            riskFactors.push('Medium distance journey');
        }
        
        // Historical incidents along route
        const nearbyIncidents = historicalData.filter(incident => {
            const point = turf.point(incident.location.coordinates);
            const distance = turf.pointToLineDistance(point, route, { units: 'kilometers' });
            return distance < 5; // Within 5km of route
        });
        
        if (nearbyIncidents.length > 10) {
            riskScore += 40;
            riskFactors.push('High incident area');
        } else if (nearbyIncidents.length > 5) {
            riskScore += 20;
            riskFactors.push('Moderate incident history');
        }
        
        // Determine risk level
        let riskLevel = 'LOW';
        if (riskScore >= 70) riskLevel = 'CRITICAL';
        else if (riskScore >= 50) riskLevel = 'HIGH';
        else if (riskScore >= 30) riskLevel = 'MEDIUM';
        
        return {
            riskScore: Math.min(riskScore, 100),
            riskLevel,
            riskFactors,
            recommendations: this.generateSafetyRecommendations(riskLevel, riskFactors),
            nearbyIncidents: nearbyIncidents.length
        };
    }

    /**
     * Generate safety recommendations based on risk
     */
    static generateSafetyRecommendations(riskLevel, riskFactors) {
        const recommendations = [];
        
        if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
            recommendations.push('Share trip details with emergency contacts');
            recommendations.push('Keep phone charged and accessible');
            recommendations.push('Enable live location sharing');
        }
        
        if (riskFactors.includes('Late night travel')) {
            recommendations.push('Avoid isolated stops');
            recommendations.push('Stay in well-lit areas');
        }
        
        if (riskFactors.includes('Long distance journey')) {
            recommendations.push('Plan rest stops at safe locations');
            recommendations.push('Check weather conditions');
        }
        
        if (riskFactors.includes('High incident area')) {
            recommendations.push('Stay alert in this region');
            recommendations.push('Consider alternative route if possible');
        }
        
        return recommendations;
    }

    /**
     * Check if should send alert (prevent spam)
     * @param {String} alertType - Type of alert
     * @param {Object} lastAlerts - Map of last alert times
     * @returns {Boolean} - Should send alert
     */
    static shouldSendAlert(alertType, lastAlerts = {}) {
        const lastAlertTime = lastAlerts[alertType];
        
        if (!lastAlertTime) {
            return true;
        }
        
        const timeSinceLastAlert = Date.now() - lastAlertTime;
        return timeSinceLastAlert >= this.CONSTANTS.ALERT_COOLDOWN_MS;
    }
}

module.exports = GeoFencing;
