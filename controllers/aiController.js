/**
 * AI Controller — Gemini-powered intelligence endpoints
 * Includes the AI Operations Agent chat (function calling) and legacy insight endpoints
 * 
 * KEY ARCHITECTURE: AI insights use SERVER-SIDE data fetching.
 * Each context queries MongoDB directly for real-time metrics, so
 * the AI always has fresh data regardless of frontend state.
 */

const geminiService = require('../utils/geminiService');
const aiAgent = require('../utils/aiAgent');
const adminController = require('./adminController');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Emergency = require('../models/Emergency');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const RouteDeviation = require('../models/RouteDeviation');
const Settings = require('../models/Settings');
const Transaction = require('../models/Transaction');

const DRIVER_ROLE = 'RIDER';
const BOOKING_FINAL_STATUSES = ['DROPPED_OFF', 'COMPLETED'];
const BOOKING_PAYMENT_SUCCESS_STATUSES = ['PAID', 'PAYMENT_CONFIRMED'];

// ─── Server-Side Data Fetchers ───────────────────────────────────────────────
// Each fetcher queries MongoDB directly for real-time metrics for its context.
// Frontend-passed metrics are merged as supplementary data only.

async function fetchDashboardData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, totalRides, totalBookings, recentBookings, activeDrivers, completedBookings, cancelledBookings] = await Promise.all([
    User.countDocuments(),
    Ride.countDocuments(),
    Booking.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({ role: DRIVER_ROLE, 'statistics.lastRideAt': { $gte: thirtyDaysAgo } }),
    Booking.countDocuments({ status: { $in: BOOKING_FINAL_STATUSES } }),
    Booking.countDocuments({ status: 'CANCELLED' }),
  ]);

  // Revenue from Booking.totalPrice — the primary price field on completed bookings
  const revenueAgg = await Booking.aggregate([
    { $match: { status: { $in: BOOKING_FINAL_STATUSES }, totalPrice: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } },
  ]);

  return {
    totalUsers, totalRides, totalBookings, completedBookings, cancelledBookings,
    recentBookings7d: recentBookings,
    activeDrivers30d: activeDrivers,
    totalRevenue: revenueAgg[0]?.total || 0,
    completionRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) + '%' : '0%',
    cancellationRate: totalBookings > 0 ? ((cancelledBookings / totalBookings) * 100).toFixed(1) + '%' : '0%',
  };
}

async function fetchFinancialData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const settings = await Settings.findOne();
  const commission = settings?.pricing?.commission || 10;
  const rate = commission / 100;

  // Primary revenue source: Booking.totalPrice for completed bookings
  const [revenueAgg, pendingCount, paidCount, refundedCount, totalCompletedBookings] = await Promise.all([
    Booking.aggregate([
      { $match: { status: { $in: BOOKING_FINAL_STATUSES }, totalPrice: { $gt: 0 } } },
      { $group: {
        _id: null,
        totalRevenue: { $sum: '$totalPrice' },
        totalCommission: { $sum: { $ifNull: ['$payment.platformCommission', 0] } },
        count: { $sum: 1 },
        avgTxn: { $avg: '$totalPrice' },
      } },
    ]),
    Booking.countDocuments({ status: { $in: BOOKING_FINAL_STATUSES }, 'payment.status': 'PENDING' }),
    Booking.countDocuments({ status: { $in: BOOKING_FINAL_STATUSES }, 'payment.status': 'PAID' }),
    Booking.countDocuments({ status: { $in: BOOKING_FINAL_STATUSES }, 'payment.status': 'REFUNDED' }),
    Booking.countDocuments({ status: { $in: BOOKING_FINAL_STATUSES } }),
  ]);

  const rev = revenueAgg[0] || {};
  const totalRevenue = rev.totalRevenue || 0;
  // Use stored commission if available, otherwise compute from commission rate
  const platformCommission = rev.totalCommission > 0 ? rev.totalCommission : Math.round(totalRevenue * rate);
  const driverPayouts = totalRevenue - platformCommission;

  return {
    totalRevenue,
    platformCommission,
    commissionRate: commission,
    driverPayouts,
    pendingSettlements: pendingCount,
    completedSettlements: paidCount,
    refundedCount,
    totalCompletedBookings,
    avgTransactionValue: Math.round(rev.avgTxn || 0),
    transactionCount: rev.count || 0,
    netPlatformRevenue: platformCommission,
    period: '30d',
  };
}

