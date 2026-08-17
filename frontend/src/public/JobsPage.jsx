import React, { useState, useEffect } from 'react';
import { Search, MapPin, Briefcase, Filter, DollarSign, Clock, Building2, Calendar, ArrowRight } from 'lucide-react';

export default function JobsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const categories = ['All', 'IT', 'Healthcare', 'Education', 'Finance', 'Construction', 'Retail', 'Manufacturing'];
  const jobTypes = ['All', 'Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'];
  const cities = ['All', 'Bujumbura', 'Gitega', 'Bururi', 'Muyinga', 'Rutana', 'Kayanza'];

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/offers/');
        if (response.ok) {
          const data = await response.json();
          setJobs(data);
        }
      } catch (error) {
        console.error('Error fetching jobs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.business?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || job.business?.category?.name === selectedCategory;
    const matchesType = selectedType === 'All' || job.offer_type === selectedType.toUpperCase().replace('-', '_');
    const matchesCity = selectedCity === 'All' || job.location?.includes(selectedCity) || job.business?.address?.includes(selectedCity);
    
    return matchesSearch && matchesCategory && matchesType && matchesCity;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-primary text-white border-b border-teal-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">Find Jobs</h1>
          <p className="text-teal-100">Discover career opportunities in Burundi</p>
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
                    placeholder="Job title, company..."
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

              {/* Job Type Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  {jobTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* City Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
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
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setSelectedType('All'); setSelectedCity('All'); }}
                className="w-full text-primary hover:text-secondary font-medium py-2 text-sm"
              >
                Clear All Filters
              </button>
            </div>
          </div>

          {/* Jobs List */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">{filteredJobs.length} jobs found</p>
              <select className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none">
                <option>Sort by: Relevance</option>
                <option>Most Recent</option>
                <option>Salary High-Low</option>
                <option>Salary Low-High</option>
              </select>
            </div>

            <div className="space-y-4">
              {loading ? (
                // Skeleton Loader
                [1, 2, 3].map(i => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 animate-pulse">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gray-200 shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="flex gap-2 mt-4">
                          <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
                          <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : filteredJobs.map(job => (
                <div key={job.id} className={`bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-6 ${job.featured ? 'border-l-4 border-l-accent' : ''}`}>
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center overflow-hidden">
                      {job.business?.logo ? (
                        <img src={job.business.logo} alt={job.business.name} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="text-gray-400 w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{job.title}</h3>
                          <p className="text-sm text-gray-600">{job.business?.name}</p>
                        </div>
                        {job.featured && (
                          <span className="bg-accent/10 text-accent text-xs font-semibold px-2 py-1 rounded-full">
                            Featured
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 mb-3 text-sm">
                        <span className="flex items-center gap-1 text-gray-500">
                          <Briefcase className="w-4 h-4" />
                          {job.offer_type}
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-4 h-4" />
                          {job.location || job.business?.address || 'Burundi'}
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <DollarSign className="w-4 h-4" />
                          {job.salary_range || 'Competitive'}
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{job.description}</p>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex gap-2">
                          {job.required_skills && job.required_skills.slice(0, 2).map((req, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                              {req}
                            </span>
                          ))}
                          {job.required_skills && job.required_skills.length > 2 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                              +{job.required_skills.length - 2} more
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">
                            {job.deadline ? `Deadline: ${new Date(job.deadline).toLocaleDateString()}` : 'Open'}
                          </span>
                          <button className="bg-primary hover:bg-secondary text-white font-medium py-2 px-4 rounded-lg transition flex items-center gap-2">
                            Apply Now
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!loading && filteredJobs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No jobs found matching your criteria</p>
                <button
                  onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setSelectedType('All'); setSelectedCity('All'); }}
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