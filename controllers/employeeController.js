/**
 * ═══════════════════════════════════════════════════════════════════
 *  ENTERPRISE EMPLOYEE MANAGEMENT CONTROLLER — Geo-Coordinate-First
 *  LoopLane Admin — Full CRUD, Stats, Hierarchy, Activity, Onboarding
 *
 *  All locations use real [lng, lat] coordinates.
 *  City, zone, office auto-derived via serviceAreas.js utility.
 *  Cross-area rides/assignments handled natively.
 * ═══════════════════════════════════════════════════════════════════
 */

const User = require('../models/User');
const Ride = require('../models/Ride');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('express-async-handler');
const {
    SERVICE_AREAS, AREA_NAMES, AREA_KEYS,
    isValidCoordinates, detectServiceArea, getNearestServiceArea,
    resolveEmployeeLocation, classifyRide, haversineKm,
    areaKeyFromName, getAreaCenter, getHexVisualizationData, getServiceAreasMeta,
} = require('../utils/serviceAreas');
const { coordsToHex, hexToCoords, hexFillBBox, RES, zoomToResolution } = require('../utils/hexGrid');

const AppError = require('../utils/helpers').AppError || class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
    }
};

// ─── CONSTANTS ─────────────────────────────────────────────────────

const EMPLOYEE_ROLES = ['SUPPORT_AGENT', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER', 'CONTENT_MODERATOR', 'FLEET_MANAGER'];
const ALL_STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', ...EMPLOYEE_ROLES];

const DEPARTMENTS = [
    'Operations', 'Engineering', 'Customer Support', 'Finance',
    'Safety & Trust', 'Fleet Management', 'Marketing', 'Legal',
    'Human Resources', 'Product', 'Data & Analytics', 'Quality Assurance'
];

const DEPT_CODES = {
    'Operations': 'OPS', 'Engineering': 'ENG', 'Customer Support': 'CSP',
    'Finance': 'FIN', 'Safety & Trust': 'SAF', 'Fleet Management': 'FLT',
    'Marketing': 'MKT', 'Legal': 'LEG', 'Human Resources': 'HR',
    'Product': 'PRD', 'Data & Analytics': 'DAT', 'Quality Assurance': 'QA'
};

const HIERARCHY_LEVELS = {
    1: 'C-Suite', 2: 'Vice President', 3: 'Director',
    4: 'Senior Manager', 5: 'Manager', 6: 'Senior Associate', 7: 'Associate'
};

const PERMISSION_MAP = {
    SUPPORT_AGENT: ['manage_users', 'manage_reports', 'view_bookings', 'view_rides'],
    FINANCE_MANAGER: ['manage_finances', 'view_bookings', 'view_rides', 'manage_payouts'],
    OPERATIONS_MANAGER: ['manage_rides', 'manage_bookings', 'manage_users', 'view_reports'],
    CONTENT_MODERATOR: ['manage_reports', 'manage_reviews', 'view_users'],
    FLEET_MANAGER: ['manage_rides', 'manage_verifications', 'view_users']
};

const ALL_PERMISSIONS = [
    { key: 'manage_users', label: 'Manage Users', group: 'User Management', desc: 'Create, edit, suspend user accounts' },
    { key: 'view_users', label: 'View Users', group: 'User Management', desc: 'Read-only access to user data' },
    { key: 'manage_rides', label: 'Manage Rides', group: 'Ride Operations', desc: 'Modify, cancel active rides' },
    { key: 'view_rides', label: 'View Rides', group: 'Ride Operations', desc: 'Read-only access to ride data' },
    { key: 'manage_bookings', label: 'Manage Bookings', group: 'Ride Operations', desc: 'Process refunds, modify bookings' },
    { key: 'view_bookings', label: 'View Bookings', group: 'Ride Operations', desc: 'Read-only access to bookings' },
    { key: 'manage_finances', label: 'Manage Finances', group: 'Financial', desc: 'Access financial data & reports' },
    { key: 'manage_payouts', label: 'Manage Payouts', group: 'Financial', desc: 'Process & approve rider payouts' },
    { key: 'manage_reports', label: 'Manage Reports', group: 'Reports & Safety', desc: 'Review user complaints & issues' },
    { key: 'view_reports', label: 'View Reports', group: 'Reports & Safety', desc: 'Read-only access to reports' },
    { key: 'manage_reviews', label: 'Moderate Reviews', group: 'Reports & Safety', desc: 'Approve/remove user reviews' },
    { key: 'manage_verifications', label: 'Verify Documents', group: 'Fleet', desc: 'Approve/reject driver documents' },
    { key: 'manage_settings', label: 'Platform Settings', group: 'Platform', desc: 'Configure platform settings' },
];


// ═══════════════════════════════════════════════════════════════════
//  GET EMPLOYEE DASHBOARD STATS (with geo-aware ride overlay)
//  GET /api/admin/employees/stats
// ═══════════════════════════════════════════════════════════════════

exports.getEmployeeStats = asyncHandler(async (req, res) => {
    const baseQuery = { role: { $in: ALL_STAFF_ROLES } };

    const [total, byRole, byDept, byAreaKey, byStatus, byType] = await Promise.all([
        User.countDocuments(baseQuery),
        User.aggregate([{ $match: baseQuery }, { $group: { _id: '$role', count: { $sum: 1 } } }]),
        User.aggregate([{ $match: baseQuery }, { $group: { _id: '$employeeDetails.department', count: { $sum: 1 } } }]),
        User.aggregate([{ $match: baseQuery }, { $group: { _id: '$employeeDetails.location.areaKey', count: { $sum: 1 } } }]),
        User.aggregate([{ $match: baseQuery }, { $group: { _id: '$employeeDetails.status', count: { $sum: 1 } } }]),
        User.aggregate([{ $match: baseQuery }, { $group: { _id: '$employeeDetails.employeeType', count: { $sum: 1 } } }]),
    ]);

    const activeCount = await User.countDocuments({
        ...baseQuery,
        'employeeDetails.isActive': { $ne: false },
        $or: [
            { 'employeeDetails.status': 'ACTIVE' },
            { 'employeeDetails.status': { $exists: false } },
            { 'employeeDetails.status': null }
        ]
    });
    const onLeaveCount = await User.countDocuments({ ...baseQuery, 'employeeDetails.status': 'ON_LEAVE' });
    const probationCount = await User.countDocuments({ ...baseQuery, 'employeeDetails.status': 'PROBATION' });
    const noticeCount = await User.countDocuments({ ...baseQuery, 'employeeDetails.status': 'NOTICE_PERIOD' });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const hiresThisMonth = await User.countDocuments({ ...baseQuery, createdAt: { $gte: monthStart } });

    const recentHires = await User.find(baseQuery)
        .sort({ createdAt: -1 }).limit(5)
        .select('profile email role employeeDetails createdAt');

    const recentActivity = await AuditLog.find({ action: { $regex: /^EMPLOYEE_/ } })
        .sort({ createdAt: -1 }).limit(15)
        .populate('actor', 'profile email role');

    const onboardingPending = await User.countDocuments({
        ...baseQuery,
        'employeeDetails.onboarding.completed': { $ne: true },
        'employeeDetails.isActive': { $ne: false }
    });

    // ── Cross-area ride stats (last 30 days) ────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let crossAreaStats = { total: 0, crossArea: 0, topCorridors: [] };
    try {
        const recentRides = await Ride.find({
            status: 'COMPLETED',
            createdAt: { $gte: thirtyDaysAgo }
        }).select('route.start.coordinates route.destination.coordinates route.intermediateStops').limit(5000);

        let crossCount = 0;
        const corridorMap = {};
        for (const ride of recentRides) {
            const startCoords = ride.route?.start?.coordinates;
            const destCoords = ride.route?.destination?.coordinates;
            if (!startCoords || !destCoords) continue;

            const classification = classifyRide(startCoords, destCoords, ride.route?.intermediateStops || []);
            if (classification.isCrossArea) {
                crossCount++;
                const corridor = `${classification.origin?.name || 'Unknown'} → ${classification.destination?.name || 'Unknown'}`;
                corridorMap[corridor] = (corridorMap[corridor] || 0) + 1;
            }
        }
        crossAreaStats = {
            total: recentRides.length,
            crossArea: crossCount,
            crossAreaPct: recentRides.length > 0 ? Math.round((crossCount / recentRides.length) * 100) : 0,
            topCorridors: Object.entries(corridorMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([corridor, count]) => ({ corridor, count }))
        };
    } catch (_) { /* ride data optional */ }

    // ── Build location breakdown (area key → display name + coords) ──
    const byLocation = {};
    for (const item of byAreaKey) {
        const key = item._id;
        const area = SERVICE_AREAS[key];
        if (area) {
            byLocation[area.name] = {
                count: item.count,
                coordinates: area.center,
                zone: area.zone,
                areaKey: key,
            };
        } else if (key) {
            byLocation[key] = { count: item.count, coordinates: null, zone: null, areaKey: key };
        }
    }

    // ── Build per-area live ride count ──
    const ridesByArea = {};
    try {
        const activeRides = await Ride.find({ status: { $in: ['ACTIVE', 'IN_PROGRESS'] } })
            .select('route.start.coordinates route.destination.coordinates').limit(2000);
        for (const ride of activeRides) {
            const startArea = getNearestServiceArea(ride.route?.start?.coordinates);
            if (startArea) ridesByArea[startArea.name] = (ridesByArea[startArea.name] || 0) + 1;
        }
    } catch (_) { /* optional */ }

    res.json({
        success: true,
        stats: {
            total,
            active: activeCount,
            onLeave: onLeaveCount,
            probation: probationCount,
            noticePeriod: noticeCount,
            hiresThisMonth,
            onboardingPending,
            departments: new Set(byDept.map(d => d._id).filter(Boolean)).size,
            locations: new Set(byAreaKey.map(d => d._id).filter(Boolean)).size,
            byRole: Object.fromEntries(byRole.map(r => [r._id, r.count])),
            byDepartment: Object.fromEntries(byDept.filter(d => d._id).map(r => [r._id, r.count])),
            byLocation,
            byStatus: Object.fromEntries(byStatus.map(r => [r._id || 'ACTIVE', r.count])),
            byType: Object.fromEntries(byType.filter(d => d._id).map(r => [r._id, r.count])),
            crossAreaRides: crossAreaStats,
            ridesByArea,
        },
        recentHires,
        recentActivity,
        meta: {
            departments: DEPARTMENTS,
            serviceAreas: getServiceAreasMeta(),
            deptCodes: DEPT_CODES,
            hierarchyLevels: HIERARCHY_LEVELS,
            employeeRoles: EMPLOYEE_ROLES,
            allPermissions: ALL_PERMISSIONS,
            roleDefaults: PERMISSION_MAP,
        }
    });
});


// ═══════════════════════════════════════════════════════════════════
//  LIST EMPLOYEES (enhanced geo-filters, sort, populate hierarchy)
//  GET /api/admin/employees
// ═══════════════════════════════════════════════════════════════════

exports.listEmployees = asyncHandler(async (req, res) => {
    const {
        page = 1, limit = 25, role, search, status,
        department, location, areaKey, employeeType, zone,
        sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query;

    const query = { role: { $in: ALL_STAFF_ROLES } };

    if (role && [...EMPLOYEE_ROLES, 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
        query.role = role;
    }
    if (department) query['employeeDetails.department'] = department;

    // ── Geo-aware location filter ───────────────────────────────
    if (areaKey && SERVICE_AREAS[areaKey]) {
        query['employeeDetails.location.areaKey'] = areaKey;
    } else if (location) {
        // Backward compat: name-based filter → resolve to areaKey
        const key = areaKeyFromName(location);
        if (key) {
            query['employeeDetails.location.areaKey'] = key;
        } else {
            query['employeeDetails.location.city'] = location;
        }
    }
    if (zone) query['employeeDetails.location.zone'] = zone;
    if (employeeType) query['employeeDetails.employeeType'] = employeeType;

    if (status === 'active') {
        query.$and = [
            { 'employeeDetails.isActive': { $ne: false } },
            { $or: [
                { 'employeeDetails.status': 'ACTIVE' },
                { 'employeeDetails.status': { $exists: false } },
                { 'employeeDetails.status': null }
            ]}
        ];
    } else if (status === 'inactive') {
        query['employeeDetails.isActive'] = false;
    } else if (status && status !== 'all') {
        query['employeeDetails.status'] = status.toUpperCase();
    }

    if (search) {
        const searchRegex = { $regex: search, $options: 'i' };
        const searchOr = [
            { 'profile.firstName': searchRegex },
            { 'profile.lastName': searchRegex },
            { email: searchRegex },
            { 'employeeDetails.employeeId': searchRegex },
            { 'employeeDetails.designation': searchRegex },
            { 'employeeDetails.location.city': searchRegex },
            { phone: searchRegex }
        ];
        if (query.$and) {
            query.$and.push({ $or: searchOr });
        } else {
            query.$or = searchOr;
        }
    }

    const sortObj = {};
    const sortField = [
        'createdAt', 'role', 'employeeDetails.department',
        'employeeDetails.location.city', 'employeeDetails.location.areaKey',
        'employeeDetails.hierarchy.level', 'profile.firstName'
    ].includes(sortBy) ? sortBy : 'createdAt';
    sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);

    const employees = await User.find(query)
        .select('profile email phone role employeeDetails createdAt accountStatus statistics')
        .populate('employeeDetails.managedBy', 'profile email employeeDetails.employeeId')
        .populate('employeeDetails.hierarchy.reportsTo', 'profile email role employeeDetails.employeeId employeeDetails.designation')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit));

    res.json({
        success: true,
        employees,
        pagination: {
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            total,
            limit: parseInt(limit)
        }
    });
});


