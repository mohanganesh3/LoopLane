/**
 * ClayButton Component
 * Premium clay-morphism button with satisfying tactile feel
 * Designed to feel handcrafted, not AI-generated
 */

import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { useMagnetic } from '../../hooks/useLoopLaneAnimations';

const variants = {
  primary: `
    bg-gradient-to-b from-[#8ee4af] to-[#0ead69] text-[#0f1a1a]
    shadow-[4px_4px_12px_rgba(14,173,105,0.25),-2px_-2px_8px_rgba(255,255,255,0.5)]
    hover:shadow-[6px_6px_18px_rgba(14,173,105,0.3),-3px_-3px_12px_rgba(255,255,255,0.6)]
    active:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_rgba(255,255,255,0.2)]
    font-semibold
  `,
  secondary: `
    bg-gradient-to-b from-[#5fd992] to-[#0ead69] text-white
    shadow-[4px_4px_12px_rgba(95,217,146,0.25),-2px_-2px_8px_rgba(255,255,255,0.5)]
    hover:shadow-[6px_6px_18px_rgba(95,217,146,0.3),-3px_-3px_12px_rgba(255,255,255,0.6)]
    active:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_rgba(255,255,255,0.2)]
  `,
  clay: `
    bg-[#fafcfa] text-[#0f1a1a]
    shadow-[8px_8px_20px_rgba(14,173,105,0.08),-8px_-8px_20px_rgba(255,255,255,0.9)]
    hover:shadow-[10px_10px_25px_rgba(14,173,105,0.1),-10px_-10px_25px_rgba(255,255,255,0.95)]
    active:shadow-[inset_4px_4px_8px_rgba(14,173,105,0.05),inset_-4px_-4px_8px_rgba(255,255,255,0.5)]
  `,
  outline: `
    bg-transparent border-2 border-[#0f1a1a] text-[#0f1a1a]
    hover:bg-[#0f1a1a] hover:text-white
    shadow-none
  `,
  outlineMint: `
    bg-transparent border-2 border-[#0ead69] text-[#0ead69]
    hover:bg-[#0ead69] hover:text-white
    shadow-none
  `,
  ghost: `
    bg-transparent text-[#0f1a1a]
    hover:bg-[#e8f5e9]
    shadow-none
  `,
  ink: `
    bg-gradient-to-b from-[#0f1a1a] to-[#264d3d] text-white
    shadow-[4px_4px_12px_rgba(15,26,26,0.3),-2px_-2px_8px_rgba(255,255,255,0.3)]
    hover:shadow-[6px_6px_18px_rgba(15,26,26,0.35),-3px_-3px_12px_rgba(255,255,255,0.4)]
  `,
  glass: `
    bg-white/70 backdrop-blur-lg text-[#0f1a1a] border border-white/50
    shadow-[4px_4px_20px_rgba(14,173,105,0.1)]
    hover:bg-white/80 hover:shadow-[6px_6px_25px_rgba(14,173,105,0.15)]
  `,
};

const sizes = {
  sm: 'px-4 py-2 text-sm gap-1.5',
  md: 'px-6 py-3 text-base gap-2',
  lg: 'px-8 py-4 text-lg gap-2',
  xl: 'px-10 py-5 text-xl gap-3',
  icon: 'p-3 aspect-square',
  iconSm: 'p-2 aspect-square',
  iconLg: 'p-4 aspect-square',
};

const ClayButton = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  rounded = 'full',
  magnetic = false,
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  className = '',
  as: Component,
  onClick,
  ...props
}, ref) => {
  const { ref: magneticRef, style: magneticStyle, handlers } = useMagnetic(0.25);
  
  const radiusClasses = {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
    full: 'rounded-full',
  };
  
  const baseClasses = `
    relative inline-flex items-center justify-center
    font-medium select-none
    transition-all duration-200 ease-out
    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ead69] focus-visible:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    ${fullWidth ? 'w-full' : ''}
    ${radiusClasses[rounded]}
    ${sizes[size]}
    ${variants[variant]}
    ${className}
  `;
  
  const buttonContent = (
    <>
      {loading ? (
        <motion.div
          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
          {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
        </>
      )}
    </>
  );

  // Handle polymorphic "as" prop - for Link components
  if (Component) {
    return (
      <Component
        ref={ref}
        className={baseClasses}
        {...props}
      >
        {buttonContent}
      </Component>
    );
  }
  
  if (magnetic && !disabled) {
    return (
      <motion.button
        ref={(node) => {
          magneticRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        className={baseClasses}
        style={magneticStyle}
        onClick={onClick}
        disabled={disabled || loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        {...handlers}
        {...props}
      >
        {buttonContent}
      </motion.button>
    );
  }
  
  return (
    <motion.button
      ref={ref}
      className={baseClasses}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      {...props}
    >
      {buttonContent}
    </motion.button>
  );
});

ClayButton.displayName = 'ClayButton';

export default ClayButton;
