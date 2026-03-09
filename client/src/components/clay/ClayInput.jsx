/**
 * ClayInput Component
 * Premium input with inset clay shadow and organic focus states
 */

import React, { forwardRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const variants = {
  default: {
    base: `
      bg-white border-2 border-[#e8e0d4]
      focus:border-[#e07a5f] focus:ring-2 focus:ring-[#e07a5f]/20
    `,
    error: 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
  },
  clay: {
    base: `
      bg-[#faf8f5] border-none
      shadow-[inset_4px_4px_8px_rgba(26,31,53,0.05),inset_-4px_-4px_8px_rgba(255,255,255,0.8)]
      focus:shadow-[inset_4px_4px_8px_rgba(26,31,53,0.08),inset_-4px_-4px_8px_rgba(255,255,255,0.9),0_0_0_3px_rgba(224,122,95,0.15)]
    `,
    error: 'shadow-[inset_4px_4px_8px_rgba(239,68,68,0.1),inset_-4px_-4px_8px_rgba(255,255,255,0.8)]',
  },
  underline: {
    base: `
      bg-transparent border-0 border-b-2 border-[#e8e0d4] rounded-none px-0
      focus:border-[#e07a5f] focus:ring-0
    `,
    error: 'border-red-400',
  },
  filled: {
    base: `
      bg-[#f5f0e8] border-2 border-transparent
      focus:bg-white focus:border-[#e07a5f]
    `,
    error: 'border-red-400 bg-red-50',
  },
};

const sizes = {
  sm: 'py-2 px-3 text-sm',
  md: 'py-3 px-4 text-base',
  lg: 'py-4 px-5 text-lg',
};

const ClayInput = forwardRef(({
  type = 'text',
  variant = 'default',
  size = 'md',
  label,
  error,
  helper,
  icon,
  iconPosition = 'left',
  suffix,
  showPasswordToggle = false,
  className = '',
  containerClassName = '',
  labelClassName = '',
  inputClassName = '',
  disabled = false,
  required = false,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // Determine if this is a toggleable password field
  const isPasswordField = type === 'password' || (type === 'text' && showPasswordToggle);
  const shouldShowToggle = showPasswordToggle || type === 'password';
  const resolvedType = shouldShowToggle && passwordVisible ? 'text' : type;
  
  const variantStyles = variants[variant] || variants.default;
  
  // Password toggle needs right padding; suffix also needs right padding
  const hasRightElement = (icon && iconPosition === 'right') || suffix || shouldShowToggle;
  
  const baseInputClasses = `
    w-full font-medium
    placeholder:text-[#a39e93] placeholder:font-normal
    outline-none transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    rounded-xl
    ${sizes[size]}
    ${variantStyles.base}
    ${error ? variantStyles.error : ''}
    ${icon && iconPosition === 'left' ? 'pl-11' : ''}
    ${hasRightElement ? 'pr-12' : ''}
    ${inputClassName}
  `;
  
  return (
    <div className={`relative ${containerClassName}`}>
      {/* Label */}
      {label && (
        <label className={`block mb-2 font-medium text-[#1a1f35] ${labelClassName}`}>
          {label}
          {required && <span className="text-[#e07a5f] ml-1">*</span>}
        </label>
      )}
      
      {/* Input container */}
      <div className="relative">
        {/* Left icon */}
        {icon && iconPosition === 'left' && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a39e93] pointer-events-none">
            {icon}
          </div>
        )}
        
        {/* Input */}
        <input
          ref={ref}
          type={resolvedType}
          className={baseInputClasses}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {/* Right icon (only when no password toggle) */}
        {icon && iconPosition === 'right' && !shouldShowToggle && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a39e93] pointer-events-none">
            {icon}
          </div>
        )}

        {/* Password visibility toggle — inside input, right side */}
        {shouldShowToggle && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            onClick={() => setPasswordVisible(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#a39e93] hover:text-[#1a1f35] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e07a5f]/40 transition-colors duration-150"
          >
            {passwordVisible ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
        
        {/* Suffix */}
        {suffix && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7a756c]">
            {suffix}
          </div>
        )}
        
        {/* Focus indicator line (for underline variant) */}
        {variant === 'underline' && (
          <motion.div
            className="absolute bottom-0 left-0 h-0.5 bg-[#e07a5f]"
            initial={{ width: '0%' }}
            animate={{ width: isFocused ? '100%' : '0%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          />
        )}
      </div>
      
      {/* Helper/Error text */}
      <AnimatePresence mode="wait">
        {(error || helper) && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`mt-2 text-sm ${error ? 'text-red-500' : 'text-[#7a756c]'}`}
          >
            {error || helper}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});

ClayInput.displayName = 'ClayInput';

// Textarea variant
const ClayTextarea = forwardRef(({
  variant = 'default',
  size = 'md',
  label,
  error,
  helper,
  rows = 4,
  resize = true,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  const variantStyles = variants[variant] || variants.default;
  
  const baseClasses = `
    w-full font-medium
    placeholder:text-[#a39e93] placeholder:font-normal
    outline-none transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    rounded-xl
    ${sizes[size]}
    ${variantStyles.base}
    ${error ? variantStyles.error : ''}
    ${resize ? 'resize-y' : 'resize-none'}
    ${className}
  `;
  
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block mb-2 font-medium text-[#1a1f35]">
          {label}
        </label>
      )}
      
      <textarea
        ref={ref}
        rows={rows}
        className={baseClasses}
        {...props}
      />
      
      {(error || helper) && (
        <p className={`mt-2 text-sm ${error ? 'text-red-500' : 'text-[#7a756c]'}`}>
          {error || helper}
        </p>
      )}
    </div>
  );
});

ClayTextarea.displayName = 'ClayTextarea';

export { ClayInput, ClayTextarea };
export default ClayInput;
