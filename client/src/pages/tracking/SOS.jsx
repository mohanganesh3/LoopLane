import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const SOS = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingId, driverLocation } = location.state || {};
  
  const [countdown, setCountdown] = useState(10);
  const [activated, setActivated] = useState(false);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    let timer;
    if (activated && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      triggerEmergency();
    }
    return () => clearInterval(timer);
  }, [activated, countdown]);

  const triggerEmergency = async () => {
    setCalling(true);
    // In production, this would:
    // 1. Call emergency contacts
    // 2. Share live location with contacts
    // 3. Alert local authorities if configured
    // 4. Send notification to LOOPLANE support
    
    // Simulate emergency call
    setTimeout(() => {
      setCalling(true);
    }, 1000);
  };

  const handleActivateSOS = () => {
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">Calling Emergency Services</h1>
        <p className="text-white/80 text-center mb-8">
          Emergency contacts are being notified with your location
        </p>
        
        <div className="bg-white/20 rounded-lg p-4 mb-8 w-full max-w-sm">
          <p className="text-white text-sm text-center">
            Your location is being shared with emergency contacts
          </p>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="text-white/80 hover:text-white"
        >
          Go Back
        </button>
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
            <h1 className="text-3xl font-bold text-white mb-4">Emergency SOS</h1>
            <p className="text-gray-400">Press the button below if you need help</p>
          </div>

          <button
            onClick={handleActivateSOS}
            className="w-48 h-48 rounded-full bg-red-600 hover:bg-red-700 transition shadow-lg shadow-red-600/50 flex items-center justify-center mb-12"
          >
            <span className="text-white text-4xl font-bold">SOS</span>
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
            <h1 className="text-3xl font-bold text-white mb-4">Activating SOS</h1>
            <p className="text-gray-400">Emergency will be triggered in</p>
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

export default SOS;
