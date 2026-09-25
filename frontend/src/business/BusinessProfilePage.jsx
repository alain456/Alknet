import React, { useState, useEffect } from 'react';
import {
  Building2, MapPin, Phone, Mail, Globe, ShieldCheck,
  HeartPulse, Activity, Award, Save,
  CheckCircle2, AlertCircle, PhoneCall, CreditCard, Sparkles,
  Plus, Trash2, Upload, Store, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBusinessCategoryKey } from '../auth/roleAccess';
import { readImageAsDataUrl } from '../shared/imageUpload';
import { normalizeWebsiteUrl } from '../shared/websiteUrl';

const emptyHospitalExtras = {
  category_type: 'Hôpital Général de Référence',
  approval_number: '',
  emergency_phone: '',
  has_ambulance: false,
  ambulance_phone: '',
  bed_capacity: 0,
  emergency_24_7: false,
  telemedicine_enabled: false,
  consultation_hours: '',
  facilities: [],
  insurances: [],
  custom_tariffs: [],
};

const emptyCommerceExtras = {
  shop_type: 'Boutique',
  opening_hours: 'Lun - Sam: 08h00 - 18h00',
  pickup_info: 'Retrait en magasin uniquement',
  nif_number: '',
};

export default function BusinessProfilePage() {
  const { token, authFetch, user } = useAuth();
  const categoryKey = getBusinessCategoryKey(user);
  const isHospital = categoryKey === 'hospital';
  const isCommerce = categoryKey === 'commerce';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [businessId, setBusinessId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    website: '',
    province: 'Bujumbura Mairie',
    commune: 'Mukaza',
    zone: '',
    quartier: '',
    avenue: '',
    latitude: '',
    longitude: '',
    proof_document: '',
    logo: '',
    lumicash_merchant_account: '',
    burundipay_merchant_account: '',
  });

  const [hospitalData, setHospitalData] = useState(emptyHospitalExtras);
  const [commerceData, setCommerceData] = useState(emptyCommerceExtras);
  const [rawExtras, setRawExtras] = useState({});
  const [newFacilityInput, setNewFacilityInput] = useState('');
  const [newInsuranceInput, setNewInsuranceInput] = useState('');
  const [hasExistingLogo, setHasExistingLogo] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');

  useEffect(() => {
    if (token) fetchBusinessProfile();
  }, [token]);

  const fetchBusinessProfile = async () => {
    try {
      const response = await authFetch('/api/v1/businesses/me/');
      if (!response.ok) throw new Error('Impossible de charger le profil');
      const data = await response.json();

      const b = Array.isArray(data) ? data[0] : data;
      if (b) {
        setBusinessId(b.id);
        setFormData({
          name: b.name || '',
          description: b.description || '',
          phone: b.phone || '',
          email: b.email || '',
          website: b.website || '',
          province: b.province || 'Bujumbura Mairie',
          commune: b.commune || 'Mukaza',
          zone: b.zone || '',
          quartier: b.quartier || '',
          avenue: b.avenue || '',
          latitude: b.latitude || '',
          longitude: b.longitude || '',
          proof_document: b.proof_document || '',
          logo: b.logo || '',
          lumicash_merchant_account: b.lumicash_merchant_account || b.burundipay_merchant_account || '',
          burundipay_merchant_account: b.burundipay_merchant_account || b.lumicash_merchant_account || '',
        });
        setHasExistingLogo(Boolean(b.has_logo || b.logo));

        const extras = b.extra_attributes && typeof b.extra_attributes === 'object'
          ? b.extra_attributes
          : {};
        setRawExtras(extras);

        if (isCommerce) {
          setCommerceData({
            ...emptyCommerceExtras,
            shop_type: extras.shop_type || emptyCommerceExtras.shop_type,
            opening_hours: extras.opening_hours || emptyCommerceExtras.opening_hours,
            pickup_info: extras.pickup_info || emptyCommerceExtras.pickup_info,
            nif_number: extras.nif_number || '',
          });
        } else {
          setHospitalData({
            ...emptyHospitalExtras,
            ...extras,
            facilities: Array.isArray(extras.facilities) ? extras.facilities : emptyHospitalExtras.facilities,
            insurances: Array.isArray(extras.insurances) ? extras.insurances : emptyHospitalExtras.insurances,
          });
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddFacility = (e) => {
    e.preventDefault();
    if (!newFacilityInput.trim()) return;
    const current = hospitalData.facilities || [];
    if (!current.includes(newFacilityInput.trim())) {
      setHospitalData({ ...hospitalData, facilities: [...current, newFacilityInput.trim()] });
    }
    setNewFacilityInput('');
  };

  const handleRemoveFacility = (facilityToRemove) => {
    setHospitalData({
      ...hospitalData,
      facilities: (hospitalData.facilities || []).filter((f) => f !== facilityToRemove),
    });
  };

  const handleAddInsurance = (e) => {
    e.preventDefault();
    if (!newInsuranceInput.trim()) return;
    const current = hospitalData.insurances || [];
    if (!current.includes(newInsuranceInput.trim())) {
      setHospitalData({ ...hospitalData, insurances: [...current, newInsuranceInput.trim()] });
    }
    setNewInsuranceInput('');
  };

  const handleRemoveInsurance = (insuranceToRemove) => {
    setHospitalData({
      ...hospitalData,
      insurances: (hospitalData.insurances || []).filter((i) => i !== insuranceToRemove),
    });
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
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        ...formData,
        website: normalizeWebsiteUrl(formData.website),
        extra_attributes: isCommerce
          ? {
              ...rawExtras,
              ...commerceData,
              // Ne pas réinjecter les champs santé par erreur
              facilities: undefined,
              insurances: undefined,
              bed_capacity: undefined,
              emergency_phone: undefined,
              has_ambulance: undefined,
              ambulance_phone: undefined,
              category_type: undefined,
              approval_number: undefined,
            }
          : hospitalData,
      };
      // Nettoyer les undefined du JSON
      if (isCommerce && payload.extra_attributes) {
        Object.keys(payload.extra_attributes).forEach((k) => {
          if (payload.extra_attributes[k] === undefined) delete payload.extra_attributes[k];
        });
      }
      if (!payload.logo && hasExistingLogo) {
        delete payload.logo;
      }
      delete payload.cover_image;

      const response = await authFetch('/api/v1/businesses/me/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Erreur lors de la mise à jour du profil');
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' });
      await fetchBusinessProfile();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const logoBlock = (
    <div className="md:col-span-2 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
      <label className="block text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Upload className="w-4 h-4 text-primary" />
        {isCommerce ? 'Logo / photo de la boutique' : "Photo / logo de l'établissement"}
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-20 h-20 rounded-xl bg-white dark:bg-gray-900 border overflow-hidden flex items-center justify-center">
          {formData.logo ? (
            <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-8 h-8 text-gray-400" />
          )}
        </div>
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold cursor-pointer">
            <Upload className="w-4 h-4" />
            {logoUploading ? 'Compression…' : 'Téléverser une photo'}
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
          </label>
          {formData.logo && (
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({ ...prev, logo: '' }));
                setHasExistingLogo(false);
              }}
              className="block text-sm text-red-600 font-medium"
            >
              Retirer la photo
            </button>
          )}
          <p className="text-xs text-gray-500">JPG/PNG/WebP, max 5 Mo — compressée automatiquement.</p>
          {logoError && <p className="text-xs text-red-600">{logoError}</p>}
        </div>
      </div>
    </div>
  );

  /* ——— COMMERCE ——— */
  if (isCommerce) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 pb-16">
        <div className="relative rounded-3xl bg-gradient-to-r from-slate-800 via-slate-900 to-emerald-950 p-8 text-white shadow-xl overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center overflow-hidden">
                {formData.logo ? (
                  <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-10 h-10 text-emerald-300" />
                )}
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 mb-2">
                  <Sparkles className="w-3.5 h-3.5" /> Boutique Commerce
                </div>
                <h1 className="text-3xl font-extrabold">{formData.name || 'Profil boutique'}</h1>
                <p className="text-slate-300 text-sm mt-1">
                  Informations de votre magasin, horaires et modalités de retrait.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 pb-3">
              <Store className="w-5 h-5 text-primary" />
              1. Identité de la boutique
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {logoBlock}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la boutique</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="ex: Mode Express Bujumbura"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de commerce</label>
                <select
                  value={commerceData.shop_type}
                  onChange={(e) => setCommerceData({ ...commerceData, shop_type: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Boutique">Boutique</option>
                  <option value="Mode & Textile">Mode & Textile</option>
                  <option value="Quincaillerie">Quincaillerie</option>
                  <option value="Électronique">Électronique</option>
                  <option value="Supermarché">Supermarché / Épicerie</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIF (si renseigné)</label>
                <input
                  type="text"
                  value={commerceData.nif_number}
                  onChange={(e) => setCommerceData({ ...commerceData, nif_number: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Numéro d'identification fiscale"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Présentez votre boutique, vos produits phares…"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 pb-3">
              <Phone className="w-5 h-5 text-primary" />
              2. Contacts & paiement
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+257 …"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="contact@boutique.bi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Site web officiel</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://www.exemple.com"
                />
                <p className="text-xs text-gray-500 mt-1">Visible côté clients dans les informations de l&apos;entreprise.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Compte marchand BurundiPay</label>
                <input
                  type="text"
                  value={formData.burundipay_merchant_account || formData.lumicash_merchant_account}
                  onChange={(e) => setFormData({
                    ...formData,
                    burundipay_merchant_account: e.target.value,
                    lumicash_merchant_account: e.target.value,
                  })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Compte pour encaisser les commandes"
                />
                <p className="text-xs text-gray-500 mt-1">Paiement des commandes boutique — distinct de l&apos;abonnement Isoko Hub.</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 pb-3">
              <MapPin className="w-5 h-5 text-primary" />
              3. Adresse du magasin
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                <input
                  type="text"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commune</label>
                <input
                  type="text"
                  value={formData.commune}
                  onChange={(e) => setFormData({ ...formData, commune: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                <input
                  type="text"
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quartier</label>
                <input
                  type="text"
                  value={formData.quartier}
                  onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Avenue / rue</label>
                <input
                  type="text"
                  value={formData.avenue}
                  onChange={(e) => setFormData({ ...formData, avenue: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 pb-3">
              <Clock className="w-5 h-5 text-primary" />
              4. Horaires & retrait
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horaires d&apos;ouverture</label>
                <input
                  type="text"
                  value={commerceData.opening_hours}
                  onChange={(e) => setCommerceData({ ...commerceData, opening_hours: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Lun - Sam: 08h00 - 18h00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modalités de retrait</label>
                <textarea
                  rows={2}
                  value={commerceData.pickup_info}
                  onChange={(e) => setCommerceData({ ...commerceData, pickup_info: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: Présenter la référence de commande à l'accueil"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-8 py-3.5 rounded-xl font-bold shadow-lg transition disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Enregistrement…' : 'Enregistrer le profil boutique'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* ——— HÔPITAL / SANTÉ (et fallback générique métier santé) ——— */
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      <div className="relative rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-8 text-white shadow-xl overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner overflow-hidden">
              {formData.logo ? (
                <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <HeartPulse className="w-10 h-10 text-emerald-400 animate-pulse" />
              )}
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 mb-2">
                <Sparkles className="w-3.5 h-3.5" /> Établissement de Santé
              </div>
              <h1 className="text-3xl font-extrabold">{formData.name || "Profil de l'Hôpital"}</h1>
              <p className="text-blue-200 text-sm mt-1">
                Gérez les équipements, les assurances acceptées et les informations de votre établissement.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Enregistrement...' : 'Enregistrer le Profil'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 border ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
        }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <Building2 className="w-5 h-5 text-primary" />
            1. Identification & Agrément Ministériel
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {logoBlock}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom de l&apos;Établissement</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="ex: Hôpital Général de Référence"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Niveau / Catégorie d&apos;Hôpital</label>
              <select
                value={hospitalData.category_type}
                onChange={(e) => setHospitalData({ ...hospitalData, category_type: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="Hôpital National de Référence">Hôpital National de Référence (CHUK, etc.)</option>
                <option value="Hôpital Provincial / Régional">Hôpital Provincial / Régional</option>
                <option value="Hôpital de District">Hôpital de District</option>
                <option value="Centre Médical Spécialisé">Centre Médical Spécialisé / Clinique Privée</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Numéro d&apos;Agrément Sanitaire</label>
              <input
                type="text"
                value={hospitalData.approval_number}
                onChange={(e) => setHospitalData({ ...hospitalData, approval_number: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="ex: MSPLS/AGR/2024/089"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lien Document Justificatif / Agrément (URL)</label>
              <input
                type="url"
                value={formData.proof_document}
                onChange={(e) => setFormData({ ...formData, proof_document: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Présentation & Description de l&apos;Hôpital</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="Présentez les missions de votre établissement, la qualité de vos soins et votre équipe médicale..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 text-red-600 dark:text-red-400">
            <PhoneCall className="w-5 h-5 text-red-600 dark:text-red-400" />
            2. Urgences 24h/24 & Contacts Directs
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/50">
              <label className="block text-sm font-bold text-red-900 dark:text-red-300 mb-1">Ligne Directe des Urgences (Ligne Rouge 24/7)</label>
              <input
                type="text"
                value={hospitalData.emergency_phone}
                onChange={(e) => setHospitalData({ ...hospitalData, emergency_phone: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 font-bold focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="+257 22 XX XX XX / 79 XX XX XX"
              />
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <label className="block text-sm font-bold text-blue-900 dark:text-blue-300 mb-1">Service d&apos;Ambulance & Numéro d&apos;Appel</label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="checkbox"
                  id="has_ambulance"
                  checked={hospitalData.has_ambulance}
                  onChange={(e) => setHospitalData({ ...hospitalData, has_ambulance: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="has_ambulance" className="text-sm font-medium text-blue-900 dark:text-blue-300 cursor-pointer">
                  Ambulance disponible 24/7
                </label>
              </div>
              {hospitalData.has_ambulance && (
                <input
                  type="text"
                  value={hospitalData.ambulance_phone}
                  onChange={(e) => setHospitalData({ ...hospitalData, ambulance_phone: e.target.value })}
                  className="w-full mt-3 px-4 py-2 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-900 dark:text-blue-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Numéro direct ambulance"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Téléphone Secrétariat / Général</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="+257 22..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compte marchand BurundiPay (consultations)</label>
              <input
                type="text"
                value={formData.burundipay_merchant_account || formData.lumicash_merchant_account}
                onChange={(e) => setFormData({
                  ...formData,
                  burundipay_merchant_account: e.target.value,
                  lumicash_merchant_account: e.target.value,
                })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="Ex. HOSP-BAHO-LC"
              />
              <p className="text-xs text-gray-500 mt-1">Encaissement des consultations (tarif médecin) — distinct de l&apos;abonnement Isoko Hub.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail Officiel de l&apos;Hôpital</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="contact@hopital.bi"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              3. Plateau Technique & Équipements
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFacilityInput}
                onChange={(e) => setNewFacilityInput(e.target.value)}
                placeholder="Nouvel équipement / service..."
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddFacility}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacité Totale en Lits d&apos;Hospitalisation</label>
              <input
                type="number"
                value={hospitalData.bed_capacity}
                onChange={(e) => setHospitalData({ ...hospitalData, bed_capacity: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Équipements & Services Actifs ({hospitalData.facilities?.length || 0}) :
            </label>
            <div className="flex flex-wrap gap-2">
              {(hospitalData.facilities || []).map((facility) => (
                <span
                  key={facility}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                  {facility}
                  <button
                    type="button"
                    onClick={() => handleRemoveFacility(facility)}
                    className="text-indigo-400 hover:text-red-500 transition cursor-pointer ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-500" />
              4. Assurances Maladie & Mutuelles Acceptées
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newInsuranceInput}
                onChange={(e) => setNewInsuranceInput(e.target.value)}
                placeholder="Nouvelle assurance..."
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddInsurance}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {(hospitalData.insurances || []).map((insurance) => (
              <span
                key={insurance}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                {insurance}
                <button
                  type="button"
                  onClick={() => handleRemoveInsurance(insurance)}
                  className="text-emerald-400 hover:text-red-500 transition cursor-pointer ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-primary/30 transition cursor-pointer text-base disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Enregistrement en cours...' : 'Enregistrer Toutes les Modifications'}
          </button>
        </div>
      </form>
    </div>
  );
}
