/**
 * Carbon Calculator Utility
 * Calculates carbon footprint and savings for carpooling
 */

class CarbonCalculator {
    /**
     * Emission factors for different vehicle types (g CO2/km)
     */
    static EMISSION_FACTORS = {
        'SEDAN': {
            'PETROL': 120,
            'DIESEL': 110,
            'CNG': 95,
            'ELECTRIC': 0,
            'HYBRID': 70
        },
        'SUV': {
            'PETROL': 180,
            'DIESEL': 160,
            'CNG': 140,
            'ELECTRIC': 0,
            'HYBRID': 110
        },
        'HATCHBACK': {
            'PETROL': 100,
            'DIESEL': 90,
            'CNG': 80,
            'ELECTRIC': 0,
            'HYBRID': 60
        },
        'VAN': {
            'PETROL': 200,
            'DIESEL': 180,
            'CNG': 160,
            'ELECTRIC': 0,
            'HYBRID': 130
        },
        'LUXURY': {
            'PETROL': 250,
            'DIESEL': 220,
            'CNG': 190,
            'ELECTRIC': 0,
            'HYBRID': 150
        },
        'MPV': {
            'PETROL': 140,
            'DIESEL': 130,
            'CNG': 115,
            'ELECTRIC': 0,
            'HYBRID': 90
        },
        'MOTORCYCLE': {
            'PETROL': 50,
            'DIESEL': 45,
            'CNG': 40,
            'ELECTRIC': 0,
            'HYBRID': 35
        },
        'AUTO': {
            'PETROL': 70,
            'DIESEL': 65,
            'CNG': 55,
            'ELECTRIC': 0,
            'HYBRID': 45
        }
    };

    /**
     * Constants
     */
    static TREE_CO2_ABSORPTION = 21; // kg CO2 per tree per year
    static FUEL_CO2_FACTOR = 2.31; // kg CO2 per liter of petrol
    static AVG_FUEL_EFFICIENCY = 15; // km per liter

    /**
     * Calculate total emission for a journey
     * @param {number} distance - Distance in kilometers
     * @param {string} vehicleType - Type of vehicle
     * @param {string} fuelType - Type of fuel (default: PETROL)
     * @returns {object} Emission data
     */
    static calculateTotalEmission(distance, vehicleType = 'SEDAN', fuelType = 'PETROL') {
        vehicleType = vehicleType.toUpperCase();
        fuelType = fuelType.toUpperCase();

        const emissionFactor = this.EMISSION_FACTORS[vehicleType]?.[fuelType] || 120;
        const totalEmissionGrams = distance * emissionFactor;
        const totalEmissionKg = totalEmissionGrams / 1000;

        // Calculate fuel consumed
        const fuelConsumed = distance / this.AVG_FUEL_EFFICIENCY;

        return {
            totalEmission: totalEmissionKg, // in kg
            emissionFactor: emissionFactor,
            fuelConsumed: fuelConsumed.toFixed(2),
            distance: distance
        };
    }

    /**
     * Calculate emission per person when carpooling
     * @param {number} totalEmission - Total emission in kg
     * @param {number} numberOfPeople - Number of people in car (including driver)
     * @returns {number} Emission per person in kg
     */
    static calculatePerPersonEmission(totalEmission, numberOfPeople) {
        if (numberOfPeople < 1) numberOfPeople = 1;
        return totalEmission / numberOfPeople;
    }

