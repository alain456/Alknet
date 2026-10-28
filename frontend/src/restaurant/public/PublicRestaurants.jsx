import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Search, Utensils } from 'lucide-react';
import restaurantService, { listOf } from '../restaurantService';

const KINDS = [
  { value: '', label: 'Tous' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'BAR', label: 'Bar' },
  { value: 'CAFE', label: 'Café' },
  { value: 'TRAITEUR', label: 'Traiteur' },
];

const emptyFilters = { q: '', destination: '', venue_kind: '' };

const fieldClass =
  'w-full px-3 py-2.5 text-sm bg-surface border-0 outline-none text-ink font-medium placeholder:text-ink-muted/70';

export default function PublicRestaurants() {
  const [venues, setVenues] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (params = filters) => {
    setLoading(true);
    setErr('');
    restaurantService.publicVenues(params)
      .then((d) => setVenues(listOf(d)))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(emptyFilters); }, []);

  const submit = (e) => {
    e.preventDefault();
    load(filters);
  };

  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="relative overflow-hidden min-h-[min(56vh,420px)] flex flex-col justify-end">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 20% 10%, #EA8B33 0%, transparent 45%), radial-gradient(ellipse at 90% 80%, #32667F 0%, transparent 50%), linear-gradient(160deg, #132F45 0%, #153a75 40%, #4a1512 100%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
        <div className="relative max-w-5xl mx-auto w-full px-4 pt-16 pb-10 space-y-6">
          <div className="school-dash-hero max-w-xl space-y-3">
            <p className="text-sm font-bold text-accent uppercase tracking-[0.2em]">Isoko Hub</p>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.1] tracking-tight">
              Tables, cafés et saveurs
            </h1>
            <p className="text-base sm:text-lg font-medium max-w-md">
              Restaurants, bars, cafés et traiteurs — pas les hôtels.
            </p>
          </div>
          <form
            onSubmit={submit}
            className="search-panel bg-surface rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="flex flex-col lg:flex-row lg:items-stretch divide-y lg:divide-y-0 lg:divide-x divide-accent/20">
              <label className="flex-1 min-w-0 px-4 py-3 flex items-start gap-2.5 cursor-text">
                <Search className="w-5 h-5 text-accent shrink-0 mt-2" />
                <span className="block w-full">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-muted">Recherche</span>
                  <input
                    className={fieldClass}
                    placeholder="Nom, cuisine…"
                    value={filters.q}
                    onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  />
                </span>
              </label>
              <label className="flex-1 min-w-0 px-4 py-3 flex items-start gap-2.5 cursor-text">
                <MapPin className="w-5 h-5 text-accent shrink-0 mt-2" />
                <span className="block w-full">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-muted">Lieu</span>
                  <input
                    className={fieldClass}
                    placeholder="Ville, commune…"
                    value={filters.destination}
                    onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
                  />
                </span>
              </label>
              <label className="flex-1 min-w-0 px-4 py-3 flex items-start gap-2.5">
                <Utensils className="w-5 h-5 text-accent shrink-0 mt-2" />
                <span className="block w-full">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-muted">Type</span>
                  <select
                    className={fieldClass}
                    value={filters.venue_kind}
                    onChange={(e) => setFilters({ ...filters, venue_kind: e.target.value })}
                  >
                    {KINDS.map((row) => <option key={row.value || 'all'} value={row.value}>{row.label}</option>)}
                  </select>
                </span>
              </label>
              <button type="submit" className="px-6 py-3 bg-accent text-ink font-extrabold text-sm hover:opacity-95">
                Chercher
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        {err && <p className="text-error text-sm">{err}</p>}
        {loading && <p className="text-ink-muted">Chargement…</p>}
        {!loading && venues.length === 0 && (
          <p className="text-ink-muted">Aucun établissement pour ces critères.</p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {venues.map((row) => (
            <Link
              key={row.id}
              to={`/restaurants/${row.id}`}
              className="bg-surface rounded-2xl p-4 hover:shadow-md transition space-y-2"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-accent">
                {row.venue_kind_label || 'Restaurant'}
              </p>
              <h2 className="text-lg font-extrabold text-ink">{row.trade_name || row.name}</h2>
              {row.cuisine_type ? <p className="text-sm text-ink-muted">{row.cuisine_type}</p> : null}
              <p className="text-sm text-ink-muted flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span>{row.address || 'Adresse non renseignée'}</span>
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
