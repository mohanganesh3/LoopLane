/**
 * Review Model
 * Stores ratings and reviews for both riders and passengers
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    // Reference to Booking
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    
    // Reviewer and Reviewee
    reviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Type of Review
    type: {
        type: String,
        enum: ['DRIVER_REVIEW', 'PASSENGER_REVIEW'],
        required: true
    },
    
    // Ratings
    ratings: {
        overall: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        // Category-wise ratings (role-aware)
        categories: {
            // Shared
            punctuality: { type: Number, min: 1, max: 5 },
            communication: { type: Number, min: 1, max: 5 },
            // Driver-only (DRIVER_REVIEW)
            driving: { type: Number, min: 1, max: 5 },
            cleanliness: { type: Number, min: 1, max: 5 },
            // Passenger-only (PASSENGER_REVIEW)
            respectfulness: { type: Number, min: 1, max: 5 },
            friendliness: { type: Number, min: 1, max: 5 }
        }
    },
    
    // Quick Tags
    tags: [{
        type: String,
        enum: [
            // Positive tags
            'GREAT_CONVERSATION', 'SMOOTH_DRIVER', 'CLEAN_CAR', 'ON_TIME',
            'SAFE_DRIVER', 'FLEXIBLE', 'FRIENDLY', 'RESPECTFUL', 'QUIET',
            'GOOD_COMPANY',
            // Negative tags
            'LATE_PICKUP', 'RECKLESS_DRIVING', 'UNCOMFORTABLE', 'ROUTE_ISSUES',
            'RUDE_BEHAVIOR', 'NO_SHOW', 'LATE_ARRIVAL'
        ]
    }],
    
    // Written Review
    comment: {
        type: String,
        maxlength: 500,
        trim: true
    },
    
    // Photos (optional)
    photos: [String],
    
    // Review Interaction
    helpfulCount: {
        type: Number,
        default: 0
    },
    reportedCount: {
        type: Number,
        default: 0
    },
    
    // Moderation
    isPublished: {
        type: Boolean,
        default: true
    },
    reportedBy: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: String,
        reportedAt: Date
    }],
    adminNotes: String,
    
    // Response from Reviewee
    response: {
        text: String,
        respondedAt: Date
    }
    
}, {
    timestamps: true
});

// Indexes
reviewSchema.index({ reviewee: 1, isPublished: 1 });
reviewSchema.index({ booking: 1, reviewer: 1 }, { unique: true }); // One review per booking per user
reviewSchema.index({ 'ratings.overall': -1 });
reviewSchema.index({ createdAt: -1 });

// Static method to calculate average rating for a user
reviewSchema.statics.calculateUserRating = async function(userId) {
    try {
        const result = await this.aggregate([
            {
                $match: {
                    reviewee: new mongoose.Types.ObjectId(userId), // ✅ Fixed: Added 'new'
                    isPublished: true
                }
            },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: '$ratings.overall' },
                    totalReviews: { $sum: 1 },
                    fiveStar: {
                        $sum: { $cond: [{ $eq: ['$ratings.overall', 5] }, 1, 0] }
                    },
                    fourStar: {
                        $sum: { $cond: [{ $eq: ['$ratings.overall', 4] }, 1, 0] }
                    },
                    threeStar: {
                        $sum: { $cond: [{ $eq: ['$ratings.overall', 3] }, 1, 0] }
                    },
                    twoStar: {
                        $sum: { $cond: [{ $eq: ['$ratings.overall', 2] }, 1, 0] }
                    },
                    oneStar: {
                        $sum: { $cond: [{ $eq: ['$ratings.overall', 1] }, 1, 0] }
                    }
                }
            }
        ]);
        
        return result[0] || {
            avgRating: 0,
            totalReviews: 0,
            fiveStar: 0,
            fourStar: 0,
            threeStar: 0,
            twoStar: 0,
            oneStar: 0
        };
    } catch (error) {
        console.error('Error calculating user rating:', error);
        return {
            avgRating: 0,
            totalReviews: 0,
            fiveStar: 0,
            fourStar: 0,
            threeStar: 0,
            twoStar: 0,
            oneStar: 0
        };
    }
};

// Method to check if review is helpful
reviewSchema.methods.markAsHelpful = function(userId) {
    this.helpfulCount += 1;
    return this.save();
};

module.exports = mongoose.model('Review', reviewSchema);
