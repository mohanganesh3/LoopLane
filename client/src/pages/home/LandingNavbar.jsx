import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ClayButton } from '../../components/clay';
import { useMagnetic, easings } from '../../hooks/useLoopLaneAnimations';

const NavLink = ({ href, children }) => {
  const { ref, style, handlers } = useMagnetic(0.2);
  
  return (
    <motion.a 
      ref={ref}
      href={href} 
      style={style}
      {...handlers}
      className="relative text-[#3d5a4c] hover:text-[#0ead69] transition-colors font-medium group py-2"
    >
      {children}
      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#8ee4af] to-[#0ead69] transition-all duration-300 group-hover:w-full rounded-full" />
    </motion.a>
  );
};

const LandingNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: easings.smooth }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled 
          ? 'bg-white/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(14,173,105,0.08)] border-b border-[#8ee4af]/20' 
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-6 lg:px-16">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-3 group">
            <motion.div 
              className="relative w-11 h-11"
              whileHover={{ rotate: 10, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#8ee4af] to-[#5fd992] rounded-xl rotate-3 transition-transform group-hover:rotate-6 shadow-lg shadow-[#8ee4af]/30" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#0f1a1a] to-[#264d3d] rounded-xl -rotate-2 flex items-center justify-center transition-transform group-hover:rotate-0">
                <span className="text-white font-bold text-lg">L</span>
              </div>
            </motion.div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-[#0f1a1a] tracking-tight">LoopLane</span>
              <span className="text-[10px] text-[#0ead69] uppercase tracking-[0.2em] -mt-0.5 font-medium">Ride Together</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center">
            <div className="flex items-center gap-8 mr-12 px-6 py-2 rounded-full bg-white/40 backdrop-blur-lg border border-white/50 shadow-lg shadow-[#8ee4af]/5">
              <NavLink href="#how-it-works">How it Works</NavLink>
              <NavLink href="#features">Features</NavLink>
              <NavLink href="#testimonials">Stories</NavLink>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                to="/login" 
                className="text-[#0f1a1a] font-medium hover:text-[#0ead69] transition-colors px-4 py-2"
              >
                Log in
              </Link>
              <ClayButton variant="primary" size="md" as={Link} to="/register">
                Start Free
              </ClayButton>
            </div>
          </div>

          <motion.button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="md:hidden relative w-10 h-10 flex items-center justify-center"
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex flex-col gap-1.5">
              <motion.span 
                animate={{ rotate: mobileMenuOpen ? 45 : 0, y: mobileMenuOpen ? 6 : 0 }}
                className="w-6 h-0.5 bg-[#0f1a1a] origin-center"
              />
              <motion.span 
                animate={{ opacity: mobileMenuOpen ? 0 : 1 }}
                className="w-6 h-0.5 bg-[#0f1a1a]"
              />
              <motion.span 
                animate={{ rotate: mobileMenuOpen ? -45 : 0, y: mobileMenuOpen ? -6 : 0 }}
                className="w-6 h-0.5 bg-[#0f1a1a] origin-center"
              />
            </div>
          </motion.button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className="py-6 border-t border-[#8ee4af]/20 flex flex-col gap-4 bg-white/50 backdrop-blur-xl rounded-2xl my-4 p-6">
                <a href="#how-it-works" className="text-[#0f1a1a] py-3 text-lg">How it Works</a>
                <a href="#features" className="text-[#0f1a1a] py-3 text-lg">Features</a>
                <a href="#testimonials" className="text-[#0f1a1a] py-3 text-lg">Stories</a>
                <hr className="border-[#8ee4af]/30 my-2" />
                <Link to="/login" className="text-[#0f1a1a] py-3 text-lg">Log in</Link>
                <ClayButton variant="primary" fullWidth as={Link} to="/register">
                  Start Free
                </ClayButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
};

export default LandingNavbar;
