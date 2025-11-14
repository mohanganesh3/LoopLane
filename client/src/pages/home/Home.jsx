import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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
    </div>
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
              <img 
                src="/images/hero-illustration.svg" 
                alt="Carpooling illustration"
                className="w-full h-auto"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              {/* Floating Cards */}
              <div className="absolute top-10 right-0 bg-white rounded-xl p-4 shadow-lg animate-bounce">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <i className="fas fa-leaf text-green-500"></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Eco-Friendly</p>
                    <p className="text-xs text-gray-500">Reduce emissions</p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-20 left-0 bg-white rounded-xl p-4 shadow-lg animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <i className="fas fa-shield-alt text-blue-500"></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Verified Users</p>
                    <p className="text-xs text-gray-500">Safe & Secure</p>
                  </div>
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
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500">📍</span>
          <input
            type="text"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Leaving from..."
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500">📍</span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Going to..."
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">📅</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center"
        >
          🔍 Search Rides
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
    <section className="py-16 bg-gray-50">
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
    <section className="py-16 bg-white">
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
      image: '/images/testimonials/user1.jpg',
      rating: 5,
      text: 'LOOPLANE has made my daily commute so much affordable! I save almost ₹3000 every month and made some great friends too.'
    },
    {
      name: 'Rahul Verma',
      location: 'Bangalore',
      image: '/images/testimonials/user2.jpg',
      rating: 5,
      text: 'As a driver, I love how easy it is to post rides and find passengers. The OTP system makes everything secure.'
    },
    {
      name: 'Sneha Reddy',
      location: 'Chennai',
      image: '/images/testimonials/user3.jpg',
      rating: 5,
      text: 'The SOS feature gives my parents peace of mind when I travel. Best carpooling app for women travelers!'
    }
  ];

  return (
    <section className="py-16 bg-emerald-50">
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
              className="bg-white rounded-xl p-6 shadow-md"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden mr-4">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-600 font-bold text-xl">${testimonial.name.charAt(0)}</div>`;
                    }}
                  />
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
            className="bg-white text-emerald-600 hover:bg-gray-100 font-semibold px-8 py-4 rounded-lg transition inline-flex items-center justify-center"
          >
            ✨ Sign Up Free
          </Link>
          <Link 
            to="/find-ride" 
            className="border-2 border-white text-white hover:bg-white hover:text-emerald-600 font-semibold px-8 py-4 rounded-lg transition inline-flex items-center justify-center"
          >
            🔍 Find a Ride
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
