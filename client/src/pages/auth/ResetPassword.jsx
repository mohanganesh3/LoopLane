import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Alert } from '../../components/common';
import authService from '../../services/authService';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState({
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  useEffect(() => {
    if (!sessionStorage.getItem('passwordResetEmail')) {
      setError('Reset session expired. Request a new reset code.');
    }
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const checkPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    return strength;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'otp') {
      const cleanValue = value.replace(/[^0-9]/g, '');
      if (cleanValue.length <= 6) {
        setFormData(prev => ({ ...prev, [name]: cleanValue }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (name === 'newPassword') {
        setPasswordStrength(checkPasswordStrength(value));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (timeLeft <= 0) {
      setError('Reset code has expired. Please request a new one.');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength < 100) {
      setError('Please meet all password requirements');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.resetPassword(
        formData.otp,
        formData.newPassword,
        formData.confirmPassword
      );

      if (result.success) {
        setSuccess(result.message || 'Password reset successful!');
        sessionStorage.removeItem('passwordResetEmail');
        setTimeout(() => {
          navigate(result.redirectUrl || '/login');
        }, 2000);
      } else {
        setError(result.message || 'Failed to reset password');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength < 50) return 'bg-red-500';
    if (passwordStrength < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (passwordStrength < 50) return { text: 'Weak password', color: 'text-red-600' };
    if (passwordStrength < 75) return { text: 'Medium strength', color: 'text-yellow-600' };
    return { text: 'Strong password', color: 'text-green-600' };
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-16 min-h-screen flex items-center justify-center py-12" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Back Button */}
          <div className="mb-6">
            <Link 
              to="/forgot-password" 
              className="inline-flex items-center text-gray-600 hover:text-emerald-500 transition-colors"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              <span>Request New Code</span>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                <i className="fas fa-key text-white text-2xl"></i>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>Reset Your Password</h2>
            <p className="text-gray-600 text-sm">
              Enter the code sent to your email and create a new password
            </p>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {success && <Alert type="success" message={success} />}

          {timeLeft <= 0 && (
            <Alert 
              type="error" 
              title="Code Expired"
              message="Your reset code has expired. Please request a new one."
            />
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OTP Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-shield-alt mr-1 text-emerald-500"></i>
                Reset Code
              </label>
              <input
                type="text"
                name="otp"
                value={formData.otp}
                onChange={handleChange}
                maxLength="6"
                required
                disabled={timeLeft <= 0}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center text-2xl font-bold tracking-widest disabled:bg-gray-100"
                placeholder="000000"
              />
              <p className={`mt-2 text-xs flex items-center ${timeLeft <= 60 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                <i className="fas fa-clock mr-1"></i>
                Code expires in <span className="font-semibold ml-1">
                  {timeLeft > 0 ? formatTime(timeLeft) : 'Expired'}
                </span>
              </p>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-lock mr-1 text-emerald-500"></i>
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword.new ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  minLength="8"
                  disabled={timeLeft <= 0}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className={`fas ${showPassword.new ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              
              {/* Password Strength */}
              {formData.newPassword && (
                <div className="mt-2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                      style={{ width: `${passwordStrength}%` }}
                    ></div>
                  </div>
                  <p className={`text-xs mt-1 ${getStrengthText().color}`}>
                    {getStrengthText().text}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-lock mr-1 text-emerald-500"></i>
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword.confirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength="8"
                  disabled={timeLeft <= 0}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className={`fas ${showPassword.confirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              {formData.confirmPassword && (
                <p className={`mt-2 text-xs ${
                  formData.newPassword === formData.confirmPassword 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  <i className={`fas ${
                    formData.newPassword === formData.confirmPassword 
                      ? 'fa-check-circle' 
                      : 'fa-times-circle'
                  } mr-1`}></i>
                  {formData.newPassword === formData.confirmPassword 
                    ? 'Passwords match' 
                    : 'Passwords do not match'
                  }
                </p>
              )}
            </div>

            {/* Password Requirements */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-xs text-blue-700 font-semibold mb-2">Password Requirements:</p>
              <ul className="text-xs text-blue-600 space-y-1">
                <li className={formData.newPassword.length >= 8 ? 'text-green-600' : ''}>
                  <i className={`fas ${formData.newPassword.length >= 8 ? 'fa-check-circle text-green-500' : 'fa-circle text-gray-400'} mr-2`} style={{ fontSize: '6px' }}></i>
                  At least 8 characters
                </li>
                <li className={/[A-Z]/.test(formData.newPassword) ? 'text-green-600' : ''}>
                  <i className={`fas ${/[A-Z]/.test(formData.newPassword) ? 'fa-check-circle text-green-500' : 'fa-circle text-gray-400'} mr-2`} style={{ fontSize: '6px' }}></i>
                  One uppercase letter
                </li>
                <li className={/[a-z]/.test(formData.newPassword) ? 'text-green-600' : ''}>
                  <i className={`fas ${/[a-z]/.test(formData.newPassword) ? 'fa-check-circle text-green-500' : 'fa-circle text-gray-400'} mr-2`} style={{ fontSize: '6px' }}></i>
                  One lowercase letter
                </li>
                <li className={/[0-9]/.test(formData.newPassword) ? 'text-green-600' : ''}>
                  <i className={`fas ${/[0-9]/.test(formData.newPassword) ? 'fa-check-circle text-green-500' : 'fa-circle text-gray-400'} mr-2`} style={{ fontSize: '6px' }}></i>
                  One number
                </li>
              </ul>
            </div>

            <Button 
              type="submit" 
              loading={loading} 
              disabled={timeLeft <= 0}
              className="w-full"
            >
              <i className="fas fa-check-circle mr-2"></i>
              Reset Password
            </Button>
          </form>

          {/* Resend Code */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Didn't receive the code?{' '}
              <Link to="/forgot-password" className="text-emerald-500 hover:text-emerald-600 font-semibold">
                Resend Code
              </Link>
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 flex items-center justify-center">
            <i className="fas fa-lock mr-2"></i>
            Your password will be encrypted and stored securely
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default ResetPassword;