    /**
     * Calculate carbon saved through carpooling
     * @param {number} distance - Distance in kilometers
     * @param {string} vehicleType - Type of vehicle
     * @param {number} totalPassengers - Number of passengers (excluding driver)
     * @param {string} fuelType - Type of fuel
     * @returns {object} Carbon savings data
     */
    static calculateCarbonSaved(distance, vehicleType, totalPassengers, fuelType = 'PETROL') {
        const totalPeople = totalPassengers + 1; // Including driver

        // Calculate single vehicle emission (the shared ride)
        const singleCarEmission = this.calculateTotalEmission(distance, vehicleType, fuelType);
        const totalCarEmission = singleCarEmission.totalEmission;

        // Calculate what would happen if everyone drove solo
        // Each person would emit full car emissions
        const totalSoloEmission = totalCarEmission * totalPeople;

        // With carpooling, emission is divided among all passengers
        const perPersonCarpoolEmission = totalCarEmission / totalPeople;

        // Each person saves the difference between solo driving and their carpool share
        const savedPerPerson = totalCarEmission - perPersonCarpoolEmission;

        // Total carbon saved is the difference between all solo and one shared ride
        const totalSaved = totalSoloEmission - totalCarEmission;

        // Calculate equivalent trees
        const equivalentTrees = totalSaved / this.TREE_CO2_ABSORPTION;

        // Calculate money saved on fuel (approximate)
        const fuelPricePerLiter = 100; // ₹100 per liter (can be dynamic)
        const fuelSavedLiters = (distance / this.AVG_FUEL_EFFICIENCY) * totalPassengers;
        const moneySaved = fuelSavedLiters * fuelPricePerLiter;

        return {
            soloEmission: parseFloat(totalCarEmission.toFixed(2)),
            carpoolEmission: parseFloat(totalCarEmission.toFixed(2)),
            perPersonEmission: parseFloat(perPersonCarpoolEmission.toFixed(2)),
            savedPerPerson: parseFloat(savedPerPerson.toFixed(2)),
            totalSaved: parseFloat(totalSaved.toFixed(2)),
            equivalentTrees: parseFloat(equivalentTrees.toFixed(1)),
            moneySavedOnFuel: parseFloat(moneySaved.toFixed(2)),
            reductionPercentage: parseFloat(((savedPerPerson / totalCarEmission) * 100).toFixed(1))
        };
    }

    /**
     * Generate carbon report for display
     * @param {number} distance - Distance in kilometers
     * @param {string} vehicleType - Type of vehicle
     * @param {number} totalSeats - Total seats offered
     * @param {number} bookedSeats - Seats actually booked
     * @param {string} fuelType - Type of fuel
     * @returns {object} Formatted carbon report
     */
    static generateCarbonReport(distance, vehicleType, totalSeats, bookedSeats, fuelType = 'PETROL') {
        const savings = this.calculateCarbonSaved(distance, vehicleType, bookedSeats, fuelType);

        return {
            distance: distance,
            vehicleType: vehicleType,
            passengers: bookedSeats,
            totalPeople: bookedSeats + 1,
            emissions: {
                solo: `${savings.soloEmission} kg CO₂`,
                carpool: `${savings.perPersonEmission} kg CO₂`,
                saved: `${savings.savedPerPerson} kg CO₂`,
                totalSaved: `${savings.totalSaved} kg CO₂`,
                reduction: `${savings.reductionPercentage}%`
            },
            environmental: {
                treesEquivalent: `${savings.equivalentTrees} trees`,
                message: `Equivalent to planting ${savings.equivalentTrees} trees for a year!`
            },
            financial: {
                moneySaved: `₹${savings.moneySavedOnFuel}`,
                message: `Saved approximately ₹${savings.moneySavedOnFuel} on fuel costs`
            },
            badge: this.getCarbonBadge(savings.savedPerPerson)
        };
    }

    /**
     * Get carbon badge based on savings
     * @param {number} savedKg - Carbon saved in kg
     * @returns {object} Badge information
     */
    static getCarbonBadge(savedKg) {
        if (savedKg >= 20) {
            return { level: 'PLATINUM', icon: '🏆', color: '#E5E4E2', message: 'Eco Champion!' };
        } else if (savedKg >= 15) {
            return { level: 'GOLD', icon: '🥇', color: '#FFD700', message: 'Eco Warrior!' };
        } else if (savedKg >= 10) {
            return { level: 'SILVER', icon: '🥈', color: '#C0C0C0', message: 'Green Traveler!' };
        } else if (savedKg >= 5) {
            return { level: 'BRONZE', icon: '🥉', color: '#CD7F32', message: 'Eco Friendly!' };
        } else {
            return { level: 'GREEN', icon: '🌱', color: '#2ECC71', message: 'Making a Difference!' };
        }
    }

