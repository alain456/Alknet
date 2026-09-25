import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, Plus, Tag, Edit3, Trash2, Search, Sparkles, 
  Layers, CheckCircle, HeartPulse, Info, ShieldCheck, Activity
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManageServiceCategories() {
  const { token, authFetch } = useAuth();
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (token) initHospitalData();
  }, [token]);

  const initHospitalData = async () => {
    try {
      const busRes = await authFetch('/api/v1/businesses/me/');
      if (busRes.ok) {
        const businesses = await busRes.json();
        if (businesses.length > 0) {
          const hid = businesses[0].id;
          setHospitalId(hid);
          fetchCategories(hid);
          fetchServices(hid);
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

  const fetchCategories = async (hid) => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/v1/hospital/service-categories/?hospital=${hid}`);
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async (hid) => {
    try {
      const res = await authFetch(`/api/v1/hospital/services/?hospital=${hid}`);
      if (res.ok) {
        setServices(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenModal = (category = null) => {
    setErrorMessage('');
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name || '',
        description: category.description || ''
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!formData.name.trim()) {
      setErrorMessage('Le nom de la catégorie est obligatoire.');
      return;
    }

    try {
      const url = editingCategory
        ? `/api/v1/hospital/service-categories/${editingCategory.id}/`
        : '/api/v1/hospital/service-categories/';
      
      const method = editingCategory ? 'PATCH' : 'POST';

      const payload = {
        hospital: hospitalId,
        name: formData.name.trim(),
        description: formData.description.trim()
      };

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ name: '', description: '' });
        fetchCategories(hospitalId);
      } else {
        const data = await res.json();
        setErrorMessage(data.name ? data.name[0] : (data.detail || 'Erreur lors de l\'enregistrement.'));
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette catégorie de prestation ?")) return;
    try {
      const res = await authFetch(`/api/v1/hospital/service-categories/${id}/`, {
        method: 'DELETE'
      });
      if (res.ok) fetchCategories(hospitalId);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* En-tête de la page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-linear-to-r from-teal-900 via-slate-900 to-teal-950 p-6 rounded-2xl text-white shadow-xl ih-frame-dark">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Module 01.2 — Structure des Prestations
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderPlus className="text-teal-400" />
            Gestion des Catégories de Prestation
          </h1>
          <p className="text-teal-100 text-sm mt-1">Créez et organisez les catégories de soins personnalisées pour votre établissement hospitalier.</p>
        </div>

        <button 
          onClick={() => handleOpenModal()}
          disabled={!hospitalId}
          className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/30 transition cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-5 h-5" /> Nouvelle Catégorie
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border-2 border-accent shadow-sm flex items-center gap-4">
          <div className="p-3 bg-teal-50 dark:bg-teal-950 text-teal-600 rounded-xl border border-accent/40">
            <FolderPlus className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Catégories sur-mesure</p>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">{categories.length}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border-2 border-alert shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl border border-alert/40">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Services Enregistrés</p>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">{services.length}</h3>
          </div>
        </div>

        <div
          className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm flex items-center gap-4 border-duo"
          style={{ '--ih-frame-bg': 'var(--color-white, #F5F5F3)' }}
        >
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl border border-accent">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Statut Référentiel</p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
              <CheckCircle className="w-3.5 h-3.5" /> Actif & Synchronisé
            </span>
          </div>
        </div>
      </div>

      {/* Barre de Recherche */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-accent shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher une catégorie..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-white"
          />
        </div>
        <p className="text-xs text-gray-500">Affichage de {filteredCategories.length} catégorie(s)</p>
      </div>

      {/* Grille des Catégories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">Chargement des catégories...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border-2 border-alert">
            Aucune catégorie de prestation trouvée. Cliquez sur <strong>"Nouvelle Catégorie"</strong> pour en ajouter une.
          </div>
        ) : (
          filteredCategories.map((cat, idx) => {
            const countServices = services.filter(s => s.category === cat.name).length;
            return (
              <div 
                key={cat.id} 
                className={`bg-white dark:bg-gray-900 rounded-2xl border-2 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4 ${
                  idx % 2 === 0 ? 'border-accent' : 'border-alert'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 flex items-center gap-1.5">
                      <Tag className="w-3 h-3" /> Catégorie Hôpital
                    </span>
                    <span className="text-xs font-bold text-gray-400">{countServices} service(s)</span>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{cat.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {cat.description || 'Aucune description fournie.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button 
                    onClick={() => handleOpenModal(cat)}
                    className="icon-btn"
                    title="Éditer la catégorie"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(cat.id)}
                    className="icon-btn icon-btn--danger"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Création / Édition */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-accent flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="text-teal-600" />
                {editingCategory ? 'Modifier la Catégorie' : 'Nouvelle Catégorie de Prestation'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl font-semibold border border-rose-200">
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Nom de la Catégorie *</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: Consultations Spécialisées, Imagerie Médicale..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Description (Optionnelle)</label>
                <textarea 
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Précisez le champ d'application de cette catégorie..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                ></textarea>
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
                  {editingCategory ? 'Mettre à jour' : 'Créer la catégorie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
