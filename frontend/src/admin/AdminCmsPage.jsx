import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Home, Link2, Handshake, FileText, Plus, Pencil, Trash2, Save, RefreshCw, Eye, EyeOff,
  Mail, CheckCheck, Upload, ImageIcon, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { invalidateApiCache } from '../shared/api';
import { clearSiteContentCache } from '../shared/useSiteContent';
import { userHasPlatformPerm } from '../auth/platformPermissions';
import { notifyContactUnread } from './contactInbox';

const TABS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'footer', label: 'Footer', icon: Link2 },
  { key: 'partners', label: 'Partners', icon: Handshake },
  { key: 'pages', label: 'Pages', icon: FileText },
  { key: 'messages', label: 'Messages', icon: Mail },
];

const COLUMN_OPTIONS = [
  { value: 'COMPANY', label: 'Company' },
  { value: 'SUPPORT', label: 'Help / Support' },
  { value: 'LEGAL', label: 'Legal (bas du footer)' },
  { value: 'OTHER', label: 'Other' },
];

const emptyFooter = {
  column: 'COMPANY',
  column_title: 'Company',
  label: '',
  url: '/pages/',
  open_in_new_tab: false,
  display_order: 0,
  is_active: true,
};

const emptyPartner = {
  name: '',
  logo: '',
  website_url: '',
  display_order: 0,
  is_active: true,
};

const emptyPage = {
  slug: '',
  title: '',
  body: '',
  is_published: true,
};

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-primary';

