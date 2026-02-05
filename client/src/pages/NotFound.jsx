import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-mint-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl"
      >
        {/* 404 Illustration */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <svg
            className="w-64 h-64 mx-auto"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Car illustration */}
            <motion.g
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {/* Car body */}
              <rect x="40" y="120" width="80" height="30" rx="5" fill="#0ead69" />
              <path d="M50 120 L60 100 L100 100 L110 120" fill="#0ead69" />
              
              {/* Windows */}
              <rect x="62" y="105" width="15" height="13" rx="2" fill="#e0f2fe" />
              <rect x="82" y="105" width="15" height="13" rx="2" fill="#e0f2fe" />
              
              {/* Wheels */}
              <circle cx="55" cy="150" r="8" fill="#1e293b" />
              <circle cx="105" cy="150" r="8" fill="#1e293b" />
              <circle cx="55" cy="150" r="4" fill="#64748b" />
              <circle cx="105" cy="150" r="4" fill="#64748b" />
              
              {/* Headlight */}
              <circle cx="120" cy="135" r="3" fill="#fef3c7" />
            </motion.g>

            {/* Road with question marks */}
            <motion.line
              x1="0"
              y1="160"
              x2="200"
              y2="160"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="10,5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
            />
            
            {/* Question marks */}
            <motion.text
              x="150"
              y="140"
              fontSize="24"
              fill="#0ead69"
              opacity="0.5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.5, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              ?
            </motion.text>
            <motion.text
              x="20"
              y="130"
              fontSize="18"
              fill="#0ead69"
              opacity="0.3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.3, y: 0 }}
              transition={{ duration: 0.5, delay: 1 }}
            >
              ?
            </motion.text>
          </svg>
        </motion.div>

        {/* Error Code */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mb-6"
        >
          <h1 className="text-8xl font-bold text-emerald-600 mb-2">404</h1>
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <div className="h-px w-12 bg-gray-300"></div>
            <span className="text-sm uppercase tracking-wider">Page Not Found</span>
            <div className="h-px w-12 bg-gray-300"></div>
          </div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">
            Oops! This route doesn't exist
          </h2>
          <p className="text-gray-600 text-lg mb-2">
            Looks like you've taken a wrong turn on your journey.
          </p>
          <p className="text-gray-500">
            The page you're looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link
            to="/"
            className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-all duration-200 shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/40 hover:scale-105"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Back to Home
          </Link>

          <Link
            to="/find-ride"
            className="inline-flex items-center justify-center px-8 py-3 rounded-full border-2 border-emerald-600 text-emerald-600 font-medium hover:bg-emerald-50 transition-all duration-200 hover:scale-105"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Find a Ride
          </Link>
        </motion.div>

        {/* Help Text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="mt-8 text-sm text-gray-500"
        >
          Need help? Contact our{' '}
          <a href="mailto:support@looplane.com" className="text-emerald-600 hover:text-emerald-700 font-medium">
            support team
          </a>
        </motion.p>
      </motion.div>
    </div>
  );
}
