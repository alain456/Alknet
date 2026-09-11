import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Filter, Building2, Phone, Clock, Eye, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BusinessDetailsModal from '../shared/components/BusinessDetailsModal';
import api from '../shared/api';

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

function isHospitalBusiness(business) {
  const name = categoryName(business).toLowerCase();
  if (isWholesalePharmacy(business)) return false;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get('businesses/').catch(() => []),
      api.get('business-categories/').catch(() => []),
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

  const cities = useMemo(() => {
    const set = new Set();
    businesses.forEach((b) => {
      if (b.commune) set.add(b.commune);
      else if (b.province) set.add(b.province);
    });
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))];
  }, [businesses]);

  const categoryOptions = useMemo(
    () => ['All', ...categories.map((c) => c.name).filter(Boolean)],
    [categories],
  );

  const filteredBusinesses = businesses.filter((business) => {
    const cat = categoryName(business);
    const loc = locationLabel(business);
    const matchesSearch = !searchTerm
      || business.name?.toLowerCase().includes(searchTerm.toLowerCase())
      || business.description?.toLowerCase().includes(searchTerm.toLowerCase())
      || cat.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || cat === selectedCategory;
    const matchesCity = selectedCity === 'All'
      || loc.toLowerCase().includes(selectedCity.toLowerCase())
      || (business.commune || '').toLowerCase() === selectedCity.toLowerCase()
      || (business.province || '').toLowerCase().includes(selectedCity.toLowerCase());
    return matchesSearch && matchesCategory && matchesCity;
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-primary text-white border-b border-teal-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">Entreprises</h1>
          <p className="text-teal-100">Entreprises actives et approuvées sur Isoko Hub</p>
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
                  onChange={(e) => setSelectedCategory(e.target.value)}
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
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setSelectedCity('All'); }}
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
                  </div>

                  <div className="flex gap-2">
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
