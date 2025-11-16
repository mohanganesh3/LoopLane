import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Footer from '../../components/layout/Footer';

const Home = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalRides: 12500,
    activeUsers: 8000,
    citiesCovered: 50,
    co2Saved: 45000
  });

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <div className="min-h-screen">
      {/* Landing Page Navbar */}
      <LandingNavbar />
      
      {/* Hero Section */}
      <HeroSection />
      
      {/* Stats Section */}
      <StatsSection stats={stats} />
      
      {/* How It Works */}
      <HowItWorksSection />
      
      {/* Features Section */}
      <FeaturesSection />
      
      {/* Testimonials */}
      <TestimonialsSection />
      
      {/* CTA Section */}
      <CTASection />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

// Landing Page Navbar - Transparent overlay on hero
const LandingNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white shadow-lg' : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <i className={`fas fa-car-side text-2xl ${isScrolled ? 'text-emerald-500' : 'text-white'}`}></i>
            <span className={`text-xl font-bold ${isScrolled ? 'text-gray-800' : 'text-white'}`}>
              LOOPLANE
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <a href="#how-it-works" className={`font-medium transition ${
              isScrolled ? 'text-gray-600 hover:text-emerald-500' : 'text-white/90 hover:text-white'
            }`}>
              How it Works
            </a>
            <a href="#features" className={`font-medium transition ${
              isScrolled ? 'text-gray-600 hover:text-emerald-500' : 'text-white/90 hover:text-white'
            }`}>
              Features
            </a>
            <Link 
              to="/login" 
              className={`font-medium transition ${
                isScrolled ? 'text-gray-600 hover:text-emerald-500' : 'text-white/90 hover:text-white'
              }`}
            >
              Login
            </Link>
            <Link 
              to="/register" 
              className={`px-5 py-2 rounded-lg font-semibold transition ${
                isScrolled 
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                  : 'bg-white text-emerald-600 hover:bg-gray-100'
              }`}
            >
              Sign Up Free
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden p-2 rounded-lg ${isScrolled ? 'text-gray-600' : 'text-white'}`}
          >
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className={`md:hidden py-4 border-t ${isScrolled ? 'border-gray-200 bg-white' : 'border-white/20 bg-emerald-600'}`}>
            <div className="flex flex-col space-y-3">
              <a 
                href="#how-it-works" 
                className={`px-4 py-2 font-medium ${isScrolled ? 'text-gray-600' : 'text-white'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                How it Works
              </a>
              <a 
                href="#features" 
                className={`px-4 py-2 font-medium ${isScrolled ? 'text-gray-600' : 'text-white'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <Link 
                to="/login" 
                className={`px-4 py-2 font-medium ${isScrolled ? 'text-gray-600' : 'text-white'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Login
              </Link>
              <Link 
                to="/register" 
                className={`mx-4 py-2 text-center rounded-lg font-semibold ${
                  isScrolled 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-white text-emerald-600'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign Up Free
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

// Hero Section
const HeroSection = () => {
  return (
    <section className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 pt-24 pb-20 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-white">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Share Your Ride,
              <br />
              <span className="text-yellow-300">Save the Planet</span>
            </h1>
            <p className="text-xl text-emerald-100 mb-8 max-w-xl">
              Connect with fellow travelers, split costs, reduce traffic, and make friends. 
              LOOPLANE makes carpooling safe, easy, and affordable.
            </p>
            
            {/* Quick Search Box */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-lg">
              <QuickSearchForm />
            </div>
          </div>
          
          {/* Right Content - Illustration */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Modern SVG Illustration instead of external image */}
              <div className="w-full h-96 flex items-center justify-center">
                <div className="relative">
                  {/* Main Car Icon */}
                  <div className="text-9xl text-white/80 animate-pulse">
                    <i className="fas fa-car-side"></i>
                  </div>
                  {/* Road underneath */}
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-48 h-2 bg-gray-300 rounded-full"></div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Quick Search Form
const QuickSearchForm = () => {
  const navigate = useNavigate();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (date) params.set('date', date);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch}>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Find a ride</h3>
      
      <div className="space-y-4">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500">
            <i className="fas fa-location-dot"></i>
          </span>
          <input
            type="text"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Leaving from..."
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500">
            <i className="fas fa-location-dot"></i>
          </span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Going to..."
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none z-10">
            <i className="far fa-calendar-alt"></i>
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            placeholder="Select date"
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
        >
          <i className="fas fa-search"></i> Search Rides
        </button>
      </div>
      
      <p className="text-center text-gray-500 text-sm mt-4">
        Or <Link to="/post-ride" className="text-emerald-500 hover:underline font-medium">offer a ride</Link>
      </p>
    </form>
  );
};

// Stats Section
const StatsSection = ({ stats }) => {
  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard 
            icon="fa-car" 
            value={stats.totalRides.toLocaleString()} 
            label="Rides Shared"
            color="emerald"
          />
          <StatCard 
            icon="fa-users" 
            value={stats.activeUsers.toLocaleString()} 
            label="Happy Users"
            color="blue"
          />
          <StatCard 
            icon="fa-city" 
            value={stats.citiesCovered} 
            label="Cities Covered"
            color="purple"
          />
          <StatCard 
            icon="fa-leaf" 
            value={`${(stats.co2Saved / 1000).toFixed(0)}T`} 
            label="CO2 Saved"
            color="green"
          />
        </div>
      </div>
    </section>
  );
};

const StatCard = ({ icon, value, label, color }) => {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600'
  };

  return (
    <div className="text-center">
      <div className={`w-16 h-16 ${colors[color]} rounded-full flex items-center justify-center mx-auto mb-4`}>
        <i className={`fas ${icon} text-2xl`}></i>
      </div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      <p className="text-gray-500">{label}</p>
    </div>
  );
};

// How It Works Section
const HowItWorksSection = () => {
  const steps = [
    {
      icon: 'fa-search',
      title: 'Search a Ride',
      description: 'Enter your departure and destination cities, travel date, and find rides that match.'
    },
    {
      icon: 'fa-user-check',
      title: 'Book Your Seat',
      description: 'Choose your ride, check driver profile and reviews, then book your seat instantly.'
    },
    {
      icon: 'fa-handshake',
      title: 'Meet & Travel',
      description: 'Meet your driver at the pickup point, verify with OTP, and enjoy your journey!'
    },
    {
      icon: 'fa-star',
      title: 'Rate & Review',
      description: 'After the ride, rate your experience and help build a trusted community.'
    }
  ];

  return (
    <section id="how-it-works" className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            How LOOPLANE Works
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Getting started is easy! Follow these simple steps to find or offer rides.
          </p>
        </div>
        
        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="text-center relative">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-emerald-200"></div>
              )}
              
              {/* Step Circle */}
              <div className="relative z-10 w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <i className={`fas ${step.icon} text-white text-3xl`}></i>
                <span className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-sm font-bold text-gray-800">
                  {index + 1}
                </span>
              </div>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{step.title}</h3>
              <p className="text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Features Section
const FeaturesSection = () => {
  const features = [
    {
      icon: 'fa-shield-alt',
      title: 'Verified Profiles',
      description: 'All users are verified with license, Aadhar, and phone number for your safety.'
    },
    {
      icon: 'fa-key',
      title: 'OTP Verification',
      description: 'Secure pickup and dropoff with one-time passwords shared only between rider and driver.'
    },
    {
      icon: 'fa-map-marked-alt',
      title: 'Live Tracking',
      description: 'Share your ride status with family in real-time for added peace of mind.'
    },
    {
      icon: 'fa-comments',
      title: 'In-App Chat',
      description: 'Communicate with your driver or passenger easily without sharing phone numbers.'
    },
    {
      icon: 'fa-phone-volume',
      title: 'SOS Emergency',
      description: 'One-tap emergency button that alerts authorities and emergency contacts.'
    },
    {
      icon: 'fa-wallet',
      title: 'Fair Pricing',
      description: 'Transparent pricing based on distance. Pay what you see, no hidden charges.'
    }
  ];

  return (
    <section id="features" className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            Why Choose LOOPLANE?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            We've built LOOPLANE with safety, convenience, and community at its core.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="bg-gray-50 rounded-xl p-6 hover:shadow-lg transition group"
            >
              <div className="w-14 h-14 bg-emerald-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-500 transition">
                <i className={`fas ${feature.icon} text-2xl text-emerald-500 group-hover:text-white transition`}></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Testimonials Section
const TestimonialsSection = () => {
  const testimonials = [
    {
      name: 'Priya Sharma',
      location: 'Hyderabad',
      rating: 5,
      text: 'LOOPLANE has made my daily commute so much affordable! I save almost ₹3000 every month and made some great friends too.'
    },
    {
      name: 'Rahul Verma',
      location: 'Bangalore',
      rating: 5,
      text: 'As a driver, I love how easy it is to post rides and find passengers. The OTP system makes everything secure.'
    },
    {
      name: 'Sneha Reddy',
      location: 'Chennai',
      rating: 5,
      text: 'The SOS feature gives my parents peace of mind when I travel. Best carpooling app for women travelers!'
    }
  ];

  // Generate color from name
  const getColor = (name) => {
    const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <section id="testimonials" className="py-16 bg-emerald-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            What Our Users Say
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Join thousands of happy travelers who trust LOOPLANE for their journeys.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index} 
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition"
            >
              <div className="flex items-center mb-4">
                <div className={`w-12 h-12 ${getColor(testimonial.name)} rounded-full flex items-center justify-center text-white font-bold text-xl mr-4`}>
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800">{testimonial.name}</h4>
                  <p className="text-sm text-gray-500">{testimonial.location}</p>
                </div>
              </div>
              
              <div className="flex text-yellow-400 mb-3">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <i key={i} className="fas fa-star"></i>
                ))}
              </div>
              
              <p className="text-gray-600 italic">"{testimonial.text}"</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// CTA Section
const CTASection = () => {
  return (
    <section className="py-16 bg-gradient-to-r from-emerald-600 to-teal-500">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to Start Your Journey?
        </h2>
        <p className="text-emerald-100 text-lg mb-8 max-w-2xl mx-auto">
          Join LOOPLANE today and become part of a community that's changing how India travels.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to="/register" 
            className="bg-white text-emerald-600 hover:bg-gray-100 font-semibold px-8 py-4 rounded-lg transition inline-flex items-center justify-center gap-2"
          >
            <i className="fas fa-sparkles"></i> Sign Up Free
          </Link>
          <Link 
            to="/find-ride" 
            className="border-2 border-white text-white hover:bg-white hover:text-emerald-600 font-semibold px-8 py-4 rounded-lg transition inline-flex items-center justify-center gap-2"
          >
            <i className="fas fa-search"></i> Find a Ride
          </Link>
        </div>
        
        <p className="text-emerald-200 text-sm mt-6">
          No credit card required • Free to use • Cancel anytime
        </p>
      </div>
    </section>
  );
};

export default Home;
