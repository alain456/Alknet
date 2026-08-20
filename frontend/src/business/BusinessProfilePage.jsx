import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, MapPin, Phone, Mail, Globe, ShieldCheck, 
  FileText, HeartPulse, Clock, Activity, Award, Save, 
  CheckCircle2, AlertCircle, PhoneCall, Truck, CreditCard, Sparkles,
  Plus, Trash2, Tag, DollarSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BusinessProfilePage() {
  const { token, logout, authFetch } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [businessId, setBusinessId] = useState(null);

  // Core Business Fields
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
    cover_image: ''
  });

  // Dynamic Hospital Attributes
  const [hospitalData, setHospitalData] = useState({
    category_type: 'Hôpital Général de Référence',
    approval_number: '',
    emergency_phone: '',
    has_ambulance: true,
    ambulance_phone: '',
    bed_capacity: 100,
    emergency_24_7: true,
    telemedicine_enabled: true,
    consultation_hours: 'Lun - Ven: 08h00 - 17h00 (Urgences 24h/24)',
    facilities: [
      'Scanner CT / IRM',
      'Bloc Opératoire',
      'Soins Intensifs / Réanimation',
      'Laboratoire d\'Analyses 24/7',
      'Radiologie & Échographie 4D',
      'Banque de Sang de Référence',
      'Maternité & Néonatologie'
    ],
    insurances: ['MFP', 'CAM', 'INSS', 'Ascoma', 'BICOR', 'SOCABAR'],
    custom_tariffs: [
      { name: 'Consultation Généraliste', price: 15000 },
      { name: 'Consultation Spécialiste', price: 30000 },
      { name: 'Lit d\'Hospitalisation (Nuitée)', price: 25000 },
      { name: 'Échographie Abdominale', price: 35000 }
    ]
  });

  // Dynamic Inputs for CRUD
  const [newFacilityInput, setNewFacilityInput] = useState('');
  const [newInsuranceInput, setNewInsuranceInput] = useState('');
  const [newTariffName, setNewTariffName] = useState('');
  const [newTariffPrice, setNewTariffPrice] = useState('');

  useEffect(() => {
    if (token) fetchBusinessProfile();
  }, [token]);

  const fetchBusinessProfile = async () => {
    try {
      const response = await authFetch('http://localhost:8000/api/v1/businesses/me/');
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
          cover_image: b.cover_image || ''
        });

        if (b.extra_attributes) {
          setHospitalData(prev => ({
            ...prev,
            ...b.extra_attributes
          }));
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // CRUD Équipements
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
    const current = hospitalData.facilities || [];
    setHospitalData({ ...hospitalData, facilities: current.filter(f => f !== facilityToRemove) });
  };

  // CRUD Assurances
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
    const current = hospitalData.insurances || [];
    setHospitalData({ ...hospitalData, insurances: current.filter(i => i !== insuranceToRemove) });
  };

  // CRUD Tarifs Personnalisés
  const handleAddTariff = (e) => {
    e.preventDefault();
    if (!newTariffName.trim() || !newTariffPrice) return;
    const current = hospitalData.custom_tariffs || [];
    const newItem = { name: newTariffName.trim(), price: parseFloat(newTariffPrice) || 0 };
    setHospitalData({ ...hospitalData, custom_tariffs: [...current, newItem] });
    setNewTariffName('');
    setNewTariffPrice('');
  };

  const handleRemoveTariff = (indexToRemove) => {
    const current = hospitalData.custom_tariffs || [];
    setHospitalData({ ...hospitalData, custom_tariffs: current.filter((_, idx) => idx !== indexToRemove) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        ...formData,
        extra_attributes: hospitalData
      };

      const response = await authFetch(`http://localhost:8000/api/v1/businesses/me/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Erreur lors de la mise à jour du profil');
      setMessage({ type: 'success', text: 'Profil de l\'Hôpital mis à jour avec succès !' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-8 text-white shadow-xl overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <HeartPulse className="w-10 h-10 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 mb-2">
                <Sparkles className="w-3.5 h-3.5" /> Établissement de Santé Dynamique
              </div>
              <h1 className="text-3xl font-extrabold">{formData.name || 'Profil de l\'Hôpital'}</h1>
              <p className="text-blue-200 text-sm mt-1">Gérez en direct les équipements, les assurances acceptées et la grille tarifaire de votre hôpital.</p>
            </div>
          </div>
          <button
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
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Identification & Agrément */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <Building2 className="w-5 h-5 text-primary" />
            1. Identification & Agrément Ministériel
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom de l'Établissement</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="ex: Hôpital Général de Référence"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Niveau / Catégorie d'Hôpital</label>
              <select 
                value={hospitalData.category_type}
                onChange={e => setHospitalData({ ...hospitalData, category_type: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="Hôpital National de Référence">Hôpital National de Référence (CHUK, etc.)</option>
                <option value="Hôpital Provincial / Régional">Hôpital Provincial / Régional</option>
                <option value="Hôpital de District">Hôpital de District</option>
                <option value="Centre Médical Spécialisé">Centre Médical Spécialisé / Clinique Privée</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Numéro d'Agrément Sanitaire</label>
              <input 
                type="text" 
                value={hospitalData.approval_number}
                onChange={e => setHospitalData({ ...hospitalData, approval_number: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="ex: MSPLS/AGR/2024/089"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lien Document Justificatif / Agrément (URL)</label>
              <input 
                type="url" 
                value={formData.proof_document}
                onChange={e => setFormData({ ...formData, proof_document: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Présentation & Description de l'Hôpital</label>
              <textarea 
                rows={3}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="Présentez les missions de votre établissement, la qualité de vos soins et votre équipe médicale..."
              />
            </div>
          </div>
        </div>

        {/* Section 2: Ligne Rouge Urgences 24/7 & Contacts */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 text-red-600 dark:text-red-400">
            <PhoneCall className="w-5 h-5 text-red-600 dark:text-red-400" />
            2. Urgences 24h/24 & Contacts Directs
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/50">
              <label className="block text-sm font-bold text-red-900 dark:text-red-300 mb-1">🚨 Ligne Directe des Urgences (Ligne Rouge 24/7)</label>
              <input 
                type="text" 
                value={hospitalData.emergency_phone}
                onChange={e => setHospitalData({ ...hospitalData, emergency_phone: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 font-bold focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="+257 22 XX XX XX / 79 XX XX XX"
              />
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <label className="block text-sm font-bold text-blue-900 dark:text-blue-300 mb-1">🚑 Service d'Ambulance & Numéro d'Appel</label>
              <div className="flex items-center gap-3 mt-2">
                <input 
                  type="checkbox"
                  id="has_ambulance"
                  checked={hospitalData.has_ambulance}
                  onChange={e => setHospitalData({ ...hospitalData, has_ambulance: e.target.checked })}
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
                  onChange={e => setHospitalData({ ...hospitalData, ambulance_phone: e.target.value })}
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
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="+257 22..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail Officiel de l'Hôpital</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="contact@hopital.bi"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Plateau Technique & Équipements (CRUD DYNAMIQUE) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              3. Plateau Technique & Équipements (Gestion Dynamique)
            </h2>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={newFacilityInput}
                onChange={e => setNewFacilityInput(e.target.value)}
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacité Totale en Lits d'Hospitalisation</label>
              <input 
                type="number" 
                value={hospitalData.bed_capacity}
                onChange={e => setHospitalData({ ...hospitalData, bed_capacity: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={hospitalData.telemedicine_enabled}
                  onChange={e => setHospitalData({ ...hospitalData, telemedicine_enabled: e.target.checked })}
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  🌐 Pont Téléconsultation & Diaspora Activé
                </span>
              </label>
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

        {/* Section 4: Assurances Maladie & Mutuelles (CRUD DYNAMIQUE) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-500" />
              4. Assurances Maladie & Mutuelles Acceptées (Gestion Dynamique)
            </h2>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={newInsuranceInput}
                onChange={e => setNewInsuranceInput(e.target.value)}
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

        {/* Section 5: Grille Tarifaire Dynamique (CRUD DYNAMIQUE TARIFS) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-500" />
              5. Grille Tarifaire & Services Médicaux (CRUD Dynamique)
            </h2>
          </div>

          <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/50 space-y-3">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">Ajouter un acte / tarif à la grille</h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                value={newTariffName}
                onChange={e => setNewTariffName(e.target.value)}
                placeholder="Désignation de l'acte (ex: Échographie, Consultation Spécialiste...)"
                className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
              <input 
                type="number" 
                value={newTariffPrice}
                onChange={e => setNewTariffPrice(e.target.value)}
                placeholder="Prix (BIF)"
                className="w-full sm:w-36 px-4 py-2 bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button 
                type="button"
                onClick={handleAddTariff}
                className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Ajouter au Tarif
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Acte / Prestation Médicale</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Tarif Indicatif (BIF)</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(hospitalData.custom_tariffs || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-sm">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-amber-600 dark:text-amber-400 font-bold text-sm">
                      {item.price ? item.price.toLocaleString() : 0} BIF
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        type="button"
                        onClick={() => handleRemoveTariff(idx)}
                        className="text-red-400 hover:text-red-600 transition cursor-pointer p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