// ═══════════════════════════════════════════════════════════════════
//  GET EMPLOYEE DETAIL (rich: direct reports, area rides, activity)
//  GET /api/admin/employees/:id
// ═══════════════════════════════════════════════════════════════════

exports.getEmployee = asyncHandler(async (req, res) => {
    const employee = await User.findById(req.params.id)
        .select('profile email phone role employeeDetails createdAt accountStatus statistics lastLogin')
        .populate('employeeDetails.managedBy', 'profile email role employeeDetails.employeeId employeeDetails.designation')
        .populate('employeeDetails.hierarchy.reportsTo', 'profile email role employeeDetails.employeeId employeeDetails.designation employeeDetails.department');

    if (!employee) throw new AppError('Employee not found', 404);

    // Direct reports
    const directReports = await User.find({
        $or: [
            { 'employeeDetails.hierarchy.reportsTo': employee._id },
            { 'employeeDetails.managedBy': employee._id }
        ]
    })
    .select('profile email role employeeDetails.employeeId employeeDetails.designation employeeDetails.department employeeDetails.status employeeDetails.location')
    .limit(50);

    // Recent actions BY this employee
    const recentActions = await AuditLog.find({ actor: employee._id })
        .sort({ createdAt: -1 }).limit(30)
        .select('action description createdAt severity targetType');

    // Actions ON this employee
    const actionsOnEmployee = await AuditLog.find({ targetId: employee._id })
        .sort({ createdAt: -1 }).limit(20)
        .populate('actor', 'profile email')
        .select('action description createdAt severity actor');

    // Peers in same department
    const peers = await User.find({
        role: { $in: ALL_STAFF_ROLES },
        'employeeDetails.department': employee.employeeDetails?.department,
        _id: { $ne: employee._id }
    })
    .select('profile email role employeeDetails.employeeId employeeDetails.designation employeeDetails.location')
    .limit(10);

    // ── Area ride stats (rides touching this employee's service area) ──
    let areaRideStats = null;
    const areaKey = employee.employeeDetails?.location?.areaKey;
    if (areaKey && SERVICE_AREAS[areaKey]) {
        const area = SERVICE_AREAS[areaKey];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        try {
            const areaRides = await Ride.find({
                createdAt: { $gte: sevenDaysAgo },
                $or: [
                    {
                        'route.start.coordinates.0': { $gte: area.bbox[0], $lte: area.bbox[2] },
                        'route.start.coordinates.1': { $gte: area.bbox[1], $lte: area.bbox[3] },
                    },
                    {
                        'route.destination.coordinates.0': { $gte: area.bbox[0], $lte: area.bbox[2] },
                        'route.destination.coordinates.1': { $gte: area.bbox[1], $lte: area.bbox[3] },
                    }
                ]
            }).select('route.start.coordinates route.destination.coordinates status').limit(3000);

            let inbound = 0, outbound = 0, local = 0;
            for (const ride of areaRides) {
                const sStart = detectServiceArea(ride.route?.start?.coordinates);
                const sDest = detectServiceArea(ride.route?.destination?.coordinates);
                const startInArea = sStart?.key === areaKey;
                const destInArea = sDest?.key === areaKey;

                if (startInArea && destInArea) local++;
                else if (startInArea && !destInArea) outbound++;
                else if (!startInArea && destInArea) inbound++;
            }

            areaRideStats = {
                areaName: area.name,
                areaCoords: area.center,
                last7Days: areaRides.length,
                local,
                inbound,   // rides FROM other areas INTO this one
                outbound,  // rides FROM this area TO others
                crossArea: inbound + outbound,
            };
        } catch (_) { /* optional */ }
    }

    res.json({
        success: true,
        employee,
        directReports,
        peers,
        recentActions,
        actionsOnEmployee,
        areaRideStats,
    });
});


