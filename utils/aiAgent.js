/**
 * AI Operations Agent — LoopLane Intelligence Engine
 * 
 * A production-grade AI agent powered by Gemini 2.5 Flash with function calling.
 * Acts as an entire analytics team: data analyst, safety officer, financial analyst,
 * retention strategist, operations manager — all in one chat interface.
 * 
 * Architecture:
 * 1. 15+ tool declarations (function calling) that query MongoDB directly
 * 2. Multi-turn conversation loop with automatic tool execution
 * 3. Compositional function calling (chain queries together)
 * 4. In-memory session management for conversation history
 * 5. Streaming support for real-time response delivery
 */

const { GoogleGenAI, FunctionCallingConfigMode } = require('@google/genai');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Report = require('../models/Report');
const Review = require('../models/Review');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const Emergency = require('../models/Emergency');
const SearchLog = require('../models/SearchLog');
const RouteAlert = require('../models/RouteAlert');
const RouteDeviation = require('../models/RouteDeviation');

// ─── Gemini Client ───────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
const MODEL = 'gemini-2.5-flash';
const DRIVER_ROLE = 'RIDER';
const USER_ROLES = ['PASSENGER', 'RIDER', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER', 'CONTENT_MODERATOR', 'FLEET_MANAGER'];
const BOOKING_PAYMENT_SUCCESS_STATUSES = ['PAID', 'PAYMENT_CONFIRMED'];
const BOOKING_FINAL_STATUSES = ['DROPPED_OFF', 'COMPLETED'];
const ACTIVE_RIDE_STATUSES = ['ACTIVE', 'IN_PROGRESS'];
const OPEN_REPORT_STATUSES = ['PENDING', 'UNDER_REVIEW', 'ESCALATED'];
const OPEN_EMERGENCY_STATUSES = ['ACTIVE', 'ACKNOWLEDGED'];
const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING', 'DROPPED_OFF', 'COMPLETED', 'NO_SHOW', 'CANCELLED'];
const RIDE_STATUSES = ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
const REPORT_STATUSES = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED'];
const EMERGENCY_STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'];

// ─── Session Store (in-memory, keyed by admin user ID) ───────────────────────
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

function getOrCreateSession(adminId) {
    if (sessions.has(adminId)) {
        const session = sessions.get(adminId);
        session.lastAccess = Date.now();
        return session;
    }
    const session = { history: [], lastAccess: Date.now() };
    sessions.set(adminId, session);
    return session;
}

function clearSession(adminId) {
    sessions.delete(adminId);
}

// Cleanup stale sessions every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.lastAccess > SESSION_TTL) sessions.delete(id);
    }
}, 10 * 60 * 1000);


