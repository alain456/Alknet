import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PublicLayout() {
  const { user, isAuthenticated, logout } = useAuth();

  const getDashboardPath = () => {
    if (user?.role === 'SUPER_ADMIN') return '/admin';
    if (user?.role === 'BUSINESS_OWNER') return '/business';
    return '/dashboard';
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-primary shadow-md sticky top-0 z-50 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
            </div>
            <span className="font-bold text-xl text-white">Isoko Hub</span>
          </Link>
          <nav className="hidden md:flex gap-6 items-center">
            <Link to="/" className="text-teal-100 hover:text-white font-medium transition">Home</Link>
            <Link to="/services" className="text-teal-100 hover:text-white font-medium transition">Services</Link>
            <Link to="/businesses" className="text-teal-100 hover:text-white font-medium transition">Businesses</Link>
            <Link to="/jobs" className="text-teal-100 hover:text-white font-medium transition">Jobs</Link>
            <div className="w-px h-5 bg-teal-800 mx-2"></div>
            
          </nav>
          <div className="flex gap-4 items-center">
            {isAuthenticated ? (
              <>
                <Link 
                  to={getDashboardPath()} 
                  className="text-teal-100 font-medium hover:text-white py-2 transition flex items-center gap-1"
                >
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  {user?.first_name || user?.email?.split('@')[0] || 'Dashboard'}
                </Link>
                <button 
                  onClick={logout}
                  className="bg-accent hover:bg-yellow-400 text-gray-900 font-semibold py-1.5 px-3.5 rounded-md shadow-sm transition cursor-pointer text-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-teal-100 font-medium hover:text-white py-2 transition">Login</Link>
                <Link to="/register" className="bg-accent hover:bg-yellow-400 text-gray-900 font-semibold py-2 px-4 rounded-md shadow-sm transition">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 bg-white">
        <Outlet />
      </main>

      <footer className="bg-primary text-white border-t border-teal-900/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <span className="font-bold text-xl text-white mb-4 block">Isoko Hub</span>
            <p className="text-sm text-teal-100">Everything you need, in one platform. Connecting Burundi to the world.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-teal-100">
              <li><Link to="/about" className="hover:text-white transition">About Us</Link></li>
              <li><Link to="/careers" className="hover:text-white transition">Careers</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-teal-100">
              <li><Link to="/help" className="hover:text-white transition">Help Center</Link></li>
              <li><Link to="/contact" className="hover:text-white transition">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-teal-100">
              <li><Link to="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
