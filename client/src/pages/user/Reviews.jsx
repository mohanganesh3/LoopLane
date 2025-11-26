import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import reviewService from '../../services/reviewService';
import { useAuth } from '../../context/AuthContext';

const Reviews = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('received');
  const [reviews, setReviews] = useState([]);
  const [receivedCount, setReceivedCount] = useState(0);
  const [givenCount, setGivenCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReviews();
  }, [activeTab]);

  useEffect(() => {
    fetchStats();
    fetchCounts();
  }, [user]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const data = activeTab === 'received' 
        ? await reviewService.getMyReceivedReviews()
        : await reviewService.getMyGivenReviews();
      setReviews(data.reviews || []);
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Reviews</h1>
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reviews;