async function fetchSafetyData() {
  const [statusAgg, severityAgg] = await Promise.all([
    Emergency.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Emergency.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
  ]);

  const byStatus = {};
  statusAgg.forEach(s => { byStatus[s._id] = s.count; });
  const bySeverity = {};
  severityAgg.forEach(s => { bySeverity[s._id] = s.count; });
  const total = Object.values(byStatus).reduce((s, c) => s + c, 0);

  return {
    totalAlerts: total,
    activeSOS: byStatus.ACTIVE || 0,
    acknowledged: byStatus.ACKNOWLEDGED || 0,
    resolvedCount: byStatus.RESOLVED || 0,
    cancelledCount: byStatus.CANCELLED || 0,
    unresolvedCount: (byStatus.ACTIVE || 0) + (byStatus.ACKNOWLEDGED || 0),
    resolutionRate: total > 0 ? Math.round(((byStatus.RESOLVED || 0) / total) * 100) + '%' : '100%',
    criticalAlerts: bySeverity.CRITICAL || 0,
    highAlerts: bySeverity.HIGH || 0,
  };
}

async function fetchFraudData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [suspiciousUsers, suspendedUsers, recentReports, totalReports] = await Promise.all([
    User.countDocuments({ $or: [{ isSuspended: true }, { 'trustScore.score': { $lt: 30, $gt: 0 } }] }),
    User.countDocuments({ isSuspended: true }),
    Report.countDocuments({ category: { $in: ['FAKE_PROFILE', 'OVERCHARGING', 'PAYMENT_DISPUTE'] }, createdAt: { $gte: thirtyDaysAgo } }),
    Report.countDocuments(),
  ]);

  return {
    suspiciousUsers,
    suspendedUsers,
    fraudRelatedReports: recentReports,
    totalReports,
    period: '30d',
  };
}

async function fetchChurnData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [totalUsers, activeUsers, dormantUsers] = await Promise.all([
    User.countDocuments({ role: { $ne: 'admin' } }),
    User.countDocuments({ role: { $ne: 'admin' }, lastLogin: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ role: { $ne: 'admin' }, lastLogin: { $lt: sixtyDaysAgo } }),
  ]);

  const retentionRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;

  return {
    totalUsers,
    activeUsers,
    dormantUsers,
    atRiskUsers: dormantUsers,
    retentionRate: retentionRate + '%',
    churnRate: (100 - retentionRate) + '%',
  };
}

async function fetchSustainabilityData() {
  const settings = await Settings.findOne();
  const co2PerKm = settings?.environmental?.co2PerKm || 0.12;
  const co2PerTree = settings?.environmental?.co2PerTree || 22;

  // distance is at route.distance, passengers counted from bookings array length
  const [ridesAgg, totalBookings] = await Promise.all([
    Ride.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: null, totalRides: { $sum: 1 }, totalDistance: { $sum: { $ifNull: ['$route.distance', 0] } }, totalPassengers: { $sum: { $size: { $ifNull: ['$bookings', []] } } } } },
    ]),
    Booking.countDocuments({ status: { $in: BOOKING_FINAL_STATUSES } }),
  ]);

  const stats = ridesAgg[0] || { totalRides: 0, totalDistance: 0, totalPassengers: 0 };
  const totalCO2Saved = stats.totalDistance * co2PerKm;
  const avgPassengers = stats.totalRides > 0 ? (stats.totalPassengers / stats.totalRides).toFixed(1) : 0;

  return {
    totalCarpoolRides: stats.totalRides,
    totalPassengersCarried: totalBookings,
    totalDistanceKm: Math.round(stats.totalDistance),
    totalCO2SavedKg: Math.round(totalCO2Saved),
    treesEquivalent: co2PerTree > 0 ? Math.round(totalCO2Saved / co2PerTree) : 0,
    fuelSavedLiters: Math.round(totalCO2Saved / 2.31),
    avgPassengersPerRide: avgPassengers,
    co2PerKm, co2PerTree,
  };
}

