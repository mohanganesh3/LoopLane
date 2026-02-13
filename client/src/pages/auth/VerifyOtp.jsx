import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Alert } from '../../components/common';
import authService from '../../services/authService';

const VerifyOtp = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authService.verifyOtp(otp);
      
      if (result.success) {
        setSuccess('Verification successful! Logging you in...');
        
        // Clear the pending user ID from localStorage
        localStorage.removeItem('pendingUserId');
        
        // ✅ Refresh user data from server to update auth context
        await refreshUser();
        
        setTimeout(() => {
          // Use the redirectUrl from server, fallback to /dashboard
          const redirectUrl = result.redirectUrl || '/dashboard';
          navigate(redirectUrl);
        }, 1000);
      } else {
        setError(result.message || 'Invalid OTP');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    
    setError('');
    setCanResend(false);
    setCountdown(60);

    try {
      const result = await authService.resendOtp();
      if (result.success) {
        setSuccess('New OTP sent!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setError('Failed to resend OTP. Please try again.');
    }
  };

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 6) {
      setOtp(value);
    }
  };

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 py-12">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-envelope text-white text-3xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Verify OTP</h2>
            <p className="text-gray-600 mt-2">
              Enter the 6-digit code sent to your email
            </p>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {success && <Alert type="success" message={success} />}

          {/* OTP Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                Enter OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={handleOtpChange}
                maxLength="6"
                required
                pattern="[0-9]{6}"
                className="w-full text-center text-2xl font-bold px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent tracking-widest"
                placeholder="000000"
              />
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Verify OTP
            </Button>
          </form>

          {/* Resend Section */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm mb-2">Didn't receive the code?</p>
            <button
              onClick={handleResendOtp}
              disabled={!canResend}
              className={`font-semibold text-sm ${
                canResend 
                  ? 'text-emerald-500 hover:text-emerald-600 cursor-pointer' 
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              Resend OTP
            </button>
            <p className="text-xs text-gray-500 mt-2">
              <i className="fas fa-clock mr-1"></i>
              {canResend 
                ? 'You can resend now' 
                : `Resend available in ${countdown}s`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
