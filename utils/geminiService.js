/**
 * Gemini AI Service — LoopLane Intelligence Engine
 * Uses @google/genai SDK (v1.x) with Gemini 2.5 Flash
 * Provides AI-generated data narratives, anomaly detection, and insights
 * 
 * Includes: in-memory response cache + rate-limit circuit breaker
 */

const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY not set — AI features will use fallback responses');
}

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ─── In-Memory Response Cache ────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const insightCache = new Map();

function getCacheKey(context, metrics) {
  return `${context}::${JSON.stringify(metrics)}`;
}

function getCached(key) {
  const entry = insightCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    insightCache.delete(key);
    return null;
  }
  return { ...entry.data, cached: true };
}

function setCache(key, data) {
  // Cap cache at 200 entries to prevent memory leak
  if (insightCache.size > 200) {
    const firstKey = insightCache.keys().next().value;
    insightCache.delete(firstKey);
  }
  insightCache.set(key, { data, timestamp: Date.now() });
}

// ─── Rate-Limit Circuit Breaker ──────────────────────────────────────────────
let rateLimitBlockedUntil = 0;

function isRateLimited() {
  return Date.now() < rateLimitBlockedUntil;
}

function handleRateLimitError(error) {
  const message = error?.message || '';
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429') || message.includes('quota')) {
    // Extract retry delay from error or default to 60s
    const retryMatch = message.match(/retry in (\d+)/i);
    const delaySec = retryMatch ? parseInt(retryMatch[1], 10) : 60;
    rateLimitBlockedUntil = Date.now() + (delaySec * 1000);
    console.warn(`[GeminiService] Rate limited — circuit breaker ON for ${delaySec}s (until ${new Date(rateLimitBlockedUntil).toLocaleTimeString()})`);
    return true;
  }
  return false;
}

// System instructions for different contexts
const SYSTEM_PROMPTS = {
  dashboard: `You are LoopLane's AI analyst. LoopLane is a carpooling/ridesharing platform in India.
Given dashboard metrics, provide a concise 2-3 sentence executive summary highlighting:
- Key trends (growth/decline)
- Anomalies worth investigating
- One actionable recommendation
Keep it professional, data-driven, and specific. Use ₹ for currency. Reference actual numbers from the data. No markdown formatting.`,

  financial: `You are LoopLane's financial analyst AI. Given financial metrics:
- Summarize revenue performance and settlement health
- Flag any concerning patterns (high refunds, settlement delays)
- Suggest optimization opportunities
Keep it to 3-4 sentences. Use ₹ for currency. Reference actual numbers. No markdown.`,

  safety: `You are LoopLane's safety operations AI. Given safety metrics:
- Assess overall platform safety posture
- Highlight urgent patterns (SOS spikes, incident clusters, unresolved emergencies)
- Recommend preventive actions with priority
2-3 sentences max. Be direct and action-oriented. Reference specific numbers from the data.`,

  fraud: `You are LoopLane's fraud intelligence AI. Given fraud detection results:
- Summarize the threat landscape with specific numbers
- Highlight the most critical fraud rings or patterns
- Recommend enforcement priorities
3-4 sentences. Be specific about risk levels and reference the data.`,

  churn: `You are LoopLane's retention strategist AI. Given churn prediction data:
- Assess retention health and risk levels with specific percentages
- Identify user segments most at risk (high-value vs general)
- Suggest targeted retention tactics with expected impact
3 sentences. Focus on actionable wins. Reference the numbers.`,

  sustainability: `You are LoopLane's environmental impact analyst AI. Given sustainability metrics:
- Quantify the platform's positive environmental impact (CO2 saved, fuel conserved, cars removed)
- Compare metrics to real-world equivalents (trees planted, flights offset)
- Suggest ways to amplify green impact (higher occupancy, route optimization)
3-4 sentences. Be inspiring but data-driven. Use metric units (kg, liters, km). Reference actual values.`,

  health: `You are LoopLane's system health monitor AI. Given system health metrics:
- Assess server health (memory usage, CPU load, uptime)
- Flag any performance bottlenecks or resource constraints
- Recommend capacity planning or optimization actions
2-3 sentences. Be technical but clear. Reference actual percentages and values.`,

  pricing: `You are LoopLane's pricing optimization AI. Given pricing and demand-supply metrics:
- Evaluate supply-demand balance and pricing configuration
- Identify pricing inefficiencies or opportunities (surge gaps, commission tuning)
- Recommend specific pricing adjustments with expected impact
3-4 sentences. Use ₹ for currency. Reference ratios and actual pricing values.`,

  analytics: `You are LoopLane's ride analytics AI. Given ride and route analytics data:
- Summarize ride volume trends, popular routes, and peak patterns
- Identify underserved corridors or time windows
- Suggest operational improvements (driver incentives, marketing focus areas)
3-4 sentences. Reference actual route names, counts, and percentages.`,

  geoFencing: `You are LoopLane's geospatial operations AI. Given geo-fencing and route deviation data:
- Assess geo-fence coverage and violation patterns
- Highlight route deviation hotspots and unresolved alerts
- Recommend zone adjustments or driver communication actions
2-3 sentences. Be specific about locations and numbers.`,

  reports: `You are LoopLane's content moderation AI. Given user report/complaint data:
- Summarize report volume and severity distribution
- Highlight categories needing urgent attention (safety, fraud, misconduct)
- Recommend moderation team priorities
2-3 sentences. Reference actual counts and categories.`,

  audit: `You are LoopLane's compliance and audit AI. Given audit log data:
- Summarize administrative activity patterns and frequency
- Flag unusual patterns (bulk operations, off-hours activity, privilege escalation)
- Recommend governance improvements
2-3 sentences. Be specific about action types and volumes.`,

  settings: `You are LoopLane's platform configuration AI. Given system settings data:
- Assess configuration health (maintenance mode, feature flags, notification settings)
- Identify misconfigurations or risky settings
- Suggest optimizations for the current operational state
2-3 sentences. Be practical and reference specific setting values.`,

  general: `You are LoopLane's AI analyst. LoopLane is a carpooling/ridesharing platform.
Analyze the provided data and give a concise, actionable summary in 2-3 sentences.
Focus on what matters most. Reference actual numbers from the data. No markdown formatting.`
};

