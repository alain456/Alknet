import React, { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Star, Filter, Clock, Briefcase, HeartPulse } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../shared/api';
import useSiteContent from '../shared/useSiteContent';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

function mapMarketplaceService(s) {
  return {
    id: `mkt-${s.id}`,
    source: 'marketplace',
    title: s.title || s.name || 'Service',
    image: s.image || (s.image_urls && s.image_urls[0]) || null,
    provider: s.provider_name || s.business_name || 'Prestataire',
    providerLogo: s.business_logo || null,
    category: s.category_name || s.category_detail?.name || 'Service',
    address: s.business_address || s.location || 'Burundi',
    availability: s.availability || '',
    price: s.price != null ? Number(s.price) : null,
    currency: 'FBu',
    rating: Number(s.rating || 0),
    reviews: s.reviews_count || 0,
    href: null,
  };
}

function mapMedicalService(s) {
  return {
    id: `med-${s.id}`,
    source: 'hospital',
    title: s.name || 'Service médical',
    image: null,
    provider: s.hospital_name || 'Établissement de santé',
    providerLogo: null,
    category: s.prestation_category_name || s.category_display || s.category || 'Santé',
    address: 'Burundi',
    availability: s.availability_display || s.access_conditions || '',
    price: s.indicative_cost != null ? Number(s.indicative_cost) : null,
    currency: s.currency === 'BIF' ? 'FBu' : (s.currency || 'FBu'),
    rating: 0,
    reviews: 0,
    href: s.hospital ? `/hospitals/${s.hospital}` : '/hospitals',
  };
}

export default function ServicesPage() {
  const { settings } = useSiteContent();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('relevance');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const [marketplace, medical] = await Promise.all([
          api.get('services/').catch(() => []),
          api.get('hospital/services/?public=true').catch(() => []),
        ]);
        const mapped = [
          ...normalizeList(marketplace).map(mapMarketplaceService),
          ...normalizeList(medical).map(mapMedicalService),
        ];
        setServices(mapped);
      } catch (error) {
        console.error('Error fetching services:', error);
        setServices([]);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const categories = useMemo(() => {
    const names = new Set();
    services.forEach((s) => { if (s.category) names.add(s.category); });
    return ['All', ...Array.from(names).sort()];
  }, [services]);

  const filteredServices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = services.filter((service) => {
      const matchesSearch = !q
        || service.title.toLowerCase().includes(q)
        || service.provider.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === 'All' || service.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    if (sortBy === 'rating') list = [...list].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    return list;
  }, [services, searchTerm, selectedCategory, sortBy]);

  const pageTitle = settings?.services_page_title || 'Find Services';
  const pageSubtitle = settings?.services_page_subtitle || 'Discover trusted professionals for any job';

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-primary text-white border-b border-teal-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">{pageTitle}</h1>
          <p className="text-teal-100">{pageSubtitle}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <Filter className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-gray-900">Filters</h3>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Service, prestataire..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat === 'All' ? 'Toutes' : cat}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
                className="w-full text-primary hover:text-secondary font-medium py-2 text-sm"
              >
                Clear All Filters
              </button>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <p className="text-gray-600">{filteredServices.length} service(s) trouvé(s)</p>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="relevance">Tri : pertinence</option>
                <option value="rating">Note</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {loading ? (
                [1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 animate-pulse">
                    <div className="h-40 bg-gray-200 rounded-xl mb-4" />
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                ))
              ) : filteredServices.map((service) => {
                const CardInner = (
                  <>
                    <div className="h-48 bg-gradient-to-r from-gray-100 to-gray-200 relative flex items-center justify-center overflow-hidden">
                      {service.image ? (
                        <img src={service.image} alt={service.title} className="w-full h-full object-cover" />
                      ) : service.source === 'hospital' ? (
                        <HeartPulse className="w-12 h-12 text-teal-400" />
                      ) : (
                        <Briefcase className="w-12 h-12 text-gray-400" />
                      )}
                      <span className="absolute top-3 left-3 bg-white/90 text-xs font-semibold px-2 py-1 rounded-full">
                        {service.category}
                      </span>
                      {service.source === 'hospital' && (
                        <span className="absolute top-3 right-3 bg-teal-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                          Santé
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{service.title}</h3>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                          {service.providerLogo ? (
                            <img src={service.providerLogo} alt={service.provider} className="w-full h-full object-cover" />
                          ) : (
                            service.provider.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{service.provider}</p>
                          <div className="flex items-center text-xs text-gray-500">
                            <Star className="w-3 h-3 text-accent fill-accent mr-1" />
                            {service.rating > 0 ? service.rating : 'Nouveau'} ({service.reviews} avis)
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                        <div className="flex items-center gap-1 min-w-0">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="truncate">{service.address}</span>
                        </div>
                        {service.availability && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Clock className="w-4 h-4" />
                            <span className="truncate max-w-[100px]">{service.availability}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <span className="text-sm font-medium text-gray-500">
                          {service.source === 'hospital' ? 'Service médical' : 'Service'}
                        </span>
                        <span className="bg-primary text-white font-medium py-2 px-4 rounded-lg text-sm">
                          {service.href ? 'Voir' : 'Détails'}
                        </span>
                      </div>
                    </div>
                  </>
                );

                return service.href ? (
                  <Link
                    key={service.id}
                    to={service.href}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition overflow-hidden block"
                  >
                    {CardInner}
                  </Link>
                ) : (
                  <div key={service.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition overflow-hidden">
                    {CardInner}
                  </div>
                );
              })}
            </div>

            {!loading && filteredServices.length === 0 && (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-lg">Aucun service trouvé</p>
                <p className="text-gray-400 text-sm mt-1">Les services actifs de la plateforme apparaîtront ici.</p>
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setPriceRange('All'); }}
                  className="mt-4 text-primary font-medium hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
