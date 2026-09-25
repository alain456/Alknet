import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Building2, MapPin, Phone, Globe, Save, Star, Upload, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBusinessCategoryKey } from '../auth/roleAccess';
import SectorSpecificFields from '../shared/components/SectorSpecificFields';
import LocationSelector from '../shared/components/LocationSelector';
import { readImageAsDataUrl } from '../shared/imageUpload';
import api from '../shared/api';
import { normalizeWebsiteUrl } from '../shared/websiteUrl';
import WholesaleOperationalSettings from './WholesaleOperationalSettings';
import RetailOperationalSettings from './RetailOperationalSettings';
import HospitalOperationalSettings from './HospitalOperationalSettings';

export default function BusinessSettingsPage() {
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    description: '',
    primary_category: '',
    primary_category_name: '',
    category_ids: [],
    extra_attributes: {},
    province: 'Bujumbura Mairie',
    commune: 'Mukaza',
    quartier: '',
    latitude: '',
    longitude: '',
    address: '',
    phone: '',
    website: '',
    email: '',
  });
  const [hasExistingLogo, setHasExistingLogo] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const { token, authFetch, user } = useAuth();

  const sectorKey = useMemo(() => {
    const fromUser = getBusinessCategoryKey(user);
    if (fromUser && fromUser !== 'business') return fromUser;
    const cat = categories.find((c) => String(c.id) === String(formData.primary_category));
    const name = (cat?.name || formData.primary_category_name || '').toLowerCase();
    if (name.includes('pharmac') && name.includes('gros')) return 'wholesale';
    if (name.includes('pharmac')) return 'retail_pharmacy';
    if (name.includes('hôpital') || name.includes('hopital') || name.includes('sant') || name.includes('clinique')) return 'hospital';
    if (name.includes('hôtel') || name.includes('hotel')) return 'hotel';
    return fromUser || 'business';
  }, [user, categories, formData.primary_category, formData.primary_category_name]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, meRes] = await Promise.all([
          api.get('business-categories/').catch(() => []),
          authFetch('/api/v1/businesses/me/'),
        ]);
        setCategories(Array.isArray(cats) ? cats : cats?.results || []);
        if (meRes.ok) {
          const data = await meRes.json();
          const b = Array.isArray(data) ? data[0] : data;
          if (b) {
            setFormData({
              name: b.name || '',
              logo: b.logo || '',
              description: b.description || '',
              primary_category: b.primary_category || '',
              primary_category_name: b.primary_category_name || '',
              category_ids: b.category_ids || [],
              extra_attributes: b.extra_attributes || {},
              province: b.province || 'Bujumbura Mairie',
              commune: b.commune || 'Mukaza',
              quartier: b.quartier || '',
              latitude: b.latitude || '',
              longitude: b.longitude || '',
              address: b.address || '',
              phone: b.phone || '',
              website: b.website || '',
              email: b.email || '',
            });
            setHasExistingLogo(Boolean(b.has_logo || b.logo));
          }
        }
      } catch (err) {
        setError(err.message || 'Chargement impossible');
      } finally {
        setLoadingCategories(false);
        setLoading(false);
      }
    };
    if (token) load();
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError('');
    setLogoUploading(true);
    try {
      const dataUrl = await readImageAsDataUrl(file, { maxSize: 600, quality: 0.85 });
      setFormData((prev) => ({ ...prev, logo: dataUrl }));
      setHasExistingLogo(true);
    } catch (err) {
      setLogoError(err.message || 'Upload impossible');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setError('');

    try {
      const payload = { ...formData, website: normalizeWebsiteUrl(formData.website) };
      delete payload.primary_category_name;
      if (!payload.logo && hasExistingLogo) {
        delete payload.logo;
      }
      const response = await authFetch('/api/v1/businesses/me/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Enregistrement impossible');
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Chargement…</div>;
  }

  return (
    <div className="space-y-6 pb-10 w-full max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-green-700 dark:text-green-100" />
            Paramètres de l&apos;Entreprise
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Gérez les informations publiques, le logo et les spécificités sectorielles.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-100 rounded-lg text-sm font-semibold">
          ✓ Paramètres enregistrés avec succès.
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
              <Building2 className="w-5 h-5 text-gray-400" />
              Informations Générales
            </h2>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3 mb-6">
              <label className="block text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-green-700 dark:text-green-400" /> Logo & Image de l&apos;Entreprise
              </label>

              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-700 dark:text-green-300 font-bold text-3xl shrink-0 overflow-hidden shadow-inner relative">
                  {formData.logo ? (
                    <img src={formData.logo} alt="Aperçu Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="uppercase">{formData.name ? formData.name[0] : 'E'}</span>
                  )}
                </div>

                <div className="flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-md text-sm font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-sm">
                      <Upload className="w-4 h-4" />
                      {logoUploading ? 'Compression…' : 'Téléverser une Image…'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={logoUploading}
                        onChange={handleLogoUpload}
                      />
                    </label>

                    {formData.logo && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, logo: '' }));
                          setHasExistingLogo(false);
                        }}
                        className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 text-sm font-semibold rounded-md transition"
                      >
                        Effacer le logo
                      </button>
                    )}
                  </div>

                  <input
                    type="url"
                    placeholder="Ou coller une URL d'image (https://…)"
                    value={formData.logo?.startsWith('data:') ? '' : (formData.logo || '')}
                    onChange={(e) => {
                      setFormData({ ...formData, logo: e.target.value });
                      if (e.target.value) setHasExistingLogo(true);
                    }}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-700 transition"
                  />
                  {logoError && <p className="text-xs text-red-600">{logoError}</p>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom de l&apos;Entreprise</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-green-700 outline-none transition"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
                <textarea
                  name="description"
                  rows="3"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-green-700 outline-none transition resize-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gold-700 dark:text-gold-400 mb-1.5 flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-gold-500 text-gold-600" /> Catégorie Principale *
                </label>
                <select
                  name="primary_category"
                  value={formData.primary_category}
                  onChange={handleChange}
                  disabled={loadingCategories}
                  className="w-full px-4 py-2.5 bg-gold-500/10 dark:bg-gold-500/20 border border-gold-500/30 rounded-lg text-gray-900 dark:text-white font-semibold focus:ring-2 focus:ring-gold-500 outline-none transition"
                >
                  <option value="" disabled>-- Sélectionner --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.parent_name ? `${cat.parent_name} → ${cat.name}` : cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <SectorSpecificFields
                primaryCategory={formData.primary_category}
                categories={categories}
                attributes={formData.extra_attributes}
                onChange={(extra_attributes) => setFormData((prev) => ({ ...prev, extra_attributes }))}
              />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              Localisation & Contact
            </h2>
            <LocationSelector
              province={formData.province}
              commune={formData.commune}
              quartier={formData.quartier}
              latitude={formData.latitude}
              longitude={formData.longitude}
              address={formData.address}
              onChange={(loc) => setFormData((prev) => ({ ...prev, ...loc }))}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Phone className="w-4 h-4" /> Téléphone</label>
                <input name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Mail className="w-4 h-4" /> E-mail</label>
                <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Globe className="w-4 h-4" /> Site web officiel</label>
                <input
                  name="website"
                  type="url"
                  placeholder="https://www.exemple.com"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800"
                />
                <p className="text-xs text-gray-500 mt-1">Visible côté clients dans les informations de l&apos;entreprise.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {(sectorKey === 'wholesale' || sectorKey === 'retail_pharmacy' || sectorKey === 'hospital') && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 md:p-8">
          {sectorKey === 'wholesale' && <WholesaleOperationalSettings />}
          {sectorKey === 'retail_pharmacy' && <RetailOperationalSettings />}
          {sectorKey === 'hospital' && <HospitalOperationalSettings />}
        </div>
      )}
    </div>
  );
}
