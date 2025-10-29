const NoResults = ({ message, onClear }) => {
  return (
    <div className="text-center py-12">
      <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No rides found</h3>
      <p className="text-gray-500 mb-4">{message || 'Try adjusting your filters or search for a different route'}</p>
      {onClear && (
        <button
          onClick={onClear}
          className="text-emerald-600 hover:text-emerald-700 font-medium"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
};

const ResultsHeader = ({ count, sortBy, onSortChange }) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <p className="text-gray-600">
        <span className="font-semibold text-gray-900">{count}</span> {count === 1 ? 'ride' : 'rides'} found
      </p>
    </div>
  );
};

const ActiveFilters = ({ filters, onRemove, onClear }) => {
  const filterLabels = {
    minPrice: `Min ₹${filters.minPrice}`,
    maxPrice: `Max ₹${filters.maxPrice}`,
    minSeats: `${filters.minSeats}+ seats`,
    minRating: `${filters.minRating}+ stars`,
    smokingAllowed: 'Smoking OK',
    petsAllowed: 'Pets OK',
    musicAllowed: 'Music',
    acAvailable: 'AC',
    verifiedOnly: 'Verified',
    driverGender: `${filters.driverGender} driver`
  };

  const activeFilters = Object.entries(filters)
    .filter(([key, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'boolean') return value;
      return value && value !== '';
    })
    .filter(([key]) => key !== 'timeSlots' && key !== 'vehicleTypes');

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-sm text-gray-500">Active filters:</span>
      {activeFilters.map(([key]) => (
        <span
          key={key}
          className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm"
        >
          {filterLabels[key] || key}
          <button
            onClick={() => onRemove(key)}
            className="ml-2 hover:text-emerald-900"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      {filters.timeSlots?.map((slot) => (
        <span
          key={slot}
          className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm"
        >
          {slot.charAt(0).toUpperCase() + slot.slice(1)}
          <button
            onClick={() => onRemove('timeSlots', slot)}
            className="ml-2 hover:text-emerald-900"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      {filters.vehicleTypes?.map((type) => (
        <span
          key={type}
          className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm"
        >
          {type.charAt(0).toUpperCase() + type.slice(1)}
          <button
            onClick={() => onRemove('vehicleTypes', type)}
            className="ml-2 hover:text-emerald-900"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <button
        onClick={onClear}
        className="text-sm text-gray-500 hover:text-gray-700 underline"
      >
        Clear all
      </button>
    </div>
  );
};

export { NoResults, ResultsHeader, ActiveFilters };
