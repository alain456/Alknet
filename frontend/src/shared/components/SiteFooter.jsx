import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Share2 } from 'lucide-react';

const DEFAULT_COLUMN_TITLES = {
  COMPANY: 'Company',
  SUPPORT: 'Help',
  LEGAL: 'Legal',
  OTHER: 'More',
};

/** Icônes sociales en SVG (lucide n’embarque plus les marques). */
function SocialGlyph({ network }) {
  const key = String(network || '').toLowerCase();
  const common = 'w-4 h-4 fill-current';
  if (key === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden>
        <path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H9v3h2v7h3v-7h2.5l.5-3H14V9z" />
      </svg>
    );
  }
  if (key === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden>
        <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm10 2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-5 3.5A4.5 4.5 0 1 1 7.5 13 4.5 4.5 0 0 1 12 8.5zm0 2A2.5 2.5 0 1 0 14.5 13 2.5 2.5 0 0 0 12 10.5zM17.5 7a1 1 0 1 1-1 1 1 1 0 0 1 1-1z" />
      </svg>
    );
  }
  if (key === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden>
        <path d="M23 12.2s0-3.2-.4-4.7c-.2-1.1-1.1-1.9-2.1-2.1C18.9 5 12 5 12 5s-6.9 0-8.5.4c-1 .2-1.9 1-2.1 2.1C1 9 1 12.2 1 12.2s0 3.2.4 4.7c.2 1.1 1.1 1.9 2.1 2.1C5.1 19.4 12 19.4 12 19.4s6.9 0 8.5-.4c1-.2 1.9-1 2.1-2.1.4-1.5.4-4.7.4-4.7zM9.8 15.5v-6.6l5.7 3.3-5.7 3.3z" />
      </svg>
    );
  }
  if (key === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden>
        <path d="M6.5 8.5A2 2 0 1 1 6.5 4.5a2 2 0 0 1 0 4zM4.8 20h3.4V9.8H4.8zm6 0h3.3v-5.5c0-1.5.7-2.4 2-2.4s1.9.9 1.9 2.4V20H21.7v-6.2c0-3.4-1.8-5-4.3-5a3.8 3.8 0 0 0-3.4 1.9V9.8h-3.2z" />
      </svg>
    );
  }
  if (key === 'twitter' || key === 'x') {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden>
        <path d="M18.2 3H21l-6.6 7.5L22 21h-6.2l-4.3-5.6L6 21H3.2l7-8L2 3h6.4l3.9 5.2L18.2 3zm-1.1 16.2h1.7L7 4.7H5.2l11.9 14.5z" />
      </svg>
    );
  }
  return <Share2 className="w-4 h-4" />;
}

