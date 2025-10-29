import { useState } from 'react';

const SearchFilters = ({ filters, onFilterChange, onApply, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:hidden flex items-center justify-between p-4 text-left"
      >
        <span className="font-medium text-gray-900">Filters</span>
        <svg
          className={`w-5 h-5 text-gray-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Filter Content */}
      <div className={`${isOpen ? 'block' : 'hidden'} md:block p-4 space-y-6`}>
        <h3 className="font-semibold text-gray-900 text-lg hidden md:block">Filter Rides</h3>

        {/* Price Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              placeholder="Min"
              value={filters.minPrice || ''}
              onChange={(e) => onFilterChange('minPrice', e.target.value)}
              className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxPrice || ''}
              onChange={(e) => onFilterChange('maxPrice', e.target.value)}
              className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Time of Day */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Departure Time</label>
          <div className="space-y-2">
            {['Morning (6AM-12PM)', 'Afternoon (12PM-5PM)', 'Evening (5PM-9PM)', 'Night (9PM-6AM)'].map((time, idx) => (
              <label key={idx} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.timeSlots?.includes(time.split(' ')[0].toLowerCase())}
                  onChange={(e) => {
                    const slot = time.split(' ')[0].toLowerCase();
                    const current = filters.timeSlots || [];
                    if (e.target.checked) {
                      onFilterChange('timeSlots', [...current, slot]);
                    } else {
                      onFilterChange('timeSlots', current.filter(t => t !== slot));
                    }
                  }}
                  className="h-4 w-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
                />
                <span className="ml-2 text-sm text-gray-600">{time}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Available Seats */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Seats</label>
          <select
            value={filters.minSeats || ''}
            onChange={(e) => onFilterChange('minSeats', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">Any</option>
            <option value="1">1+ seat</option>
            <option value="2">2+ seats</option>
            <option value="3">3+ seats</option>
            <option value="4">4+ seats</option>
          </select>
        </div>

        {/* Vehicle Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
          <div className="space-y-2">
            {['Car', 'SUV', 'Bike', 'Auto'].map((type) => (
              <label key={type} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.vehicleTypes?.includes(type.toLowerCase())}
                  onChange={(e) => {
                    const current = filters.vehicleTypes || [];
                    if (e.target.checked) {
                      onFilterChange('vehicleTypes', [...current, type.toLowerCase()]);
                    } else {
                      onFilterChange('vehicleTypes', current.filter(t => t !== type.toLowerCase()));
                    }
                  }}
                  className="h-4 w-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
                />
                <span className="ml-2 text-sm text-gray-600">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Rating Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onFilterChange('minRating', filters.minRating === star ? 0 : star)}
                className={`p-1 ${filters.minRating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
            <span className="text-sm text-gray-500 ml-2">& up</span>
          </div>
        </div>

        {/* Ride Preferences */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ride Preferences</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.smokingAllowed || false}
                onChange={(e) => onFilterChange('smokingAllowed', e.target.checked)}
                className="h-4 w-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-600">Smoking allowed</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.petsAllowed || false}
                onChange={(e) => onFilterChange('petsAllowed', e.target.checked)}
                className="h-4 w-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-600">Pets allowed</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.musicAllowed || false}
                onChange={(e) => onFilterChange('musicAllowed', e.target.checked)}
                className="h-4 w-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-600">Music on</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.acAvailable || false}
                onChange={(e) => onFilterChange('acAvailable', e.target.checked)}
                className="h-4 w-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-600">AC available</span>
            </label>
          </div>
        </div>

        {/* Gender Preference */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Driver Gender</label>
          <select
            value={filters.driverGender || ''}
            onChange={(e) => onFilterChange('driverGender', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">Any</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>

        {/* Verified Only */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.verifiedOnly || false}
              onChange={(e) => onFilterChange('verifiedOnly', e.target.checked)}
              className="h-4 w-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
            />
            <span className="ml-2 text-sm text-gray-700 font-medium">Verified drivers only</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-gray-200 space-y-2">
          <button
            onClick={onApply}
            className="w-full py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
          >
            Apply Filters
          </button>
          <button
            onClick={onClear}
            className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchFilters;