/** Compresse une image pour stockage CMS (base64) sans dépasser les limites API. */
function compressImageFile(file, { maxWidth = 1600, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture fichier impossible'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image invalide'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / Math.max(img.width, 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponible'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export default function AdminCmsPage() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCms = userHasPlatformPerm(user, 'platform.cms.view')
    || user?.role === 'SUPER_ADMIN'
    || user?.is_superuser;
  const tabFromUrl = searchParams.get('tab');
  const initialTab = TABS.some((t) => t.key === tabFromUrl) ? tabFromUrl : 'home';
  const [tab, setTab] = useState(initialTab);
  const [settings, setSettings] = useState(null);
  const [footerLinks, setFooterLinks] = useState([]);
  const [partners, setPartners] = useState([]);
  const [pages, setPages] = useState([]);
  const [contactMessages, setContactMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [footerForm, setFooterForm] = useState(emptyFooter);
  const [editingFooterId, setEditingFooterId] = useState(null);
  const [partnerForm, setPartnerForm] = useState(emptyPartner);
  const [editingPartnerId, setEditingPartnerId] = useState(null);
  const [pageForm, setPageForm] = useState(emptyPage);
  const [editingPageSlug, setEditingPageSlug] = useState(null);
  const contactHeroFileRef = useRef(null);
  const [heroUploading, setHeroUploading] = useState(false);

  const authOpts = useMemo(() => ({ auth: true }), []);

  const handleContactHeroUpload = async (file) => {
    if (!file || !file.type?.startsWith('image/')) {
      setError('Veuillez choisir un fichier image.');
      return;
    }
    setHeroUploading(true);
    setError('');
    try {
      const dataUrl = await compressImageFile(file);
      // Publication immédiate — ne dépend plus du bouton « Enregistrer Home » en bas
      const updated = await api.patch(
        'cms/admin/settings/',
        { contact_hero_image: dataUrl },
        authOpts,
      );
      setSettings((prev) => ({ ...prev, ...updated, contact_hero_image: updated.contact_hero_image || dataUrl }));
      clearSiteContentCache();
      invalidateApiCache('cms');
      flash('Image hero Contact publiée.');
    } catch (err) {
      setError(err.message || 'Échec upload / enregistrement image hero');
    } finally {
      setHeroUploading(false);
    }
  };

  const publishContactHeroFromUrl = async () => {
    const raw = String(settings?.contact_hero_image || '').trim();
    if (!raw || raw.startsWith('data:')) {
      setError('Indiquez une URL http(s) dans le champ, ou utilisez Upload.');
      return;
    }
    setHeroUploading(true);
    setError('');
    try {
      const updated = await api.patch(
        'cms/admin/settings/',
        { contact_hero_image: raw },
        authOpts,
      );
      setSettings((prev) => ({ ...prev, ...updated }));
      clearSiteContentCache();
      invalidateApiCache('cms');
      flash('URL image hero Contact publiée.');
    } catch (err) {
      setError(err.message || 'Échec publication URL image');
    } finally {
      setHeroUploading(false);
    }
  };

  const removeContactHero = async () => {
    setHeroUploading(true);
    setError('');
    try {
      const updated = await api.patch(
        'cms/admin/settings/',
        { contact_hero_image: '' },
        authOpts,
      );
      setSettings((prev) => ({ ...prev, ...updated, contact_hero_image: '' }));
      clearSiteContentCache();
      invalidateApiCache('cms');
      flash('Image hero Contact retirée.');
    } catch (err) {
      setError(err.message || 'Échec suppression image');
    } finally {
      setHeroUploading(false);
    }
  };

  const loadAll = async ({ soft = false } = {}) => {
    if (!soft) setLoading(true);
    setError('');
    try {
      const [s, f, p, pg, msgs] = await Promise.all([
        api.get('cms/admin/settings/', authOpts),
        api.get('cms/admin/footer-links/', authOpts),
        api.get('cms/admin/partners/', authOpts),
        api.get('cms/admin/pages/', authOpts),
        api.get('cms/admin/contact-messages/', authOpts),
      ]);
      setSettings(s);
      setFooterLinks(Array.isArray(f) ? f : f?.results || []);
      setPartners(Array.isArray(p) ? p : p?.results || []);
      setPages(Array.isArray(pg) ? pg : pg?.results || []);
      const msgList = Array.isArray(msgs) ? msgs : (msgs?.results || []);
      setContactMessages(msgList);
      const unread = Number(msgs?.unread_count ?? msgList.filter((m) => !m.is_read).length);
      setUnreadCount(unread);
      notifyContactUnread(unread);
    } catch (err) {
      setError(err.message || 'Erreur de chargement CMS');
    } finally {
      if (!soft) setLoading(false);
    }
  };

  const openMessage = async (msg) => {
    setSelectedMessage(msg);
    if (!msg.is_read) {
      // Optimistic badge
      setContactMessages((prev) => {
        const next = prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m));
        notifyContactUnread(next.filter((m) => !m.is_read).length);
        return next;
      });
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        let updated;
        try {
          updated = await api.patch(`cms/admin/contact-messages/${msg.id}/`, { is_read: true }, authOpts);
        } catch {
          updated = await api.post(`cms/admin/contact-messages/${msg.id}/mark_read/`, {}, authOpts);
        }
        invalidateApiCache('cms/admin/contact-messages');
        setContactMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...updated, is_read: true } : m)));
        setSelectedMessage((prev) => (prev?.id === msg.id ? { ...prev, ...updated, is_read: true } : prev));
      } catch {
        /* déjà marqué localement */
      }
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('cms/admin/contact-messages/mark_all_read/', {}, authOpts);
      setContactMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
      setUnreadCount(0);
      notifyContactUnread(0);
      setMessage('Tous les messages marqués comme lus.');
    } catch (err) {
      setError(err.message || 'Échec');
    }
  };

  const deleteMessage = async (id) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try {
      await api.delete(`cms/admin/contact-messages/${id}/`, authOpts);
      setContactMessages((prev) => {
        const next = prev.filter((m) => m.id !== id);
        notifyContactUnread(next.filter((m) => !m.is_read).length);
        return next;
      });
      if (selectedMessage?.id === id) setSelectedMessage(null);
      setMessage('Message supprimé.');
    } catch (err) {
      setError(err.message || 'Échec suppression');
    }
  };

  useEffect(() => {
    if (!token) return;
    if (!canCms) {
      setLoading(false);
      setError('Accès CMS requis (permission platform.cms.view).');
      return;
    }
    loadAll();
  }, [token, canCms]);

  useEffect(() => {
    const next = searchParams.get('tab');
    if (next && TABS.some((t) => t.key === next) && next !== tab) {
      setTab(next);
    }
  }, [searchParams, tab]);

  const selectTab = (key) => {
    setTab(key);
    const next = new URLSearchParams(searchParams);
    if (key === 'home') next.delete('tab');
    else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2500);
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let social = settings.footer_social_links;
      if (typeof social === 'string') {
        try {
          social = JSON.parse(social || '[]');
        } catch {
          setError('JSON des réseaux sociaux invalide.');
          setSaving(false);
          return;
        }
      }
      if (!Array.isArray(social)) social = [];
      const updated = await api.patch(
        'cms/admin/settings/',
        { ...settings, footer_social_links: social },
        authOpts,
      );
      setSettings(updated);
      clearSiteContentCache();
      invalidateApiCache('cms');
      flash('Paramètres enregistrés (Contact Us inclus)');
    } catch (err) {
      setError(err.message || 'Échec enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const saveFooter = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingFooterId) {
        await api.patch(`cms/admin/footer-links/${editingFooterId}/`, footerForm, authOpts);
      } else {
        await api.post('cms/admin/footer-links/', footerForm, authOpts);
      }
      setFooterForm(emptyFooter);
      setEditingFooterId(null);
      await loadAll();
      clearSiteContentCache();
      flash('Lien footer enregistré');
    } catch (err) {
      setError(err.message || 'Échec footer');
    } finally {
      setSaving(false);
    }
  };

  const deleteFooter = async (id) => {
    if (!window.confirm('Supprimer ce lien ?')) return;
    await api.delete(`cms/admin/footer-links/${id}/`, authOpts);
    await loadAll();
    flash('Lien supprimé');
  };

  const savePartner = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingPartnerId) {
        await api.patch(`cms/admin/partners/${editingPartnerId}/`, partnerForm, authOpts);
      } else {
        await api.post('cms/admin/partners/', partnerForm, authOpts);
      }
      setPartnerForm(emptyPartner);
      setEditingPartnerId(null);
      await loadAll();
      flash('Partenaire enregistré');
    } catch (err) {
      setError(err.message || 'Échec partenaire');
    } finally {
      setSaving(false);
    }
  };

  const deletePartner = async (id) => {
    if (!window.confirm('Supprimer ce partenaire ?')) return;
    await api.delete(`cms/admin/partners/${id}/`, authOpts);
    await loadAll();
    flash('Partenaire supprimé');
  };

  const savePage = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingPageSlug) {
        await api.patch(`cms/admin/pages/${editingPageSlug}/`, pageForm, authOpts);
      } else {
        await api.post('cms/admin/pages/', pageForm, authOpts);
      }
      setPageForm(emptyPage);
      setEditingPageSlug(null);
      await loadAll();
      flash('Page enregistrée');
    } catch (err) {
      setError(err.message || 'Échec page');
    } finally {
      setSaving(false);
    }
  };

  const deletePage = async (slug) => {
    if (!window.confirm('Supprimer cette page ?')) return;
    await api.delete(`cms/admin/pages/${slug}/`, authOpts);
    await loadAll();
    flash('Page supprimée');
  };

  if (!settings) {
    if (error) {
      return (
        <div className="p-8 space-y-3">
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
          <button
            type="button"
            onClick={() => loadAll()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Réessayer
          </button>
        </div>
      );
    }
    return <div className="p-8 text-gray-500">Chargement du CMS...</div>;
  }

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contenu du site (Home, Footer & Messages)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Contenu public et boîte de réception Contact Us.
            {' '}
            <a href="/admin/support" className="text-primary font-semibold hover:underline">Messages contact →</a>
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadAll({ soft: true })}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> Rafraîchir
        </button>
      </div>

      {message && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{message}</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                tab === t.key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
              {t.key === 'messages' && unreadCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  tab === t.key ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
                }`}>
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'home' && (
        <form onSubmit={saveSettings} className="bg-white dark:bg-gray-900 rounded-2xl border p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Nom de la marque">
              <input className={inputClass} value={settings.brand_name || ''} onChange={(e) => setSettings({ ...settings, brand_name: e.target.value })} />
            </Field>
            <Field label="Copyright footer">
              <input className={inputClass} value={settings.footer_copyright || ''} onChange={(e) => setSettings({ ...settings, footer_copyright: e.target.value })} />
            </Field>
          </div>
          <Field label="Logo plateforme (URL ou base64)">
            <textarea
              rows={2}
              className={inputClass}
              value={settings.platform_logo || ''}
              onChange={(e) => setSettings({ ...settings, platform_logo: e.target.value })}
              placeholder="https://... ou data:image/png;base64,..."
            />
            {settings.platform_logo ? (
              <div className="mt-2 flex items-center gap-3">
                <img src={settings.platform_logo} alt="Logo preview" className="h-12 w-12 object-contain rounded border bg-white" />
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => setSettings({ ...settings, platform_logo: '' })}
                >
                  Retirer le logo
                </button>
              </div>
            ) : null}
          </Field>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
            <h3 className="font-bold text-primary text-sm uppercase tracking-wide">Footer (design dynamique)</h3>
            <Field label="Titre principal footer (headline)">
              <input
                className={inputClass}
                value={settings.footer_headline || ''}
                onChange={(e) => setSettings({ ...settings, footer_headline: e.target.value })}
                placeholder="Tout ce dont vous avez besoin — en une seule plateforme."
              />
            </Field>
            <Field label="Tagline (repli si headline vide)">
              <textarea rows={2} className={inputClass} value={settings.footer_tagline || ''} onChange={(e) => setSettings({ ...settings, footer_tagline: e.target.value })} />
            </Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Titre newsletter">
                <input className={inputClass} value={settings.footer_newsletter_title || ''} onChange={(e) => setSettings({ ...settings, footer_newsletter_title: e.target.value })} />
              </Field>
              <Field label="Bouton newsletter">
                <input className={inputClass} value={settings.footer_newsletter_button || ''} onChange={(e) => setSettings({ ...settings, footer_newsletter_button: e.target.value })} />
              </Field>
              <Field label="Placeholder email">
                <input className={inputClass} value={settings.footer_newsletter_placeholder || ''} onChange={(e) => setSettings({ ...settings, footer_newsletter_placeholder: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 pt-6">
                <input
                  type="checkbox"
                  checked={settings.footer_show_newsletter !== false}
                  onChange={(e) => setSettings({ ...settings, footer_show_newsletter: e.target.checked })}
                />
                Afficher la newsletter
              </label>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Titre colonne contact">
                <input className={inputClass} value={settings.footer_contact_title || ''} onChange={(e) => setSettings({ ...settings, footer_contact_title: e.target.value })} />
              </Field>
              <Field label="Titre Follow us">
                <input className={inputClass} value={settings.footer_follow_title || ''} onChange={(e) => setSettings({ ...settings, footer_follow_title: e.target.value })} />
              </Field>
              <Field label="Email contact footer">
                <input type="email" className={inputClass} value={settings.footer_contact_email || ''} onChange={(e) => setSettings({ ...settings, footer_contact_email: e.target.value })} />
              </Field>
              <Field label="Téléphone contact footer">
                <input className={inputClass} value={settings.footer_contact_phone || ''} onChange={(e) => setSettings({ ...settings, footer_contact_phone: e.target.value })} placeholder="+257 …" />
              </Field>
            </div>
            <Field label="Réseaux sociaux (JSON)">
              <textarea
                rows={4}
                className={inputClass + ' font-mono text-xs'}
                value={typeof settings.footer_social_links === 'string'
                  ? settings.footer_social_links
                  : JSON.stringify(settings.footer_social_links || [], null, 2)}
                onChange={(e) => {
                  const raw = e.target.value;
                  try {
                    const parsed = JSON.parse(raw || '[]');
                    setSettings({ ...settings, footer_social_links: parsed });
                  } catch {
                    setSettings({ ...settings, footer_social_links: raw });
                  }
                }}
                placeholder={'[\n  {"network":"facebook","url":"https://facebook.com/…"},\n  {"network":"instagram","url":"https://instagram.com/…"}\n]'}
              />
              <span className="text-[11px] text-gray-500">
                Réseaux : facebook, instagram, youtube, linkedin, twitter
              </span>
            </Field>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
            <h3 className="font-bold text-primary text-sm uppercase tracking-wide">Page Contact Us</h3>
            <Field label="Sous-titre hero">
              <input className={inputClass} value={settings.contact_hero_subtitle || ''} onChange={(e) => setSettings({ ...settings, contact_hero_subtitle: e.target.value })} />
            </Field>
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Image hero Contact
              </span>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={contactHeroFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleContactHeroUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    disabled={heroUploading}
                    onClick={() => contactHeroFileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:opacity-95 border border-accent/40 shadow-sm transition disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    {heroUploading ? 'Publication…' : 'Upload & publier'}
                  </button>
                  {settings.contact_hero_image ? (
                    <button
                      type="button"
                      disabled={heroUploading}
                      onClick={removeContactHero}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-alert/40 text-alert text-sm font-bold hover:bg-alert/5 transition disabled:opacity-60"
                    >
                      <X className="w-4 h-4" />
                      Retirer
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className={inputClass}
                    value={
                      settings.contact_hero_image?.startsWith('data:')
                        ? ''
                        : (settings.contact_hero_image || '')
                    }
                    onChange={(e) => setSettings({ ...settings, contact_hero_image: e.target.value })}
                    placeholder="Ou collez une URL https://…"
                  />
                  <button
                    type="button"
                    disabled={heroUploading}
                    onClick={publishContactHeroFromUrl}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-primary text-primary text-sm font-bold hover:bg-primary/5 transition disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    Publier URL
                  </button>
                </div>
                {settings.contact_hero_image?.startsWith('data:') ? (
                  <p className="text-[11px] text-emerald-700 font-medium">Image uploadée (fichier) — déjà publiée.</p>
                ) : null}
                {settings.contact_hero_image ? (
                  <div className="relative mt-1 rounded-lg overflow-hidden border border-primary/20 bg-white max-w-md">
                    <img
                      src={settings.contact_hero_image}
                      alt="Aperçu hero contact"
                      className="w-full h-36 object-cover"
                    />
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">
                      <ImageIcon className="w-3 h-3" /> Aperçu publié
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500">Upload publie immédiatement l’image sur /pages/contact.</p>
                )}
              </div>
            </div>
            <Field label="Intro « Get in touch »">
              <textarea rows={2} className={inputClass} value={settings.contact_intro || ''} onChange={(e) => setSettings({ ...settings, contact_intro: e.target.value })} />
            </Field>
            <Field label="Adresse Head Office">
              <input className={inputClass} value={settings.contact_office_address || ''} onChange={(e) => setSettings({ ...settings, contact_office_address: e.target.value })} />
            </Field>
            <Field label="Lien Google Maps (partage ou embed)">
              <textarea
                rows={2}
                className={inputClass + ' font-mono text-xs'}
                value={settings.contact_google_maps_url || ''}
                onChange={(e) => {
                  const url = e.target.value;
                  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                  const ll = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/i);
                  const coords = at || ll;
                  setSettings({
                    ...settings,
                    contact_google_maps_url: url,
                    ...(coords
                      ? { contact_map_lat: coords[1], contact_map_lng: coords[2] }
                      : {}),
                  });
                }}
                placeholder="Collez l’URL Google Maps (ex. https://www.google.com/maps/place/…/@-3.37,29.91,17z…)"
              />
              <span className="text-[11px] text-gray-500">
                Collez le lien Google Maps : la latitude/longitude sont extraites automatiquement si présentes.
              </span>
            </Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Carte — latitude">
                <input className={inputClass} value={settings.contact_map_lat || ''} onChange={(e) => setSettings({ ...settings, contact_map_lat: e.target.value })} placeholder="-3.3731" />
              </Field>
              <Field label="Carte — longitude">
                <input className={inputClass} value={settings.contact_map_lng || ''} onChange={(e) => setSettings({ ...settings, contact_map_lng: e.target.value })} placeholder="29.9189" />
              </Field>
            </div>
            <p className="text-[11px] text-gray-500">Email / téléphone / réseaux : section Footer ci-dessus. Page slug : <code>/pages/contact</code></p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Titre page Services">
              <input className={inputClass} value={settings.services_page_title || ''} onChange={(e) => setSettings({ ...settings, services_page_title: e.target.value })} />
            </Field>
            <Field label="Sous-titre page Services">
              <input className={inputClass} value={settings.services_page_subtitle || ''} onChange={(e) => setSettings({ ...settings, services_page_subtitle: e.target.value })} />
            </Field>
          </div>
          <Field label="Titre Hero (utilisez \\n pour un retour à la ligne)">
            <textarea rows={2} className={inputClass} value={settings.hero_title || ''} onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })} />
          </Field>
          <Field label="Sous-titre Hero">
            <textarea rows={3} className={inputClass} value={settings.hero_subtitle || ''} onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })} />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="CTA primaire — label">
              <input className={inputClass} value={settings.hero_cta_primary_label || ''} onChange={(e) => setSettings({ ...settings, hero_cta_primary_label: e.target.value })} />
            </Field>
            <Field label="CTA primaire — URL">
              <input className={inputClass} value={settings.hero_cta_primary_url || ''} onChange={(e) => setSettings({ ...settings, hero_cta_primary_url: e.target.value })} />
            </Field>
            <Field label="CTA secondaire — label">
              <input className={inputClass} value={settings.hero_cta_secondary_label || ''} onChange={(e) => setSettings({ ...settings, hero_cta_secondary_label: e.target.value })} />
            </Field>
            <Field label="CTA secondaire — URL">
              <input className={inputClass} value={settings.hero_cta_secondary_url || ''} onChange={(e) => setSettings({ ...settings, hero_cta_secondary_url: e.target.value })} />
            </Field>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Placeholder recherche">
              <input className={inputClass} value={settings.search_placeholder || ''} onChange={(e) => setSettings({ ...settings, search_placeholder: e.target.value })} />
            </Field>
            <Field label="Placeholder localisation">
              <input className={inputClass} value={settings.search_location_placeholder || ''} onChange={(e) => setSettings({ ...settings, search_location_placeholder: e.target.value })} />
            </Field>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              ['categories_title', 'Titre catégories'],
              ['professionals_title', 'Titre professionnels'],
              ['health_title', 'Titre santé'],
              ['businesses_title', 'Titre businesses'],
              ['services_title', 'Titre services'],
              ['why_title', 'Titre Why'],
              ['app_banner_title', 'Titre bannière app'],
              ['app_banner_badge', 'Badge bannière app'],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input className={inputClass} value={settings[key] || ''} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} />
              </Field>
            ))}
          </div>
          <Field label="Sous-titre bannière app">
            <textarea rows={2} className={inputClass} value={settings.app_banner_subtitle || ''} onChange={(e) => setSettings({ ...settings, app_banner_subtitle: e.target.value })} />
          </Field>

          <div>
            <h3 className="font-semibold mb-3">Sections visibles</h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['show_categories', 'Catégories'],
                ['show_professionals', 'Professionnels'],
                ['show_health', 'Santé'],
                ['show_businesses', 'Businesses'],
                ['show_services', 'Services'],
                ['show_why', 'Why'],
                ['show_app_banner', 'App banner'],
                ['show_partners', 'Partners (footer)'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!settings[key]}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer Home'}
          </button>
        </form>
      )}

      {tab === 'footer' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={saveFooter} className="bg-white dark:bg-gray-900 rounded-2xl border p-6 space-y-4">
            <h3 className="font-bold text-lg">{editingFooterId ? 'Modifier le lien' : 'Nouveau lien footer'}</h3>
            <Field label="Colonne">
              <select
                className={inputClass}
                value={footerForm.column}
                onChange={(e) => {
                  const col = e.target.value;
                  const def = COLUMN_OPTIONS.find((c) => c.value === col)?.label || '';
                  setFooterForm({ ...footerForm, column: col, column_title: footerForm.column_title || def });
                }}
              >
                {COLUMN_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Titre de colonne">
              <input className={inputClass} value={footerForm.column_title} onChange={(e) => setFooterForm({ ...footerForm, column_title: e.target.value })} />
            </Field>
            <Field label="Label">
              <input required className={inputClass} value={footerForm.label} onChange={(e) => setFooterForm({ ...footerForm, label: e.target.value })} />
            </Field>
            <Field label="URL (/pages/about ou https://...)">
              <input required className={inputClass} value={footerForm.url} onChange={(e) => setFooterForm({ ...footerForm, url: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ordre">
                <input type="number" className={inputClass} value={footerForm.display_order} onChange={(e) => setFooterForm({ ...footerForm, display_order: Number(e.target.value) || 0 })} />
              </Field>
              <label className="flex items-center gap-2 text-sm mt-7">
                <input type="checkbox" checked={footerForm.is_active} onChange={(e) => setFooterForm({ ...footerForm, is_active: e.target.checked })} />
                Actif
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={footerForm.open_in_new_tab} onChange={(e) => setFooterForm({ ...footerForm, open_in_new_tab: e.target.checked })} />
              Ouvrir dans un nouvel onglet
            </label>
            <div className="flex gap-2">
              <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold">
                <Plus className="w-4 h-4" /> {editingFooterId ? 'Mettre à jour' : 'Ajouter'}
              </button>
              {editingFooterId && (
                <button type="button" onClick={() => { setEditingFooterId(null); setFooterForm(emptyFooter); }} className="px-4 py-2 border rounded-xl text-sm">
                  Annuler
                </button>
              )}
            </div>
          </form>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold">Liens existants ({footerLinks.length})</div>
            <ul className="divide-y max-h-[520px] overflow-y-auto">
              {footerLinks.map((link) => (
                <li key={link.id} className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-primary uppercase">{link.column_title || link.column}</div>
                    <div className="font-semibold">{link.label}</div>
                    <div className="text-xs text-gray-500 break-all">{link.url}</div>
                    <div className="text-[11px] text-gray-400 mt-1">ordre {link.display_order} · {link.is_active ? 'actif' : 'inactif'}</div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className="icon-btn" onClick={() => { setEditingFooterId(link.id); setFooterForm(link); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="icon-btn icon-btn--danger" onClick={() => deleteFooter(link.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'partners' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={savePartner} className="bg-white dark:bg-gray-900 rounded-2xl border p-6 space-y-4">
            <h3 className="font-bold text-lg">{editingPartnerId ? 'Modifier le partenaire' : 'Nouveau partenaire'}</h3>
            <Field label="Nom">
              <input required className={inputClass} value={partnerForm.name} onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })} />
            </Field>
            <Field label="Logo (URL ou base64)">
              <textarea rows={2} className={inputClass} value={partnerForm.logo} onChange={(e) => setPartnerForm({ ...partnerForm, logo: e.target.value })} />
            </Field>
            <Field label="Site web">
              <input type="url" className={inputClass} value={partnerForm.website_url} onChange={(e) => setPartnerForm({ ...partnerForm, website_url: e.target.value })} placeholder="https://" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ordre">
                <input type="number" className={inputClass} value={partnerForm.display_order} onChange={(e) => setPartnerForm({ ...partnerForm, display_order: Number(e.target.value) || 0 })} />
              </Field>
              <label className="flex items-center gap-2 text-sm mt-7">
                <input type="checkbox" checked={partnerForm.is_active} onChange={(e) => setPartnerForm({ ...partnerForm, is_active: e.target.checked })} />
                Actif
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold">
                <Plus className="w-4 h-4" /> {editingPartnerId ? 'Mettre à jour' : 'Ajouter'}
              </button>
              {editingPartnerId && (
                <button type="button" onClick={() => { setEditingPartnerId(null); setPartnerForm(emptyPartner); }} className="px-4 py-2 border rounded-xl text-sm">Annuler</button>
              )}
            </div>
          </form>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold">Partenaires ({partners.length})</div>
            <ul className="divide-y">
              {partners.map((p) => (
                <li key={p.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                      {p.logo ? <img src={p.logo} alt={p.name} className="w-full h-full object-contain" /> : <Handshake className="w-5 h-5 text-gray-400" />}
                    </div>
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-gray-500 break-all">{p.website_url || '—'}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className="icon-btn" onClick={() => { setEditingPartnerId(p.id); setPartnerForm(p); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="icon-btn icon-btn--danger" onClick={() => deletePartner(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
              {partners.length === 0 && <li className="p-6 text-sm text-gray-500">Aucun partenaire pour le moment.</li>}
            </ul>
          </div>
        </div>
      )}

      {tab === 'pages' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={savePage} className="bg-white dark:bg-gray-900 rounded-2xl border p-6 space-y-4">
            <h3 className="font-bold text-lg">{editingPageSlug ? 'Modifier la page' : 'Nouvelle page'}</h3>
            <Field label="Slug (ex: about)">
              <input required disabled={!!editingPageSlug} className={inputClass} value={pageForm.slug} onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} />
            </Field>
            <Field label="Titre">
              <input required className={inputClass} value={pageForm.title} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })} />
            </Field>
            <Field label="Contenu">
              <textarea required rows={8} className={inputClass} value={pageForm.body} onChange={(e) => setPageForm({ ...pageForm, body: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pageForm.is_published} onChange={(e) => setPageForm({ ...pageForm, is_published: e.target.checked })} />
              Publiée
            </label>
            <div className="flex gap-2">
              <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold">
                <Save className="w-4 h-4" /> {editingPageSlug ? 'Mettre à jour' : 'Créer'}
              </button>
              {editingPageSlug && (
                <button type="button" onClick={() => { setEditingPageSlug(null); setPageForm(emptyPage); }} className="px-4 py-2 border rounded-xl text-sm">Annuler</button>
              )}
            </div>
          </form>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold">Pages ({pages.length})</div>
            <ul className="divide-y">
              {pages.map((pg) => (
                <li key={pg.id} className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {pg.title}
                      {pg.is_published ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                    </div>
                    <div className="text-xs text-gray-500">/pages/{pg.slug}</div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className="icon-btn" onClick={() => { setEditingPageSlug(pg.slug); setPageForm(pg); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="icon-btn icon-btn--danger" onClick={() => deletePage(pg.slug)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Messages reçus depuis <strong>/pages/contact</strong>
              {unreadCount > 0 ? ` · ${unreadCount} non lu(s)` : ''}.
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg hover:bg-gray-50"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Tout marquer lu
              </button>
            )}
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden max-h-[70vh] overflow-y-auto">
              <ul className="divide-y">
                {contactMessages.map((msg) => (
                  <li key={msg.id}>
                    <button
                      type="button"
                      onClick={() => openMessage(msg)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                        selectedMessage?.id === msg.id ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {!msg.is_read && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                        <span className={`text-sm truncate ${msg.is_read ? 'font-medium text-gray-800' : 'font-bold text-gray-900'}`}>
                          {msg.subject}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{msg.name} · {msg.email}</div>
                      <div className="text-[11px] text-gray-400 mt-1">
                        {msg.created_at ? new Date(msg.created_at).toLocaleString('fr-FR') : ''}
                      </div>
                    </button>
                  </li>
                ))}
                {contactMessages.length === 0 && (
                  <li className="p-8 text-center text-sm text-gray-500">Aucun message pour le moment.</li>
                )}
              </ul>
            </div>

            <div className="lg:col-span-3 bg-white dark:bg-gray-900 rounded-2xl border p-6 min-h-[280px]">
              {!selectedMessage ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500 py-16">
                  Sélectionnez un message pour le lire.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{selectedMessage.subject}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        De <strong>{selectedMessage.name}</strong> ·{' '}
                        <a href={`mailto:${selectedMessage.email}`} className="text-primary hover:underline">
                          {selectedMessage.email}
                        </a>
                        {selectedMessage.phone ? ` · ${selectedMessage.phone}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {selectedMessage.created_at
                          ? new Date(selectedMessage.created_at).toLocaleString('fr-FR')
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteMessage(selectedMessage.id)}
                      className="icon-btn icon-btn--danger"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="rounded-xl bg-gray-50 border p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {selectedMessage.message}
                  </div>
                  <a
                    href={`mailto:${selectedMessage.email}?subject=${encodeURIComponent(`Re: ${selectedMessage.subject}`)}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold"
                  >
                    <Mail className="w-4 h-4" /> Répondre par email
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
