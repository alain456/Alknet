import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, LayoutGrid, Type, Calendar, Plus, X, Building2, Pill, Stethoscope, Hotel, Store, Laptop, HardHat, Sprout, Car, GraduationCap, Briefcase, ChevronRight, Edit, Trash2, FolderPlus, Grid, List, Layers, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'table'
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'sectors', 'subcategories'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isCreatingSectorOnly, setIsCreatingSectorOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { token } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: 'Building2',
    parent: ''
  });

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/business-categories/');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleNameChange = (e) => {
    const name = e.target.value;
    const generatedSlug = name
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    
    setFormData(prev => ({
      ...prev,
      name: name,
      slug: editingCategory ? prev.slug : generatedSlug
    }));
  };

  const openCreateSectorModal = () => {
    setEditingCategory(null);
    setIsCreatingSectorOnly(true);
    setFormData({ name: '', slug: '', description: '', icon: 'Building2', parent: '' });
    setIsModalOpen(true);
  };

  const openCreateSubCategoryModal = (presetParentId = '') => {
    setEditingCategory(null);
    setIsCreatingSectorOnly(false);
    const parentId = presetParentId || (parentCategories.length > 0 ? parentCategories[0].id : '');
    setFormData({ name: '', slug: '', description: '', icon: 'Store', parent: parentId });
    setIsModalOpen(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setIsCreatingSectorOnly(!category.parent);
    setFormData({
      name: category.name || '',
      slug: category.slug || '',
      description: category.description || '',
      icon: category.icon || 'Building2',
      parent: category.parent || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteCategory = async (category) => {
    const isSector = !category.parent;
    const warningMsg = isSector
      ? `Attention : Supprimer le secteur parent "${category.name}" supprimera également toutes les sous-catégories qui lui sont rattachées. Voulez-vous continuer ?`
      : `Êtes-vous sûr de vouloir supprimer la sous-catégorie "${category.name}" ?`;

    if (!window.confirm(warningMsg)) return;

    try {
      const response = await fetch(`http://localhost:8000/api/v1/business-categories/${category.id}/`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) throw new Error('Erreur lors de la suppression');

      fetchCategories();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const [formError, setFormError] = useState(null);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        icon: formData.icon,
        parent: isCreatingSectorOnly ? null : (formData.parent ? formData.parent : null)
      };

      const url = editingCategory 
        ? `http://localhost:8000/api/v1/business-categories/${editingCategory.id}/`
        : 'http://localhost:8000/api/v1/business-categories/create/';
      
      const method = editingCategory ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        let formattedMsg = 'Erreur lors de l\'enregistrement';
        if (typeof errData === 'object' && errData !== null) {
          formattedMsg = Object.entries(errData)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join(' | ');
        }
        throw new Error(formattedMsg);
      }

      setIsModalOpen(false);
      setEditingCategory(null);
      setFormData({ name: '', slug: '', description: '', icon: 'Building2', parent: '' });
      fetchCategories();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderCategoryIcon = (iconName) => {
    switch (iconName) {
      case 'Building2': return <Building2 className="w-4 h-4 text-green-700 dark:text-green-100" />;
      case 'Pill': return <Pill className="w-4 h-4 text-green-700 dark:text-green-100" />;
      case 'Stethoscope': return <Stethoscope className="w-4 h-4 text-green-700 dark:text-green-100" />;
      case 'Hotel': return <Hotel className="w-4 h-4 text-green-700 dark:text-green-100" />;
      case 'Store': return <Store className="w-4 h-4 text-green-700 dark:text-green-100" />;
      case 'Laptop': return <Laptop className="w-4 h-4 text-green-700 dark:text-green-100" />;
      case 'HardHat': return <HardHat className="w-4 h-4 text-green-700 dark:text-green-100" />;
      case 'Sprout': return <Sprout className="w-4 h-4 text-green-700 dark:text-green-100" />;
      case 'Car': return <Car className="w-4 h-4 text-green-700 dark:text-green-100" />;
      case 'GraduationCap': return <GraduationCap className="w-4 h-4 text-green-700 dark:text-green-100" />;
      case 'Briefcase': return <Briefcase className="w-4 h-4 text-green-700 dark:text-green-100" />;
      default: return <LayoutGrid className="w-4 h-4 text-green-700 dark:text-green-100" />;
    }
  };

  const parentCategories = categories.filter(c => !c.parent && (!editingCategory || c.id !== editingCategory.id));
  const sectorsList = categories.filter(c => !c.parent);

  const filteredCategories = categories.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      cat.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cat.parent_name && cat.parent_name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'sectors') return !cat.parent;
    if (activeTab === 'subcategories') return !!cat.parent;
    return true;
  });

  return (
    <div className="space-y-6 max-w-350 mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-green-900 dark:text-white tracking-tight">Secteurs & Catégories</h1>
          <p className="text-[15px] text-ink-muted dark:text-green-100/70 mt-1">Vue d'ensemble hiérarchique regroupant chaque secteur et l'intégralité de ses sous-catégories.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={openCreateSectorModal}
            className="px-4 py-2 flex items-center gap-2 text-[14px] font-semibold bg-gold-600 hover:bg-gold-700 text-white rounded-md transition-colors shadow-sm cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" /> Nouveau Secteur Parent
          </button>
          <button 
            onClick={() => openCreateSubCategoryModal()}
            className="px-4 py-2 flex items-center gap-2 text-[14px] font-semibold bg-green-700 text-white rounded-md hover:bg-green-800 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nouvelle Sous-catégorie
          </button>
        </div>
      </div>

      {/* Toolbar & View Mode Switcher */}
      <div className="border border-border dark:border-white/10 rounded-md bg-surface dark:bg-[#1A2E25] p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        
        {/* View Mode Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted dark:text-green-100/60 uppercase tracking-wider">Affichage :</span>
          <div className="flex items-center bg-paper dark:bg-black/20 p-1 border border-border dark:border-white/10 rounded-md">
            <button 
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'grouped' ? 'bg-green-700 text-white shadow-xs' : 'text-ink-muted dark:text-green-100/70 hover:text-ink'}`}
            >
              <Layers className="w-3.5 h-3.5" /> Secteurs & Catégories Groupés
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'table' ? 'bg-green-700 text-white shadow-xs' : 'text-ink-muted dark:text-green-100/70 hover:text-ink'}`}
            >
              <List className="w-3.5 h-3.5" /> Vue Tableau à Plat
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input 
            type="text" 
            placeholder="Filtrer un secteur ou une catégorie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-[13px] bg-surface dark:bg-green-900/50 border border-border dark:border-white/10 rounded-md text-ink dark:text-white placeholder-ink-faint focus:outline-none focus:border-green-700 dark:focus:border-gold-600 transition-colors"
          />
        </div>
      </div>

      {/* VIEW MODE 1: GROUPED SECTOR CARDS */}
      {viewMode === 'grouped' && (
        <div className="space-y-6">
          {loading ? (
            <div className="p-12 text-center bg-surface dark:bg-[#1A2E25] rounded-md border border-border dark:border-white/10">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-700"></div>
              <p className="mt-2 text-xs text-ink-muted dark:text-green-100/60">Chargement de l'arborescence des secteurs...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-error bg-red-50 dark:bg-red-900/20 rounded-md">
              Erreur de chargement: {error}
            </div>
          ) : sectorsList.length === 0 ? (
            <div className="p-12 text-center text-ink-muted dark:text-green-100/60 bg-surface dark:bg-[#1A2E25] rounded-md border border-border">
              Aucun secteur principal trouvé.
            </div>
          ) : (
            sectorsList
              .filter(sector => 
                !searchTerm || 
                sector.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                categories.some(c => (c.parent === sector.id || c.parent_name === sector.name) && c.name.toLowerCase().includes(searchTerm.toLowerCase()))
              )
              .map((sector) => {
                const subCats = categories.filter(c => c.parent === sector.id || (c.parent_name && c.parent_name === sector.name));

                return (
                  <div key={sector.id} className="border border-border dark:border-white/10 rounded-xl bg-surface dark:bg-[#1A2E25] overflow-hidden shadow-sm">
                    {/* Sector Header Banner */}
                    <div className="px-6 py-4 bg-paper/80 dark:bg-black/20 border-b border-border dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gold-500/20 dark:bg-gold-500/30 flex items-center justify-center text-gold-700 dark:text-gold-300 font-bold shrink-0">
                          {renderCategoryIcon(sector.icon)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-green-950 dark:text-white">{sector.name}</h2>
                            <span className="text-[11px] font-mono text-ink-faint dark:text-green-100/60 px-2 py-0.5 rounded bg-surface dark:bg-black/30 border border-border dark:border-white/5">
                              /{sector.slug}
                            </span>
                          </div>
                          <p className="text-xs text-ink-muted dark:text-green-100/70 mt-0.5">
                            {sector.description || 'Secteur d\'activité principal'} • <span className="font-semibold text-green-700 dark:text-gold-400">{subCats.length} sous-catégorie(s) incluses</span>
                          </p>
                        </div>
                      </div>

                      {/* Sector Actions */}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => openCreateSubCategoryModal(sector.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-green-700 hover:bg-green-800 text-white rounded-md flex items-center gap-1 transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Sous-catégorie
                        </button>
                        <button 
                          onClick={() => openEditModal(sector)}
                          title="Modifier le secteur"
                          className="p-1.5 text-ink-muted hover:text-green-700 dark:text-green-100/70 dark:hover:text-white rounded-md hover:bg-paper dark:hover:bg-white/10 border border-border dark:border-white/10"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(sector)}
                          title="Supprimer le secteur"
                          className="p-1.5 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-900/40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Subcategories Grid */}
                    <div className="p-6">
                      {subCats.length === 0 ? (
                        <div className="p-6 text-center text-xs text-ink-faint dark:text-green-100/50 border border-dashed border-border dark:border-white/10 rounded-lg">
                          Aucune sous-catégorie rattachée à ce secteur. Cliquez sur "+ Sous-catégorie" pour en ajouter une.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {subCats.map((sub) => (
                            <div 
                              key={sub.id} 
                              className="p-4 border border-border dark:border-white/10 rounded-lg bg-surface dark:bg-black/10 hover:border-green-700 dark:hover:border-gold-500/50 transition group flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded bg-green-100 dark:bg-green-800/40 flex items-center justify-center shrink-0">
                                      {renderCategoryIcon(sub.icon)}
                                    </div>
                                    <h3 className="text-sm font-semibold text-ink dark:text-white">{sub.name}</h3>
                                  </div>

                                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                                    <button 
                                      onClick={() => openEditModal(sub)}
                                      title="Modifier"
                                      className="p-1 text-ink-faint hover:text-green-700 dark:hover:text-white rounded"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteCategory(sub)}
                                      title="Supprimer"
                                      className="p-1 text-ink-faint hover:text-red-600 dark:hover:text-red-400 rounded"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <p className="text-xs text-ink-muted dark:text-green-100/70 line-clamp-2">
                                  {sub.description || 'Sous-catégorie d\'entreprise'}
                                </p>
                              </div>

                              <div className="mt-3 pt-2 border-t border-border/50 dark:border-white/5 flex items-center justify-between text-[11px] text-ink-faint dark:text-green-100/50">
                                <span className="font-mono">/{sub.slug}</span>
                                <span className="text-green-800 dark:text-gold-400 font-medium flex items-center gap-1">
                                  <Tag className="w-3 h-3" /> Attribuable
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* VIEW MODE 2: FLAT TABLE DATA GRID */}
      {viewMode === 'table' && (
        <div className="border border-border dark:border-white/10 rounded-md bg-surface dark:bg-[#1A2E25] overflow-hidden shadow-sm flex flex-col">
          
          {/* Toolbar & Tabs */}
          <div className="px-5 py-4 border-b border-border dark:border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-paper dark:bg-black/10">
            <div className="flex items-center gap-1 bg-surface dark:bg-green-900/50 p-1 border border-border dark:border-white/10 rounded-md">
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'all' ? 'bg-green-700 text-white shadow-xs' : 'text-ink-muted dark:text-green-100/70 hover:text-ink'}`}
              >
                Tous ({categories.length})
              </button>
              <button 
                onClick={() => setActiveTab('sectors')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'sectors' ? 'bg-green-700 text-white shadow-xs' : 'text-ink-muted dark:text-green-100/70 hover:text-ink'}`}
              >
                Secteurs Parents ({categories.filter(c => !c.parent).length})
              </button>
              <button 
                onClick={() => setActiveTab('subcategories')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'subcategories' ? 'bg-green-700 text-white shadow-xs' : 'text-ink-muted dark:text-green-100/70 hover:text-ink'}`}
              >
                Sous-Catégories ({categories.filter(c => !!c.parent).length})
              </button>
            </div>
          </div>

          {/* DataGrid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border dark:border-white/10 text-[11px] text-ink-faint dark:text-green-100/50 uppercase tracking-wider bg-paper/50 dark:bg-black/5">
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Nom / Type</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Statut / Secteur Parent</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Slug (URL)</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Description</th>
                  <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Actions (CRUD)</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-border dark:divide-white/10">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-700"></div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-error">
                      Erreur de chargement: {error}
                    </td>
                  </tr>
                ) : filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-ink-muted dark:text-green-100/60 text-[14px]">
                      Aucun secteur ou catégorie trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((category) => {
                    const isSector = !category.parent;

                    return (
                      <tr key={category.id} className="hover:bg-green-50/50 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${isSector ? 'bg-gold-100 dark:bg-gold-600/30' : 'bg-green-100 dark:bg-green-700/50'}`}>
                              {renderCategoryIcon(category.icon)}
                            </div>
                            <div>
                              <div className="text-[14px] font-semibold text-ink dark:text-white flex items-center gap-2">
                                {category.name}
                                {isSector && (
                                  <span className="text-[10px] bg-gold-500/20 text-gold-700 dark:text-gold-300 font-bold px-1.5 py-0.5 rounded uppercase">
                                    SECTEUR
                                  </span>
                                )}
                              </div>
                              {category.subcategories && category.subcategories.length > 0 && (
                                <span className="text-[11px] text-green-700 dark:text-gold-400 font-medium">
                                  {category.subcategories.length} sous-catégorie(s)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {category.parent_name ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200 border border-green-200 dark:border-green-800">
                              <ChevronRight className="w-3 h-3" /> {category.parent_name}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-gold-500/10 text-gold-700 dark:text-gold-400 border border-gold-500/20">
                              Secteur Principal
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-mono text-ink-muted bg-paper dark:bg-black/20 dark:text-green-100/70 border border-border dark:border-white/5">
                            <Type className="w-3 h-3" /> /{category.slug}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[13px] text-ink-muted dark:text-green-100/70 max-w-sm">
                            {category.description || 'Aucune description'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => openEditModal(category)}
                              title={isSector ? "Modifier le Secteur" : "Modifier la Sous-catégorie"}
                              className="p-1.5 text-ink-faint hover:text-green-700 dark:text-green-100/60 dark:hover:text-white rounded-md hover:bg-paper dark:hover:bg-white/10"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteCategory(category)}
                              title={isSector ? "Supprimer le Secteur" : "Supprimer la Sous-catégorie"}
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
        </div>
      )}

      {/* Modal Créer / Modifier (Secteur ou Sous-catégorie) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface dark:bg-[#1A2E25] border border-border dark:border-white/10 rounded-xl p-6 w-full max-w-md shadow-xl relative">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-border dark:border-white/10">
              <h3 className="text-lg font-bold text-green-900 dark:text-white">
                {editingCategory 
                  ? (isCreatingSectorOnly ? 'Modifier le Secteur Parent' : 'Modifier la Sous-catégorie')
                  : (isCreatingSectorOnly ? 'Créer un Nouveau Secteur Parent' : 'Créer une Sous-catégorie')
                }
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-ink-faint hover:text-ink dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              
              {formError && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-semibold rounded-lg">
                  {formError}
                </div>
              )}

              {!isCreatingSectorOnly && (
                <div>
                  <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">Rattacher au Secteur Parent *</label>
                  <select 
                    required
                    value={formData.parent}
                    onChange={(e) => setFormData({...formData, parent: e.target.value})}
                    className="w-full px-3 py-2 text-sm bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700"
                  >
                    <option value="" disabled>-- Sélectionner un Secteur Parent --</option>
                    {parentCategories.map(p => (
                      <option key={p.id} value={p.id}>Secteur: {p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {isCreatingSectorOnly && (
                <div className="p-3 bg-gold-500/10 border border-gold-500/20 rounded-md text-xs text-gold-700 dark:text-gold-300 font-medium">
                  ★ Vous créez un **Secteur Parent principal** (ex: Commerce, Santé, Hôtellerie...). Des sous-catégories pourront y être rattachées ultérieurement.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">
                  {isCreatingSectorOnly ? 'Nom du Secteur Parent' : 'Nom de la Sous-catégorie'} *
                </label>
                <input 
                  type="text" 
                  required
                  placeholder={isCreatingSectorOnly ? "Ex: Énergie, Immobilier..." : "Ex: Pharmacie, Boutique, Supermarché..."}
                  value={formData.name}
                  onChange={handleNameChange}
                  className="w-full px-3 py-2 text-sm bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">Slug (auto-généré)</label>
                <input 
                  type="text" 
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({...formData, slug: e.target.value})}
                  className="w-full px-3 py-2 text-sm bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">Icône</label>
                <select 
                  value={formData.icon}
                  onChange={(e) => setFormData({...formData, icon: e.target.value})}
                  className="w-full px-3 py-2 text-sm bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700"
                >
                  <option value="Building2">Building2 (Bâtiment / Secteur)</option>
                  <option value="Store">Store (Commerce / Boutique)</option>
                  <option value="Stethoscope">Stethoscope (Santé / Clinique)</option>
                  <option value="Pill">Pill (Pharmacie)</option>
                  <option value="Hotel">Hotel (Hôtellerie)</option>
                  <option value="Laptop">Laptop (Technologie)</option>
                  <option value="HardHat">HardHat (Construction / BTP)</option>
                  <option value="Sprout">Sprout (Agriculture)</option>
                  <option value="Car">Car (Transport)</option>
                  <option value="GraduationCap">GraduationCap (Éducation)</option>
                  <option value="Briefcase">Briefcase (Services)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">Description</label>
                <textarea 
                  rows="3"
                  placeholder="Brève description..."
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
