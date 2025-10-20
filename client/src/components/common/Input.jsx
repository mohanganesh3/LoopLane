import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  error,
  helperText,
  icon,
  disabled = false,
  required = false,
  className = '',
  ...props
}, ref) => {
  const baseInputClasses = `
    w-full px-4 py-3 rounded-lg border transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
    disabled:bg-gray-100 disabled:cursor-not-allowed
  `;

  const inputStateClasses = error
    ? 'border-red-500 focus:ring-red-500'
    : 'border-gray-300 hover:border-gray-400';

  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label 
          htmlFor={name} 
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className={`fas fa-${icon} text-gray-400`}></i>
          </div>
        )}
        <input
          ref={ref}
          type={type}
          name={name}
          id={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            ${baseInputClasses}
            ${inputStateClasses}
            ${icon ? 'pl-10' : ''}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-500 flex items-center">
          <i className="fas fa-exclamation-circle mr-1"></i>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
