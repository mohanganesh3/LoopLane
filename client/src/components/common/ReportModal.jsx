import { useState } from 'react';
import reportService from '../../services/reportService';

const REPORT_CATEGORIES = [
  { value: 'RECKLESS_DRIVING', label: 'Reckless Driving', icon: 'fa-car-crash' },
  { value: 'HARASSMENT', label: 'Harassment', icon: 'fa-user-slash' },
  { value: 'INAPPROPRIATE_BEHAVIOR', label: 'Inappropriate Behavior', icon: 'fa-exclamation-triangle' },
  { value: 'VEHICLE_MISMATCH', label: 'Vehicle Mismatch', icon: 'fa-car' },
  { value: 'SMOKING', label: 'Smoking in Vehicle', icon: 'fa-smoking' },
  { value: 'UNSAFE_VEHICLE', label: 'Unsafe Vehicle', icon: 'fa-tools' },
  { value: 'ROUTE_DEVIATION', label: 'Route Deviation', icon: 'fa-map-marked-alt' },
  { value: 'OVERCHARGING', label: 'Overcharging', icon: 'fa-rupee-sign' },
  { value: 'FAKE_PROFILE', label: 'Fake Profile', icon: 'fa-user-secret' },
  { value: 'NO_SHOW', label: 'No Show', icon: 'fa-user-times' },
  { value: 'RUDE_BEHAVIOR', label: 'Rude Behavior', icon: 'fa-angry' },
  { value: 'VEHICLE_DAMAGE', label: 'Vehicle Damage', icon: 'fa-car-side' },
  { value: 'PAYMENT_DISPUTE', label: 'Payment Dispute', icon: 'fa-money-bill-wave' },
  { value: 'OTHER', label: 'Other', icon: 'fa-ellipsis-h' }
];

const SEVERITY_OPTIONS = [
  { value: 'LOW', label: 'Low', desc: 'Minor inconvenience', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'MEDIUM', label: 'Medium', desc: 'Significant issue', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'HIGH', label: 'High', desc: 'Safety concern', color: 'bg-red-100 text-red-700 border-red-300' }
];

const ReportModal = ({ isOpen, onClose, reportedUser, rideId, bookingId }) => {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [requestRefund, setRequestRefund] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!category) {
      setError('Please select a category');
      return;
    }
    if (description.length < 50) {
      setError('Description must be at least 50 characters');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await reportService.createReport({
        reportedUserId: reportedUser?._id || reportedUser,
        rideId: rideId || undefined,
        bookingId: bookingId || undefined,
        category,
        severity,
        description,
        requestRefund: requestRefund ? 'true' : 'false'
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setCategory('');
    setSeverity('MEDIUM');
    setDescription('');
    setRequestRefund(false);
    setError('');
    setSubmitted(false);
    onClose();
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-check-circle text-green-500 text-4xl"></i>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Report Submitted</h3>
          <p className="text-gray-600 mb-6">
            Our team will review your report within 24 hours. You can track the status in your reports page.
          </p>
          <button
            onClick={handleClose}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <i className="fas fa-flag text-red-500"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Report User</h3>
              <p className="text-sm text-gray-500">Step {step} of 3</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${
                s <= step ? 'bg-emerald-500' : 'bg-gray-200'
              }`} />
            ))}
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          {/* Step 1: Category */}
          {step === 1 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-1">What happened?</h4>
              <p className="text-sm text-gray-500 mb-4">Select the category that best describes the issue</p>
              <div className="grid grid-cols-2 gap-2">
                {REPORT_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => { setCategory(cat.value); setError(''); }}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex items-center gap-2 ${
                      category === cat.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <i className={`fas ${cat.icon} text-sm ${category === cat.value ? 'text-emerald-500' : 'text-gray-400'}`}></i>
                    <span className="text-sm font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    if (!category) { setError('Please select a category'); return; }
                    setStep(2);
                  }}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition"
                >
                  Continue <i className="fas fa-arrow-right ml-2"></i>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-1">Describe the issue</h4>
              <p className="text-sm text-gray-500 mb-4">Provide details so our team can investigate properly</p>

              {/* Severity */}
              <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
              <div className="flex gap-2 mb-4">
                {SEVERITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSeverity(opt.value)}
                    className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                      severity === opt.value ? opt.color + ' border-current' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs opacity-75">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {/* Description */}
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setError(''); }}
                placeholder="Describe what happened in detail. Include time, location, and any relevant context..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition resize-none"
                rows={5}
                maxLength={1000}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{description.length < 50 ? `${50 - description.length} more characters needed` : 'Looks good'}</span>
                <span>{description.length}/1000</span>
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
                >
                  <i className="fas fa-arrow-left mr-2"></i> Back
                </button>
                <button
                  onClick={() => {
                    if (description.length < 50) { setError('Description must be at least 50 characters'); return; }
                    setStep(3);
                  }}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition"
                >
                  Continue <i className="fas fa-arrow-right ml-2"></i>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-1">Review your report</h4>
              <p className="text-sm text-gray-500 mb-4">Confirm the details before submitting</p>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Category</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {REPORT_CATEGORIES.find(c => c.value === category)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Severity</span>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
                    severity === 'HIGH' ? 'bg-red-100 text-red-700' :
                    severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{severity}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Description</span>
                  <p className="text-sm text-gray-800 bg-white rounded-lg p-3 border">{description}</p>
                </div>
              </div>

              {/* Refund Request */}
              <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition mb-6">
                <input
                  type="checkbox"
                  checked={requestRefund}
                  onChange={(e) => setRequestRefund(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">Request a refund</p>
                  <p className="text-xs text-gray-500">If applicable, we'll process a refund after investigation</p>
                </div>
              </label>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
                >
                  <i className="fas fa-arrow-left mr-2"></i> Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {submitting ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i>Submitting...</>
                  ) : (
                    <><i className="fas fa-paper-plane mr-2"></i>Submit Report</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
