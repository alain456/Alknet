import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Briefcase, MapPin, Building2, Store, Stethoscope, Laptop, HardHat,
  Sprout, Car, GraduationCap, Heart, Gavel, ShoppingBag, ShieldCheck,
  CheckCircle2, HeartPulse, ChevronRight, User,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../shared/api';
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
  const [heroIndex, setHeroIndex] = useState(0);
  const heroSlides = Array.isArray(settings?.hero_slides) ? settings.hero_slides.filter(Boolean) : [];
  const categoryRail = useRef(null);
  const categoryTrack = useRef(null);

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

  useEffect(() => {
    if (heroSlides.length < 2) return undefined;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 5200);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const horizontalCategories = categories.length >= 3;

  useEffect(() => {
    if (!horizontalCategories) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;
    const onScroll = () => {
      const rail = categoryRail.current;
      const track = categoryTrack.current;
      if (!rail || !track) return;
      const distance = rail.offsetHeight - window.innerHeight;
      if (distance <= 0) return;
      const scrolled = Math.min(Math.max(-rail.getBoundingClientRect().top, 0), distance);
      const maxShift = Math.max(0, track.scrollWidth - window.innerWidth + 48);
      track.style.transform = `translate3d(${-(scrolled / distance) * maxShift}px, 0, 0)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [horizontalCategories, categories.length]);

  const { healthBusinesses, topBusinesses, popularServices } = useMemo(() => {
    const health = allBusinesses.filter(isHealthBusiness);
    const healthIds = new Set(health.map((b) => b.id));
    const nonHealth = allBusinesses.filter((b) => !healthIds.has(b.id));

    // Services hors établissements déjà mis en avant en santé
    const featuredHealthIds = new Set(health.slice(0, 3).map((b) => b.id));
    const services = allServices.filter((s) => {
      if (!s.business) return true;
      return !featuredHealthIds.has(s.business);
    });

    return {
      healthBusinesses: health.slice(0, 3),
      topBusinesses: nonHealth.slice(0, 3),
      popularServices: services.slice(0, 4),
    };
  }, [allBusinesses, allServices]);

  const heroTitleLines = (settings?.hero_title || 'Everything you need,\nin one platform.').split('\n');
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
        const data = await api.get(`businesses/search/suggest/?q=${encodeURIComponent(q)}`);
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const submitSearch = (event) => {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (searchLocation.trim()) params.set('location', searchLocation.trim());
    setSuggestions([]);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="w-full">
      <section className="bg-primary py-20 px-4 text-center text-surface relative overflow-hidden">
        {heroSlides.length > 0 ? (
          <div className="absolute inset-0">
            {heroSlides.map((src, i) => (
              <img
                key={`${i}-${String(src).slice(0, 24)}`}
                src={src}
                alt=""
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                  i === heroIndex % heroSlides.length ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
            <div className="absolute inset-0 bg-black/40" />
          </div>
        ) : (
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at 20% 0%, #1E8B4A 0%, transparent 50%), radial-gradient(ellipse at 90% 80%, #E1302A 0%, transparent 45%)',
            }}
          />
        )}
        <div className="max-w-4xl mx-auto relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-surface mb-6 leading-tight">
            {heroTitleLines.map((line, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </h1>
          <p className="text-lg md:text-xl text-surface/95 font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
            {settings?.hero_subtitle
              || 'Find trusted professionals, book services, order from the best businesses, and discover new opportunities in Burundi.'}
          </p>

          <div className="flex justify-center gap-4 mb-12 flex-wrap">
            <button
              onClick={() => go(settings?.hero_cta_primary_url || '/register-business')}
              className="bg-accent hover:opacity-95 text-surface font-bold text-base py-3.5 px-8 rounded-xl border-2 border-surface/20 shadow-lg transition transform hover:-translate-y-1 flex items-center gap-2"
            >
              <Building2 className="w-5 h-5" /> {settings?.hero_cta_primary_label || 'Créer une Entreprise'}
            </button>
            <button
              onClick={() => go(settings?.hero_cta_secondary_url || '/services')}
              className="bg-surface/15 hover:bg-surface/25 text-surface border-2 border-surface/70 font-bold text-base py-3.5 px-8 rounded-xl transition backdrop-blur-sm"
            >
              {settings?.hero_cta_secondary_label || 'Explore Services'}
            </button>
          </div>

          <form onSubmit={submitSearch} className="hero-search bg-surface p-2 rounded-full shadow-2xl flex max-w-3xl mx-auto items-center border-2 border-accent relative">
            <div className="flex-1 flex items-center px-4 border-r border-border relative">
              <Search className="text-accent w-5 h-5 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={settings?.search_placeholder || 'Profession, Business, Restaurant, Product...'}
                className="hero-search-input w-full py-3 outline-none text-base font-medium bg-transparent border-0"
              />
              {suggestions.length > 0 && (
                <ul className="hero-search-suggest absolute left-0 right-0 top-full mt-3 bg-white text-left rounded-2xl shadow-xl border border-slate-200 z-20 overflow-hidden">
                  {suggestions.map((item) => (
                    <li key={`${item.kind}-${item.label}`}>
                      <button
                        type="button"
                        className="hero-search-suggest-btn w-full px-4 py-2.5 text-sm text-left"
                        onClick={() => {
                          if (item.kind === 'location') {
                            setSearchLocation(item.label);
                            setSuggestions([]);
                          } else {
                            setSearchQuery(item.q || item.label);
                            setSuggestions([]);
                          }
                        }}
                      >
                        <span className="font-semibold">{item.label}</span>
                        <span className="ml-2 text-xs uppercase">{item.kind === 'location' ? 'Lieu' : 'Entreprise'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="w-1/3 flex items-center px-4">
              <MapPin className="text-accent w-5 h-5 mr-2 shrink-0" />
              <input
                type="text"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                placeholder={settings?.search_location_placeholder || 'Location'}
                className="hero-search-input w-full py-3 outline-none text-base font-medium bg-transparent border-0"
              />
            </div>
            <button type="submit" className="bg-primary hover:opacity-95 text-surface font-bold text-base py-3 px-8 rounded-full transition border-2 border-accent shrink-0">
              Search
            </button>
          </form>
          {heroSlides.length > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Image ${i + 1}`}
                  onClick={() => setHeroIndex(i)}
                  className={`h-2 rounded-full ${i === heroIndex % heroSlides.length ? 'w-6 bg-white' : 'w-2 bg-white/60'}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {settings?.show_categories !== false && (
      horizontalCategories && !loading && categories.length > 0 ? (
      <section
        ref={categoryRail}
        className="relative"
        style={{ height: `${Math.max(categories.length, 6) * 18}vh` }}
      >
        <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-hidden flex flex-col justify-center">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-10 px-4">{settings?.categories_title || 'Explore Categories'}</h2>
          <div ref={categoryTrack} className="flex gap-6 px-6 w-max will-change-transform">
            {categories.map((cat) => {
              const IconComp = categoryIcon(cat.name);
              const moduleKey = categoryModuleKey(cat);
              const target = moduleKey === 'education'
                ? '/education'
                : (moduleKey === 'hospital'
                  ? '/hospitals'
                  : `/businesses?category=${encodeURIComponent(cat.name)}`);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(target)}
                  className="flex flex-col items-center shrink-0 w-44 p-6 border border-gray-100 rounded-2xl hover:shadow-lg hover:border-primary/20 transition cursor-pointer bg-white group"
                >
                  <IconComp className="w-8 h-8 text-gray-400 group-hover:text-primary mb-3 transition" />
                  <span className="font-medium text-gray-700 group-hover:text-primary text-center leading-tight">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      ) : (
      <section className="py-20 px-4 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">{settings?.categories_title || 'Explore Categories'}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col items-center p-6 border border-gray-100 rounded-2xl bg-white animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full mb-3" />
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            ))
          ) : categories.length > 0 ? (
            categories.map((cat) => {
              const IconComp = categoryIcon(cat.name);
              const moduleKey = categoryModuleKey(cat);
              const target = moduleKey === 'education'
                ? '/education'
                : (moduleKey === 'hospital'
                  ? '/hospitals'
                  : `/businesses?category=${encodeURIComponent(cat.name)}`);
              return (
                <div
                  key={cat.id}
                  onClick={() => navigate(target)}
                  className="flex flex-col items-center p-6 border border-gray-100 rounded-2xl hover:shadow-lg hover:border-primary/20 transition cursor-pointer bg-white group"
                >
                  <IconComp className="w-8 h-8 text-gray-400 group-hover:text-primary mb-3 transition" />
                  <span className="font-medium text-gray-700 group-hover:text-primary text-center leading-tight">{cat.name}</span>
                </div>
              );
            })
          ) : (
            <p className="col-span-full text-center text-gray-500">Aucune catégorie utilisée pour le moment.</p>
          )}
        </div>
      </section>
      )
      )}

      {settings?.show_professionals !== false && (
      <section className="py-20 px-4 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-10">
            <h2 className="text-3xl font-bold text-gray-900">{settings?.professionals_title || 'Featured Professionals'}</h2>
            <button onClick={() => navigate('/hospitals')} className="text-primary font-semibold hover:underline">View All</button>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-pulse h-56" />
              ))}
            </div>
          ) : professionals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {professionals.map((doc) => {
                const photo = doc.public_photo_url || doc.photo_url || doc.user_details?.avatar;
                const name = doc.full_name || `${doc.user_details?.first_name || ''} ${doc.user_details?.last_name || ''}`.trim() || 'Médecin';
                const specialty = (doc.specialties || []).map((s) => s.name).filter(Boolean).join(', ')
                  || doc.staff_category_display
                  || 'Professionnel de santé';
                const hospitalId = doc.hospital_id || doc.hospital;
                return (
                  <div key={doc.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition">
                    <div className="h-32 bg-gradient-to-r from-teal-100 to-emerald-100" />
                    <div className="px-6 pb-6 relative">
                      <div className="w-16 h-16 rounded-full bg-primary border-4 border-white absolute -top-8 flex items-center justify-center text-white font-bold text-xl shadow-sm overflow-hidden">
                        {photo ? (
                          <img src={photo} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-7 h-7" />
                        )}
                      </div>
                      <div className="pt-10">
                        <h3 className="font-bold text-lg text-gray-900 line-clamp-1">{name}</h3>
                        <p className="text-sm text-gray-500 mb-2 line-clamp-1">{specialty}</p>
                        <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {doc.hospital_name || 'Burundi'}
                        </p>
                        <Link
                          to={hospitalId ? `/hospitals/${hospitalId}` : '/hospitals'}
                          className="block w-full text-center border border-gray-200 hover:border-primary text-gray-700 hover:text-primary font-medium py-2 rounded-lg transition"
                        >
                          Voir le profil
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Aucun professionnel publié pour le moment.</p>
          )}
        </div>
      </section>
      )}

      {settings?.show_health !== false && (
      <section className="py-20 px-4 max-w-7xl mx-auto border-t border-gray-100">
        <div className="flex justify-between items-end mb-10">
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <HeartPulse className="text-teal-600" /> {settings?.health_title || 'Établissements de Santé'}
          </h2>
          <button onClick={() => navigate('/hospitals')} className="text-teal-600 font-semibold hover:underline">Voir l&apos;annuaire complet</button>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => <div key={i} className="h-64 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : healthBusinesses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {healthBusinesses.map((h) => (
              <div
                key={h.id}
                onClick={() => navigate(`/hospitals/${h.id}`)}
                className="flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-xl transition cursor-pointer group"
              >
                <div className="h-40 bg-teal-50 flex items-center justify-center relative overflow-hidden">
                  {h.logo ? (
                    <img src={h.logo} alt={h.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-16 h-16 text-teal-200" />
                  )}
                  {(h.extra_attributes?.is_24_7 || h.emergency_available) && (
                    <div className="absolute top-4 right-4 bg-white/90 px-2 py-1 rounded text-xs font-bold text-teal-700 shadow-sm backdrop-blur-sm">
                      Urgences
                    </div>
                  )}
                </div>
                <div className="p-6 flex-1">
                  <h3 className="font-bold text-xl text-gray-900 mb-1 group-hover:text-teal-600 transition">{h.name}</h3>
                  <p className="text-gray-500 text-sm mb-4">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    {h.address || h.commune || h.province || 'Burundi'}
                  </p>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {(h.categories_detail || []).slice(0, 3).map((c) => (
                      <span key={c.id} className="px-2 py-1 bg-gray-50 text-xs rounded border border-gray-200">{c.name}</span>
                    ))}
                    {!(h.categories_detail || []).length && (
                      <span className="px-2 py-1 bg-gray-50 text-xs rounded border border-gray-200">
                        {h.primary_category_name || 'Santé'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end border-t border-gray-100 pt-4 mt-auto">
                    <span className="text-teal-600 text-sm font-semibold flex items-center">
                      Voir le profil <ChevronRight className="w-4 h-4 ml-1" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">Aucun établissement de santé publié.</p>
        )}
      </section>
      )}

      {settings?.show_businesses !== false && (
      <section className="py-20 px-4 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-10">
          <h2 className="text-3xl font-bold text-gray-900">{settings?.businesses_title || 'Top Businesses'}</h2>
          <button onClick={() => navigate('/businesses')} className="text-primary font-semibold hover:underline">View All</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="flex p-4 border border-gray-100 rounded-2xl animate-pulse">
                <div className="w-20 h-20 bg-gray-200 rounded-xl mr-4" />
                <div className="flex-1 space-y-2 py-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))
          ) : topBusinesses.length > 0 ? (
            topBusinesses.map((business) => (
              <div
                key={business.id}
                onClick={() => navigate(`/businesses?highlight=${business.id}`)}
                className="flex p-4 border border-gray-100 rounded-2xl hover:shadow-lg transition cursor-pointer"
              >
                <div className="w-20 h-20 bg-gray-100 rounded-xl shrink-0 mr-4 flex items-center justify-center overflow-hidden">
                  {business.logo ? (
                    <img src={business.logo} alt={business.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="text-gray-400 w-8 h-8" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">{business.name}</h3>
                  <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full mb-2 inline-block">
                    {business.primary_category_name || 'Entreprise'}
                  </span>
                  <div className="flex items-center text-sm text-gray-500">
                    <MapPin className="w-4 h-4 mr-1" /> {business.address || business.commune || 'Burundi'}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="col-span-full text-center text-gray-500 py-8">Aucune autre entreprise à afficher.</p>
          )}
        </div>
      </section>
      )}

      {settings?.show_services !== false && (
      <section className="py-20 px-4 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-10">
            <h2 className="text-3xl font-bold text-gray-900">{settings?.services_title || 'Popular Services'}</h2>
            <button onClick={() => navigate('/services')} className="text-primary font-semibold hover:underline">View All</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse h-64" />
              ))
            ) : popularServices.length > 0 ? (
              popularServices.map((service) => {
                const title = service.title || service.name || 'Service';
                const img = (service.image_urls && service.image_urls[0]) || null;
                return (
                  <div key={service.id} className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition border border-gray-50">
                    <div className="h-40 bg-gray-100 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                      {img ? (
                        <img src={img} alt={title} className="w-full h-full object-cover" />
                      ) : (
                        <Briefcase className="w-10 h-10 text-gray-300" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-primary tracking-wider uppercase mb-1">Service</div>
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{title}</h3>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                      <span className="text-sm text-gray-500 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                          {title.charAt(0)}
                        </div>
                        Prestataire
                      </span>
                      {service.price != null && (
                        <span className="font-bold text-gray-900">{Number(service.price).toLocaleString('fr-BI')} FBu</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="col-span-full text-center text-gray-500 py-8">Aucun service publié pour le moment.</p>
            )}
          </div>
        </div>
      </section>
      )}

      {settings?.show_why !== false && (
      <section className="py-24 px-4 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-16">{settings?.why_title || 'Why choose Isoko Hub?'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {(settings?.why_items?.length
            ? settings.why_items
            : [
              { title: 'Verified Professionals', description: 'Every service provider is vetted for quality and reliability.', icon: 'CheckCircle2' },
              { title: 'Secure Payments', description: 'Your funds are protected until the service is delivered.', icon: 'ShieldCheck' },
              { title: 'Trusted Businesses', description: 'Find the best local businesses rated by the community.', icon: 'Briefcase' },
              { title: 'AI Recommendations', description: "Our smart algorithm finds exactly what you're looking for.", icon: 'Laptop' },
            ]
          ).map((item) => {
            const IconComp = { CheckCircle2, ShieldCheck, Briefcase, Laptop }[item.icon] || CheckCircle2;
            return (
              <div key={item.title} className="flex flex-col items-center">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                  <IconComp className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-gray-500">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {settings?.show_app_banner !== false && (
      <section className="py-20 px-4 bg-primary text-surface text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-6 text-surface">{settings?.app_banner_title || 'Take Isoko Hub everywhere'}</h2>
          <p className="text-surface/90 text-lg sm:text-xl font-medium mb-8">
            {settings?.app_banner_subtitle || 'The official Isoko Hub mobile app is currently under development.'}
          </p>
          <div className="inline-block border-2 border-accent rounded-full px-8 py-3.5 font-bold tracking-wide text-surface text-base sm:text-lg bg-surface/10">
            {settings?.app_banner_badge || 'COMING SOON'}
          </div>
        </div>
      </section>
      )}
    </div>
  );
}
