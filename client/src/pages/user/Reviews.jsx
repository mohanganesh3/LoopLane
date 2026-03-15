import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import reviewService from '../../services/reviewService';
import { useAuth } from '../../context/AuthContext';

const Reviews = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('received');
  const [reviews, setReviews] = useState([]);
  const [receivedCount, setReceivedCount] = useState(0);
  const [givenCount, setGivenCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [ratingBreakdown, setRatingBreakdown] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  // G2: Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const reviewsPerPage = 5;
  // I10: Edit/delete state
  const [editingReview, setEditingReview] = useState(null);
  const [editComment, setEditComment] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [deletingReview, setDeletingReview] = useState(null);

  useEffect(() => {
    fetchReviews();
  }, [activeTab, currentPage]);

  useEffect(() => {
    fetchStats();
    fetchCounts();
  }, [user]);

  // Reset page when switching tabs
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const data = activeTab === 'received' 
        ? await reviewService.getMyReceivedReviews(currentPage, reviewsPerPage)
        : await reviewService.getMyGivenReviews(currentPage, reviewsPerPage);
      setReviews(data.reviews || []);
      if (data.ratingBreakdown) setRatingBreakdown(data.ratingBreakdown);
      // G2: Set pagination
      setTotalPages(data.totalPages || Math.ceil((data.totalReviews || data.reviews?.length || 0) / reviewsPerPage) || 1);
    } catch (err) {
      setError('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      // Fetch both counts
      const [received, given] = await Promise.all([
        reviewService.getMyReceivedReviews(),
        reviewService.getMyGivenReviews()
      ]);
      setReceivedCount(received.totalReviews || 0);
      setGivenCount(given.totalReviews || 0);
    } catch (err) {
      console.error('Failed to load counts:', err);
    }
  };

  const fetchStats = async () => {
    try {
      if (user?._id) {
        const data = await reviewService.getUserReviewStats(user._id);
        setStats(data.stats || data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Get rating from review - handles both old and new schema
  const getRating = (review) => {
    return review.ratings?.overall || review.rating || 0;
  };

  const renderStars = (rating) => (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-5 h-5 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-2 text-gray-600">{Number(rating || 0).toFixed(1)}</span>
    </div>
  );

  const handleRespondToReview = async (reviewId) => {
    if (!responseText.trim()) return;
    setSubmittingResponse(true);
    try {
      await reviewService.respondToReview(reviewId, responseText.trim());
      setRespondingTo(null);
      setResponseText('');
      fetchReviews();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleMarkHelpful = async (reviewId) => {
    try {
      await reviewService.markAsHelpful(reviewId);
      setReviews(prev => prev.map(r => 
        r._id === reviewId ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r
      ));
    } catch (err) {
      console.error('Failed to mark as helpful:', err);
    }
  };

  // I10: Edit review handler
  const handleEditReview = async (reviewId) => {
    if (!editComment.trim() && !editRating) return;
    try {
      await reviewService.updateReview(reviewId, { 
        comment: editComment, 
        rating: editRating 
      });
      setEditingReview(null);
      setEditComment('');
      setEditRating(0);
      fetchReviews();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update review');
    }
  };

  // I10: Delete review handler
  const handleDeleteReview = async (reviewId) => {
    try {
      await reviewService.deleteReview(reviewId);
      setDeletingReview(null);
      fetchReviews();
      fetchCounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete review');
    }
  };

  const totalBreakdown = Object.values(ratingBreakdown).reduce((a, b) => a + b, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-8" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>My Reviews</h1>
          <p className="text-gray-600 mt-2">View and manage your reviews</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Average Rating</p>
            <p className="text-2xl font-bold text-gray-900">
              {Number(stats?.averageRating || 0).toFixed(1)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Reviews Received</p>
            <p className="text-2xl font-bold text-gray-900">{receivedCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">Reviews Given</p>
            <p className="text-2xl font-bold text-gray-900">{givenCount}</p>
          </div>
        </div>

        {/* Rating Breakdown */}
        {activeTab === 'received' && totalBreakdown > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Rating Breakdown</h3>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map(star => (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-12">{star} star</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-yellow-400 h-2.5 rounded-full transition-all"
                      style={{ width: `${totalBreakdown > 0 ? (ratingBreakdown[star] / totalBreakdown) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-500 w-8 text-right">{ratingBreakdown[star]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('received')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'received'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Reviews Received
          </button>
          <button
            onClick={() => setActiveTab('given')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'given'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Reviews Given
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reviews yet</h3>
            <p className="text-gray-500">Complete more rides to receive reviews.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const personData = activeTab === 'received' ? review.reviewer : review.reviewee;
              const displayName = personData?.profile?.firstName 
                ? `${personData.profile.firstName} ${personData.profile.lastName || ''}`
                : personData?.name || 'Anonymous';
              const displayInitial = (personData?.profile?.firstName || personData?.name || 'A')?.[0]?.toUpperCase();
              const personPhoto = personData?.profile?.photo || personData?.profilePhoto;
              const reviewRating = getRating(review);
              
              return (
                <div key={review._id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      {personPhoto ? (
                        <img
                          src={personPhoto}
                          alt={displayName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                          <span className="text-xl font-bold text-emerald-600">{displayInitial}</span>
                        </div>
                      )}
                      <div className="ml-4">
                        <h4 className="font-medium text-gray-900">{displayName}</h4>
                        <p className="text-sm text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {renderStars(reviewRating)}
                  </div>
                  {review.comment && <p className="mt-4 text-gray-700">{review.comment}</p>}
                  
                  {/* G4: Review Photos */}
                  {review.photos && review.photos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {review.photos.map((photo, idx) => (
                        <a key={idx} href={photo} target="_blank" rel="noopener noreferrer">
                          <img src={photo} alt={`Review photo ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition" />
                        </a>
                      ))}
                    </div>
                  )}
                  
                  {/* Show tags if any */}
                  {review.tags && review.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {review.tags.map((tag, idx) => (
                        <span 
                          key={idx} 
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full"
                        >
                          {tag.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Existing Response */}
                  {review.response?.text && (
                    <div className="mt-4 ml-6 pl-4 border-l-2 border-emerald-300 bg-emerald-50 rounded-r-lg p-3">
                      <p className="text-xs font-semibold text-emerald-700 mb-1">
                        <i className="fas fa-reply mr-1"></i>Response
                      </p>
                      <p className="text-sm text-gray-700">{review.response.text}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(review.response.respondedAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {/* Respond Form (only for received reviews without response) */}
                  {activeTab === 'received' && !review.response?.text && (
                    respondingTo === review._id ? (
                      <div className="mt-4 ml-6 border-l-2 border-gray-200 pl-4">
                        <textarea
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Write your response..."
                          maxLength={500}
                          rows={3}
                          className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400">{responseText.length}/500</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setRespondingTo(null); setResponseText(''); }}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleRespondToReview(review._id)}
                              disabled={submittingResponse || !responseText.trim()}
                              className="px-4 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                            >
                              {submittingResponse ? 'Sending...' : 'Reply'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRespondingTo(review._id)}
                        className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        <i className="fas fa-reply mr-1"></i>Respond
                      </button>
                    )
                  )}

                  {/* I10: Edit/Delete + Helpful button (for given reviews) */}
                  {activeTab === 'given' && (
                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                      <button
                        onClick={() => handleMarkHelpful(review._id)}
                        className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
                      >
                        <i className="far fa-thumbs-up"></i>
                        Helpful {review.helpfulCount > 0 && `(${review.helpfulCount})`}
                      </button>
                      <button
                        onClick={() => { setEditingReview(review._id); setEditComment(review.comment || ''); setEditRating(getRating(review)); }}
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                      >
                        <i className="fas fa-edit"></i> Edit
                      </button>
                      <button
                        onClick={() => setDeletingReview(review._id)}
                        className="flex items-center gap-1 hover:text-red-600 transition-colors"
                      >
                        <i className="fas fa-trash-alt"></i> Delete
                      </button>
                    </div>
                  )}

                  {/* I10: Edit form */}
                  {editingReview === review._id && (
                    <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-gray-600">Rating:</span>
                        {[1,2,3,4,5].map(star => (
                          <button key={star} onClick={() => setEditRating(star)} className={`text-xl ${star <= editRating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>
                        ))}
                      </div>
                      <textarea value={editComment} onChange={(e) => setEditComment(e.target.value)}
                        rows={2} className="w-full border rounded-lg p-2 text-sm mb-2" placeholder="Update your review..." />
                      <div className="flex gap-2">
                        <button onClick={() => handleEditReview(review._id)} className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600">Save</button>
                        <button onClick={() => setEditingReview(null)} className="px-3 py-1 text-sm text-gray-600">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* I10: Delete confirmation */}
                  {deletingReview === review._id && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 flex items-center justify-between">
                      <span className="text-sm text-red-700">Delete this review permanently?</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleDeleteReview(review._id)} className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">Delete</button>
                        <button onClick={() => setDeletingReview(null)} className="px-3 py-1 text-sm text-gray-600">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* G2: Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, currentPage - 3),
                  Math.min(totalPages, currentPage + 2)
                ).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      page === currentPage ? 'bg-emerald-500 text-white' : 'border border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Reviews;
