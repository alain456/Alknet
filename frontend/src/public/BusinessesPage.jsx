import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Filter, Building2, Phone, Clock, Eye, Package, History, Globe } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BusinessDetailsModal from '../shared/components/BusinessDetailsModal';
import api from '../shared/api';
import { websiteHref } from '../shared/websiteUrl';

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
};

function categoryName(business) {
  return (
    business?.primary_category_name
    || business?.category_name
    || business?.category?.name
    || business?.primary_category_detail?.name
    || ''
  );
}

/** Match exact ou via catégorie parente (Explore Categories = racines). */
function businessMatchesCategory(business, selectedCategory) {
  if (!selectedCategory || selectedCategory === 'All') return true;
  const selected = String(selectedCategory).toLowerCase().trim();
  if (!selected) return true;
  const labels = new Set();
  const add = (value) => {
    const v = String(value || '').toLowerCase().trim();
    if (v) labels.add(v);
  };
  add(categoryName(business));
  add(business?.primary_category_detail?.name);
  add(business?.primary_category_detail?.parent_name);
  add(business?.primary_category_parent_name);
  (business?.categories_detail || []).forEach((c) => {
    add(c?.name);
    add(c?.parent_name);
  });
  return labels.has(selected);
}

function isWholesalePharmacy(business) {
  const name = categoryName(business).toLowerCase();
  return name.includes('pharmacie de gros') || (name.includes('pharmac') && name.includes('gros'));
}

function isRetailPharmacy(business) {
  const name = categoryName(business).toLowerCase();
  if (isWholesalePharmacy(business)) return false;
  return name.includes('pharmacie de détail')
    || name.includes('pharmacie de detail')
    || (name.includes('pharmac') && (name.includes('détail') || name.includes('detail') || name.includes('officine')))
    || name.trim() === 'pharmacie';
}

function isHotelBusiness(business) {
  const name = categoryName(business).toLowerCase();
  const slug = (business?.primary_category_slug || business?.category_slug || '').toLowerCase();
  return (
    name.includes('hôtel')
    || name.includes('hotel')
    || name.includes('hôtellerie')
    || name.includes('hotellerie')
    || slug.includes('hotel')
  );
}

function isHospitalBusiness(business) {
  const name = categoryName(business).toLowerCase();
  if (isWholesalePharmacy(business) || isHotelBusiness(business)) return false;
  return (
    name.includes('sant')
    || name.includes('hôpital')
    || name.includes('hopital')
    || name.includes('hospital')
    || name.includes('clinique')
    || name.includes('cabinet')
  );
}

function isCommerceBusiness(business) {
  const name = categoryName(business).toLowerCase();
  const slug = (business?.primary_category_slug || business?.category_slug || '').toLowerCase();
  const keywords = ['commerce', 'boutique', 'mode', 'quincaillerie', 'supermarché', 'supermarche', 'électronique', 'electronique'];
  return keywords.some((k) => name.includes(k) || slug.includes(k));
}

function locationLabel(business) {
  return (
    business.full_address
    || business.address
    || [business.avenue, business.quartier, business.zone, business.commune, business.province]
      .filter(Boolean)
      .join(', ')
    || 'Burundi'
  );
}

