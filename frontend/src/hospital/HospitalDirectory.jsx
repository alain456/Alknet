import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Filter, HeartPulse, Phone, Clock, Stethoscope, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HospitalDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mock data for hospitals for now since we just created the backend and it's empty
  // In a real scenario, this would fetch from /api/v1/businesses/?category=Hospital
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/businesses/');
        if (response.ok) {
          const allBusinesses = await response.json();
          // Filter out businesses that are in the "Santé", "Hôpital" or "Health" categories
          const healthCategories = ['santé', 'sante', 'health', 'hôpital', 'hopital', 'clinique', 'clinic'];
          const hospitalData = allBusinesses.filter(b => {
            const catName = (b.primary_category_name || b.category_name || '').toLowerCase();
            const subCats = (b.categories_detail || []).map(c => (c.name || '').toLowerCase());
            const inPrimary = healthCategories.some(h => catName.includes(h));
            const inSub = subCats.some(sub => healthCategories.some(h => sub && sub.includes(h)));
            return inPrimary || inSub;
          });
          
          // Map to match component's expected structure if needed
          const mappedHospitals = hospitalData.map(h => ({
            id: h.id,
            name: h.name,
            category: { name: h.primary_category_name || h.category_name || 'Hôpital' },
            address: h.address || h.province || 'Burundi',
            rating: 4.5, // Mock rating since not in model
            reviews: Math.floor(Math.random() * 100) + 10,
            description: h.description || h.short_description || 'Un établissement de santé de qualité.',
            phone: h.phone || 'Non renseigné',
            hours: '24/7',
            hasEmergency: true,
            hasTelemedicine: true,
            specialties: (h.categories_detail || []).map(c => c.name).slice(0, 3)
          }));
          
          setHospitals(mappedHospitals);
        }
      } catch (error) {
        console.error('Error fetching hospitals:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHospitals();
  }, []);

  const specialties = ['All', 'Cardiologie', 'Pédiatrie', 'Chirurgie', 'Généraliste', 'Maternité'];
  const cities = ['All', 'Bujumbura', 'Gitega', 'Ngozi'];

  const filteredHospitals = hospitals.filter(h => {
    const matchesSearch = h.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = selectedCity === 'All' || h.address.includes(selectedCity);
    const matchesSpecialty = selectedSpecialty === 'All' || h.specialties.includes(selectedSpecialty);
    return matchesSearch && matchesCity && matchesSpecialty;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-teal-700 text-white border-b border-teal-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-4xl font-bold text-white mb-3">Santé & Hôpitaux</h1>
          <p className="text-teal-100 text-lg">Trouvez les meilleurs établissements de santé et médecins au Burundi</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Filters */}
          <div className="w-full md:w-72 shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <Filter className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-gray-900">Filtres de recherche</h3>
              </div>

              {/* Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Recherche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Nom de l'hôpital..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* City Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ville</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent outline-none"
                >
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {/* Specialty Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Spécialité</label>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent outline-none"
                >
                  {specialties.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => { setSearchTerm(''); setSelectedSpecialty('All'); setSelectedCity('All'); }}
                className="w-full text-teal-600 hover:text-teal-800 font-medium py-2 text-sm"
              >
                Réinitialiser les filtres
              </button>
            </div>
          </div>

          {/* Hospitals Grid */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">{filteredHospitals.length} établissements trouvés</p>
            </div>

            <div className="flex flex-col gap-6">
              {loading ? (
                // Skeleton Loader
                [1, 2, 3].map(i => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 animate-pulse">
                    <div className="h-24 bg-gray-200 rounded-xl mb-4"></div>
                  </div>
                ))
              ) : filteredHospitals.map(hospital => (
                <div key={hospital.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-6 flex flex-col md:flex-row gap-6">
                  {/* Icon/Logo */}
                  <div className="w-24 h-24 rounded-xl bg-teal-50 flex items-center justify-center shrink-0 border border-teal-100">
                    <HeartPulse className="text-teal-600 w-10 h-10" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-900 text-xl">{hospital.name}</h3>
                        <div className="flex items-center text-sm text-gray-500 mt-1 mb-2">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 mr-1" />
                          <span className="font-medium text-gray-700">{hospital.rating}</span> 
                          <span className="mx-1">({hospital.reviews} avis)</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {hospital.hasEmergency && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-md border border-red-200">Urgences 24/7</span>
                        )}
                        {hospital.hasTelemedicine && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-md border border-blue-200 flex items-center gap-1">
                            <Video className="w-3 h-3" /> Téléconsultation
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{hospital.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {hospital.address}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {hospital.phone}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {hospital.hours}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Stethoscope className="w-4 h-4 text-gray-400" />
                        {hospital.specialties.join(', ')}
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-gray-100 pt-4 mt-4">
                      <Link to={`/hospitals/${hospital.id}`} className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-6 rounded-lg transition flex items-center gap-2">
                        Voir le profil et Médecins
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!loading && filteredHospitals.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <HeartPulse className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-lg">Aucun hôpital trouvé avec ces critères</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
