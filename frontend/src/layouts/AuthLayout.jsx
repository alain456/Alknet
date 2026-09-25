import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import ThemeToggle from '../shared/components/ThemeToggle';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface text-ink relative">
      <div className="absolute top-4 right-4 z-20 md:top-6 md:right-6">
        <ThemeToggle />
      </div>

      {/* Left side: Branding */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-primary p-10 lg:p-12 text-surface relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-35 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 20% 10%, #1E8B4A 0%, transparent 55%), radial-gradient(ellipse at 90% 90%, #E1302A 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2.5 mb-12 w-fit">
            <div className="w-9 h-9 rounded-full border-2 border-accent flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-accent" />
            </div>
            <span className="font-extrabold text-2xl lg:text-3xl text-surface tracking-tight">Isoko Hub</span>
          </Link>
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-extrabold leading-tight mb-5 text-surface max-w-lg">
            Empowering your business and career in Africa.
          </h1>
          <p className="text-base lg:text-lg text-surface/90 max-w-md font-medium leading-relaxed">
            Join thousands of professionals and businesses building the future of the digital economy.
          </p>
        </div>

        <div className="relative z-10 text-sm lg:text-base font-semibold text-accent">
          © {new Date().getFullYear()} Isoko Hub. All rights reserved.
        </div>
      </div>

      {/* Right side: Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 bg-surface">
        <div className="w-full max-w-md rounded-2xl border-2 border-accent bg-surface p-6 sm:p-8 shadow-sm text-ink">
          <Link to="/" className="flex md:hidden items-center gap-2 mb-8 w-fit mx-auto">
            <div className="w-9 h-9 rounded-full border-2 border-primary flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-accent" />
            </div>
            <span className="font-extrabold text-2xl text-ink">Isoko Hub</span>
          </Link>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
