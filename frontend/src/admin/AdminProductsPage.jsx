import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Package, Tag, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';

const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchProducts = async () => {
      if (!isAuthenticated || !token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await api.get('products/admin/list/', {
          auth: true,
          headers: { Authorization: `Bearer ${token}` },
        });
        setProducts(normalize(data));
      } catch (err) {
        setError(err.message || 'Impossible de charger les produits');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [token, isAuthenticated]);

  const filteredProducts = products.filter((p) =>
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    || (p.business_name || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-350 mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-green-900 dark:text-white tracking-tight">Produits</h1>
          <p className="text-[15px] text-ink-muted dark:text-green-100/70 mt-1">Supervisez le catalogue des produits en vente.</p>
        </div>
        <button className="px-4 py-2 flex items-center gap-2 text-[14px] font-semibold bg-surface dark:bg-transparent border-[1.5px] border-border dark:border-white/20 text-green-700 dark:text-green-100 rounded-md hover:bg-green-50 dark:hover:bg-white/5 transition-colors shadow-sm">
          <Download className="w-4 h-4" /> Exporter
        </button>
      </div>

      {/* Table Container */}
      <div className="border border-border dark:border-white/10 rounded-[10px] bg-surface dark:bg-primary overflow-hidden shadow-sm flex flex-col">
        
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-border dark:border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-paper dark:bg-black/10">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input 
              type="text" 
              placeholder="Rechercher un produit ou une boutique..."
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
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Produit</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Boutique</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Prix / Stock</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Statut</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Créé le</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
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
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-ink-muted dark:text-green-100/60 text-[14px]">
                    Aucun produit trouvé.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const date = new Date(product.created_at);
                  const formattedDate = `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

                  return (
                    <tr key={product.id} className="hover:bg-green-50/50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-clay-50 dark:bg-clay-900/30 flex items-center justify-center text-clay-600 dark:text-clay-200 font-display font-semibold shrink-0">
                            {product.image_urls && product.image_urls.length > 0 ? (
                              <img src={product.image_urls[0]} alt={product.name} className="w-full h-full object-cover rounded-md" />
                            ) : (
                              <Package className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-ink dark:text-white max-w-[200px] truncate">
                              {product.name}
                            </div>
                            <div className="text-[12.5px] text-ink-muted dark:text-green-100/60 flex items-center gap-1 mt-0.5">
                              <Tag className="w-3 h-3" /> {product.category_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                           <Building2 className="w-4 h-4 text-ink-faint" />
                           <span className="text-[13.5px] font-medium text-ink dark:text-white/90">{product.business_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-[13.5px] font-medium text-green-900 dark:text-white">
                            {product.price} FBU
                          </span>
                          <span className="text-[12px] text-ink-muted dark:text-green-100/60 mt-0.5">
                            Stock: {product.stock}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {product.is_active ? (
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-green-100 text-green-700 dark:bg-success/20 dark:text-green-100">
                             <CheckCircle2 className="w-3 h-3" /> Actif
                           </span>
                        ) : (
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-paper text-ink-muted border border-border dark:bg-black/20 dark:text-green-100/60 dark:border-white/10">
                             <XCircle className="w-3 h-3" /> Inactif
                           </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-[13px] text-ink-muted dark:text-white/70">
                          {formattedDate}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="icon-btn">
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
      </div>
    </div>
  );
}
