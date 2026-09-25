import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Mail, Phone, MapPin, CheckCircle2,
} from 'lucide-react';
import api from '../shared/api';
import useSiteContent from '../shared/useSiteContent';

/** Icônes sociales SVG (lucide n’embarque plus les marques). */
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
  return <Mail className="w-4 h-4" />;
}

const fieldClass =
  'w-full px-4 py-3 rounded-lg bg-[#f3f4f6] border border-transparent text-sm text-ink font-medium outline-none focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20 transition placeholder:text-ink-muted/50';

const CONTACT_HERO_FALLBACK = '/contact-hero-default.jpg';

/** Construit une URL d’embed Google Maps à partir du lien CMS / coords / adresse. */
function buildGoogleMapsEmbed({ mapsUrl, lat, lng, address }) {
  const raw = String(mapsUrl || '').trim();
  if (raw) {
    if (/google\.[^/]+\/maps\/embed/i.test(raw) || raw.includes('maps/embed?')) {
      return raw;
    }
    const at = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) {
      return `https://www.google.com/maps?q=${at[1]},${at[2]}&z=16&output=embed`;
    }
    const q = raw.match(/[?&](?:q|query)=([^&]+)/i);
    if (q) {
      return `https://www.google.com/maps?q=${q[1]}&z=16&output=embed`;
    }
    const place = raw.match(/\/maps\/place\/([^/?#]+)/i);
    if (place) {
      return `https://www.google.com/maps?q=${place[1]}&z=16&output=embed`;
    }
    const ll = raw.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/i);
    if (ll) {
      return `https://www.google.com/maps?q=${ll[1]},${ll[2]}&z=16&output=embed`;
    }
  }
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(address || 'Bujumbura, Burundi')}&z=15&output=embed`;
}

function buildGoogleMapsLink({ mapsUrl, lat, lng, address }) {
  const raw = String(mapsUrl || '').trim();
  if (raw && !raw.includes('output=embed') && !raw.includes('/maps/embed')) {
    return raw;
  }
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || 'Bujumbura, Burundi')}`;
}

