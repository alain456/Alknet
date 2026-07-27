import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
            </div>
            <span className="font-bold text-xl text-primary">AlkNet</span>
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link to="/" className="text-gray-600 hover:text-primary font-medium">Home</Link>
            <Link to="/services" className="text-gray-600 hover:text-primary font-medium">Services</Link>
            <Link to="/businesses" className="text-gray-600 hover:text-primary font-medium">Businesses</Link>
            <Link to="/jobs" className="text-gray-600 hover:text-primary font-medium">Jobs</Link>
          </nav>
          <div className="flex gap-4">
            <Link to="/login" className="text-primary font-medium hover:text-secondary py-2">Login</Link>
            <Link to="/register" className="bg-primary hover:bg-secondary text-white font-medium py-2 px-4 rounded-md shadow-sm transition">Sign Up</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-gray-50 border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <span className="font-bold text-xl text-primary mb-4 block">AlkNet</span>
            <p className="text-sm text-gray-500">Everything you need, in one platform. Connecting Burundi to the world.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link to="/about" className="hover:text-primary">About Us</Link></li>
              <li><Link to="/careers" className="hover:text-primary">Careers</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link to="/help" className="hover:text-primary">Help Center</Link></li>
              <li><Link to="/contact" className="hover:text-primary">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link to="/terms" className="hover:text-primary">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