// ─── System Prompt — The AI's "Job Description" ─────────────────────────────
const SYSTEM_PROMPT = `You are **LoopLane AI Operations Center** — an elite intelligence agent embedded in LoopLane, India's premier carpooling platform. You function as an entire analytics department:

## Your Roles
- **Chief Data Analyst**: Query live platform data, spot trends, detect anomalies
- **Safety Operations Officer**: Monitor reports, SOS events, trust scores, suspensions
- **Financial Analyst**: Track revenue, refunds, settlements, earnings flow
- **Retention Strategist**: Identify churn risks, suggest re-engagement tactics
- **Operations Manager**: Monitor ride/booking pipelines, driver performance, route demand

## Your Capabilities (via tools)
You have direct access to LoopLane's production database via function calls. ALWAYS use your tools to fetch real data before answering questions — NEVER guess or hallucinate numbers. You can chain multiple tool calls in sequence to build comprehensive analyses.

## Response Guidelines
- **Be data-driven**: Always cite actual numbers from tool results
- **Use ₹ for currency** (Indian Rupees)
- **Format responses with markdown**: Use headers, tables, bullet points, bold for emphasis
- **Be executive-ready**: Provide insights a CEO/founder would want — not raw data dumps
- **Proactive**: When analyzing one area, proactively mention related concerns
- **Actionable**: End important analyses with concrete recommendations
- **Concise but thorough**: 3-6 paragraphs for complex queries, 1-2 for simple ones

## Formatting Rules
- Use **bold** for key metrics and numbers
- Use tables for comparisons (use markdown tables)
- Use bullet lists for recommendations
- Use 📊 📈 📉 ⚠️ ✅ 🚨 🎯 💰 emojis sparingly to highlight key points
- When showing percentages, always show the absolute number too

## Important Context
- LoopLane is a carpooling/ride-sharing platform operating in India
- The "driver" role in the database is **RIDER**; passengers use **PASSENGER**
- Trust scores range 0-100 (NEWCOMER < 20, REGULAR 20-39, EXPERIENCED 40-59, AMBASSADOR 60-79, EXPERT 80+)
- Booking statuses: PENDING → CONFIRMED → PICKUP_PENDING → PICKED_UP → IN_TRANSIT → DROPOFF_PENDING → DROPPED_OFF → COMPLETED (or CANCELLED/REJECTED/EXPIRED/NO_SHOW)
- Ride statuses: ACTIVE → IN_PROGRESS → COMPLETED (or CANCELLED/EXPIRED)
- Payment success statuses are **PAID** and **PAYMENT_CONFIRMED**
- You also have SQL-style read-only query tools over MongoDB collections for flexible investigation when the fixed analytics tools are not enough
- Today's date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;


// ─── Tool Declarations (Function Calling Schema) ────────────────────────────
const TOOL_DECLARATIONS = [
    {
        name: 'get_platform_overview',
        description: 'Get a high-level overview of the entire platform: total users, rides, bookings, revenue, active drivers, completion rates, recent activity. Use this first to understand the current state of the platform.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'get_revenue_analytics',
        description: 'Get detailed revenue analytics including total revenue, revenue by period (daily/weekly/monthly), average booking value, refund totals, pending settlements, and revenue trends. Specify a period to compare.',
        parameters: {
            type: 'object',
            properties: {
                period: {
                    type: 'string',
                    enum: ['7d', '30d', '90d', '365d'],
                    description: 'Time period to analyze. Default: 30d'
                }
            },
            required: []
        }
    },
    {
        name: 'get_user_analytics',
        description: 'Get user base analytics: total users by role, new signups by period, verification status breakdown, trust score distribution, account status breakdown (active/suspended/banned), top-rated users.',
        parameters: {
            type: 'object',
            properties: {
                period: {
                    type: 'string',
                    enum: ['7d', '30d', '90d', '365d'],
                    description: 'Time period for new user metrics. Default: 30d'
                }
            },
            required: []
        }
    },
    {
        name: 'get_ride_analytics',
        description: 'Get ride analytics: total rides, rides by status, rides by period, popular routes (top origin-destination pairs), average seats offered, peak hours/days, ride completion rate.',
        parameters: {
            type: 'object',
            properties: {
                period: {
                    type: 'string',
                    enum: ['7d', '30d', '90d', '365d'],
                    description: 'Time period to analyze. Default: 30d'
                }
            },
            required: []
        }
    },
    {
        name: 'get_booking_analytics',
        description: 'Get booking funnel analytics: total bookings by status, conversion rates (requested → accepted → completed), cancellation rate and reasons, average time to accept, booking value distribution.',
        parameters: {
            type: 'object',
            properties: {
                period: {
                    type: 'string',
                    enum: ['7d', '30d', '90d', '365d'],
                    description: 'Time period to analyze. Default: 30d'
                }
            },
            required: []
        }
    },
    {
        name: 'get_safety_report',
        description: 'Get safety and trust metrics: active reports by category/severity, SOS alerts count, user suspensions/bans in period, average trust score trends, report resolution time, most reported categories.',
        parameters: {
            type: 'object',
            properties: {
                period: {
                    type: 'string',
                    enum: ['7d', '30d', '90d', '365d'],
                    description: 'Time period to analyze. Default: 30d'
                }
            },
            required: []
        }
    },
    {
        name: 'get_driver_performance',
        description: 'Get driver/rider performance metrics: top drivers by rating, most active drivers, drivers with most cancellations, average driver rating, drivers with low trust scores, new driver onboarding rate.',
        parameters: {
            type: 'object',
            properties: {
                limit: {
                    type: 'integer',
                    description: 'Number of top/bottom performers to return. Default: 10'
                }
            },
            required: []
        }
    },
    {
        name: 'get_financial_details',
        description: 'Get detailed financial breakdown: payment method distribution, refund rate, average refund amount, revenue by day of week, outstanding/pending amounts, transaction volume.',
        parameters: {
            type: 'object',
            properties: {
                period: {
                    type: 'string',
                    enum: ['7d', '30d', '90d', '365d'],
                    description: 'Time period to analyze. Default: 30d'
                }
            },
            required: []
        }
    },
    {
        name: 'get_real_time_activity',
        description: 'Get current real-time platform activity: rides in progress, pending bookings, active SOS alerts, users online in last 15 minutes, pending verifications, unresolved reports.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'search_users',
        description: 'Search for users by various criteria. Useful for investigating specific accounts, finding patterns, or looking up user details.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query — matches against name, email, or phone'
                },
                role: {
                    type: 'string',
                    enum: USER_ROLES,
                    description: 'Filter by role'
                },
                accountStatus: {
                    type: 'string',
                    enum: ['ACTIVE', 'SUSPENDED', 'DELETED'],
                    description: 'Filter by account status'
                },
                limit: {
                    type: 'integer',
                    description: 'Max results to return. Default: 10'
                }
            },
            required: []
        }
    },
    {
        name: 'get_user_deep_dive',
        description: 'Get comprehensive details for a specific user: profile, trust score, ride history, booking stats, reports filed/received, reviews, account status history. Use after search_users to investigate.',
        parameters: {
            type: 'object',
            properties: {
                userId: {
                    type: 'string',
                    description: 'The MongoDB ObjectId of the user to investigate'
                }
            },
            required: ['userId']
        }
    },
    {
        name: 'get_reports_overview',
        description: 'Get all reports/complaints with filters. Shows report category, severity, status, reporter/reported users, and resolution details.',
        parameters: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    enum: ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED'],
                    description: 'Filter by report status'
                },
                severity: {
                    type: 'string',
                    enum: ['LOW', 'MEDIUM', 'HIGH'],
                    description: 'Filter by severity'
                },
                limit: {
                    type: 'integer',
                    description: 'Max results. Default: 20'
                }
            },
            required: []
        }
    },
    {
        name: 'get_growth_metrics',
        description: 'Get period-over-period growth comparison: user signup growth, ride growth, booking growth, revenue growth. Compares current period vs previous period of same length.',
        parameters: {
            type: 'object',
            properties: {
                period: {
                    type: 'string',
                    enum: ['7d', '30d', '90d'],
                    description: 'Period to compare (current vs previous). Default: 30d'
                }
            },
            required: []
        }
    },
    {
        name: 'get_review_analytics',
        description: 'Get review and rating analytics: average platform rating, rating distribution (1-5 stars), most common review keywords, recent negative reviews, review volume trends.',
        parameters: {
            type: 'object',
            properties: {
                period: {
                    type: 'string',
                    enum: ['7d', '30d', '90d', '365d'],
                    description: 'Time period. Default: 30d'
                }
            },
            required: []
        }
    },
    {
        name: 'get_route_demand_analysis',
        description: 'Analyze route demand patterns: most popular origin-destination corridors, underserved routes (high search but low supply), peak demand times, geographic distribution of rides.',
        parameters: {
            type: 'object',
            properties: {
                limit: {
                    type: 'integer',
                    description: 'Number of top routes to return. Default: 15'
                }
            },
            required: []
        }
    },
    {
        name: 'get_data_catalog',
        description: 'Get the AI data catalog: available collections, important enums, and the key fields available for SQL-style read-only querying and aggregations.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'query_records',
        description: 'Run a SQL-style read-only query against a LoopLane collection. Supports filters, projections, sorting, and limits for detailed record lookups.',
        parameters: {
            type: 'object',
            properties: {
                collection: {
                    type: 'string',
                    enum: ['users', 'rides', 'bookings', 'reports', 'reviews', 'transactions', 'notifications', 'audit_logs', 'emergencies', 'search_logs', 'route_alerts', 'route_deviations'],
                    description: 'Collection to query'
                },
                filters: {
                    type: 'array',
                    description: 'Optional filter conditions. Example: role = RIDER, createdAt >= 2026-01-01',
                    items: {
                        type: 'object',
                        properties: {
                            field: { type: 'string' },
                            operator: {
                                type: 'string',
                                enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'regex', 'exists']
                            },
                            value: {}
                        },
                        required: ['field', 'operator']
                    }
                },
                fields: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional list of fields to return'
                },
                sortBy: {
                    type: 'string',
                    description: 'Field to sort by. Default: createdAt desc when available'
                },
                sortOrder: {
                    type: 'string',
                    enum: ['asc', 'desc'],
                    description: 'Sort direction. Default: desc'
                },
                limit: {
                    type: 'integer',
                    description: 'Maximum records to return. Default 10, max 50'
                }
            },
            required: ['collection']
        }
    },
    {
        name: 'aggregate_records',
        description: 'Run a SQL-style read-only aggregation against a LoopLane collection. Supports COUNT, SUM, AVG, MIN, MAX with optional GROUP BY on a field or date bucket.',
        parameters: {
            type: 'object',
            properties: {
                collection: {
                    type: 'string',
                    enum: ['users', 'rides', 'bookings', 'reports', 'reviews', 'transactions', 'notifications', 'audit_logs', 'emergencies', 'search_logs', 'route_alerts', 'route_deviations'],
                    description: 'Collection to aggregate'
                },
                filters: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            field: { type: 'string' },
                            operator: {
                                type: 'string',
                                enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'regex', 'exists']
                            },
                            value: {}
                        },
                        required: ['field', 'operator']
                    }
                },
                groupBy: {
                    type: 'string',
                    description: 'Optional field to group by. For date buckets, this should be a date field like createdAt'
                },
                groupByType: {
                    type: 'string',
                    enum: ['field', 'day', 'week', 'month'],
                    description: 'How to group the groupBy field. Default: field'
                },
                metrics: {
                    type: 'array',
                    description: 'Metrics to calculate. If omitted, defaults to count(*)',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            op: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'] },
                            field: { type: 'string' }
                        },
                        required: ['op']
                    }
                },
                sortBy: {
                    type: 'string',
                    description: 'Metric name or group field to sort by'
                },
                sortOrder: {
                    type: 'string',
                    enum: ['asc', 'desc'],
                    description: 'Sort direction. Default: desc'
                },
                limit: {
                    type: 'integer',
                    description: 'Maximum rows to return. Default 20, max 100'
                }
            },
            required: ['collection']
        }
    },
    {
        name: 'get_audit_trail',
        description: 'Get recent admin actions and audit trail: who did what, when. Useful for compliance and oversight.',
        parameters: {
            type: 'object',
            properties: {
                limit: {
                    type: 'integer',
                    description: 'Number of recent entries. Default: 20'
                }
            },
            required: []
        }
    }
];

const TOOL_NAMES = TOOL_DECLARATIONS.map(tool => tool.name);


// ─── Tool Execution Functions ────────────────────────────────────────────────

function periodToDate(period = '30d') {
    const days = parseInt(period) || 30;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const COLLECTION_MODELS = {
    users: User,
    rides: Ride,
    bookings: Booking,
    reports: Report,
    reviews: Review,
    transactions: Transaction,
    notifications: Notification,
    audit_logs: AuditLog,
    emergencies: Emergency,
    search_logs: SearchLog,
    route_alerts: RouteAlert,
    route_deviations: RouteDeviation
};

const SENSITIVE_FIELD_PATTERNS = [
    /^password$/,
    /^otp/i,
    /^resetPassword/i,
    /^loginAttempts$/,
    /^lockoutUntil$/,
    /^refreshToken/i,
    /^token/i,
    /^__v$/,
    /^payment\.transactionId$/i,
    /^payment\.gateway/i,
    /^metadata\.ipAddress$/i
];

const COLLECTION_FIELD_HINTS = {
    users: ['profile.firstName', 'profile.lastName', 'email', 'phone', 'role', 'accountStatus', 'verificationStatus', 'trustScore.score', 'rating.overall', 'statistics.totalRidesPosted', 'statistics.totalRidesTaken', 'createdAt', 'lastLogin'],
    rides: ['rider', 'status', 'route.start.address', 'route.destination.address', 'route.distance', 'route.duration', 'pricing.pricePerSeat', 'pricing.totalSeats', 'pricing.availableSeats', 'schedule.departureDateTime', 'createdAt'],
    bookings: ['ride', 'passenger', 'rider', 'status', 'seatsBooked', 'totalPrice', 'payment.status', 'payment.method', 'payment.totalAmount', 'cancellation.reason', 'riderResponse.responseTime', 'createdAt'],
    reports: ['category', 'severity', 'status', 'reporter', 'reportedUser', 'refundRequested', 'sla.priority', 'createdAt'],
    reviews: ['reviewer', 'reviewee', 'rating', 'comment', 'createdAt'],
    transactions: ['type', 'booking', 'ride', 'payment.method', 'payment.status', 'amounts.total', 'amounts.platformCommission', 'createdAt'],
    notifications: ['recipient', 'type', 'read', 'createdAt'],
    audit_logs: ['actor', 'actorRole', 'action', 'targetType', 'targetId', 'severity', 'createdAt'],
    emergencies: ['user', 'status', 'type', 'severity', 'location.address', 'triggeredAt', 'createdAt'],
    search_logs: ['user', 'sessionId', 'searchParams.origin.address', 'searchParams.destination.address', 'searchParams.date', 'resultsCount', 'funnelStatus', 'createdAt'],
    route_alerts: ['user', 'origin.address', 'destination.address', 'radiusKm', 'minSeats', 'maxPricePerSeat', 'active', 'triggerCount', 'expiresAt', 'createdAt'],
    route_deviations: ['ride', 'driver', 'deviationType', 'severity', 'status', 'deviationDistance', 'deviatedAt', 'createdAt']
};

const COLLECTION_DESCRIPTIONS = {
    users: 'User accounts, roles, verification, trust scores, and employee/admin metadata',
    rides: 'Ride listings, routes, schedules, seats, and live tracking status',
    bookings: 'Passenger bookings, status funnel, payment details, and cancellation metadata',
    reports: 'Safety complaints, disputes, SLA tracking, and investigation state',
    reviews: 'Ratings and written reviews between users',
    transactions: 'Platform financial ledger for payments, commissions, payouts, and refunds',
    notifications: 'In-app/system notifications sent to users or admins',
    audit_logs: 'Admin audit trail for compliance and operational oversight',
    emergencies: 'SOS and emergency events with resolution lifecycle',
    search_logs: 'Search funnel telemetry including zero-result demand',
    route_alerts: 'Saved route alerts for unmet demand and future supply matching',
    route_deviations: 'Geo-fence and route deviation safety incidents'
};

const PAYMENT_SUCCESS_MATCH = {
    status: { $in: BOOKING_FINAL_STATUSES },
    'payment.status': { $in: BOOKING_PAYMENT_SUCCESS_STATUSES }
};

const toName = (profile = {}) =>
    `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown';

