import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Filter, HeartPulse, Phone, Clock, Stethoscope, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../shared/api';
import { categoryKeyFromLabels, getBusinessRecordCategoryKey } from '../auth/roleAccess';

const HEALTH_TERMS = ['santé', 'sante', 'health', 'hôpital', 'hopital', 'clinique', 'clinic', 'médical', 'medical', 'pharmac', 'laboratoire'];

function isSanteBusiness(b) {
  const labels = [
    b.primary_category_name,
    b.category_name,
    b.primary_category_parent_name,
    ...(b.categories_detail || []).flatMap((c) => [c?.name, c?.parent_name]),
  ].filter(Boolean).map((name) => String(name).toLowerCase());
  return labels.some((label) => HEALTH_TERMS.some((term) => label.includes(term)));
}

function healthKind(business) {
  const key = getBusinessRecordCategoryKey(business);
  if (key === 'wholesale') return 'wholesale';
  if (key === 'retail_pharmacy') return 'retail';
  const name = String(business.primary_category_name || business.category_name || '').toLowerCase();
  if (name.includes('laboratoire') || name.includes('labo')) return 'lab';
  return 'hospital';
}

function isSectorLabel(name) {
  const key = categoryKeyFromLabels(name, '', '');
  return key === 'wholesale' || key === 'retail_pharmacy' || key === 'hospital';
}

const KIND_LABEL = {
  hospital: 'Hôpital',
  retail: 'Pharmacie de détail',
  wholesale: 'Pharmacie de gros',
  lab: 'Laboratoire',
};

const KIND_PATH = {
  hospital: (id) => `/hospitals/${id}`,
  retail: (id) => `/businesses/${id}/pharmacy`,
  wholesale: (id) => `/businesses/${id}/catalog`,
  lab: (id) => `/hospitals/${id}`,
};

const KIND_CTA = {
  hospital: 'Voir l’hôpital',
  retail: 'Voir la pharmacie de détail',
  wholesale: 'Voir la pharmacie de gros',
  lab: 'Voir le laboratoire',
};

export default function HospitalDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const allBusinesses = await api.get('businesses/');
        const list = Array.isArray(allBusinesses) ? allBusinesses : [];
        const hospitalData = list.filter(isSanteBusiness);

        setHospitals(hospitalData.map((h) => ({
          id: h.id,
          name: h.name,
          logo: h.logo || null,
          category: { name: h.primary_category_name || h.category_name || 'Santé' },
          kind: healthKind(h),
          address: h.address || h.province || h.commune || 'Burundi',
          city: h.commune || h.province || 'Burundi',
          description: h.description || h.short_description || 'Établissement de santé.',
          phone: h.phone || 'Non renseigné',
          hours: h.opening_hours ? 'Voir horaires' : 'Contactez l\'établissement',
          hasEmergency: !!h.emergency_available || !!h.extra_attributes?.is_24_7,
          specialties: (h.categories_detail || []).map((c) => c.name).filter((name) => name && !isSectorLabel(name)),
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
    const matchesKind = kindFilter === 'all' || h.kind === kindFilter;
    return matchesSearch && matchesCity && matchesSpecialty && matchesKind;
  });

  const kindCounts = {
    hospital: hospitals.filter((h) => h.kind === 'hospital').length,
    retail: hospitals.filter((h) => h.kind === 'retail').length,
    wholesale: hospitals.filter((h) => h.kind === 'wholesale').length,
  };
  const kindChoices = [
    { id: 'hospital', label: 'Hôpitaux' },
    { id: 'retail', label: 'Pharmacies de détail' },
    { id: 'wholesale', label: 'Pharmacies de gros' },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <h1 className="text-4xl font-extrabold text-ink">Santé</h1>
        <p className="mt-2 text-ink-muted">Choisissez un hôpital, une pharmacie de détail ou une pharmacie de gros.</p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {kindChoices.map((choice) => {
            const active = kindFilter === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => setKindFilter(active ? 'all' : choice.id)}
                className={`rounded-2xl px-5 py-4 text-left ring-1 ${active ? 'bg-accent text-ink ring-accent' : 'bg-white text-ink ring-border'}`}
              >
                <p className="text-sm font-semibold">{choice.label}</p>
                <p className={`mt-1 text-2xl font-extrabold ${active ? 'text-ink' : 'text-ink'}`}>{kindCounts[choice.id]}</p>
              </button>
            );
          })}
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
                    placeholder="Nom de l'établissement..."
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
                onClick={() => { setSearchTerm(''); setSelectedSpecialty('All'); setSelectedCity('All'); setKindFilter('all'); }}
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
                  <div className="w-24 h-24 rounded-xl bg-surface flex items-center justify-center shrink-0 ring-1 ring-border overflow-hidden">
                    {hospital.logo ? (
                      <img src={hospital.logo} alt="" className="w-full h-full object-contain p-2" />
                    ) : (
                      <HeartPulse className="text-primary w-10 h-10" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-ink text-xl">{hospital.name}</h3>
                        <span className="mt-2 inline-flex px-3 py-1 rounded-full bg-accent text-ink text-xs font-bold">
                          {KIND_LABEL[hospital.kind]}
                        </span>
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
                      <Link to={`/hospitals/${hospital.id}/historique`}
                        className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg transition inline-flex items-center gap-2"
                      >
                        Historique
                      </Link>
                      <Link
                        to={KIND_PATH[hospital.kind](hospital.id)}
                        className="bg-accent text-ink font-bold py-2 px-6 rounded-xl transition flex items-center gap-2"
                      >
                        {KIND_CTA[hospital.kind]}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!loading && filteredHospitals.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <HeartPulse className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-ink-muted text-lg">Aucun établissement trouvé avec ces critères</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
