/**
 * Bidding & Micro-Auction Controller
 * Epic 5: Dynamic Pricing & Negotiations
 */

const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const Transaction = require('../models/Transaction');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

const toPositiveAmount = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
};

/**
 * @desc    Propose a counter-offer on a Pending Booking
 * @route   POST /api/bookings/:id/bid
 * @access  Private (Rider or Passenger)
 */
exports.proposeBid = asyncHandler(async (req, res) => {
    const bookingId = req.params.id;
    const { amount, message } = req.body;
    const normalizedAmount = toPositiveAmount(amount);

    if (!normalizedAmount) {
        throw new AppError('Bid amount must be a positive number', 400);
    }

    const booking = await Booking.findById(bookingId).populate('ride');
    if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status !== 'PENDING') {
        return res.status(400).json({ success: false, message: 'Can only bid on PENDING bookings' });
    }

    // Determine role
    const isPassenger = booking.passenger.toString() === req.user._id.toString();
    const isRider = booking.rider.toString() === req.user._id.toString();

    if (!isPassenger && !isRider) {
        return res.status(403).json({ success: false, message: 'Access denied to this booking' });
    }

    const role = isPassenger ? 'PASSENGER' : 'RIDER';
    const nextAwaitingStatus = isPassenger ? 'AWAITING_RIDER' : 'AWAITING_PASSENGER';

    // Initialize Auction if first bid
    if (booking.bidding.biddingStatus === 'NONE') {
        booking.bidding.originalPrice = booking.totalPrice;
        booking.bidding.isCounterOffer = true;
    } else if (booking.bidding.biddingStatus === (isPassenger ? 'AWAITING_PASSENGER' : 'AWAITING_RIDER')) {
        // Proceeding with next counter offer
    } else {
        return res.status(400).json({ success: false, message: 'It is not your turn to counter-offer.' });
    }

    // Update bidding state
    booking.bidding.proposedPrice = normalizedAmount;
    booking.bidding.biddingStatus = nextAwaitingStatus;

    booking.bidding.biddingHistory.push({
        amount: normalizedAmount,
        proposedBy: role,
        message,
        timestamp: new Date()
    });

    await booking.save();

    // In a real app, send a push notification or socket ping here to the other party
    // req.app.get('io').to(`user-${otherPartyId}`).emit('new-bid', { bookingId, amount });

    res.status(200).json({
        success: true,
        message: 'Counter-offer proposed successfully',
        data: booking.bidding
    });
});

/**
 * @desc    Accept or Reject a Bid
 * @route   POST /api/bookings/:id/bid/resolve
 * @access  Private (Rider or Passenger)
 */
exports.resolveBid = asyncHandler(async (req, res) => {
    const bookingId = req.params.id;
    const { action } = req.body; // 'ACCEPT' or 'REJECT'

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isPassenger = booking.passenger.toString() === req.user._id.toString();
    const isRider = booking.rider.toString() === req.user._id.toString();

    if (booking.bidding.biddingStatus === 'NONE') {
        return res.status(400).json({ success: false, message: 'No active bid on this booking' });
    }

    // Check whose turn it is
    const waitingForMe = (isPassenger && booking.bidding.biddingStatus === 'AWAITING_PASSENGER') ||
        (isRider && booking.bidding.biddingStatus === 'AWAITING_RIDER');

    if (!waitingForMe) {
        return res.status(403).json({ success: false, message: 'Not authorized to resolve this bid' });
    }

    if (!['ACCEPT', 'REJECT'].includes(action)) {
        throw new AppError('Action must be ACCEPT or REJECT', 400);
    }

    if (action === 'ACCEPT') {
        const commissionRate = booking.payment?.rideFare
            ? (booking.payment.platformCommission || 0) / booking.payment.rideFare
            : 0.10;
        const totalAmount = booking.bidding.proposedPrice;
        const rideFare = Math.round(totalAmount / (1 + commissionRate));
        const platformCommission = totalAmount - rideFare;

        booking.bidding.biddingStatus = 'ACCEPTED';
        booking.totalPrice = totalAmount;
        booking.payment.rideFare = rideFare;
        booking.payment.platformCommission = platformCommission;
        booking.payment.totalAmount = totalAmount;
        booking.payment.amount = totalAmount;
        booking.status = 'CONFIRMED';
    } else {
        booking.bidding.biddingStatus = 'REJECTED';
        booking.status = 'REJECTED'; // End of the road
    }

    await booking.save();

    if (action === 'ACCEPT') {
        await Transaction.findOneAndUpdate(
            { booking: booking._id, type: 'BOOKING_PAYMENT' },
            {
                $set: {
                    'amounts.passengerPaid': booking.totalPrice,
                    'amounts.rideFare': booking.payment.rideFare,
                    'amounts.platformCommission': booking.payment.platformCommission,
                    'amounts.total': booking.totalPrice,
                    'riderPayout.amount': booking.payment.rideFare
                }
            }
        );
    }

    res.status(200).json({
        success: true,
        message: `Bid ${action}ED successfully`,
        data: booking
    });
});
