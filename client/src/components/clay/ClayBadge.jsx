/**
 * ClayBadge Component
 * Soft, organic badges with clay-morphism styling
 */

import React from 'react';
import { motion } from 'framer-motion';

const variants = {
  coral: `bg-gradient-to-r from-[#fef4f1] to-[#fce8e2] text-[#af5441]
          shadow-[2px_2px_6px_rgba(224,122,95,0.12),-1px_-1px_4px_rgba(255,255,255,0.8)]`,
  sage: `bg-gradient-to-r from-[#f2f7f4] to-[#e0ede6] text-[#3a6352]
         shadow-[2px_2px_6px_rgba(129,178,154,0.12),-1px_-1px_4px_rgba(255,255,255,0.8)]`,
  stone: `bg-gradient-to-r from-[#f5f0e8] to-[#e8e0d4] text-[#5c5851]
          shadow-[2px_2px_6px_rgba(26,31,53,0.06),-1px_-1px_4px_rgba(255,255,255,0.8)]`,
  ink: `bg-[#1a1f35] text-white
        shadow-[2px_2px_6px_rgba(26,31,53,0.2)]`,
  success: `bg-gradient-to-r from-[#dcfce7] to-[#bbf7d0] text-[#166534]
            shadow-[2px_2px_6px_rgba(34,197,94,0.15),-1px_-1px_4px_rgba(255,255,255,0.8)]`,
  warning: `bg-gradient-to-r from-[#fef3c7] to-[#fde68a] text-[#92400e]
            shadow-[2px_2px_6px_rgba(251,191,36,0.15),-1px_-1px_4px_rgba(255,255,255,0.8)]`,
  error: `bg-gradient-to-r from-[#fee2e2] to-[#fecaca] text-[#991b1b]
          shadow-[2px_2px_6px_rgba(239,68,68,0.15),-1px_-1px_4px_rgba(255,255,255,0.8)]`,
  info: `bg-gradient-to-r from-[#dbeafe] to-[#bfdbfe] text-[#1e40af]
         shadow-[2px_2px_6px_rgba(59,130,246,0.15),-1px_-1px_4px_rgba(255,255,255,0.8)]`,
  outline: `bg-transparent border-2 border-current text-[#1a1f35]`,
  outlineCoral: `bg-transparent border-2 border-[#e07a5f] text-[#e07a5f]`,
};

const sizes = {
  xs: 'px-2 py-0.5 text-[10px]',
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

const ClayBadge = ({
  children,
  variant = 'coral',
  size = 'md',
  icon,
  iconPosition = 'left',
  dot = false,
  dotColor = 'currentColor',
  rounded = true,
  pulse = false,
  className = '',
  ...props
}) => {
  const baseClasses = `
    inline-flex items-center justify-center gap-1.5
    font-semibold uppercase tracking-wide
    ${rounded ? 'rounded-full' : 'rounded-lg'}
    ${sizes[size]}
    ${variants[variant]}
    ${className}
  `;
  
  return (
    <motion.span
      className={baseClasses}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      {...props}
    >
      {/* Pulsing dot */}
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span 
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: dotColor }}
            />
          )}
          <span 
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: dotColor }}
          />
        </span>
      )}
      
      {icon && iconPosition === 'left' && (
        <span className="flex-shrink-0 -ml-0.5">{icon}</span>
      )}
      
      {children}
      
      {icon && iconPosition === 'right' && (
        <span className="flex-shrink-0 -mr-0.5">{icon}</span>
      )}
    </motion.span>
  );
};

// Status badge presets
export const StatusBadge = ({ status, ...props }) => {
  const statusConfig = {
    active: { variant: 'success', children: 'Active', dot: true, dotColor: '#22c55e' },
    pending: { variant: 'warning', children: 'Pending', dot: true, pulse: true, dotColor: '#f59e0b' },
    completed: { variant: 'sage', children: 'Completed' },
    cancelled: { variant: 'error', children: 'Cancelled' },
    upcoming: { variant: 'info', children: 'Upcoming', dot: true, dotColor: '#3b82f6' },
    draft: { variant: 'stone', children: 'Draft' },
  };
  
  const config = statusConfig[status] || statusConfig.pending;
  
  return <ClayBadge {...config} {...props} />;
};

// Count badge (for notifications)
export const CountBadge = ({ count, max = 99, variant = 'coral', ...props }) => {
  const displayCount = count > max ? `${max}+` : count;
  
  if (count <= 0) return null;
  
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`
        inline-flex items-center justify-center
        min-w-[20px] h-5 px-1.5
        text-xs font-bold rounded-full
        ${variant === 'coral' ? 'bg-[#e07a5f] text-white' : ''}
        ${variant === 'sage' ? 'bg-[#81b29a] text-white' : ''}
        ${variant === 'ink' ? 'bg-[#1a1f35] text-white' : ''}
      `}
      {...props}
    >
      {displayCount}
    </motion.span>
  );
};

export default ClayBadge;
