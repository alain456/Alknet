import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle2, Mail, Plus, X, Edit, Trash2, Power, Star, ShieldCheck, Utensils, FileSpreadsheet, ShieldAlert, AlertTriangle, Eye, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';
import BusinessDetailsModal from '../shared/components/BusinessDetailsModal';
import BusinessRegistrationForm, {
  emptyBusinessRegistrationForm,
  validateBusinessRegistrationForm,
  buildBusinessRegistrationPayload,
} from '../shared/components/BusinessRegistrationForm';
import SectorAnalyticsWidget from './SectorAnalyticsWidget';
import BusinessCSVImporter from './BusinessCSVImporter';
import AdminModerationModal from './AdminModerationModal';
import { normalizeWebsiteUrl } from '../shared/websiteUrl';

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
  const [formError, setFormError] = useState(null);
  const { token } = useAuth();

  const [formData, setFormData] = useState(() => emptyBusinessRegistrationForm());

  const fetchBusinessesAndCategories = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [busData, catData] = await Promise.all([
        api.get('businesses/admin/list/', { auth: true }),
        api.get('business-categories/'),
      ]);
      setBusinesses(Array.isArray(busData) ? busData : (busData?.results || []));
      setCategories(Array.isArray(catData) ? catData : (catData?.results || []));
      setError(null);
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

  const openCreateModal = () => {
    setEditingBusiness(null);
    setFormError(null);
    const defaultPrimary = categories.length > 0 ? categories[0].id : '';
    setFormData(emptyBusinessRegistrationForm({
      primary_category: defaultPrimary,
    }));
    setIsModalOpen(true);
  };

  const openEditModal = (business) => {
    setEditingBusiness(business);
    setFormError(null);
    const catIds = business.categories_detail
      ? business.categories_detail.map((c) => c.id)
      : [];

    setFormData(emptyBusinessRegistrationForm({
      first_name: business.owner_first_name || '',
      last_name: business.owner_last_name || '',
      password: '',
      owner_avatar: business.owner_avatar || '',
      name: business.name || '',
      logo: business.logo || '',
      owner_email_input: business.owner_email || '',
      phone: business.phone || '',
      address: business.address || '',
      province: business.province || 'Bujumbura Mairie',
      commune: business.commune || '',
      zone: business.zone || '',
      quartier: business.quartier || '',
      avenue: business.avenue || '',
      latitude: business.latitude || '',
      longitude: business.longitude || '',
      website: business.website || '',
      description: business.description || '',
      primary_category: business.primary_category || (catIds.length > 0 ? catIds[0] : ''),
      category_ids: catIds,
      extra_attributes: {
        ...(business.extra_attributes || {}),
        ...(business.commerce_compliance?.nif_number
          ? { nif_number: business.commerce_compliance.nif_number }
          : {}),
        ...(business.commerce_compliance?.nif_document
          ? { nif_document: business.commerce_compliance.nif_document }
          : {}),
      },
    }));
    setIsModalOpen(true);
  };

  const handleDeleteBusiness = async (business) => {
    const ok = window.confirm(
      `Supprimer définitivement « ${business.name} » ?\n\nCette action est irréversible.`
    );
    if (!ok) return;

    try {
      const data = await api.delete(`businesses/admin/${business.id}/`, { auth: true });
      setBusinesses((prev) => prev.filter((b) => b.id !== business.id));
      alert(data?.message || 'Entreprise supprimée.');
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const handleApproveBusiness = async (business) => {
    const ok = window.confirm(
      `Rendre « ${business.name} » Active & Approuvée ?\n\nElle redeviendra visible dans le catalogue public.`
    );
    if (!ok) return;
    try {
      const data = await api.post(
        `businesses/admin/moderation/${business.id}/approve/`,
        {},
        { auth: true }
      );
      alert(data.message || 'Entreprise approuvée.');
      fetchBusinessesAndCategories();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const handleToggleActiveStatus = async (business) => {
    try {
      await api.patch(
        `businesses/admin/${business.id}/`,
        { is_active: !business.is_active },
        { auth: true }
      );
      fetchBusinessesAndCategories();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const handleActivateSubscription = async (business) => {
    const daysRaw = window.prompt(
      `Activer / prolonger l'abonnement SaaS de « ${business.name} ».\nNombre de jours :`,
      '30'
    );
    if (daysRaw === null) return;
    const days = parseInt(daysRaw, 10);
    if (!days || days < 1) {
      alert('Nombre de jours invalide.');
      return;
    }
    try {
      const data = await api.post(
        `businesses/admin/${business.id}/subscription/`,
        { action: 'activate', days, plan_code: 'monthly' },
        { auth: true }
      );
      alert(
        data?.has_active_subscription
          ? `Abonnement actif jusqu'au ${data.ends_at ? new Date(data.ends_at).toLocaleDateString('fr-FR') : '—'}`
          : 'Abonnement mis à jour.'
      );
      fetchBusinessesAndCategories();
    } catch (err) {
      alert(`Erreur abonnement : ${err.message}`);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const requirePassword = !editingBusiness;
      const validationError = validateBusinessRegistrationForm(formData, categories, {
        requirePassword,
        requireOwnerAvatar: !editingBusiness,
        requireCommerceDocs: !editingBusiness,
      });
      if (validationError) throw new Error(validationError);

      const payload = {
        ...buildBusinessRegistrationPayload(formData),
        website: normalizeWebsiteUrl(formData.website),
      };
      if (editingBusiness && !payload.password) {
        delete payload.password;
      }

      if (editingBusiness) {
        await api.patch(`businesses/admin/${editingBusiness.id}/`, payload, { auth: true });
      } else {
        await api.post('businesses/admin/list/', payload, { auth: true });
      }

      setIsModalOpen(false);
      setEditingBusiness(null);
      fetchBusinessesAndCategories();
    } catch (err) {
      setFormError(err.message || 'Erreur lors de l’enregistrement.');
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
      <div className="border border-border dark:border-white/10 rounded-md bg-surface dark:bg-primary overflow-hidden shadow-sm flex flex-col">
        
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
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${getStatusBadgeStyle(business)}`}>
                            {business.verification_status === 'PENDING' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                            {business.verification_status === 'PENDING' ? 'En attente modération' :
                             business.verification_status === 'REJECTED' ? 'Rejeté' :
                             business.is_active ? 'Actif & Approuvé' : 'Suspendu'}
                          </span>
                          {business.subscription && (
                            <div className={`text-[11px] font-medium ${business.subscription.is_blocked ? 'text-amber-700' : 'text-teal-700'}`}>
                              Abo : {business.subscription.status_display || business.subscription.status}
                              {business.subscription.days_remaining != null
                                ? ` · ${business.subscription.days_remaining}j`
                                : ''}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(business.verification_status === 'REJECTED' || business.verification_status === 'PENDING') && (
                            <button
                              type="button"
                              onClick={() => handleApproveBusiness(business)}
                              title="Rendre Actif & Approuvé"
                              className="icon-btn"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleActivateSubscription(business)}
                            title="Activer / prolonger l'abonnement SaaS"
                            className="icon-btn"
                          >
                            <Crown className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedDetailBusiness(business);
                              setIsDetailModalOpen(true);
                            }}
                            title="Voir toutes les informations complètes"
                            className="icon-btn"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleActiveStatus(business)}
                            title={business.is_active ? "Suspendre l'entreprise" : "Activer l'entreprise"}
                            className="icon-btn"
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => openEditModal(business)}
                            title="Modifier l'entreprise"
                            className="icon-btn"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteBusiness(business)}
                            title="Supprimer l'entreprise"
                            className="icon-btn icon-btn--danger"
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
        showModerationStatus
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

      {/* Modal Créer / Modifier — même formulaire que l'inscription client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-6 shadow-xl relative">
            <div className="flex justify-between items-center mb-3 px-1">
              <h3 className="text-lg font-extrabold text-surface drop-shadow">
                {editingBusiness ? "Modifier l'entreprise" : 'Créer une entreprise'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-surface/90 text-ink hover:bg-surface border-2 border-accent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <BusinessRegistrationForm
              formData={formData}
              onChange={setFormData}
              categories={categories}
              error={formError}
              submitting={submitting}
              onSubmit={handleFormSubmit}
              onCancel={() => setIsModalOpen(false)}
              submitLabel={editingBusiness ? 'Enregistrer' : 'Créer l’entreprise'}
              emailDisabled={!!editingBusiness}
              requirePassword={!editingBusiness}
              showWebsite
              compactFooter
            />
          </div>
        </div>
      )}
    </div>
  );
}
