/**
 * Carbon / ESG Reporting Controller
 * Epic 4: LoopLane For Business
 */

const Corporate = require('../models/Corporate');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { asyncHandler } = require('../middleware/errorHandler');
const { buildCacheKey, getOrSetJson } = require('../utils/redisCache');

const ESG_REPORT_CACHE_TTL_SECONDS = 10 * 60; // 10 min

/**
 * @desc    Generate ESG Carbon Report for Corporate Entity
 * @route   GET /api/corporate/esg-report
 * @access  Private (Corporate Admin Only)
 */
exports.generateESGReport = asyncHandler(async (req, res) => {
    if (!req.user.corporate || req.user.corporate.cohortRole !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied: Corporate Admin only' });
    }

    const { period = 'last_30_days', year, quarter } = req.query;
    const orgId = req.user.corporate.organization;

    // Build Date Filter
    let startDate = new Date();
    let endDate = new Date();

    if (period === 'ytd') {
        startDate = new Date(new Date().getFullYear(), 0, 1);
    } else if (period === 'last_quarter') {
        const currentQ = Math.floor((new Date().getMonth() + 3) / 3);
        const lastQ = currentQ === 1 ? 4 : currentQ - 1;
        const lastQYear = currentQ === 1 ? new Date().getFullYear() - 1 : new Date().getFullYear();
        startDate = new Date(lastQYear, (lastQ - 1) * 3, 1);
        endDate = new Date(lastQYear, lastQ * 3, 0);
    } else {
        // default: last 30 days
        startDate.setDate(startDate.getDate() - 30);
    }

    const cacheKey = buildCacheKey('b2b:esg-report', {
        orgId: String(orgId),
        period,
        year: year || null,
        quarter: quarter || null,
        start: startDate.toISOString(),
        end: endDate.toISOString()
    });

    const { value, cache } = await getOrSetJson(cacheKey, ESG_REPORT_CACHE_TTL_SECONDS, async () => {
        // Pipeline to aggregate Carbon Savings
        const employees = await User.find({ 'corporate.organization': orgId }, '_id').lean();
        const employeeIds = employees.map(e => e._id);

        const bookings = await Booking.find({
            passenger: { $in: employeeIds },
            status: 'COMPLETED',
            createdAt: { $gte: startDate, $lte: endDate }
        })
            .populate('ride', 'distance carbonSaved')
            .lean();

        let totalCo2Saved = 0;
        let totalRides = bookings.length;
        let totalDistanceShared = 0;

        bookings.forEach(booking => {
            if (booking.ride) {
                totalCo2Saved += (booking.ride.carbonSaved || 0);
                totalDistanceShared += (booking.ride.distance || 0);
            }
        });

        // Generate Standardized ESG Format
        const reportUrl = null; // In production, generate PDF using puppeteer and upload to S3

        return {
            success: true,
            report: {
                organizationId: orgId,
                period: {
                    start: startDate,
                    end: endDate
                },
                metrics: {
                    totalEmployeesParticipated: employees.length, // Can be refined to active only
                    ridesShared: totalRides,
                    sharedDistanceKm: parseFloat(totalDistanceShared.toFixed(2)),
                    co2OffsetKg: parseFloat(totalCo2Saved.toFixed(2)),
                    equivalentTreesPlanted: Math.round(totalCo2Saved / 21) // Avg 21kg CO2 per tree per year
                },
                complianceStandard: "GHG Protocol Scope 3 (Employee Commuting)",
                generatedAt: new Date(),
                downloadUrl: reportUrl
            }
        };
    });

    res.set('X-Cache', cache.hit ? 'HIT' : 'MISS');
    if (cache.store) res.set('X-Cache-Store', cache.store);

    res.status(200).json(value);
});
