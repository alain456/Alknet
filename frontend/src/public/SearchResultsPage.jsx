import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, MapPin, Package, Search, Stethoscope, Briefcase, ArrowRight } from 'lucide-react';
import api from '../shared/api';

const GROUPS = [
  { key: 'businesses', label: 'Entreprises', icon: Building2 },
  { key: 'products', label: 'Produits', icon: Package },
  { key: 'services', label: 'Services', icon: Briefcase },
  { key: 'professionals', label: 'Professionnels', icon: Stethoscope },
];

export default function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const location = params.get('location') || '';
  const [draftQ, setDraftQ] = useState(q);
  const [draftLocation, setDraftLocation] = useState(location);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setDraftQ(q);
    setDraftLocation(location);
  }, [q, location]);

  useEffect(() => {
    if (!q.trim() && !location.trim()) {
      setData(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams();
    if (q.trim()) qs.set('q', q.trim());
    if (location.trim()) qs.set('location', location.trim());
    api.get(`businesses/search/?${qs.toString()}`)
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Recherche impossible'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, location]);

  const submit = (event) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (draftQ.trim()) next.set('q', draftQ.trim());
    if (draftLocation.trim()) next.set('location', draftLocation.trim());
    setTab('all');
    setParams(next);
  };

  const counts = Object.fromEntries(GROUPS.map(({ key }) => [key, data?.groups?.[key]?.length || 0]));
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const visibleGroups = GROUPS.filter(({ key }) => counts[key] > 0 && (tab === 'all' || tab === key));

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F4F7FB]">
      <div className="bg-white border-b border-[#D5E0F0]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <p className="text-xs font-bold uppercase tracking-wider text-[#32667F] mb-2">Recherche</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#132F45] mb-5">
            {q ? `Résultats pour « ${q} »` : 'Que cherchez-vous ?'}
          </h1>
          <form onSubmit={submit} className="hero-search bg-white p-2 rounded-full shadow-sm flex flex-col sm:flex-row sm:items-center gap-2 border-2 border-[#EA8B33]">
            <div className="flex-1 flex items-center gap-2 px-3 min-w-0">
              <Search className="w-5 h-5 text-[#EA8B33] shrink-0" />
              <input
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder="Profession, entreprise, restaurant, produit…"
                className="hero-search-input w-full py-2.5 outline-none text-base font-medium bg-transparent border-0"
              />
            </div>
            <div className="sm:w-52 flex items-center gap-2 px-3 sm:border-l border-[#D5E0F0]">
              <MapPin className="w-5 h-5 text-[#EA8B33] shrink-0" />
              <input
                value={draftLocation}
                onChange={(e) => setDraftLocation(e.target.value)}
                placeholder="Lieu"
                className="hero-search-input w-full py-2.5 outline-none text-base font-medium bg-transparent border-0"
              />
            </div>
            <button type="submit" className="bg-primary hover:opacity-95 text-white font-bold px-6 py-2.5 rounded-full shrink-0">
              Rechercher
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 pb-16 space-y-8">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border ${
              tab === 'all' ? 'bg-[#32667F] text-white border-[#32667F]' : 'bg-white text-[#32667F] border-[#D5E0F0]'
            }`}
          >
            Tout{loading ? '' : ` · ${total}`}
          </button>
          {GROUPS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border ${
                tab === key ? 'bg-[#32667F] text-white border-[#32667F]' : 'bg-white text-[#32667F] border-[#D5E0F0]'
              }`}
            >
              {label}{loading ? '' : ` · ${counts[key]}`}
            </button>
          ))}
          {data?.location && (
            <span className="text-sm text-[#4A6FA3] ml-1">Lieu : {data.location}</span>
          )}
        </div>

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}
        {loading && <p className="text-[#32667F] font-medium">Recherche en cours…</p>}

        {!loading && total === 0 && (q || location) && (
          <div className="bg-white rounded-3xl border border-[#D5E0F0] px-6 py-14 text-center">
            <p className="text-lg font-bold text-[#132F45]">Aucun résultat</p>
            <p className="text-[#4A6FA3] mt-2">Essayez un autre mot ou élargissez le lieu.</p>
          </div>
        )}

        {visibleGroups.map(({ key, label, icon: Icon }) => (
          <section key={key} className="space-y-4">
            <h2 className="text-xl font-extrabold text-[#132F45] flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-[#E7EEF8] text-[#32667F] flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </span>
              {label}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(data?.groups?.[key] || []).map((row) => (
                <li key={`${row.kind}-${row.id}`}>
                  <Link
                    to={row.href}
                    className="group h-full flex items-start gap-4 rounded-2xl border border-[#D5E0F0] bg-white p-5 shadow-sm hover:border-[#32667F] hover:shadow-md transition"
                  >
                    <span className="w-11 h-11 rounded-2xl bg-[#E7EEF8] text-[#32667F] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-[#132F45] text-base">{row.title}</span>
                      <span className="block text-sm text-[#32667F] mt-0.5">{row.subtitle}</span>
                      {row.location && (
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#4A6FA3]">
                          <MapPin className="w-3.5 h-3.5" /> {row.location}
                        </span>
                      )}
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#32667F] mt-1 opacity-0 group-hover:opacity-100 transition shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
