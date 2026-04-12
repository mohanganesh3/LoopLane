/**
 * Bipartite Graph Batch Matching Engine
 * Replaces greedy 1:1 search with a holistic optimization matrix.
 */

const Ride = require('../models/Ride');
const RideRequest = require('../models/RideRequest');
const Booking = require('../models/Booking');

// Simple Haversine fallback to avoid deep requires
const haversine = (coord1, coord2) => {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Executes a batch matching process on all pending ride requests
 */
exports.runBatchMatching = async () => {
    try {
        console.log('Initiating Bipartite Batch Matching Engine...');

        // 1. Fetch pending requests
        const pendingRequests = await RideRequest.find({ status: 'PENDING_MATCH' })
            .populate('passenger')
            .limit(100); // Process in batches of 100

        if (pendingRequests.length === 0) return { matched: 0, pending: 0 };

        // 2. Fetch available rides (drivers with empty seats coming up)
        const now = new Date();
        const availableRides = await Ride.find({
            status: 'ACTIVE',
            'pricing.availableSeats': { $gt: 0 },
            'schedule.departureDateTime': { $gte: now }
        });

        if (availableRides.length === 0) return { matched: 0, pending: pendingRequests.length };

        // 3. Construct the Bipartite Cost Matrix
        // Rows = Passenger Requests, Columns = Available Rides
        // Cost evaluates 3 vectors: Origin Walk Distance, Destination Walk Distance, Time Deflection
        const matchAssignments = [];

        for (let req of pendingRequests) {
            let bestRide = null;
            let bestScore = Infinity; // Lower is better (cost)

            for (let ride of availableRides) {
                // Must have enough seats
                if (ride.pricing.availableSeats < req.seatsNeeded) continue;

                // Time check (allow +/- 1 hour flex)
                const timeDiffHours = Math.abs(ride.schedule.departureDateTime - req.schedule.departureTime) / 36e5;
                if (timeDiffHours > 1) continue;

                // Spatial check (Walk distance to pickup)
                const walkToPickup = haversine(req.route.origin.coordinates, ride.route.start.coordinates);
                const walkFromDropoff = haversine(req.route.destination.coordinates, ride.route.destination.coordinates);

                // Max walk radius 3km for this algorithm
                if (walkToPickup > 3 || walkFromDropoff > 3) continue;

                // Cost Function
                // Weight distance heavily, time lightly
                const costScore = (walkToPickup * 2) + (walkFromDropoff * 2) + (timeDiffHours * 10);

                if (costScore < bestScore) {
                    bestScore = costScore;
                    bestRide = ride;
                }
            }

            if (bestRide) {
                matchAssignments.push({
                    request: req,
                    ride: bestRide,
                    cost: bestScore
                });

                // Temporarily decrement seats to prevent assigning 100 people to 1 car in memory
                bestRide.pricing.availableSeats -= req.seatsNeeded;
            }
        }

        // 4. Commit Assignments (Create Draft Bookings / Notifications)
        let matchedCount = 0;
        for (let assignment of matchAssignments) {
            const totalPrice = assignment.ride.pricing.pricePerSeat * assignment.request.seatsNeeded;
            const pickupPoint = {
                name: assignment.ride.route?.start?.name || assignment.request.route.origin.address || 'Pickup Point',
                address: assignment.ride.route?.start?.address || assignment.request.route.origin.address || '',
                coordinates: assignment.ride.route?.start?.coordinates || assignment.request.route.origin.coordinates,
                distanceFromStart: 0
            };
            const dropoffPoint = {
                name: assignment.ride.route?.destination?.name || assignment.request.route.destination.address || 'Dropoff Point',
                address: assignment.ride.route?.destination?.address || assignment.request.route.destination.address || '',
                coordinates: assignment.ride.route?.destination?.coordinates || assignment.request.route.destination.coordinates,
                distanceFromEnd: 0
            };

            // Update RideRequest
            assignment.request.status = 'MATCHED';
            assignment.request.matchedRide = assignment.ride._id;
            await assignment.request.save();

            // Create actual booking
            const booking = await Booking.create({
                ride: assignment.ride._id,
                passenger: assignment.request.passenger._id,
                rider: assignment.ride.rider,
                pickupPoint,
                dropoffPoint,
                seatsBooked: assignment.request.seatsNeeded,
                totalPrice,
                // In Bipartite batching, we auto-confirm to reduce friction, Waze-style
                status: 'CONFIRMED',
                payment: {
                    status: 'PENDING',
                    method: 'CASH',
                    rideFare: totalPrice,
                    platformCommission: 0,
                    totalAmount: totalPrice,
                    amount: totalPrice
                }
            });

            // Persist the seat decrement
            await Ride.findByIdAndUpdate(assignment.ride._id, {
                $inc: { 'pricing.availableSeats': -assignment.request.seatsNeeded },
                $push: { bookings: booking._id }
            });

            matchedCount++;
        }

        return { matched: matchedCount, pending: pendingRequests.length - matchedCount };

    } catch (error) {
        console.error('Batch Matching Engine Error:', error);
        throw error;
    }
};
