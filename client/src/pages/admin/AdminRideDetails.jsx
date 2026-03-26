import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Loader2, ArrowLeft, CarFront, Route, User, SlidersHorizontal, Leaf, Ticket, Inbox, MapPin, ArrowRight, Wallet, Star, Ban, Wrench, XCircle, Globe, ClipboardList, Shield, Flag, Info, Undo2, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import adminService from '../../services/adminService';
import { StatusBadge } from '../../components/admin';

const fmtDT = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
const fmtDist = (d) => d ? `${d.toFixed(1)} km` : 'N/A';
const Card = ({ children, className }) => <div className={cn('bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6', className)}>{children}</div>;
const SectionTitle = ({ icon: Icon, children }) => <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2"><Icon size={16} className="text-zinc-400" />{children}</h2>;
const InfoCell = ({ label, children, className }) => <div className={cn('bg-zinc-50 dark:bg-zinc-800 p-4 rounded-md', className)}><p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>{children}</div>;

const AdminRideDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [vehicleDetails, setVehicleDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchRideDetails(); }, [id]);

  const fetchRideDetails = async () => {
    setLoading(true);
    try {
      const response = await adminService.getRideById(id);
      if (response.success) {
        setRide(response.ride);
        setBookings(response.bookings || response.ride?.bookings || []);
        setReviews(response.reviews || []);
        setVehicleDetails(response.vehicleDetails || null);
      }
    } catch (err) { setError(err.response?.data?.message || 'Failed to load ride details'); }
    finally { setLoading(false); }
  };

  const handleCancelRide = async () => {
    const reason = prompt('Enter reason for cancellation:');
    if (!reason) return;
    if (!window.confirm('Are you sure you want to cancel this ride?')) return;
    try {
      const response = await adminService.cancelRide(id, reason);
      if (response.success) { setSuccess('Ride cancelled successfully'); fetchRideDetails(); }
    } catch (err) { setError(err.message || 'Failed to cancel ride'); }
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 size={24} className="animate-spin text-zinc-400" /></div>;

  if (!ride) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg"><AlertTriangle size={16} /> Ride not found</div>
        <button onClick={() => navigate('/admin/rides')} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"><ArrowLeft size={14} /> Back to Rides</button>
      </div>
    );
  }

  const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const totalCommission = bookings.reduce((sum, b) => sum + (b.payment?.platformCommission || 0), 0);
  const totalRiderFare = bookings.reduce((sum, b) => sum + (b.payment?.rideFare || 0), 0);
  const totalSeats = ride.pricing?.totalSeats || 0;
  const availableSeats = ride.pricing?.availableSeats || 0;
  const bookedSeats = totalSeats - availableSeats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/rides')} className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-600 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Ride Details</h1>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      {error && <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg"><AlertTriangle size={16} /> {error} <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">×</button></div>}
      {success && <div className="flex items-center gap-2 px-4 py-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg"><CheckCircle size={16} /> {success} <button onClick={() => setSuccess('')} className="ml-auto text-emerald-500 hover:text-emerald-700">×</button></div>}

      {/* Revenue Summary */}
      <div className="bg-zinc-900 dark:bg-zinc-100 rounded-lg p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Volume', value: `₹${totalRevenue}` },
            { label: 'Platform Revenue', value: `₹${totalCommission}` },
            { label: 'Rider Earnings', value: `₹${totalRiderFare}` },
            { label: 'Bookings', value: bookings.length },
            { label: 'Seats', value: `${bookedSeats}/${totalSeats}`, sub: `${availableSeats} available` },
          ].map((item, i) => (
            <div key={i}>
              <p className="text-zinc-400 dark:text-zinc-500 text-xs">{item.label}</p>
              <p className="text-xl font-semibold text-white dark:text-zinc-900 mt-0.5">{item.value}</p>
              {item.sub && <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Route Information */}
      <Card>
        <SectionTitle icon={Route}>Route Information</SectionTitle>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-400">Origin</p>
                <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{ride.route?.start?.name || ride.route?.start?.address || 'Unknown'}</p>
                {ride.route?.start?.address && ride.route?.start?.name && <p className="text-xs text-zinc-400">{ride.route.start.address}</p>}
              </div>
            </div>
            {ride.route?.intermediateStops?.length > 0 && (
              <div className="ml-1 pl-4 border-l border-dashed border-zinc-200 dark:border-zinc-700 space-y-2">
                {ride.route.intermediateStops.sort((a, b) => (a.order || 0) - (b.order || 0)).map((stop, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5" />
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{stop.name || stop.address || `Stop ${idx + 1}`}</p>
                      {stop.address && stop.name && <p className="text-xs text-zinc-400">{stop.address}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1.5" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-400">Destination</p>
                <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{ride.route?.destination?.name || ride.route?.destination?.address || 'Unknown'}</p>
                {ride.route?.destination?.address && ride.route?.destination?.name && <p className="text-xs text-zinc-400">{ride.route.destination.address}</p>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InfoCell label="Date & Time"><p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">{fmtDT(ride.schedule?.departureDateTime)}</p>{ride.schedule?.flexibleTiming && <p className="text-xs text-amber-600 mt-0.5">⏱ Flexible</p>}</InfoCell>
            <InfoCell label="Price per Seat"><p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">₹{ride.pricing?.pricePerSeat || 0}</p></InfoCell>
            <InfoCell label="Distance"><p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">{fmtDist(ride.route?.distance)}</p></InfoCell>
            <InfoCell label="Duration"><p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">{ride.route?.duration ? `${Math.round(ride.route.duration)} min` : 'N/A'}</p></InfoCell>
          </div>
        </div>
        {ride.schedule?.returnTrip?.enabled && (
          <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm text-zinc-700 dark:text-zinc-300">
            <Undo2 size={14} className="inline mr-1" /> <strong>Return Trip:</strong> {ride.schedule.returnTrip.date ? fmtDT(ride.schedule.returnTrip.date) : 'Scheduled'}{ride.schedule.returnTrip.time ? ` at ${ride.schedule.returnTrip.time}` : ''}
          </div>
        )}
        {ride.recurring?.isRecurring && (
          <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm text-zinc-700 dark:text-zinc-300">
            <RefreshCw size={14} className="inline mr-1" /> <strong>Recurring:</strong> {ride.recurring.pattern || 'Custom'}
            {ride.recurring.daysOfWeek?.length > 0 && ` — ${ride.recurring.daysOfWeek.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}`}
            {ride.recurring.endDate && ` until ${new Date(ride.recurring.endDate).toLocaleDateString()}`}
          </div>
        )}
      </Card>

      {/* Vehicle Info */}
      {vehicleDetails && (
        <Card>
          <SectionTitle icon={CarFront}>Vehicle Information</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              vehicleDetails.make && { label: 'Make', value: vehicleDetails.make },
              vehicleDetails.model && { label: 'Model', value: vehicleDetails.model },
              vehicleDetails.color && { label: 'Color', value: vehicleDetails.color },
              vehicleDetails.licensePlate && { label: 'License Plate', value: vehicleDetails.licensePlate, mono: true },
              vehicleDetails.type && { label: 'Type', value: vehicleDetails.type },
              vehicleDetails.year && { label: 'Year', value: vehicleDetails.year },
            ].filter(Boolean).map((item, i) => (
              <InfoCell key={i} label={item.label}><p className={cn('font-medium text-sm text-zinc-900 dark:text-zinc-100 mt-0.5', item.mono && 'font-mono')}>{item.value}</p></InfoCell>
            ))}
          </div>
        </Card>
      )}

      {/* Driver Info */}
      <Card>
        <SectionTitle icon={User}>Driver Information</SectionTitle>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-semibold text-lg">
            {(ride.rider?.profile?.firstName?.[0] || 'U').toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {ride.rider?.profile?.firstName || ''} {ride.rider?.profile?.lastName || ride.rider?.name || 'Unknown'}
            </p>
            <p className="text-sm text-zinc-500">{ride.rider?.email}</p>
            <p className="text-sm text-zinc-500">{ride.rider?.phone}</p>
          </div>
          <button onClick={() => navigate(`/admin/users/${ride.rider?._id}`)} className="px-3 py-1.5 text-sm font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
            View Profile →
          </button>
        </div>
      </Card>

      {/* Preferences */}
      {ride.preferences && (
        <Card>
          <SectionTitle icon={SlidersHorizontal}>Ride Preferences</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {ride.preferences.gender && ride.preferences.gender !== 'ANY' && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-md ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700 text-zinc-700 dark:text-zinc-300">{ride.preferences.gender.replace(/_/g, ' ')}</span>
            )}
            <span className={cn('px-2.5 py-1 text-xs font-medium rounded-md ring-1 ring-inset', ride.preferences.smoking ? 'ring-red-200 text-red-700 dark:ring-red-800 dark:text-red-400' : 'ring-emerald-200 text-emerald-700 dark:ring-emerald-800 dark:text-emerald-400')}>
              {ride.preferences.smoking ? '🚬 Smoking' : '🚭 No smoking'}
            </span>
            <span className={cn('px-2.5 py-1 text-xs font-medium rounded-md ring-1 ring-inset', ride.preferences.pets ? 'ring-amber-200 text-amber-700 dark:ring-amber-800 dark:text-amber-400' : 'ring-zinc-200 text-zinc-600 dark:ring-zinc-700 dark:text-zinc-400')}>
              {ride.preferences.pets ? '🐾 Pets OK' : '🚫 No pets'}
            </span>
            {ride.preferences.music && <span className="px-2.5 py-1 text-xs font-medium rounded-md ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700 text-zinc-700 dark:text-zinc-300">🎵 {ride.preferences.music.replace(/_/g, ' ')}</span>}
            {ride.preferences.conversation && <span className="px-2.5 py-1 text-xs font-medium rounded-md ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700 text-zinc-700 dark:text-zinc-300">💬 {ride.preferences.conversation.replace(/_/g, ' ')}</span>}
            {ride.preferences.luggage && <span className="px-2.5 py-1 text-xs font-medium rounded-md ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700 text-zinc-700 dark:text-zinc-300">🧳 {ride.preferences.luggage.replace(/_/g, ' ')}</span>}
            {ride.preferences.autoAcceptBookings && <span className="px-2.5 py-1 text-xs font-medium rounded-md ring-1 ring-inset ring-emerald-200 text-emerald-700 dark:ring-emerald-800 dark:text-emerald-400">⚡ Auto-accept</span>}
          </div>
          {ride.specialInstructions && (
            <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md">
              <p className="text-sm text-zinc-700 dark:text-zinc-300"><Info size={14} className="inline mr-1" />{ride.specialInstructions}</p>
            </div>
          )}
        </Card>
      )}

      {/* Carbon Footprint */}
      {ride.carbon && (ride.carbon.carbonSaved > 0 || ride.carbon.totalEmission > 0) && (
        <Card>
          <SectionTitle icon={Leaf}>Carbon Footprint</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ride.carbon.carbonSaved > 0 && <InfoCell label="CO₂ Saved"><p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">{ride.carbon.carbonSaved.toFixed(1)} kg</p></InfoCell>}
            {ride.carbon.totalEmission > 0 && <InfoCell label="Total Emission"><p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">{ride.carbon.totalEmission.toFixed(1)} kg</p></InfoCell>}
            {ride.carbon.perPersonEmission > 0 && <InfoCell label="Per Person"><p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">{ride.carbon.perPersonEmission.toFixed(1)} kg</p></InfoCell>}
            {ride.carbon.equivalentTrees > 0 && <InfoCell label="Equivalent Trees"><p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">🌳 {ride.carbon.equivalentTrees.toFixed(1)}</p></InfoCell>}
          </div>
        </Card>
      )}

      {/* Bookings */}
      <Card>
        <SectionTitle icon={Ticket}>Bookings ({bookings.length})</SectionTitle>
        {bookings.length === 0 ? (
          <div className="text-center py-8">
            <Inbox size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm text-zinc-500">No bookings for this ride yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => {
              const commission = booking.payment?.platformCommission || 0;
              const rFare = booking.payment?.rideFare || 0;
              return (
                <div key={booking._id} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-semibold text-sm">
                        {(booking.passenger?.profile?.firstName?.[0] || 'P').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{booking.passenger?.profile?.firstName || ''} {booking.passenger?.profile?.lastName || 'Unknown'}</p>
                        <p className="text-xs text-zinc-500">{booking.passenger?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">₹{booking.totalPrice || 0}</p>
                        {commission > 0 && <p className="text-[10px] text-zinc-500">₹{commission} platform · ₹{rFare} rider</p>}
                        <p className="text-xs text-zinc-500">{booking.seatsBooked || 1} seat(s)</p>
                      </div>
                      <StatusBadge status={booking.status} />
                      <button onClick={() => navigate(`/admin/bookings/${booking._id}`)} className="px-2.5 py-1 text-xs font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition">View</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm bg-white dark:bg-zinc-900 rounded-md px-3 py-2 border border-zinc-100 dark:border-zinc-700">
                    <MapPin size={14} className="text-emerald-500 flex-shrink-0" />
                    <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{booking.pickupPoint?.name || booking.pickupPoint?.address || 'Ride start'}</span>
                    <ArrowRight size={14} className="text-zinc-300 dark:text-zinc-600 mx-1 flex-shrink-0" />
                    <MapPin size={14} className="text-red-500 flex-shrink-0" />
                    <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{booking.dropoffPoint?.name || booking.dropoffPoint?.address || 'Ride end'}</span>
                    <span className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
                      {booking.payment?.method && <span><Wallet size={12} className="inline mr-0.5" />{booking.payment.method}</span>}
                      {booking.payment?.status && booking.payment.status !== 'PENDING' && (
                        <StatusBadge status={booking.payment.status} />
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Reviews */}
      {reviews.length > 0 && (
        <Card>
          <SectionTitle icon={Star}>Reviews ({reviews.length})</SectionTitle>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review._id} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-700 dark:text-amber-400 font-semibold text-sm">
                      {review.ratings?.overall || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{review.reviewer?.profile?.firstName || 'Unknown'} → {review.reviewee?.profile?.firstName || 'Unknown'}</p>
                      <p className="text-xs text-zinc-500">{review.type === 'DRIVER_REVIEW' ? '🚗 Driver Review' : '👤 Passenger Review'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => <Star key={i} size={14} className={i < (review.ratings?.overall || 0) ? 'text-amber-400 fill-amber-400' : 'text-zinc-200 dark:text-zinc-600'} />)}
                  </div>
                </div>
                {review.ratings?.categories && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {Object.entries(review.ratings.categories).filter(([, v]) => v && v > 0).map(([cat, val]) => (
                      <span key={cat} className="px-2 py-0.5 text-[10px] font-medium rounded-md ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700 text-zinc-600 dark:text-zinc-400">{cat.charAt(0).toUpperCase() + cat.slice(1)}: {val}/5</span>
                    ))}
                  </div>
                )}
                {review.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {review.tags.map((tag, i) => <span key={i} className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">{tag.replace(/_/g, ' ')}</span>)}
                  </div>
                )}
                {review.comment && <p className="text-sm text-zinc-700 dark:text-zinc-300 italic">"{review.comment}"</p>}
                <p className="text-xs text-zinc-400 mt-1">{fmtDT(review.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cancellation Details */}
      {ride.cancellation?.cancelled && (
        <Card className="border-l-2 border-l-red-500">
          <SectionTitle icon={Ban}>Cancellation Details</SectionTitle>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-zinc-500 text-xs">Cancelled At</p><p className="font-medium text-zinc-900 dark:text-zinc-100 mt-0.5">{fmtDT(ride.cancellation.cancelledAt)}</p></div>
            <div><p className="text-zinc-500 text-xs">Reason</p><p className="font-medium text-zinc-900 dark:text-zinc-100 mt-0.5">{ride.cancellation.reason || 'No reason provided'}</p></div>
          </div>
        </Card>
      )}

      {/* Admin Actions */}
      <Card>
        <SectionTitle icon={Wrench}>Admin Actions</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {ride.status === 'ACTIVE' && (
            <button onClick={handleCancelRide} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition">
              <XCircle size={14} /> Cancel Ride
            </button>
          )}
          {ride.rider?._id && (
            <button onClick={() => navigate(`/admin/users/${ride.rider._id}`)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"><User size={14} /> View Driver</button>
          )}
          <button onClick={() => navigate('/admin/bird-eye')} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"><Globe size={14} /> Bird Eye View</button>
          <button onClick={() => navigate('/admin/bookings')} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"><ClipboardList size={14} /> All Bookings</button>
          <button onClick={() => navigate('/admin/safety')} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"><Shield size={14} /> Safety Center</button>
          <button onClick={() => navigate('/admin/reports')} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"><Flag size={14} /> Reports</button>
        </div>

        <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-500 mb-3">Ride Metadata</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <InfoCell label="Ride ID"><p className="font-mono text-zinc-700 dark:text-zinc-300 truncate mt-0.5">{ride._id}</p></InfoCell>
            <InfoCell label="Created"><p className="font-medium text-zinc-700 dark:text-zinc-300 mt-0.5">{new Date(ride.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p></InfoCell>
            <InfoCell label="Views"><p className="font-medium text-zinc-700 dark:text-zinc-300 mt-0.5">{ride.views || 0} views · {ride.bookmarkCount || 0} bookmarks</p></InfoCell>
            <InfoCell label="Status"><p className={cn('font-semibold mt-0.5', ride.status === 'COMPLETED' ? 'text-emerald-600' : ride.status === 'CANCELLED' ? 'text-red-600' : 'text-zinc-900 dark:text-zinc-100')}>{ride.status}</p></InfoCell>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminRideDetails;
