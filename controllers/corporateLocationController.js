/**
 * Corporate Locations Controller
 * Epic 4: LoopLane For Business
 */

const Corporate = require('../models/Corporate');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Get corporate geofenced office nodes for the user's cohort
 * @route   GET /api/corporate/locations
 * @access  Private
 */
exports.getOfficeLocations = asyncHandler(async (req, res) => {
    // 1. Ensure user is enrolled in a corporate cohort
    if (!req.user.corporate || !req.user.corporate.organization || !req.user.corporate.isVerified) {
        return res.status(403).json({
            success: false,
            message: 'You must be linked and verified with a Corporate Cohort.'
        });
    }

    const orgId = req.user.corporate.organization;

    // 2. Fetch the Corporate Entity
    const org = await Corporate.findById(orgId).select('name officeLocations branding');
    if (!org) {
        return res.status(404).json({ success: false, message: 'Corporate profile not found' });
    }

    res.status(200).json({
        success: true,
        data: {
            organization: org.name,
            branding: org.branding,
            locations: org.officeLocations
        }
    });
});

/**
 * @desc    Add an office node (Admin only)
 * @route   POST /api/corporate/locations
 * @access  Private (Admin)
 */
exports.addOfficeLocation = asyncHandler(async (req, res) => {
    if (!req.user.corporate || req.user.corporate.cohortRole !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Corporate Admin only' });
    }

    const orgId = req.user.corporate.organization;
    const { name, coordinates, type = 'Point', radiusLimit = 500 } = req.body;

    if (!name || !Array.isArray(coordinates) || coordinates.length < 2) {
        return res.status(400).json({
            success: false,
            message: 'Name and valid coordinates are required'
        });
    }

    const org = await Corporate.findById(orgId);
    if (!org) {
        return res.status(404).json({ success: false, message: 'Corporate profile not found' });
    }

    org.officeLocations.push({
        name,
        location: {
            type,
            coordinates
        },
        radiusLimit
    });

    await org.save();

    res.status(201).json({
        success: true,
        message: 'Office location added successfully',
        data: org.officeLocations
    });
});