export default function BusinessesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => searchParams.get('category') || 'All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    const cat = searchParams.get('category');
    setSelectedCategory(cat && cat.trim() ? cat : 'All');
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get('businesses/').catch(() => []),
      api.get('business-categories/?used=1&parents_only=1').catch(() => []),
    ])
      .then(([bizData, catData]) => {
        if (cancelled) return;
        setBusinesses(normalizeList(bizData).filter(
          (b) => b.is_active !== false && b.is_verified !== false && (b.verification_status || 'APPROVED') === 'APPROVED',
        ));
        setCategories(normalizeList(catData).filter((c) => !c.parent));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Impossible de charger les entreprises');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const updateCategory = (value) => {
    setSelectedCategory(value);
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'All') next.delete('category');
    else next.set('category', value);
    setSearchParams(next, { replace: true });
  };

  const cities = useMemo(() => {
    const set = new Set();
    businesses.forEach((b) => {
      if (b.commune) set.add(b.commune);
      else if (b.province) set.add(b.province);
    });
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))];
  }, [businesses]);

  const categoryOptions = useMemo(() => {
    // Priorité : catégories déjà utilisées par les entreprises affichées (côté client)
    const usedFromBusinesses = new Set();
    businesses.forEach((b) => {
      const parent = b.primary_category_parent_name || b.primary_category_detail?.parent_name;
      const own = categoryName(b);
      if (parent) usedFromBusinesses.add(parent);
      else if (own) usedFromBusinesses.add(own);
      (b.categories_detail || []).forEach((c) => {
        if (c?.parent_name) usedFromBusinesses.add(c.parent_name);
        else if (c?.name && !c?.parent) usedFromBusinesses.add(c.name);
      });
    });

    // Compléter avec l’API used=1 (parents déjà utilisés)
    categories.forEach((c) => {
      if (c?.name) usedFromBusinesses.add(c.name);
    });

    const names = Array.from(usedFromBusinesses)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'fr'));

    // Garder la catégorie de l’URL même si plus aucun résultat temporairement
    if (selectedCategory && selectedCategory !== 'All' && !names.includes(selectedCategory)) {
      names.unshift(selectedCategory);
    }
    return ['All', ...names];
  }, [businesses, categories, selectedCategory]);

  const filteredBusinesses = businesses.filter((business) => {
    const cat = categoryName(business);
    const loc = locationLabel(business);
    const matchesSearch = !searchTerm
      || business.name?.toLowerCase().includes(searchTerm.toLowerCase())
      || business.description?.toLowerCase().includes(searchTerm.toLowerCase())
      || cat.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = businessMatchesCategory(business, selectedCategory);
    const matchesCity = selectedCity === 'All'
      || loc.toLowerCase().includes(selectedCity.toLowerCase())
      || (business.commune || '').toLowerCase() === selectedCity.toLowerCase()
      || (business.province || '').toLowerCase().includes(selectedCity.toLowerCase());
    return matchesSearch && matchesCategory && matchesCity;
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-primary border-b border-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">Entreprises</h1>
          <p className="text-white/85">Entreprises actives et approuvées sur Isoko Hub</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <Filter className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-gray-900">Filtres</h3>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Recherche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Nom, catégorie…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => updateCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>{cat === 'All' ? 'Toutes' : cat}</option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Localité</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                >
                  {cities.map((city) => (
                    <option key={city} value={city}>{city === 'All' ? 'Toutes' : city}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCity('All');
                  updateCategory('All');
                }}
                className="w-full text-primary hover:text-secondary font-medium py-2 text-sm"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">
                {loading ? 'Chargement…' : `${filteredBusinesses.length} entreprise(s)`}
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
              ) : filteredBusinesses.map((business) => (
                <div key={business.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-6">
                  <div className="flex gap-4 mb-4">
                    <div className="w-20 h-20 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center overflow-hidden">
                      {business.logo ? (
                        <img src={business.logo} alt={business.name} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="text-gray-400 w-8 h-8" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-lg truncate">{business.name}</h3>
                        </div>
                        <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full shrink-0">
                          {categoryName(business) || 'Entreprise'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {business.description || 'Aucune description.'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="truncate">{locationLabel(business)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Phone className="w-4 h-4 shrink-0" />
                      {business.phone || '—'}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 sm:col-span-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      {business.hours || 'Horaires sur demande'}
                    </div>
                    {business.website ? (
                      <a
                        href={websiteHref(business.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 text-primary font-medium sm:col-span-2 hover:underline truncate"
                      >
                        <Globe className="w-4 h-4 shrink-0" />
                        <span className="truncate">{business.website}</span>
                      </a>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(
                        isHospitalBusiness(business)
                          ? `/hospitals/${business.id}/historique`
                          : isHotelBusiness(business)
                            ? `/hotels/${business.id}/historique`
                            : `/businesses/${business.id}/historique`
                      )}
                      className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition inline-flex items-center gap-1.5"
                      title="Mon historique"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    {isWholesalePharmacy(business) ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/businesses/${business.id}/catalog`)}
                        className="flex-1 bg-primary hover:bg-secondary text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-1.5"
                      >
                        <Package className="w-4 h-4" />
                        Entrer — Catalogue
                      </button>
                    ) : isRetailPharmacy(business) ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/businesses/${business.id}/pharmacy`)}
                        className="flex-1 bg-primary hover:bg-secondary text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-1.5"
                      >
                        <Package className="w-4 h-4" />
                        Entrer — Catalogue
                      </button>
                    ) : isHotelBusiness(business) ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/hotels/${business.id}`)}
                        className="flex-1 bg-primary hover:bg-secondary text-white font-medium py-2 px-4 rounded-lg"
                      >
                        Voir l&apos;établissement
                      </button>
                    ) : isHospitalBusiness(business) ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/hospitals/${business.id}`)}
                        className="flex-1 bg-primary hover:bg-secondary text-white font-medium py-2 px-4 rounded-lg"
                      >
                        Voir l&apos;établissement
                      </button>
                    ) : isCommerceBusiness(business) ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/businesses/${business.id}/shop`)}
                        className="flex-1 bg-primary hover:bg-secondary text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-1.5"
                      >
                        <Package className="w-4 h-4" />
                        Entrer — Catalogue
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setSelectedBusiness(business); setIsDetailOpen(true); }}
                        className="flex-1 bg-primary hover:bg-secondary text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-4 h-4" />
                        Détails
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!loading && filteredBusinesses.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                Aucune entreprise active et approuvée ne correspond à ces filtres.
              </div>
            )}
          </div>
        </div>
      </div>

      <BusinessDetailsModal
        business={selectedBusiness}
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedBusiness(null); }}
      />
    </div>
  );
}