async function fetchHealthData() {
  const mem = process.memoryUsage();
  const os = require('os');
  const uptime = process.uptime();

  const [activeRides, totalUsers, pendingEmergencies] = await Promise.all([
    Ride.countDocuments({ status: { $in: ['ACTIVE', 'IN_PROGRESS'] } }),
    User.countDocuments(),
    Emergency.countDocuments({ status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] } }),
  ]);

  return {
    memoryUsagePercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
    cpuLoad: os.loadavg()[0].toFixed(2),
    cpuCores: os.cpus().length,
    uptimeHours: Math.round(uptime / 3600),
    platform: os.platform(),
    totalMemoryGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
    freeMemoryGB: (os.freemem() / 1024 / 1024 / 1024).toFixed(1),
    activeRides, totalUsers, pendingEmergencies,
  };
}

async function fetchPricingData() {
  const settings = await Settings.findOne();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [rideCount, bookingCount] = await Promise.all([
    Ride.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Booking.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
  ]);

  const pricing = settings?.pricing || {};
  return {
    baseFare: pricing.baseFare || 20,
    pricePerKm: pricing.pricePerKm || 5,
    commission: pricing.commission || 10,
    surgeMax: pricing.surgeMultiplierMax || 2,
    minimumFare: pricing.minimumFare || 30,
    supplyDemandRatio: rideCount > 0 ? (bookingCount / rideCount).toFixed(2) : 0,
    totalRidesPosted: rideCount,
    totalBookings: bookingCount,
    period: '30d',
  };
}

async function fetchAnalyticsData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [rideAgg, topRoutes, revenueAgg] = await Promise.all([
    Ride.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } } } },
    ]),
    Ride.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: { from: '$route.start.name', to: '$route.destination.name' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    Booking.aggregate([
      { $match: { status: { $in: BOOKING_FINAL_STATUSES }, totalPrice: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
  ]);

  const rideStats = rideAgg[0] || { total: 0, completed: 0 };
  const topRoute = topRoutes[0] ? `${topRoutes[0]._id.from} → ${topRoutes[0]._id.to}` : 'N/A';

  return {
    totalRides: rideStats.total,
    completedRides: rideStats.completed,
    completionRate: rideStats.total > 0 ? Math.round((rideStats.completed / rideStats.total) * 100) + '%' : '0%',
    topRoute,
    topRouteCount: topRoutes[0]?.count || 0,
    routeCount: topRoutes.length,
    totalRevenue: revenueAgg[0]?.total || 0,
    period: '30d',
  };
}

async function fetchGeoFencingData() {
  const [statusAgg, severityAgg] = await Promise.all([
    RouteDeviation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    RouteDeviation.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
  ]);

  const byStatus = {};
  statusAgg.forEach(s => { byStatus[s._id] = s.count; });
  const bySeverity = {};
  severityAgg.forEach(s => { bySeverity[s._id] = s.count; });
  const total = Object.values(byStatus).reduce((s, c) => s + c, 0);

  return {
    totalDeviations: total,
    activeDeviations: byStatus.ACTIVE || 0,
    escalatedDeviations: byStatus.ESCALATED || 0,
    resolvedDeviations: byStatus.RESOLVED || 0,
    unresolvedDeviations: (byStatus.ACTIVE || 0) + (byStatus.ESCALATED || 0),
    criticalDeviations: bySeverity.CRITICAL || 0,
    highDeviations: bySeverity.HIGH || 0,
  };
}

async function fetchReportsData() {
  const [statusAgg, categoryAgg, severityAgg] = await Promise.all([
    Report.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Report.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    Report.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
  ]);

  const byStatus = {};
  statusAgg.forEach(s => { byStatus[s._id] = s.count; });
  const total = Object.values(byStatus).reduce((s, c) => s + c, 0);

  const topCategory = categoryAgg.sort((a, b) => b.count - a.count)[0];
  const bySeverity = {};
  severityAgg.forEach(s => { bySeverity[s._id] = s.count; });

  return {
    totalReports: total,
    pendingReports: byStatus.PENDING || 0,
    underReview: byStatus.UNDER_REVIEW || 0,
    resolvedReports: byStatus.RESOLVED || 0,
    escalatedReports: byStatus.ESCALATED || 0,
    resolutionRate: total > 0 ? Math.round(((byStatus.RESOLVED || 0) / total) * 100) + '%' : '100%',
    topCategory: topCategory?._id || 'N/A',
    topCategoryCount: topCategory?.count || 0,
    highSeverity: bySeverity.HIGH || 0,
    safetyReports: (bySeverity.HIGH || 0) + (bySeverity.MEDIUM || 0),
  };
}

async function fetchAuditData() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalCount, recentAgg, severityAgg, actionAgg] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    AuditLog.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
    AuditLog.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const bySeverity = {};
  severityAgg.forEach(s => { bySeverity[s._id] = s.count; });
  const topActions = actionAgg.map(a => `${a._id} (${a.count})`).join(', ');

  return {
    totalActions: totalCount,
    recentActions7d: recentAgg,
    criticalActions: bySeverity.CRITICAL || 0,
    highActions: bySeverity.HIGH || 0,
    actionTypeCount: actionAgg.length,
    topActions,
    recentActivity: recentAgg > 100 ? 'High' : recentAgg > 30 ? 'Normal' : 'Low',
  };
}

