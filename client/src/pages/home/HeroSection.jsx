import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { ClayButton, ClayCard } from '../../components/clay';
import { easings } from '../../hooks/useLoopLaneAnimations';

const HeroSection = () => {
  const navigate = useNavigate();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const sectionRef = useRef(null);
  
  // Parallax for decorative elements
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  });
  
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 15]);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <section ref={sectionRef} className="relative min-h-screen pt-32 pb-24 overflow-hidden">
      {/* Premium organic blob shapes with mint gradient */}
      <motion.div 
        style={{ y: y1, rotate }}
        className="absolute -top-20 -right-32 w-[500px] h-[500px] opacity-60 pointer-events-none"
      >
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <linearGradient id="mintGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8ee4af" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0ead69" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.5,90,-16.3,88.5,-0.9C87,14.5,81.4,29,73.1,41.8C64.8,54.6,53.8,65.7,40.6,73.4C27.4,81.1,12,85.4,-3.5,90.5C-19,95.6,-38,101.5,-51.8,94.6C-65.6,87.7,-74.2,68,-79.4,49.1C-84.6,30.2,-86.4,12.1,-84.3,-5.2C-82.2,-22.5,-76.2,-39,-65.3,-50.6C-54.4,-62.2,-38.6,-68.9,-23.3,-75.4C-8,-81.9,-4,-88.2,5.5,-97.1C15,-106,30.6,-83.6,44.7,-76.4Z" transform="translate(100 100)" fill="url(#mintGradient1)" />
        </svg>
      </motion.div>
      
      <motion.div 
        style={{ y: y2 }}
        className="absolute bottom-0 -left-20 w-[400px] h-[400px] opacity-50 pointer-events-none"
      >
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <linearGradient id="mintGradient2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5fd992" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8ee4af" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <path d="M41.3,-71.2C54.4,-64.5,66.6,-55.2,75.2,-43C83.8,-30.7,88.8,-15.4,88.4,-0.2C88,14.9,82.2,29.8,73.5,42.5C64.8,55.2,53.2,65.7,39.8,73.2C26.4,80.7,11.2,85.2,-3.3,90.5C-17.8,95.8,-35.6,101.9,-49.8,95.3C-64,88.7,-74.6,69.4,-82.2,50.1C-89.8,30.8,-94.4,11.5,-93.2,-7.4C-92,-26.3,-85,-44.8,-73.2,-57.7C-61.4,-70.6,-44.8,-78,-28.8,-82.6C-12.8,-87.2,2.6,-89,16.8,-84.8C31,-80.6,28.2,-77.9,41.3,-71.2Z" transform="translate(100 100)" fill="url(#mintGradient2)" />
        </svg>
      </motion.div>

      <div className="container mx-auto px-6 lg:px-16 relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center min-h-[calc(100vh-200px)]">
          {/* Left Content - Takes 7 cols */}
          <div className="lg:col-span-7 relative">
            {/* Handwritten annotation - human touch */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-6"
            >
              <span 
                className="text-xl text-[#0ead69] inline-flex items-center gap-2"
                style={{ fontFamily: 'Caveat, cursive' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#0ead69]">
                  <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                the smarter way to commute
              </span>
            </motion.div>

            {/* Main Headline - Editorial, impactful */}
            <motion.h1 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: easings.smooth }}
              className="text-[#0f1a1a] mb-8"
              style={{ 
                fontFamily: 'Instrument Serif, Georgia, serif',
                fontSize: 'clamp(3.5rem, 8vw, 6rem)',
                lineHeight: 0.95,
                letterSpacing: '-0.03em'
              }}
            >
              Going somewhere?
              <br />
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-[#0ead69] to-[#5fd992] bg-clip-text text-transparent">Take someone.</span>
                {/* Hand-drawn underline - premium mint gradient */}
                <svg 
                  viewBox="0 0 300 20" 
                  className="absolute -bottom-2 left-0 w-full h-4"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="underlineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8ee4af" />
                      <stop offset="100%" stopColor="#0ead69" />
                    </linearGradient>
                  </defs>
                  <path 
                    d="M2,10 Q75,4 150,10 T298,10" 
                    fill="none" 
                    stroke="url(#underlineGrad)" 
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="animate-draw"
                    style={{ strokeDasharray: 400, strokeDashoffset: 400, animation: 'draw 1s 0.8s forwards ease-out' }}
                  />
                </svg>
              </span>
            </motion.h1>

            {/* Subtext */}
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-xl text-[#3d5a4c] max-w-lg mb-10 leading-relaxed"
            >
              Connect with verified travelers heading your way. 
              <span className="text-[#0f1a1a] font-medium"> Split costs, reduce emissions, make friends.</span>
            </motion.p>

            {/* Search Card - Premium glassmorphism style */}
            <motion.div 
              initial={{ opacity: 0, y: 30, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: -1 }}
              transition={{ duration: 0.7, delay: 0.6 }}
              whileHover={{ rotate: 0, scale: 1.01 }}
              className="max-w-lg"
            >
              <div className="relative">
                {/* Glow effect behind card */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#8ee4af]/40 to-[#0ead69]/30 rounded-3xl blur-xl opacity-70" />
                
                <ClayCard variant="warm" className="p-8 relative bg-white/80 backdrop-blur-xl border border-white/50">
                  <form onSubmit={handleSearch}>
                    <div className="space-y-5">
                      {/* From Input */}
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-4 h-4 rounded-full border-2 border-[#0ead69] bg-[#8ee4af]/30 shadow-lg shadow-[#8ee4af]/30" />
                          <div className="absolute top-5 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gradient-to-b from-[#0ead69] to-[#8ee4af]/30" />
                        </div>
                        <input
                          type="text"
                          value={from}
                          onChange={(e) => setFrom(e.target.value)}
                          placeholder="Leaving from..."
                          className="flex-1 border-b-2 border-[#e8f5e9] focus:border-[#0ead69] py-3 bg-transparent 
                                   outline-none transition-colors text-[#0f1a1a] placeholder:text-[#9cb5a4] text-lg"
                        />
                      </div>
                      
                      {/* To Input */}
                      <div className="flex items-center gap-4">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#8ee4af] to-[#0ead69] shadow-lg shadow-[#0ead69]/30" />
                        <input
                          type="text"
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                          placeholder="Going to..."
                          className="flex-1 border-b-2 border-[#e8f5e9] focus:border-[#0ead69] py-3 bg-transparent 
                                   outline-none transition-colors text-[#0f1a1a] placeholder:text-[#9cb5a4] text-lg"
                        />
                      </div>

                      {/* Buttons - Premium gradient style */}
                      <div className="flex gap-3 pt-4">
                        <ClayButton type="submit" variant="primary" size="lg" className="flex-[2]">
                          <span className="flex items-center justify-center gap-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="11" cy="11" r="8" />
                              <path d="M21 21l-4.35-4.35" />
                            </svg>
                            Find My Ride
                          </span>
                        </ClayButton>
                        <ClayButton variant="outline" size="lg" as={Link} to="/post-ride" className="flex-1">
                          <span className="flex items-center justify-center gap-2">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            Offer
                          </span>
                        </ClayButton>
                      </div>
                    </div>
                  </form>
                </ClayCard>
              </div>
            </motion.div>

            {/* Trust indicators - subtle, premium */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-8 flex items-center gap-6 text-sm text-[#5a7a68]"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#0ead69]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Verified users only
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#0ead69]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                End-to-end secure
              </span>
            </motion.div>
          </div>

          {/* Right Side - Illustration Area */}
          <div className="lg:col-span-5 relative hidden lg:block">
            <HeroIllustration />
          </div>
        </div>
      </div>
      
      {/* Scroll indicator */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-2 text-[#5a7a68]"
        >
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
};

// Hero Illustration - Isometric 3D Car Scene
const HeroIllustration = () => {
  const containerRef = useRef(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smoother, less sensitive mouse tracking
  const springConfig = { damping: 40, stiffness: 100 };
  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [4, -4]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-300, 300], [-5, 5]), springConfig);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set((e.clientX - centerX) * 0.5); // Reduce sensitivity
    mouseY.set((e.clientY - centerY) * 0.5);
  };

  return (
    <motion.div
      ref={containerRef}
      className="relative w-full aspect-square cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { mouseX.set(0); mouseY.set(0); }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, delay: 0.5 }}
    >
      
      {/* Background glow - mint gradient */}
      <div className="absolute inset-0 rounded-full bg-gradient-radial from-[#8ee4af]/15 via-transparent to-transparent" />
      
      {/* Floating particles - mint themed */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            top: `${20 + i * 12}%`,
            left: `${10 + i * 14}%`,
            width: `${6 + i * 2}px`,
            height: `${6 + i * 2}px`,
            background: i % 2 === 0 
              ? 'linear-gradient(135deg, #8ee4af 0%, #5fd992 100%)' 
              : 'linear-gradient(135deg, #0ead69 0%, #8ee4af 100%)',
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 3.5 + i * 0.4,
            repeat: Infinity,
            delay: i * 0.3,
          }}
        />
      ))}

      {/* 3D Scene - Premium Carpooling Illustration */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: '1500px' }}>
        <motion.div
          style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
          className="relative"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            {/* === CLEAN MODERN CAR ILLUSTRATION === */}
            <svg 
              width="620" 
              height="520" 
              viewBox="-60 -30 500 400" 
              className="drop-shadow-2xl overflow-visible"
              style={{
                overflow: 'visible',
                WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 50% 45%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.65) 75%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0) 100%)',
                maskImage: 'radial-gradient(ellipse 85% 75% at 50% 45%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.65) 75%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0) 100%)',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskSize: '100% 100%',
                maskSize: '100% 100%'
              }}
            >
              <defs>
                {/* Edge fade masks for seamless blending - VERY gradual dissolve */}
                <linearGradient id="fadeLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="white" stopOpacity="0"/>
                  <stop offset="10%" stopColor="white" stopOpacity="0.05"/>
                  <stop offset="25%" stopColor="white" stopOpacity="0.3"/>
                  <stop offset="45%" stopColor="white" stopOpacity="0.7"/>
                  <stop offset="60%" stopColor="white" stopOpacity="1"/>
                </linearGradient>
                <linearGradient id="fadeRight" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="40%" stopColor="white" stopOpacity="1"/>
                  <stop offset="55%" stopColor="white" stopOpacity="0.7"/>
                  <stop offset="75%" stopColor="white" stopOpacity="0.3"/>
                  <stop offset="90%" stopColor="white" stopOpacity="0.05"/>
                  <stop offset="100%" stopColor="white" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="fadeBottom" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="40%" stopColor="white" stopOpacity="1"/>
                  <stop offset="55%" stopColor="white" stopOpacity="0.7"/>
                  <stop offset="75%" stopColor="white" stopOpacity="0.3"/>
                  <stop offset="90%" stopColor="white" stopOpacity="0.05"/>
                  <stop offset="100%" stopColor="white" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="fadeTop" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0"/>
                  <stop offset="10%" stopColor="white" stopOpacity="0.05"/>
                  <stop offset="25%" stopColor="white" stopOpacity="0.3"/>
                  <stop offset="45%" stopColor="white" stopOpacity="0.7"/>
                  <stop offset="60%" stopColor="white" stopOpacity="1"/>
                </linearGradient>
                
                {/* Radial fade for organic dissolve - very soft edges, no visible boundary */}
                <radialGradient id="radialFade" cx="50%" cy="50%" r="70%" fx="50%" fy="45%">
                  <stop offset="0%" stopColor="white" stopOpacity="1"/>
                  <stop offset="50%" stopColor="white" stopOpacity="1"/>
                  <stop offset="70%" stopColor="white" stopOpacity="0.9"/>
                  <stop offset="85%" stopColor="white" stopOpacity="0.5"/>
                  <stop offset="95%" stopColor="white" stopOpacity="0.15"/>
                  <stop offset="100%" stopColor="white" stopOpacity="0"/>
                </radialGradient>
                
                {/* Combined edge fade mask - larger ellipse for seamless blend */}
                <mask id="edgeFade">
                  <ellipse cx="190" cy="170" rx="320" ry="260" fill="url(#radialFade)"/>
                </mask>
                
                {/* Car body gradient - emerald */}
                <linearGradient id="carBody" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#16a34a" />
                </linearGradient>
                
                {/* Window gradient */}
                <linearGradient id="windowGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
                
                {/* Wheel gradient */}
                <radialGradient id="wheelGrad" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#374151" />
                  <stop offset="100%" stopColor="#111827" />
                </radialGradient>
                
                {/* === CLAYMORPHISM GRADIENTS FOR PASSENGERS === */}
                {/* Driver head - warm peach skin tone */}
                <radialGradient id="driverHead" cx="30%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#fcd5ce"/>
                  <stop offset="60%" stopColor="#f8b4a8"/>
                  <stop offset="100%" stopColor="#e8998d"/>
                </radialGradient>
                
                {/* Driver hair - purple clay */}
                <radialGradient id="driverHair" cx="30%" cy="20%" r="80%">
                  <stop offset="0%" stopColor="#a78bfa"/>
                  <stop offset="100%" stopColor="#7c3aed"/>
                </radialGradient>
                
                {/* Driver shirt - coral/orange clay */}
                <radialGradient id="driverShirt" cx="30%" cy="20%" r="80%">
                  <stop offset="0%" stopColor="#fb923c"/>
                  <stop offset="100%" stopColor="#ea580c"/>
                </radialGradient>
                
                {/* Passenger 1 head - lighter skin */}
                <radialGradient id="passenger1Head" cx="30%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#fde7d9"/>
                  <stop offset="60%" stopColor="#f5cdb8"/>
                  <stop offset="100%" stopColor="#e8b69a"/>
                </radialGradient>
                
                {/* Passenger 1 shirt - mint clay (avoid strong blue) */}
                <radialGradient id="passenger1Shirt" cx="30%" cy="20%" r="80%">
                  <stop offset="0%" stopColor="#6ee7b7"/>
                  <stop offset="100%" stopColor="#059669"/>
                </radialGradient>
                
                {/* Passenger 2 head - medium skin */}
                <radialGradient id="passenger2Head" cx="30%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#d4a574"/>
                  <stop offset="60%" stopColor="#c68f5a"/>
                  <stop offset="100%" stopColor="#b07d4a"/>
                </radialGradient>
                
                {/* Passenger 2 shirt - pink/magenta clay */}
                <radialGradient id="passenger2Shirt" cx="30%" cy="20%" r="80%">
                  <stop offset="0%" stopColor="#f472b6"/>
                  <stop offset="100%" stopColor="#db2777"/>
                </radialGradient>
                
                {/* Sky ambient gradient (removed from scene to avoid grey/blue backdrop artifacts) */}
                
                {/* Shadow filter */}
                <filter id="carShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#166534" floodOpacity="0.3"/>
                </filter>
                
                {/* Road texture pattern */}
                <pattern id="roadTexture" patternUnits="userSpaceOnUse" width="8" height="8">
                  <circle cx="2" cy="2" r="0.5" fill="#9ca3af"/>
                  <circle cx="6" cy="6" r="0.5" fill="#9ca3af"/>
                </pattern>
              </defs>
              
              {/* === SEAMLESS BLENDED SCENE === */}
              <g>
              
              {/* === SKY BACKGROUND === */}
              {/* (Removed sky background wash + ambient glow ellipse to eliminate grey/blue square backdrop) */}
              
              {/* === SUN with rays === */}
              <g transform="translate(320, 45)">
                {/* Outer glow */}
                <circle cx="0" cy="0" r="45" fill="#fef3c7" opacity="0.25"/>
                <circle cx="0" cy="0" r="30" fill="#fde68a" opacity="0.4"/>
                {/* Sun core */}
                <circle cx="0" cy="0" r="18" fill="#fcd34d" opacity="0.85"/>
                <circle cx="0" cy="0" r="12" fill="#fbbf24" opacity="0.95"/>
                {/* Sun rays */}
                <g stroke="#fcd34d" strokeWidth="2" opacity="0.35">
                  <line x1="0" y1="-28" x2="0" y2="-38"/>
                  <line x1="20" y1="-20" x2="27" y2="-27"/>
                  <line x1="28" y1="0" x2="38" y2="0"/>
                  <line x1="20" y1="20" x2="27" y2="27"/>
                  <line x1="-20" y1="-20" x2="-27" y2="-27"/>
                </g>
              </g>
              
              {/* === FLUFFY CLOUDS === */}
              <g opacity="0.8">
                {/* Cloud far left */}
                <g transform="translate(-10, 55)">
                  <ellipse cx="0" cy="0" rx="20" ry="11" fill="white"/>
                  <ellipse cx="14" cy="-2" rx="14" ry="9" fill="white"/>
                  <ellipse cx="-10" cy="2" rx="12" ry="8" fill="white"/>
                </g>
                {/* Cloud 1 - left */}
                <g transform="translate(70, 75)">
                  <ellipse cx="0" cy="0" rx="24" ry="13" fill="white"/>
                  <ellipse cx="18" cy="-3" rx="18" ry="11" fill="white"/>
                  <ellipse cx="-15" cy="2" rx="15" ry="10" fill="white"/>
                  <ellipse cx="8" cy="5" rx="20" ry="11" fill="white"/>
                </g>
                {/* Cloud 2 - center */}
                <g transform="translate(190, 45)">
                  <ellipse cx="0" cy="0" rx="20" ry="11" fill="white"/>
                  <ellipse cx="16" cy="-2" rx="16" ry="10" fill="white"/>
                  <ellipse cx="-14" cy="2" rx="14" ry="8" fill="white"/>
                </g>
                {/* Cloud 3 - right */}
                <g transform="translate(310, 60)">
                  <ellipse cx="0" cy="0" rx="22" ry="12" fill="white"/>
                  <ellipse cx="17" cy="-2" rx="17" ry="11" fill="white"/>
                  <ellipse cx="-14" cy="3" rx="14" ry="9" fill="white"/>
                </g>
                {/* Cloud far right */}
                <g transform="translate(380, 45)">
                  <ellipse cx="0" cy="0" rx="18" ry="10" fill="white"/>
                  <ellipse cx="12" cy="-2" rx="12" ry="8" fill="white"/>
                  <ellipse cx="-10" cy="2" rx="10" ry="7" fill="white"/>
                </g>
              </g>
              
              {/* === CITYSCAPE SILHOUETTE === */}
              <g fill="#cbd5e1">
                {/* Buildings - far left */}
                <rect x="-15" y="182" width="20" height="48" rx="2" opacity="0.18"/>
                <rect x="10" y="175" width="22" height="55" rx="2" opacity="0.22"/>
                {/* Buildings - left side */}
                <rect x="36" y="180" width="26" height="50" rx="2" opacity="0.28"/>
                <rect x="66" y="170" width="22" height="60" rx="2" opacity="0.32"/>
                <rect x="92" y="185" width="18" height="45" rx="2" opacity="0.28"/>
                
                {/* Buildings - right side */}
                <rect x="280" y="178" width="22" height="52" rx="2" opacity="0.28"/>
                <rect x="306" y="168" width="28" height="62" rx="2" opacity="0.35"/>
                <rect x="338" y="175" width="22" height="55" rx="2" opacity="0.3"/>
                {/* Buildings - far right */}
                <rect x="364" y="182" width="24" height="48" rx="2" opacity="0.22"/>
                <rect x="392" y="178" width="20" height="52" rx="2" opacity="0.18"/>
              </g>
              
              {/* Building windows */}
              <g fill="#94a3b8" opacity="0.3">
                <rect x="70" y="178" width="4" height="4" rx="0.5"/>
                <rect x="78" y="178" width="4" height="4" rx="0.5"/>
                <rect x="70" y="186" width="4" height="4" rx="0.5"/>
                <rect x="310" y="176" width="5" height="5" rx="0.5"/>
                <rect x="322" y="176" width="5" height="5" rx="0.5"/>
                <rect x="310" y="186" width="5" height="5" rx="0.5"/>
              </g>
              
              {/* === ROAD === */}
              {/* Road extends beyond visible area and fades */}
              <defs>
                <linearGradient id="roadFadeLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4b5563" stopOpacity="0"/>
                  <stop offset="100%" stopColor="#4b5563" stopOpacity="1"/>
                </linearGradient>
                <linearGradient id="roadFadeRight" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4b5563" stopOpacity="1"/>
                  <stop offset="100%" stopColor="#4b5563" stopOpacity="0"/>
                </linearGradient>
              </defs>
              
              {/* Road sections */}
              <g>
                {/* Left fade section */}
                <rect x="-30" y="220" width="110" height="40" fill="url(#roadFadeLeft)"/>
                {/* Main road */}
                <rect x="80" y="220" width="220" height="40" fill="#4b5563"/>
                {/* Right fade section */}
                <rect x="300" y="220" width="110" height="40" fill="url(#roadFadeRight)"/>
              </g>
              
              {/* Road texture overlay */}
              <rect x="80" y="220" width="220" height="40" fill="url(#roadTexture)" opacity="0.1"/>
              
              {/* Center dashed line - yellow */}
              <g strokeLinecap="round">
                <line x1="-20" y1="240" x2="400" y2="240" stroke="#fbbf24" strokeWidth="3" strokeDasharray="20 15">
                  <animate attributeName="stroke-dashoffset" values="0;35" dur="1.5s" repeatCount="indefinite"/>
                </line>
              </g>
              
              {/* Road edge lines - grey, same speed as yellow */}
              <g opacity="0.4">
                <line x1="-20" y1="225" x2="400" y2="225" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="30 20">
                  <animate attributeName="stroke-dashoffset" values="0;50" dur="1.5s" repeatCount="indefinite"/>
                </line>
                <line x1="-20" y1="255" x2="400" y2="255" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="30 20">
                  <animate attributeName="stroke-dashoffset" values="0;50" dur="1.5s" repeatCount="indefinite"/>
                </line>
              </g>
              
              {/* Road debris - animate across smoothly with road */}
              <g fill="#6b7280" opacity="0.2">
                <rect x="50" y="232" width="4" height="2" rx="1">
                  <animate attributeName="x" values="400;-30" dur="4s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0;0.3;0.3;0" dur="4s" repeatCount="indefinite"/>
                </rect>
                <rect x="180" y="248" width="5" height="2" rx="1">
                  <animate attributeName="x" values="400;-30" dur="4.5s" repeatCount="indefinite" begin="0.8s"/>
                  <animate attributeName="opacity" values="0;0.3;0.3;0" dur="4.5s" repeatCount="indefinite" begin="0.8s"/>
                </rect>
              </g>
              
              {/* === ROUTE PATH === */}
              <path 
                d="M30 195 Q100 175, 190 190 T350 185" 
                fill="none" 
                stroke="#86efac" 
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="12 8"
                opacity="0.5"
              >
                <animate attributeName="stroke-dashoffset" values="0;-40" dur="1.5s" repeatCount="indefinite"/>
              </path>
              
              {/* === LOCATION PINS === */}
              {/* Start pin */}
              <g transform="translate(50, 170)">
                <circle cx="0" cy="0" r="10" fill="#22c55e"/>
                <circle cx="0" cy="0" r="6" fill="white"/>
                <circle cx="0" cy="0" r="3" fill="#22c55e"/>
                <circle cx="0" cy="0" r="16" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.3">
                  <animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
                </circle>
              </g>
              
              {/* End pin */}
              <g transform="translate(330, 165)">
                <circle cx="0" cy="0" r="10" fill="#f97316"/>
                <circle cx="0" cy="0" r="6" fill="white"/>
                <circle cx="0" cy="0" r="3" fill="#f97316"/>
              </g>
              
              {/* === CLEAN SIMPLE CAR === */}
              <g filter="url(#carShadow)">
                {/* Car body - simple rounded rectangle shape */}
                <rect x="90" y="150" width="200" height="55" rx="12" fill="url(#carBody)"/>
                
                {/* Car roof/cabin */}
                <path 
                  d="M130 150 L130 115 Q130 100, 150 100 L230 100 Q250 100, 250 115 L250 150" 
                  fill="url(#carBody)"
                />
                
                {/* Roof highlight */}
                <path 
                  d="M145 105 L235 105" 
                  stroke="rgba(255,255,255,0.4)" 
                  strokeWidth="3" 
                  strokeLinecap="round"
                />
                
                {/* Body highlight */}
                <rect x="95" y="155" width="190" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
                
                {/* Windows */}
                {/* Left window */}
                <rect x="138" y="108" width="45" height="38" rx="6" fill="url(#windowGlass)"/>
                <rect x="140" y="110" width="20" height="15" rx="3" fill="rgba(255,255,255,0.2)"/>
                
                {/* Right window */}
                <rect x="193" y="108" width="50" height="38" rx="6" fill="url(#windowGlass)"/>
                <rect x="195" y="110" width="22" height="15" rx="3" fill="rgba(255,255,255,0.2)"/>
                
                {/* Window divider */}
                <rect x="185" y="105" width="6" height="45" rx="2" fill="#22c55e"/>
                
                {/* === CLAYMORPHISM PASSENGERS - ALL FACING FORWARD (RIGHT) === */}
                
                {/* Driver (right window - near front, facing road) - THE ONE WITH STEERING */}
                <g transform="translate(228, 125)">
                  {/* Body/shirt - clay style */}
                  <ellipse cx="0" cy="11" rx="7" ry="5" fill="url(#driverShirt)"/>
                  {/* Head - facing forward (right) - shown as profile/3-quarter view */}
                  <ellipse cx="0" cy="0" rx="7" ry="8" fill="url(#driverHead)"/>
                  {/* Face highlight - 3D depth on front-facing side */}
                  <ellipse cx="3" cy="-1" rx="3" ry="4" fill="rgba(255,255,255,0.25)"/>
                  {/* Hair - on back of head */}
                  <ellipse cx="-3" cy="-4" rx="6" ry="5" fill="url(#driverHair)"/>
                  {/* Ear visible (side view) */}
                  <ellipse cx="-5" cy="1" rx="2" ry="3" fill="url(#driverHead)"/>
                  {/* Eye - only one visible since facing forward */}
                  <circle cx="2" cy="0" r="1.2" fill="#1f2937"/>
                  {/* Eyebrow */}
                  <path d="M0.5 -2.5 Q2 -3.5, 3.5 -2.5" stroke="#4a3728" strokeWidth="0.8" fill="none"/>
                  {/* Nose profile */}
                  <path d="M4 0 Q5.5 1, 4 2" stroke="#d4a574" strokeWidth="1" fill="none"/>
                  {/* Slight smile visible */}
                  <path d="M2.5 3 Q4 4, 5 3" stroke="#c4846a" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
                  {/* Hands reaching forward to steering */}
                  <ellipse cx="12" cy="10" rx="3" ry="2.5" fill="url(#driverHead)"/>
                  <ellipse cx="14" cy="8" rx="2.5" ry="2" fill="url(#driverHead)"/>
                </g>
                
                {/* === STEERING WHEEL (in front of driver) === */}
                <g transform="translate(245, 132)">
                  {/* Steering column */}
                  <line x1="0" y1="0" x2="6" y2="4" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Steering wheel - side view */}
                  <ellipse cx="0" cy="0" rx="2.5" ry="8" fill="none" stroke="#1f2937" strokeWidth="2"/>
                  <ellipse cx="0" cy="0" rx="1" ry="2.5" fill="#4b5563"/>
                  <animateTransform attributeName="transform" type="rotate" values="-3;3;-3" dur="2.5s" repeatCount="indefinite" additive="sum"/>
                </g>
                
                {/* Passenger 1 (right window - behind driver, also facing forward) */}
                <g transform="translate(205, 128)">
                  {/* Body */}
                  <ellipse cx="0" cy="9" rx="5" ry="4" fill="url(#passenger1Shirt)"/>
                  {/* Head - 3-quarter view facing forward */}
                  <ellipse cx="0" cy="0" rx="5.5" ry="6.5" fill="url(#passenger1Head)"/>
                  {/* Face highlight */}
                  <ellipse cx="2" cy="-1" rx="2.5" ry="3" fill="rgba(255,255,255,0.2)"/>
                  {/* Hair */}
                  <ellipse cx="-2" cy="-4" rx="5" ry="4" fill="#334155"/>
                  {/* Ear */}
                  <ellipse cx="-4" cy="1" rx="1.5" ry="2.5" fill="url(#passenger1Head)"/>
                  {/* Eye */}
                  <circle cx="2" cy="0" r="0.9" fill="#1f2937"/>
                </g>
                
                {/* Passenger 2 (left window - facing forward) */}
                <g transform="translate(162, 127)">
                  {/* Body */}
                  <ellipse cx="0" cy="10" rx="6" ry="4" fill="url(#passenger2Shirt)"/>
                  {/* Head - 3-quarter facing forward */}
                  <ellipse cx="0" cy="0" rx="6" ry="7" fill="url(#passenger2Head)"/>
                  {/* Face highlight */}
                  <ellipse cx="2" cy="-1" rx="3" ry="3.5" fill="rgba(255,255,255,0.2)"/>
                  {/* Long hair flowing back */}
                  <ellipse cx="-2" cy="-3" rx="6" ry="5" fill="#92400e"/>
                  <ellipse cx="-5" cy="3" rx="2.5" ry="5" fill="#92400e"/>
                  {/* Ear */}
                  <ellipse cx="-4" cy="1" rx="1.5" ry="2.5" fill="url(#passenger2Head)"/>
                  {/* Eye */}
                  <circle cx="2" cy="0" r="1" fill="#1f2937"/>
                  {/* Earring detail */}
                  <circle cx="-4" cy="4" r="1" fill="#fbbf24"/>
                </g>
                
                {/* === SIDE MIRROR (right/front) === */}
                <g transform="translate(285, 148)">
                  <rect x="0" y="-5" width="8" height="12" rx="2" fill="#15803d"/>
                  <rect x="1" y="-3" width="6" height="8" rx="1" fill="rgba(255,255,255,0.35)"/>
                  {/* Mirror reflection */}
                  <rect x="2" y="-2" width="3" height="4" rx="0.5" fill="rgba(255,255,255,0.3)"/>
                </g>
                
                {/* === SIDE MIRROR (left/rear) === */}
                <g transform="translate(87, 148)">
                  <rect x="0" y="-5" width="8" height="12" rx="2" fill="#15803d"/>
                  <rect x="1" y="-3" width="6" height="8" rx="1" fill="rgba(255,255,255,0.35)"/>
                </g>
                
                {/* === DOOR HANDLES === */}
                <rect x="175" y="172" width="12" height="4" rx="2" fill="#15803d"/>
                <rect x="215" y="172" width="12" height="4" rx="2" fill="#15803d"/>
                
                {/* === DOOR LINES === */}
                <line x1="188" y1="150" x2="188" y2="200" stroke="#16a34a" strokeWidth="1" opacity="0.5"/>
                <line x1="230" y1="150" x2="230" y2="200" stroke="#16a34a" strokeWidth="1" opacity="0.5"/>
                
                {/* === ANTENNA === */}
                <line x1="140" y1="100" x2="130" y2="70" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="130" cy="68" r="2" fill="#374151"/>
                
                {/* === WINDSHIELD WIPER === */}
                <line x1="240" y1="104" x2="260" y2="108" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round"/>
                
                {/* (Removed license plates - looked like odd front/back boxes) */}
                
                {/* === HEADLIGHTS with GLOW === */}
                <defs>
                  <filter id="headlightGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feMerge>
                      <feMergeNode in="blur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <g filter="url(#headlightGlow)">
                  <rect x="280" y="165" width="10" height="25" rx="5" fill="#fef3c7" stroke="#fbbf24" strokeWidth="1"/>
                  <rect x="282" y="168" width="4" height="8" rx="2" fill="white" opacity="0.9"/>
                </g>
                {/* Headlight beam effect */}
                <path d="M293 175 L340 160 L340 195 Z" fill="url(#headlightBeam)" opacity="0.15"/>
                <defs>
                  <linearGradient id="headlightBeam" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="#fef3c7"/>
                    <stop offset="100%" stopColor="transparent"/>
                  </linearGradient>
                </defs>
                
                {/* Taillights with glow */}
                <g>
                  <rect x="90" y="168" width="8" height="20" rx="4" fill="#fca5a5" stroke="#ef4444" strokeWidth="1">
                    <animate attributeName="opacity" values="0.7;1;0.7" dur="1s" repeatCount="indefinite"/>
                  </rect>
                  {/* Tail light glow */}
                  <rect x="85" y="163" width="18" height="30" rx="6" fill="#ef4444" opacity="0.15">
                    <animate attributeName="opacity" values="0.1;0.2;0.1" dur="1s" repeatCount="indefinite"/>
                  </rect>
                </g>
                
                {/* Front bumper with grille */}
                <rect x="278" y="192" width="15" height="8" rx="3" fill="#15803d"/>
                <g opacity="0.5">
                  <line x1="282" y1="194" x2="282" y2="198" stroke="#0f5132" strokeWidth="1"/>
                  <line x1="285" y1="194" x2="285" y2="198" stroke="#0f5132" strokeWidth="1"/>
                  <line x1="288" y1="194" x2="288" y2="198" stroke="#0f5132" strokeWidth="1"/>
                </g>
                
                {/* Rear bumper */}
                <rect x="87" y="192" width="15" height="8" rx="3" fill="#15803d"/>
                
                {/* === EXHAUST PIPE === */}
                <rect x="92" y="198" width="8" height="4" rx="1" fill="#4b5563"/>
                
                {/* === EXHAUST SMOKE === */}
                <g fill="#9ca3af">
                  <circle cx="85" cy="200" r="4" opacity="0.3">
                    <animate attributeName="cx" values="85;50;20" dur="1.5s" repeatCount="indefinite"/>
                    <animate attributeName="cy" values="200;195;192" dur="1.5s" repeatCount="indefinite"/>
                    <animate attributeName="r" values="4;8;12" dur="1.5s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.4;0.2;0" dur="1.5s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="82" cy="202" r="3" opacity="0.3">
                    <animate attributeName="cx" values="82;55;25" dur="1.8s" repeatCount="indefinite" begin="0.3s"/>
                    <animate attributeName="cy" values="202;198;195" dur="1.8s" repeatCount="indefinite" begin="0.3s"/>
                    <animate attributeName="r" values="3;6;10" dur="1.8s" repeatCount="indefinite" begin="0.3s"/>
                    <animate attributeName="opacity" values="0.35;0.15;0" dur="1.8s" repeatCount="indefinite" begin="0.3s"/>
                  </circle>
                  <circle cx="80" cy="198" r="2.5" opacity="0.25">
                    <animate attributeName="cx" values="80;45;15" dur="2s" repeatCount="indefinite" begin="0.6s"/>
                    <animate attributeName="cy" values="198;193;190" dur="2s" repeatCount="indefinite" begin="0.6s"/>
                    <animate attributeName="r" values="2.5;5;8" dur="2s" repeatCount="indefinite" begin="0.6s"/>
                    <animate attributeName="opacity" values="0.3;0.1;0" dur="2s" repeatCount="indefinite" begin="0.6s"/>
                  </circle>
                </g>
              </g>
              
              {/* === WHEELS === */}
              {/* Front wheel */}
              <g transform="translate(250, 205)">
                {/* Tire */}
                <circle cx="0" cy="0" r="22" fill="url(#wheelGrad)" stroke="#1f2937" strokeWidth="4"/>
                {/* Tire tread marks */}
                <circle cx="0" cy="0" r="20" fill="none" stroke="#2d3748" strokeWidth="2" strokeDasharray="4 4"/>
                {/* Rim */}
                <circle cx="0" cy="0" r="12" fill="#e5e7eb"/>
                {/* Hub cap */}
                <circle cx="0" cy="0" r="5" fill="#6b7280"/>
                {/* Hub cap logo */}
                <circle cx="0" cy="0" r="2" fill="#22c55e"/>
                {/* Spokes */}
                <g stroke="#9ca3af" strokeWidth="2">
                  <line x1="0" y1="-10" x2="0" y2="10"/>
                  <line x1="-10" y1="0" x2="10" y2="0"/>
                  <line x1="-7" y1="-7" x2="7" y2="7"/>
                  <line x1="7" y1="-7" x2="-7" y2="7"/>
                </g>
                {/* Clockwise rotation - synced with road speed */}
                <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.5s" repeatCount="indefinite" additive="sum"/>
              </g>
              
              {/* Rear wheel */}
              <g transform="translate(130, 205)">
                {/* Tire */}
                <circle cx="0" cy="0" r="22" fill="url(#wheelGrad)" stroke="#1f2937" strokeWidth="4"/>
                {/* Tire tread marks */}
                <circle cx="0" cy="0" r="20" fill="none" stroke="#2d3748" strokeWidth="2" strokeDasharray="4 4"/>
                {/* Rim */}
                <circle cx="0" cy="0" r="12" fill="#e5e7eb"/>
                {/* Hub cap */}
                <circle cx="0" cy="0" r="5" fill="#6b7280"/>
                {/* Hub cap logo */}
                <circle cx="0" cy="0" r="2" fill="#22c55e"/>
                {/* Spokes */}
                <g stroke="#9ca3af" strokeWidth="2">
                  <line x1="0" y1="-10" x2="0" y2="10"/>
                  <line x1="-10" y1="0" x2="10" y2="0"/>
                  <line x1="-7" y1="-7" x2="7" y2="7"/>
                  <line x1="7" y1="-7" x2="-7" y2="7"/>
                </g>
                {/* Clockwise rotation - synced with road speed */}
                <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.5s" repeatCount="indefinite" additive="sum"/>
              </g>
              
              {/* Wheel dust/motion blur */}
              <g fill="#9ca3af" opacity="0.15">
                <ellipse cx="130" cy="220" rx="15" ry="3">
                  <animate attributeName="opacity" values="0.15;0.08;0.15" dur="1.5s" repeatCount="indefinite"/>
                </ellipse>
                <ellipse cx="250" cy="220" rx="15" ry="3">
                  <animate attributeName="opacity" values="0.12;0.05;0.12" dur="1.5s" repeatCount="indefinite" begin="0.3s"/>
                </ellipse>
              </g>
              
              {/* === MOTION LINES === */}
              <g stroke="#22c55e" strokeWidth="2" strokeLinecap="round" opacity="0.3">
                <line x1="75" y1="160" x2="55" y2="160">
                  <animate attributeName="x2" values="55;45;55" dur="1.5s" repeatCount="indefinite"/>
                </line>
                <line x1="78" y1="175" x2="50" y2="175">
                  <animate attributeName="x2" values="50;38;50" dur="1.5s" repeatCount="indefinite" begin="0.3s"/>
                </line>
                <line x1="75" y1="190" x2="55" y2="190">
                  <animate attributeName="x2" values="55;45;55" dur="1.5s" repeatCount="indefinite" begin="0.6s"/>
                </line>
              </g>
              
              </g>{/* Close scene group */}
              
              {/* === SPARKLES === */}
              <g fill="#22c55e">
                <circle cx="35" cy="130" r="3">
                  <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
                </circle>
                <circle cx="350" cy="120" r="2.5">
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" begin="0.5s"/>
                </circle>
                <circle cx="380" cy="150" r="2">
                  <animate attributeName="opacity" values="0.5;1;0.5" dur="1.8s" repeatCount="indefinite" begin="0.8s"/>
                </circle>
                <circle cx="10" cy="180" r="2.5">
                  <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.2s" repeatCount="indefinite" begin="0.3s"/>
                </circle>
              </g>
            </svg>
          </motion.div>
        </motion.div>
      </div>

      {/* === FLOATING UI ELEMENTS - SEAMLESSLY BLENDED === */}
      
      {/* Savings Badge - Bottom Left - Organic blob shape */}
      <motion.div
        className="absolute bottom-16 left-4"
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 100 }}
      >
        {/* Soft gradient blob background */}
        <div className="relative">
          <div className="absolute -inset-2 bg-gradient-to-br from-emerald-100/80 via-white/60 to-emerald-50/70 rounded-2xl blur-sm" />
          <div className="relative bg-gradient-to-br from-white/95 to-emerald-50/90 backdrop-blur-md px-4 py-3 rounded-xl shadow-[0_8px_32px_rgba(34,197,94,0.15)]">
            <div className="flex items-center gap-3">
              {/* Route dots */}
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"/>
                <div className="w-0.5 h-4 bg-gradient-to-b from-emerald-400 to-orange-400 rounded-full"/>
                <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]"/>
              </div>
              
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  {/* Stacked avatars */}
                  <div className="flex -space-x-1">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white text-[7px] font-bold flex items-center justify-center shadow-sm">P</div>
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-[7px] font-bold flex items-center justify-center shadow-sm">R</div>
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 text-white text-[7px] font-bold flex items-center justify-center shadow-sm">A</div>
                  </div>
                  <span className="text-[10px] text-gray-500">3 sharing</span>
                </div>
                <p className="text-xs font-bold text-emerald-600 mt-0.5">Save ₹180 <span className="text-[10px] font-semibold text-emerald-700/80">• 67%</span></p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Driver Info Badge - Positioned above driver area with pointer */}
      <motion.div
        className="absolute top-[22%] right-[25%]"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, type: "spring" }}
      >
        <div className="relative">
          {/* Soft organic background */}
          <div className="absolute -inset-2 bg-gradient-to-br from-orange-100/70 via-white/60 to-emerald-50/60 rounded-2xl blur-sm" />
          <div className="relative bg-gradient-to-br from-white/95 to-orange-50/80 backdrop-blur-md px-3 py-2 rounded-xl shadow-[0_8px_24px_rgba(251,146,60,0.15)]">
            <div className="flex items-center gap-2">
              {/* Driver avatar - matches the one in car */}
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-bold text-[10px] shadow-md">
                  R
                </div>
                {/* Verified tick */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm">
                  <svg className="w-1.5 h-1.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              
              <div className="text-left">
                <div className="flex items-center gap-1">
                  <p className="text-[10px] font-semibold text-gray-800">Rahul S.</p>
                  <div className="flex items-center">
                    <svg className="w-2 h-2 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span className="text-[8px] text-gray-500">4.9</span>
                  </div>
                </div>
                <p className="text-[8px] text-emerald-600 font-medium">Verified Driver</p>
              </div>
            </div>
          </div>
          {/* Pointer arrow pointing down to driver */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white/90" />
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// LOGO STRIP - Trust indicators

export default HeroSection;
