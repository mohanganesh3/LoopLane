import React from 'react';
import { motion } from 'framer-motion';

const BookingProgressStepper = ({ booking, className = '' }) => {
    const statusToStep = {
        PENDING: 0,
        CONFIRMED: 1,
        PICKUP_PENDING: 1,
        PICKED_UP: 2,
        IN_TRANSIT: 2.5,
        DROPOFF_PENDING: 3,
        DROPPED_OFF: 3,
        COMPLETED: 4
    };

    // Custom mapping for cancelled or rejected states
    if (['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'].includes(booking.status)) {
        const statusLabels = {
            CANCELLED: 'Cancelled',
            REJECTED: 'Rejected',
            EXPIRED: 'Expired',
            NO_SHOW: 'Marked as No Show'
        };
        return (
            <div className={`bg-red-50 border border-red-100 rounded-xl p-4 ${className}`}>
                <div className="flex items-center text-red-600 font-semibold mb-2">
                    <i className="fas fa-times-circle text-xl mr-2"></i>
                    Booking {statusLabels[booking.status] || booking.status}
                </div>
                <p className="text-sm text-red-500">
                    {booking.status === 'NO_SHOW'
                        ? 'This booking was marked as a no-show and did not complete.'
                        : 'This booking will not proceed. No charges apply.'}
                </p>
            </div>
        );
    }

    // Determine current step index
    const activeStep = statusToStep[booking.status];

    // If status is not in the normal flow (e.g., something custom), just show basic state
    if (activeStep === undefined) return null;

    const steps = [
        { id: 'PENDING', label: 'Requested', icon: 'fa-envelope', time: booking.createdAt },
        { id: 'CONFIRMED', label: 'Confirmed', icon: 'fa-check', time: booking.riderResponse?.respondedAt },
        {
            id: 'PICKED_UP',
            label: 'Picked Up',
            icon: 'fa-car-side',
            time: booking.verification?.pickup?.verifiedAt || booking.journey?.startedAt
        },
        {
            id: 'DROPPED_OFF',
            label: 'Dropped Off',
            icon: 'fa-map-marker-alt',
            time: booking.verification?.dropoff?.verifiedAt || booking.journey?.droppedOffAt
        },
        {
            id: 'COMPLETED',
            label: 'Completed',
            icon: 'fa-flag-checkered',
            time: booking.journey?.completedAt || booking.payment?.riderConfirmedAt
        }
    ];

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>
            <h3 className="text-lg font-bold text-gray-800 mb-6" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                Journey Progress
            </h3>

            <div className="relative">
                {/* Progress Line Background */}
                <div className="absolute top-5 left-6 right-6 h-1 bg-gray-100 rounded-full"></div>

                {/* Active Progress Line */}
                <motion.div
                    className="absolute top-5 left-6 h-1 bg-emerald-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${Math.min(100, Math.max(0, (activeStep / (steps.length - 1)) * 100))}%` }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                />

                {/* Steps */}
                <div className="relative flex justify-between">
                    {steps.map((step, index) => {
                        const isCompleted = index <= activeStep;
                        const isCurrent = Math.floor(activeStep) === index;
                        const isNext = index === Math.ceil(activeStep) && activeStep % 1 !== 0; // for IN_TRANSIT

                        return (
                            <div key={step.id} className="flex flex-col items-center relative z-10" style={{ width: '20%' }}>
                                <motion.div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-colors duration-300 ${isCompleted ? 'bg-emerald-500 text-white' :
                                            isNext ? 'bg-emerald-100 text-emerald-500' : 'bg-gray-100 text-gray-400'
                                        }`}
                                    animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                                    transition={{ repeat: isCurrent ? Infinity : 0, duration: 2 }}
                                >
                                    <i className={`fas ${step.icon} text-sm`}></i>
                                </motion.div>

                                <div className="mt-3 flex flex-col items-center text-center">
                                    <span className={`text-xs font-semibold ${isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                        {step.label}
                                    </span>
                                    {step.time && (
                                        <span className="text-[10px] text-gray-500 mt-0.5">
                                            {formatDate(step.time)}
                                        </span>
                                    )}
                                    {isCurrent && !step.time && (
                                        <span className="text-[10px] text-emerald-500 font-medium mt-0.5 animate-pulse">
                                            In Progress
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Helpful Hint Box based on current status */}
            <div className="mt-8 bg-blue-50/50 rounded-xl p-4 flex gap-3">
                <div className="text-blue-500 mt-0.5">
                    <i className="fas fa-info-circle"></i>
                </div>
                <div className="flex-1 text-sm text-gray-600">
                    {booking.status === 'PENDING' && "Waiting for the driver to confirm your request. You won't be charged until they do."}
                    {['CONFIRMED', 'PICKUP_PENDING'].includes(booking.status) && "Your ride is confirmed! Don't forget to share your pickup OTP with the driver when they arrive."}
                    {booking.status === 'PICKED_UP' && "Pickup is verified and your trip has started. Enjoy the ride and use the SOS button if you need help."}
                    {booking.status === 'IN_TRANSIT' && "Ride is in progress. The driver is navigating to the destination."}
                    {booking.status === 'DROPOFF_PENDING' && "You're close to the destination. The rider will verify the dropoff OTP once the trip ends."}
                    {booking.status === 'DROPPED_OFF' && "You've reached your destination. Please complete the payment if you haven't already."}
                    {booking.status === 'COMPLETED' && "This journey is complete. Thank you for choosing LoopLane and helping reduce carbon emissions!"}
                </div>
            </div>
        </div>
    );
};

export default BookingProgressStepper;
