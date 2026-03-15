import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { LoadingSpinner, Alert } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { motion } from 'framer-motion';

/* ── Inline SVG Icons (replaces FontAwesome) ── */
const StarSVG = ({ filled, size = 'w-5 h-5', className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth={filled ? 0 : 1.5}
    className={`${size} ${className}`}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
  </svg>
);

const ArrowLeftSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
  </svg>
);

const CheckSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10">
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);

const MapPinSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 inline mr-1">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>
);

const ExclamationSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 inline mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

const SendSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
  </svg>
);

const SpinnerSVG = () => (
  <svg className="animate-spin w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
  </svg>
);

const PlusSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const XMarkSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

const ClockSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const CarSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25m0-2.677v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677" />
  </svg>
);

const ShieldSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h0A11.959 11.959 0 0 1 12 2.714Z" />
  </svg>
);

const SparklesSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>
);

const ChatBubbleSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
  </svg>
);

const SmileSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
  </svg>
);

const ArrowsExpandSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
  </svg>
);

const HandshakeSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 1 0-3.15 0v3.15M10.05 4.575a1.575 1.575 0 0 1 3.15 0v3.15M10.05 4.575v3.15M3.75 11.1a1.575 1.575 0 0 0 0 3.15h1.575l2.1 2.1M3.75 11.1h2.1m0 0 1.575 1.575m7.5-8.1a1.575 1.575 0 0 1 3.15 0v3.15M17.1 4.575v3.15m0 0 2.1 2.1M17.1 7.725h2.1m0 0h.75a1.575 1.575 0 0 1 0 3.15h-1.575l-2.1 2.1" />
  </svg>
);

const UserGroupSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
);

const MuteSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
  </svg>
);

const BroomSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
  </svg>
);

/* ── Icon Mapping ── */
const tagIconMap = {
  'fa-clock': ClockSVG,
  'fa-car': CarSVG,
  'fa-shield-alt': ShieldSVG,
  'fa-sparkles': SparklesSVG,
  'fa-comments': ChatBubbleSVG,
  'fa-smile': SmileSVG,
  'fa-arrows-alt': ArrowsExpandSVG,
  'fa-handshake': HandshakeSVG,
  'fa-users': UserGroupSVG,
  'fa-volume-mute': MuteSVG,
  'fa-broom': BroomSVG,
};

