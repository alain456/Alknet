import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  GraduationCap, MapPin, Search, Building2, ArrowRight,
} from 'lucide-react';
import educationService from './educationService';
import { loadEducationEnums } from './educationEnums';
import { api } from '../shared/api';

const TYPE_ICONS = {
  UNIVERSITY: GraduationCap,
  SCHOOL: Building2,
  TRAINING_CENTER: Building2,
  PRIVATE_LESSONS: Building2,
  OTHER: Building2,
};

function distanceKm(lat1, lon1, lat2, lon2) {
  const radius = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function EducationDirectory() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [facets, setFacets] = useState({ domains: [], levels: [], faculties: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [term, setTerm] = useState(params.get('q') || '');
  const [categories, setCategories] = useState([]);
  const [places, setPlaces] = useState([]);
  const [tags, setTags] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [locating, setLocating] = useState(false);

  const type = params.get('category') || '';
  const track = params.get('track') || '';
  const province = params.get('province') || '';
  const commune = params.get('commune') || '';
  const q = params.get('q') || '';
  const faculty = params.get('faculty') || '';
  const domain = params.get('domain') || '';
  const level = params.get('level') || '';

  useEffect(() => {
    api.get('business-categories/').then((data) => {
      const rows = Array.isArray(data) ? data : (data?.results || []);
      const parentIds = new Set(
        rows.filter((c) => c.module === 'education' && !c.parent).map((c) => String(c.id)),
      );
      setCategories(
        rows.filter((c) => c.module === 'education' && c.parent && parentIds.has(String(c.parent))),
      );
    }).catch(() => setCategories([]));
    api.get('locations/tree/').then((data) => {
      setPlaces(Array.isArray(data) ? data : []);
    }).catch(() => setPlaces([]));
    loadEducationEnums().then((data) => setTags(data.particularities || []));
  }, []);

  const communes = useMemo(() => {
    const match = places.find((p) => p.name === province);
    return match?.communes || [];
  }, [places, province]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, offer, facetData] = await Promise.all([
        educationService.listEstablishments({ category: type, q, province, commune, track }),
        educationService.listPublicPrograms({ q, province, commune, faculty, domain, level }),
        educationService.programFacets({ province, commune }),
      ]);
      setRows(Array.isArray(data) ? data : (data?.results || []));
      setPrograms(Array.isArray(offer) ? offer : (offer?.results || []));
      setFacets(facetData || { domains: [], levels: [], faculties: [] });
      setError('');
    } catch (e) {
      setError(e.message || 'Annuaire indisponible');
    } finally {
      setLoading(false);
    }
  }, [type, q, province, commune, faculty, domain, level, track]);

  useEffect(() => { load(); }, [load]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const submit = (e) => {
    e.preventDefault();
    setParam('q', term.trim());
  };

  const setProvince = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('province', value);
    else next.delete('province');
    next.delete('commune');
    setParams(next);
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
      <div className="bg-gradient-to-r from-primary to-secondary p-6 sm:p-8 rounded-3xl text-white shadow-lg">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-white/15">
            <GraduationCap className="w-8 h-8" />
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Établissements d&apos;enseignement</h1>
            <p className="text-green-100 text-sm mt-1">
              Universités, écoles, centres de formation et cours particuliers au Burundi.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Rechercher un établissement, une formation…"
              className="w-full pl-9 pr-3 py-3 rounded-xl text-sm text-ink bg-surface focus:outline-none"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setParam('category', e.target.value)}
            aria-label="Catégorie"
            className="px-3 py-3 rounded-xl text-sm bg-surface text-ink focus:outline-none lg:min-w-[220px]"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <select
            value={track}
            onChange={(e) => setParam('track', e.target.value)}
            aria-label="Parcours scolaire"
            className="px-3 py-3 rounded-xl text-sm bg-surface text-ink focus:outline-none lg:min-w-[220px]"
          >
            <option value="">Tous les parcours</option>
            <option value="prescolaire">Enseignement préscolaire</option>
            <option value="ecofo">École fondamentale (ECOFO)</option>
            <option value="post">Post-fondamental</option>
            <option value="both">Les deux</option>
          </select>
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-emerald-950 text-sm font-bold"
          >
            Rechercher
          </button>
        </form>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            aria-label="Province"
            className="px-3 py-3 rounded-xl text-sm bg-surface text-ink focus:outline-none flex-1"
          >
            <option value="">Toutes les provinces</option>
            {places.map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
          <select
            value={commune}
            onChange={(e) => setParam('commune', e.target.value)}
            aria-label="Commune"
            disabled={!province}
            className="px-3 py-3 rounded-xl text-sm bg-surface text-ink focus:outline-none flex-1 disabled:opacity-60"
          >
            <option value="">Toutes les communes</option>
            {communes.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={locate}
            className="px-4 py-3 rounded-xl bg-white/15 text-sm font-semibold"
          >
            {locating ? 'Localisation…' : 'Depuis ma position'}
          </button>
        </div>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <select
            value={faculty}
            onChange={(e) => setParam('faculty', e.target.value)}
            aria-label="Faculté"
            className="px-3 py-3 rounded-xl text-sm bg-surface text-ink focus:outline-none flex-1"
          >
            <option value="">Toutes les facultés</option>
            {(facets.faculties || []).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={domain}
            onChange={(e) => setParam('domain', e.target.value)}
            aria-label="Domaine"
            className="px-3 py-3 rounded-xl text-sm bg-surface text-ink focus:outline-none flex-1"
          >
            <option value="">Tous les domaines</option>
            {(facets.domains || []).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={level}
            onChange={(e) => setParam('level', e.target.value)}
            aria-label="Niveau"
            className="px-3 py-3 rounded-xl text-sm bg-surface text-ink focus:outline-none flex-1"
          >
            <option value="">Tous les niveaux</option>
            {(facets.levels || []).map((row) => (
              <option key={row.value} value={row.value}>{row.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold text-primary">Annuaire</h2>
        <p className="text-sm text-ink-muted">
          {loading ? 'Recherche…' : `${rows.length} établissement${rows.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-ink-muted">Chargement de l&apos;annuaire…</div>
      ) : rows.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-border text-ink-muted">
          Aucun établissement ne correspond à cette recherche.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {rows.map((row) => {
            const Icon = TYPE_ICONS[row.establishment_type] || Building2;
            return (
              <article
                key={row.id}
                className={`flex flex-col rounded-3xl border border-border dark:border-white/10 bg-surface overflow-hidden shadow-sm hover:shadow-md hover:border-primary/40 transition ${rows.length === 1 ? 'md:col-span-2 md:flex-row' : ''}`}
              >
                <div className={`relative bg-gradient-to-br from-primary to-secondary flex items-center justify-center ${rows.length === 1 ? 'md:w-72 min-h-[160px]' : 'h-36'}`}>
                  {row.business_logo ? (
                    <img src={row.business_logo} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <Icon className="w-12 h-12 text-white/80" />
                  )}
                </div>
                <div className="flex flex-col flex-1 p-5">
                  <p className="text-xs font-semibold text-primary">
                    {row.category_name || row.establishment_type_label}
                  </p>
                  {row.category_slug === 'ecole' && (
                    <p className="mt-1 text-xs font-semibold text-ink">
                      {(row.offers_prescolaire || row.offers_ecofo || row.offers_post_fondamental)
                        ? `Cette école est : ${[
                          row.offers_prescolaire && 'Préscolaire',
                          row.offers_ecofo && 'ECOFO',
                          row.offers_post_fondamental && 'Post-fondamental',
                        ].filter(Boolean).join(' · ')}`
                        : 'Parcours pas encore indiqué par l’école.'}
                      {row.boarding_regime_label ? ` · ${row.boarding_regime_label}` : ''}
                    </p>
                  )}
                  <h2 className="mt-1 text-xl font-bold text-ink dark:text-white">
                    {row.business_name}
                  </h2>
                  {(row.business_quartier || row.business_zone || row.business_commune || row.business_province) && (
                    <p className="mt-2 flex items-center gap-1 text-sm text-ink-muted">
                      <MapPin className="w-4 h-4 shrink-0" />
                      {[row.business_quartier, row.business_zone, row.business_commune, row.business_province].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {origin && row.latitude != null && row.longitude != null && (() => {
                    const km = distanceKm(origin.lat, origin.lng, row.latitude, row.longitude);
                    const minutes = Math.max(1, Math.round((km / 25) * 60));
                    return (
                      <p className="mt-1 text-xs font-semibold text-primary">
                        {km.toFixed(1)} km · ~{minutes} min
                      </p>
                    );
                  })()}
                  {row.short_description && (
                    <p className="mt-3 text-sm text-ink-muted line-clamp-3 flex-1">
                      {row.short_description}
                    </p>
                  )}
                  {tags.some((tag) => row[tag.value]) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tags.filter((tag) => row[tag.value]).map((tag) => (
                        <span key={tag.value} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <Link
                    to={`/education/establishment/${row.business || row.id}`}
                    className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-secondary text-white text-sm font-semibold"
                  >
                    Voir l&apos;établissement
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold text-primary">Formations</h2>
          <p className="text-sm text-ink-muted">
            {loading ? 'Recherche…' : `${programs.length} formation${programs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {!loading && programs.length === 0 ? (
          <div className="p-8 text-center rounded-3xl border border-dashed border-border text-ink-muted text-sm">
            Aucune formation ne correspond à cette recherche.
          </div>
        ) : (
          <div className="space-y-3">
            {programs.map((p) => (
              <Link
                key={p.id}
                to={`/education/establishment/${p.business}`}
                className="block p-4 rounded-2xl border border-border bg-surface hover:border-primary/40"
              >
                <p className="text-xs font-semibold text-primary">
                  {[p.faculty_name, p.unit_name, p.domain, p.level_label].filter(Boolean).join(' · ')}
                </p>
                <h3 className="mt-1 font-bold text-ink">{p.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  {[p.business_name, p.business_commune, p.business_province].filter(Boolean).join(' · ')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
