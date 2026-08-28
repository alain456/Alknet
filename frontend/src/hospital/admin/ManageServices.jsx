import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, Plus, CheckCircle, XCircle, Stethoscope, 
  Clock, Phone, DollarSign, ShieldAlert, Video, Calendar, 
  Package, Edit3, Trash2, Filter, Search, Sparkles, FolderPlus, Tag, Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_CATEGORIES = [
  { value: 'GENERAL', label: 'Service Général' },
  { value: 'SPECIALIZED', label: 'Service Spécialisé' },
  { value: 'CARE_PACKAGE', label: 'Paquet de Soins' },
  { value: 'DIAGNOSTIC', label: 'Diagnostic & Imagerie' },
  { value: 'SURGICAL', label: 'Chirurgie & Bloc' },
  { value: 'EMERGENCY', label: 'Urgences 24/7' },
  { value: 'MATERNITY', label: 'Maternité & Gynécologie' },
  { value: 'PEDIATRIC', label: 'Pédiatrie' },
  { value: 'PHARMACY', label: 'Pharmacie Hospitalière' },
  { value: 'TELEMEDICINE', label: 'Télémédecine' },
  { value: 'REHABILITATION', label: 'Rééducation & Kinésithérapie' },
];

export default function ManageServices() {
  const { token, authFetch } = useAuth();
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Service Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);

  // Category Management Modal State (CRUD)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [catError, setCatError] = useState(null);

  const initialFormState = {
    category: 'GENERAL',
    name: '',
    description: '',
    head_doctor: '',
    assigned_doctor_ids: [],
    contact_phone: '',
    operating_hours: '24h/24, 7j/7',
    indicative_cost: 0,
    access_conditions: 'Sur Rendez-vous',
    telemedicine_available: false,
    online_booking_available: true,
    is_active: true
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (token) initHospitalData();
  }, [token]);

  const initHospitalData = async () => {
    try {
      const busRes = await authFetch('http://localhost:8000/api/v1/businesses/me/');
      if (busRes.ok) {
        const businesses = await busRes.json();
        if (businesses.length > 0) {
          const hid = businesses[0].id;
          setHospitalId(hid);
          fetchServices(hid);
          fetchDoctors(hid);
          fetchCategories(hid);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchServices = async (hid) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/services/?hospital=${hid}`);
      if (res.ok) {
        setServices(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async (hid) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/doctors/?hospital=${hid}&is_active=true`);
      if (res.ok) {
        const data = await res.json();
        // Filtrer les utilisateurs inactifs ou supprimés
        const activeDoctors = data.filter(d => d.is_active !== false && d.user_details?.is_active !== false);
        setDoctors(activeDoctors);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async (hid) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/service-categories/?hospital=${hid}`);
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- CRUD CATÉGORIES DE PRESTATIONS ---
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setCatError(null);
    if (!newCatName.trim()) return;

    try {
      const url = editingCatId 
        ? `http://localhost:8000/api/v1/hospital/service-categories/${editingCatId}/`
        : 'http://localhost:8000/api/v1/hospital/service-categories/';
      const method = editingCatId ? 'PATCH' : 'POST';

      const payload = {
        hospital: hospitalId,
        name: newCatName.trim(),
        description: newCatDesc.trim()
      };

      const res = await authFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setNewCatName('');
        setNewCatDesc('');
        setEditingCatId(null);
        fetchCategories(hospitalId);
      } else {
        const errData = await res.json();
        setCatError(errData.name || errData.detail || 'Erreur lors de l\'enregistrement de la catégorie');
      }
    } catch (err) {
      setCatError(err.message);
    }
  };

  const handleEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setNewCatName(cat.name);
    setNewCatDesc(cat.description || '');
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette catégorie de prestation ?")) return;
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/service-categories/${catId}/`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchCategories(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- SERVICE MODAL ---
  const handleOpenModal = (service = null) => {
    if (service) {
      setEditingServiceId(service.id);
      setFormData({
        category: service.category || 'GENERAL',
        name: service.name || '',
        description: service.description || '',
        head_doctor: service.head_doctor || '',
        assigned_doctor_ids: service.assigned_doctors_details ? service.assigned_doctors_details.map(d => d.id) : [],
        contact_phone: service.contact_phone || '',
        operating_hours: service.operating_hours || '24h/24, 7j/7',
        indicative_cost: service.indicative_cost || 0,
        access_conditions: service.access_conditions || 'Sur Rendez-vous',
        telemedicine_available: !!service.telemedicine_available,
        online_booking_available: !!service.online_booking_available,
        is_active: !!service.is_active
      });
    } else {
      setEditingServiceId(null);
      setFormData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const handleSubmitService = async (e) => {
    e.preventDefault();
    try {
      const url = editingServiceId 
        ? `http://localhost:8000/api/v1/hospital/services/${editingServiceId}/`
        : 'http://localhost:8000/api/v1/hospital/services/';

      const method = editingServiceId ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        hospital: hospitalId,
        head_doctor: formData.head_doctor || null
      };

      const res = await authFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormData(initialFormState);
        fetchServices(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce service ?")) return;
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/services/${id}/`, {
        method: 'DELETE'
      });
      if (res.ok) fetchServices(hospitalId);
    } catch (err) {
      console.error(err);
    }
  };

  // Liste globale de toutes les catégories disponibles (Standards + Hôpital)
  const allCategoryOptions = [
    ...DEFAULT_CATEGORIES,
    ...categories.map(c => ({ value: c.name, label: c.name }))
  ];

  // Filtrage des services
  const filteredServices = services.filter(s => {
    const matchesTab = activeTab === 'ALL' || s.category === activeTab;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const getCategoryBadge = (category) => {
    const match = allCategoryOptions.find(c => c.value === category);
    const label = match ? match.label : category;

    switch (category) {
      case 'GENERAL':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">{label}</span>;
      case 'SPECIALIZED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">{label}</span>;
      case 'CARE_PACKAGE':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1"><Package className="w-3 h-3"/> {label}</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 flex items-center gap-1"><Tag className="w-3 h-3"/> {label}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* En-tête de la page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Module 01.2 — Référentiel des Prestations
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HeartPulse className="text-teal-400" />
            Gestion des Services & Catégories de Prestation
          </h1>
          <p className="text-teal-100 text-sm mt-1">Configurez vos catégories de prestation sur-mesure, vos services médicaux et paquets de soins.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCategoryModalOpen(true)}
            disabled={!hospitalId}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2.5 rounded-xl font-bold transition cursor-pointer disabled:opacity-50 text-xs"
          >
            <FolderPlus className="w-4 h-4 text-teal-400" /> Gérer les Catégories ({categories.length})
          </button>
          
          <button 
            onClick={() => handleOpenModal()}
            disabled={!hospitalId}
            className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/30 transition cursor-pointer disabled:opacity-50 text-xs"
          >
            <Plus className="w-4 h-4" /> Nouveau Service
          </button>
        </div>
      </div>

      {!hospitalId && !loading && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas encore configuré votre entreprise (Hôpital). Veuillez en créer une d'abord.
        </div>
      )}

      {/* Barre de Recherche et Onglets de Catégorie Dynamiques */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            Tous ({services.length})
          </button>

          {allCategoryOptions.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveTab(cat.value)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === cat.value
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un service..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Grille de Cartes des Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">Chargement des services...</div>
        ) : filteredServices.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
            Aucun service trouvé dans cette catégorie.
          </div>
        ) : (
          filteredServices.map(s => (
            <div 
              key={s.id} 
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  {getCategoryBadge(s.category)}
                  <span className={`flex items-center gap-1 text-xs font-semibold ${s.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {s.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {s.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{s.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{s.description || 'Aucune description disponible.'}</p>
                </div>

                <div className="space-y-1.5 pt-2 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                    <span>Chef de Service: <strong className="text-gray-900 dark:text-white">{s.head_doctor_name || 'Non attribué'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Horaires: <strong>{typeof s.operating_hours === 'object' ? 'Voir détails' : (s.operating_hours || '24h/24, 7j/7')}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                    <span>Contact: <strong>{s.contact_phone || 'Non renseigné'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Tarif Indicatif: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{parseFloat(s.indicative_cost || 0).toLocaleString()} BIF</strong></span>
                  </div>
                </div>

                {/* Équipe Médicale Rattachée */}
                {s.assigned_doctors_details && s.assigned_doctors_details.length > 0 && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Stethoscope className="w-3 h-3 text-teal-500" /> Équipe Rattachée ({s.assigned_doctors_details.length}) :
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.assigned_doctors_details.map(doc => (
                        <span key={doc.id} className="px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-100 dark:border-teal-800">
                          {doc.full_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions de carte */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button 
                  onClick={() => handleOpenModal(s)}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition cursor-pointer"
                  title="Éditer le service"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteService(s.id)}
                  className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- MODAL 1 : CRUD CATÉGORIES DE PRESTATION --- */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="text-teal-600" />
                Gestion des Catégories de Prestation Hospitalière
              </h3>
              <button onClick={() => { setIsCategoryModalOpen(false); setEditingCatId(null); setNewCatName(''); setNewCatDesc(''); }} className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl font-bold">&times;</button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              {/* Formulaire d'ajout / modification de catégorie */}
              <form onSubmit={handleSaveCategory} className="bg-teal-50/40 dark:bg-teal-950/30 p-4 rounded-2xl border border-teal-100 dark:border-teal-800/60 space-y-3">
                <h4 className="text-xs font-bold text-teal-900 dark:text-teal-200">
                  {editingCatId ? 'Modifier la Catégorie' : 'Créer une Nouvelle Catégorie de Prestation'}
                </h4>

                {catError && (
                  <p className="text-xs text-rose-600 font-semibold">{catError}</p>
                )}

                <div>
                  <input 
                    type="text" 
                    required
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="Nom de la catégorie (ex: Consultation Spécialisée, Bilans Santé...)"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <input 
                    type="text" 
                    value={newCatDesc}
                    onChange={e => setNewCatDesc(e.target.value)}
                    placeholder="Description optionnelle..."
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {editingCatId && (
                    <button 
                      type="button" 
                      onClick={() => { setEditingCatId(null); setNewCatName(''); setNewCatDesc(''); }} 
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-xl"
                    >
                      Annuler
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer"
                  >
                    {editingCatId ? 'Mettre à jour' : 'Ajouter la catégorie'}
                  </button>
                </div>
              </form>

              {/* Liste des catégories personnalisées existantes */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                  Catégories Créées pour cet Hôpital ({categories.length})
                </h4>

                {categories.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Aucune catégorie sur-mesure créée. Vous pouvez utiliser les catégories standards ci-dessus.</p>
                ) : (
                  <div className="space-y-2">
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{cat.name}</p>
                          {cat.description && <p className="text-[11px] text-gray-400">{cat.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleEditCategory(cat)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                            title="Éditer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2 : CRÉATION / ÉDITION DE SERVICE --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <HeartPulse className="text-teal-600" />
                {editingServiceId ? 'Éditer la Prestation Médicale' : 'Créer une Nouvelle Prestation / Paquet de Soins'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmitService} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Catégorie de Prestation (Liste combinée standard + catégories hôpital) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1">Catégorie de Prestation *</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {allCategoryOptions.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nom du Service / Paquet de Soins *</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ex: Cardiologie Interventionnelle"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Chef de Service / Responsable</label>
                  <select 
                    value={formData.head_doctor}
                    onChange={e => setFormData({ ...formData, head_doctor: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">-- Non attribué --</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.user_details?.first_name || 'Médecin'} {d.user_details?.last_name || ''} ({d.medical_license_number || 'Matricule N/A'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Téléphone Direct du Service</label>
                  <input 
                    type="text" 
                    value={formData.contact_phone}
                    onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="ex: +257 22 22 00 11"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Horaires de Fonctionnement</label>
                  <input 
                    type="text" 
                    value={formData.operating_hours}
                    onChange={e => setFormData({ ...formData, operating_hours: e.target.value })}
                    placeholder="ex: 24h/24, 7j/7"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Tarif Indicatif / Base (BIF)</label>
                  <input 
                    type="number" 
                    value={formData.indicative_cost}
                    onChange={e => setFormData({ ...formData, indicative_cost: parseFloat(e.target.value) || 0 })}
                    placeholder="30000"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Conditions d'Accès</label>
                  <input 
                    type="text" 
                    value={formData.access_conditions}
                    onChange={e => setFormData({ ...formData, access_conditions: e.target.value })}
                    placeholder="ex: Sur rendez-vous / Entrée libre aux urgences"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Description Détaillée du Service</label>
                <textarea 
                  rows={3} 
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Décrivez les actes médicaux, équipements et spécialités rattachés..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                ></textarea>
              </div>

              {/* Multi-sélection de l'Équipe Médicale rattachée */}
              <div>
                <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                  Groupe de Médecins Rattachés ({formData.assigned_doctor_ids.length} sélectionné(s))
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl p-3 bg-gray-50/50 dark:bg-gray-800/40">
                  {doctors.length === 0 ? (
                    <p className="text-xs text-gray-400 col-span-full italic">Aucun médecin actif disponible.</p>
                  ) : (
                    doctors.map(d => {
                      const docName = `${d.user_details?.first_name || ''} ${d.user_details?.last_name || ''}`;
                      const isSelected = formData.assigned_doctor_ids.includes(d.id);
                      return (
                        <label key={d.id} className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer p-1 hover:bg-teal-50/50 dark:hover:bg-gray-800 rounded-lg">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => {
                              if (e.target.checked) {
                                setFormData({ ...formData, assigned_doctor_ids: [...formData.assigned_doctor_ids, d.id] });
                              } else {
                                setFormData({ ...formData, assigned_doctor_ids: formData.assigned_doctor_ids.filter(id => id !== d.id) });
                              }
                            }}
                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                          />
                          <span className="truncate">{docName} <span className="text-[10px] text-gray-400 font-normal">({d.staff_category_display || 'Médecin'})</span></span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Options du service */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl space-y-2 border border-gray-200 dark:border-gray-700">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-indigo-500" /> Disponible pour la Téléconsultation
                  </span>
                  <input 
                    type="checkbox"
                    checked={formData.telemedicine_available}
                    onChange={e => setFormData({ ...formData, telemedicine_available: e.target.checked })}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-teal-500" /> Réservation de RDV en Ligne
                  </span>
                  <input 
                    type="checkbox"
                    checked={formData.online_booking_available}
                    onChange={e => setFormData({ ...formData, online_booking_available: e.target.checked })}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> Service Actif
                  </span>
                  <input 
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/30 transition cursor-pointer"
                >
                  {editingServiceId ? 'Enregistrer les modifications' : 'Créer le service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
