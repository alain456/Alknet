import React, { useEffect, useMemo, useState } from 'react';
import {
  Home, Link2, Handshake, FileText, Plus, Pencil, Trash2, Save, RefreshCw, Eye, EyeOff,
  Mail, CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';

const TABS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'footer', label: 'Footer', icon: Link2 },
  { key: 'partners', label: 'Partners', icon: Handshake },
  { key: 'pages', label: 'Pages', icon: FileText },
  { key: 'messages', label: 'Messages', icon: Mail },
];

const COLUMN_OPTIONS = [
  { value: 'COMPANY', label: 'Company' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'LEGAL', label: 'Legal' },
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

export default function AdminCmsPage() {
  const { token, user } = useAuth();
  const isPlatformAdmin = user?.role === 'SUPER_ADMIN' || user?.is_superuser;
  const [tab, setTab] = useState('home');
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

  const authOpts = useMemo(() => ({ auth: true }), []);

  const loadAll = async () => {
    setLoading(true);
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
      setUnreadCount(msgs?.unread_count ?? msgList.filter((m) => !m.is_read).length);
    } catch (err) {
      setError(err.message || 'Erreur de chargement CMS');
    } finally {
      setLoading(false);
    }
  };

  const openMessage = async (msg) => {
    setSelectedMessage(msg);
    if (!msg.is_read) {
      try {
        const updated = await api.post(`cms/admin/contact-messages/${msg.id}/mark_read/`, {}, authOpts);
        setContactMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...updated, is_read: true } : m)));
        setSelectedMessage((prev) => (prev?.id === msg.id ? { ...prev, ...updated, is_read: true } : prev));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* lecture locale ok */
      }
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('cms/admin/contact-messages/mark_all_read/', {}, authOpts);
      setContactMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
      setUnreadCount(0);
      setMessage('Tous les messages marqués comme lus.');
    } catch (err) {
      setError(err.message || 'Échec');
    }
  };

  const deleteMessage = async (id) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try {
      await api.delete(`cms/admin/contact-messages/${id}/`, authOpts);
      setContactMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedMessage?.id === id) setSelectedMessage(null);
      setMessage('Message supprimé.');
    } catch (err) {
      setError(err.message || 'Échec suppression');
    }
  };

  useEffect(() => {
    if (!token) return;
    if (!isPlatformAdmin) {
      setLoading(false);
      setError('Accès réservé au Super Admin plateforme. Reconnectez-vous avec un compte Super Admin (ex: admin@isokohub.com).');
      return;
    }
    loadAll();
  }, [token, isPlatformAdmin]);

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2500);
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.patch('cms/admin/settings/', settings, authOpts);
      setSettings(updated);
      flash('Home enregistrée');
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

  if (loading || !settings) {
    return <div className="p-8 text-gray-500">Chargement du CMS...</div>;
  }

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contenu du site (Home & Footer)</h1>
          <p className="text-sm text-gray-500 mt-1">Géré uniquement par le Super Admin — visible côté client.</p>
        </div>
        <button
          type="button"
          onClick={loadAll}
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
              onClick={() => setTab(t.key)}
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
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Titre page Services">
              <input className={inputClass} value={settings.services_page_title || ''} onChange={(e) => setSettings({ ...settings, services_page_title: e.target.value })} />
            </Field>
            <Field label="Sous-titre page Services">
              <input className={inputClass} value={settings.services_page_subtitle || ''} onChange={(e) => setSettings({ ...settings, services_page_subtitle: e.target.value })} />
            </Field>
          </div>
          <Field label="Tagline footer">
            <textarea rows={2} className={inputClass} value={settings.footer_tagline || ''} onChange={(e) => setSettings({ ...settings, footer_tagline: e.target.value })} />
          </Field>
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
                    <button type="button" className="p-2 rounded-lg hover:bg-gray-100" onClick={() => { setEditingFooterId(link.id); setFooterForm(link); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-2 rounded-lg hover:bg-red-50 text-red-600" onClick={() => deleteFooter(link.id)}>
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
                    <button type="button" className="p-2 rounded-lg hover:bg-gray-100" onClick={() => { setEditingPartnerId(p.id); setPartnerForm(p); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-2 rounded-lg hover:bg-red-50 text-red-600" onClick={() => deletePartner(p.id)}>
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
                    <button type="button" className="p-2 rounded-lg hover:bg-gray-100" onClick={() => { setEditingPageSlug(pg.slug); setPageForm(pg); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-2 rounded-lg hover:bg-red-50 text-red-600" onClick={() => deletePage(pg.slug)}>
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
                      className="p-2 rounded-lg hover:bg-red-50 text-red-600"
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
