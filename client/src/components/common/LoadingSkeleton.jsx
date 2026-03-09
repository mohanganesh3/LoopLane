import React from 'react';
import { motion } from 'framer-motion';

const Skeleton = ({ className, width, height, borderRadius = '0.5rem', style = {} }) => {
    return (
        <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{
                repeat: Infinity,
                repeatType: "reverse",
                duration: 0.8,
                ease: "easeInOut"
            }}
            className={`bg-gray-200 ${className || ''}`}
            style={{
                width: width || '100%',
                height: height || '20px',
                borderRadius,
                ...style
            }}
        />
    );
};

export const RideCardSkeleton = () => (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 w-full">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center space-x-3">
                <Skeleton width="48px" height="48px" borderRadius="9999px" />
                <div>
                    <Skeleton width="120px" height="16px" className="mb-2" />
                    <Skeleton width="80px" height="12px" />
                </div>
            </div>
            <Skeleton width="60px" height="24px" borderRadius="9999px" />
        </div>

        <div className="space-y-3 mb-4">
            <div className="flex items-center">
                <Skeleton width="24px" height="24px" borderRadius="9999px" className="mr-3" />
                <Skeleton width="200px" height="16px" />
            </div>
            <div className="flex items-center">
                <Skeleton width="24px" height="24px" borderRadius="9999px" className="mr-3" />
                <Skeleton width="200px" height="16px" />
            </div>
        </div>

        <div className="flex justify-between items-center border-t border-gray-100 pt-4 mt-4">
            <div className="flex space-x-2">
                <Skeleton width="40px" height="24px" borderRadius="0.375rem" />
                <Skeleton width="40px" height="24px" borderRadius="0.375rem" />
            </div>
            <Skeleton width="80px" height="36px" borderRadius="0.5rem" />
        </div>
    </div>
);

export const StatsSkeleton = () => (
    <div className="bg-white rounded-2xl shadow-sm p-6 w-full mb-6">
        <Skeleton width="100px" height="14px" className="mb-2" />
        <Skeleton width="160px" height="32px" className="mb-4" />
        <Skeleton width="100%" height="8px" borderRadius="9999px" />
    </div>
);

export const ProfileSkeleton = () => (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="h-48 bg-gray-200 w-full animate-pulse"></div>
        <div className="px-6 py-6 sm:px-10 relative">
            <div className="absolute -top-16 left-6 sm:left-10 p-1 bg-white rounded-full">
                <Skeleton width="128px" height="128px" borderRadius="9999px" />
            </div>

            <div className="ml-0 mt-20 sm:ml-40 sm:mt-0 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="mb-4 sm:mb-0">
                    <Skeleton width="180px" height="28px" className="mb-2" />
                    <Skeleton width="120px" height="16px" className="mb-2" />
                    <Skeleton width="150px" height="14px" />
                </div>
                <div className="flex space-x-3">
                    <Skeleton width="100px" height="40px" borderRadius="0.5rem" />
                    <Skeleton width="100px" height="40px" borderRadius="0.5rem" />
                </div>
            </div>
        </div>
    </div>
);

export default Skeleton;
