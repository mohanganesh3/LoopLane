const LoadingSpinner = ({ 
  size = 'md', 
  color = 'emerald',
  text,
  fullScreen = false,
  className = '' 
}) => {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const colors = {
    emerald: 'border-emerald-500',
    white: 'border-white',
    gray: 'border-gray-500'
  };

  const spinner = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div 
        className={`
          ${sizes[size]} 
          border-4 border-gray-200 
          ${colors[color]}
          border-t-transparent
          rounded-full animate-spin
        `}
      ></div>
      {text && (
        <p className="mt-3 text-gray-600 text-sm">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
