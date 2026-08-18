import React, { useState, useEffect } from 'react';
import { HeartPulse, MapPin, Phone, Clock, Star, Users, CheckCircle, Navigation } from 'lucide-react';
import DoctorCard from './DoctorCard';
import { useParams } from 'react-router-dom';
import { hospitalService } from './hospitalService';

export default function HospitalProfile() {
  const { id } = useParams();
  const [hospital, setHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHospitalDetails = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/v1/businesses/${id}/`);
        if (response.ok) {
          const h = await response.json();
          const apiServices = await hospitalService.getServices(id).catch(() => []);
          
          // Fallback : utiliser categories_detail s'il n'y a pas de services
          const fallbackServices = (h.categories_detail || []).map(c => ({ 
            id: c.id || Math.random().toString(), 
            name: c.name || 'Service' 
          }));
          
          setServices(apiServices.length > 0 ? apiServices : fallbackServices);
          
          setHospital({
            id: h.id,
            name: h.name,
            category: h.primary_category?.name || 'Hôpital',
            address: h.address || h.province || 'Burundi',
            rating: 4.8, // Mock
            reviews: Math.floor(Math.random() * 100) + 10,
            description: h.description || h.short_description || 'Un établissement de santé de référence.',
            phone: h.phone || 'Non renseigné',
            email: h.email || 'contact@hopital.bi',
            website: h.website || '',
            hours: h.extra_attributes?.is_24_7 ? 'Ouvert 24/7' : 'Heures de bureau',
            hasEmergency: h.extra_attributes?.is_24_7 || false,
            licenseNumber: h.extra_attributes?.license_number || null,
            deliversMedicine: h.extra_attributes?.delivers_medicine || false,
            beds: h.extra_attributes?.rooms_count || 120, // Fallback si non renseigné
            specialties: (h.categories || []).map(c => c.name)
          });

          // We'll mock the doctors for now since they are tied to a separate Hospital Doctor API
          setDoctors([
            {
              id: 101,
              name: 'Jean Ndayishimiye',
              specialty: 'Cardiologie',
              rating: 4.9,
              bio: 'Spécialiste en maladies cardiovasculaires avec plus de 15 ans d\'expérience.',
              isAvailableForTelemedicine: true,
              fee: 30000
            },
            {
              id: 102,
              name: 'Marie Claire Umuhoza',
              specialty: 'Pédiatrie',
              rating: 4.7,
              bio: 'Pédiatre dévouée aux soins des enfants, de la naissance à l\'adolescence.',
              isAvailableForTelemedicine: false,
              fee: 25000
            }
          ]);
        }
      } catch (error) {
        console.error("Error fetching hospital details:", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchHospitalDetails();
    }
  }, [id]);


  const handleBookAppointment = (doctor) => {
    // In real app, open AppointmentBooking modal or navigate to booking page
    alert(`Redirection vers la réservation pour Dr. ${doctor.name}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!hospital) return <div className="text-center py-20">Hôpital introuvable</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Cover and Header */}
      <div className="bg-teal-800 h-48 w-full relative">
        <div className="absolute inset-0 bg-black/20"></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-2xl p-2 shadow-md shrink-0 border border-gray-100">
             <div className="w-full h-full bg-teal-50 rounded-xl flex items-center justify-center">
               <HeartPulse className="w-12 h-12 text-teal-600" />
             </div>
          </div>
          
          <div className="flex-1 w-full">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-1 rounded">{hospital.category}</span>
                  {hospital.hasEmergency && (
                    <span className="text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-1 rounded">Urgences 24/7</span>
                  )}
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{hospital.name}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> {hospital.rating} ({hospital.reviews} avis)</span>
                  <span className="flex items-center gap-1"><Users className="w-4 h-4 text-gray-400" /> {hospital.beds} Lits</span>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                 <button className="flex-1 md:flex-none px-4 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 font-medium rounded-lg transition flex items-center justify-center gap-2">
                   <Phone className="w-4 h-4" /> Appeler
                 </button>
                 <button className="flex-1 md:flex-none px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 font-medium rounded-lg transition flex items-center justify-center gap-2">
                   <Navigation className="w-4 h-4" /> Itinéraire
                 </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content: Doctors & Services */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">À propos</h2>
              <p className="text-gray-600 leading-relaxed">{hospital.description}</p>
              
              <h3 className="font-semibold text-gray-900 mt-6 mb-3">Services et Départements</h3>
              <div className="flex flex-wrap gap-2">
                {services.map((srv, index) => (
                  <span key={srv.id || index} className="px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-500" /> {typeof srv === 'string' ? srv : (srv.name || 'Service sans nom')}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                Nos Médecins Spécialistes <span className="bg-gray-100 text-gray-600 text-sm py-0.5 px-2 rounded-full">{doctors.length}</span>
              </h2>
              <div className="flex flex-col gap-4">
                {doctors.map(doctor => (
                  <DoctorCard key={doctor.id} doctor={doctor} onBook={handleBookAppointment} />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar: Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Informations Pratiques</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-gray-600">
                  <MapPin className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  <span>{hospital.address}</span>
                </li>
                <li className="flex items-center gap-3 text-gray-600">
                  <Clock className="w-5 h-5 text-gray-400 shrink-0" />
                  <span>{hospital.hours}</span>
                </li>
                <li className="flex items-center gap-3 text-gray-600">
                  <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                  <span>{hospital.phone}</span>
                </li>
                <li className="flex items-center gap-3 text-gray-600">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 font-bold text-gray-400">@</div>
                  <span>{hospital.email}</span>
                </li>
                {hospital.licenseNumber && (
                  <li className="flex items-center gap-3 text-green-700 font-medium">
                    <CheckCircle className="w-5 h-5 shrink-0" />
                    <span>Agréé: {hospital.licenseNumber}</span>
                  </li>
                )}
                {hospital.deliversMedicine && (
                  <li className="flex items-center gap-3 text-teal-700 font-medium">
                    <HeartPulse className="w-5 h-5 shrink-0" />
                    <span>Pharmacie de garde disponible</span>
                  </li>
                )}
              </ul>
            </div>
            
            <div className="bg-teal-50 rounded-2xl border border-teal-100 p-6 text-center">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <HeartPulse className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="font-bold text-teal-900 mb-2">Besoin d'aide d'urgence?</h3>
              <p className="text-teal-700 text-sm mb-4">Notre service des urgences est ouvert 24/7 pour les cas critiques.</p>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition shadow-sm">
                Appeler les Urgences
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