    /**
     * Calculate total carbon saved by user over time
     * @param {array} completedRides - Array of completed ride distances
     * @param {string} vehicleType - Vehicle type
     * @param {string} fuelType - Fuel type
     * @returns {object} Lifetime carbon statistics
     */
    static calculateLifetimeStats(completedRides, vehicleType = 'SEDAN', fuelType = 'PETROL') {
        let totalDistance = 0;
        let totalSaved = 0;
        let totalPassengers = 0;

        completedRides.forEach(ride => {
            totalDistance += ride.distance;
            totalPassengers += ride.passengers;
            const savings = this.calculateCarbonSaved(
                ride.distance,
                vehicleType,
                ride.passengers,
                fuelType
            );
            totalSaved += savings.totalSaved;
        });

        const equivalentTrees = totalSaved / this.TREE_CO2_ABSORPTION;

        return {
            totalDistance: parseFloat(totalDistance.toFixed(2)),
            totalRides: completedRides.length,
            totalPassengers: totalPassengers,
            totalCarbonSaved: parseFloat(totalSaved.toFixed(2)),
            equivalentTrees: parseFloat(equivalentTrees.toFixed(1)),
            averageSavingPerRide: completedRides.length > 0
                ? parseFloat((totalSaved / completedRides.length).toFixed(2))
                : 0,
            message: `You've saved ${totalSaved.toFixed(1)} kg CO₂ - equivalent to ${equivalentTrees.toFixed(1)} trees!`
        };
    }

    /**
     * Compare carpooling vs other transport modes
     * @param {number} distance - Distance in kilometers
     * @returns {object} Comparison data
     */
    static compareTransportModes(distance) {
        return {
            carSolo: {
                emission: (distance * 120 / 1000).toFixed(2),
                cost: (distance * 8).toFixed(2), // ₹8 per km
                mode: 'Car (Solo)'
            },
            carpool: {
                emission: (distance * 30 / 1000).toFixed(2), // Divided by 4 people
                cost: (distance * 2).toFixed(2), // ₹2 per km
                mode: 'Carpool (4 people)'
            },
            taxi: {
                emission: (distance * 120 / 1000).toFixed(2),
                cost: (distance * 15).toFixed(2), // ₹15 per km
                mode: 'Taxi'
            },
            bus: {
                emission: (distance * 50 / 1000).toFixed(2),
                cost: (distance * 1.5).toFixed(2), // ₹1.5 per km
                mode: 'Bus'
            },
            train: {
                emission: (distance * 30 / 1000).toFixed(2),
                cost: (distance * 1).toFixed(2), // ₹1 per km
                mode: 'Train'
            }
        };
    }

