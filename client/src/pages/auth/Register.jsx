import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Alert } from '../../components/common';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'PASSENGER',
    agreeTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: '',
    color: ''
  });

  // Password strength calculation
  useEffect(() => {
    const password = formData.password;
    let score = 0;
    
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    let label = '';
    let color = '';
    
    if (password.length === 0) {
      label = '';
      color = '';
    } else if (score <= 2) {
      label = 'Weak';
      color = 'bg-red-500';
    } else if (score <= 4) {
      label = 'Medium';
      color = 'bg-yellow-500';
    } else {
      label = 'Strong';
      color = 'bg-emerald-500';
    }
    
    setPasswordStrength({ score, label, color });
  }, [formData.password]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter');
      return false;
    }
    if (!/[a-z]/.test(formData.password)) {
      setError('Password must contain at least one lowercase letter');
      return false;
    }
    if (!/[0-9]/.test(formData.password)) {
      setError('Password must contain at least one number');
      return false;
    }
    if (!/[@$!%*?&]/.test(formData.password)) {
      setError('Password must contain at least one special character (@$!%*?&)');
      return false;
    }
    if (!/^[0-9]{10}$/.test(formData.phone)) {
      setError('Please enter a valid 10-digit phone number');
      return false;
    }
    if (!formData.agreeTerms) {
      setError('You must agree to the Terms of Service');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      const result = await register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        role: formData.role
      });

      if (result.success) {
        navigate(result.redirectUrl || '/verify-otp');
      } else {
        setError(result.message || 'Registration failed');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 py-12">
      <div className="max-w-lg w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <span className="text-emerald-500 text-3xl">🚗</span>
              <span className="text-3xl font-bold text-gray-800">LOOPLANE</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Create Account</h2>
            <p className="text-gray-600">Join the green carpooling revolution</p>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                pattern="[0-9]{10}"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="9876543210"
              />
              <p className="text-xs text-gray-500 mt-1">10-digit mobile number</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Password strength:</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength.label === 'Weak' ? 'text-red-500' :
                      passwordStrength.label === 'Medium' ? 'text-yellow-500' : 'text-emerald-500'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className={`text-xs ${formData.password.length >= 8 ? 'text-emerald-500' : 'text-gray-400'}`}>
                      {formData.password.length >= 8 ? '✓' : '○'} At least 8 characters
                    </p>
                    <p className={`text-xs ${/[A-Z]/.test(formData.password) ? 'text-emerald-500' : 'text-gray-400'}`}>
                      {/[A-Z]/.test(formData.password) ? '✓' : '○'} One uppercase letter
                    </p>
                    <p className={`text-xs ${/[a-z]/.test(formData.password) ? 'text-emerald-500' : 'text-gray-400'}`}>
                      {/[a-z]/.test(formData.password) ? '✓' : '○'} One lowercase letter
                    </p>
                    <p className={`text-xs ${/[0-9]/.test(formData.password) ? 'text-emerald-500' : 'text-gray-400'}`}>
                      {/[0-9]/.test(formData.password) ? '✓' : '○'} One number
                    </p>
                    <p className={`text-xs ${/[@$!%*?&]/.test(formData.password) ? 'text-emerald-500' : 'text-gray-400'}`}>
                      {/[@$!%*?&]/.test(formData.password) ? '✓' : '○'} One special character (@$!%*?&)
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                  formData.confirmPassword && formData.password !== formData.confirmPassword 
                    ? 'border-red-500' 
                    : formData.confirmPassword && formData.password === formData.confirmPassword
                      ? 'border-emerald-500'
                      : 'border-gray-300'
                }`}
                placeholder="Re-enter password"
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <p className="text-xs text-emerald-500 mt-1">✓ Passwords match</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                I want to...
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                  formData.role === 'PASSENGER' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400'
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value="PASSENGER"
                    checked={formData.role === 'PASSENGER'}
                    onChange={handleChange}
                    className="text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="ml-3">
                    <div className="font-semibold">Find Rides</div>
                    <div className="text-xs text-gray-500">Passenger</div>
                  </div>
                </label>
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                  formData.role === 'RIDER' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400'
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value="RIDER"
                    checked={formData.role === 'RIDER'}
                    onChange={handleChange}
                    className="text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="ml-3">
                    <div className="font-semibold">Offer Rides</div>
                    <div className="text-xs text-gray-500">Rider</div>
                  </div>
                </label>
              </div>
            </div>

            <label className="flex items-start">
              <input
                type="checkbox"
                name="agreeTerms"
                checked={formData.agreeTerms}
                onChange={handleChange}
                className="mt-1 rounded text-emerald-500 focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-600">
                I agree to the{' '}
                <Link to="/terms" className="text-emerald-500 hover:text-emerald-600">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-emerald-500 hover:text-emerald-600">
                  Privacy Policy
                </Link>
              </span>
            </label>

            <Button type="submit" loading={loading} className="w-full">
              Create Account
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-emerald-500 hover:text-emerald-600 font-semibold">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
