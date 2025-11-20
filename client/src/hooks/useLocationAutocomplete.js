import { useState, useEffect, useCallback, useRef } from 'react';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Simple in-memory cache
const searchCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Rate limiting - Nominatim allows 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

const useLocationAutocomplete = (initialValue = '') => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchSuggestions = useCallback(async (searchQuery, retryCount = 0) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      setError(null);
      return;
    }

    const cacheKey = searchQuery.toLowerCase().trim();
    
    // Check cache first
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSuggestions(cached.data);
      setLoading(false);
      setError(null);
      return;
    }

    // Rate limiting - wait if needed
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      lastRequestTime = Date.now();
      
      // Add "India" to improve search results for Indian locations
      const searchWithCountry = searchQuery.toLowerCase().includes('india') 
        ? searchQuery 
        : `${searchQuery}, India`;
      
      const response = await fetch(
        `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(searchWithCountry)}&countrycodes=in&limit=5&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'LANE-Carpool-App (carpooling app)',
            'Accept': 'application/json'
          },
          signal: abortControllerRef.current.signal
        }
      );
      
      // Check for rate limiting or server errors
      if (response.status === 429) {
        // Rate limited - wait and retry
        if (retryCount < 2) {
          console.warn('Nominatim rate limited, retrying after delay...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchSuggestions(searchQuery, retryCount + 1);
        }
        setError('Search is busy. Please wait a moment and try again.');
        setSuggestions([]);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const results = await response.json();
      
      // Cache the results
      searchCache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });
      
      // Clean old cache entries (keep only last 50)
      if (searchCache.size > 50) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
      }
      
      setSuggestions(results);
      
      if (results.length === 0) {
        setError('No locations found. Try a different spelling or add more details.');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      
      console.error('Error fetching location suggestions:', err);
      
      // Retry on network errors
      if (retryCount < 2 && (err.message.includes('fetch') || err.message.includes('network'))) {
        console.warn('Network error, retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchSuggestions(searchQuery, retryCount + 1);
      }
      
      setError('Unable to search locations. Check your internet connection.');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Increase debounce to 500ms to reduce API calls
    const debounceTimer = setTimeout(() => {
      if (query && !selectedLocation) {
        fetchSuggestions(query);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [query, fetchSuggestions, selectedLocation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const selectLocation = (location) => {
    const shortName = getShortName(location);
    setQuery(location.display_name);
    setSelectedLocation({
      type: 'Point',
      coordinates: [parseFloat(location.lon), parseFloat(location.lat)],
      address: location.display_name,
      city: shortName
    });
    setSuggestions([]);
    setError(null);
  };

  const clearSelection = () => {
    setQuery('');
    setSelectedLocation(null);
    setSuggestions([]);
    setError(null);
  };

  // Reset selectedLocation when query changes (user is typing new text)
  const handleQueryChange = (newQuery) => {
    setQuery(newQuery);
    // If user modifies the text, reset selection to allow new search
    if (selectedLocation && newQuery !== selectedLocation.address) {
      setSelectedLocation(null);
    }
  };

  const getShortName = (result) => {
    if (result.address) {
      return result.address.city ||
        result.address.town ||
        result.address.village ||
        result.address.state_district ||
        result.address.state ||
        result.name;
    }
    return result.name || result.display_name.split(',')[0];
  };

  const getLocationIcon = (type) => {
    const iconMap = {
      'city': 'fa-city',
      'town': 'fa-building',
      'village': 'fa-home',
      'state': 'fa-map',
      'administrative': 'fa-map-marked-alt',
      'road': 'fa-road',
      'railway': 'fa-train',
      'airport': 'fa-plane'
    };
    return iconMap[type] || 'fa-map-marker-alt';
  };

  return {
    query,
    setQuery: handleQueryChange,
    suggestions,
    loading,
    error,
    selectedLocation,
    selectLocation,
    clearSelection,
    getShortName,
    getLocationIcon
  };
};

export default useLocationAutocomplete;
