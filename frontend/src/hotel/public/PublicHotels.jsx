import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Search, Star, BadgeCheck, Users, CalendarDays, SlidersHorizontal, BedDouble,
} from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import { amenityIcon } from './hotelAmenityIcon';

const EST_TYPES = [
  { value: '', label: 'Tous types' },
  { value: 'HOTEL', label: 'Hôtel' },
  { value: 'GUEST_HOUSE', label: 'Guest house' },
  { value: 'LODGE', label: 'Lodge' },
  { value: 'RESIDENCE', label: 'Résidence' },
  { value: 'HOSTEL', label: 'Auberge' },
];

const emptyFilters = {
  q: '',
  destination: '',
  check_in: '',
  check_out: '',
  guests: '',
  budget_max: '',
  establishment_type: '',
  stars_min: '',
};

const fieldClass =
  'w-full px-3 py-2.5 text-sm bg-surface border-0 outline-none text-ink font-medium placeholder:text-ink-muted/70';

export default function PublicHotels() {
  const [hotels, setHotels] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMore, setShowMore] = useState(false);

  const load = (params = filters) => {
    setLoading(true);
    setErr('');
    hotelService.publicHotels(params)
      .then((d) => setHotels(listOf(d)))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(emptyFilters); }, []);

  const submit = (e) => {
    e.preventDefault();
    load(filters);
  };

  const typeLabel = (t) => EST_TYPES.find((x) => x.value === t)?.label || t || 'Hôtel';

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* Hero full-bleed */}
      <div className="relative overflow-hidden min-h-[min(72vh,560px)] flex flex-col justify-end">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 20% 10%, #1E8B4A 0%, transparent 45%), radial-gradient(ellipse at 90% 80%, #1B4F9C 0%, transparent 50%), linear-gradient(160deg, #0d2347 0%, #153a75 40%, #4a1512 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.35\'/%3E%3C/svg%3E")',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />

        <div className="relative max-w-5xl mx-auto w-full px-4 pt-16 pb-10 space-y-6">
          <div className="max-w-xl space-y-3 animate-[fadeIn_0.7s_ease-out]">
            <p className="text-sm font-bold text-accent uppercase tracking-[0.2em]">Isoko Hub</p>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold text-surface leading-[1.1] tracking-tight">
              Votre séjour commence ici
            </h1>
            <p className="text-base sm:text-lg text-surface/85 font-medium max-w-md">
              Hôtels, lodges et guest houses — trouvez l&apos;adresse idéale au Burundi.
            </p>
          </div>

          {/* Barre recherche type Booking */}
          <form
            onSubmit={submit}
            className="bg-surface rounded-2xl shadow-xl border-2 border-accent/30 overflow-hidden animate-[fadeIn_0.9s_ease-out]"
          >
            <div className="flex flex-col lg:flex-row lg:items-stretch divide-y lg:divide-y-0 lg:divide-x divide-accent/20">
              <label className="flex-1 min-w-0 px-4 py-3 flex items-start gap-2.5 cursor-text">
                <MapPin className="w-5 h-5 text-accent shrink-0 mt-2" />
                <span className="block w-full">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-muted">Destination</span>
                  <input
                    className={fieldClass}
                    placeholder="Ville, commune…"
                    value={filters.destination}
                    onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
                  />
                </span>
              </label>
              <label className="flex-1 min-w-0 px-4 py-3 flex items-start gap-2.5 cursor-text">
                <CalendarDays className="w-5 h-5 text-accent shrink-0 mt-2" />
                <span className="block w-full">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-muted">Arrivée</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={filters.check_in}
                    onChange={(e) => setFilters({ ...filters, check_in: e.target.value })}
                  />
                </span>
              </label>
              <label className="flex-1 min-w-0 px-4 py-3 flex items-start gap-2.5 cursor-text">
                <CalendarDays className="w-5 h-5 text-accent shrink-0 mt-2" />
                <span className="block w-full">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-muted">Départ</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={filters.check_out}
                    onChange={(e) => setFilters({ ...filters, check_out: e.target.value })}
                  />
                </span>
              </label>
              <label className="flex-1 min-w-0 px-4 py-3 flex items-start gap-2.5 cursor-text">
                <Users className="w-5 h-5 text-accent shrink-0 mt-2" />
                <span className="block w-full">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-muted">Voyageurs</span>
                  <input
                    type="number"
                    min="1"
                    className={fieldClass}
                    placeholder="Adultes"
                    value={filters.guests}
                    onChange={(e) => setFilters({ ...filters, guests: e.target.value })}
                  />
                </span>
              </label>
              <div className="px-3 py-3 flex items-center">
                <button
                  type="submit"
                  className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-extrabold bg-primary text-surface rounded-xl border-2 border-accent hover:opacity-95 transition"
                >
                  <Search className="w-4 h-4" /> Rechercher
                </button>
              </div>
            </div>

            <div className="px-4 py-2 border-t border-accent/15 bg-primary/5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {showMore ? 'Masquer les filtres' : 'Plus de filtres'}
              </button>
              {showMore && (
                <div className="w-full grid sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 pb-1">
                  <input
                    className="px-3 py-2 text-sm border-2 border-accent rounded-xl bg-surface outline-none focus:border-alert"
                    placeholder="Mot-clé (nom…)"
                    value={filters.q}
                    onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  />
                  <select
                    className="px-3 py-2 text-sm border-2 border-accent rounded-xl bg-surface outline-none"
                    value={filters.establishment_type}
                    onChange={(e) => setFilters({ ...filters, establishment_type: e.target.value })}
                  >
                    {EST_TYPES.map((t) => (
                      <option key={t.value || 'all'} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    className="px-3 py-2 text-sm border-2 border-accent rounded-xl bg-surface outline-none"
                    placeholder="Budget max / nuit (BIF)"
                    value={filters.budget_max}
                    onChange={(e) => setFilters({ ...filters, budget_max: e.target.value })}
                  />
                  <select
                    className="px-3 py-2 text-sm border-2 border-accent rounded-xl bg-surface outline-none"
                    value={filters.stars_min}
                    onChange={(e) => setFilters({ ...filters, stars_min: e.target.value })}
                  >
                    <option value="">Étoiles (min.)</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}+ ★</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-primary">Établissements</h2>
            <p className="text-sm text-ink-muted font-medium mt-0.5">
              {loading ? 'Recherche…' : `${hotels.length} résultat${hotels.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {err && <p className="text-alert font-bold">{err}</p>}

        {!loading && (
          <div className="grid sm:grid-cols-2 gap-5">
            {hotels.map((h) => {
              const cover = h.cover_photo || h.logo || '';
              const am = Array.isArray(h.amenities) ? h.amenities.slice(0, 4) : [];
              return (
                <Link
                  key={h.id}
                  to={`/hotels/${h.id}`}
                  className="group block rounded-2xl overflow-hidden border-2 border-accent/40 bg-surface shadow-sm hover:shadow-md hover:border-accent transition duration-300"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-primary/10">
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary to-[#1a0c0b]">
                        <BedDouble className="w-12 h-12 text-accent/60" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-surface/95 text-primary">
                        {typeLabel(h.establishment_type)}
                      </span>
                      {h.classification_verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800">
                          <BadgeCheck className="w-3 h-3" /> Vérifié
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                      <div>
                        {h.stars ? (
                          <p className="inline-flex items-center gap-0.5 text-accent font-bold text-sm drop-shadow">
                            {Array.from({ length: Number(h.stars) }).map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 fill-accent text-accent" />
                            ))}
                          </p>
                        ) : null}
                        <p className="text-lg font-extrabold text-surface drop-shadow-sm leading-tight">
                          {h.trade_name || h.name}
                        </p>
                      </div>
                      <p className="shrink-0 px-2.5 py-1.5 rounded-xl bg-accent text-surface text-xs font-extrabold shadow">
                        dès {Number(h.from_price || 0).toLocaleString('fr-FR')} {h.currency || 'BIF'}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm text-ink-muted flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                      {h.city || h.address || '—'}
                    </p>
                    {h.description ? (
                      <p className="text-xs text-ink-muted line-clamp-2">{h.description}</p>
                    ) : null}
                    {am.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {am.map((a) => {
                          const Icon = amenityIcon(a);
                          return (
                            <span
                              key={a}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-ink bg-primary/5 border border-accent/30"
                            >
                              <Icon className="w-3 h-3 text-accent" /> {a}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {h.available_for_dates != null && (
                      <p className="text-xs font-bold text-emerald-700">
                        {h.available_for_dates} type(s) dispo. aux dates choisies
                      </p>
                    )}
                    <p className="text-xs font-bold text-accent pt-1 group-hover:underline">
                      Voir l&apos;établissement →
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && !hotels.length && !err && (
          <p className="text-ink-muted text-center py-14 font-medium">
            Aucun établissement ne correspond à votre recherche.
          </p>
        )}
      </div>
    </div>
  );
}