// ═══════════════════════════════════════════════════════════════════
//  CREATE EMPLOYEE (geo-coordinate-first, auto-resolve location)
//  POST /api/admin/employees
// ═══════════════════════════════════════════════════════════════════

exports.createEmployee = asyncHandler(async (req, res) => {
    const {
        email, password, firstName, lastName, phone, role, permissions,
        department, subDepartment, team, designation, employeeType,
        // Geo-coordinate fields (primary)
        coordinates, areaKey, officeIndex,
        // Legacy string fields (backward compat — auto-resolved if coordinates missing)
        city, office, zone,
        shiftSchedule, shiftStart, shiftEnd,
        hierarchyLevel, reportsTo, skills, languages, notes, tags,
        permissionLocations, permissionDepartments,
        emergencyContactName, emergencyContactPhone, emergencyContactRelation,
        // H3 Zone Allocation — assigned hex territory
        assignedZones, jurisdictionType, jurisdictionCoverage, autoExpand,
        crossAreaCorridors,
    } = req.body;

    // ── Validation ───────────────────────────────────────────────
    if (!email || !password || !firstName || !role) {
        throw new AppError('Email, password, first name, and role are required', 400);
    }
    if (!phone) {
        throw new AppError('Phone number is required for employee accounts', 400);
    }
    if (!EMPLOYEE_ROLES.includes(role)) {
        throw new AppError(`Invalid role. Must be one of: ${EMPLOYEE_ROLES.join(', ')}`, 400);
    }

    // ── Duplicate checks ─────────────────────────────────────────
    const [existingEmail, existingPhone] = await Promise.all([
        User.findOne({ email }),
        User.findOne({ phone })
    ]);
    if (existingEmail) throw new AppError('An account with this email already exists', 409);
    if (existingPhone) throw new AppError('An account with this phone number already exists', 409);

    // ── Resolve location from coordinates ────────────────────────
    let resolvedLocation;

    if (isValidCoordinates(coordinates)) {
        // Primary path: real coordinates → auto-derive everything
        resolvedLocation = resolveEmployeeLocation(coordinates);
    } else if (areaKey && SERVICE_AREAS[areaKey]) {
        // Secondary: picked an area from dropdown → use its center + specific office
        const area = SERVICE_AREAS[areaKey];
        const selectedOffice = area.offices[officeIndex || 0] || area.offices[0];
        resolvedLocation = resolveEmployeeLocation(selectedOffice.coordinates);
    } else if (city) {
        // Backward compat: city name → resolve to area center
        const key = areaKeyFromName(city);
        if (key) {
            const area = SERVICE_AREAS[key];
            resolvedLocation = resolveEmployeeLocation(area.center);
        } else {
            resolvedLocation = { city: city || 'Unknown', zone: zone || 'CENTRAL', areaKey: null, coordinates: null };
        }
    } else {
        // Default: Chennai HQ
        const defaultArea = SERVICE_AREAS.chennai;
        resolvedLocation = resolveEmployeeLocation(defaultArea.offices[0].coordinates);
    }

    // Allow manual zone/office overrides
    if (zone) resolvedLocation.zone = zone;
    if (office) resolvedLocation.office = office;

    // ── Generate Employee ID: LL-{DEPT_CODE}-{SEQ} ───────────────
    const dept = department || 'Operations';
    const deptCode = DEPT_CODES[dept] || 'GEN';
    const existingInDept = await User.countDocuments({
        role: { $in: EMPLOYEE_ROLES },
        'employeeDetails.department': dept
    });
    const employeeId = `LL-${deptCode}-${String(existingInDept + 1).padStart(4, '0')}`;

    const roleDisplayName = {
        SUPPORT_AGENT: 'Support Agent',
        FINANCE_MANAGER: 'Finance Manager',
        OPERATIONS_MANAGER: 'Operations Manager',
        CONTENT_MODERATOR: 'Content Moderator',
        FLEET_MANAGER: 'Fleet Manager'
    }[role] || role;

    // ── Resolve permission scope locations to areaKeys ───────────
    const scopeLocations = (permissionLocations || []).map(l => {
        if (SERVICE_AREAS[l]) return l;                  // already an areaKey
        return areaKeyFromName(l) || l;                  // name → key
    });

    const employee = await User.create({
        email,
        password,
        phone,
        role,
        profile: {
            firstName,
            lastName: lastName || ''
        },
        employeeDetails: {
            employeeId,
            employeeType: employeeType || 'FULL_TIME',
            designation: designation || roleDisplayName,
            department: dept,
            subDepartment: subDepartment || '',
            team: team || '',
            location: {
                coordinates: resolvedLocation.coordinates || null,
                h3Index: resolvedLocation.h3Index || null,
                h3Neighborhood: resolvedLocation.h3Neighborhood || null,
                h3Block: resolvedLocation.h3Block || null,
                h3Metro: resolvedLocation.h3Metro || null,
                city: resolvedLocation.city,
                areaKey: resolvedLocation.areaKey || null,
                office: resolvedLocation.office || '',
                officeAddress: resolvedLocation.officeAddress || '',
                zone: resolvedLocation.zone,
                state: resolvedLocation.state || '',
            },
            shift: {
                schedule: shiftSchedule || 'MORNING',
                startTime: shiftStart || '09:00',
                endTime: shiftEnd || '18:00',
            },
            hierarchy: {
                level: hierarchyLevel || 7,
                reportsTo: reportsTo || req.user._id,
            },
            permissions: permissions || PERMISSION_MAP[role] || [],
            permissionScope: {
                locations: scopeLocations,
                departments: permissionDepartments || [],
            },
            status: 'PROBATION',
            isActive: true,
            hiredAt: new Date(),
            managedBy: req.user._id,
            skills: skills || [],
            languages: languages || [],
            notes: notes || '',
            tags: tags || [],
            onboarding: {
                completed: false,
                systemAccess: true,
                training: false,
                documentation: false,
                teamIntro: false,
                mentorAssigned: false,
            },
            emergencyContact: {
                name: emergencyContactName || '',
                phone: emergencyContactPhone || '',
                relationship: emergencyContactRelation || '',
            },
            // H3 Zone Allocation
            assignedZones: (assignedZones || []).map(z => ({
                hex: typeof z === 'string' ? z : z.hex,
                role: (typeof z === 'object' && z.role) || 'PRIMARY',
                addedAt: new Date(),
            })),
            jurisdiction: {
                type: jurisdictionType || 'ZONE',
                coverage: jurisdictionCoverage || 'SHARED',
                autoExpand: autoExpand || false,
            },
            crossAreaCorridors: (crossAreaCorridors || []).map(c => ({
                fromArea: c.fromArea,
                toArea: c.toArea,
                active: true,
            })),
        },
        emailVerified: true
    });

    await AuditLog.log(req, {
        action: 'EMPLOYEE_CREATED',
        targetType: 'User',
        targetId: employee._id,
        description: `Created employee ${firstName} ${lastName || ''} (${roleDisplayName}) — ${employeeId} — ${dept}, ${resolvedLocation.city} [${resolvedLocation.coordinates ? resolvedLocation.coordinates.join(', ') : 'no coords'}]`,
        severity: 'HIGH'
    });

    res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        employee: {
            _id: employee._id,
            email: employee.email,
            phone: employee.phone,
            role: employee.role,
            profile: employee.profile,
            employeeDetails: employee.employeeDetails
        }
    });
});