async function fetchSettingsData() {
  const settings = await Settings.findOne();
  if (!settings) return { maintenanceMode: 'OFF', commission: 'N/A', sosAlerts: 'Unknown' };

  return {
    maintenanceMode: settings.features?.maintenanceMode ? 'ON' : 'OFF',
    commission: `${settings.pricing?.commission || 0}%`,
    baseFare: `₹${settings.pricing?.baseFare || 0}`,
    pricePerKm: `₹${settings.pricing?.pricePerKm || 0}`,
    sosAlerts: settings.notifications?.sosAlertsEnabled ? 'Enabled' : 'Disabled',
    maxSpeed: settings.safety?.maxSpeed || 'N/A',
    routeDeviationThreshold: `${settings.safety?.routeDeviation || 0}m`,
    minDriverRating: settings.safety?.minRating || 'N/A',
  };
}

// ─── Context → Data Fetcher Map ─────────────────────────────────────────────
const DATA_FETCHERS = {
  dashboard: fetchDashboardData,
  financial: fetchFinancialData,
  safety: fetchSafetyData,
  fraud: fetchFraudData,
  churn: fetchChurnData,
  sustainability: fetchSustainabilityData,
  health: fetchHealthData,
  pricing: fetchPricingData,
  analytics: fetchAnalyticsData,
  geoFencing: fetchGeoFencingData,
  reports: fetchReportsData,
  audit: fetchAuditData,
  settings: fetchSettingsData,
};

/**
 * POST /api/admin/ai/insights
 * Generate AI insight for a specific context.
 * 
 * SERVER-SIDE DATA FETCHING: The backend queries MongoDB directly for real-time
 * metrics for each context. Frontend-passed metrics are merged as supplementary
 * data but never relied upon as the primary data source.
 */
exports.getAIInsight = async (req, res) => {
  try {
    const { context, metrics: frontendMetrics } = req.body;

    if (!context) {
      return res.status(400).json({ success: false, message: 'Context is required' });
    }

    // Fetch real data from DB for this context
    let liveMetrics = {};
    const fetcher = DATA_FETCHERS[context];
    if (fetcher) {
      try {
        liveMetrics = await fetcher();
      } catch (fetchErr) {
        console.warn(`[AIController] Data fetch for '${context}' failed, using frontend metrics:`, fetchErr.message);
      }
    }

    // Merge: live DB data takes priority, frontend fills gaps
    const mergedMetrics = { ...(frontendMetrics || {}), ...liveMetrics };

    const result = await geminiService.generateInsight(context, mergedMetrics);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[AIController] Error generating insight:', error);
    res.status(500).json({ success: false, message: 'Failed to generate insight' });
  }
};

/**
 * POST /api/admin/ai/batch-insights
 * Generate multiple AI insights in one call — with server-side data enrichment
 */
