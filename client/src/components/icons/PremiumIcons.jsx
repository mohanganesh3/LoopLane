/**
 * Premium SVG Icon Library — LoopLane
 * Hand-crafted, Apple-grade vector icons.
 * Each icon uses precise stroke/fill geometry for a clean, premium aesthetic.
 */

const Icon = ({ children, size = 20, className = '', viewBox = '0 0 24 24', ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        className={className}
        {...props}
    >
        {children}
    </svg>
);

// ─── Nature & Environment ────────────────────────────────
export const LeafIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20c4 0 8.5-3 11-8a2.9 2.9 0 0 0 .18-2.82A3 3 0 0 0 17 8z" fill="currentColor" opacity="0.15" />
        <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20c4 0 8.5-3 11-8a2.9 2.9 0 0 0 .18-2.82A3 3 0 0 0 17 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 15c2-1.5 4.5-2.5 7-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
);

export const TreeIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M12 22V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 2L4 14h16L12 2z" fill="currentColor" opacity="0.12" />
        <path d="M12 2L4 14h16L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 14l-2 6h12l-2-6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </Icon>
);

// ─── Travel & Transport ──────────────────────────────────
export const CarIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M5 17h14v-5l-2-5H7L5 12v5z" fill="currentColor" opacity="0.1" />
        <path d="M19 17H5v-5l2-5h10l2 5v5zM5 17v2a1 1 0 001 1h1a1 1 0 001-1v-2M19 17v2a1 1 0 01-1 1h-1a1 1 0 01-1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7.5" cy="14.5" r="1" fill="currentColor" />
        <circle cx="16.5" cy="14.5" r="1" fill="currentColor" />
        <path d="M5 12h14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
    </Icon>
);

export const RoadIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M4 19L8 5h8l4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 5v3M12 11v2M12 16v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="0" />
    </Icon>
);

// ─── Finance & Value ─────────────────────────────────────
export const CoinIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.1" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7v10M9 9.5c0-.83 1.34-1.5 3-1.5s3 .67 3 1.5-1.34 1.5-3 1.5-3 .67-3 1.5 1.34 1.5 3 1.5 3-.67 3-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
);

// ─── Rating & Achievement ────────────────────────────────
export const StarIcon = ({ size = 20, className = '', filled = false }) => (
    <Icon size={size} className={className}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={filled ? 'currentColor' : 'currentColor'}
            opacity={filled ? 1 : 0.12}
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </Icon>
);

export const TrophyIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M6 9a6 6 0 0012 0V3H6v6z" fill="currentColor" opacity="0.1" />
        <path d="M6 9a6 6 0 0012 0V3H6v6zM6 3H2v3a4 4 0 004 4M18 3h4v3a4 4 0 01-4 4M9 21h6M12 15v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
);

export const BadgeIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 14.1l-4.8 2.5.9-5.3L4.3 7.6l5.3-.8L12 2z" fill="currentColor" opacity="0.15" />
        <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 14.1l-4.8 2.5.9-5.3L4.3 7.6l5.3-.8L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 17l-1 5 5-3 5 3-1-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </Icon>
);

// ─── Data & Analytics ────────────────────────────────────
export const ChartIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" opacity="0.08" />
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 17V13M12 17V9M17 17V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Icon>
);

// ─── UI & Status ─────────────────────────────────────────
export const CheckCircleIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.12" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
);

export const SparkleIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
);

export const CelebrationIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M4.5 22L2 13l9.5 2.5L4.5 22z" fill="currentColor" opacity="0.15" />
        <path d="M4.5 22L2 13l9.5 2.5L4.5 22z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M13 10l3-3M17 14l2-2M9 6l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="19" cy="5" r="1.5" fill="currentColor" opacity="0.4" />
        <circle cx="15" cy="3" r="1" fill="currentColor" opacity="0.3" />
        <circle cx="21" cy="9" r="1" fill="currentColor" opacity="0.3" />
    </Icon>
);

export const HeartIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
            fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
);

export const WarningIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="currentColor" opacity="0.12" />
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Icon>
);

export const InfoIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.1" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Icon>
);

export const GearIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
);

export const SnowflakeIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 5l-2 2M12 5l2 2M12 19l-2-2M12 19l2-2M5 12l2-2M5 12l2 2M19 12l-2-2M19 12l-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </Icon>
);

export const PhoneIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <rect x="6" y="2" width="12" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 18h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 5h12M6 17h12" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </Icon>
);

export const MapPinIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M12 22s-7-5.75-7-11a7 7 0 1114 0c0 5.25-7 11-7 11z" fill="currentColor" opacity="0.12" />
        <path d="M12 22s-7-5.75-7-11a7 7 0 1114 0c0 5.25-7 11-7 11z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </Icon>
);

export const ScrollIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="currentColor" opacity="0.08" />
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
);

export const RouteIcon = ({ size = 20, className = '' }) => (
    <Icon size={size} className={className}>
        <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 8.5v2.5a4 4 0 004 4h4a4 4 0 004-4V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
);

// ─── Inline SVG for small decoration (replaces emoji in text) ───
export const InlineIcon = ({ children, className = '' }) => (
    <span className={`inline-flex items-center align-middle ${className}`} style={{ verticalAlign: 'middle' }}>
        {children}
    </span>
);

export default {
    LeafIcon,
    TreeIcon,
    CarIcon,
    RoadIcon,
    CoinIcon,
    StarIcon,
    TrophyIcon,
    BadgeIcon,
    ChartIcon,
    CheckCircleIcon,
    SparkleIcon,
    CelebrationIcon,
    HeartIcon,
    WarningIcon,
    InfoIcon,
    GearIcon,
    SnowflakeIcon,
    PhoneIcon,
    MapPinIcon,
    ScrollIcon,
    RouteIcon,
    InlineIcon
};