// ═══════════════════════════════════════════════════════════════════
//  UPDATE EMPLOYEE (all fields, geo-aware, change tracking)
//  PUT /api/admin/employees/:id
// ═══════════════════════════════════════════════════════════════════

exports.updateEmployee = asyncHandler(async (req, res) => {
    const {
        role, permissions, isActive, firstName, lastName, phone,
        department, subDepartment, team, designation, employeeType,
        // Geo-coordinate fields
        coordinates, areaKey, officeIndex,
        // Legacy
        city, office, zone,
        shiftSchedule, shiftStart, shiftEnd,
        hierarchyLevel, reportsTo, skills, languages, notes, tags,
        permissionLocations, permissionDepartments,
        emergencyContactName, emergencyContactPhone, emergencyContactRelation,
        // H3 Zone Allocation
        assignedZones, jurisdictionType, jurisdictionCoverage, autoExpand,
        crossAreaCorridors,
    } = req.body;

    const employee = await User.findById(req.params.id);
    if (!employee) throw new AppError('Employee not found', 404);

    const changes = { before: {}, after: {} };

    // ── Role ─────────────────────────────────────────────────────
    if (role && EMPLOYEE_ROLES.includes(role) && role !== employee.role) {
        changes.before.role = employee.role;
        changes.after.role = role;
        employee.role = role;
    }

    // ── Profile ──────────────────────────────────────────────────
    if (firstName) employee.profile.firstName = firstName;
    if (lastName !== undefined) employee.profile.lastName = lastName;
    if (phone) employee.phone = phone;

    // ── Employee Details ─────────────────────────────────────────
    if (!employee.employeeDetails) employee.employeeDetails = {};
    const ed = employee.employeeDetails;

    if (permissions) {
        changes.before.permissions = ed.permissions;
        changes.after.permissions = permissions;
        ed.permissions = permissions;
    }
    if (typeof isActive === 'boolean') {
        changes.before.isActive = ed.isActive;
        changes.after.isActive = isActive;
        ed.isActive = isActive;
    }
    if (department !== undefined) {
        changes.before.department = ed.department;
        changes.after.department = department;
        ed.department = department;
    }
    if (designation !== undefined) ed.designation = designation;
    if (subDepartment !== undefined) ed.subDepartment = subDepartment;
    if (team !== undefined) ed.team = team;
    if (employeeType) ed.employeeType = employeeType;

    // ── Location (geo-coordinate-first) ──────────────────────────
    if (!ed.location) ed.location = {};

    if (isValidCoordinates(coordinates)) {
        // Full auto-resolve from real coordinates
        const resolved = resolveEmployeeLocation(coordinates);
        changes.before.location = { city: ed.location.city, areaKey: ed.location.areaKey, coordinates: ed.location.coordinates };
        changes.after.location = { city: resolved.city, areaKey: resolved.areaKey, coordinates: resolved.coordinates };

        ed.location.coordinates = resolved.coordinates;
        ed.location.h3Index = resolved.h3Index || null;
        ed.location.h3Neighborhood = resolved.h3Neighborhood || null;
        ed.location.h3Block = resolved.h3Block || null;
        ed.location.h3Metro = resolved.h3Metro || null;
        ed.location.city = resolved.city;
        ed.location.areaKey = resolved.areaKey;
        ed.location.zone = resolved.zone;
        ed.location.state = resolved.state;
        ed.location.office = resolved.office;
        ed.location.officeAddress = resolved.officeAddress;
    } else if (areaKey && SERVICE_AREAS[areaKey]) {
        const area = SERVICE_AREAS[areaKey];
        const selectedOffice = area.offices[officeIndex || 0] || area.offices[0];
        const resolved = resolveEmployeeLocation(selectedOffice.coordinates);

        changes.before.location = { city: ed.location.city, areaKey: ed.location.areaKey };
        changes.after.location = { city: resolved.city, areaKey: resolved.areaKey };

        ed.location.coordinates = resolved.coordinates;
        ed.location.h3Index = resolved.h3Index || null;
        ed.location.h3Neighborhood = resolved.h3Neighborhood || null;
        ed.location.h3Block = resolved.h3Block || null;
        ed.location.h3Metro = resolved.h3Metro || null;
        ed.location.city = resolved.city;
        ed.location.areaKey = resolved.areaKey;
        ed.location.zone = resolved.zone;
        ed.location.state = resolved.state;
        ed.location.office = resolved.office;
        ed.location.officeAddress = resolved.officeAddress;
    } else if (city !== undefined) {
        const key = areaKeyFromName(city);
        if (key) {
            const area = SERVICE_AREAS[key];
            const resolved = resolveEmployeeLocation(area.center);
            changes.before.city = ed.location.city;
            changes.after.city = resolved.city;
            Object.assign(ed.location, {
                coordinates: resolved.coordinates,
                h3Index: resolved.h3Index || null,
                h3Neighborhood: resolved.h3Neighborhood || null,
                h3Block: resolved.h3Block || null,
                h3Metro: resolved.h3Metro || null,
                city: resolved.city,
                areaKey: resolved.areaKey,
                zone: resolved.zone,
                state: resolved.state,
                office: resolved.office,
                officeAddress: resolved.officeAddress,
            });
        } else {
            ed.location.city = city;
        }
    }

    // Manual overrides
    if (zone) ed.location.zone = zone;
    if (office) ed.location.office = office;

    // ── Shift ────────────────────────────────────────────────────
    if (!ed.shift) ed.shift = {};
    if (shiftSchedule) ed.shift.schedule = shiftSchedule;
    if (shiftStart) ed.shift.startTime = shiftStart;
    if (shiftEnd) ed.shift.endTime = shiftEnd;

    // ── Hierarchy ────────────────────────────────────────────────
    if (!ed.hierarchy) ed.hierarchy = {};
    if (hierarchyLevel) {
        changes.before.level = ed.hierarchy.level;
        changes.after.level = hierarchyLevel;
        ed.hierarchy.level = hierarchyLevel;
        if (hierarchyLevel < (changes.before.level || 7)) {
            ed.lastPromotionDate = new Date();
        }
    }
    if (reportsTo) ed.hierarchy.reportsTo = reportsTo;

    // ── Permission Scope ─────────────────────────────────────────
    if (!ed.permissionScope) ed.permissionScope = {};
    if (permissionLocations) {
        ed.permissionScope.locations = permissionLocations.map(l => {
            if (SERVICE_AREAS[l]) return l;
            return areaKeyFromName(l) || l;
        });
    }
    if (permissionDepartments) ed.permissionScope.departments = permissionDepartments;

    // ── Skills, languages, notes, tags ───────────────────────────
    if (skills) ed.skills = skills;
    if (languages) ed.languages = languages;
    if (notes !== undefined) ed.notes = notes;
    if (tags) ed.tags = tags;

    // ── Emergency Contact ────────────────────────────────────────
    if (!ed.emergencyContact) ed.emergencyContact = {};
    if (emergencyContactName !== undefined) ed.emergencyContact.name = emergencyContactName;
    if (emergencyContactPhone !== undefined) ed.emergencyContact.phone = emergencyContactPhone;
    if (emergencyContactRelation !== undefined) ed.emergencyContact.relationship = emergencyContactRelation;

    // ── H3 Zone Allocation ───────────────────────────────────────
    if (assignedZones !== undefined) {
        changes.before.assignedZones = (ed.assignedZones || []).map(z => z.hex);
        ed.assignedZones = assignedZones.map(z => ({
            hex: typeof z === 'string' ? z : z.hex,
            role: (typeof z === 'object' && z.role) || 'PRIMARY',
            addedAt: (typeof z === 'object' && z.addedAt) ? new Date(z.addedAt) : new Date(),
        }));
        changes.after.assignedZones = ed.assignedZones.map(z => z.hex);
    }
    if (jurisdictionType) {
        if (!ed.jurisdiction) ed.jurisdiction = {};
        ed.jurisdiction.type = jurisdictionType;
    }
    if (jurisdictionCoverage) {
        if (!ed.jurisdiction) ed.jurisdiction = {};
        ed.jurisdiction.coverage = jurisdictionCoverage;
    }
    if (autoExpand !== undefined) {
        if (!ed.jurisdiction) ed.jurisdiction = {};
        ed.jurisdiction.autoExpand = autoExpand;
    }
    if (crossAreaCorridors !== undefined) {
        ed.crossAreaCorridors = crossAreaCorridors.map(c => ({
            fromArea: c.fromArea, toArea: c.toArea, active: c.active !== false,
        }));
    }

    employee.markModified('employeeDetails');
    await employee.save();

    await AuditLog.log(req, {
        action: 'EMPLOYEE_UPDATED',
        targetType: 'User',
        targetId: employee._id,
        description: `Updated employee ${employee.profile?.firstName || employee.email}`,
        changes,
        severity: 'MEDIUM'
    });

    res.json({ success: true, message: 'Employee updated successfully', employee });
});


