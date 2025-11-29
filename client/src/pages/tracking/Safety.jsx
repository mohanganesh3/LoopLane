import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';

const Safety = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingId, driverLocation } = location.state || {};
  
  const [countdown, setCountdown] = useState(10);
  const [activated, setActivated] = useState(false);
  const [calling, setCalling] = useState(false);
  const [emergency, setEmergency] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let timer;
    if (activated && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && activated) {
      triggerEmergency();
    }
    return () => clearInterval(timer);
  }, [activated, countdown]);

  const triggerEmergency = async () => {
    setCalling(true);
    try {
      // Get current location
      let currentLocation = driverLocation;
      if (!currentLocation && navigator.geolocation) {
        currentLocation = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            }),
            (err) => resolve(null),
            { timeout: 5000 }
          );
        });
      }

      // Call Safety API
      const response = await api.post('/api/sos/trigger', {
        location: {
          latitude: currentLocation?.latitude || currentLocation?.lat,
          longitude: currentLocation?.longitude || currentLocation?.lng,
          address: currentLocation?.address || null
        },
        type: 'SAFETY',
        description: 'Safety alert triggered by user',
        bookingId
      });

      if (response.data.success) {
        setEmergency(response.data.emergency);
      } else {
        setError(response.data.message || 'Failed to trigger safety alert');
      }
    } catch (err) {
      console.error('Safety Error:', err);
      setError(err.response?.data?.message || 'Failed to trigger safety alert. Please call emergency services directly.');
    }
  };

  const handleCancelEmergency = async () => {
    if (!emergency?._id) return;
    
    try {
      await api.post(`/api/sos/${emergency._id}/cancel`, {
        reason: 'False alarm - cancelled by user'
      });
      navigate(-1);
    } catch (err) {
      console.error('Cancel error:', err);
      navigate(-1);
    }
  };

  const handleActivateSafety = () => {
    setActivated(true);
  };

  const handleCancel = () => {
    setActivated(false);
    setCountdown(10);
  };

  if (calling) {
    return (
      <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center px-4">
        <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center mb-8 animate-pulse">
          <svg className="w-16 h-16 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">
          {emergency ? 'Safety Alert Active' : 'Activating Safety Alert'}
        </h1>
        <p className="text-white/80 text-center mb-8">
          {emergency 
            ? 'Emergency contacts have been notified with your location'
            : 'Emergency contacts are being notified with your location'
          }
        </p>
        
        {error && (
          <div className="bg-white/20 rounded-lg p-4 mb-4 w-full max-w-sm">
            <p className="text-white text-sm text-center">{error}</p>
          </div>
        )}
        
        <div className="bg-white/20 rounded-lg p-4 mb-8 w-full max-w-sm">
          <p className="text-white text-sm text-center">
            {emergency 
              ? `Alert ID: ${emergency._id?.slice(-8).toUpperCase()}`
              : 'Your location is being shared with emergency contacts'
            }
          </p>
        </div>

        <div className="flex gap-4">
          {emergency && (
            <button
              onClick={handleCancelEmergency}
              className="px-6 py-3 bg-white text-red-600 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              False Alarm - Cancel
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            className="text-white/80 hover:text-white px-6 py-3"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 text-white p-2"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {!activated ? (
        <>
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-4">Safety Alert</h1>
            <p className="text-gray-400">Press the button below if you need help</p>
          </div>

          <button
            onClick={handleActivateSafety}
            className="w-48 h-48 rounded-full bg-red-600 hover:bg-red-700 transition shadow-lg shadow-red-600/50 flex items-center justify-center mb-12"
          >
            <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </button>

          <div className="text-center text-gray-400 text-sm max-w-xs">
            <p className="mb-4">This will:</p>
            <ul className="space-y-2 text-left">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Alert your emergency contacts</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Share your live location</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Notify LOOPLANE support team</span>
              </li>
            </ul>
          </div>
        </>
      ) : (
        <>
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-4">Activating Safety Alert</h1>
            <p className="text-gray-400">Alert will be sent in</p>
          </div>

          <div className="w-48 h-48 rounded-full bg-red-600 flex items-center justify-center mb-8 relative">
            <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="white"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(countdown / 10) * 283} 283`}
              />
            </svg>
            <span className="text-white text-6xl font-bold">{countdown}</span>
          </div>

          <button
            onClick={handleCancel}
            className="w-full max-w-xs py-4 px-6 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition"
          >
            Cancel
          </button>

          <p className="text-gray-500 text-sm mt-6">
            Press cancel if this was a mistake
          </p>
        </>
      )}

      {/* Emergency Contacts Quick Access */}
      <div className="absolute bottom-8 left-0 right-0 px-4">
        <div className="bg-gray-800 rounded-lg p-4 max-w-sm mx-auto">
          <p className="text-gray-400 text-xs mb-3">Quick call</p>
          <div className="flex justify-around">
            <a href="tel:100" className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center mb-1">
                <span className="text-white text-xs font-bold">100</span>
              </div>
              <span className="text-gray-400 text-xs">Police</span>
            </a>
            <a href="tel:108" className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center mb-1">
                <span className="text-white text-xs font-bold">108</span>
              </div>
              <span className="text-gray-400 text-xs">Ambulance</span>
            </a>
            <a href="tel:1800-123-4567" className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center mb-1">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="text-gray-400 text-xs">Support</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Safety;
