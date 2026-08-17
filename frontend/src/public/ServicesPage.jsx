import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Filter, DollarSign, Clock, User, Briefcase } from 'lucide-react';

export default function ServicesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState('All');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const categories = ['All', 'IT', 'Health', 'Construction', 'Agriculture', 'Education', 'Beauty', 'Legal'];
  const priceRanges = ['All', '$0-$50', '$50-$200', '$200-$500', '$500+'];

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/services/');
        if (response.ok) {
          const data = await response.json();
          setServices(data);
        }
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.business?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || service.category?.name === selectedCategory;
    
    let matchesPrice = true;
    if (priceRange !== 'All') {
      if (priceRange === '$0-$50') matchesPrice = service.price <= 50;
      else if (priceRange === '$50-$200') matchesPrice = service.price > 50 && service.price <= 200;
      else if (priceRange === '$200-$500') matchesPrice = service.price > 200 && service.price <= 500;
      else if (priceRange === '$500+') matchesPrice = service.price > 500;
    }
    
    return matchesSearch && matchesCategory && matchesPrice;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-primary text-white border-b border-teal-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">Find Services</h1>
          <p className="text-teal-100">Discover trusted professionals for any job</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <div className="w-64 shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <Filter className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-gray-900">Filters</h3>
              </div>

              {/* Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Service name, provider..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Price Range Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  {priceRanges.map(range => (
                    <option key={range} value={range}>{range}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setPriceRange('All'); }}
                className="w-full text-primary hover:text-secondary font-medium py-2 text-sm"
              >
                Clear All Filters
              </button>
            </div>
          </div>

          {/* Services Grid */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">{filteredServices.length} services found</p>
              <select className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none">
                <option>Sort by: Relevance</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Rating</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                // Skeleton Loader
                [1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 animate-pulse">
                    <div className="h-40 bg-gray-200 rounded-xl mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/3 mt-2"></div>
                    </div>
                  </div>
                ))
              ) : filteredServices.map(service => (
                <div key={service.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="h-48 bg-linear-to-r from-gray-200 to-gray-300 relative flex items-center justify-center">
                    {service.image ? (
                      <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
                    ) : (
                      <Briefcase className="w-12 h-12 text-gray-400" />
                    )}
                    <span className="absolute top-3 left-3 bg-white/90 text-xs font-semibold px-2 py-1 rounded-full">
                      {service.category?.name || 'Service'}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{service.name}</h3>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                        {service.business ? service.business.name.charAt(0) : 'P'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{service.business ? service.business.name : 'Independent'}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <Star className="w-3 h-3 text-accent fill-accent mr-1" />
                          {service.rating || 'New'} ({service.reviews || 0} reviews)
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {service.business?.address || 'Burundi'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {service.duration_minutes ? `${service.duration_minutes} mins` : 'Flexible'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <span className="font-bold text-gray-900">${service.price}</span>
                      </div>
                      <button className="bg-primary hover:bg-secondary text-white font-medium py-2 px-4 rounded-lg transition">
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!loading && filteredServices.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No services found matching your criteria</p>
                <button
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