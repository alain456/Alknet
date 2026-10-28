import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Download, Briefcase, Tag, CheckCircle2, XCircle, Clock, Power } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';

const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);

export default function AdminServicesPage() {
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => (searchParams.get('status') || '').toUpperCase());
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const next = (searchParams.get('status') || '').toUpperCase();
    setStatusFilter(['ACTIVE', 'DRAFT', 'SUSPENDED'].includes(next) ? next : '');
    setPage(1);
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        page_size: '20',
      });
      if (debouncedSearch) query.set('q', debouncedSearch);
      if (statusFilter) query.set('status', statusFilter);
      const data = await api.get(`services/admin/list/?${query.toString()}`, {
        auth: true,
        headers: { Authorization: `Bearer ${token}` },
      });
      setServices(normalize(data));
      setCount(Array.isArray(data) ? normalize(data).length : Number(data?.count || 0));
    } catch (err) {
      setError(err.message || 'Impossible de charger les services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, page, debouncedSearch, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (service, status) => {
    setBusyId(service.id);
    setMessage('');
    setError(null);
    try {
      const updated = await api.post(
        `services/admin/${service.id}/status/`,
        { status },
        { auth: true, headers: { Authorization: `Bearer ${token}` } },
      );
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

  const groups = useMemo(() => {
    const byProvider = new Map();
    services.forEach((service) => {
      const key = service.provider_name || 'Sans prestataire';
      if (!byProvider.has(key)) {
        byProvider.set(key, {
          provider: key,
          category: service.category_name || '',
          services: [],
        });
      }
      byProvider.get(key).services.push({
        ...service,
        nested: service.grouped_services || [],
      });
    });
    return [...byProvider.values()];
  }, [services]);

  const flattened = groups.flatMap((group) => group.services);

  const exportCsv = () => {
    const rows = [
      ['Prestataire', 'Catégorie entreprise', 'Service', 'Sous-services', 'Prix', 'Statut', 'Créé le'],
      ...flattened.map((s) => [
        s.provider_name || '',
        s.category_name || '',
        s.title,
        (s.nested || []).map((item) => item.title).join(' · '),
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
            Chaque prestataire groupe ses services et sous-services. La catégorie est celle de l’entreprise ({count}).
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

      <div className="search-panel flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="text"
            placeholder="Rechercher un service, un sous-service ou un prestataire…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-[13px] bg-surface border border-border rounded-md text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-[13px] border border-border rounded-md bg-surface w-full sm:w-auto"
        >
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actifs</option>
          <option value="DRAFT">Brouillons</option>
          <option value="SUSPENDED">Suspendus</option>
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-700" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-ink-muted py-8 text-center">Aucun service trouvé.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.provider} className="bg-white rounded-2xl overflow-hidden">
              <header className="px-5 py-3 bg-paper flex flex-wrap items-center gap-2">
                <Briefcase className="w-4 h-4 text-ink-muted" />
                <span className="font-semibold text-ink">{group.provider}</span>
                {group.category && (
                  <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-muted">
                    <Tag className="w-3 h-3" /> {group.category}
                  </span>
                )}
              </header>
              <div className="divide-y divide-border">
                {group.services.map((service) => (
                  <article key={service.id} className="px-5 py-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-ink">{service.title}</p>
                        <p className="text-[12.5px] text-ink-muted mt-0.5">
                          {service.price != null && service.price !== ''
                            ? `${Number(service.price).toLocaleString('fr-BI')} BIF`
                            : 'Sur devis'}
                          {service.created_at ? ` · ${new Date(service.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(service.status)}
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
                    </div>
                    {(service.nested || []).length === 0 ? (
                      <p className="text-sm text-ink-muted pl-3 border-l-2 border-border">Sans sous-service</p>
                    ) : (
                      <ul className="pl-3 border-l-2 border-primary space-y-1.5">
                        {(service.nested || []).map((item) => (
                          <li key={item.id} className="text-sm text-ink">
                            <span className="font-medium">{item.title}</span>
                            {item.status ? (
                              <span className="text-ink-muted"> · {item.status === 'ACTIVE' ? 'Actif' : item.status === 'SUSPENDED' ? 'Suspendu' : 'Brouillon'}</span>
                            ) : null}
                            {item.description ? (
                              <span className="text-ink-muted"> — {item.description}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
          {Math.ceil(count / 20) > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="px-3 py-2 border border-border rounded-lg text-sm font-semibold disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-sm text-ink-muted">Page {page} / {Math.max(1, Math.ceil(count / 20))}</span>
              <button
                type="button"
                disabled={page >= Math.ceil(count / 20)}
                onClick={() => setPage((current) => current + 1)}
                className="px-3 py-2 border border-border rounded-lg text-sm font-semibold disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
