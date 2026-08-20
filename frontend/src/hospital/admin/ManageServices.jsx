import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, Plus, CheckCircle, XCircle, Stethoscope, 
  Clock, Phone, DollarSign, ShieldAlert, Video, Calendar, 
  Package, Edit3, Trash2, Filter, Search, Sparkles 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManageServices() {
  const { token, authFetch } = useAuth();
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);

  const initialFormState = {
    category: 'GENERAL',
    name: '',
    description: '',
    head_doctor: '',
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
      const res = await fetch(`http://localhost:8000/api/v1/hospital/services/?hospital=${hid}`);
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
      const res = await fetch(`http://localhost:8000/api/v1/hospital/doctors/?hospital=${hid}`);
      if (res.ok) {
        setDoctors(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenModal = (service = null) => {
    if (service) {
      setEditingServiceId(service.id);
      setFormData({
        category: service.category || 'GENERAL',
        name: service.name || '',
        description: service.description || '',
        head_doctor: service.head_doctor || '',
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

  const handleSubmit = async (e) => {
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

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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

  const handleDelete = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce service ?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/services/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchServices(hospitalId);
    } catch (err) {
      console.error(err);
    }
  };

  // Filtrage des services
  const filteredServices = services.filter(s => {
    const matchesTab = activeTab === 'ALL' || s.category === activeTab;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'GENERAL':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Service Général</span>;
      case 'SPECIALIZED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">Service Spécialisé</span>;
      case 'CARE_PACKAGE':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1"><Package className="w-3 h-3"/> Paquet de Soins</span>;
      default:
        return null;
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
            Gestion des Services & Paquets de Soins
          </h1>
          <p className="text-teal-100 text-sm mt-1">Configurez les départements généraux, spécialités médicales et paquets de soins de votre établissement.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          disabled={!hospitalId}
          className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/30 transition cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-5 h-5" /> Ajouter un Service / Paquet
        </button>
      </div>

      {!hospitalId && !loading && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas encore configuré votre entreprise (Hôpital). Veuillez en créer une d'abord.
        </div>
      )}

      {/* Barre de Recherche et Onglets par Catégorie */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {[
            { key: 'ALL', label: 'Tous les Services' },
            { key: 'GENERAL', label: 'Services Généraux' },
            { key: 'SPECIALIZED', label: 'Services Spécialisés' },
            { key: 'CARE_PACKAGE', label: 'Paquets de Soins' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
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
                    <span>Responsable: <strong className="text-gray-900 dark:text-white">{s.head_doctor_name}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Horaires: <strong>{s.operating_hours || '24h/24, 7j/7'}</strong></span>
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

                {/* Badges Télé-expertise & RDV en ligne */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {s.telemedicine_available && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      <Video className="w-3 h-3" /> Téléconsultation / Diaspora
                    </span>
                  )}
                  {s.online_booking_available && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                      <Calendar className="w-3 h-3" /> RDV en Ligne
                    </span>
                  )}
                </div>
              </div>

              {/* Actions de modification et suppression */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button 
                  onClick={() => handleOpenModal(s)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-500" /> Modifier
                </button>
                <button 
                  onClick={() => handleDelete(s.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Création & Édition Enrichie */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <HeartPulse className="text-teal-600" />
                {editingServiceId ? 'Modifier le Service / Paquet' : 'Nouveau Service ou Paquet de Soins'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Catégorie de Prestation</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="GENERAL">Service Général (Urgences, Pédiatrie...)</option>
                    <option value="SPECIALIZED">Service Spécialisé (Cardiologie, Oncologie...)</option>
                    <option value="CARE_PACKAGE">Paquet de Soins (Pack Maternité, Bilan...)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nom du Service / Paquet *</label>
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
                        {d.user_details?.first_name} {d.user_details?.last_name} ({d.medical_license_number})
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

              {/* Switches d'options */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl space-y-2 border border-gray-200 dark:border-gray-700">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-indigo-500" /> Disponible pour la Téléconsultation / Diaspora
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
