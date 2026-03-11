import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { Alert } from '../../components/common';
import { ClayCard, ClayButton, ClayInput } from '../../components/clay';
import { getDefaultDashboardPath } from '../../utils/roles';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  // Get the original destination if user was redirected here
  const fromState = location.state?.from?.pathname;
  const fromQuery = searchParams.get('redirect');
  const from = fromState || fromQuery;

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false
  });
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
        const defaultDestination = result.redirectUrl || getDefaultDashboardPath(result.user?.role);
        const destination = from && !['/login', '/register', '/forgot-password', '/reset-password', '/verify-otp', '/admin/login'].includes(from)
          ? from
          : defaultDestination;

        navigate(destination, { replace: true });
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
    <div className="pt-16 min-h-screen flex items-center justify-center py-12" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
      <motion.div className="max-w-md w-full mx-4" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Link to="/" className="inline-flex items-center text-gray-600 hover:text-emerald-600 mb-6 transition">
          <i className="fas fa-arrow-left mr-2"></i>
          Back to Home
        </Link>

        <ClayCard variant="default" padding="lg" radius="xl">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center space-x-2 mb-4 hover:opacity-80 transition">
              <i className="fas fa-car-side text-emerald-500 text-3xl"></i>
              <span className="text-3xl font-bold" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>LOOPLANE</span>
            </Link>
            <h2 className="text-2xl font-bold text-gray-800">Welcome Back!</h2>
            <p className="text-gray-600">Login to continue your journey</p>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}

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

          <form onSubmit={handleSubmit} className="space-y-6">
            {!requiresTwoFactor ? (
              <>
                <ClayInput
                  label="Email Address"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  error={validationErrors.email}
                  icon={<i className="fas fa-envelope"></i>}
                />

                <div>
                  <ClayInput
                    label="Password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    error={validationErrors.password}
                    icon={<i className="fas fa-lock"></i>}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
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
                  <Link to="/forgot-password" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                    Forgot Password?
                  </Link>
                </div>
              </>
            ) : (
              <div>
                <ClayInput
                  label="Enter 6-Digit Code"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  icon={<i className="fas fa-key"></i>}
                  className="text-center text-2xl tracking-widest font-mono"
                />
                <p className="mt-2 text-sm text-gray-500 text-center">Code expires in 10 minutes</p>
                <button
                  type="button"
                  onClick={() => { setRequiresTwoFactor(false); setOtp(''); }}
                  className="mt-2 text-sm text-emerald-600 hover:text-emerald-700 w-full text-center"
                >
                  ← Back to login
                </button>
              </div>
            )}

            <ClayButton
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={requiresTwoFactor && otp.length !== 6}
            >
              {requiresTwoFactor ? 'Verify & Login' : 'Login'}
            </ClayButton>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-4 text-sm text-gray-400">OR</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          <div className="text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-emerald-600 hover:text-emerald-700 font-semibold">
                Sign Up
              </Link>
            </p>
          </div>
        </ClayCard>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>By logging in, you agree to our</p>
          <span className="text-emerald-600 hover:text-emerald-700 cursor-pointer">Terms of Service</span>
          {' '}and{' '}
          <span className="text-emerald-600 hover:text-emerald-700 cursor-pointer">Privacy Policy</span>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