const isSensitiveField = (field = '') =>
    SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(field));

const sanitizeDocument = (value) => {
    if (Array.isArray(value)) {
        return value.map(item => sanitizeDocument(item));
    }

    if (!value || typeof value !== 'object' || value instanceof Date) {
        return value;
    }

    const output = {};
    Object.entries(value).forEach(([key, entry]) => {
        if (isSensitiveField(key)) return;
        output[key] = sanitizeDocument(entry);
    });
    return output;
};

const normalizeQueryValue = (value) => {
    if (Array.isArray(value)) return value.map(item => normalizeQueryValue(item));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeQueryValue(v)]));
    }
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if (!trimmed) return value;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (!Number.isNaN(Number(trimmed)) && trimmed === String(Number(trimmed))) return Number(trimmed);

    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return parsedDate;
    }

    return value;
};

const appendFilterCondition = (query, field, operator, value) => {
    const normalized = normalizeQueryValue(value);
    switch (operator) {
        case 'eq':
            query[field] = normalized;
            break;
        case 'ne':
            query[field] = { ...(query[field] || {}), $ne: normalized };
            break;
        case 'gt':
            query[field] = { ...(query[field] || {}), $gt: normalized };
            break;
        case 'gte':
            query[field] = { ...(query[field] || {}), $gte: normalized };
            break;
        case 'lt':
            query[field] = { ...(query[field] || {}), $lt: normalized };
            break;
        case 'lte':
            query[field] = { ...(query[field] || {}), $lte: normalized };
            break;
        case 'in':
            query[field] = { ...(query[field] || {}), $in: Array.isArray(normalized) ? normalized : [normalized] };
            break;
        case 'nin':
            query[field] = { ...(query[field] || {}), $nin: Array.isArray(normalized) ? normalized : [normalized] };
            break;
        case 'regex':
            query[field] = { $regex: String(value || ''), $options: 'i' };
            break;
        case 'exists':
            query[field] = { ...(query[field] || {}), $exists: Boolean(normalized) };
            break;
        default:
            break;
    }
};

const buildMongoFilter = (filters = []) => {
    const query = {};
    filters.forEach(filter => {
        if (!filter?.field || !filter?.operator || isSensitiveField(filter.field)) return;
        appendFilterCondition(query, filter.field, filter.operator, filter.value);
    });
    return query;
};

