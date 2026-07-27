import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, MoreHorizontal, LayoutGrid, Type, Calendar } from 'lucide-react';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
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

    fetchCategories();
  }, []);

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    cat.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-350 mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-green-900 dark:text-white tracking-tight">Catégories d'Entreprises</h1>
          <p className="text-[15px] text-ink-muted dark:text-green-100/70 mt-1">Gérez la classification et les secteurs d'activité de la plateforme.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 flex items-center gap-2 text-[14px] font-semibold bg-surface dark:bg-transparent border-[1.5px] border-border dark:border-white/20 text-green-700 dark:text-green-100 rounded-md hover:bg-green-50 dark:hover:bg-white/5 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Exporter
          </button>
          <button className="px-4 py-2 flex items-center gap-2 text-[14px] font-semibold bg-green-700 text-white rounded-md hover:bg-green-800 transition-colors shadow-sm">
            + Nouvelle Catégorie
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="border border-border dark:border-white/10 rounded-[10px] bg-surface dark:bg-[#1A2E25] overflow-hidden shadow-sm flex flex-col">
        
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-border dark:border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-paper dark:bg-black/10">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input 
              type="text" 
              placeholder="Rechercher une catégorie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-[13px] bg-surface dark:bg-green-900/50 border border-border dark:border-white/10 rounded-md text-ink dark:text-white placeholder-ink-faint focus:outline-none focus:border-green-700 dark:focus:border-gold-600 transition-colors"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-ink-muted hover:text-green-900 dark:text-green-100/70 dark:hover:text-white transition-colors border border-border dark:border-white/10 rounded-md bg-surface dark:bg-transparent">
            <Filter className="w-4 h-4" /> Filtres
          </button>
        </div>

        {/* DataGrid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border dark:border-white/10 text-[11px] text-ink-faint dark:text-green-100/50 uppercase tracking-[0.05em] bg-paper/50 dark:bg-black/5">
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Nom de la Catégorie</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Slug (URL)</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Description</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Créée le</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
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
                    Aucune catégorie trouvée.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => {
                  const date = new Date(category.created_at);
                  const formattedDate = `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

                  return (
                    <tr key={category.id} className="hover:bg-green-50/50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md bg-green-100 dark:bg-green-700/50 flex items-center justify-center text-green-700 dark:text-green-100 font-display font-semibold shrink-0">
                            {category.icon ? <i className={category.icon}></i> : <LayoutGrid className="w-4 h-4" />}
                          </div>
                          <div className="text-[14px] font-semibold text-ink dark:text-white">
                            {category.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-mono text-ink-muted bg-paper dark:bg-black/20 dark:text-green-100/70 border border-border dark:border-white/5">
                          <Type className="w-3 h-3" /> /{category.slug}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[13px] text-ink-muted dark:text-green-100/70 max-w-xs truncate">
                          {category.description || 'Aucune description'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-mono text-[13px] text-green-900 dark:text-white/90">
                           <Calendar className="w-3.5 h-3.5 text-ink-faint" />
                          {formattedDate}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 text-ink-faint hover:text-green-900 dark:text-green-100/40 dark:hover:text-white transition-colors rounded-md hover:bg-paper dark:hover:bg-white/10 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && !error && filteredCategories.length > 0 && (
          <div className="px-6 py-4 border-t border-border dark:border-white/10 bg-surface dark:bg-transparent flex justify-between items-center text-[13px]">
            <span className="text-ink-muted dark:text-green-100/60 font-medium">
              Affichage de {filteredCategories.length} catégories
            </span>
            <div className="flex gap-1">
              <button className="px-3 py-1 border border-border dark:border-white/10 rounded text-ink-muted dark:text-green-100/60 opacity-50 cursor-not-allowed">Précédent</button>
              <button className="px-3 py-1 border border-border dark:border-white/10 rounded text-ink dark:text-white hover:bg-green-50 dark:hover:bg-white/5 transition-colors">Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
