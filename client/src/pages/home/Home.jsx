import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Footer from '../../components/layout/Footer';
import LandingNavbar from './LandingNavbar';
import HeroSection from './HeroSection';
import { 
  LogoStrip, 
  ProblemSolutionSection, 
  HowItWorksSection, 
  FeaturesSection, 
  StatsSection, 
  TestimonialsSection, 
  CTASection 
} from './LandingSections';

const Home = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fdf4] via-[#fafcfa] to-[#ecfdf5] overflow-x-hidden">
      {/* Premium grain overlay for texture */}
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.02]" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} 
      />
      
      {/* Floating ambient orbs */}
      <div className="fixed top-[20%] left-[10%] w-[500px] h-[500px] rounded-full bg-[#8ee4af]/20 blur-[100px] pointer-events-none animate-float" />
      <div className="fixed top-[60%] right-[5%] w-[400px] h-[400px] rounded-full bg-[#0ead69]/15 blur-[80px] pointer-events-none" style={{ animationDelay: '-3s' }} />
      <div className="fixed bottom-[10%] left-[30%] w-[350px] h-[350px] rounded-full bg-[#5fd992]/10 blur-[90px] pointer-events-none" style={{ animationDelay: '-5s' }} />
      
      <LandingNavbar />
      <HeroSection />
      <LogoStrip />
      <ProblemSolutionSection />
      <HowItWorksSection />
      <FeaturesSection />
      <StatsSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Home;