function ContactPage({ page, paragraphs }) {
  const { settings, reload } = useSiteContent();

  useEffect(() => {
    reload(true);
  }, [reload]);

  const brand = settings?.brand_name || 'Isoko Hub';
  const title = page?.title || 'Contact us';
  const subtitle = settings?.contact_hero_subtitle
    || `${brand} is ready to provide the right solution according to your needs.`;
  const heroImage = (settings?.contact_hero_image || '').trim() || CONTACT_HERO_FALLBACK;
  const intro = settings?.contact_intro
    || paragraphs.join(' ')
    || 'Une question sur la plateforme, un partenariat ou un besoin support ? Écrivez-nous.';
  const address = settings?.contact_office_address || 'Bujumbura, Burundi';
  const email = settings?.footer_contact_email || 'support@isokohub.com';
  const phone = settings?.footer_contact_phone || '';
  const socialLinks = Array.isArray(settings?.footer_social_links)
    ? settings.footer_social_links.filter((s) => s?.url)
    : [];
  const lat = Number(settings?.contact_map_lat);
  const lng = Number(settings?.contact_map_lng);
  const mapsUrl = settings?.contact_google_maps_url || '';
  const mapSrc = buildGoogleMapsEmbed({
    mapsUrl,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    address,
  });
  const mapLink = buildGoogleMapsLink({
    mapsUrl,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    address,
  });

  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setFormError('');
    try {
      const companyNote = form.company.trim()
        ? `\n\n— Entreprise : ${form.company.trim()}`
        : '';
      await api.post('cms/public/contact/', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        subject: form.subject,
        message: `${form.message}${companyNote}`,
      });
      setSent(true);
      setForm({ name: '', company: '', email: '', phone: '', subject: '', message: '' });
    } catch (err) {
      setFormError(err.message || 'Impossible d’envoyer le message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-[#f8f9fb] text-ink -mt-px">
      {/* Hero — image CMS dynamique */}
      <section className="relative min-h-[320px] sm:min-h-[400px] flex items-center justify-center overflow-hidden bg-primary">
        {heroImage ? (
          <img
            key={heroImage.slice(0, 64)}
            src={heroImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-primary/35" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        <div className="relative z-10 max-w-3xl mx-auto w-full px-4 py-20 sm:py-28 text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold text-white tracking-tight">
            {title}
          </h1>
          <p className="text-base sm:text-lg text-white/90 font-medium max-w-xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        </div>
      </section>

      {/* Card overlapping hero */}
      <div className="max-w-5xl mx-auto px-4 -mt-16 sm:-mt-20 relative z-10 pb-0">
        <div className="bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(15,76,70,0.25)] overflow-hidden">
          <div className="grid lg:grid-cols-2">
            {/* Get in touch */}
            <div className="p-7 sm:p-9 lg:p-11 space-y-7">
              <div>
                <h2 className="text-2xl font-bold text-ink mb-2.5">
                  Get in touch
                </h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {intro}
                </p>
              </div>

              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-bold text-ink">Head Office</p>
                    <p className="text-sm text-ink-muted mt-1 leading-snug">{address}</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-bold text-ink">Email Us</p>
                    <a href={`mailto:${email}`} className="block text-sm text-ink-muted mt-1 hover:text-primary transition">
                      {email}
                    </a>
                  </div>
                </li>
                {phone ? (
                  <li className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-bold text-ink">Call Us</p>
                      <a
                        href={`tel:${phone.replace(/\s/g, '')}`}
                        className="block text-sm text-ink-muted mt-1 hover:text-primary transition"
                      >
                        {phone}
                      </a>
                    </div>
                  </li>
                ) : null}
              </ul>

              <div>
                <p className="text-sm font-bold text-ink mb-3.5">Follow our social media</p>
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
                          aria-label={s.network || 'Social'}
                          className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-accent transition shadow-sm"
                        >
                          <SocialGlyph network={key} />
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted">Configurez les réseaux dans le CMS.</p>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="p-7 sm:p-9 lg:p-11 border-t lg:border-t-0 lg:border-l border-gray-100">
              {sent ? (
                <div className="py-14 text-center space-y-3">
                  <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
                  <h2 className="text-2xl font-bold text-ink">Message envoyé</h2>
                  <p className="text-sm text-ink-muted max-w-sm mx-auto">
                    Merci. Votre message a été transmis à l’équipe {brand}. Nous vous répondrons bientôt.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="mt-2 text-sm font-bold text-primary hover:underline"
                  >
                    Envoyer un autre message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h2 className="text-2xl font-bold text-ink mb-5">
                    Send us a message
                  </h2>
                  {formError && (
                    <div className="p-3 rounded-lg bg-alert/10 text-alert text-sm font-medium border border-alert/30">
                      {formError}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-ink-muted">Name</span>
                      <input
                        required
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        className={fieldClass}
                        placeholder="Name"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-ink-muted">Company</span>
                      <input
                        name="company"
                        value={form.company}
                        onChange={handleChange}
                        className={fieldClass}
                        placeholder="Company"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-ink-muted">Phone</span>
                      <input
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        className={fieldClass}
                        placeholder="Phone"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-ink-muted">Email</span>
                      <input
                        required
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        className={fieldClass}
                        placeholder="Email"
                      />
                    </label>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-ink-muted">Subject</span>
                    <input
                      required
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      className={fieldClass}
                      placeholder="Subject"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-ink-muted">Message</span>
                    <textarea
                      required
                      name="message"
                      rows={5}
                      value={form.message}
                      onChange={handleChange}
                      className={`${fieldClass} resize-y min-h-[130px]`}
                      placeholder="Message"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 mt-1 bg-primary hover:opacity-95 text-white rounded-lg font-bold text-sm shadow-md disabled:opacity-60 transition"
                  >
                    {sending ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : null}
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map — full bleed */}
      <section className="mt-14 sm:mt-16">
        <div className="relative w-full bg-gray-100">
          <iframe
            title="Carte — siège"
            src={mapSrc}
            className="w-full h-[300px] sm:h-[420px] border-0 block"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <a
            href={mapLink}
            target="_blank"
            rel="noreferrer"
            className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-white/95 backdrop-blur-sm rounded-md shadow-md px-3 py-2 text-xs font-semibold text-ink hover:text-primary transition inline-flex items-center gap-1.5 max-w-[min(100%-1.5rem,280px)]"
          >
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">{address}</span>
          </a>
        </div>
      </section>
    </div>
  );
}

export default function ContentPageView() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isContact = slug === 'contact';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.get(`cms/public/pages/${slug}/`);
        setPage(data);
      } catch (err) {
        setError(err.message || 'Page introuvable');
        setPage(null);
      } finally {
        setLoading(false);
      }
    };
    if (slug) load();
  }, [slug]);

  const paragraphs = useMemo(
    () => (page?.body || '').split(/\n+/).filter(Boolean),
    [page]
  );

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-ink-muted font-medium">Chargement…</div>;
  }

  if (error || !page) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-ink mb-2">Page introuvable</h1>
        <p className="text-ink-muted mb-6">{error || 'Cette page n’existe pas ou n’est pas publiée.'}</p>
        <Link to="/" className="text-primary font-bold hover:underline">Retour à l’accueil</Link>
      </div>
    );
  }

  if (isContact) {
    return <ContactPage page={page} paragraphs={paragraphs} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-extrabold text-ink mb-6">{page.title}</h1>
      <div className="space-y-4 text-ink leading-relaxed font-medium">
        {paragraphs.map((p, idx) => (
          <p key={idx}>{p}</p>
        ))}
      </div>
    </div>
  );
}
