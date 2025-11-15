import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Alert } from '../../components/common';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  // Get the original destination if user was redirected here
  const from = location.state?.from?.pathname || '/dashboard';
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  
  // ✅ Two-Factor Authentication state
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [otp, setOtp] = useState('');

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // ✅ Include OTP if two-factor is required
      const result = await login(formData.email, formData.password, requiresTwoFactor ? otp : undefined);
      
      if (result.success) {
        // Navigate to the original destination or dashboard
        navigate(from, { replace: true });
      } else if (result.requiresTwoFactor) {
        // ✅ Show two-factor input
        setRequiresTwoFactor(true);
        setError('');
      } else if (result.redirectUrl === '/verify-otp') {
        navigate('/verify-otp');
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 py-12">
      <div className="max-w-md w-full mx-4">
        {/* Back to Home Link */}
        <Link to="/" className="inline-flex items-center text-gray-600 hover:text-emerald-600 mb-6 transition">
          <i className="fas fa-arrow-left mr-2"></i>
          Back to Home
        </Link>
        
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center space-x-2 mb-4 hover:opacity-80 transition">
              <i className="fas fa-car-side text-emerald-500 text-3xl"></i>
              <span className="text-3xl font-bold text-gray-800">LOOPLANE</span>
            </Link>
            <h2 className="text-2xl font-bold text-gray-800">Welcome Back!</h2>
            <p className="text-gray-600">Login to continue your journey</p>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          
          {/* ✅ Two-Factor Authentication Notice */}
          {requiresTwoFactor && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded-lg">
              <div className="flex items-center">
                <i className="fas fa-shield-alt text-blue-500 text-2xl mr-3"></i>
                <div>
                  <p className="font-semibold text-blue-800">Two-Factor Authentication</p>
                  <p className="text-sm text-blue-700">We've sent a 6-digit code to your email. Enter it below.</p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {!requiresTwoFactor ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <i className="fas fa-envelope absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                        validationErrors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="your@email.com"
                    />
                  </div>
                  {validationErrors.email && (
                    <p className="mt-1 text-sm text-red-500">{validationErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <i className="fas fa-lock absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                        validationErrors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                  {validationErrors.password && (
                    <p className="mt-1 text-sm text-red-500">{validationErrors.password}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="remember"
                      checked={formData.remember}
                      onChange={handleChange}
                      className="rounded text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="ml-2 text-sm text-gray-600">Remember me</span>
                  </label>
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-emerald-500 hover:text-emerald-600"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </>
            ) : (
              /* ✅ Two-Factor OTP Input */
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter 6-Digit Code
                </label>
                <div className="relative">
                  <i className="fas fa-key absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 text-center">
                  Code expires in 10 minutes
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRequiresTwoFactor(false);
                    setOtp('');
                  }}
                  className="mt-2 text-sm text-emerald-500 hover:text-emerald-600 w-full text-center"
                >
                  ← Back to login
                </button>
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              disabled={requiresTwoFactor && otp.length !== 6}
            >
              {requiresTwoFactor ? 'Verify & Login' : 'Login'}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-4 text-sm text-gray-500">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-emerald-500 hover:text-emerald-600 font-semibold">
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>By logging in, you agree to our</p>
          <span className="text-emerald-500 hover:text-emerald-600 cursor-pointer">Terms of Service</span>
          {' '}and{' '}
          <span className="text-emerald-500 hover:text-emerald-600 cursor-pointer">Privacy Policy</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
