import { Link } from 'react-router-dom';

const formatDepartureDate = (dateValue) => {
  if (!dateValue) return 'Date TBD';
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return 'Date TBD';

  return parsedDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
};

const formatDepartureTime = (dateValue, legacyTime) => {
  if (dateValue) {
    const parsedDate = new Date(dateValue);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  if (!legacyTime) return 'Time TBD';

  const [hours, minutes] = String(legacyTime).split(':');
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return legacyTime;

  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes || '00'} ${ampm}`;
};

const formatDistance = (distance) => {
  if (distance === undefined || distance === null || distance === '') return 'N/A';
  if (typeof distance === 'number') return `${distance.toFixed(1)} km`;
  return distance;
};

const formatDuration = (duration) => {
  if (duration === undefined || duration === null || duration === '') return null;

  if (typeof duration === 'number') {
    if (duration < 60) return `${Math.round(duration)} min`;

    const hours = Math.floor(duration / 60);
    const minutes = Math.round(duration % 60);
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return duration;
};

const resolveRating = (ratingValue) => {
  if (typeof ratingValue === 'number') return ratingValue;
  if (typeof ratingValue?.average === 'number') return ratingValue.average;
  return null;
};

const resolveRideCount = (rider) => {
  return (
    rider?.statistics?.totalRidesOffered ||
    rider?.statistics?.totalRidesTaken ||
    rider?.totalRides ||
    0
  );
};

const resolveDisplayName = (result, rider) => {
  if (result?.riderDisplayName) return result.riderDisplayName;

  const firstName = rider?.profile?.firstName || rider?.firstName || '';
  const lastName = rider?.profile?.lastName || rider?.lastName || '';

  if (firstName && lastName) return `${firstName} ${lastName[0]}.`;
  return firstName || lastName || 'LoopLane Rider';
};

const resolveInitials = (result, rider) => {
  if (result?.riderInitials) return result.riderInitials;

  const firstName = rider?.profile?.firstName || rider?.firstName || '';
  const lastName = rider?.profile?.lastName || rider?.lastName || '';
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'LL';
};

const RideCard = ({ ride }) => {
  const rideData = ride?.ride || ride;
  const rider = rideData?.rider || ride?.driver;
  const route = rideData?.route || {};
  const pricing = rideData?.pricing || {};
  const vehicle = rideData?.vehicle || ride?.vehicle;
  const preferences = rideData?.preferences || ride?.preferences;
  const rideId = rideData?._id || ride?._id;
  const departureDateTime = rideData?.schedule?.departureDateTime || ride?.dateTime || ride?.date;
  const riderPhoto = ride?.riderPhoto || rider?.profile?.photo || rider?.avatar;
  const riderName = resolveDisplayName(ride, rider);
  const riderInitials = resolveInitials(ride, rider);
  const rating = resolveRating(rider?.rating);
  const isVerified = rider?.verificationStatus === 'VERIFIED' || rider?.isVerified;
  const seatsLeft = pricing?.availableSeats ?? ride?.availableSeats ?? 0;
  const totalSeats = pricing?.totalSeats ?? ride?.totalSeats;
  const startAddress = route?.start?.address || ride?.source?.address || ride?.source || 'Pickup pending';
  const destinationAddress = route?.destination?.address || ride?.destination?.address || ride?.destination || 'Destination pending';
  const distance = ride?.distance ?? route?.distance;
  const duration = route?.duration ?? ride?.duration;
  const pricePerSeat = ride?.pricePerSeat ?? pricing?.pricePerSeat ?? 0;
  const travelTimeLabel = formatDuration(duration);
  const vehicleLabel = [vehicle?.make, vehicle?.model, vehicle?.color].filter(Boolean).join(' • ');
  const vehicleTypeLabel = vehicle?.vehicleType || vehicle?.type;

  return (
    <Link to={`/rides/${rideId}`} className="block">
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
              {riderPhoto ? (
                <img src={riderPhoto} alt={riderName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-500">
                  {riderInitials}
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">{riderName}</p>
              <div className="flex items-center">
                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm text-gray-600 ml-1">{rating ? rating.toFixed(1) : 'New'}</span>
                <span className="text-xs text-gray-400 ml-1">({resolveRideCount(rider)} rides)</span>
              </div>
            </div>
          </div>
          {isVerified && (
            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full flex items-center">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Verified
            </span>
          )}
        </div>

        <div className="flex items-start mb-4">
          <div className="flex flex-col items-center mr-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <div className="w-0.5 h-12 bg-gray-300 my-1"></div>
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
          </div>
          <div className="flex-1">
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900 line-clamp-1">{startAddress}</p>
              <p className="text-xs text-gray-500">
                {formatDepartureDate(departureDateTime)} • {formatDepartureTime(departureDateTime, ride?.time)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 line-clamp-1">{destinationAddress}</p>
              {travelTimeLabel && <p className="text-xs text-gray-500">~{travelTimeLabel} travel time</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs">{formatDistance(distance)}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs">
                {seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left{totalSeats ? ` of ${totalSeats}` : ''}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-emerald-600">₹{pricePerSeat}</p>
            <p className="text-xs text-gray-500">per seat</p>
          </div>
        </div>

        {preferences && (
          <div className="flex flex-wrap gap-1 mt-3">
            {preferences.smokingAllowed && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"><i className="fas fa-smoking mr-1"></i>Smoking OK</span>
            )}
            {preferences.petsAllowed && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"><i className="fas fa-paw mr-1"></i>Pets OK</span>
            )}
            {preferences.musicAllowed && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"><i className="fas fa-music mr-1"></i>Music</span>
            )}
            {vehicle?.airConditioned && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full"><i className="fas fa-snowflake mr-1"></i>AC</span>
            )}
            {preferences.gender === 'FEMALE' && (
              <span className="text-xs px-2 py-0.5 bg-pink-100 text-pink-600 rounded-full"><i className="fas fa-venus mr-1"></i>Ladies Only</span>
            )}
          </div>
        )}

        {(vehicleLabel || vehicleTypeLabel) && (
          <div className="flex items-center mt-3 text-xs text-gray-500">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>{vehicleLabel || vehicleTypeLabel}</span>
          </div>
        )}
      </div>
    </Link>
  );
};

export default RideCard;