// ═══════════════════════════════════════════════════════════════════
//  UPDATE EMPLOYEE STATUS (lifecycle transitions)
//  PATCH /api/admin/employees/:id/status
// ═══════════════════════════════════════════════════════════════════

exports.updateEmployeeStatus = asyncHandler(async (req, res) => {
    const { status, reason } = req.body;
    const validStatuses = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'PROBATION', 'NOTICE_PERIOD', 'TERMINATED', 'OFFBOARDED'];

    if (!validStatuses.includes(status)) {
        throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const employee = await User.findById(req.params.id);
    if (!employee) throw new AppError('Employee not found', 404);

    if (employee._id.toString() === req.user._id.toString()) {
        throw new AppError('Cannot change your own status', 400);
    }

    const prevStatus = employee.employeeDetails?.status || 'ACTIVE';

    if (!employee.employeeDetails) employee.employeeDetails = {};
    employee.employeeDetails.status = status;

    if (['TERMINATED', 'OFFBOARDED'].includes(status)) {
        employee.employeeDetails.isActive = false;
        employee.employeeDetails.lastWorkingDate = new Date();
    } else if (status === 'ACTIVE') {
        employee.employeeDetails.isActive = true;
        if (prevStatus === 'PROBATION') {
            employee.employeeDetails.confirmationDate = new Date();
        }
    } else if (status === 'SUSPENDED') {
        employee.employeeDetails.isActive = false;
    }

    employee.markModified('employeeDetails');
    await employee.save();

    await AuditLog.log(req, {
        action: 'EMPLOYEE_UPDATED',
        targetType: 'User',
        targetId: employee._id,
        description: `Status changed: ${prevStatus} → ${status}${reason ? ` (${reason})` : ''}`,
        changes: { before: { status: prevStatus }, after: { status } },
        severity: ['TERMINATED', 'OFFBOARDED', 'SUSPENDED'].includes(status) ? 'HIGH' : 'MEDIUM'
    });

    res.json({ success: true, message: `Employee status updated to ${status}`, employee });
});


