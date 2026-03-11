import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Alert } from '../../components/common';
import authService from '../../services/authService';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await authService.forgotPassword(email);
      
      if (result.success) {
        sessionStorage.setItem('passwordResetEmail', email.trim().toLowerCase());
        setSuccess(result.message || 'Reset code sent to your email!');
        setTimeout(() => {
          navigate(result.redirectUrl || '/reset-password');
        }, 2000);
      } else {
        setError(result.message || 'Failed to send reset code');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-16 min-h-screen flex items-center justify-center py-12" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Back Button */}
          <div className="mb-6">
            <Link 
              to="/login" 
              className="inline-flex items-center text-gray-600 hover:text-emerald-500 transition-colors"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              <span>Back to Login</span>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                <i className="fas fa-lock text-white text-2xl"></i>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>Forgot Password?</h2>
            <p className="text-gray-600 text-sm">
              No worries! Enter your email and we'll send you a reset code.
            </p>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {success && <Alert type="success" message={success} />}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-envelope mr-1 text-emerald-500"></i>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Enter your registered email"
              />
              <p className="mt-2 text-xs text-gray-500">
                <i className="fas fa-info-circle mr-1"></i>
                Enter the email you used to register your account
              </p>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              <i className="fas fa-paper-plane mr-2"></i>
              Send Reset Code
            </Button>
          </form>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <i className="fas fa-info-circle text-blue-500"></i>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700 font-semibold">
                    What happens next?
                  </p>
                  <ul className="mt-2 text-xs text-blue-600 space-y-1">
                    <li>• You'll receive a 6-digit code via email</li>
                    <li>• The code is valid for 10 minutes</li>
                    <li>• Enter the code on the next page to reset your password</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <Link to="/login" className="text-emerald-500 hover:text-emerald-600 font-semibold">
                Login here
              </Link>
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 flex items-center justify-center">
            <i className="fas fa-shield-alt mr-2"></i>
            Your security is our priority. We'll never ask for your password via email.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default ForgotPassword;
