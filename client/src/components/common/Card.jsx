const Card = ({
  children,
  title,
  subtitle,
  icon,
  headerAction,
  footer,
  padding = true,
  hover = false,
  className = ''
}) => {
  return (
    <div 
      className={`
        bg-white rounded-xl shadow-md overflow-hidden
        ${hover ? 'hover:shadow-lg transition-shadow duration-300' : ''}
        ${className}
      `}
    >
      {/* Header */}
      {(title || headerAction) && (
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center">
            {icon && (
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                <i className={`fas fa-${icon} text-emerald-600`}></i>
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              )}
              {subtitle && (
                <p className="text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
          </div>
          {headerAction && (
            <div>{headerAction}</div>
          )}
        </div>
      )}

      {/* Body */}
      <div className={padding ? 'p-4' : ''}>
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
