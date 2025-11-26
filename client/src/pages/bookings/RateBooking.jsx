import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { LoadingSpinner, Alert } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const RateBooking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Rating state
  const [overallRating, setOverallRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratings, setRatings] = useState({
    punctuality: 0,
    communication: 0,
    cleanliness: 0,
    driving: 0
  });
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState([]);

  // Available tags - these MUST match the backend enum
  const availableTags = [
    { id: 'FRIENDLY', label: 'Friendly', icon: 'fa-smile' },
    { id: 'ON_TIME', label: 'On Time', icon: 'fa-clock' },
    { id: 'CLEAN_CAR', label: 'Clean Car', icon: 'fa-sparkles' },
    { id: 'SMOOTH_DRIVER', label: 'Smooth Ride', icon: 'fa-car' },
    { id: 'SAFE_DRIVER', label: 'Safe Driving', icon: 'fa-shield-alt' },
    { id: 'GREAT_CONVERSATION', label: 'Great Conversation', icon: 'fa-comments' },
    { id: 'GOOD_COMPANY', label: 'Good Company', icon: 'fa-users' },
    { id: 'FLEXIBLE', label: 'Flexible', icon: 'fa-arrows-alt' }
  ];

  // Fetch booking on mount
  useEffect(() => {
    fetchBooking();
  }, [id]);

  const fetchBooking = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/bookings/${id}`);
      const bookingData = response.data.booking;
      
      if (!bookingData) {
        setError('Booking not found');
        return;
      }
      
      setBooking(bookingData);
      
      // Check if already reviewed
      if (bookingData.reviews?.passengerReviewed || bookingData.reviews?.riderReviewed) {
        // Check if current user has reviewed
        const currentUserId = user?._id;
        const passengerId = bookingData.passenger?._id || bookingData.passenger;
        
        if (passengerId === currentUserId && bookingData.reviews?.passengerReviewed) {
          setError('You have already reviewed this ride');
        }
      }
    } catch (err) {
      console.error('Error fetching booking:', err);
      setError(err.response?.data?.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  // Determine user role and reviewee
  const getUserRole = () => {
    if (!booking || !user) return null;
    
    const passengerId = booking.passenger?._id || booking.passenger;
    const driverId = booking.ride?.rider?._id || booking.ride?.rider;
    const currentUserId = user._id;
    
    // Convert to strings for comparison
    const passengerIdStr = passengerId?.toString();
    const driverIdStr = driverId?.toString();
    const currentUserIdStr = currentUserId?.toString();
    
    if (passengerIdStr === currentUserIdStr) {
      return { role: 'passenger', revieweeId: driverIdStr };
    } else if (driverIdStr === currentUserIdStr) {
      return { role: 'driver', revieweeId: passengerIdStr };
    }
    
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate rating
    if (overallRating === 0) {
      setError('Please select a star rating (1-5)');
      return;
    }

    // Get user role and reviewee
    const userRole = getUserRole();
    if (!userRole) {
      setError('Could not determine your role in this booking');
      return;
    }

    if (!userRole.revieweeId) {
      setError('Could not determine who to review');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Build review data - only include non-zero ratings
      const reviewData = {
        revieweeId: userRole.revieweeId,
        rating: overallRating
      };

      // Only add optional ratings if they're set (non-zero)
      if (ratings.punctuality > 0) reviewData.punctuality = ratings.punctuality;
      if (ratings.communication > 0) reviewData.communication = ratings.communication;
      if (ratings.cleanliness > 0) reviewData.cleanliness = ratings.cleanliness;
      if (ratings.driving > 0) reviewData.driving = ratings.driving;
      
      // Add comment if provided
      if (comment.trim()) {
        reviewData.comment = comment.trim();
      }
      
      // Add tags if any selected
      if (tags.length > 0) {
        reviewData.tags = tags;
      }

      console.log('Submitting review:', reviewData);

      // Make API call
      const response = await api.post(`/api/reviews/booking/${id}`, reviewData);
      
      console.log('Review response:', response.data);
      
      if (response.data.success) {
        setSuccess(true);
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate(`/bookings/${id}`);
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to submit review');
      }
    } catch (err) {
      console.error('Review submission error:', err);
      
      // Extract error message from response
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error ||
                          err.message || 
                          'Failed to submit review. Please try again.';
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTag = (tagId) => {
    setTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  // Loading state
  if (loading) {
    return <LoadingSpinner fullScreen text="Loading booking..." />;
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 pt-8 pb-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-check text-green-500 text-4xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank You!</h2>
            <p className="text-gray-600 mb-4">Your review has been submitted successfully.</p>
            <div className="flex justify-center space-x-1 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <i 
                  key={star} 
                  className={`fas fa-star text-2xl ${star <= overallRating ? 'text-yellow-400' : 'text-gray-300'}`}
                ></i>
              ))}
            </div>
            <p className="text-sm text-gray-500">Redirecting to booking details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state (no booking)
  if (error && !booking) {
    return (
      <div className="min-h-screen bg-gray-50 pt-8 pb-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Alert type="error" message={error} />
          <Link to="/bookings" className="text-emerald-500 hover:underline mt-4 inline-block">
            ← Back to Bookings
          </Link>
        </div>
      </div>
    );
  }

  // Get reviewee info
  const userRole = getUserRole();
  const isPassenger = userRole?.role === 'passenger';
  const reviewee = isPassenger ? booking?.ride?.rider : booking?.passenger;
  
  const revieweeName = reviewee?.profile?.firstName 
    ? `${reviewee.profile.firstName} ${reviewee.profile.lastName?.charAt(0) || ''}.`
    : reviewee?.name || (isPassenger ? 'Driver' : 'Passenger');
  
  const revieweePhoto = reviewee?.profile?.photo || reviewee?.profilePhoto || null;
  
  const pickupName = booking?.pickupPoint?.address || 
                     booking?.pickupPoint?.name || 
                     booking?.ride?.route?.start?.name || 
                     'Pickup';
  const dropoffName = booking?.dropoffPoint?.address || 
                      booking?.dropoffPoint?.name || 
                      booking?.ride?.route?.destination?.name || 
                      'Dropoff';

  return (
    <div className="min-h-screen bg-gray-50 pt-4 pb-12">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Back Link */}
        <Link to={`/bookings/${id}`} className="inline-flex items-center text-emerald-500 hover:text-emerald-700 mb-4">
          <i className="fas fa-arrow-left mr-2"></i>Back to Booking
        </Link>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6">
            <h1 className="text-2xl font-bold flex items-center">
              <i className="fas fa-star mr-3"></i>Rate Your Ride
            </h1>
            <p className="text-emerald-100 mt-1">
              Help other riders by sharing your experience
            </p>
          </div>

          {/* Reviewee Info */}
          <div className="p-6 border-b bg-gray-50">
            <div className="flex items-center">
              {revieweePhoto ? (
                <img
                  src={revieweePhoto}
                  alt={revieweeName}
                  className="w-16 h-16 rounded-full object-cover border-4 border-white shadow"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xl font-bold border-4 border-white shadow">
                  {revieweeName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {revieweeName}
                </h3>
                <p className="text-gray-500 text-sm">
                  <i className="fas fa-map-marker-alt mr-1"></i>
                  {pickupName} → {dropoffName}
                </p>
              </div>
            </div>
          </div>

          {/* Review Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <i className="fas fa-exclamation-circle mr-2"></i>
                {error}
              </div>
            )}

            {/* Overall Rating */}
            <div className="text-center">
              <label className="block text-lg font-semibold text-gray-700 mb-4">
                How was your overall experience?
              </label>
              <div className="flex justify-center space-x-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setOverallRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="focus:outline-none transition transform hover:scale-110"
                  >
                    <i 
                      className={`fas fa-star text-4xl ${
                        star <= (hoverRating || overallRating) 
                          ? 'text-yellow-400' 
                          : 'text-gray-300'
                      }`}
                    ></i>
                  </button>
                ))}
              </div>
              <p className="text-gray-500 mt-2">
                {overallRating === 0 && 'Tap to rate'}
                {overallRating === 1 && 'Poor'}
                {overallRating === 2 && 'Fair'}
                {overallRating === 3 && 'Good'}
                {overallRating === 4 && 'Very Good'}
                {overallRating === 5 && 'Excellent!'}
              </p>
            </div>

            {/* Detailed Ratings */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">
                Rate specific aspects (optional)
              </label>
              
              {[
                { key: 'punctuality', label: 'Punctuality', icon: 'fa-clock' },
                { key: 'communication', label: 'Communication', icon: 'fa-comments' },
                { key: 'cleanliness', label: 'Cleanliness', icon: 'fa-broom' },
                { key: 'driving', label: 'Driving', icon: 'fa-car' }
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <span className="text-gray-700 flex items-center">
                    <i className={`fas ${item.icon} text-emerald-500 mr-2 w-5`}></i>
                    {item.label}
                  </span>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatings(prev => ({ ...prev, [item.key]: star }))}
                        className="focus:outline-none"
                      >
                        <i 
                          className={`fas fa-star ${
                            star <= ratings[item.key] ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                        ></i>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                What stood out? (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                      tags.includes(tag.id)
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <i className={`fas ${tag.icon} mr-1`}></i>
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Written Review */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Write a review (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with others..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
              <p className="text-right text-xs text-gray-500 mt-1">
                {comment.length}/500
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || overallRating === 0}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>Submitting...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane mr-2"></i>Submit Review
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RateBooking;
