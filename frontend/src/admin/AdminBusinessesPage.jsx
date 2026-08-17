import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, CheckCircle2, Clock, Mail, Building2, Pill, Stethoscope, Hotel, LayoutGrid, Plus, X, Phone, Globe, Tag, ChevronDown, ChevronRight, MoreHorizontal, Edit, Trash2, Power, Star, ShieldCheck, Utensils, Bed, Sparkles, FileSpreadsheet, ShieldAlert, AlertTriangle, Eye, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SectorSpecificFields from '../shared/components/SectorSpecificFields';
import LocationSelector from '../shared/components/LocationSelector';
import BusinessDetailsModal from '../shared/components/BusinessDetailsModal';
import SectorAnalyticsWidget from './SectorAnalyticsWidget';
import BusinessCSVImporter from './BusinessCSVImporter';
import AdminModerationModal from './AdminModerationModal';

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCSVOpen, setIsCSVOpen] = useState(false);
  const [isModerationOpen, setIsModerationOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailBusiness, setSelectedDetailBusiness] = useState(null);
  
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { token } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    owner_email_input: '',
    phone: '',
    email: '',
    address: '',
    province: 'Bujumbura Mairie',
    commune: 'Mukaza',
    quartier: 'Rohero I',
    latitude: '',
    longitude: '',
    website: '',
    description: '',
    is_active: true,
    primary_category: '',
    category_ids: [],
    extra_attributes: {}
  });

  const fetchBusinessesAndCategories = async () => {
    try {
      const [busRes, catRes] = await Promise.all([
        fetch('http://localhost:8000/api/v1/businesses/admin/list/', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }),
        fetch('http://localhost:8000/api/v1/business-categories/')
      ]);

      if (busRes.ok) {
        const data = await busRes.json();
        setBusinesses(data);
      }
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessesAndCategories();
  }, [token]);

  const pendingModerationCount = businesses.filter(b => b.verification_status === 'PENDING').length;

  const handleCategoryToggle = (catId) => {
    setFormData(prev => {
      const exists = prev.category_ids.includes(catId);
      if (exists) {
        return { ...prev, category_ids: prev.category_ids.filter(id => id !== catId) };
      } else {
        return { ...prev, category_ids: [...prev.category_ids, catId] };
      }
    });
  };

  const openCreateModal = () => {
    setEditingBusiness(null);
    const defaultPrimary = categories.length > 0 ? categories[0].id : '';
    setFormData({
      name: '',
      logo: '',
      owner_email_input: '',
      phone: '',
      email: '',
      address: '',
      province: 'Bujumbura Mairie',
      commune: 'Mukaza',
      quartier: 'Rohero I',
      latitude: '',
      longitude: '',
      website: '',
      description: '',
      is_active: true,
      primary_category: defaultPrimary,
      category_ids: [],
      extra_attributes: {}
    });
    setIsModalOpen(true);
  };

  const openEditModal = (business) => {
    setEditingBusiness(business);
    const catIds = business.categories_detail 
      ? business.categories_detail.map(c => c.id) 
      : [];

    setFormData({
      name: business.name || '',
      logo: business.logo || '',
      owner_email_input: business.owner_email || '',
      phone: business.phone || '',
      email: business.email || '',
      address: business.address || '',
      province: business.province || 'Bujumbura Mairie',
      commune: business.commune || '',
      quartier: business.quartier || '',
      latitude: business.latitude || '',
      longitude: business.longitude || '',
      website: business.website || '',
      description: business.description || '',
      is_active: business.is_active !== undefined ? business.is_active : true,
      primary_category: business.primary_category || (catIds.length > 0 ? catIds[0] : ''),
      category_ids: catIds,
      extra_attributes: business.extra_attributes || {}
    });
    setIsModalOpen(true);
  };

  const handleDeleteBusiness = async (business) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'entreprise "${business.name}" ?`)) return;

    try {
      const response = await fetch(`http://localhost:8000/api/v1/businesses/admin/${business.id}/`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) throw new Error('Erreur lors de la suppression');

      fetchBusinessesAndCategories();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const handleToggleActiveStatus = async (business) => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/businesses/admin/${business.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ is_active: !business.is_active })
      });

      if (!response.ok) throw new Error('Erreur lors du changement de statut');

      fetchBusinessesAndCategories();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingBusiness
        ? `http://localhost:8000/api/v1/businesses/admin/${editingBusiness.id}/`
        : 'http://localhost:8000/api/v1/businesses/admin/list/';

      const method = editingBusiness ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(JSON.stringify(errData));
      }

      setIsModalOpen(false);
      setEditingBusiness(null);
      fetchBusinessesAndCategories();
    } catch (err) {
      alert(`Erreur lors de l'enregistrement : ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeStyle = (business) => {
    if (business.verification_status === 'PENDING') {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300';
    }
    if (business.verification_status === 'REJECTED') {
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200';
    }
    return business.is_active 
      ? 'bg-green-100 text-green-700 dark:bg-success/20 dark:text-green-100'
      : 'bg-clay-100 text-clay-600 dark:bg-error/20 dark:text-red-200';
  };

  const parentCategories = categories.filter(c => !c.parent);

  const filteredBusinesses = businesses.filter(business => {
    const matchesSearch = business.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (business.owner_email && business.owner_email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = !selectedCategory || 
      business.primary_category_name === selectedCategory ||
      business.category_name === selectedCategory ||
      (business.categories_detail && business.categories_detail.some(c => c.name === selectedCategory));

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 max-w-350 mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-green-900 dark:text-white tracking-tight">Administration des Entreprises</h1>
          <p className="text-[15px] text-ink-muted dark:text-green-100/70 mt-1">Gestion professionnelle, modération des agréments & importation massive CSV/Excel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Moderation Button */}
          <button 
            onClick={() => setIsModerationOpen(true)}
            className="px-3.5 py-2 flex items-center gap-1.5 text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-md hover:bg-amber-500/20 transition-colors shadow-2xs cursor-pointer relative"
          >
            <ShieldAlert className="w-4 h-4 text-amber-600" /> Modération
            {pendingModerationCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-600 text-white">
                {pendingModerationCount}
              </span>
            )}
          </button>

          {/* Import CSV Button */}
          <button 
            onClick={() => setIsCSVOpen(true)}
            className="px-3.5 py-2 flex items-center gap-1.5 text-xs font-semibold bg-surface dark:bg-transparent border border-border dark:border-white/20 text-green-700 dark:text-green-100 rounded-md hover:bg-green-50 dark:hover:bg-white/5 transition-colors shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-700 dark:text-gold-400" /> Import CSV / Excel
          </button>

          {/* Create Business Button */}
          <button 
            onClick={openCreateModal}
            className="px-4 py-2 flex items-center gap-2 text-xs font-semibold bg-green-700 text-white rounded-md hover:bg-green-800 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Créer une Entreprise
          </button>
        </div>
      </div>

      {/* Decision Analytics Widget */}
      <SectorAnalyticsWidget businesses={businesses} categories={categories} />

      {/* Table Container */}
      <div className="border border-border dark:border-white/10 rounded-md bg-surface dark:bg-[#1A2E25] overflow-hidden shadow-sm flex flex-col">
        
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-border dark:border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-paper dark:bg-black/10">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input 
              type="text" 
              placeholder="Rechercher par nom d'entreprise ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-[13px] bg-surface dark:bg-green-900/50 border border-border dark:border-white/10 rounded-md text-ink dark:text-white placeholder-ink-faint focus:outline-none focus:border-green-700 dark:focus:border-gold-600 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-ink-faint shrink-0" />
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-[13px] bg-surface dark:bg-green-900/50 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700"
            >
              <option value="">Toutes les catégories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* DataGrid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border dark:border-white/10 text-[11px] text-ink-faint dark:text-green-100/50 uppercase tracking-wider bg-paper/50 dark:bg-black/5">
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Entreprise</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Catégorie Principale ⭐</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Spécificités Métier</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Propriétaire</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Statut / Modération</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Actions (CRUD)</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-border dark:divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-700"></div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-error">
                    Erreur de chargement: {error}
                  </td>
                </tr>
              ) : filteredBusinesses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-ink-muted dark:text-green-100/60 text-[14px]">
                    Aucune entreprise trouvée.
                  </td>
                </tr>
              ) : (
                filteredBusinesses.map((business) => {
                  const primaryCatName = business.primary_category_name || business.category_name || "Non spécifiée";
                  const attrs = business.extra_attributes || {};

                  return (
                    <tr key={business.id} className="hover:bg-green-50/50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md bg-gold-100 dark:bg-gold-600/20 flex items-center justify-center text-gold-600 dark:text-gold-100 font-display font-semibold shrink-0">
                            {business.logo ? (
                               <img src={business.logo} alt={business.name} className="w-full h-full object-cover rounded-md" />
                            ) : (
                               business.name[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-ink dark:text-white">
                              {business.name}
                            </div>
                            <div className="text-[12.5px] text-ink-muted dark:text-green-100/60">
                               {business.full_address || business.address || [business.avenue, business.quartier, business.zone, business.commune, business.province].filter(Boolean).join(', ') || 'Adresse non renseignée'}
                             </div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Primary Category */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-bold bg-gold-500/15 text-gold-700 dark:text-gold-300 border border-gold-500/30 shadow-2xs">
                          <Star className="w-3.5 h-3.5 fill-gold-500 text-gold-600" />
                          {primaryCatName}
                        </span>
                      </td>

                      {/* Sector Specific Attributes */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {attrs.license_number && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200 border border-green-200 dark:border-green-800">
                              <ShieldCheck className="w-3 h-3 text-green-700" /> N° Agrément: {attrs.license_number}
                            </span>
                          )}
                          {attrs.is_24_7 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                              Garde 24/7
                            </span>
                          )}
                          {attrs.stars_rating && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gold-500/20 text-gold-700 dark:text-gold-300">
                              {attrs.stars_rating} ★ ({attrs.rooms_count || '?'} ch.)
                            </span>
                          )}
                          {attrs.has_swimming_pool && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                              Piscine
                            </span>
                          )}
                          {attrs.cuisine_type && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200">
                              <Utensils className="w-3 h-3" /> Cuisine {attrs.cuisine_type}
                            </span>
                          )}
                          {!attrs.license_number && !attrs.stars_rating && !attrs.cuisine_type && !attrs.is_24_7 && (
                            <span className="text-[11px] text-ink-faint italic">Spécificités standard</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-[13px] text-ink dark:text-white/90">
                           <Mail className="w-3.5 h-3.5 text-ink-faint" /> 
                           {business.owner_email || 'Inconnu'}
                        </div>
                      </td>

                      {/* Verification Status Column */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${getStatusBadgeStyle(business)}`}>
                          {business.verification_status === 'PENDING' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          {business.verification_status === 'PENDING' ? 'En attente modération' :
                           business.verification_status === 'REJECTED' ? 'Rejeté' :
                           business.is_active ? 'Actif & Approuvé' : 'Suspendu'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => {
                              setSelectedDetailBusiness(business);
                              setIsDetailModalOpen(true);
                            }}
                            title="Voir toutes les informations complètes"
                            className="p-1.5 text-ink-faint hover:text-blue-600 dark:text-green-100/60 dark:hover:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-white/10"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleActiveStatus(business)}
                            title={business.is_active ? "Suspendre l'entreprise" : "Activer l'entreprise"}
                            className="p-1.5 text-ink-faint hover:text-gold-600 dark:text-green-100/60 dark:hover:text-gold-400 rounded-md hover:bg-paper dark:hover:bg-white/10"
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => openEditModal(business)}
                            title="Modifier l'entreprise"
                            className="p-1.5 text-ink-faint hover:text-green-700 dark:text-green-100/60 dark:hover:text-white rounded-md hover:bg-paper dark:hover:bg-white/10"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteBusiness(business)}
                            title="Supprimer l'entreprise"
                            className="p-1.5 text-ink-faint hover:text-red-600 dark:text-red-400/70 dark:hover:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        {!loading && !error && filteredBusinesses.length > 0 && (
          <div className="px-6 py-4 border-t border-border dark:border-white/10 bg-surface dark:bg-transparent flex justify-between items-center text-[13px]">
            <span className="text-ink-muted dark:text-green-100/60 font-medium">
              Total : {filteredBusinesses.length} entreprise(s)
            </span>
          </div>
        )}
      </div>

      {/* Modal Détails Complets de l'Entreprise */}
      <BusinessDetailsModal 
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        business={selectedDetailBusiness}
        categories={categories}
      />

      {/* Modal Import CSV / Excel */}
      <BusinessCSVImporter 
        isOpen={isCSVOpen}
        onClose={() => setIsCSVOpen(false)}
        onSuccess={fetchBusinessesAndCategories}
      />

      {/* Modal Moderation */}
      <AdminModerationModal 
        isOpen={isModerationOpen}
        onClose={() => setIsModerationOpen(false)}
        onRefresh={fetchBusinessesAndCategories}
      />

      {/* Modal Créer / Modifier Entreprise & Catégories */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-surface dark:bg-[#1A2E25] border border-border dark:border-white/10 rounded-xl p-6 w-full max-w-2xl shadow-xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-border dark:border-white/10">
              <h3 className="text-lg font-bold text-green-900 dark:text-white">
                {editingBusiness ? "Modifier l'Entreprise" : "Créer une Entreprise & Champs Métiers"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-ink-faint hover:text-ink dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              
              {/* Logo / Image de l'entreprise avec Aperçu Intégré */}
              <div className="bg-paper dark:bg-black/20 p-3.5 rounded-xl border border-border dark:border-white/10 space-y-2">
                <label className="block text-xs font-bold text-green-900 dark:text-green-100 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-gold-600" /> Logo & Image de l'Entreprise
                </label>
                
                <div className="flex items-center gap-4">
                  {/* Visual Preview Box */}
                  <div className="w-16 h-16 rounded-xl bg-gold-500/20 border border-gold-500/40 flex items-center justify-center text-gold-700 dark:text-gold-300 font-bold text-2xl shrink-0 overflow-hidden shadow-inner relative">
                    {formData.logo ? (
                      <img src={formData.logo} alt="Aperçu Logo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="uppercase">{formData.name ? formData.name[0] : 'E'}</span>
                    )}
                  </div>

                  {/* Actions & File Input */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-md text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-2xs">
                        <Upload className="w-3.5 h-3.5" /> Téléverser une Image...
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setFormData(prev => ({ ...prev, logo: reader.result }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      {formData.logo && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}
                          className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 text-xs font-semibold rounded-md transition"
                        >
                          Effacer le logo
                        </button>
                      )}
                    </div>

                    <input 
                      type="url"
                      placeholder="Ou coller directement l'URL d'une image (ex: https://.../logo.png)"
                      value={formData.logo}
                      onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                      className="w-full px-2.5 py-1 text-xs bg-surface dark:bg-black/40 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">Nom de l'entreprise *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Nom de l'entreprise"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 text-sm bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">E-mail de l'entreprise*</label>
                  <input 
                    type="email" 
                    required
                    disabled={!!editingBusiness}
                    placeholder="ex: Entreprise@isokohub.com"
                    value={formData.owner_email_input}
                    onChange={(e) => setFormData({...formData, owner_email_input: e.target.value})}
                    className="w-full px-3 py-2 text-sm bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Primary Category Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gold-700 dark:text-gold-400 mb-1 flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-gold-500 text-gold-600" /> Catégorie Principale (Métier Cœur) *
                </label>
                <select 
                  required
                  value={formData.primary_category}
                  onChange={(e) => setFormData({...formData, primary_category: e.target.value})}
                  className="w-full px-3 py-2 text-sm font-semibold bg-gold-500/10 dark:bg-gold-500/20 border border-gold-500/30 rounded-md text-ink dark:text-white focus:outline-none focus:border-gold-600"
                >
                  <option value="" disabled>-- Sélectionner le métier cœur principal --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.parent_name ? `${cat.parent_name} → ${cat.name}` : `Secteur: ${cat.name}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Sector Specific Fields Component */}
              <SectorSpecificFields 
                primaryCategory={formData.primary_category}
                categories={categories}
                attributes={formData.extra_attributes}
                onChange={(updatedAttrs) => setFormData({...formData, extra_attributes: updatedAttrs})}
              />

              {/* Mandatory Location Selector (Province, Commune, Quartier, GPS) */}
              <LocationSelector 
                province={formData.province}
                commune={formData.commune}
                zone={formData.zone}
                quartier={formData.quartier}
                avenue={formData.avenue}
                address={formData.address}
                latitude={formData.latitude}
                longitude={formData.longitude}
                onChange={(loc) => setFormData({...formData, ...loc})}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">Téléphone</label>
                  <input 
                    type="text" 
                    placeholder="+257 79 00 00 00"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 text-sm bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">Adresse / Ville</label>
                  <input 
                    type="text" 
                    placeholder="Bujumbura, Rohero..."
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-3 py-2 text-sm bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700"
                  />
                </div>
              </div>

              {/* Secondary Categories Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">Catégories & Services Secondaires (Optionnel)</label>
                <div className="border border-border dark:border-white/10 rounded-md p-3 max-h-48 overflow-y-auto space-y-4 bg-paper/50 dark:bg-black/20">
                  {parentCategories.map((parent) => {
                    const children = categories.filter(c => c.parent === parent.id || (c.parent_name && c.parent_name === parent.name));

                    return (
                      <div key={parent.id} className="space-y-1.5">
                        <div className="font-semibold text-xs text-green-900 dark:text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5" /> {parent.name}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-4">
                          {children.map((child) => (
                            <label key={child.id} className="flex items-center gap-2 text-xs text-ink-muted dark:text-green-100/80 cursor-pointer select-none hover:text-ink">
                              <input 
                                type="checkbox"
                                checked={formData.category_ids.includes(child.id)}
                                onChange={() => handleCategoryToggle(child.id)}
                                className="rounded border-border text-green-700 focus:ring-green-700"
                              />
                              <span>{child.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">Description</label>
                <textarea 
                  rows="2"
                  placeholder="Présentation rapide de l'établissement..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 text-sm bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 resize-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold border border-border dark:border-white/10 rounded-md text-ink-muted hover:bg-paper"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold bg-green-700 text-white rounded-md hover:bg-green-800 disabled:opacity-50"
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
