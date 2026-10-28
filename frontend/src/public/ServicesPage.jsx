import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Phone, Clock, Mail, Filter, Search, Package, History } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../shared/api';
import providerService from '../services/providerService';
import useSiteContent from '../shared/useSiteContent';

const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);

function locationLabel(provider) {
  return (
    provider.address
    || [provider.commune, provider.province].filter(Boolean).join(', ')
    || provider.coverage_zones
    || 'Burundi'
  );
}

export default function ServicesPage() {
  const { settings } = useSiteContent();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [providers, setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [term, setTerm] = useState('');

  const category = params.get('category') || '';
  const commune = params.get('commune') || '';
  const page = Math.max(1, Number(params.get('page') || '1') || 1);
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [count, setCount] = useState(0);
  const [communes, setCommunes] = useState([]);
  const skipTermPageReset = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(term.trim());
      if (skipTermPageReset.current) {
        skipTermPageReset.current = false;
        return;
      }
      if (params.get('page')) {
        const next = new URLSearchParams(params);
        next.delete('page');
        setParams(next);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      providerService.listProviders({
        q: debouncedTerm,
        category,
        commune,
        page,
      }),
      api.get('business-categories/?used=1&modules=services').catch(() => []),
    ])
      .then(([rows, catData]) => {
        const list = Array.isArray(rows) ? rows : rows?.results || [];
        const total = Array.isArray(rows) ? list.length : Number(rows?.count || list.length);
        setProviders(list);
        setCount(total);
        setCommunes((current) => (Array.isArray(rows?.communes) ? rows.communes : current));
        setCategories(normalize(catData).filter((row) => row.module === 'services' && row.parent));
        setError('');
        const pages = Math.max(1, Math.ceil(total / 24));
        if (page > pages) goToPage(pages);
      })
      .catch((err) => setError(err.message || 'Annuaire indisponible'))
      .finally(() => setLoading(false));
  }, [debouncedTerm, category, commune, page]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  };

  const resetFilters = () => {
    setTerm('');
    setParams(new URLSearchParams());
  };

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(params);
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    setParams(next);
  };

  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const visible = providers;

  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-primary border-b border-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {settings?.services_page_title || 'Services'}
          </h1>
          <p className="text-white/85">
            {settings?.services_page_subtitle || 'Entreprises actives et approuvées sur Isoko Hub'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <Filter className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-ink">Filtres</h3>
              </div>

              <div className="mb-6 search-panel">
                <label className="block text-sm font-medium text-gray-700 mb-2">Recherche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Nom, service, lieu…"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setFilter('category', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">Toutes</option>
                  {categories.map((row) => (
                    <option key={row.id} value={row.slug}>{row.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Localité</label>
                <select
                  value={commune}
                  onChange={(e) => setFilter('commune', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">Toutes</option>
                  {communes.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="w-full text-primary hover:text-secondary font-medium py-2 text-sm"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">
                {loading ? 'Chargement…' : `${count} entreprise(s)`}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 animate-pulse">
                    <div className="flex gap-4 mb-4">
                      <div className="w-20 h-20 rounded-xl bg-gray-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/4" />
                      </div>
                    </div>
                  </div>
                ))
              ) : visible.map((provider) => (
                <div key={provider.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-6">
                  <div className="flex gap-4 mb-4">
                    <div className="w-20 h-20 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center overflow-hidden">
                      {provider.logo ? (
                        <img src={provider.logo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-extrabold text-primary">
                          {(provider.name || '?').trim().slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-ink text-lg truncate">{provider.name}</h3>
                        <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full shrink-0">
                          {provider.category_name || 'Service'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {provider.about || 'Aucune description.'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-ink">
                      <MapPin className="w-4 h-4 shrink-0 text-primary" />
                      <span className="truncate">{locationLabel(provider)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-ink font-semibold">
                      <Phone className="w-4 h-4 shrink-0 text-primary" />
                      {provider.phone ? (
                        <a href={`tel:${String(provider.phone).replace(/\s/g, '')}`}>{provider.phone}</a>
                      ) : '—'}
                    </div>
                    {provider.email ? (
                      <a href={`mailto:${provider.email}`} className="flex items-center gap-2 text-ink font-semibold sm:col-span-2 min-w-0">
                        <Mail className="w-4 h-4 shrink-0 text-primary" />
                        <span className="truncate">{provider.email}</span>
                      </a>
                    ) : null}
                    <div className="flex items-center gap-2 text-ink sm:col-span-2">
                      <Clock className="w-4 h-4 shrink-0 text-primary" />
                      {provider.opening_hours || 'Horaires sur demande'}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/businesses/${provider.business_id}/historique`)}
                      className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition inline-flex items-center gap-1.5"
                      title="Mon historique"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(
                        `/services/providers/${provider.business_id}${category ? `?from=${encodeURIComponent(category)}` : ''}`,
                      )}
                      className="flex-1 bg-primary hover:bg-secondary text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <Package className="w-4 h-4" />
                      Entrer
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!loading && pageCount > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                  className="px-4 py-2 border border-gray-200 rounded-lg font-medium disabled:opacity-40"
                >
                  Précédent
                </button>
                <span className="text-sm text-gray-600">Page {page} / {pageCount}</span>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => goToPage(page + 1)}
                  className="px-4 py-2 border border-gray-200 rounded-lg font-medium disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            )}
            {!loading && visible.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                Aucune entreprise active et approuvée ne correspond à ces filtres.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