function FooterNavLink({ link, className = 'text-sm text-surface/85 hover:text-surface transition' }) {
  const isExternal = /^https?:\/\//i.test(link.url);
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

/**
 * Footer public dynamique (CMS) — headline, contact, colonnes, réseaux.
 */
export default function SiteFooter({ settings, footerLinks = [], partners = [] }) {
  const brand = settings?.brand_name || 'Isoko Hub';
  const headline = settings?.footer_headline
    || settings?.footer_tagline
    || 'Tout ce dont vous avez besoin — en une seule plateforme.';
  const copyright = settings?.footer_copyright
    || `© ${new Date().getFullYear()} ${brand}. All Rights Reserved.`;
  const contactEmail = settings?.footer_contact_email || '';
  const contactPhone = settings?.footer_contact_phone || '';
  const contactTitle = settings?.footer_contact_title || 'Contact information';
  const followTitle = settings?.footer_follow_title || 'Follow us';
  const socialLinks = Array.isArray(settings?.footer_social_links)
    ? settings.footer_social_links.filter((s) => s?.url)
    : [];

  const { navColumns, legalLinks } = useMemo(() => {
    const map = {};
    (footerLinks || []).forEach((link) => {
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
    const legal = map.LEGAL?.links || [];
    const order = ['COMPANY', 'SUPPORT', 'OTHER'];
    const nav = [];
    order.forEach((k) => {
      if (map[k]?.links?.length) nav.push(map[k]);
    });
    Object.values(map).forEach((col) => {
      if (!['COMPANY', 'SUPPORT', 'LEGAL', 'OTHER'].includes(col.key) && col.links.length) {
        nav.push(col);
      }
    });
    return { navColumns: nav, legalLinks: legal };
  }, [footerLinks]);

  const showPartners = settings?.show_partners !== false && partners.length > 0;

  return (
    <footer
      className="text-surface relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 12% 0%, color-mix(in srgb, #1E8B4A 35%, transparent) 0%, transparent 42%), '
          + 'radial-gradient(ellipse at 92% 100%, color-mix(in srgb, #E1302A 28%, transparent) 0%, transparent 40%), '
          + 'color-mix(in srgb, #1B4F9C 62%, #0a1628)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-14 space-y-12">
        <h2 className="font-display text-2xl sm:text-3xl lg:text-[2rem] font-semibold text-surface leading-snug max-w-2xl">
          {headline}
        </h2>

        {/* Middle: contact + columns + social */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-10">
          <div className="col-span-2 sm:col-span-1 space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-surface/55">
              {contactTitle}
            </h4>
            <ul className="space-y-3">
              {contactEmail ? (
                <li>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="inline-flex items-center gap-2.5 text-sm text-surface hover:text-accent transition"
                  >
                    <Mail className="w-4 h-4 text-accent shrink-0" />
                    {contactEmail}
                  </a>
                </li>
              ) : null}
              {contactPhone ? (
                <li>
                  <a
                    href={`tel:${contactPhone.replace(/\s/g, '')}`}
                    className="inline-flex items-center gap-2.5 text-sm text-surface hover:text-accent transition"
                  >
                    <Phone className="w-4 h-4 text-accent shrink-0" />
                    {contactPhone}
                  </a>
                </li>
              ) : null}
              {!contactEmail && !contactPhone && (
                <li className="text-sm text-surface/50">Contact non renseigné</li>
              )}
            </ul>
            {(settings?.platform_logo || brand) && (
              <div className="flex items-center gap-2 pt-2">
                {settings?.platform_logo ? (
                  <img
                    src={settings.platform_logo}
                    alt={brand}
                    className="w-8 h-8 rounded-full object-cover border border-surface/30 bg-surface"
                  />
                ) : null}
                <span className="text-sm font-bold text-surface/80">{brand}</span>
              </div>
            )}
          </div>

          {navColumns.map((col) => (
            <div key={col.key} className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-surface/55">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.id}>
                    <FooterNavLink link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-surface/55">
              {followTitle}
            </h4>
            {socialLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {socialLinks.map((s, i) => {
                  const key = String(s.network || s.name || '').toLowerCase();
                  return (
                    <a
                      key={`${key}-${i}`}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={s.network || s.name || 'Social'}
                      className="w-9 h-9 rounded-full bg-surface text-primary flex items-center justify-center hover:bg-accent hover:text-surface transition"
                    >
                      <SocialGlyph network={key} />
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-surface/45">Ajoutez vos réseaux dans le CMS</p>
            )}
          </div>
        </div>

        {showPartners && (
          <div className="pt-2">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-surface/55 mb-4">
              Partners
            </h4>
            <div className="flex flex-wrap items-center gap-4">
              {partners.map((partner) => {
                const content = (
                  <div className="flex items-center gap-3 bg-surface/10 hover:bg-surface/15 transition rounded-xl px-4 py-2.5">
                    {partner.logo ? (
                      <img src={partner.logo} alt={partner.name} className="h-8 w-8 object-contain rounded" />
                    ) : null}
                    <span className="text-sm font-medium text-surface/90">{partner.name}</span>
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

        {/* Bottom bar */}
        <div className="pt-8 border-t border-surface/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-surface/50">{copyright}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {legalLinks.map((link) => (
              <FooterNavLink
                key={link.id}
                link={link}
                className="text-xs text-surface/50 hover:text-surface transition"
              />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
