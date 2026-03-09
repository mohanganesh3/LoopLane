import { Link } from 'react-router-dom'
import { HeartIcon, LeafIcon } from '../icons/PremiumIcons'
import { 
  FacebookIcon, 
  TwitterIcon, 
  InstagramIcon, 
  MailIcon, 
  PhoneIcon, 
  MapPinIcon, 
  RouteIcon 
} from '../icons/AppIcons'

function Footer({ adminTheme = false }) {
  const currentYear = new Date().getFullYear()

  // Admin footer with indigo theme
  if (adminTheme) {
    return (
      <footer className="bg-indigo-900 text-white mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-indigo-200">
              &copy; {currentYear} LOOPLANE Admin Panel
            </p>
            <p className="text-sm text-indigo-200 mt-2 md:mt-0">
              Version 2.0 - React Migration
            </p>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="bg-gradient-to-br from-[#0f1a1a] via-[#142826] to-[#0f1a1a] text-white mt-0">
      <div className="container mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* About */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8ee4af] to-[#0ead69] flex items-center justify-center shadow-lg shadow-[#8ee4af]/30">
                <RouteIcon className="text-[#0f1a1a] w-5 h-5" />
              </div>
              <span className="text-xl font-semibold">LOOPLANE</span>
            </div>
            <p className="text-[#9cb5a4] text-sm leading-relaxed">
              Eco-friendly carpooling platform connecting riders and passengers for safer, greener journeys.
            </p>
            <div className="flex gap-4 mt-6">
              <a href="#" className="w-10 h-10 rounded-full bg-[#264d3d] hover:bg-[#0ead69] flex items-center justify-center transition-colors">
                <FacebookIcon className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-[#264d3d] hover:bg-[#0ead69] flex items-center justify-center transition-colors">
                <TwitterIcon className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-[#264d3d] hover:bg-[#0ead69] flex items-center justify-center transition-colors">
                <InstagramIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#8ee4af] mb-6">Quick Links</h3>
            <ul className="space-y-4 text-sm">
              <li>
                <Link to="/" className="text-[#9cb5a4] hover:text-white transition">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/find-ride" className="text-[#9cb5a4] hover:text-white transition">
                  Search Rides
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-[#9cb5a4] hover:text-white transition">
                  Sign Up
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-[#9cb5a4] hover:text-white transition">
                  Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#8ee4af] mb-6">Support</h3>
            <ul className="space-y-4 text-sm">
              <li>
                <Link to="/support" className="text-[#9cb5a4] hover:text-white transition">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/support" className="text-[#9cb5a4] hover:text-white transition">
                  Safety Guidelines
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-[#9cb5a4] hover:text-white transition">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-[#9cb5a4] hover:text-white transition">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#8ee4af] mb-6">Contact Us</h3>
            <ul className="space-y-4 text-sm text-[#9cb5a4]">
              <li className="flex items-center gap-3">
                <MailIcon className="text-[#0ead69] w-4 h-4" />
                <a href="mailto:support@looplane.in" className="hover:text-white transition">
                  support@looplane.in
                </a>
              </li>
              <li className="flex items-center gap-3">
                <PhoneIcon className="text-[#0ead69] w-4 h-4" />
                <span>+91 99999 99999</span>
              </li>
              <li className="flex items-center gap-3">
                <MapPinIcon className="text-[#0ead69] w-4 h-4" />
                <span>Mumbai, Maharashtra, India</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#264d3d] mt-12 pt-8 text-center text-sm text-[#9cb5a4]">
          <p>&copy; {currentYear} LOOPLANE Carpool Platform. All rights reserved.</p>
          <p className="mt-2 flex items-center justify-center gap-1 text-xs">Built with <span className="text-[#0ead69]"><HeartIcon size={12} /></span> for a greener future <span className="text-[#8ee4af]"><LeafIcon size={12} /></span></p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
