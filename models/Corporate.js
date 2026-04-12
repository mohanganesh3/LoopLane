/**
 * Corporate Tenant Model (B2B Enterprise)
 * Epic 4: LoopLane For Business
 */

const mongoose = require('mongoose');

const corporateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    approvedDomains: [{
        type: String,
        required: true
    }],
    contactPerson: {
        name: String,
        email: String,
        phone: String
    },
    branding: {
        logoUrl: String,
        primaryColor: String
    },
    // Geofenced Office Nodes mapping (Tech Parks, Campuses)
    officeLocations: [{
        name: String, // e.g., "Infosys Electronic City Phase 1"
        location: {
            type: {
                type: String,
                enum: ['Point', 'Polygon'],
                default: 'Point'
            },
            coordinates: {
                type: [Number],
                required: true
            }
        },
        radiusLimit: { type: Number, default: 500 } // Meters — moved OUT of location for valid GeoJSON
    }],
    billing: {
        plan: { type: String, enum: ['BASIC', 'PRO', 'ENTERPRISE'], default: 'BASIC' },
        status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
        credits: { type: Number, default: 0 } // Enterprise credits subsidized for employees
    },
    // Cohort Rules
    rules: {
        requireStrictMatching: { type: Boolean, default: false }, // Only match with coworkers?
        subsidizeRides: { type: Boolean, default: false }, // Company pays % of the ride
        subsidyPercentage: { type: Number, default: 0, min: 0, max: 100 }
    },
    // Aggregated Metrics for Enterprise Dashboard
    metrics: {
        totalEmployeesEnrolled: { type: Number, default: 0 },
        totalRidesCompleted: { type: Number, default: 0 },
        totalCo2SavedKg: { type: Number, default: 0 },
        totalMoneySaved: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// 2dsphere index for geospatial queries on office locations
corporateSchema.index({ 'officeLocations.location': '2dsphere' });

module.exports = mongoose.model('Corporate', corporateSchema);
