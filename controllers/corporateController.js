/**
 * Corporate/B2B HR Dashboard Controller
 * Epic 4: LoopLane For Business
 */

const Corporate = require('../models/Corporate');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const { asyncHandler } = require('../middleware/errorHandler');
const { buildCacheKey, getOrSetJson } = require('../utils/redisCache');

const CORPORATE_DASHBOARD_CACHE_TTL_SECONDS = 60; // 1 min

/**
 * @desc    Get Corporate Dashboard Overview Stats
 * @route   GET /api/corporate/dashboard
 * @access  Private (Corporate Admin Only)
 */
exports.getDashboardStats = asyncHandler(async (req, res) => {
    // Ensure user is linked to a corporate and is an ADMIN
    if (!req.user.corporate || !req.user.corporate.organization || req.user.corporate.cohortRole !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied: Corporate Admin only' });
    }

    const orgId = req.user.corporate.organization;

    const cacheKey = buildCacheKey('b2b:dashboard', { orgId: String(orgId) });
    const { value, cache } = await getOrSetJson(cacheKey, CORPORATE_DASHBOARD_CACHE_TTL_SECONDS, async () => {
        // 1. Get Organization Details
        const org = await Corporate.findById(orgId);
        if (!org) {
            return { success: false, message: 'Corporate organization not found' };
        }

        // 2. Aggregate Employee Data
        const employees = await User.find(
            { 'corporate.organization': orgId },
            'profile.firstName profile.lastName corporate.workEmail corporate.isVerified statistics.ridesAsPassenger'
        ).lean();
        const employeeIds = employees.map(e => e._id);

    // 3. Aggregate Ride Data (Rides taken or provided by employees)
    // For a real B2B dashboard, you might only count rides subsidized by the org or between employees
        const completedRides = await Booking.find({
            passenger: { $in: employeeIds },
            status: 'COMPLETED'
        })
            .populate('ride', 'distance carbonSaved')
            .lean();

        let totalCarbonSaved = 0;
        let totalRides = completedRides.length;
        let totalSubsidizedCost = 0;

        completedRides.forEach(booking => {
            if (booking.ride && booking.ride.carbonSaved) {
                totalCarbonSaved += booking.ride.carbonSaved;
            }
            // If the company pays a subsidy, calculate it
            if (org.rules && org.rules.subsidizeRides) {
                const bookingAmount = booking.payment?.totalAmount || booking.totalPrice || 0;
                totalSubsidizedCost += (bookingAmount * (org.rules.subsidyPercentage / 100));
            }
        });

        // Update the DB metrics periodically (on cache miss)
        org.metrics.totalEmployeesEnrolled = employees.length;
        org.metrics.totalRidesCompleted = totalRides;
        org.metrics.totalCo2SavedKg = parseFloat(totalCarbonSaved.toFixed(2));
        org.metrics.totalMoneySaved = totalSubsidizedCost;
        await org.save();

        return {
            success: true,
            data: {
                organization: {
                    name: org.name,
                    plan: org.billing.plan,
                    subsidyPercentage: org.rules.subsidyPercentage
                },
                metrics: org.metrics,
                activeEmployees: employees.map(e => ({
                    id: e._id,
                    name: `${e.profile.firstName} ${e.profile.lastName}`,
                    email: e.corporate?.workEmail,
                    status: e.corporate?.isVerified ? 'Verified' : 'Pending',
                    ridesTaken: e.statistics?.ridesAsPassenger
                }))
            }
        };
    });

    res.set('X-Cache', cache.hit ? 'HIT' : 'MISS');
    if (cache.store) res.set('X-Cache-Store', cache.store);

    if (value && value.success === false && value.message === 'Corporate organization not found') {
        return res.status(404).json(value);
    }

    return res.status(200).json(value);
});

/**
 * @desc    Enroll Employee into Corporate Cohort
 * @route   POST /api/corporate/enroll
 * @access  Private (User hits this with their work email)
 */
exports.enrollEmployee = asyncHandler(async (req, res) => {
    const { workEmail } = req.body;

    if (!workEmail) {
        return res.status(400).json({ success: false, message: 'Work email is required' });
    }

    const domain = workEmail.split('@')[1];

    // Find Corporate by approved domain
    const org = await Corporate.findOne({ approvedDomains: domain });

    if (!org) {
        return res.status(404).json({ success: false, message: 'Your company is not enrolled in LoopLane For Business yet.' });
    }

    const user = await User.findById(req.user._id);

    // In a real flow, we'd send an OTP to the workEmail and verify it
    // Simulating instant verification for this epic
    user.corporate = {
        organization: org._id,
        workEmail: workEmail,
        isVerified: true, // Auto-verified for simulation
        cohortRole: 'EMPLOYEE'
    };

    await user.save();

    res.status(200).json({
        success: true,
        message: `Successfully linked to ${org.name} Corporate Cohort!`,
        data: { organizationName: org.name }
    });
});
