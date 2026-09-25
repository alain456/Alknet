import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomePathForUser } from '../auth/roleAccess';
import useSiteContent from '../shared/useSiteContent';
import SiteFooter from '../shared/components/SiteFooter';
import ThemeToggle from '../shared/components/ThemeToggle';

export default function PublicLayout() {
  const { user, isAuthenticated, logout } = useAuth();
  const { settings, footerLinks, partners } = useSiteContent();

  const brand = settings?.brand_name || 'Isoko Hub';

  const getDashboardPath = () => {
    if (!user) return '/login';
    return getHomePathForUser(user);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="bg-primary shadow-md sticky top-0 z-50 text-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 shrink-0 max-w-[55%] sm:max-w-none">
            {settings?.platform_logo ? (
              <img
                src={settings.platform_logo}
                alt={brand}
                className="w-9 h-9 rounded-full object-cover border-2 border-accent bg-surface shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full border-2 border-accent flex items-center justify-center shrink-0 bg-surface/10">
                <div className="w-2.5 h-2.5 rounded-full bg-accent" />
              </div>
            )}
            <span className="ih-brand-name font-extrabold text-lg sm:text-xl md:text-2xl text-surface tracking-tight truncate">
              {brand}
            </span>
          </Link>
          <nav className="hidden md:flex gap-6 items-center">
            <Link to="/" className="text-surface/90 hover:text-surface font-semibold text-sm sm:text-base transition">Home</Link>
            <Link to="/businesses" className="text-surface/90 hover:text-surface font-semibold text-sm sm:text-base transition">Business</Link>
            <Link to="/services" className="text-surface/90 hover:text-surface font-semibold text-sm sm:text-base transition">Services</Link>
            <Link to="/jobs" className="text-surface/90 hover:text-surface font-semibold text-sm sm:text-base transition">Jobs</Link>
            <div className="w-px h-5 bg-surface/30 mx-2" />
          </nav>
          <div className="flex gap-2.5 sm:gap-3 items-center">
            <ThemeToggle variant="onPrimary" size="sm" />
            {isAuthenticated ? (
              <>
                <Link
                  to={getDashboardPath()}
                  className="text-surface font-semibold hover:text-accent py-2 transition flex items-center gap-1.5 text-sm sm:text-base"
                >
                  <span className="w-2 h-2 rounded-full bg-accent" />
                  {user?.first_name || user?.email?.split('@')[0] || 'Dashboard'}
                </Link>
                <button
                  onClick={logout}
                  className="bg-accent hover:opacity-95 text-surface font-bold py-2 px-3.5 rounded-lg border border-surface/20 shadow-sm transition cursor-pointer text-sm sm:text-base"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-surface font-semibold hover:text-accent py-2 transition text-sm sm:text-base">Login</Link>
                <Link to="/register" className="bg-accent hover:opacity-95 text-surface font-bold py-2 px-4 rounded-lg border border-surface/20 shadow-sm transition text-sm sm:text-base">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 bg-surface border-y border-border">
        <Outlet />
      </main>

      <SiteFooter settings={settings} footerLinks={footerLinks} partners={partners} />
    </div>
  );
}
