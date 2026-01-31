import React from 'react';
import { motion } from 'framer-motion';
import { useMagneticEffect } from '../../hooks/useMagneticEffect';

/**
 * Magnetic button with hover effect - follows cursor with elastic snap-back
 * Premium interaction for CTA buttons
 */
const MagneticButton = ({
    children,
    className = '',
    variant = 'primary', // 'primary', 'secondary', 'outline', 'ghost'
    size = 'md', // 'sm', 'md', 'lg'
    strength = 0.4,
    onClick,
    disabled = false,
    ...props
}) => {
    const { bindMagnetic } = useMagneticEffect({ strength });

    const baseStyles = `
    relative inline-flex items-center justify-center
    font-semibold rounded-full
    transition-all duration-300 ease-out
    overflow-hidden
    cursor-hover
  `;

    const variants = {
        primary: `
      bg-gradient-to-r from-[#e07a5f] to-[#d66a53]
      text-white shadow-lg
      hover:shadow-xl hover:shadow-[#e07a5f]/25
      active:scale-95
    `,
        secondary: `
      bg-gradient-to-r from-[#81b29a] to-[#6a9b82]
      text-white shadow-lg
      hover:shadow-xl hover:shadow-[#81b29a]/25
      active:scale-95
    `,
        outline: `
      bg-transparent border-2 border-[#1a1f35]
      text-[#1a1f35]
      hover:bg-[#1a1f35] hover:text-white
      active:scale-95
    `,
        ghost: `
      bg-transparent
      text-[#1a1f35]
      hover:bg-[#1a1f35]/5
      active:scale-95
    `,
    };

    const sizes = {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
    };

    return (
        <motion.button
            {...bindMagnetic()}
            className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
        ${className}
      `}
            onClick={onClick}
            disabled={disabled}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            data-cursor="hover"
            {...props}
        >
            {/* Shimmer effect overlay */}
            <span className="absolute inset-0 overflow-hidden rounded-full">
                <span className="shimmer-effect absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform skew-x-12" />
            </span>

            {/* Button content */}
            <span className="relative z-10 flex items-center gap-2">
                {children}
            </span>

            <style>{`
        .shimmer-effect {
          animation: shimmer 3s infinite;
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) skewX(-12deg);
          }
          50%, 100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }
      `}</style>
        </motion.button>
    );
};

export default MagneticButton;