exports.getBatchInsights = async (req, res) => {
  try {
    const { sections } = req.body;

    if (!sections || typeof sections !== 'object') {
      return res.status(400).json({ success: false, message: 'Sections object is required' });
    }

    // Enrich each section with live DB data
    const enrichedSections = {};
    await Promise.all(
      Object.entries(sections).map(async ([ctx, frontendMetrics]) => {
        let liveMetrics = {};
        const fetcher = DATA_FETCHERS[ctx];
        if (fetcher) {
          try { liveMetrics = await fetcher(); } catch (e) { /* use frontend */ }
        }
        enrichedSections[ctx] = { ...(frontendMetrics || {}), ...liveMetrics };
      })
    );

    const results = await geminiService.generateBatchInsights(enrichedSections);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[AIController] Error generating batch insights:', error);
    res.status(500).json({ success: false, message: 'Failed to generate batch insights' });
  }
};

/**
 * POST /api/admin/ai/explain-anomaly
 * Explain an anomaly
 */
exports.explainAnomaly = async (req, res) => {
  try {
    const { anomalyData } = req.body;
    const result = await geminiService.explainAnomaly(anomalyData || {});
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[AIController] Error explaining anomaly:', error);
    res.status(500).json({ success: false, message: 'Failed to explain anomaly' });
  }
};

/**
 * GET /api/admin/ai/dashboard-narrative
 * Auto-generate a dashboard narrative from live data.
 * Reuses the fetchDashboardData() server-side fetcher.
 */
exports.getDashboardNarrative = async (req, res) => {
  try {
    const metrics = await fetchDashboardData();
    const result = await geminiService.generateInsight('dashboard', metrics);
    res.json({ success: true, data: { ...result, metrics } });
  } catch (error) {
    console.error('[AIController] Error generating dashboard narrative:', error);
    res.status(500).json({ success: false, message: 'Failed to generate narrative' });
  }
};


// ═══════════════════════════════════════════════════════════════════════════════
// AI Operations Agent — Full Chat with Function Calling
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/admin/ai/chat
 * Multi-turn AI chat with automatic database tool calling.
 * The AI agent uses 15+ tools to query live data and deliver executive-grade analysis.
 */
exports.aiChat = async (req, res) => {
  try {
    const { message } = req.body;
    const adminId = req.user?._id?.toString() || req.user?.id || 'default-admin';

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ success: false, message: 'Message too long (max 2000 characters)' });
    }

    console.log(`🤖 [AI Chat] Admin ${adminId}: "${message.substring(0, 80)}..."`);
    const startTime = Date.now();

    const result = await aiAgent.chat(adminId, message.trim());

    const duration = Date.now() - startTime;
    console.log(`🤖 [AI Chat] Response in ${duration}ms, tools: [${result.toolsUsed.join(', ')}]`);

    res.json({
      success: true,
      data: {
        response: result.response,
        toolsUsed: result.toolsUsed,
        responseTime: duration
      }
    });
  } catch (error) {
    console.error('[AIController] Chat error:', error);
    res.status(500).json({ success: false, message: 'AI chat failed. Please try again.' });
  }
};

/**
 * POST /api/admin/ai/chat/stream
 * Streaming version of AI chat — sends chunks via SSE
 */
exports.aiChatStream = async (req, res) => {
  try {
    const { message } = req.body;
    const adminId = req.user?._id?.toString() || req.user?.id || 'default-admin';

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const toolsUsed = [];
    const startTime = Date.now();

    const stream = aiAgent.chatStream(adminId, message.trim(), (toolName) => {
      toolsUsed.push(toolName);
      res.write(`data: ${JSON.stringify({ type: 'tool', tool: toolName })}\n\n`);
    });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({
      type: 'done',
      toolsUsed: [...new Set(toolsUsed)],
      responseTime: Date.now() - startTime
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error('[AIController] Stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'AI stream failed' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
};

/**
 * DELETE /api/admin/ai/chat/history
 * Clear the admin's AI conversation history
 */
exports.clearAIChatHistory = async (req, res) => {
  try {
    const adminId = req.user?._id?.toString() || req.user?.id || 'default-admin';
    aiAgent.clearSession(adminId);
    res.json({ success: true, message: 'Conversation history cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to clear history' });
  }
};

/**
 * GET /api/admin/ai/chat/suggestions
 * Get suggested questions for the AI chatboard
 */
exports.getAISuggestions = async (req, res) => {
  try {
    res.json({ success: true, data: aiAgent.SUGGESTED_QUESTIONS });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get suggestions' });
  }
};