    /**
     * Generate user-level carbon report from database
     * Calculates total carbon saved across all completed rides/bookings
     * @param {ObjectId} userId - User ID
     * @returns {Promise<object>} User carbon statistics
     */
    static async generateUserCarbonReport(userId) {
        try {
            const User = require('../models/User');
            const Ride = require('../models/Ride');
            const Booking = require('../models/Booking');
            const mongoose = require('mongoose');

            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            let totalCarbonSaved = 0;
            let totalDistance = 0;
            let totalTrips = 0;
            let totalPassengersHelped = 0;

            if (user.role === 'RIDER') {
                // For riders: Calculate carbon saved from all completed rides
                const completedRides = await Ride.find({
                    rider: userId,
                    status: 'COMPLETED'
                }).lean();

                for (const ride of completedRides) {
                    const distance = ride.route?.distance || 0;
                    
                    // Count completed bookings for this ride
                    const completedBookingsCount = await Booking.countDocuments({
                        ride: ride._id,
                        status: 'COMPLETED'
                    });

                    if (distance > 0 && completedBookingsCount > 0) {
                        // Get vehicle info for emission calculation
                        const vehicle = user.vehicles?.find(
                            v => v._id.toString() === ride.vehicle?.toString()
                        );
                        const vehicleType = vehicle?.vehicleType || vehicle?.type || 'SEDAN';
                        const fuelType = vehicle?.fuelType || 'PETROL';

                        const savings = this.calculateCarbonSaved(
                            distance,
                            vehicleType,
                            completedBookingsCount,
                            fuelType
                        );

                        // For riders: they save the TOTAL carbon that would have been emitted
                        // if all passengers drove alone
                        totalCarbonSaved += savings.totalSaved;
                        totalDistance += distance;
                        totalTrips++;
                        totalPassengersHelped += completedBookingsCount;
                    }
                }
            } else {
                // For passengers: Calculate carbon saved from all completed bookings
                const completedBookings = await Booking.find({
                    passenger: userId,
                    status: 'COMPLETED'
                }).populate({
                    path: 'ride',
                    select: 'route vehicle rider',
                    populate: { 
                        path: 'rider', 
                        select: 'vehicles' 
                    }
                }).lean();

                for (const booking of completedBookings) {
                    const ride = booking.ride;
                    if (!ride) continue;

                    const distance = ride.route?.distance || 0;
                    
                    // Count total completed passengers in this ride
                    const totalPassengersInRide = await Booking.countDocuments({
                        ride: ride._id,
                        status: 'COMPLETED'
                    });

                    if (distance > 0 && totalPassengersInRide > 0) {
                        const rider = ride.rider;
                        const vehicle = rider?.vehicles?.find(
                            v => v._id.toString() === ride.vehicle?.toString()
                        );
                        const vehicleType = vehicle?.vehicleType || vehicle?.type || 'SEDAN';
                        const fuelType = vehicle?.fuelType || 'PETROL';

                        const savings = this.calculateCarbonSaved(
                            distance,
                            vehicleType,
                            totalPassengersInRide,
                            fuelType
                        );

                        // Passenger's individual share of carbon savings
                        // This is the emission they would have created if driving alone
                        // minus their share of the carpool emission
                        const perPersonSaving = savings.savedPerPerson;
                        totalCarbonSaved += perPersonSaving;
                        totalDistance += distance;
                        totalTrips++;
                    }
                }
            }

            // Calculate additional metrics
            const equivalentTrees = totalCarbonSaved / this.TREE_CO2_ABSORPTION;
            const badge = this.getUserBadge(totalCarbonSaved);

            return {
                totalSaved: parseFloat(totalCarbonSaved.toFixed(2)),
                totalDistance: parseFloat(totalDistance.toFixed(2)),
                totalTrips: totalTrips,
                totalPassengersHelped: totalPassengersHelped,
                equivalentTrees: parseFloat(equivalentTrees.toFixed(1)),
                badge: {
                    level: badge.level,
                    emoji: badge.icon,
                    name: badge.message,
                    color: badge.color
                },
                averagePerTrip: totalTrips > 0 ? parseFloat((totalCarbonSaved / totalTrips).toFixed(2)) : 0,
                message: `You've saved ${totalCarbonSaved.toFixed(1)} kg CO₂ - equivalent to planting ${equivalentTrees.toFixed(1)} trees!`
            };
        } catch (error) {
            console.error('Error generating user carbon report:', error);
            console.error('Error stack:', error.stack);
            // Return safe default values
            return {
                totalSaved: 0,
                totalDistance: 0,
                totalTrips: 0,
                totalPassengersHelped: 0,
                equivalentTrees: 0,
                badge: {
                    level: 'STARTER',
                    emoji: '🌍',
                    name: 'Getting Started',
                    color: '#3498DB'
                },
                averagePerTrip: 0,
                message: 'Start carpooling to make an impact!'
            };
        }
    }

    /**
     * Get user badge based on total lifetime savings
     * @param {number} totalSavedKg - Total carbon saved in kg
     * @returns {object} Badge information
     */
    static getUserBadge(totalSavedKg) {
        if (totalSavedKg >= 500) {
            return { 
                level: 'LEGEND', 
                icon: '👑', 
                color: '#9B59B6', 
                message: 'Carbon Legend' 
            };
        } else if (totalSavedKg >= 250) {
            return { 
                level: 'PLATINUM', 
                icon: '🏆', 
                color: '#E5E4E2', 
                message: 'Eco Champion' 
            };
        } else if (totalSavedKg >= 100) {
            return { 
                level: 'GOLD', 
                icon: '🥇', 
                color: '#FFD700', 
                message: 'Eco Warrior' 
            };
        } else if (totalSavedKg >= 50) {
            return { 
                level: 'SILVER', 
                icon: '🥈', 
                color: '#C0C0C0', 
                message: 'Green Traveler' 
            };
        } else if (totalSavedKg >= 10) {
            return { 
                level: 'BRONZE', 
                icon: '🥉', 
                color: '#CD7F32', 
                message: 'Eco Friendly' 
            };
        } else if (totalSavedKg > 0) {
            return { 
                level: 'GREEN', 
                icon: '🌱', 
                color: '#2ECC71', 
                message: 'Making a Difference' 
            };
        } else {
            return { 
                level: 'STARTER', 
                icon: '🌍', 
                color: '#3498DB', 
                message: 'Getting Started' 
            };
        }
    }
}

module.exports = CarbonCalculator;
