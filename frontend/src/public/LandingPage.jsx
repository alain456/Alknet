import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Briefcase, MapPin, Building2, Store, Stethoscope, Laptop, HardHat,
  Sprout, Car, GraduationCap, Heart, Gavel, ShoppingBag, ShieldCheck,
  CheckCircle2, HeartPulse, ChevronLeft, ChevronRight, User,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../shared/api';
import { visitorPosition } from './visitorPlace';
import { getBusinessRecordCategoryKey } from '../auth/roleAccess';
import useSiteContent from '../shared/useSiteContent';

const HEALTH_TERMS = ['santé', 'sante', 'health', 'hôpital', 'hopital', 'clinique', 'clinic', 'médical', 'medical', 'pharmac', 'laboratoire'];

// L'Éducation a son propre annuaire public ; les autres catégories renvoient
// vers la liste des entreprises. `module` est la source de vérité, le test par
// nom ne sert que de filet pour une catégorie pas encore revisitée.
const EDUCATION_TERMS = ['éducation', 'education', 'école', 'ecole', 'universit', 'formation', 'enseignement', 'scolarité', 'scolarite'];

const categoryModuleKey = (c) => {
  const module = String(c?.module || '').toLowerCase();
  if (module) return module;
  const name = String(c?.name || '').toLowerCase();
  const slug = String(c?.slug || '').toLowerCase();
  if (EDUCATION_TERMS.some((t) => name.includes(t) || slug.includes(t))) return 'education';
  if (HEALTH_TERMS.some((t) => name.includes(t) || slug.includes(t))) return 'hospital';
  return '';
};

const isHealthBusiness = (b) => {
  const labels = [
    b.primary_category_name,
    b.category_name,
    b.primary_category_parent_name,
    ...(b.categories_detail || []).flatMap((c) => [c?.name, c?.parent_name]),
  ].filter(Boolean).map((name) => String(name).toLowerCase());
  return labels.some((label) => HEALTH_TERMS.some((term) => label.includes(term)));
};

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

const ICON_MAP = {
  IT: Laptop, Technology: Laptop, Informatique: Laptop,
  Health: Stethoscope, Santé: Stethoscope, Hôpital: HeartPulse, Hopital: HeartPulse,
  Construction: HardHat, Bâtiment: HardHat,
  Agriculture: Sprout, Agroalimentaire: Sprout,
  Restaurants: Store, Restauration: Store,
  Hotels: Building2, Hôtellerie: Building2,
  Transport: Car, Logistique: Car,
  Education: GraduationCap, Enseignement: GraduationCap,
  Beauty: Heart, Beauté: Heart,
  Legal: Gavel, Droit: Gavel,
  Shopping: ShoppingBag, Commerce: ShoppingBag,
};

function categoryIcon(name) {
  return Object.entries(ICON_MAP).find(([key]) =>
    (name || '').toLowerCase().includes(key.toLowerCase())
  )?.[1] || Briefcase;
}

function categoryTarget(cat) {
  const moduleKey = categoryModuleKey(cat);
  if (moduleKey === 'education') return '/education';
  if (moduleKey === 'hospital') return '/hospitals';
  return `/businesses?category=${encodeURIComponent(cat.name)}`;
}

function businessTarget(business) {
  const key = getBusinessRecordCategoryKey(business);
  if (key === 'wholesale') return `/businesses/${business.id}/catalog`;
  if (key === 'retail_pharmacy') return `/businesses/${business.id}/pharmacy`;
  if (key === 'hospital' || isHealthBusiness(business)) return `/hospitals/${business.id}`;
  return `/businesses?highlight=${business.id}`;
}

function suggestionKind(kind) {
  return {
    business: 'Entreprise',
    product: 'Produit',
    service: 'Service',
    program: 'Formation',
    professional: 'Professionnel',
    location: 'Lieu',
  }[kind] || 'Résultat';
}