const aspectIconMap = {
  'fa-clock': ClockSVG,
  'fa-comments': ChatBubbleSVG,
  'fa-car': CarSVG,
  'fa-broom': BroomSVG,
  'fa-handshake': HandshakeSVG,
  'fa-smile': SmileSVG,
};

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
  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState([]);

  // G4: Photo upload state
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);

  // Available tags — context-aware per review type
  const driverTags = [
    { id: 'ON_TIME', label: 'On Time', icon: 'fa-clock' },
    { id: 'SMOOTH_DRIVER', label: 'Smooth Ride', icon: 'fa-car' },
    { id: 'SAFE_DRIVER', label: 'Safe Driving', icon: 'fa-shield-alt' },
    { id: 'CLEAN_CAR', label: 'Clean Car', icon: 'fa-sparkles' },
    { id: 'GREAT_CONVERSATION', label: 'Great Conversation', icon: 'fa-comments' },
    { id: 'FRIENDLY', label: 'Friendly', icon: 'fa-smile' },
    { id: 'FLEXIBLE', label: 'Flexible', icon: 'fa-arrows-alt' }
  ];

  const passengerTags = [
    { id: 'ON_TIME', label: 'On Time', icon: 'fa-clock' },
    { id: 'RESPECTFUL', label: 'Respectful', icon: 'fa-handshake' },
    { id: 'FRIENDLY', label: 'Friendly', icon: 'fa-smile' },
    { id: 'GREAT_CONVERSATION', label: 'Great Conversation', icon: 'fa-comments' },
    { id: 'GOOD_COMPANY', label: 'Good Company', icon: 'fa-users' },
    { id: 'FLEXIBLE', label: 'Flexible', icon: 'fa-arrows-alt' },
    { id: 'QUIET', label: 'Quiet & Polite', icon: 'fa-volume-mute' }
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

      if (response.data?.hasReviewed) {
        setError('You have already reviewed this ride');
        return;
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
      // Build FormData instead of JSON to support file uploads
      const formData = new FormData();
      formData.append('revieweeId', userRole.revieweeId);
      formData.append('rating', overallRating);

      // Only add optional ratings if they're set (non-zero)
      Object.entries(ratings).forEach(([key, value]) => {
        if (value > 0) formData.append(key, value);
      });

      // Add comment if provided
      if (comment.trim()) {
        formData.append('comment', comment.trim());
      }

      // Add tags if any selected
      if (tags.length > 0) {
        formData.append('tags', JSON.stringify(tags));
      }

      // Append photos if provided
      photos.forEach(photo => {
        formData.append('photos', photo);
      });

      console.log('Submitting review...');

      // Make API call with multipart/form-data
      const response = await api.post(`/api/reviews/booking/${id}`, formData, {
        headers: { 'Content-Type': undefined } // Let browser set multipart boundary
      });

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

  // G4: Photo handlers
  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + photos.length > 5) {
      setError('You can only upload up to 5 photos');
      return;
    }

    setPhotos(prev => [...prev, ...files]);

    // Create previews
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Loading state
  if (loading) {
    return <LoadingSpinner fullScreen text="Loading booking..." />;
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen pt-8 pb-12" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
              <CheckSVG />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank You!</h2>
            <p className="text-gray-600 mb-4">Your review has been submitted successfully.</p>
            <div className="flex justify-center space-x-1 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <StarSVG key={star} filled={star <= overallRating} size="w-7 h-7" className={star <= overallRating ? 'text-yellow-400' : 'text-gray-300'} />
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
      <div className="min-h-screen pt-8 pb-12" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-4 pb-12" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Back Link */}
        <Link to={`/bookings/${id}`} className="inline-flex items-center gap-2 text-emerald-500 hover:text-emerald-700 mb-4">
          <ArrowLeftSVG />Back to Booking
        </Link>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6">
            <h1 className="text-2xl font-bold flex items-center gap-3" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
              <StarSVG filled size="w-7 h-7" className="text-white" />Rate Your Ride
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
                <p className="text-gray-500 text-sm flex items-center">
                  <MapPinSVG />
                  {pickupName} → {dropoffName}
                </p>
              </div>
            </div>
          </div>

          {/* Review Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                <ExclamationSVG />
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
                    <StarSVG
                      filled={star <= (hoverRating || overallRating)}
                      size="w-10 h-10"
                      className={star <= (hoverRating || overallRating) ? 'text-yellow-400' : 'text-gray-300'}
                    />
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

            {/* Detailed Ratings — role-aware categories */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">
                Rate specific aspects (optional)
              </label>

              {(isPassenger
                ? [
                    { key: 'punctuality', label: 'Punctuality', icon: 'fa-clock' },
                    { key: 'communication', label: 'Communication', icon: 'fa-comments' },
                    { key: 'driving', label: 'Driving', icon: 'fa-car' },
                    { key: 'cleanliness', label: 'Vehicle Cleanliness', icon: 'fa-broom' }
                  ]
                : [
                    { key: 'punctuality', label: 'Punctuality', icon: 'fa-clock' },
                    { key: 'communication', label: 'Communication', icon: 'fa-comments' },
                    { key: 'respectfulness', label: 'Respectfulness', icon: 'fa-handshake' },
                    { key: 'friendliness', label: 'Friendliness', icon: 'fa-smile' }
                  ]
              ).map(item => (
                <div key={item.key} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <span className="text-gray-700 flex items-center gap-2">
                    <span className="text-emerald-500">{(() => { const Icon = aspectIconMap[item.icon]; return Icon ? <Icon /> : null; })()}</span>
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
                        <StarSVG
                          filled={star <= ratings[item.key]}
                          size="w-5 h-5"
                          className={star <= ratings[item.key] ? 'text-yellow-400' : 'text-gray-300'}
                        />
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
                {(isPassenger ? driverTags : passengerTags).map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-1.5 ${tags.includes(tag.id)
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {(() => { const Icon = tagIconMap[tag.icon]; return Icon ? <Icon /> : null; })()}
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

            {/* Photo Upload (G4) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Add Photos (optional, max 5)
              </label>

              <div className="flex flex-wrap gap-4 mb-2">
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                    <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 focus:outline-none"
                    >
                      <XMarkSVG />
                    </button>
                  </div>
                ))}

                {photos.length < 5 && (
                  <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition text-gray-400 hover:text-emerald-500">
                    <PlusSVG />
                    <span className="text-[10px] font-medium mt-0.5">Add Photo</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg, image/png, image/webp"
                      multiple
                      onChange={handlePhotoChange}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Ensure photos are clear and relevant to the ride.
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
                  <SpinnerSVG />Submitting...
                </>
              ) : (
                <>
                  <SendSVG />Submit Review
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default RateBooking;
