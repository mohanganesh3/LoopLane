/**
 * ClayCard Component
 * Premium clay-morphism card with depth and warmth
 * Features: hover lift, tilt effect, glow on hover
 */

import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { useTilt } from '../../hooks/useLoopLaneAnimations';

const variants = {
  default: `
    bg-white
    shadow-[8px_8px_24px_rgba(14,173,105,0.05),-8px_-8px_24px_rgba(255,255,255,0.8)]
    hover:shadow-[12px_12px_32px_rgba(14,173,105,0.08),-12px_-12px_32px_rgba(255,255,255,0.9)]
  `,
  clay: `
    bg-[#fafcfa]
    shadow-[8px_8px_20px_rgba(14,173,105,0.06),-8px_-8px_20px_rgba(255,255,255,0.9)]
    hover:shadow-[12px_12px_28px_rgba(14,173,105,0.08),-12px_-12px_28px_rgba(255,255,255,0.95)]
  `,
  warm: `
    bg-white/90 border border-[#8ee4af]/20
    shadow-[0_4px_24px_rgba(14,173,105,0.06)]
    hover:shadow-[0_8px_40px_rgba(14,173,105,0.12)] hover:border-[#8ee4af]/40
  `,
  glass: `
    bg-white/70 backdrop-blur-xl border border-white/50
    shadow-[0_8px_32px_rgba(14,173,105,0.08)]
    hover:bg-white/85 hover:border-[#8ee4af]/30
  `,
  mint: `
    bg-gradient-to-br from-[#f0fdf4] to-[#e8f5e9]
    shadow-[8px_8px_20px_rgba(142,228,175,0.15),-4px_-4px_16px_rgba(255,255,255,0.8)]
    hover:shadow-[12px_12px_28px_rgba(142,228,175,0.2),-6px_-6px_20px_rgba(255,255,255,0.9)]
  `,
  emerald: `
    bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5]
    shadow-[8px_8px_20px_rgba(14,173,105,0.12),-4px_-4px_16px_rgba(255,255,255,0.8)]
    hover:shadow-[12px_12px_28px_rgba(14,173,105,0.18),-6px_-6px_20px_rgba(255,255,255,0.9)]
  `,
  ink: `
    bg-gradient-to-br from-[#0f1a1a] to-[#264d3d] text-white
    shadow-[8px_8px_24px_rgba(15,26,26,0.3),-4px_-4px_16px_rgba(255,255,255,0.1)]
    hover:shadow-[12px_12px_32px_rgba(15,26,26,0.35),-6px_-6px_20px_rgba(255,255,255,0.15)]
  `,
  flat: `
    bg-white border border-[#8ee4af]/20
    hover:border-[#8ee4af]/50 hover:bg-[#fafcfa]
  `,
  glassMint: `
    bg-[#8ee4af]/10 backdrop-blur-xl border border-[#8ee4af]/20
    shadow-[0_8px_32px_rgba(14,173,105,0.1)]
    hover:bg-[#8ee4af]/15 hover:border-[#8ee4af]/40
  `,
};

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10',
};

const radiusOptions = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-3xl',
  '2xl': 'rounded-[32px]',
  full: 'rounded-full',
};

const ClayCard = forwardRef(({
  children,
  variant = 'default',
  padding = 'md',
  radius = 'xl',
  tilt = false,
  tiltMax = 8,
  hover = true,
  clickable = false,
  className = '',
  style = {},
  onClick,
  ...props
}, ref) => {
  const { ref: tiltRef, style: tiltStyle, handlers } = useTilt(tiltMax);
  
  const baseClasses = `
    relative overflow-hidden
    transition-all duration-300 ease-out
    ${radiusOptions[radius]}
    ${paddings[padding]}
    ${variants[variant]}
    ${clickable ? 'cursor-pointer' : ''}
    ${className}
  `;
  
  // Animation variants for framer-motion
  const cardVariants = {
    initial: { scale: 1, y: 0 },
    hover: hover ? { scale: 1.01, y: -4 } : {},
    tap: clickable ? { scale: 0.99, y: 0 } : {},
  };
  
  if (tilt) {
    return (
      <motion.div
        ref={(node) => {
          tiltRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        className={baseClasses}
        style={{ ...style, ...tiltStyle }}
        onClick={onClick}
        variants={cardVariants}
        initial="initial"
        whileHover="hover"
        whileTap={clickable ? "tap" : undefined}
        {...handlers}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
  
  return (
    <motion.div
      ref={ref}
      className={baseClasses}
      style={style}
      onClick={onClick}
      variants={cardVariants}
      initial="initial"
      whileHover="hover"
      whileTap={clickable ? "tap" : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
});

ClayCard.displayName = 'ClayCard';

// Sub-components for structure
const ClayCardHeader = ({ children, className = '', ...props }) => (
  <div className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
);

const ClayCardBody = ({ children, className = '', ...props }) => (
  <div className={className} {...props}>
    {children}
  </div>
);

const ClayCardFooter = ({ children, className = '', ...props }) => (
  <div className={`mt-4 pt-4 border-t border-[#f0ebe3] ${className}`} {...props}>
    {children}
  </div>
);

ClayCard.Header = ClayCardHeader;
ClayCard.Body = ClayCardBody;
ClayCard.Footer = ClayCardFooter;

export default ClayCard;