// ═══════════════════════════════════════════════════════════════════
//  UPDATE ONBOARDING CHECKLIST
//  PATCH /api/admin/employees/:id/onboarding
// ═══════════════════════════════════════════════════════════════════

exports.updateOnboarding = asyncHandler(async (req, res) => {
    const { field, value } = req.body;
    const validFields = ['systemAccess', 'training', 'documentation', 'teamIntro', 'mentorAssigned'];

    if (!validFields.includes(field)) {
        throw new AppError(`Invalid onboarding field. Must be one of: ${validFields.join(', ')}`, 400);
    }

    const employee = await User.findById(req.params.id);
    if (!employee) throw new AppError('Employee not found', 404);

    if (!employee.employeeDetails) employee.employeeDetails = {};
    if (!employee.employeeDetails.onboarding) employee.employeeDetails.onboarding = {};

    employee.employeeDetails.onboarding[field] = !!value;

    const ob = employee.employeeDetails.onboarding;
    ob.completed = ob.systemAccess && ob.training && ob.documentation && ob.teamIntro && ob.mentorAssigned;

    employee.markModified('employeeDetails');
    await employee.save();

    await AuditLog.log(req, {
        action: 'EMPLOYEE_UPDATED',
        targetType: 'User',
        targetId: employee._id,
        description: `Onboarding: ${field} → ${value ? 'completed' : 'pending'}`,
        severity: 'LOW'
    });

    res.json({
        success: true,
        message: 'Onboarding updated',
        onboarding: employee.employeeDetails.onboarding
    });
});