function placeLabel(row) {
  return row?.address || row?.commune || row?.province || row?.hospital_name || '';
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { settings } = useSiteContent();
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestIndex, setSuggestIndex] = useState(-1);
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [placeIndex, setPlaceIndex] = useState(-1);
  const [near, setNear] = useState(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroPaused = useRef(false);
  const heroSlides = Array.isArray(settings?.hero_slides) ? settings.hero_slides.filter(Boolean).slice(0, 8) : [];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bData, sData, cData, dData] = await Promise.all([
          api.get('businesses/').catch(() => []),
          api.get('services/').catch(() => []),
          // `modules=education` force l'affichage de la racine Éducation même
          // sans entreprise rattachée : elle a sa propre vitrine publique, elle
          // ne doit pas disparaître de l'accueil avant les premières inscriptions.
          api.get('business-categories/?used=1&parents_only=1&modules=education').catch(() => []),
          api.get('hospital/doctors/?public=true').catch(() => []),
        ]);

        setAllBusinesses(normalizeList(bData));
        setAllServices(normalizeList(sData));
        setCategories(normalizeList(cData));
        setProfessionals(normalizeList(dData).slice(0, 4));
      } catch (error) {
        console.error('Error fetching landing data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const { featuredBusinesses, popularServices } = useMemo(() => {
    const health = allBusinesses.filter(isHealthBusiness);
    const featuredHealthIds = new Set(health.slice(0, 3).map((b) => b.id));
    const services = allServices.filter((s) => !s.business || !featuredHealthIds.has(s.business));
    const showBusinesses = settings?.show_businesses !== false;
    const showHealth = settings?.show_health !== false;
    const pool = showBusinesses
      ? allBusinesses.filter((row) => showHealth || !isHealthBusiness(row))
      : (showHealth ? health : []);
    return {
      featuredBusinesses: pool.slice(0, 6),
      popularServices: services.slice(0, 4),
    };
  }, [allBusinesses, allServices, settings?.show_businesses, settings?.show_health]);

  const coverSlides = heroSlides.length
    ? heroSlides.map((src) => ({ key: src, src, name: '' }))
    : featuredBusinesses.filter((row) => row.logo).slice(0, 8).map((row) => ({
      key: row.id,
      src: row.logo,
      name: row.name,
      href: businessTarget(row),
    }));

  useEffect(() => {
    if (coverSlides.length < 2) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => {
      if (heroPaused.current) return;
      setHeroIndex((prev) => (prev + 1) % coverSlides.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [coverSlides.length]);

  const heroTitleLines = (settings?.hero_title || 'Trouvez l’entreprise\nqu’il vous faut.').split('\n');
  const whyItems = settings?.why_items?.length
    ? settings.why_items.slice(0, 3)
    : [
      { title: 'Recherche simple', description: 'Un nom, un lieu, et les entreprises publiées sur Isoko Hub.', icon: 'Search' },
      { title: 'Catégories réelles', description: 'Éducation, santé, hôtels, commerces et les autres secteurs déjà ouverts.', icon: 'Briefcase' },
      { title: 'Votre établissement', description: 'Une entreprise inscrite apparaît dans l’annuaire public.', icon: 'Building2' },
    ];
  const go = (url) => {
    if (!url) return;
    if (/^https?:\/\//i.test(url)) window.location.href = url;
    else navigate(url);
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        const nearQuery = !searchLocation.trim() && near ? `&lat=${encodeURIComponent(near.lat)}&lng=${encodeURIComponent(near.lng)}` : '';
        const data = await api.get(`businesses/search/suggest/?q=${encodeURIComponent(q)}${nearQuery}`);
        setSuggestions(Array.isArray(data) ? data : []);
        setSuggestIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searchLocation, near]);

  useEffect(() => {
    if (searchLocation.trim() || searchQuery.trim().length < 2) return undefined;
    let cancelled = false;
    visitorPosition().then((point) => {
      if (!cancelled && point) setNear(point);
    });
    return () => { cancelled = true; };
  }, [searchQuery, searchLocation]);

  useEffect(() => {
    const place = searchLocation.trim();
    if (place.length < 2) {
      setPlaceSuggestions([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        const data = await api.get(`businesses/search/suggest/?place=${encodeURIComponent(place)}`);
        setPlaceSuggestions(Array.isArray(data) ? data : []);
        setPlaceIndex(-1);
      } catch {
        setPlaceSuggestions([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchLocation]);

  const openSuggestion = (item) => {
    if (!item) return;
    setSuggestions([]);
    setPlaceSuggestions([]);
    setSuggestIndex(-1);
    setPlaceIndex(-1);
    if (item.kind === 'location') {
      setSearchLocation(item.label);
      return;
    }
    if (item.href) {
      navigate(item.href);
      return;
    }
    const params = new URLSearchParams();
    params.set('q', item.q || item.label);
    if (searchLocation.trim()) params.set('location', searchLocation.trim());
    navigate(`/search?${params.toString()}`);
  };

  const onQueryKeyDown = (event) => {
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSuggestIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSuggestIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === 'Escape') {
      setSuggestions([]);
      setSuggestIndex(-1);
    } else if (event.key === 'Enter' && suggestIndex >= 0) {
      event.preventDefault();
      openSuggestion(suggestions[suggestIndex]);
    }
  };

  const onPlaceKeyDown = (event) => {
    if (!placeSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setPlaceIndex((current) => (current + 1) % placeSuggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setPlaceIndex((current) => (current <= 0 ? placeSuggestions.length - 1 : current - 1));
    } else if (event.key === 'Escape') {
      setPlaceSuggestions([]);
      setPlaceIndex(-1);
    } else if (event.key === 'Enter' && placeIndex >= 0) {
      event.preventDefault();
      openSuggestion(placeSuggestions[placeIndex]);
    }
  };

  const submitSearch = async (event) => {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (searchLocation.trim()) {
      params.set('location', searchLocation.trim());
    } else {
      const point = near || await visitorPosition();
      if (point) {
        params.set('lat', String(point.lat));
        params.set('lng', String(point.lng));
      }
    }
    setSuggestions([]);
    navigate(`/search?${params.toString()}`);
  };

  const showListings = settings?.show_businesses !== false || settings?.show_health !== false;
  const whyIcons = { Search, Briefcase, Building2, CheckCircle2, ShieldCheck, Laptop };

  return (
    <div className="w-full pb-8">
      {settings?.maintenance_mode && (
        <div className="mx-4 mt-4 rounded-2xl bg-ink text-surface px-4 py-3 text-sm text-center">
          {settings.maintenance_message || 'La plateforme est en maintenance. Certaines actions sont suspendues.'}
        </div>
      )}
      <section className="px-4 pt-12 pb-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-ink leading-tight">
            {heroTitleLines.map((line, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-ink-muted">
            {settings?.hero_subtitle
              || 'Écoles, santé, hôtels, commerces et services, au même endroit.'}
          </p>
        </div>
        {coverSlides.length > 0 && (
          <div
            className="mt-8 mx-auto max-w-5xl"
            onMouseEnter={() => { heroPaused.current = true; }}
            onMouseLeave={() => { heroPaused.current = false; }}
          >
            <div className="relative h-64 sm:h-80" style={{ perspective: '1100px' }}>
              {coverSlides.map((slide, i) => {
                const len = coverSlides.length;
                const active = heroIndex % len;
                let offset = i - active;
                if (offset > len / 2) offset -= len;
                if (offset < -len / 2) offset += len;
                const distance = Math.abs(offset);
                if (distance > 2) return null;
                const shift = offset * 46;
                return (
                  <button
                    key={slide.key}
                    type="button"
                    aria-label={slide.name || `Image ${i + 1}`}
                    onClick={() => {
                      if (i === active && slide.href) navigate(slide.href);
                      else setHeroIndex(i);
                    }}
                    className="absolute top-0 left-1/2 h-full w-[62%] sm:w-[42%] rounded-3xl bg-white overflow-hidden shadow-lg transition-all duration-500 flex flex-col"
                    style={{
                      transform: `translateX(calc(-50% + ${shift}%)) rotateY(${offset * -32}deg) scale(${distance === 0 ? 1 : 0.84})`,
                      zIndex: 10 - distance,
                      opacity: distance === 2 ? 0.55 : 1,
                    }}
                  >
                    <img src={slide.src} alt="" className="min-h-0 flex-1 w-full object-contain p-4" />
                    {slide.name ? (
                      <span className="px-3 pb-3 text-sm font-bold text-ink truncate">{slide.name}</span>
                    ) : null}
                  </button>
                );
              })}
              {coverSlides.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Image précédente"
                    onClick={() => setHeroIndex((i) => (i - 1 + coverSlides.length) % coverSlides.length)}
                    className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white text-ink flex items-center justify-center shadow-md"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Image suivante"
                    onClick={() => setHeroIndex((i) => (i + 1) % coverSlides.length)}
                    className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white text-ink flex items-center justify-center shadow-md"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            {coverSlides.length > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                {coverSlides.map((slide, i) => (
                  <button
                    key={slide.key}
                    type="button"
                    aria-label={slide.name || `Image ${i + 1}`}
                    onClick={() => setHeroIndex(i)}
                    className={`h-2 rounded-full ${i === heroIndex % coverSlides.length ? 'w-6 bg-accent' : 'w-2 bg-primary/30'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        <div className="max-w-3xl mx-auto">
          <form onSubmit={submitSearch} className="hero-search mt-8 bg-white p-2 rounded-2xl ring-1 ring-border shadow-sm flex flex-col sm:flex-row sm:items-center gap-2 text-left relative">
            <div className="flex-1 flex items-center px-3 relative">
              <Search className="text-accent w-5 h-5 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={settings?.search_placeholder || 'Entreprise, service, établissement…'}
                className="hero-search-input w-full py-3 outline-none text-sm font-medium bg-transparent border-0 text-ink"
                onKeyDown={onQueryKeyDown}
                aria-autocomplete="list"
                aria-expanded={suggestions.length > 0}
              />
              {suggestions.length > 0 && (
                <ul className="hero-search-suggest absolute left-0 right-0 top-full mt-2 bg-white text-left rounded-3xl shadow-xl z-20 overflow-hidden">
                  {suggestions.map((item, index) => (
                    <li key={`${item.kind}-${item.label}-${item.href || ''}`}>
                      <button
                        type="button"
                        className={`hero-search-suggest-btn w-full px-4 py-2.5 text-sm text-left text-ink ${index === suggestIndex ? 'bg-accent/15' : ''}`}
                        onMouseEnter={() => setSuggestIndex(index)}
                        onClick={() => openSuggestion(item)}
                      >
                        <span className="font-semibold">{item.label}</span>
                        {item.detail ? <span className="ml-2 text-xs text-ink-muted">{item.detail}</span> : null}
                        <span className="ml-2 text-xs uppercase text-primary">{suggestionKind(item.kind)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="sm:w-48 flex items-center px-3 sm:border-l sm:border-border relative">
              <MapPin className="text-accent w-5 h-5 mr-2 shrink-0" />
              <input
                type="text"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                placeholder={settings?.search_location_placeholder || 'Lieu'}
                className="hero-search-input w-full py-3 outline-none text-sm font-medium bg-transparent border-0 text-ink"
                onKeyDown={onPlaceKeyDown}
                aria-autocomplete="list"
                aria-expanded={placeSuggestions.length > 0}
              />
              {placeSuggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full mt-2 bg-white text-left rounded-3xl shadow-xl z-20 overflow-hidden">
                  {placeSuggestions.map((item, index) => (
                    <li key={`${item.label}-${item.detail}`}>
                      <button
                        type="button"
                        className={`w-full px-4 py-2.5 text-sm text-left text-ink ${index === placeIndex ? 'bg-accent/15' : ''}`}
                        onMouseEnter={() => setPlaceIndex(index)}
                        onClick={() => openSuggestion(item)}
                      >
                        <span className="font-semibold">{item.label}</span>
                        <span className="ml-2 text-xs text-ink-muted">{item.detail || 'Lieu'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="submit" className="bg-accent text-ink font-bold text-sm py-3 px-6 rounded-xl shrink-0">
              Rechercher
            </button>
          </form>
          {categories.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {categories.slice(0, 6).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(categoryTarget(cat))}
                  className="px-3 py-1.5 rounded-full bg-white ring-1 ring-border text-sm font-semibold text-ink"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {settings?.show_categories !== false && (
      <section className="px-4 py-12 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-3 mb-6">
          <h2 className="text-2xl font-extrabold text-ink">{settings?.categories_title || 'Explorer par catégorie'}</h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-28 rounded-2xl bg-white ring-1 ring-border animate-pulse" />)}
          </div>
        ) : categories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map((cat) => {
              const IconComp = categoryIcon(cat.name);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(categoryTarget(cat))}
                  className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl bg-white ring-1 ring-border text-ink hover:ring-accent"
                >
                  <IconComp className="w-7 h-7 text-primary" />
                  <span className="text-sm font-semibold text-center leading-tight">{cat.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Aucune catégorie publiée pour le moment.</p>
        )}
      </section>
      )}

      {showListings && (
      <section className="px-4 py-12 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-3 mb-6">
          <h2 className="text-2xl font-extrabold text-ink">{settings?.businesses_title || 'Entreprises à découvrir'}</h2>
          <button type="button" onClick={() => navigate('/businesses')} className="text-sm font-bold text-primary">Voir tout</button>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-64 rounded-2xl bg-white ring-1 ring-border animate-pulse" />)}
          </div>
        ) : featuredBusinesses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredBusinesses.map((business) => (
              <button
                key={business.id}
                type="button"
                onClick={() => navigate(businessTarget(business))}
                className="text-left rounded-2xl bg-white ring-1 ring-border overflow-hidden hover:ring-accent"
              >
                <div className="h-36 bg-surface flex items-center justify-center relative">
                  {business.logo ? (
                    <img src={business.logo} alt="" className="w-full h-full object-contain p-3" />
                  ) : (
                    <Building2 className="w-10 h-10 text-primary" />
                  )}
                  {(business.extra_attributes?.is_24_7 || business.emergency_available) && (
                    <span className="absolute top-3 right-3 text-[11px] font-bold px-2 py-1 rounded-lg bg-white text-ink ring-1 ring-border">Urgences</span>
                  )}
                </div>
                <div className="px-4 py-4">
                  <p className="text-xs font-semibold text-ink-muted">{business.primary_category_name || 'Entreprise'}</p>
                  <h3 className="mt-1 font-extrabold text-ink truncate">{business.name}</h3>
                  <p className="mt-1 text-sm text-ink-muted flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0" /> {placeLabel(business) || 'Burundi'}
                  </p>
                  <span className="mt-3 inline-flex items-center text-sm font-bold text-primary">
                    Voir la fiche <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Aucune entreprise publiée pour le moment.</p>
        )}
      </section>
      )}

      {settings?.show_services !== false && (
      <section className="px-4 py-12 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-3 mb-6">
          <h2 className="text-2xl font-extrabold text-ink">{settings?.services_title || 'Services'}</h2>
          <button type="button" onClick={() => navigate('/services')} className="text-sm font-bold text-primary">Voir tout</button>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-56 rounded-2xl bg-white ring-1 ring-border animate-pulse" />)}
          </div>
        ) : popularServices.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularServices.map((service) => {
              const title = service.title || service.name || 'Service';
              const img = (service.image_urls && service.image_urls[0]) || null;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => navigate('/services')}
                  className="text-left rounded-2xl bg-white ring-1 ring-border overflow-hidden hover:ring-accent"
                >
                  <div className="h-32 bg-surface flex items-center justify-center">
                    {img ? <img src={img} alt="" className="w-full h-full object-contain p-2" /> : <Briefcase className="w-8 h-8 text-primary" />}
                  </div>
                  <div className="px-4 py-4">
                    <h3 className="font-extrabold text-ink truncate">{title}</h3>
                    {service.price != null && (
                      <p className="mt-1 text-sm text-ink-muted">{Number(service.price).toLocaleString('fr-BI')} FBu</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Aucun service publié pour le moment.</p>
        )}
      </section>
      )}

      {settings?.show_professionals !== false && (loading || professionals.length > 0) && (
      <section className="px-4 py-12 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-3 mb-6">
          <h2 className="text-2xl font-extrabold text-ink">{settings?.professionals_title || 'Professionnels de santé'}</h2>
          <button type="button" onClick={() => navigate('/hospitals')} className="text-sm font-bold text-primary">Voir tout</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            [1, 2, 3, 4].map((i) => <div key={i} className="h-40 rounded-2xl bg-white ring-1 ring-border animate-pulse" />)
          ) : professionals.map((doc) => {
            const photo = doc.public_photo_url || doc.photo_url || doc.user_details?.avatar;
            const name = doc.full_name || `${doc.user_details?.first_name || ''} ${doc.user_details?.last_name || ''}`.trim() || 'Médecin';
            const specialty = (doc.specialties || []).map((s) => s.name).filter(Boolean).join(', ')
              || doc.staff_category_display
              || 'Professionnel de santé';
            const hospitalId = doc.hospital_id || doc.hospital;
            return (
              <Link key={doc.id} to={hospitalId ? `/hospitals/${hospitalId}` : '/hospitals'} className="rounded-2xl bg-white ring-1 ring-border p-4 hover:ring-accent">
                <div className="w-14 h-14 rounded-full bg-surface ring-1 ring-border overflow-hidden flex items-center justify-center text-primary">
                  {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                </div>
                <h3 className="mt-3 font-extrabold text-ink truncate">{name}</h3>
                <p className="text-sm text-ink-muted truncate">{specialty}</p>
                <p className="mt-1 text-xs text-ink-muted truncate">{doc.hospital_name || 'Burundi'}</p>
              </Link>
            );
          })}
        </div>
      </section>
      )}

      {settings?.show_why !== false && (
      <section className="px-4 py-12 max-w-6xl mx-auto">
        <h2 className="text-2xl font-extrabold text-ink text-center">{settings?.why_title || 'Pourquoi Isoko Hub'}</h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {whyItems.map((item) => {
            const IconComp = whyIcons[item.icon] || CheckCircle2;
            return (
              <div key={item.title} className="rounded-2xl bg-white ring-1 ring-border px-5 py-6 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-[#E7F0F4] text-primary flex items-center justify-center">
                  <IconComp className="w-6 h-6" />
                </div>
                <h3 className="mt-4 font-extrabold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>
      )}

      <section className="px-4 py-12">
        <div className="max-w-4xl mx-auto rounded-3xl bg-white ring-1 ring-border px-6 py-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink">Trouvez ce qu’il vous faut. Faites connaître votre activité.</h2>
          <p className="mt-3 text-sm text-ink-muted">Les établissements publiés sont déjà dans l’annuaire. Le vôtre peut y figurer.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => go(settings?.hero_cta_secondary_url || '/businesses')} className="px-5 py-3 rounded-xl bg-primary text-surface text-sm font-bold">
              {settings?.hero_cta_secondary_label || 'Explorer'}
            </button>
            <button type="button" onClick={() => go(settings?.hero_cta_primary_url || '/register-business')} className="px-5 py-3 rounded-xl bg-accent text-ink text-sm font-bold">
              {settings?.hero_cta_primary_label || 'Créer une entreprise'}
            </button>
          </div>
          {settings?.show_app_banner !== false && (
            <p className="mt-6 text-xs font-semibold text-ink-muted">
              {settings?.app_banner_title || 'Application mobile'} · {settings?.app_banner_badge || 'Bientôt disponible'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
