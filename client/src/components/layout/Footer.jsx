import { Link } from 'react-router-dom'

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
    <footer className="bg-gray-800 text-white mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-emerald-500 text-2xl">🚗</span>
              <span className="text-2xl font-bold">LOOPLANE</span>
            </div>
            <p className="text-gray-400 text-sm">
              Eco-friendly carpooling platform connecting riders and passengers for safer, greener journeys.
            </p>
            <div className="flex space-x-4 mt-4">
              <a href="#" className="text-gray-400 hover:text-emerald-500 transition">
                Facebook
              </a>
              <a href="#" className="text-gray-400 hover:text-emerald-500 transition">
                Twitter
              </a>
              <a href="#" className="text-gray-400 hover:text-emerald-500 transition">
                Instagram
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-gray-400 hover:text-emerald-500 transition">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/find-ride" className="text-gray-400 hover:text-emerald-500 transition">
                  Search Rides
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-gray-400 hover:text-emerald-500 transition">
                  Sign Up
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-gray-400 hover:text-emerald-500 transition">
                  Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-gray-400 hover:text-emerald-500 transition">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-emerald-500 transition">
                  Safety Guidelines
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-emerald-500 transition">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-emerald-500 transition">
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>📧 support@looplane.com</li>
              <li>📞 +91 99999 99999</li>
              <li>📍 Mumbai, Maharashtra, India</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; {currentYear} LOOPLANE Carpool Platform. All rights reserved.</p>
          <p className="mt-2">Built with ❤️ for a greener future 🌱</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
