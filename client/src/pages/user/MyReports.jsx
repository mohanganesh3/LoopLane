import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from '../../components/common';
import { ClayCard, ClayButton, ClayBadge } from '../../components/clay';
import reportService from '../../services/reportService';

const CATEGORY_LABELS = {
  RECKLESS_DRIVING: 'Reckless Driving',
  HARASSMENT: 'Harassment',
  INAPPROPRIATE_BEHAVIOR: 'Inappropriate Behavior',
  VEHICLE_MISMATCH: 'Vehicle Mismatch',
  SMOKING: 'Smoking',
  UNSAFE_VEHICLE: 'Unsafe Vehicle',
  ROUTE_DEVIATION: 'Route Deviation',
  OVERCHARGING: 'Overcharging',
  FAKE_PROFILE: 'Fake Profile',
  NO_SHOW: 'No Show',
  RUDE_BEHAVIOR: 'Rude Behavior',
  VEHICLE_DAMAGE: 'Vehicle Damage',
  PAYMENT_DISPUTE: 'Payment Dispute',
  OTHER: 'Other'
};

const STATUS_STYLES = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'fa-clock', label: 'Pending' },
  UNDER_REVIEW: { bg: 'bg-blue-100', text: 'text-blue-800', icon: 'fa-search', label: 'Under Review' },
  RESOLVED: { bg: 'bg-green-100', text: 'text-green-800', icon: 'fa-check-circle', label: 'Resolved' },
  DISMISSED: { bg: 'bg-gray-100', text: 'text-gray-800', icon: 'fa-times-circle', label: 'Dismissed' },
  ESCALATED: { bg: 'bg-red-100', text: 'text-red-800', icon: 'fa-exclamation-triangle', label: 'Escalated' }
};

const ACTION_LABELS = {
  WARNING_ISSUED: { label: 'Warning issued to the reported user', icon: 'fa-exclamation-triangle', color: 'text-amber-600' },
  ACCOUNT_SUSPENDED: { label: 'User account has been suspended', icon: 'fa-user-lock', color: 'text-red-600' },
  ACCOUNT_BANNED: { label: 'User account has been permanently banned', icon: 'fa-gavel', color: 'text-red-700' },
  REFUND_ISSUED: { label: 'Refund has been processed', icon: 'fa-hand-holding-usd', color: 'text-emerald-600' },
  NO_ACTION: { label: 'No action required after investigation', icon: 'fa-check', color: 'text-gray-600' },
  DISMISS: { label: 'Report dismissed after review', icon: 'fa-times', color: 'text-gray-500' },
  DISMISSED: { label: 'Report dismissed after review', icon: 'fa-times', color: 'text-gray-500' },
  ESCALATED: { label: 'Escalated for further investigation', icon: 'fa-arrow-up', color: 'text-blue-600' },
};

const SLA_LABELS = {
  P1: { label: 'Critical', hours: 2, color: 'text-red-600 bg-red-50' },
  P2: { label: 'High', hours: 8, color: 'text-orange-600 bg-orange-50' },
  P3: { label: 'Medium', hours: 24, color: 'text-yellow-700 bg-yellow-50' },
  P4: { label: 'Low', hours: 72, color: 'text-blue-600 bg-blue-50' }
};

const MyReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedReport, setExpandedReport] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await reportService.getMyReports();
      setReports(data.reports || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (reportId) => {
    if (!messageInput.trim()) return;
    setSending(true);
    try {
      const data = await reportService.sendMessage(reportId, messageInput.trim());
      setReports(prev => prev.map(r =>
        r._id === reportId ? { ...r, messages: data.report?.messages || [...r.messages, { from: 'REPORTER', message: messageInput.trim(), timestamp: new Date() }] } : r
      ));
      setMessageInput('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredReports = filter === 'ALL' ? reports : reports.filter(r => r.status === filter);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen pb-12"
      style={{ background: 'var(--ll-cream, #f5f0e8)' }}
    >
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link to="/dashboard" className="text-emerald-500 hover:text-emerald-700 text-sm mb-4 inline-block">
            <i className="fas fa-arrow-left mr-2"></i>Back to Dashboard
          </Link>
          <h1
            className="text-3xl font-bold text-gray-800"
            style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}
          >
            <i className="fas fa-flag text-red-500 mr-3"></i>My Reports
          </h1>
          <p className="text-gray-600 mt-1">Track the status of your submitted reports</p>
        </motion.div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['ALL', 'PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED'].map(f => (
            <ClayButton
              key={f}
              variant={filter === f ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === 'ALL' ? 'All' : STATUS_STYLES[f]?.label || f}
              {f === 'ALL' && <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded text-xs">{reports.length}</span>}
            </ClayButton>
          ))}
        </div>

        {/* Reports List */}
        {filteredReports.length === 0 ? (
          <ClayCard variant="default" padding="lg">
            <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-inbox text-gray-400 text-3xl"></i>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {filter === 'ALL' ? 'No Reports Yet' : 'No Reports Found'}
            </h3>
            <p className="text-gray-500">
              {filter === 'ALL'
                ? "You haven't submitted any reports. Reports help keep the community safe."
                : `No reports with "${STATUS_STYLES[filter]?.label}" status.`}
            </p>
            </div>
          </ClayCard>
        ) : (
          <div className="space-y-4">
            {filteredReports.map(report => {
              const status = STATUS_STYLES[report.status] || STATUS_STYLES.PENDING;
              const isExpanded = expandedReport === report._id;
              const reportedName = report.reportedUser?.profile
                ? `${report.reportedUser.profile.firstName || ''} ${report.reportedUser.profile.lastName || ''}`.trim() || 'Unknown User'
                : 'Unknown User';

              return (
                <motion.div
                  key={report._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ClayCard variant="default" padding="none" className="overflow-hidden">
                  {/* Report Card Header */}
                  <button
                    onClick={() => setExpandedReport(isExpanded ? null : report._id)}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-full ${status.bg} flex items-center justify-center flex-shrink-0`}>
                        <i className={`fas ${status.icon} ${status.text}`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-800">
                            {CATEGORY_LABELS[report.category] || report.category}
                          </h3>
                          <ClayBadge variant={report.severity === 'HIGH' ? 'danger' : 'default'}>
                            {report.severity === 'HIGH' ? 'High Priority' : status.label}
                          </ClayBadge>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Against <span className="font-medium">{reportedName}</span> — {formatDate(report.createdAt)}
                        </p>
                      </div>
                    </div>
                    <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-400 ml-3`}></i>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t px-5 pb-5">
                      {/* Description */}
                      <div className="py-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                        <p className="text-gray-600 text-sm bg-gray-50 rounded-lg p-3">{report.description}</p>
                      </div>

                      {/* SLA & Expected Resolution */}
                      {(report.status === 'PENDING' || report.status === 'UNDER_REVIEW' || report.status === 'ESCALATED') && (
                        <div className="py-3 border-t">
                          <div className="flex items-center gap-4 flex-wrap">
                            {report.sla?.priority && (
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SLA_LABELS[report.sla.priority]?.color || 'text-gray-600 bg-gray-50'}`}>
                                <i className="fas fa-bolt mr-1"></i>
                                {SLA_LABELS[report.sla.priority]?.label || report.sla.priority} Priority
                              </span>
                            )}
                            {report.sla?.resolutionDeadline && (
                              <span className="text-xs text-gray-500">
                                <i className="fas fa-clock mr-1"></i>
                                Expected resolution by {new Date(report.sla.resolutionDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {report.investigation?.tier && (
                              <span className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full font-medium">
                                <i className="fas fa-layer-group mr-1"></i>
                                {report.investigation.tier.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Admin Review — human-readable */}
                      {report.adminReview?.reviewedBy && (
                        <div className="py-4 border-t">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">
                            <i className="fas fa-shield-alt text-emerald-500 mr-2"></i>Admin Review
                          </h4>
                          <div className="bg-emerald-50 rounded-lg p-3 space-y-2">
                            {report.adminReview.action && (() => {
                              const actionInfo = ACTION_LABELS[report.adminReview.action] || { label: report.adminReview.action.replace(/_/g, ' '), icon: 'fa-info-circle', color: 'text-gray-700' };
                              return (
                                <div className="flex items-center gap-2">
                                  <i className={`fas ${actionInfo.icon} ${actionInfo.color}`}></i>
                                  <span className={`text-sm font-semibold ${actionInfo.color}`}>{actionInfo.label}</span>
                                </div>
                              );
                            })()}
                            {report.adminReview.notes && (
                              <p className="text-sm text-gray-600 mt-1">{report.adminReview.notes}</p>
                            )}
                            {report.adminReview.reviewedAt && (
                              <p className="text-xs text-gray-500 mt-1">
                                Reviewed on {formatDate(report.adminReview.reviewedAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Refund Status — with amount */}
                      {report.refundRequested && (
                        <div className="py-3 border-t">
                          <div className="flex items-center gap-2 flex-wrap">
                            <i className="fas fa-rupee-sign text-emerald-500"></i>
                            <span className="text-sm font-medium text-gray-700">Refund:</span>
                            <span className={`text-sm font-semibold ${
                              report.refundStatus === 'APPROVED' || report.refundStatus === 'PROCESSED' ? 'text-green-600' :
                              report.refundStatus === 'REJECTED' ? 'text-red-600' : 'text-yellow-600'
                            }`}>
                              {report.refundStatus || 'PENDING'}
                            </span>
                            {report.refundAmount > 0 && (
                              <span className="text-sm font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                                ₹{report.refundAmount}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Resolution */}
                      {report.resolution?.resolved && (
                        <div className="py-3 border-t">
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <h4 className="text-sm font-semibold text-green-800 mb-1">
                              <i className="fas fa-check-circle mr-2"></i>Resolution
                            </h4>
                            <p className="text-sm text-green-700">{report.resolution.outcome}</p>
                            {report.resolution.resolvedAt && (
                              <p className="text-xs text-green-600 mt-1">
                                Resolved on {formatDate(report.resolution.resolvedAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Messages Thread */}
                      <div className="py-4 border-t">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                          <i className="fas fa-comments text-emerald-500 mr-2"></i>
                          Messages ({report.messages?.length || 0})
                        </h4>

                        {report.messages && report.messages.length > 0 ? (
                          <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                            {report.messages.map((msg, idx) => (
                              <div
                                key={idx}
                                className={`flex ${msg.from === 'REPORTER' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                                  msg.from === 'REPORTER'
                                    ? 'bg-emerald-500 text-white rounded-br-sm'
                                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                                }`}>
                                  <p className="text-sm">{msg.message}</p>
                                  <p className={`text-xs mt-1 ${msg.from === 'REPORTER' ? 'text-emerald-100' : 'text-gray-400'}`}>
                                    {msg.from === 'ADMIN' && <><i className="fas fa-shield-alt mr-1"></i>Admin — </>}
                                    {formatTime(msg.timestamp)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 mb-4">No messages yet</p>
                        )}

                        {/* Send Message */}
                        {report.status !== 'RESOLVED' && report.status !== 'DISMISSED' && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={expandedReport === report._id ? messageInput : ''}
                              onChange={(e) => setMessageInput(e.target.value)}
                              placeholder="Add a follow-up message..."
                              className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(report._id)}
                            />
                            <ClayButton
                              variant="primary"
                              size="sm"
                              onClick={() => handleSendMessage(report._id)}
                              disabled={sending || !messageInput.trim()}
                            >
                              {sending ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                            </ClayButton>
                          </div>
                        )}
                      </div>

                      {/* Ride/Booking Link */}
                      <div className="flex gap-3 pt-3 border-t">
                        {report.ride && (
                          <Link
                            to={`/rides/${report.ride._id || report.ride}`}
                            className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
                          >
                            <i className="fas fa-car"></i> View Ride
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                  </ClayCard>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MyReports;
