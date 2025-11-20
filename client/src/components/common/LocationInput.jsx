import { useState, useRef, useEffect, useCallback } from 'react';
import useLocationAutocomplete from '../../hooks/useLocationAutocomplete';

const LocationInput = ({
  label,
  placeholder,
  icon,
  iconColor = 'text-emerald-500',
  value,
  onChange,
  required = false
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);
  const onChangeRef = useRef(onChange);
  
  // Keep onChange ref up to date without triggering effects
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  
  const {
    query,
    setQuery,
    suggestions,
    loading,
    error,
    selectedLocation,
    selectLocation,
    getShortName,
    getLocationIcon
  } = useLocationAutocomplete(value?.address || '');

  // Use callback ref to avoid dependency issues
  useEffect(() => {
    if (selectedLocation && onChangeRef.current) {
      onChangeRef.current(selectedLocation);
    }
  }, [selectedLocation]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setShowSuggestions(true);
  };

  const handleSelect = (location) => {
    selectLocation(location);
    setShowSuggestions(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-gray-700 font-medium mb-2">
        <i className={`fas ${icon} ${iconColor} mr-2`}></i>
        {label}
      </label>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      
      {/* Suggestions Dropdown */}
      {showSuggestions && (query.length >= 3 || suggestions.length > 0) && (
        <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-gray-500 text-sm flex items-center">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Searching...
            </div>
          ) : error && suggestions.length === 0 ? (
            <div className="p-3 text-amber-600 text-sm flex items-start">
              <i className="fas fa-exclamation-triangle mr-2 mt-0.5"></i>
              <div>
                <div>{error}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Tip: Try city names like "Chennai", "Bangalore", "Nellore"
                </div>
              </div>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="p-3 text-gray-500 text-sm">
              {query.length >= 3 ? 'No locations found. Try different spelling.' : 'Type at least 3 characters'}
            </div>
          ) : (
            suggestions.map((result, index) => (
              <div
                key={index}
                className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 transition"
                onClick={() => handleSelect(result)}
              >
                <div className="flex items-start">
                  <i className={`fas ${getLocationIcon(result.type)} text-emerald-500 mr-3 mt-1`}></i>
                  <div className="flex-1">
                    <div className="font-medium text-gray-800 text-sm">
                      {getShortName(result)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {result.display_name}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LocationInput;
