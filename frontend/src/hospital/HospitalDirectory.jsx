import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Filter, HeartPulse, Phone, Clock, Stethoscope, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../shared/api';

const HEALTH_TERMS = ['santé', 'sante', 'health', 'hôpital', 'hopital', 'clinique', 'clinic', 'médical', 'medical'];

export default function HospitalDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const allBusinesses = await api.get('businesses/');
        const list = Array.isArray(allBusinesses) ? allBusinesses : [];
        const hospitalData = list.filter((b) => {
          const catName = (b.primary_category_name || b.category_name || '').toLowerCase();
          const busName = (b.name || '').toLowerCase();
          const subCats = (b.categories_detail || []).map((c) => (c.name || '').toLowerCase());
          const inPrimary = HEALTH_TERMS.some((h) => catName.includes(h));
          const inName = HEALTH_TERMS.some((h) => busName.includes(h));
          const inSub = subCats.some((sub) => HEALTH_TERMS.some((h) => sub && sub.includes(h)));
          return inPrimary || inName || inSub;
        });

        setHospitals(hospitalData.map((h) => ({
          id: h.id,
          name: h.name,
          logo: h.logo || null,
          category: { name: h.primary_category_name || h.category_name || 'Hôpital' },
          address: h.address || h.province || h.commune || 'Burundi',
          city: h.commune || h.province || 'Burundi',
          description: h.description || h.short_description || 'Établissement de santé.',
          phone: h.phone || 'Non renseigné',
          hours: h.opening_hours ? 'Voir horaires' : 'Contactez l\'établissement',
          hasEmergency: !!h.emergency_available || !!h.extra_attributes?.is_24_7,
          specialties: (h.categories_detail || []).map((c) => c.name).filter(Boolean),
          insurances: Array.isArray(h.accepted_insurances)
            ? h.accepted_insurances
            : (h.extra_attributes?.insurances || []),
        })));
      } catch (error) {
        console.error('Error fetching hospitals:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHospitals();
  }, []);

  const specialties = useMemo(() => {
    const set = new Set(['All']);
    hospitals.forEach((h) => h.specialties.forEach((s) => set.add(s)));
    return Array.from(set);
  }, [hospitals]);

  const cities = useMemo(() => {
    const set = new Set(['All']);
    hospitals.forEach((h) => { if (h.city) set.add(h.city); });
    return Array.from(set);
  }, [hospitals]);

  const filteredHospitals = hospitals.filter((h) => {
    const matchesSearch = h.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = selectedCity === 'All' || h.city === selectedCity || h.address.includes(selectedCity);
    const matchesSpecialty = selectedSpecialty === 'All' || h.specialties.includes(selectedSpecialty);
    return matchesSearch && matchesCity && matchesSpecialty;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-teal-700 text-white border-b border-teal-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-4xl font-bold text-white mb-3">Santé & Hôpitaux</h1>
          <p className="text-teal-100 text-lg">Établissements de santé enregistrés sur Isoko Hub</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-72 shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <Filter className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-gray-900">Filtres de recherche</h3>
              </div>

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

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ville</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent outline-none"
                >
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Spécialité</label>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent outline-none"
                >
                  {specialties.map((spec) => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => { setSearchTerm(''); setSelectedSpecialty('All'); setSelectedCity('All'); }}
                className="w-full text-teal-600 hover:text-teal-800 font-medium py-2 text-sm"
              >
                Réinitialiser les filtres
              </button>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">{filteredHospitals.length} établissement(s) trouvé(s)</p>
            </div>

            <div className="flex flex-col gap-6">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 animate-pulse">
                    <div className="h-24 bg-gray-200 rounded-xl mb-4" />
                  </div>
                ))
              ) : filteredHospitals.map((hospital) => (
                <div key={hospital.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-6 flex flex-col md:flex-row gap-6">
                  <div className="w-24 h-24 rounded-xl bg-teal-50 flex items-center justify-center shrink-0 border border-teal-100 overflow-hidden">
                    {hospital.logo ? (
                      <img src={hospital.logo} alt={hospital.name} className="w-full h-full object-cover" />
                    ) : (
                      <HeartPulse className="text-teal-600 w-10 h-10" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-900 text-xl">{hospital.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{hospital.category.name}</p>
                      </div>
                      {hospital.hasEmergency && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-md border border-red-200">Urgences</span>
                      )}
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
                        {hospital.specialties.length > 0 ? hospital.specialties.join(', ') : '—'}
                      </div>
                    </div>

                    {(hospital.insurances || []).length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-teal-600" />
                          Assurances acceptées
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {hospital.insurances.slice(0, 6).map((name) => (
                            <span
                              key={name}
                              className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-100"
                            >
                              {name}
                            </span>
                          ))}
                          {hospital.insurances.length > 6 && (
                            <span className="px-2 py-0.5 text-[11px] text-gray-500">
                              +{hospital.insurances.length - 6}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-4 flex-wrap">
                      <Link
                        to={`/hospitals/${hospital.id}/historique`}
                        className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg transition inline-flex items-center gap-2"
                      >
                        Historique
                      </Link>
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
