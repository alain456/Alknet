import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Briefcase, Tag, CheckCircle2, XCircle, Clock, Power } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';

const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);

export default function AdminServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  const { token } = useAuth();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('services/admin/list/', { auth: true });
      setServices(normalize(data));
    } catch (err) {
      setError(err.message || 'Impossible de charger les services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (service, status) => {
    setBusyId(service.id);
    setMessage('');
    setError(null);
    try {
      const updated = await api.post(`services/admin/${service.id}/status/`, { status }, { auth: true });
      setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, ...updated } : s)));
      setMessage(`« ${service.title} » → ${status}`);
    } catch (err) {
      setError(err.message || 'Action impossible');
    } finally {
      setBusyId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3" /> Actif
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-error">
            <XCircle className="w-3 h-3" /> Suspendu
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-paper text-ink-muted border border-border">
            <Clock className="w-3 h-3" /> Brouillon
          </span>
        );
    }
  };

  const filteredServices = services.filter((s) => {
    const hay = `${s.title || ''} ${s.provider_name || ''} ${s.category_name || ''}`.toLowerCase();
    if (searchTerm && !hay.includes(searchTerm.toLowerCase())) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  const exportCsv = () => {
    const rows = [
      ['Titre', 'Prestataire', 'Catégorie', 'Prix', 'Statut', 'Créé le'],
      ...filteredServices.map((s) => [
        s.title,
        s.provider_name || '',
        s.category_name || '',
        s.price ?? '',
        s.status,
        s.created_at ? new Date(s.created_at).toISOString() : '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'services-isoko.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-350 mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-green-900 dark:text-white tracking-tight">Services</h1>
          <p className="text-[15px] text-ink-muted dark:text-green-100/70 mt-1">
            Supervisez les prestations proposées sur la plateforme ({services.length}).
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="px-4 py-2 flex items-center gap-2 text-[14px] font-semibold bg-surface border border-border text-green-700 rounded-md hover:bg-green-50 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" /> Exporter
        </button>
      </div>

      {message && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{message}</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 text-error text-sm">{error}</div>}

      <div className="border border-border dark:border-white/10 rounded-[10px] bg-surface dark:bg-[#1A2E25] overflow-hidden shadow-sm flex flex-col">
        <div className="px-5 py-4 border-b border-border dark:border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-paper dark:bg-black/10">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Rechercher un service ou un prestataire…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-[13px] bg-surface border border-border rounded-md text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-[13px] border border-border rounded-md bg-surface"
          >
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="DRAFT">Brouillons</option>
            <option value="SUSPENDED">Suspendus</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-[11px] text-ink-faint uppercase tracking-[0.05em] bg-paper/50">
                <th className="px-6 py-4 font-semibold">Service</th>
                <th className="px-6 py-4 font-semibold">Prestataire</th>
                <th className="px-6 py-4 font-semibold">Prix</th>
                <th className="px-6 py-4 font-semibold">Statut</th>
                <th className="px-6 py-4 font-semibold">Créé le</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-700" /></td></tr>
              ) : filteredServices.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-ink-muted text-sm">Aucun service trouvé.</td></tr>
              ) : (
                filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-green-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-[14px] font-semibold text-ink max-w-[220px] truncate">{service.title}</div>
                      <div className="text-[12.5px] text-ink-muted flex items-center gap-1 mt-0.5">
                        <Tag className="w-3 h-3" /> {service.category_name || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-ink-faint" />
                        <span className="text-[13.5px] font-medium">{service.provider_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[13.5px]">
                      {service.price != null && service.price !== ''
                        ? `${Number(service.price).toLocaleString('fr-BI')} BIF`
                        : 'Sur devis'}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(service.status)}</td>
                    <td className="px-6 py-4 font-mono text-[13px] text-ink-muted">
                      {service.created_at
                        ? new Date(service.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-1">
                        {service.status !== 'ACTIVE' && (
                          <button
                            type="button"
                            disabled={busyId === service.id}
                            onClick={() => setStatus(service, 'ACTIVE')}
                            className="px-2.5 py-1.5 text-xs font-semibold text-success hover:bg-green-50 rounded-lg disabled:opacity-50"
                            title="Activer"
                          >
                            <Power className="w-4 h-4 inline" /> Activer
                          </button>
                        )}
                        {service.status === 'ACTIVE' && (
                          <button
                            type="button"
                            disabled={busyId === service.id}
                            onClick={() => setStatus(service, 'SUSPENDED')}
                            className="px-2.5 py-1.5 text-xs font-semibold text-error hover:bg-red-50 rounded-lg disabled:opacity-50"
                            title="Suspendre"
                          >
                            Suspendre
                          </button>
                        )}
                        {service.status === 'SUSPENDED' && (
                          <button
                            type="button"
                            disabled={busyId === service.id}
                            onClick={() => setStatus(service, 'DRAFT')}
                            className="px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-paper rounded-lg disabled:opacity-50"
                          >
                            Brouillon
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
