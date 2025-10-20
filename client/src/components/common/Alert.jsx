const Alert = ({ 
  type = 'info', 
  message, 
  title,
  onClose,
  className = '' 
}) => {
  const types = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-500',
      text: 'text-green-800',
      icon: 'fa-check-circle',
      iconColor: 'text-green-500'
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-800',
      icon: 'fa-exclamation-circle',
      iconColor: 'text-red-500'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-500',
      text: 'text-yellow-800',
      icon: 'fa-exclamation-triangle',
      iconColor: 'text-yellow-500'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      text: 'text-blue-800',
      icon: 'fa-info-circle',
      iconColor: 'text-blue-500'
    }
  };

  const style = types[type] || types.info;

  if (!message) return null;

  return (
    <div 
      className={`
        ${style.bg} ${style.border} ${style.text}
        border-l-4 p-4 rounded-r-lg mb-4
        ${className}
      `}
      role="alert"
    >
      <div className="flex items-start">
        <i className={`fas ${style.icon} ${style.iconColor} mt-0.5 mr-3`}></i>
        <div className="flex-1">
          {title && (
            <p className="font-semibold mb-1">{title}</p>
          )}
          <p className="text-sm">{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;
