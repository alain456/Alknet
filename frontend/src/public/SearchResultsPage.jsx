import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, MapPin, Package, Search, Stethoscope, Briefcase, ArrowRight } from 'lucide-react';
import api from '../shared/api';
import { visitorPosition } from './visitorPlace';

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
  const lat = params.get('lat') || '';
  const lng = params.get('lng') || '';
  const [draftQ, setDraftQ] = useState(q);
  const [draftLocation, setDraftLocation] = useState(location);
  const [near, setNear] = useState(lat && lng ? { lat, lng } : null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setDraftQ(q);
    setDraftLocation(location);
  }, [q, location]);

  useEffect(() => {
    if (location.trim()) {
      setNear(null);
      return undefined;
    }
    if (lat && lng) {
      setNear({ lat, lng });
      return undefined;
    }
    let cancelled = false;
    visitorPosition().then((point) => {
      if (!cancelled && point) setNear(point);
    });
    return () => { cancelled = true; };
  }, [location, lat, lng]);

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
    else if (near?.lat != null && near?.lng != null) {
      qs.set('lat', String(near.lat));
      qs.set('lng', String(near.lng));
    }
    api.get(`businesses/search/?${qs.toString()}`)
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Recherche impossible'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, location, near]);

  const submit = async (event) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (draftQ.trim()) next.set('q', draftQ.trim());
    if (draftLocation.trim()) {
      next.set('location', draftLocation.trim());
    } else {
      const point = await visitorPosition();
      if (point) {
        next.set('lat', String(point.lat));
        next.set('lng', String(point.lng));
      }
    }
    setTab('all');
    setParams(next);
  };

  const counts = Object.fromEntries(GROUPS.map(({ key }) => [key, data?.groups?.[key]?.length || 0]));
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const visibleGroups = GROUPS.filter(({ key }) => counts[key] > 0 && (tab === 'all' || tab === key));

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface">
      <div className="bg-surface border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Recherche</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink mb-5">
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
              tab === 'all' ? 'bg-accent text-ink border-accent' : 'bg-surface text-ink border-border'
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
                tab === key ? 'bg-accent text-ink border-accent' : 'bg-surface text-ink border-border'
              }`}
            >
              {label}{loading ? '' : ` · ${counts[key]}`}
            </button>
          ))}
          {data?.location && (
            <span className="text-sm text-ink-muted ml-1">Lieu : {data.location}</span>
          )}
          {!data?.location && data?.near && (
            <span className="text-sm text-ink-muted ml-1">Classé selon votre position</span>
          )}
        </div>

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}
        {loading && <p className="text-primary font-medium">Recherche en cours…</p>}

        {!loading && total === 0 && (q || location) && (
          <div className="bg-surface rounded-3xl border border-border px-6 py-14 text-center">
            <p className="text-lg font-bold text-ink">Aucun résultat</p>
            <p className="text-ink-muted mt-2">Essayez un autre mot ou élargissez le lieu.</p>
          </div>
        )}

        {visibleGroups.map(({ key, label, icon: Icon }) => (
          <section key={key} className="space-y-4">
            <h2 className="text-xl font-extrabold text-ink flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </span>
              {label}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(data?.groups?.[key] || []).map((row) => (
                <li key={`${row.kind}-${row.id}`}>
                  <Link
                    to={row.href}
                    className="group h-full flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm hover:border-primary hover:shadow-md transition"
                  >
                    <span className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-ink text-base">{row.title}</span>
                      <span className="block text-sm text-primary mt-0.5">{row.subtitle}</span>
                      {row.location && (
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
                          <MapPin className="w-3.5 h-3.5" /> {row.location}
                        </span>
                      )}
                    </span>
                    <ArrowRight className="w-4 h-4 text-primary mt-1 opacity-0 group-hover:opacity-100 transition shrink-0" />
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
