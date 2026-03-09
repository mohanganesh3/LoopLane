import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClayButton, ClayCard } from '../../components/clay';
import { useScrollReveal, useCountUp, easings } from '../../hooks/useLoopLaneAnimations';

const LogoStrip = () => {
  const logos = ['YourStory', 'TechCrunch', 'Economic Times', 'Mint', 'Inc42'];

  return (
    <div className="py-12 border-y border-[#8ee4af]/20 bg-white/50 backdrop-blur-sm">
      <div className="container mx-auto px-6 lg:px-16">
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          <span className="text-xs text-[#5a7a68] uppercase tracking-[0.2em]">Featured in</span>
          {logos.map((logo, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="text-[#3d5a4c] font-semibold text-lg tracking-tight opacity-60 hover:opacity-100 transition-opacity"
            >
              {logo}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// PROBLEM/SOLUTION - Contrast Section
// ============================================
const ProblemSolutionSection = () => {
  const { ref: inViewRef, inView } = useScrollReveal({ threshold: 0.2 });

  return (
    <section
      ref={inViewRef}
      className="relative py-32 bg-gradient-to-br from-[#0f1a1a] via-[#142826] to-[#0f1a1a] overflow-hidden"
    >
      {/* Decorative gradient orbs */}
      <div className="absolute top-20 left-20 w-[400px] h-[400px] rounded-full bg-[#0ead69]/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-20 right-20 w-[300px] h-[300px] rounded-full bg-[#8ee4af]/10 blur-[80px] pointer-events-none" />

      {/* Decorative diagonal line */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" preserveAspectRatio="none">
          <line x1="0" y1="100%" x2="100%" y2="0" stroke="white" strokeWidth="1" />
        </svg>
      </div>

      <div className="container mx-auto px-6 lg:px-16 relative z-10">
        <div className="grid md:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* The Problem */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: easings.smooth }}
          >
            <span
              className="text-[#ff6b6b] text-sm uppercase tracking-[0.2em] mb-4 block"
              style={{ fontFamily: 'Caveat, cursive', fontSize: '1.25rem', textTransform: 'none', letterSpacing: 'normal' }}
            >
              The problem we see
            </span>
            <h2
              className="text-white mb-8 leading-[0.95]"
              style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontSize: 'clamp(2.5rem, 5vw, 3.5rem)' }}
            >
              Empty seats.
              <br />
              Rising costs.
              <br />
              Gridlocked cities.
            </h2>
            <p className="text-[#9cb5a4] text-lg leading-relaxed max-w-md">
              Every day, millions of cars hit Indian roads with just one person inside.
              That's wasted money, wasted fuel, and hours stuck in frustrating traffic.
            </p>

            {/* Stats */}
            <div className="flex gap-8 mt-10">
              <div>
                <span className="text-4xl font-bold text-[#ff6b6b]">73%</span>
                <p className="text-sm text-[#9cb5a4] mt-1">Cars have<br />empty seats</p>
              </div>
              <div>
                <span className="text-4xl font-bold text-[#ff6b6b]">₹4,200</span>
                <p className="text-sm text-[#9cb5a4] mt-1">Average monthly<br />commute cost</p>
              </div>
            </div>
          </motion.div>

          {/* The Solution */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2, ease: easings.smooth }}
            className="md:text-right"
          >
            <span
              className="text-[#8ee4af] text-sm uppercase tracking-[0.2em] mb-4 block"
              style={{ fontFamily: 'Caveat, cursive', fontSize: '1.25rem', textTransform: 'none', letterSpacing: 'normal' }}
            >
              Our solution
            </span>
            <h2
              className="text-white mb-8 leading-[0.95]"
              style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontSize: 'clamp(2.5rem, 5vw, 3.5rem)' }}
            >
              Fill those seats.
              <br />
              Share the cost.
              <br />
              Move together.
            </h2>
            <p className="text-[#9cb5a4] text-lg leading-relaxed max-w-md md:ml-auto">
              LoopLane connects people headed the same direction.
              Drivers earn. Riders save. Cities breathe.
              <span className="text-white font-medium"> Everyone wins.</span>
            </p>

            <motion.div
              className="mt-10"
              whileHover={{ scale: 1.02 }}
            >
              <Link
                to="/register"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-[#8ee4af] to-[#0ead69] text-[#0f1a1a] px-8 py-4 rounded-full font-semibold hover:shadow-xl hover:shadow-[#8ee4af]/30 transition-all"
              >
                Join the movement
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ============================================
// HOW IT WORKS - Step Cards with character
// ============================================
const HowItWorksSection = () => {
  const steps = [
    {
      num: '01',
      title: 'Post or Search',
      desc: 'Share your route as a driver or find rides heading your way. Takes 30 seconds.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      )
    },
    {
      num: '02',
      title: 'Connect & Verify',
      desc: 'Chat with verified travelers. Agree on pickup points. Check ratings first.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    },
    {
      num: '03',
      title: 'Ride Together',
      desc: 'Share the journey with OTP-secured pickup. Track in real-time.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2-3H8L6 10l-2.5 1.1c-.8.2-1.5 1-1.5 1.9v3c0 .6.4 1 1 1h2M4 17h16" />
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      )
    },
    {
      num: '04',
      title: 'Rate & Repeat',
      desc: 'Build your reputation. Find regular commute partners. Save consistently.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )
    },
  ];

  return (
    <section id="how-it-works" className="py-28 bg-gradient-to-br from-[#f0fdf4] via-[#fafcfa] to-[#ecfdf5]">
      <div className="container mx-auto px-6 lg:px-16">
        {/* Header - Asymmetric */}
        <div className="max-w-2xl mb-20">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-[#0ead69] mb-4 block"
            style={{ fontFamily: 'Caveat, cursive', fontSize: '1.5rem' }}
          >
            How it works
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-[#0f1a1a] leading-tight"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
          >
            Four simple steps.
            <br />
            <span className="text-[#5a7a68]">Zero complexity.</span>
          </motion.h2>
        </div>

        {/* Steps Grid - Staggered */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30, rotate: idx % 2 === 0 ? -2 : 2 }}
              whileInView={{ opacity: 1, y: 0, rotate: idx % 2 === 0 ? -1 : 1 }}
              whileHover={{ rotate: 0, y: -5 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="group"
            >
              <ClayCard variant="warm" className="p-8 h-full bg-white/80 backdrop-blur-lg border border-white/50">
                {/* Number */}
                <span
                  className="text-6xl font-bold text-[#e8f5e9] group-hover:text-[#8ee4af]/30 transition-colors"
                  style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
                >
                  {step.num}
                </span>

                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f0fdf4] to-white border border-[#8ee4af]/20 flex items-center justify-center mt-4 mb-6 text-[#0ead69] group-hover:bg-gradient-to-br group-hover:from-[#8ee4af] group-hover:to-[#0ead69] group-hover:text-white transition-all shadow-lg shadow-[#8ee4af]/10">
                  {step.icon}
                </div>

                <h3 className="text-xl font-semibold text-[#0f1a1a] mb-3">{step.title}</h3>
                <p className="text-[#3d5a4c] text-sm leading-relaxed">{step.desc}</p>
              </ClayCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// FEATURES - Bento Grid Layout
// ============================================
const FeaturesSection = () => {
  const features = [
    {
      title: 'Verified Users',
      desc: 'Aadhar, license & phone verified. Know exactly who you\'re riding with.',
      icon: '🛡️',
      color: 'mint',
      size: 'large'
    },
    {
      title: 'OTP Secured',
      desc: 'Safe pickup with unique verification codes.',
      icon: '🔐',
      color: 'emerald',
      size: 'small'
    },
    {
      title: 'Live Tracking',
      desc: 'Family can follow your journey in real-time.',
      icon: '📍',
      color: 'dark',
      size: 'small'
    },
    {
      title: 'In-app Chat',
      desc: 'Communicate without sharing personal numbers. Privacy first.',
      icon: '💬',
      color: 'glass',
      size: 'medium'
    },
    {
      title: 'SOS Alert',
      desc: 'One-tap emergency button. Help is always close.',
      icon: '🆘',
      color: 'mint',
      size: 'small'
    },
    {
      title: 'Fair Split',
      desc: 'Transparent cost algorithm. No surprises.',
      icon: '💰',
      color: 'emerald',
      size: 'small'
    },
  ];

  const getCardClasses = (color) => {
    switch (color) {
      case 'mint': return 'bg-gradient-to-br from-[#8ee4af]/20 to-[#5fd992]/10 border-[#8ee4af]/30';
      case 'emerald': return 'bg-gradient-to-br from-[#0ead69]/15 to-[#8ee4af]/10 border-[#0ead69]/20';
      case 'dark': return 'bg-gradient-to-br from-[#0f1a1a] to-[#264d3d] border-[#264d3d]/50 text-white';
      case 'glass': return 'bg-white/70 backdrop-blur-lg border-white/50';
      default: return 'bg-white/60 backdrop-blur-lg border-white/40';
    }
  };

  return (
    <section id="features" className="py-28 bg-gradient-to-b from-[#ecfdf5] to-[#f0fdf4]">
      <div className="container mx-auto px-6 lg:px-16">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-[#0ead69] mb-4 block"
            style={{ fontFamily: 'Caveat, cursive', fontSize: '1.5rem' }}
          >
            Why LoopLane
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-[#0f1a1a] leading-tight"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
          >
            Built for trust.
            <br />
            Designed for humans.
          </motion.h2>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={feature.size === 'large' ? 'md:row-span-2' : feature.size === 'medium' ? 'md:col-span-2' : ''}
            >
              <div
                className={`p-8 h-full rounded-3xl border shadow-xl shadow-[#8ee4af]/5 hover:shadow-2xl hover:shadow-[#8ee4af]/10 transition-all ${getCardClasses(feature.color)}`}
              >
                <span className="text-4xl mb-6 block">{feature.icon}</span>
                <h3 className={`text-xl font-semibold mb-3 ${feature.color === 'dark' ? 'text-white' : 'text-[#0f1a1a]'}`}>
                  {feature.title}
                </h3>
                <p className={`text-sm leading-relaxed ${feature.color === 'dark' ? 'text-[#9cb5a4]' : 'text-[#3d5a4c]'}`}>
                  {feature.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// STATS SECTION - Impact Numbers
// ============================================
const StatsSection = () => {
  const stats = [
    { value: 50000, suffix: '+', label: 'Happy Riders' },
    { value: 2.5, suffix: 'M', label: 'KM Shared' },
    { value: 120, suffix: 'K', label: 'Trips Completed' },
    { value: 340, suffix: 'T', label: 'CO₂ Saved' },
  ];

  return (
    <section className="py-20 bg-white/50 backdrop-blur-sm border-y border-[#8ee4af]/20">
      <div className="container mx-auto px-6 lg:px-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="text-center"
            >
              <StatCounter value={stat.value} suffix={stat.suffix} />
              <p className="text-[#5a7a68] text-sm mt-2">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const StatCounter = ({ value, suffix }) => {
  const { ref, count } = useCountUp(value, { duration: 2000, decimals: value % 1 !== 0 ? 1 : 0 });

  return (
    <span
      ref={ref}
      className="text-4xl md:text-5xl font-bold text-[#0f1a1a]"
      style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
    >
      {count}
      <span className="text-[#0ead69]">{suffix}</span>
    </span>
  );
};

// ============================================
// TESTIMONIALS - Story Cards
// ============================================
const TestimonialsSection = () => {
  const testimonials = [
    {
      name: 'Priya Menon',
      role: 'Daily Commuter',
      location: 'Bangalore',
      quote: 'Saved ₹4,000/month on my office commute. Plus, I made a friend who loves the same podcasts!',
      avatar: 'P',
      gradient: 'from-[#8ee4af] to-[#0ead69]'
    },
    {
      name: 'Rahul Sharma',
      role: 'Weekend Traveler',
      location: 'Mumbai',
      quote: 'Long drives are so much better with company. LoopLane makes finding co-travelers genuinely effortless.',
      avatar: 'R',
      gradient: 'from-[#5fd992] to-[#0ead69]'
    },
    {
      name: 'Ananya Krishnan',
      role: 'Student',
      location: 'Delhi',
      quote: 'As a woman, I felt safe with the verification and SOS features. The app is reliable and the community is respectful.',
      avatar: 'A',
      gradient: 'from-[#0f1a1a] to-[#264d3d]'
    },
  ];

  return (
    <section id="testimonials" className="py-28 bg-gradient-to-br from-[#f0fdf4] to-[#fafcfa]">
      <div className="container mx-auto px-6 lg:px-16">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-[#0ead69] mb-4 block"
            style={{ fontFamily: 'Caveat, cursive', fontSize: '1.5rem' }}
          >
            Real stories
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-[#0f1a1a]"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
          >
            What our riders say
          </motion.h2>
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30, rotate: idx === 0 ? -2 : idx === 1 ? 0 : 2 }}
              whileInView={{ opacity: 1, y: 0, rotate: idx === 0 ? -1 : idx === 1 ? 0 : 1 }}
              whileHover={{ rotate: 0, y: -5 }}
              transition={{ delay: idx * 0.15 }}
            >
              <div className="p-8 h-full bg-white/80 backdrop-blur-lg rounded-3xl border border-white/50 shadow-xl shadow-[#8ee4af]/5 hover:shadow-2xl hover:shadow-[#8ee4af]/10 transition-all">
                {/* Quote mark */}
                <span
                  className="text-6xl text-[#e8f5e9] leading-none"
                  style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
                >
                  "
                </span>

                <p className="text-[#3d5a4c] text-lg leading-relaxed mb-8 -mt-4">
                  {t.quote}
                </p>

                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white font-semibold shadow-lg shadow-[#8ee4af]/30`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-[#0f1a1a]">{t.name}</p>
                    <p className="text-sm text-[#5a7a68]">{t.role} • {t.location}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// CTA - Final Push - Premium Mint Gradient
// ============================================
const CTASection = () => {
  return (
    <section className="relative py-28 overflow-hidden bg-gradient-to-br from-[#0ead69] via-[#0d9a5e] to-[#0a7a4a]">
      {/* Decorative elements - glassmorphism style */}
      <motion.div
        className="absolute top-10 right-10 w-72 h-72 border-2 border-white/20 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute -bottom-20 -left-20 w-96 h-96 border border-white/10 rounded-full"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <div className="absolute top-40 left-20 w-[300px] h-[300px] rounded-full bg-[#8ee4af]/20 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-20 right-40 w-[250px] h-[250px] rounded-full bg-white/10 blur-[60px] pointer-events-none" />

      <div className="container mx-auto px-6 lg:px-16 relative z-10 text-center">
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="text-white/80 mb-6 block"
          style={{ fontFamily: 'Caveat, cursive', fontSize: '1.75rem' }}
        >
          Ready to start?
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-white mb-10"
          style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontSize: 'clamp(2.5rem, 6vw, 5rem)', lineHeight: 1.1 }}
        >
          Join 50,000+ smart
          <br />
          commuters today.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
        >
          <ClayButton
            variant="secondary"
            size="lg"
            as={Link}
            to="/register"
            className="!bg-white !text-[#0ead69] hover:!bg-[#f0fdf4] !shadow-xl !shadow-black/20"
          >
            <span className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Get Started Free
            </span>
          </ClayButton>

          <ClayButton
            variant="ghost"
            size="lg"
            as={Link}
            to="/search"
            className="!border-2 !border-white/80 !text-white hover:!bg-white/10 !backdrop-blur-sm"
          >
            <span className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Find a Ride
            </span>
          </ClayButton>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white/70 text-sm"
        >
          Free forever • No credit card • 30 second signup
        </motion.p>
      </div>
    </section>
  );
};

export { LogoStrip, ProblemSolutionSection, HowItWorksSection, FeaturesSection, StatsSection, TestimonialsSection, CTASection };
