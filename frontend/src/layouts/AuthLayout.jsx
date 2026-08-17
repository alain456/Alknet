import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white dark:bg-gray-900 transition-colors duration-200">
      {/* Left side: Image / Branding */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-primary dark:bg-gray-950 p-12 text-white relative overflow-hidden">
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 mb-12 w-fit">
            <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
            </div>
            <span className="font-bold text-2xl">Isoko Hub</span>
          </Link>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
            Empowering your business and career in Africa.
          </h1>
          <p className="text-teal-100 text-lg max-w-md">
            Join thousands of professionals and businesses building the future of the digital economy.
          </p>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-secondary rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
        
        <div className="relative z-10 text-sm text-teal-200">
          © {new Date().getFullYear()} Isoko Hub. All rights reserved.
        </div>
      </div>

      {/* Right side: Form Outlet */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <Link to="/" className="flex md:hidden items-center gap-2 mb-10 w-fit mx-auto">
            <div className="w-8 h-8 rounded-full border-2 border-primary dark:border-white flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
            </div>
            <span className="font-bold text-2xl text-primary dark:text-white">Isoko Hub</span>
          </Link>
          
          <Outlet />
        </div>
      </div>
    </div>
  );
}