// ═══════════════════════════════════════════════════════════════════
//  DEACTIVATE EMPLOYEE (soft delete)
//  DELETE /api/admin/employees/:id
// ═══════════════════════════════════════════════════════════════════

exports.deactivateEmployee = asyncHandler(async (req, res) => {
    const employee = await User.findById(req.params.id);
    if (!employee) throw new AppError('Employee not found', 404);

    if (employee._id.toString() === req.user._id.toString()) {
        throw new AppError('Cannot deactivate your own account', 400);
    }
    if (['ADMIN', 'SUPER_ADMIN'].includes(employee.role)) {
        throw new AppError('Cannot deactivate admin accounts via this endpoint', 403);
    }

    if (!employee.employeeDetails) employee.employeeDetails = {};
    employee.employeeDetails.isActive = false;
    employee.employeeDetails.status = 'OFFBOARDED';
    employee.employeeDetails.lastWorkingDate = new Date();
    employee.markModified('employeeDetails');
    await employee.save();

    await AuditLog.log(req, {
        action: 'EMPLOYEE_DEACTIVATED',
        targetType: 'User',
        targetId: employee._id,
        description: `Deactivated employee ${employee.profile?.firstName || employee.email} (${employee.employeeDetails.employeeId || 'N/A'})`,
        severity: 'HIGH'
    });

    res.json({ success: true, message: 'Employee deactivated' });
});