const clampLimit = (limit, fallback, max) => {
    const parsed = parseInt(limit, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
};

const normalizeProjection = (fields = []) => {
    const projection = {};
    fields.forEach(field => {
        if (!field || isSensitiveField(field)) return;
        projection[field] = 1;
    });
    return projection;
};

const buildSort = (sortBy, sortOrder = 'desc') => {
    if (!sortBy || isSensitiveField(sortBy)) return { createdAt: -1 };
    return { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
};

const buildGroupExpression = (groupBy, groupByType = 'field') => {
    if (!groupBy) return null;
    if (groupByType === 'day') {
        return { $dateToString: { format: '%Y-%m-%d', date: `$${groupBy}` } };
    }
    if (groupByType === 'week') {
        return { $dateToString: { format: '%G-W%V', date: `$${groupBy}` } };
    }
    if (groupByType === 'month') {
        return { $dateToString: { format: '%Y-%m', date: `$${groupBy}` } };
    }
    return `$${groupBy}`;
};

const normalizeMetrics = (metrics = []) => {
    if (!Array.isArray(metrics) || metrics.length === 0) {
        return [{ name: 'count', op: 'count' }];
    }

    return metrics
        .filter(metric => metric?.op)
        .slice(0, 5)
        .map((metric, index) => ({
            name: metric.name || `${metric.op}_${metric.field || index + 1}`,
            op: metric.op,
            field: metric.field
        }));
};

const buildAggregateMetricExpressions = (metrics) => {
    const expressions = {};
    metrics.forEach(metric => {
        if (metric.op === 'count') {
            expressions[metric.name] = { $sum: 1 };
            return;
        }

        if (!metric.field || isSensitiveField(metric.field)) return;
        const fieldExpr = `$${metric.field}`;
        if (metric.op === 'sum') expressions[metric.name] = { $sum: fieldExpr };
        if (metric.op === 'avg') expressions[metric.name] = { $avg: fieldExpr };
        if (metric.op === 'min') expressions[metric.name] = { $min: fieldExpr };
        if (metric.op === 'max') expressions[metric.name] = { $max: fieldExpr };
    });
    return expressions;
};

const shouldForceToolUse = (message = '') => {
    const normalized = String(message).toLowerCase();
    return /(revenue|user|users|booking|bookings|ride|rides|safety|report|reports|growth|trend|finance|financial|audit|driver|rider|review|reviews|route|demand|alert|emergency|sql|query|database|analytics|overview|health|platform)/.test(normalized);
};

const extractResponseParts = (response) =>
    response?.candidates?.[0]?.content?.parts || [];

const extractFunctionCalls = (response) => {
    if (Array.isArray(response?.functionCalls) && response.functionCalls.length > 0) {
        return response.functionCalls.map(call => ({ functionCall: call }));
    }
    return extractResponseParts(response).filter(part => part.functionCall);
};

const extractTextFromResponse = (response) =>
    (typeof response?.text === 'string' && response.text) ||
    extractResponseParts(response)
        .filter(part => part.text)
        .map(part => part.text)
        .join('');

const normalizeToolArgs = (args) => {
    if (!args) return {};
    if (typeof args === 'string') {
        try {
            return JSON.parse(args);
        } catch (error) {
            return {};
        }
    }
    return args;
};

const buildModelConfig = (_message, forceToolUse = false) => ({
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    temperature: 0.4,
    maxOutputTokens: 4096,
    ...(forceToolUse ? {
        toolConfig: {
            functionCallingConfig: {
                mode: FunctionCallingConfigMode.ANY,
                allowedFunctionNames: TOOL_NAMES
            }
        }
    } : {})
});

const persistSessionTurn = (session, userContent, modelText) => {
    session.history.push(userContent);
    session.history.push({ role: 'model', parts: [{ text: modelText }] });

    if (session.history.length > 40) {
        session.history = session.history.slice(-30);
    }
};

const splitTextIntoChunks = (text, maxChunkLength = 140) => {
    if (!text) return [];

    const words = String(text).split(/(\s+)/);
    const chunks = [];
    let current = '';

    words.forEach(word => {
        if ((current + word).length > maxChunkLength && current) {
            chunks.push(current);
            current = word;
            return;
        }
        current += word;
    });

    if (current) chunks.push(current);
    return chunks;
};

const toolExecutors = {
    // 1. Platform Overview
    async get_platform_overview() {
        const now = new Date();
        const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const [
            totalUsers, newUsers30d, newUsers7d,
            totalRides, ridesCompleted, ridesActive,
            totalBookings, bookingsCompleted, bookingsCancelled,
            revenueAgg, activeDrivers
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: d30 } }),
            User.countDocuments({ createdAt: { $gte: d7 } }),
            Ride.countDocuments(),
            Ride.countDocuments({ status: 'COMPLETED' }),
            Ride.countDocuments({ status: { $in: ACTIVE_RIDE_STATUSES } }),
            Booking.countDocuments(),
            Booking.countDocuments({ status: { $in: BOOKING_FINAL_STATUSES } }),
            Booking.countDocuments({ status: 'CANCELLED' }),
            Booking.aggregate([
                { $match: PAYMENT_SUCCESS_MATCH },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$payment.totalAmount', '$payment.amount'] } }, count: { $sum: 1 }, avg: { $avg: { $ifNull: ['$payment.totalAmount', '$payment.amount'] } } } }
            ]),
            User.countDocuments({ role: DRIVER_ROLE, 'statistics.lastRideAt': { $gte: d30 } })
        ]);

        const revenue = revenueAgg[0] || { total: 0, count: 0, avg: 0 };

        return {
            users: { total: totalUsers, new30d: newUsers30d, new7d: newUsers7d },
            rides: { total: totalRides, completed: ridesCompleted, active: ridesActive },
            bookings: { total: totalBookings, completed: bookingsCompleted, cancelled: bookingsCancelled },
            revenue: { total: revenue.total, paidBookings: revenue.count, avgBookingValue: Math.round(revenue.avg || 0) },
            completionRate: totalBookings > 0 ? ((bookingsCompleted / totalBookings) * 100).toFixed(1) + '%' : 'N/A',
            cancellationRate: totalBookings > 0 ? ((bookingsCancelled / totalBookings) * 100).toFixed(1) + '%' : 'N/A',
            activeDrivers30d: activeDrivers
        };
    },

    // 2. Revenue Analytics
    async get_revenue_analytics({ period = '30d' } = {}) {
        const since = periodToDate(period);
        const prevSince = new Date(since.getTime() - (Date.now() - since.getTime()));

        const [currentRevenue, prevRevenue, refundAgg, recentDailyRevenue] = await Promise.all([
            Booking.aggregate([
                { $match: { ...PAYMENT_SUCCESS_MATCH, createdAt: { $gte: since } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$payment.totalAmount', '$payment.amount'] } }, count: { $sum: 1 }, avg: { $avg: { $ifNull: ['$payment.totalAmount', '$payment.amount'] } } } }
            ]),
            Booking.aggregate([
                { $match: { ...PAYMENT_SUCCESS_MATCH, createdAt: { $gte: prevSince, $lt: since } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$payment.totalAmount', '$payment.amount'] } }, count: { $sum: 1 } } }
            ]),
            Booking.aggregate([
                { $match: { 'payment.status': 'REFUNDED', updatedAt: { $gte: since } } },
                { $group: { _id: null, total: { $sum: '$payment.refundAmount' }, count: { $sum: 1 } } }
            ]),
            Booking.aggregate([
                { $match: { ...PAYMENT_SUCCESS_MATCH, createdAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: { $ifNull: ['$payment.totalAmount', '$payment.amount'] } }, bookings: { $sum: 1 } } },
                { $sort: { _id: -1 } },
                { $limit: 14 }
            ])
        ]);

        const curr = currentRevenue[0] || { total: 0, count: 0, avg: 0 };
        const prev = prevRevenue[0] || { total: 0, count: 0 };
        const refunds = refundAgg[0] || { total: 0, count: 0 };
        const growthPct = prev.total > 0 ? (((curr.total - prev.total) / prev.total) * 100).toFixed(1) : 'N/A';

        return {
            period,
            currentPeriod: { revenue: curr.total, bookings: curr.count, avgValue: Math.round(curr.avg || 0) },
            previousPeriod: { revenue: prev.total, bookings: prev.count },
            growth: growthPct + (growthPct !== 'N/A' ? '%' : ''),
            refunds: { total: refunds.total, count: refunds.count },
            recentDailyRevenue: recentDailyRevenue.reverse()
        };
    },

    // 3. User Analytics
    async get_user_analytics({ period = '30d' } = {}) {
        const since = periodToDate(period);

        const [
            byRole, byStatus, newUsers, verificationStatus, trustDistribution
        ] = await Promise.all([
            User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
            User.aggregate([{ $group: { _id: '$accountStatus', count: { $sum: 1 } } }]),
            User.countDocuments({ createdAt: { $gte: since } }),
            User.aggregate([
                { $group: { _id: '$verificationStatus', count: { $sum: 1 } } }
            ]),
            User.aggregate([
                { $bucket: {
                    groupBy: '$trustScore.score',
                    boundaries: [0, 20, 40, 60, 80, 101],
                    default: 'unknown',
                    output: { count: { $sum: 1 }, avgScore: { $avg: '$trustScore.score' } }
                }}
            ])
        ]);

        const trustLabels = { 0: 'NEWCOMER (0-19)', 20: 'REGULAR (20-39)', 40: 'EXPERIENCED (40-59)', 60: 'AMBASSADOR (60-79)', 80: 'EXPERT (80-100)' };

        return {
            period,
            totalByRole: Object.fromEntries(byRole.map(r => [r._id || 'USER', r.count])),
            accountStatus: Object.fromEntries(byStatus.map(s => [s._id || 'ACTIVE', s.count])),
            newSignups: newUsers,
            verificationStatus: Object.fromEntries(verificationStatus.map(v => [v._id || 'NONE', v.count])),
            trustScoreDistribution: trustDistribution.map(b => ({
                range: trustLabels[b._id] || `Score ${b._id}+`,
                count: b.count,
                avgScore: Math.round(b.avgScore || 0)
            }))
        };
    },

    // 4. Ride Analytics
    async get_ride_analytics({ period = '30d' } = {}) {
        const since = periodToDate(period);

        const [byStatus, recentRides, popularRoutes] = await Promise.all([
            Ride.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Ride.countDocuments({ createdAt: { $gte: since } }),
            Ride.aggregate([
                { $match: { status: 'COMPLETED' } },
                { $group: {
                    _id: {
                        from: { $ifNull: ['$route.start.city', { $arrayElemAt: [{ $split: [{ $ifNull: ['$route.start.address', 'Unknown'] }, ','] }, 0] }] },
                        to: { $ifNull: ['$route.destination.city', { $arrayElemAt: [{ $split: [{ $ifNull: ['$route.destination.address', 'Unknown'] }, ','] }, 0] }] }
                    },
                    count: { $sum: 1 }
                }},
                { $sort: { count: -1 } },
                { $limit: 10 }
            ])
        ]);

        return {
            period,
            ridesByStatus: Object.fromEntries(byStatus.map(s => [s._id, s.count])),
            totalRidesInPeriod: recentRides,
            popularRoutes: popularRoutes.map(r => ({
                from: r._id.from,
                to: r._id.to,
                tripCount: r.count
            }))
        };
    },

    // 5. Booking Analytics
    async get_booking_analytics({ period = '30d' } = {}) {
        const since = periodToDate(period);

        const [byStatus, avgAcceptTime, cancellationReasons] = await Promise.all([
            Booking.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Booking.aggregate([
                { $match: { createdAt: { $gte: since }, 'riderResponse.responseTime': { $gt: 0 } } },
                { $group: { _id: null, avgMinutes: { $avg: '$riderResponse.responseTime' } } }
            ]),
            Booking.aggregate([
                { $match: { status: 'CANCELLED', createdAt: { $gte: since } } },
                { $group: { _id: '$cancellation.reason', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ])
        ]);

        const statusMap = Object.fromEntries(byStatus.map(s => [s._id, s.count]));
        const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
        const completed = (statusMap.COMPLETED || 0) + (statusMap.DROPPED_OFF || 0);
        const cancelled = statusMap.CANCELLED || 0;

        return {
            period,
            bookingsByStatus: statusMap,
            totalBookings: total,
            completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) + '%' : 'N/A',
            cancellationRate: total > 0 ? ((cancelled / total) * 100).toFixed(1) + '%' : 'N/A',
            avgAcceptTimeMinutes: avgAcceptTime[0]?.avgMinutes?.toFixed(1) || 'N/A',
            topCancellationReasons: cancellationReasons.map(r => ({ reason: r._id || 'Not specified', count: r.count }))
        };
    },

    // 6. Safety Report
    async get_safety_report({ period = '30d' } = {}) {
        const since = periodToDate(period);

        const [
            reportsByStatus, reportsByCategory, reportsBySeverity,
            suspendedUsers, bannedUsers, emergencies, avgTrustScore
        ] = await Promise.all([
            Report.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Report.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Report.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]),
            User.countDocuments({ accountStatus: 'SUSPENDED' }),
            User.countDocuments({ accountStatus: 'DELETED' }),
            Emergency.countDocuments({ status: { $in: OPEN_EMERGENCY_STATUSES }, createdAt: { $gte: since } }).catch(() => 0),
            User.aggregate([{ $group: { _id: null, avg: { $avg: '$trustScore.score' } } }])
        ]);

        return {
            period,
            reportsByStatus: Object.fromEntries(reportsByStatus.map(s => [s._id, s.count])),
            reportsByCategory: reportsByCategory.map(c => ({ category: c._id, count: c.count })),
            reportsBySeverity: Object.fromEntries(reportsBySeverity.map(s => [s._id, s.count])),
            currentSuspendedUsers: suspendedUsers,
            currentBannedUsers: bannedUsers,
            emergencyAlerts: emergencies,
            platformAvgTrustScore: Math.round(avgTrustScore[0]?.avg || 50)
        };
    },

    // 7. Driver Performance
    async get_driver_performance({ limit = 10 } = {}) {
        const [topByRating, mostActive, lowTrust] = await Promise.all([
            User.find({ role: DRIVER_ROLE, 'statistics.totalRidesPosted': { $gt: 0 } })
                .sort({ 'rating.overall': -1, 'statistics.totalRidesPosted': -1 })
                .limit(limit)
                .select('profile rating.overall rating.totalRatings statistics.totalRidesPosted statistics.totalPassengersCarried trustScore.score')
                .lean(),
            User.find({ role: DRIVER_ROLE })
                .sort({ 'statistics.totalRidesPosted': -1, 'statistics.completedRides': -1 })
                .limit(limit)
                .select('profile rating.overall statistics.totalRidesPosted statistics.completedRides statistics.totalPassengersCarried')
                .lean(),
            User.find({ role: DRIVER_ROLE, 'trustScore.score': { $lt: 40 } })
                .sort({ 'trustScore.score': 1 })
                .limit(limit)
                .select('profile trustScore rating.overall statistics.totalRidesPosted accountStatus')
                .lean()
        ]);

        const formatUser = u => ({
            name: toName(u.profile),
            rating: u.rating?.overall?.toFixed(1) || 'N/A',
            totalRides: u.statistics?.totalRidesPosted || 0,
            passengers: u.statistics?.totalPassengersCarried || 0,
            trustScore: u.trustScore?.score || 50,
            id: u._id
        });

        return {
            topRatedDrivers: topByRating.map(formatUser),
            mostActiveDrivers: mostActive.map(formatUser),
            lowTrustDrivers: lowTrust.map(formatUser)
        };
    },

    // 8. Financial Details
    async get_financial_details({ period = '30d' } = {}) {
        const since = periodToDate(period);

        const [paymentMethods, revenueByDay, totalRefunds, pendingPayouts] = await Promise.all([
            Booking.aggregate([
                { $match: { ...PAYMENT_SUCCESS_MATCH, createdAt: { $gte: since } } },
                { $group: { _id: '$payment.method', count: { $sum: 1 }, total: { $sum: { $ifNull: ['$payment.totalAmount', '$payment.amount'] } } } },
                { $sort: { total: -1 } }
            ]),
            Booking.aggregate([
                { $match: { ...PAYMENT_SUCCESS_MATCH, createdAt: { $gte: since } } },
                { $project: { dayOfWeek: { $dayOfWeek: '$createdAt' }, amount: { $ifNull: ['$payment.totalAmount', '$payment.amount'] } } },
                { $group: { _id: '$dayOfWeek', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            Booking.aggregate([
                { $match: { 'payment.status': 'REFUNDED', updatedAt: { $gte: since } } },
                { $group: { _id: null, total: { $sum: '$payment.refundAmount' }, count: { $sum: 1 }, avg: { $avg: '$payment.refundAmount' } } }
            ]),
            Transaction.aggregate([
                { $match: { createdAt: { $gte: since }, 'riderPayout.settled': false } },
                { $group: { _id: null, total: { $sum: '$riderPayout.amount' }, count: { $sum: 1 } } }
            ])
        ]);

        const dayNames = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const refunds = totalRefunds[0] || { total: 0, count: 0, avg: 0 };
        const payouts = pendingPayouts[0] || { total: 0, count: 0 };

        return {
            period,
            paymentMethods: paymentMethods.map(p => ({ method: p._id || 'Unknown', bookings: p.count, revenue: p.total })),
            revenueByDayOfWeek: revenueByDay.map(d => ({ day: dayNames[d._id] || d._id, revenue: d.revenue, bookings: d.count })),
            refundSummary: { totalAmount: refunds.total, count: refunds.count, avgAmount: Math.round(refunds.avg || 0) },
            pendingRiderPayouts: { totalAmount: payouts.total, count: payouts.count }
        };
    },

    // 9. Real-time Activity
    async get_real_time_activity() {
        const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

        const [
            activeRides, pendingBookings, pendingReports,
            pendingVerifications, recentEmergencies, recentlyActiveUsers
        ] = await Promise.all([
            Ride.countDocuments({ status: 'IN_PROGRESS' }),
            Booking.countDocuments({ status: 'PENDING' }),
            Report.countDocuments({ status: { $in: OPEN_REPORT_STATUSES } }),
            User.countDocuments({ verificationStatus: { $in: ['PENDING', 'DOCUMENTS_REQUESTED'] } }),
            Emergency.countDocuments({ status: { $in: OPEN_EMERGENCY_STATUSES } }).catch(() => 0),
            User.countDocuments({ lastLogin: { $gte: fifteenMinAgo } })
        ]);

        return {
            timestamp: new Date().toISOString(),
            ridesInProgress: activeRides,
            pendingBookings,
            unresolvedReports: pendingReports,
            pendingVerifications,
            activeEmergencies: recentEmergencies,
            usersSeenLast15Minutes: recentlyActiveUsers
        };
    },

    // 10. Search Users
    async search_users({ query, role, accountStatus, limit = 10 } = {}) {
        const filter = {};
        if (role) filter.role = role;
        if (accountStatus) filter.accountStatus = accountStatus;
        if (query) {
            const regex = new RegExp(query, 'i');
            filter.$or = [
                { 'profile.firstName': regex },
                { 'profile.lastName': regex },
                { email: regex },
                { phone: regex }
            ];
        }

        const users = await User.find(filter)
            .select('profile email phone role accountStatus trustScore rating statistics createdAt')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return {
            count: users.length,
            users: users.map(u => ({
                id: u._id,
                name: `${u.profile?.firstName || ''} ${u.profile?.lastName || ''}`.trim() || 'Unknown',
                email: u.email,
                phone: u.phone,
                role: u.role,
                accountStatus: u.accountStatus || 'ACTIVE',
                trustScore: u.trustScore?.score || 50,
                trustLevel: u.trustScore?.level || 'REGULAR',
                totalRides: (u.statistics?.totalRidesPosted || 0) + (u.statistics?.totalRidesTaken || 0),
                rating: u.rating?.overall?.toFixed(1) || 'N/A',
                joinedAt: u.createdAt
            }))
        };
    },

    // 11. User Deep Dive
    async get_user_deep_dive({ userId }) {
        const rawUser = await User.findById(userId)
            .select('-password -__v')
            .lean();

        if (!rawUser) return { error: 'User not found' };

        const user = sanitizeDocument(rawUser);

        const [rideCount, bookingStats, reportsFiled, reportsReceived, reviewStats] = await Promise.all([
            Ride.countDocuments({ rider: userId }),
            Booking.aggregate([
                { $match: { $or: [{ passenger: user._id }, { rider: user._id }] } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Report.countDocuments({ reporter: userId }),
            Report.countDocuments({ reportedUser: userId }),
            Review.aggregate([
                { $match: { reviewee: user._id } },
                { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
            ])
        ]);

        const reviews = reviewStats[0] || { avg: 0, count: 0 };

        return {
            profile: {
                name: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
                email: user.email,
                phone: user.phone,
                role: user.role,
                joinedAt: user.createdAt,
                lastLogin: user.lastLogin
            },
            accountStatus: user.accountStatus || 'ACTIVE',
            trustScore: user.trustScore || { score: 50, level: 'REGULAR' },
            statistics: user.statistics || {},
            rideCount,
            bookingsByStatus: Object.fromEntries(bookingStats.map(s => [s._id, s.count])),
            reportsFiled,
            reportsReceivedAgainst: reportsReceived,
            reviews: { averageRating: reviews.avg?.toFixed(1) || 'N/A', totalReviews: reviews.count },
            isSuspended: user.isSuspended || false,
            suspensionReason: user.suspensionReason,
            accountStatusHistory: (user.accountStatusHistory || []).slice(-5)
        };
    },

    // 12. Reports Overview
    async get_reports_overview({ status, severity, limit = 20 } = {}) {
        const filter = {};
        if (status) filter.status = status;
        if (severity) filter.severity = severity;

        const reports = await Report.find(filter)
            .populate('reporter', 'profile email')
            .populate('reportedUser', 'profile email trustScore')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return {
            count: reports.length,
            reports: reports.map(r => ({
                id: r._id,
                category: r.category,
                severity: r.severity,
                status: r.status,
                reporter: r.reporter ? `${r.reporter.profile?.firstName || ''} ${r.reporter.profile?.lastName || ''}`.trim() : 'Unknown',
                reportedUser: r.reportedUser ? `${r.reportedUser.profile?.firstName || ''} ${r.reportedUser.profile?.lastName || ''}`.trim() : 'Unknown',
                reportedUserTrust: r.reportedUser?.trustScore?.score || 'N/A',
                description: r.description?.substring(0, 100) + (r.description?.length > 100 ? '...' : ''),
                refundRequested: r.refundRequested,
                createdAt: r.createdAt,
                sla: r.sla
            }))
        };
    },

    // 13. Growth Metrics
    async get_growth_metrics({ period = '30d' } = {}) {
        const days = parseInt(period) || 30;
        const now = new Date();
        const currentStart = new Date(now - days * 24 * 60 * 60 * 1000);
        const prevStart = new Date(currentStart - days * 24 * 60 * 60 * 1000);

        const [
            currUsers, prevUsers, currRides, prevRides,
            currBookings, prevBookings, currRevAgg, prevRevAgg
        ] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: currentStart } }),
            User.countDocuments({ createdAt: { $gte: prevStart, $lt: currentStart } }),
            Ride.countDocuments({ createdAt: { $gte: currentStart } }),
            Ride.countDocuments({ createdAt: { $gte: prevStart, $lt: currentStart } }),
            Booking.countDocuments({ createdAt: { $gte: currentStart } }),
            Booking.countDocuments({ createdAt: { $gte: prevStart, $lt: currentStart } }),
            Booking.aggregate([
                { $match: { ...PAYMENT_SUCCESS_MATCH, createdAt: { $gte: currentStart } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$payment.totalAmount', '$payment.amount'] } } } }
            ]),
            Booking.aggregate([
                { $match: { ...PAYMENT_SUCCESS_MATCH, createdAt: { $gte: prevStart, $lt: currentStart } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$payment.totalAmount', '$payment.amount'] } } } }
            ])
        ]);

        const calcGrowth = (curr, prev) => prev > 0 ? (((curr - prev) / prev) * 100).toFixed(1) + '%' : (curr > 0 ? '+∞' : '0%');
        const currRev = currRevAgg[0]?.total || 0;
        const prevRev = prevRevAgg[0]?.total || 0;

        return {
            period: `${days}d vs previous ${days}d`,
            userGrowth: { current: currUsers, previous: prevUsers, growth: calcGrowth(currUsers, prevUsers) },
            rideGrowth: { current: currRides, previous: prevRides, growth: calcGrowth(currRides, prevRides) },
            bookingGrowth: { current: currBookings, previous: prevBookings, growth: calcGrowth(currBookings, prevBookings) },
            revenueGrowth: { current: currRev, previous: prevRev, growth: calcGrowth(currRev, prevRev) }
        };
    },

    // 14. Review Analytics
    async get_review_analytics({ period = '30d' } = {}) {
        const since = periodToDate(period);

        const [ratingDist, avgRating, recentNegative, totalReviews] = await Promise.all([
            Review.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: '$rating', count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            Review.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
            ]),
            Review.find({ rating: { $lte: 2 }, createdAt: { $gte: since } })
                .populate('reviewer', 'profile')
                .populate('reviewee', 'profile')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            Review.countDocuments()
        ]);

        const avg = avgRating[0] || { avg: 0, count: 0 };

        return {
            period,
            averageRating: avg.avg?.toFixed(2) || 'N/A',
            totalReviewsInPeriod: avg.count,
            totalReviewsAllTime: totalReviews,
            ratingDistribution: Object.fromEntries(ratingDist.map(r => [`${r._id}_star`, r.count])),
            recentNegativeReviews: recentNegative.map(r => ({
                rating: r.rating,
                comment: r.comment?.substring(0, 120) || 'No comment',
                reviewer: `${r.reviewer?.profile?.firstName || ''} ${r.reviewer?.profile?.lastName || ''}`.trim(),
                reviewee: `${r.reviewee?.profile?.firstName || ''} ${r.reviewee?.profile?.lastName || ''}`.trim(),
                date: r.createdAt
            }))
        };
    },

    // 15. Route Demand Analysis
    async get_route_demand_analysis({ limit = 15 } = {}) {
        const [popularRoutes, peakHours, unmetSearches, activeAlerts] = await Promise.all([
            Ride.aggregate([
            { $match: { status: { $in: ['COMPLETED', 'ACTIVE', 'IN_PROGRESS'] } } },
            { $group: {
                _id: {
                    from: { $ifNull: ['$route.start.city', { $arrayElemAt: [{ $split: [{ $ifNull: ['$route.start.address', 'Unknown'] }, ','] }, 0] }] },
                    to: { $ifNull: ['$route.destination.city', { $arrayElemAt: [{ $split: [{ $ifNull: ['$route.destination.address', 'Unknown'] }, ','] }, 0] }] }
                },
                totalRides: { $sum: 1 },
                avgSeats: { $avg: '$pricing.totalSeats' }
            }},
            { $sort: { totalRides: -1 } },
            { $limit: limit }
        ]),
            Ride.aggregate([
            { $project: { hour: { $hour: '$schedule.departureDateTime' } } },
            { $group: { _id: '$hour', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]),
            SearchLog.aggregate([
            { $match: { resultsCount: 0 } },
            { $group: {
                _id: {
                    from: '$searchParams.origin.address',
                    to: '$searchParams.destination.address'
                },
                searches: { $sum: 1 }
            }},
            { $sort: { searches: -1 } },
            { $limit: Math.min(limit, 10) }
        ]),
            RouteAlert.aggregate([
            { $match: { active: true, expiresAt: { $gt: new Date() } } },
            { $group: {
                _id: {
                    from: '$origin.address',
                    to: '$destination.address'
                },
                alerts: { $sum: 1 }
            }},
            { $sort: { alerts: -1 } },
            { $limit: Math.min(limit, 10) }
        ])
        ]);

        return {
            topRoutes: popularRoutes.map(r => ({
                from: r._id.from,
                to: r._id.to,
                totalRides: r.totalRides,
                avgSeatsOffered: r.avgSeats?.toFixed(1) || 'N/A'
            })),
            peakDepartureHours: peakHours.map(h => ({ hour: `${h._id}:00`, rides: h.count })),
            unmetDemandRoutes: unmetSearches.map(route => ({
                from: route._id.from || 'Unknown',
                to: route._id.to || 'Unknown',
                zeroResultSearches: route.searches
            })),
            activeRouteAlerts: activeAlerts.map(route => ({
                from: route._id.from || 'Unknown',
                to: route._id.to || 'Unknown',
                alerts: route.alerts
            }))
        };
    },

    // 16. Data Catalog
    async get_data_catalog() {
        const collectionEntries = Object.entries(COLLECTION_MODELS);
        const counts = await Promise.all(
            collectionEntries.map(([, Model]) =>
                Model.countDocuments().catch(() => null)
            )
        );

        return {
            collections: collectionEntries.map(([name], index) => ({
                name,
                description: COLLECTION_DESCRIPTIONS[name] || 'LoopLane operational dataset',
                estimatedRecords: counts[index],
                keyFields: COLLECTION_FIELD_HINTS[name] || []
            })),
            importantEnums: {
                userRoles: USER_ROLES,
                bookingStatuses: BOOKING_STATUSES,
                bookingPaymentStatuses: ['PENDING', 'PAID', 'PAYMENT_CONFIRMED', 'REFUNDED', 'FAILED'],
                rideStatuses: RIDE_STATUSES,
                reportStatuses: REPORT_STATUSES,
                emergencyStatuses: EMERGENCY_STATUSES,
                routeDeviationStatuses: ['ACTIVE', 'RETURNED_TO_ROUTE', 'RESOLVED', 'ESCALATED']
            },
            guidance: [
                'Use query_records for row-level investigation with filters, selected fields, sorting, and limits.',
                'Use aggregate_records for grouped counts and metrics such as SUM, AVG, MIN, and MAX.',
                'Sensitive fields like passwords, tokens, and payment gateway identifiers are automatically excluded.'
            ]
        };
    },

    // 17. Query Records
    async query_records({ collection, filters = [], fields = [], sortBy, sortOrder = 'desc', limit = 10 } = {}) {
        const Model = COLLECTION_MODELS[collection];
        if (!Model) {
            return { error: `Unsupported collection: ${collection}` };
        }

        const query = buildMongoFilter(filters);
        const projection = normalizeProjection(fields);
        const appliedLimit = clampLimit(limit, 10, 50);
        const sort = buildSort(sortBy, sortOrder);
        const findProjection = Object.keys(projection).length > 0 ? projection : undefined;

        const [totalMatching, records] = await Promise.all([
            Model.countDocuments(query),
            Model.find(query, findProjection).sort(sort).limit(appliedLimit).lean()
        ]);

        return {
            collection,
            totalMatching,
            returned: records.length,
            filtersApplied: sanitizeDocument(query),
            fieldsReturned: findProjection ? Object.keys(findProjection) : 'all_non_sensitive_fields',
            sortApplied: sort,
            records: sanitizeDocument(records)
        };
    },

    // 18. Aggregate Records
    async aggregate_records({ collection, filters = [], groupBy, groupByType = 'field', metrics = [], sortBy, sortOrder = 'desc', limit = 20 } = {}) {
        const Model = COLLECTION_MODELS[collection];
        if (!Model) {
            return { error: `Unsupported collection: ${collection}` };
        }

        if (groupBy && isSensitiveField(groupBy)) {
            return { error: `Grouping by sensitive field is not allowed: ${groupBy}` };
        }

        if (!groupBy && groupByType !== 'field') {
            return { error: 'groupBy is required when groupByType is day, week, or month' };
        }

        const query = buildMongoFilter(filters);
        let normalizedMetrics = normalizeMetrics(metrics);
        const metricExpressions = buildAggregateMetricExpressions(normalizedMetrics);
        if (Object.keys(metricExpressions).length === 0) {
            normalizedMetrics = [{ name: 'count', op: 'count' }];
            metricExpressions.count = { $sum: 1 };
        }
        const appliedLimit = clampLimit(limit, 20, 100);
        const groupExpression = buildGroupExpression(groupBy, groupByType);
        const projectStage = groupExpression
            ? { $project: Object.fromEntries([['group', '$_id'], ...Object.keys(metricExpressions).map(name => [name, 1]), ['_id', 0]]) }
            : { $project: Object.fromEntries([...Object.keys(metricExpressions).map(name => [name, 1]), ['_id', 0]]) };
        const sortKey = sortBy || (groupExpression ? 'group' : normalizedMetrics[0]?.name || 'count');
        const safeSortKey = isSensitiveField(sortKey) ? (groupExpression ? 'group' : normalizedMetrics[0]?.name || 'count') : sortKey;

        const pipeline = [
            { $match: query },
            { $group: { _id: groupExpression || null, ...metricExpressions } },
            projectStage,
            { $sort: { [safeSortKey]: sortOrder === 'asc' ? 1 : -1 } },
            { $limit: appliedLimit }
        ];

        const rows = await Model.aggregate(pipeline);

        return {
            collection,
            filtersApplied: sanitizeDocument(query),
            groupBy: groupExpression ? { field: groupBy, type: groupByType } : null,
            metrics: normalizedMetrics,
            returned: rows.length,
            rows: sanitizeDocument(rows)
        };
    },

    // 19. Audit Trail
    async get_audit_trail({ limit = 20 } = {}) {
        const logs = await AuditLog.find()
            .populate('actor', 'profile email role')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return {
            count: logs.length,
            entries: logs.map(l => ({
                action: l.action,
                entity: l.targetType,
                entityId: l.targetId,
                performedBy: l.actor
                    ? `${toName(l.actor.profile)} (${l.actor.role})`
                    : 'System',
                details: l.description || (l.changes ? JSON.stringify(l.changes).substring(0, 150) : null),
                timestamp: l.createdAt
            }))
        };
    }
};


// ─── Agent Execution Engine ──────────────────────────────────────────────────

/**
 * Execute a single tool call and return its result
 */
async function executeTool(functionCall) {
    const { name } = functionCall;
    const args = normalizeToolArgs(functionCall.args);
    const executor = toolExecutors[name];

    if (!executor) {
        return { error: `Unknown tool: ${name}` };
    }

    try {
        console.log(`🔧 [AI Agent] Executing tool: ${name}`, args || '');
        const startTime = Date.now();
        const result = await executor(args || {});
        const duration = Date.now() - startTime;
        console.log(`✅ [AI Agent] Tool ${name} completed in ${duration}ms`);
        return result;
    } catch (error) {
        console.error(`❌ [AI Agent] Tool ${name} failed:`, error.message);
        return { error: `Tool execution failed: ${error.message}` };
    }
}

async function runAgentConversation(adminId, message, onToolCall) {
    const session = getOrCreateSession(adminId);
    const toolsUsed = [];
    const userContent = { role: 'user', parts: [{ text: message }] };
    const contents = [...session.history, userContent];
    const maxIterations = 8;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        try {
            const response = await ai.models.generateContent({
                model: MODEL,
                contents,
                config: buildModelConfig(message, iteration === 0 && shouldForceToolUse(message))
            });

            const functionCalls = extractFunctionCalls(response).map(part => part.functionCall || part);

            if (functionCalls.length > 0) {
                const modelToolCallContent = response.candidates?.[0]?.content || {
                    role: 'model',
                    parts: functionCalls.map(functionCall => ({ functionCall }))
                };
                contents.push(modelToolCallContent);

                const functionResponses = [];
                for (const functionCall of functionCalls) {
                    toolsUsed.push(functionCall.name);
                    if (onToolCall) onToolCall(functionCall.name);
                    const result = await executeTool(functionCall);
                    functionResponses.push({
                        functionResponse: {
                            name: functionCall.name,
                            response: { result }
                        }
                    });
                }

                contents.push({ role: 'user', parts: functionResponses });
                continue;
            }

            const finalText = extractTextFromResponse(response).trim();
            if (finalText) {
                persistSessionTurn(session, userContent, finalText);
                return {
                    response: finalText,
                    toolsUsed: [...new Set(toolsUsed)],
                    thinking: false
                };
            }

            break;
        } catch (error) {
            console.error(`❌ [AI Agent] Iteration ${iteration + 1} error:`, error.message);

            if (error.message?.includes('quota') || error.message?.includes('429')) {
                return {
                    response: '⚠️ AI rate limit reached. Please wait a moment and try again.',
                    toolsUsed: [...new Set(toolsUsed)],
                    thinking: false
                };
            }

            return {
                response: `I encountered an issue while analyzing your request. Error: ${error.message}\n\nPlease try rephrasing your question or try again in a moment.`,
                toolsUsed: [...new Set(toolsUsed)],
                thinking: false
            };
        }
    }

    return {
        response: 'I could not complete the analysis within the allowed tool-calling depth. Ask a more specific question or narrow the scope.',
        toolsUsed: [...new Set(toolsUsed)],
        thinking: false
    };
}

/**
 * Run the AI agent chat — handles multi-turn conversation with function calling loop
 * @param {string} adminId - Admin user ID for session management
 * @param {string} message - User's message
 * @returns {Promise<{response: string, toolsUsed: string[], thinking: boolean}>}
 */
async function chat(adminId, message) {
    if (!ai) {
        return {
            response: '⚠️ AI features are unavailable — GEMINI_API_KEY is not configured. Please add it to your environment variables.',
            toolsUsed: [],
            thinking: false
        };
    }
    return runAgentConversation(adminId, message);
}


/**
 * Stream version of chat — yields chunks as they come
 * @param {string} adminId
 * @param {string} message
 * @param {function} onToolCall - Callback when a tool is being called
 * @returns {AsyncGenerator<string>}
 */
async function* chatStream(adminId, message, onToolCall) {
    if (!ai) {
        yield '⚠️ AI features are unavailable — GEMINI_API_KEY is not configured.';
        return;
    }
    const result = await runAgentConversation(adminId, message, onToolCall);
    const chunks = splitTextIntoChunks(result.response);

    for (const chunk of chunks) {
        yield chunk;
    }
}


// ─── Suggested Questions ─────────────────────────────────────────────────────
const SUGGESTED_QUESTIONS = [
    { icon: '📊', text: 'Give me a complete platform health report', category: 'overview' },
    { icon: '📈', text: 'How is our revenue trending this month vs last?', category: 'revenue' },
    { icon: '👥', text: 'Show me user growth and signup trends', category: 'users' },
    { icon: '🚗', text: 'What are the most popular routes?', category: 'rides' },
    { icon: '🎯', text: 'Analyze our booking conversion funnel', category: 'bookings' },
    { icon: '🛡️', text: 'Give me a safety and trust overview', category: 'safety' },
    { icon: '⭐', text: 'How are our driver ratings and performance?', category: 'drivers' },
    { icon: '💰', text: 'Break down our financial health — refunds, payments, revenue by day', category: 'finance' },
    { icon: '🔴', text: 'What needs my immediate attention right now?', category: 'urgent' },
    { icon: '📉', text: 'Are there any concerning trends I should know about?', category: 'trends' },
    { icon: '🔍', text: 'Show me all pending and escalated reports', category: 'reports' },
    { icon: '🏆', text: 'Who are our top performing and worst performing drivers?', category: 'performance' }
];


module.exports = {
    chat,
    chatStream,
    clearSession,
    getOrCreateSession,
    SUGGESTED_QUESTIONS,
    TOOL_DECLARATIONS
};
