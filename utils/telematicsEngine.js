/**
 * Telematics & Hyper-Safety Engine
 * Epic 3: Processes real-time IMU (Accelerometer/Gyroscope) data 
 * from driver devices to detect dangerous driving and crashes.
 */

const RouteDeviation = require('../models/RouteDeviation'); // Reusing for generic danger events or create a new model
const Ride = require('../models/Ride');
const User = require('../models/User');

// Gravity constant for G-force calculation
const G_FORCE = 9.81;

// Thresholds for detection (in Gs)
const THRESHOLDS = {
    HARSH_BRAKING: -0.45 * G_FORCE,      // ~-4.4 m/s^2
    HARSH_ACCEL: 0.4 * G_FORCE,          // ~3.9 m/s^2
    HARSH_CORNERING: 0.5 * G_FORCE,      // ~4.9 m/s^2 lateral
    CRASH_IMPACT: 3.0 * G_FORCE          // 3G+ impact (severe crash)
};

/**
 * Process a batch of telemetry sensor readings over Socket.io
 * @param {Object} data { rideId, driverId, readings: [{x, y, z, timestamp}, ...] }
 * @param {Object} io Socket.io instance
 */
exports.processSensorBatch = async (data, io) => {
    try {
        const { rideId, driverId, readings } = data;
        if (!readings || readings.length === 0) return;

        let detectedEvents = [];

        // Simple peak detection algorithm across the reading window (e.g., 1 second of data at 10Hz)
        for (let reading of readings) {
            const { x, y, z, timestamp } = reading;

            // X-axis: Lateral (Cornering)
            // Y-axis: Longitudinal (Accel/Braking)
            // Z-axis: Vertical (Potholes/Bumps)

            // Detect Crash First (High G on any axis)
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            if (magnitude > THRESHOLDS.CRASH_IMPACT) {
                detectedEvents.push({ type: 'CRASH_DETECTED', severity: 'CRITICAL', value: magnitude, timestamp });
                break; // Highest priority event
            }

            // Harsh Braking (Negative Y)
            if (y < THRESHOLDS.HARSH_BRAKING) {
                detectedEvents.push({ type: 'HARSH_BRAKING', severity: 'HIGH', value: y, timestamp });
            }
            // Harsh Acceleration (Positive Y)
            else if (y > THRESHOLDS.HARSH_ACCEL) {
                detectedEvents.push({ type: 'HARSH_ACCELERATION', severity: 'MEDIUM', value: y, timestamp });
            }

            // Harsh Cornering (High X magnitude)
            if (Math.abs(x) > THRESHOLDS.HARSH_CORNERING) {
                detectedEvents.push({ type: 'HARSH_CORNERING', severity: 'MEDIUM', value: x, timestamp });
            }
        }

        if (detectedEvents.length > 0) {
            // De-duplicate events in the same window (take max severity)
            const highestPriorityEvent = detectedEvents.reduce((prev, current) => {
                const severities = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 0 };
                return (severities[prev.severity] > severities[current.severity]) ? prev : current;
            });

            console.log(`[TELEMATICS] Event Detected: ${highestPriorityEvent.type} on ride ${rideId}`);

            // Broadcast to God's Eye
            io.emit('telematicsEvent', {
                rideId,
                driverId,
                event: highestPriorityEvent
            });

            // If Critical Crash, trigger automated SOS dispatch
            if (highestPriorityEvent.type === 'CRASH_DETECTED') {
                await handleAutomatedSOS(rideId, driverId, highestPriorityEvent, io);
            } else {
                // Log non-critical driving events (harsh braking, swerving, etc.)
                // NOTE: This should NOT modify rating.breakdown — that reflects actual user reviews.
                // Instead, flag the event for trust score recalculation.
                await User.findByIdAndUpdate(driverId, {
                    $push: {
                        'telematicsFlags': {
                            type: highestPriorityEvent.type,
                            value: highestPriorityEvent.value,
                            rideId,
                            timestamp: new Date()
                        }
                    }
                });
            }
        }

        return { success: true };

    } catch (error) {
        console.error('Telematics Processing Error:', error);
    }
};

async function handleAutomatedSOS(rideId, driverId, crashData, io) {
    console.log('🚨 AUTOMATED CRASH DISPATCH TRIGGERED 🚨');

    // In production:
    // 1. Ping driver device with a 15-second "Are you okay?" countdown
    // 2. If no response, dispatch ambulance API
    // 3. Notify emergency contacts via SMS (Twilio)

    // Notify operations dashboard
    io.emit('emergencyAlert', {
        rideId,
        driverId,
        type: 'AUTOMATED_CRASH',
        magnitude: crashData.value,
        timestamp: crashData.timestamp
    });

    // We can also reuse the sosController here if we want to create an Emergency record
    const Emergency = require('../models/Emergency');

    // Get last known location from Ride tracking
    const ride = await Ride.findById(rideId);
    const location = ride?.tracking?.currentLocation?.coordinates || [0, 0];

    await Emergency.create({
        user: driverId,
        severity: 'CRITICAL',
        location: {
            coordinates: {
                type: 'Point',
                coordinates: location
            },
            address: 'Unknown (Crash Location)'
        },
        type: 'ACCIDENT',
        status: 'ACTIVE',
        description: `Automated telematics crash detection for ride ${rideId}. Magnitude: ${crashData.value.toFixed(2)} Gs.`
    });
}