/**
 * Generate AI insight from metrics data
 * @param {string} context - One of: dashboard, financial, safety, fraud, churn, sustainability, health, pricing, analytics, geoFencing, reports, audit, settings, general
 * @param {Object} metrics - The data to analyze
 * @returns {Promise<{insight: string, confidence: string, timestamp: string}>}
 */
async function generateInsight(context, metrics) {
  const cacheKey = getCacheKey(context, metrics);

  // 1. Check cache first
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // 2. Check circuit breaker — skip API if rate limited
  if (isRateLimited()) {
    console.warn('[GeminiService] Circuit breaker active — returning fallback');
    const fallback = generateFallbackInsight(context, metrics);
    setCache(cacheKey, fallback);
    return fallback;
  }

  // 3. Check if API key available
  if (!ai) {
    const fallback = generateFallbackInsight(context, metrics);
    setCache(cacheKey, fallback);
    return fallback;
  }

  try {
    const systemPrompt = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS.general;
    const metricsStr = JSON.stringify(metrics, null, 2);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\nCurrent metrics:\n${metricsStr}`,
    });

    const text = response.text || '';

    const result = {
      insight: text.trim(),
      confidence: 'high',
      model: 'gemini-2.5-flash',
      timestamp: new Date().toISOString(),
      cached: false,
    };

    // Cache successful response
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[GeminiService] AI insight generation failed:', error.message);
    handleRateLimitError(error);
    // Return rule-based fallback and cache it
    const fallback = generateFallbackInsight(context, metrics);
    setCache(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Generate multiple insights in batch (for dashboard overview)
 */
async function generateBatchInsights(sections) {
  const results = {};
  const promises = Object.entries(sections).map(async ([key, { context, metrics }]) => {
    results[key] = await generateInsight(context, metrics);
  });
  await Promise.all(promises);
  return results;
}

/**
 * AI-powered anomaly explanation
 */
async function explainAnomaly(anomalyData) {
  try {
    const prompt = `You are LoopLane's anomaly detection AI. Explain this anomaly in 1-2 sentences:
${JSON.stringify(anomalyData)}
What likely caused it? Should the team act immediately?`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return {
      explanation: (response.text || '').trim(),
      severity: anomalyData.severity || 'medium',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[GeminiService] Anomaly explanation failed:', error.message);
    return {
      explanation: `Anomaly detected in ${anomalyData.metric || 'metric'}: ${anomalyData.description || 'unexpected deviation from baseline'}.`,
      severity: anomalyData.severity || 'medium',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Rule-based fallback when Gemini API is unavailable
 */
function generateFallbackInsight(context, metrics) {
  let insight = '';

  switch (context) {
    case 'dashboard': {
      const users = metrics.totalUsers || 0;
      const rides = metrics.totalRides || metrics.completedRides || 0;
      const revenue = metrics.totalRevenue || 0;
      const active = metrics.activeRides || 0;
      insight = `Platform has ${users.toLocaleString()} users with ${rides.toLocaleString()} rides generating ₹${(revenue / 1000).toFixed(1)}K revenue. `;
      if (active > 0) insight += `${active} rides currently active. `;
      if (metrics.growthRate > 10) insight += 'Growth trajectory is strong — consider scaling infrastructure.';
      else if (metrics.growthRate > 0) insight += 'Steady growth detected — focus on retention optimization.';
      else insight += 'Monitor acquisition channels to sustain user growth.';
      break;
    }
    case 'financial': {
      const rev = metrics.totalRevenue || 0;
      const pending = metrics.pendingSettlements || 0;
      const commission = metrics.commissionRate || 0;
      const avgTxn = metrics.avgTransactionValue || 0;
      insight = `Revenue at ₹${(rev / 1000).toFixed(1)}K with ${metrics.transactionCount || 0} transactions (avg ₹${Math.round(avgTxn)}). `;
      insight += pending > 50 ? `${pending} pending settlements need urgent processing. ` : 'Settlement pipeline is healthy. ';
      if (commission) insight += `Commission rate at ${commission}% — benchmark against industry 15-20%.`;
      break;
    }
    case 'safety': {
      const alerts = metrics.activeAlerts || metrics.totalAlerts || 0;
      const sos = metrics.sosCount || metrics.activeSOS || 0;
      const resolved = metrics.resolvedCount || 0;
      const resRate = alerts > 0 ? Math.round((resolved / alerts) * 100) : 100;
      insight = `${alerts} safety alerts tracked, ${sos} SOS events, ${resRate}% resolution rate. `;
      insight += sos > 5 ? 'Elevated SOS volume — review hotspot areas and driver screening protocols.' : 'Safety posture is within normal parameters. ';
      if (metrics.unresolvedCount > 0) insight += `${metrics.unresolvedCount} unresolved alerts require follow-up.`;
      break;
    }
    case 'fraud': {
      const rings = metrics.fraudRings || 0;
      const flagged = metrics.flaggedUsers || metrics.suspiciousUsers || 0;
      const riskScore = metrics.overallRiskScore || metrics.avgRiskScore || 0;
      insight = `Detected ${rings} potential fraud rings involving ${flagged} flagged users. `;
      if (riskScore) insight += `Overall risk score: ${riskScore}/100. `;
      insight += rings > 0 ? 'Recommend freezing top suspicious accounts and reviewing transaction patterns.' : 'No active fraud clusters — maintain monitoring vigilance.';
      break;
    }
    case 'churn': {
      const atRisk = metrics.atRiskUsers || 0;
      const highValue = metrics.highValueAtRisk || 0;
      const retRate = metrics.retentionRate || 0;
      const churnRate = metrics.churnRate || 0;
      insight = `${atRisk} users at churn risk (${churnRate}% churn rate), ${highValue} are high-value accounts. `;
      insight += `Retention rate: ${retRate}%. `;
      insight += highValue > 10 ? 'Priority: Launch personalized re-engagement for top-value users with loyalty incentives.' : 'Churn risk is manageable — maintain standard lifecycle campaigns.';
      break;
    }
    case 'sustainability': {
      const co2 = metrics.totalCO2SavedKg || 0;
      const trees = metrics.treesEquivalent || 0;
      const fuel = metrics.fuelSavedLiters || 0;
      const rides = metrics.totalCarpoolRides || 0;
      const cars = metrics.carsRemovedEquivalent || 0;
      insight = `${rides.toLocaleString()} carpool rides saved ${Math.round(co2).toLocaleString()} kg CO₂ — equivalent to ${trees} trees planted. `;
      insight += `${Math.round(fuel).toLocaleString()}L fuel conserved, ${cars} cars effectively removed from roads. `;
      const avgOcc = metrics.avgPassengersPerRide || 0;
      insight += avgOcc < 2.5 ? 'Increasing avg passengers per ride above 2.5 could significantly amplify impact.' : 'Strong occupancy rate driving maximum environmental benefit.';
      break;
    }
    case 'health': {
      const memPct = metrics.memoryUsagePercent || 0;
      const cpu = metrics.cpuLoad || metrics.loadAvg || 0;
      const uptime = metrics.uptimeHours || 0;
      insight = `Server memory at ${memPct}% utilization, CPU load ${typeof cpu === 'number' ? cpu.toFixed(2) : cpu}. `;
      insight += uptime ? `Uptime: ${Math.round(uptime)}h. ` : '';
      insight += memPct > 80 ? 'Memory usage is high — consider scaling or optimizing heavy queries.' : 'System resources within healthy thresholds. ';
      if (metrics.dbResponseTime) insight += `DB response: ${metrics.dbResponseTime}ms.`;
      break;
    }
    case 'pricing': {
      const ratio = metrics.supplyDemandRatio || 0;
      const base = metrics.baseFare || 0;
      const perKm = metrics.pricePerKm || 0;
      const commission = metrics.commission || 0;
      insight = `Supply-demand ratio at ${ratio.toFixed(2)} with base fare ₹${base}, ₹${perKm}/km, ${commission}% commission. `;
      insight += ratio < 0.8 ? 'Supply deficit — consider driver incentives or surge pricing to balance demand.' : ratio > 1.5 ? 'Supply surplus — reduce driver incentives and focus on demand generation.' : 'Supply-demand balance is healthy. ';
      if (metrics.surgeMax) insight += `Surge cap: ${metrics.surgeMax}x.`;
      break;
    }
    case 'analytics': {
      const totalRides = metrics.totalRides || 0;
      const popular = metrics.topRoute || metrics.popularRoute || 'N/A';
      const peakHour = metrics.peakHour || 'N/A';
      insight = `${totalRides.toLocaleString()} rides analyzed. `;
      if (popular !== 'N/A') insight += `Top route: ${popular}. `;
      if (peakHour !== 'N/A') insight += `Peak demand at ${peakHour}. `;
      insight += 'Review underserved corridors for expansion opportunities.';
      break;
    }
    case 'geoFencing': {
      const deviations = metrics.totalDeviations || 0;
      const unresolved = metrics.unresolvedDeviations || 0;
      const zones = metrics.activeZones || 0;
      insight = `${deviations} route deviations detected across ${zones} geo-fence zones. `;
      insight += unresolved > 0 ? `${unresolved} unresolved — investigate for potential safety or compliance concerns.` : 'All deviations resolved. ';
      break;
    }
    case 'reports': {
      const total = metrics.totalReports || 0;
      const pending = metrics.pendingReports || 0;
      const safety = metrics.safetyReports || 0;
      insight = `${total} user reports filed, ${pending} pending review. `;
      insight += safety > 0 ? `${safety} safety-related reports require priority attention. ` : '';
      insight += pending > 20 ? 'Report backlog is growing — consider increasing moderation capacity.' : 'Moderation queue is under control.';
      break;
    }
    case 'audit': {
      const total = metrics.totalActions || 0;
      const types = metrics.actionTypeCount || 0;
      const recent = metrics.recentActivity || 'Normal';
      insight = `${total} admin actions logged across ${types} action types. Activity level: ${recent}. `;
      insight += total > 500 ? 'High admin activity volume — review for bulk operations or automation opportunities.' : 'Admin activity within normal patterns.';
      break;
    }
    case 'settings': {
      const maint = metrics.maintenanceMode || 'OFF';
      const commission = metrics.commission || 'N/A';
      const sos = metrics.sosAlerts || 'Unknown';
      insight = `Maintenance mode: ${maint}. Commission: ${commission}. SOS alerts: ${sos}. `;
      insight += maint === 'ON' ? 'Platform is in maintenance — ensure this is intentional and communicate to users.' : 'Configuration appears healthy.';
      break;
    }
    default:
      insight = 'Analysis complete. Review the data panels for detailed metrics and trends.';
  }

  return {
    insight,
    confidence: 'medium',
    model: 'rule-based-fallback',
    timestamp: new Date().toISOString(),
    cached: false,
  };
}

module.exports = {
  generateInsight,
  generateBatchInsights,
  explainAnomaly,
  generateFallbackInsight,
};
