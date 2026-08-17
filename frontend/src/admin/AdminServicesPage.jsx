import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, MoreHorizontal, Briefcase, Tag, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/services/admin/list/', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch services');
        const data = await response.json();
        setServices(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [token]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-green-100 text-green-700 dark:bg-success/20 dark:text-green-100">
            <CheckCircle2 className="w-3 h-3" /> Actif
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-clay-100 text-clay-600 dark:bg-error/20 dark:text-red-200">
            <XCircle className="w-3 h-3" /> Suspendu
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-paper text-ink-muted border border-border dark:bg-black/20 dark:text-green-100/60 dark:border-white/10">
            <Clock className="w-3 h-3" /> Brouillon
          </span>
        );
    }
  };

  const filteredServices = services.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.provider_name && s.provider_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-350 mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-green-900 dark:text-white tracking-tight">Services</h1>
          <p className="text-[15px] text-ink-muted dark:text-green-100/70 mt-1">Supervisez les prestations proposées sur la plateforme.</p>
        </div>
        <button className="px-4 py-2 flex items-center gap-2 text-[14px] font-semibold bg-surface dark:bg-transparent border-[1.5px] border-border dark:border-white/20 text-green-700 dark:text-green-100 rounded-md hover:bg-green-50 dark:hover:bg-white/5 transition-colors shadow-sm">
          <Download className="w-4 h-4" /> Exporter
        </button>
      </div>

      {/* Table Container */}
      <div className="border border-border dark:border-white/10 rounded-[10px] bg-surface dark:bg-[#1A2E25] overflow-hidden shadow-sm flex flex-col">
        
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-border dark:border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-paper dark:bg-black/10">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input 
              type="text" 
              placeholder="Rechercher un service ou un prestataire..."
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
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Service</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Prestataire</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Prix</th>
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
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-ink-muted dark:text-green-100/60 text-[14px]">
                    Aucun service trouvé.
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => {
                  const date = new Date(service.created_at);
                  const formattedDate = `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

                  return (
                    <tr key={service.id} className="hover:bg-green-50/50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-[14px] font-semibold text-ink dark:text-white max-w-[200px] truncate">
                          {service.title}
                        </div>
                        <div className="text-[12.5px] text-ink-muted dark:text-green-100/60 flex items-center gap-1 mt-0.5">
                          <Tag className="w-3 h-3" /> {service.category_name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <Briefcase className="w-4 h-4 text-ink-faint" />
                           <span className="text-[13.5px] font-medium text-ink dark:text-white/90">{service.provider_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-[13.5px] font-medium text-green-900 dark:text-white">
                          {service.price ? `${service.price} FBU` : 'Sur devis'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(service.status)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-[13px] text-ink-muted dark:text-white/70">
                          {formattedDate}
                        </span>
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
      </div>
    </div>
  );
}