// ═══════════════════════════════════════════════════════════════════
//  GET PERMISSIONS & META (includes full service area map)
//  GET /api/admin/employees/permissions
// ═══════════════════════════════════════════════════════════════════

exports.getPermissions = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        permissions: ALL_PERMISSIONS,
        roleDefaults: PERMISSION_MAP,
        employeeRoles: EMPLOYEE_ROLES,
        departments: DEPARTMENTS,
        serviceAreas: getServiceAreasMeta(),
        hierarchyLevels: HIERARCHY_LEVELS,
    });
});


// ═══════════════════════════════════════════════════════════════════
//  GET HEX COVERAGE DATA (for interactive map visualization)
//  GET /api/admin/employees/hex-coverage
// ═══════════════════════════════════════════════════════════════════

exports.getHexCoverage = asyncHandler(async (req, res) => {
    const hexData = getHexVisualizationData();

    // Get employee distribution by h3Index (res 7) — where employees are LOCATED
    const employeeHexes = await User.aggregate([
        { $match: { role: { $in: ALL_STAFF_ROLES }, 'employeeDetails.location.h3Index': { $exists: true, $ne: null } } },
        { $group: { _id: '$employeeDetails.location.h3Index', count: { $sum: 1 }, area: { $first: '$employeeDetails.location.areaKey' } } }
    ]);

    const employeeHexMap = {};
    for (const h of employeeHexes) {
        employeeHexMap[h._id] = { count: h.count, area: h.area };
    }

    // Get zone ALLOCATION data — which hexes are ASSIGNED to employees
    const zoneAllocations = await User.aggregate([
        { $match: { role: { $in: ALL_STAFF_ROLES }, 'employeeDetails.assignedZones.0': { $exists: true } } },
        { $unwind: '$employeeDetails.assignedZones' },
        { $group: {
            _id: '$employeeDetails.assignedZones.hex',
            assignedCount: { $sum: 1 },
            employees: { $push: {
                id: '$_id',
                name: { $concat: [{ $ifNull: ['$profile.firstName', ''] }, ' ', { $ifNull: ['$profile.lastName', ''] }] },
                role: '$employeeDetails.assignedZones.role',
                empRole: '$role',
                department: '$employeeDetails.department',
            }}
        }}
    ]);

    const zoneAllocationMap = {};
    for (const z of zoneAllocations) {
        zoneAllocationMap[z._id] = { count: z.assignedCount, employees: z.employees };
    }

    // Cross-area corridor summary
    const corridors = await User.aggregate([
        { $match: { role: { $in: ALL_STAFF_ROLES }, 'employeeDetails.crossAreaCorridors.0': { $exists: true } } },
        { $unwind: '$employeeDetails.crossAreaCorridors' },
        { $match: { 'employeeDetails.crossAreaCorridors.active': true } },
        { $group: {
            _id: { from: '$employeeDetails.crossAreaCorridors.fromArea', to: '$employeeDetails.crossAreaCorridors.toArea' },
            monitorCount: { $sum: 1 },
        }}
    ]);

    res.json({
        success: true,
        hexData,
        employeeHexMap,
        zoneAllocationMap,
        corridors,
        meta: {
            serviceAreas: getServiceAreasMeta(),
            totalHexes: hexData.length,
            resolutions: RES,
            totalAllocatedZones: Object.keys(zoneAllocationMap).length,
            totalUnallocatedZones: hexData.length - Object.keys(zoneAllocationMap).length,
        }
    });
});


// ═══════════════════════════════════════════════════════════════════
//  GET AUDIT LOGS (paginated, filterable)
//  GET /api/admin/audit-logs
// ═══════════════════════════════════════════════════════════════════

exports.getAuditLogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, action, targetType, severity, actorId } = req.query;

    const query = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;
    if (severity) query.severity = severity;
    if (actorId) query.actor = actorId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await AuditLog.countDocuments(query);

    const logs = await AuditLog.find(query)
        .populate('actor', 'profile email role employeeDetails.employeeId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    res.json({
        success: true,
        logs,
        pagination: {
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            total
        }
    });
});
