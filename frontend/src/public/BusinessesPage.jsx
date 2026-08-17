import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Filter, Building2, Phone, Mail, Clock, Users } from 'lucide-react';

export default function BusinessesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  const categories = ['All', 'Clinic', 'Restaurant', 'Hotel', 'IT Company', 'Construction', 'Education', 'Retail'];
  const cities = ['All', 'Bujumbura', 'Gitega', 'Bururi', 'Muyinga', 'Rutana', 'Kayanza'];

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/businesses/');
        if (response.ok) {
          const data = await response.json();
          setBusinesses(data);
        }
      } catch (error) {
        console.error('Error fetching businesses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBusinesses();
  }, []);

  const filteredBusinesses = businesses.filter(business => {
    const matchesSearch = business.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         business.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || business.category?.name === selectedCategory;
    const matchesCity = selectedCity === 'All' || business.address?.includes(selectedCity);
    
    return matchesSearch && matchesCategory && matchesCity;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-primary text-white border-b border-teal-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">Find Businesses</h1>
          <p className="text-teal-100">Discover top-rated businesses in Burundi</p>
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
                    placeholder="Business name..."
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

              {/* City Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setSelectedCity('All'); }}
                className="w-full text-primary hover:text-secondary font-medium py-2 text-sm"
              >
                Clear All Filters
              </button>
            </div>
          </div>

          {/* Businesses Grid */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">{filteredBusinesses.length} businesses found</p>
              <select className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none">
                <option>Sort by: Relevance</option>
                <option>Rating</option>
                <option>Reviews</option>
                <option>Name A-Z</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loading ? (
                // Skeleton Loader
                [1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 animate-pulse">
                    <div className="flex gap-4 mb-4">
                      <div className="w-20 h-20 rounded-xl bg-gray-200 shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-4"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6 mb-4"></div>
                  </div>
                ))
              ) : filteredBusinesses.map(business => (
                <div key={business.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-6">
                  <div className="flex gap-4 mb-4">
                    <div className="w-20 h-20 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center overflow-hidden">
                      {business.logo ? (
                        <img src={business.logo} alt={business.name} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="text-gray-400 w-8 h-8" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{business.name}</h3>
                          {business.verified && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 mt-1">
                              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                              Verified
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          {business.category?.name || 'Business'}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500 mt-1">
                        <Star className="w-4 h-4 text-accent fill-accent mr-1" />
                        {business.rating || 'New'} ({business.reviews || 0} reviews)
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{business.description || 'No description available.'}</p>

                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <MapPin className="w-4 h-4" />
                      {business.address || 'Burundi'}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Users className="w-4 h-4" />
                      {business.employees || 0} employees
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Phone className="w-4 h-4" />
                      {business.phone || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock className="w-4 h-4" />
                      {business.hours || '24/7'}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 bg-primary hover:bg-secondary text-white font-medium py-2 px-4 rounded-lg transition">
                      View Profile
                    </button>
                    <button className="flex-1 border border-gray-200 hover:border-primary text-gray-700 hover:text-primary font-medium py-2 px-4 rounded-lg transition">
                      Contact
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!loading && filteredBusinesses.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No businesses found matching your criteria</p>
                <button
                  onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setSelectedCity('All'); }}
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