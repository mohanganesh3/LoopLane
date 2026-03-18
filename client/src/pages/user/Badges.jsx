/**
 * Badges & Achievements — Trust Score Deep-Dive + Gamification
 * Backend: getTrustScore, getBadges, checkBadges, getUserStats
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import userService from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';

const BADGE_ICONS = {
  FIRST_RIDE: 'fa-car',
  FIVE_RIDES: 'fa-road',
  TEN_RIDES: 'fa-award',
  TWENTYFIVE_RIDES: 'fa-trophy',
  FIFTY_RIDES: 'fa-crown',
  HUNDRED_RIDES: 'fa-star',
  FIRST_BOOKING: 'fa-ticket-alt',
  FIVE_BOOKINGS: 'fa-clipboard-check',
  VERIFIED_ID: 'fa-id-card',
  VERIFIED_PHONE: 'fa-phone-alt',
  VERIFIED_EMAIL: 'fa-envelope-open',
  FIVE_STAR: 'fa-star',
  ECO_WARRIOR: 'fa-leaf',
  SOCIAL_BUTTERFLY: 'fa-users',
  SUPER_HOST: 'fa-user-shield',
};

const TRUST_LEVELS = [
  { name: 'Newcomer', min: 0, max: 20, color: '#94a3b8', bg: 'bg-gray-100' },
  { name: 'Rising', min: 20, max: 40, color: '#6366f1', bg: 'bg-indigo-100' },
  { name: 'Trusted', min: 40, max: 60, color: '#0ead69', bg: 'bg-emerald-100' },
  { name: 'Veteran', min: 60, max: 80, color: '#e07a5f', bg: 'bg-orange-100' },
  { name: 'Expert', min: 80, max: 100, color: '#f59e0b', bg: 'bg-amber-100' },
];

const Badges = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trustScore, setTrustScore] = useState(null);
  const [badges, setBadges] = useState({ earned: [], available: [] });
  const [stats, setStats] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [trustRes, badgeRes, statsRes] = await Promise.all([
        userService.getTrustScore().catch(() => null),
        userService.getBadges().catch(() => null),
        userService.getUserStats().catch(() => null),
      ]);
      if (trustRes?.success) setTrustScore(trustRes);
      if (badgeRes?.success) setBadges({
        earned: badgeRes.earnedBadges || badgeRes.badges || [],
        available: badgeRes.availableBadges || [],
      });
      if (statsRes?.success) setStats(statsRes.stats || statsRes);
    } catch (err) {
      console.error('[Badges] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckBadges = async () => {
    setChecking(true);
    try {
      const res = await userService.checkBadges();
      if (res?.newBadges?.length > 0) {
        await loadData(); // Refresh
      }
    } catch (err) {
      console.error('[Badges] Check error:', err);
    } finally {
      setChecking(false);
    }
  };

  const score = trustScore?.trustScore ?? trustScore?.score ?? user?.trustScore ?? 0;
  const level = TRUST_LEVELS.find(l => score >= l.min && score < l.max) || TRUST_LEVELS[0];
  const breakdown = trustScore?.breakdown || trustScore?.vectors || {};

  const vectors = [
    { label: 'Verification', value: breakdown.verification ?? breakdown.verificationScore ?? 0, max: 25, icon: 'fa-shield-alt', color: '#0ead69' },
    { label: 'Ride History', value: breakdown.rideHistory ?? breakdown.rideScore ?? 0, max: 25, icon: 'fa-car-side', color: '#6366f1' },
    { label: 'Ratings', value: breakdown.ratings ?? breakdown.ratingScore ?? 0, max: 25, icon: 'fa-star', color: '#f4a261' },
    { label: 'Social Graph', value: breakdown.socialGraph ?? breakdown.socialScore ?? 0, max: 15, icon: 'fa-users', color: '#e07a5f' },
    { label: 'Badges', value: breakdown.badges ?? breakdown.badgeScore ?? 0, max: 10, icon: 'fa-award', color: '#5a9c7c' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Trust Score Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-gray-100 p-8 mb-8 text-center"
        >
          <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: '"Instrument Serif", serif' }}>
            Trust Score & Achievements
          </h1>
          <p className="text-gray-500 text-sm mb-6">Your reputation across the LoopLane community</p>

          {/* Score Ring */}
          <div className="relative w-40 h-40 mx-auto mb-6">
            <svg viewBox="0 0 120 120" className="w-full h-full">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke={level.color}
                strokeWidth="8"
                strokeDasharray={`${(score / 100) * 326.7} 326.7`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: level.color }}>{Math.round(score)}</span>
              <span className="text-xs text-gray-500">/ 100</span>
            </div>
          </div>

          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold ${level.bg}`} style={{ color: level.color }}>
            <i className="fas fa-shield-alt text-xs" />
            {level.name}
          </div>
        </motion.div>

        {/* Score Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 p-6 mb-8"
        >
          <h2 className="font-semibold text-gray-800 mb-4">Score Breakdown</h2>
          <div className="space-y-4">
            {vectors.map(v => (
              <div key={v.label} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: v.color + '15', color: v.color }}>
                  <i className={`fas ${v.icon} text-sm`} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{v.label}</span>
                    <span className="text-xs text-gray-500">{v.value}/{v.max}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(v.value / v.max) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: v.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Rides Posted', value: stats.ridesPosted ?? stats.totalRides ?? 0, icon: 'fa-car', color: '#0ead69' },
              { label: 'Bookings', value: stats.totalBookings ?? 0, icon: 'fa-ticket-alt', color: '#6366f1' },
              { label: 'Avg Rating', value: (stats.averageRating ?? 0).toFixed(1), icon: 'fa-star', color: '#f4a261' },
              { label: 'CO₂ Saved', value: `${(stats.co2Saved ?? 0).toFixed(1)}kg`, icon: 'fa-leaf', color: '#5a9c7c' },
            ].map(s => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl border border-gray-100 p-4 text-center"
              >
                <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: s.color + '15', color: s.color }}>
                  <i className={`fas ${s.icon}`} />
                </div>
                <p className="text-xl font-bold text-gray-800">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Badges */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-gray-800">
              Badges ({badges.earned.length} earned)
            </h2>
            <button
              onClick={handleCheckBadges}
              disabled={checking}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              <i className={`fas fa-sync-alt text-xs ${checking ? 'animate-spin' : ''}`} />
              Check for new badges
            </button>
          </div>

          {/* Earned Badges */}
          {badges.earned.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-3">Earned</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {badges.earned.map((badge, i) => (
                  <motion.div
                    key={badge.badge || badge.name || i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <i className={`fas ${BADGE_ICONS[badge.badge || badge.name] || 'fa-medal'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {(badge.badge || badge.name || '').replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {badge.awardedAt ? new Date(badge.awardedAt).toLocaleDateString() : 'Earned'}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Available (Locked) Badges */}
          {badges.available.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Available to earn</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {badges.available.map((badge, i) => (
                  <div
                    key={badge.badge || badge.name || i}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 opacity-60"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                      <i className={`fas ${BADGE_ICONS[badge.badge || badge.name] || 'fa-lock'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {(badge.badge || badge.name || '').replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-400">
                        {badge.description || badge.criteria || 'Keep going!'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {badges.earned.length === 0 && badges.available.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <i className="fas fa-trophy text-4xl mb-3 block" />
              <p className="text-sm">Start using LoopLane to earn badges and build your trust score!</p>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default Badges;
