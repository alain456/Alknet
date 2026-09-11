import React, { useMemo } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomePathForUser } from '../auth/roleAccess';
import useSiteContent from '../shared/useSiteContent';

const DEFAULT_COLUMN_TITLES = {
  COMPANY: 'Company',
  SUPPORT: 'Support',
  LEGAL: 'Legal',
  OTHER: 'More',
};

function FooterLinkItem({ link }) {
  const isExternal = /^https?:\/\//i.test(link.url);
  const className = 'hover:text-white transition';
  if (isExternal) {
    return (
      <a
        href={link.url}
        className={className}
        target={link.open_in_new_tab ? '_blank' : undefined}
        rel={link.open_in_new_tab ? 'noreferrer' : undefined}
      >
        {link.label}
      </a>
    );
  }
  return (
    <Link
      to={link.url}
      className={className}
      target={link.open_in_new_tab ? '_blank' : undefined}
      rel={link.open_in_new_tab ? 'noreferrer' : undefined}
    >
      {link.label}
    </Link>
  );
}

export default function PublicLayout() {
  const { user, isAuthenticated, logout } = useAuth();
  const { settings, footerLinks, partners } = useSiteContent();

  const brand = settings?.brand_name || 'Isoko Hub';
  const tagline = settings?.footer_tagline
    || 'Everything you need, in one platform. Connecting Burundi to the world.';
  const copyright = settings?.footer_copyright || '';

  const footerColumns = useMemo(() => {
    const map = {};
    footerLinks.forEach((link) => {
      const key = link.column || 'OTHER';
      if (!map[key]) {
        map[key] = {
          key,
          title: link.column_title || DEFAULT_COLUMN_TITLES[key] || key,
          links: [],
        };
      }
      if (link.column_title) map[key].title = link.column_title;
      map[key].links.push(link);
    });
    const order = ['COMPANY', 'SUPPORT', 'LEGAL', 'OTHER'];
    return order
      .filter((k) => map[k]?.links?.length)
      .map((k) => map[k])
      .concat(Object.values(map).filter((col) => !order.includes(col.key)));
  }, [footerLinks]);

  const showPartners = settings?.show_partners !== false && partners.length > 0;

  const getDashboardPath = () => {
    if (!user) return '/login';
    return getHomePathForUser(user);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-primary shadow-md sticky top-0 z-50 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            {settings?.platform_logo ? (
              <img
                src={settings.platform_logo}
                alt={brand}
                className="w-8 h-8 rounded-full object-cover border border-white/40 bg-white"
              />
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-accent" />
              </div>
            )}
            <span className="font-bold text-xl text-white">{brand}</span>
          </Link>
          <nav className="hidden md:flex gap-6 items-center">
            <Link to="/" className="text-teal-100 hover:text-white font-medium transition">Home</Link>
            <Link to="/services" className="text-teal-100 hover:text-white font-medium transition">Services</Link>
            <Link to="/businesses" className="text-teal-100 hover:text-white font-medium transition">Businesses</Link>
            <Link to="/jobs" className="text-teal-100 hover:text-white font-medium transition">Jobs</Link>
            <div className="w-px h-5 bg-teal-800 mx-2" />
          </nav>
          <div className="flex gap-4 items-center">
            {isAuthenticated ? (
              <>
                <Link
                  to={getDashboardPath()}
                  className="text-teal-100 font-medium hover:text-white py-2 transition flex items-center gap-1"
                >
                  <span className="w-2 h-2 rounded-full bg-green-400" />
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              {settings?.platform_logo ? (
                <img
                  src={settings.platform_logo}
                  alt={brand}
                  className="w-8 h-8 rounded-full object-cover border border-white/30 bg-white"
                />
              ) : null}
              <span className="font-bold text-xl text-white">{brand}</span>
            </div>
            <p className="text-sm text-teal-100">{tagline}</p>
          </div>
          {footerColumns.map((col) => (
            <div key={col.key}>
              <h4 className="font-semibold text-white mb-4">{col.title}</h4>
              <ul className="space-y-2 text-sm text-teal-100">
                {col.links.map((link) => (
                  <li key={link.id}>
                    <FooterLinkItem link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {showPartners && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-8 border-t border-teal-800/60">
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Partners</h4>
            <div className="flex flex-wrap items-center gap-6">
              {partners.map((partner) => {
                const content = (
                  <div className="flex items-center gap-3 bg-white/10 hover:bg-white/15 transition rounded-xl px-4 py-2.5">
                    {partner.logo ? (
                      <img src={partner.logo} alt={partner.name} className="h-8 w-8 object-contain rounded" />
                    ) : null}
                    <span className="text-sm font-medium text-teal-50">{partner.name}</span>
                  </div>
                );
                return partner.website_url ? (
                  <a key={partner.id} href={partner.website_url} target="_blank" rel="noreferrer">{content}</a>
                ) : (
                  <div key={partner.id}>{content}</div>
                );
              })}
            </div>
          </div>
        )}

        {copyright && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-xs text-teal-200/80">
            {copyright}
          </div>
        )}
      </footer>
    </div>
  );
}
