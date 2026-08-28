import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, MapPin, Phone, Clock, Star, Users, CheckCircle, 
  Navigation, Calendar, Video, Stethoscope, ChevronRight, AlertCircle, X, Shield 
} from 'lucide-react';
import DoctorCard from './DoctorCard';
import { useParams } from 'react-router-dom';
import { hospitalService } from './hospitalService';
import { useAuth } from '../context/AuthContext';

export default function HospitalProfile() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [hospital, setHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Booking Modal State
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingStep, setBookingStep] = useState(1); // 1: Form, 2: Confirmation Success
  const [bookingData, setBookingData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    reason: '',
    type: 'PRESENTIAL', // PRESENTIAL or TELEMEDICINE
    patient_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
    patient_phone: '',
    patient_email: user?.email || ''
  });
  const [submittingBooking, setSubmittingBooking] = useState(false);

  useEffect(() => {
    const fetchHospitalDetails = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/v1/businesses/${id}/`);
        if (response.ok) {
          const h = await response.json();
          const apiServices = await hospitalService.getServices(id).catch(() => []);
          
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
            rating: 4.9,
            reviews: 48,
            description: h.description || h.short_description || 'Un établissement de santé de référence au Burundi.',
            phone: h.phone || '+257 22 22 22 22',
            email: h.email || 'contact@hopital.bi',
            website: h.website || '',
            hours: h.extra_attributes?.is_24_7 ? 'Ouvert 24/7' : 'Heures de bureau',
            hasEmergency: h.extra_attributes?.is_24_7 || false,
            licenseNumber: h.extra_attributes?.license_number || null,
            beds: h.extra_attributes?.rooms_count || 150
          });

          // Fetch Real Doctors from API
          fetchDoctors(h.id);
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

  const fetchDoctors = async (hospitalUuid) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/doctors/?hospital=${hospitalUuid}`);
      if (res.ok) {
        setDoctors(await res.json());
      }
    } catch (err) {
      console.error("Error fetching doctors:", err);
    }
  };

  const [doctorSlots, setDoctorSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);

  const handleOpenBooking = async (doc) => {
    setSelectedDoctor(doc);
    setBookingStep(1);
    setSelectedSlot(null);
    setConfirmedAppointment(null);
    setBookingData({
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      reason: '',
      type: doc.is_available_for_telemedicine ? 'TELEMEDICINE' : 'PRESENTIAL',
      patient_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
      patient_phone: '',
      patient_email: user?.email || ''
    });

    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/appointment-slots/?doctor=${doc.id}&hospital=${id}&upcoming=true`);
      if (res.ok) {
        const slotsData = await res.json();
        setDoctorSlots(slotsData);
        if (slotsData.length > 0) {
          const available = slotsData.find(s => s.remaining_slots > 0);
          if (available) setSelectedSlot(available);
        }
      }
    } catch (err) {
      console.error("Error fetching doctor slots:", err);
    }
  };

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    setSubmittingBooking(true);
    try {
      const payload = {
        hospital: id,
        doctor: selectedDoctor.id,
        slot: selectedSlot ? selectedSlot.id : null,
        appointment_date: selectedSlot 
          ? `${selectedSlot.slot_date}T${selectedSlot.start_time}`
          : `${bookingData.date}T${bookingData.time}:00Z`,
        consultation_type: selectedSlot 
          ? selectedSlot.consultation_type
          : (bookingData.type === 'TELEMEDICINE' ? 'TELEMEDICINE' : 'IN_PERSON'),
        reason: bookingData.reason,
        notes: `Mode: ${bookingData.type === 'TELEMEDICINE' ? 'Téléconsultation Vidéo' : 'Consultation Présentielle'}`,
        patient_name: bookingData.patient_name,
        patient_phone: bookingData.patient_phone,
        patient_email: bookingData.patient_email
      };

      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('http://localhost:8000/api/v1/hospital/appointments/', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setConfirmedAppointment(data);
        setBookingStep(2);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Booking error:', errorData);
        alert(`Erreur lors de la réservation : ${errorData.slot?.[0] || errorData.detail || JSON.stringify(errorData) || 'Veuillez vérifier vos informations'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau lors de la réservation');
    } finally {
      setSubmittingBooking(false);
    }
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-12">
      {/* Cover and Header */}
      <div className="bg-gradient-to-r from-teal-800 to-emerald-900 h-48 w-full relative">
        <div className="absolute inset-0 bg-black/20"></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-md shrink-0 border border-gray-100 dark:border-gray-800">
             <div className="w-full h-full bg-teal-50 dark:bg-teal-950/60 rounded-xl flex items-center justify-center">
               <HeartPulse className="w-12 h-12 text-teal-600 dark:text-teal-400" />
             </div>
          </div>
          
          <div className="flex-1 w-full">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-2 py-1 rounded border border-teal-100 dark:border-teal-800">
                    {hospital.category}
                  </span>
                  {hospital.hasEmergency && (
                    <span className="text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded border border-red-200 dark:border-red-800">
                      Urgences 24/7
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{hospital.name}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                  <span className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> {hospital.rating} ({hospital.reviews} avis)</span>
                  <span className="flex items-center gap-1"><Users className="w-4 h-4 text-gray-400" /> {hospital.beds} Lits d'hospitalisation</span>
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-gray-400" /> {hospital.address}</span>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                 <a href={`tel:${hospital.phone}`} className="flex-1 md:flex-none px-4 py-2 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 hover:bg-teal-100 font-medium rounded-xl transition flex items-center justify-center gap-2 border border-teal-200 dark:border-teal-800">
                   <Phone className="w-4 h-4" /> Appeler ({hospital.phone})
                 </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content: Doctors & Services */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">À propos de l'établissement</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{hospital.description}</p>
              
              <h3 className="font-semibold text-gray-900 dark:text-white mt-6 mb-3 flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-teal-600" /> Services & Paquets de soins
              </h3>
              <div className="flex flex-wrap gap-2">
                {services.map((srv) => (
                  <span key={srv.id} className="px-3 py-1.5 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-xs font-semibold rounded-lg border border-teal-100 dark:border-teal-800">
                    {srv.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Annuaire des Médecins Spécialistes */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Stethoscope className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                    Annuaire des Médecins Spécialistes
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Consultez les praticiens disponibles et prenez rendez-vous en ligne ou en téléconsultation.</p>
                </div>
              </div>

              {doctors.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                  <Stethoscope className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-50" />
                  <p className="text-gray-500 text-sm font-medium">Aucun médecin répertorié pour le moment dans cet établissement.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {doctors.map(doc => (
                    <DoctorCard key={doc.id} doctor={doc} onBook={handleOpenBooking} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="font-bold text-gray-900 dark:text-white text-base mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" /> Informations d'Accès
              </h3>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <p className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span>Horaires :</span>
                  <strong className="text-gray-900 dark:text-white">{hospital.hours}</strong>
                </p>
                <p className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span>Téléphone :</span>
                  <strong className="text-gray-900 dark:text-white">{hospital.phone}</strong>
                </p>
                <p className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span>Email :</span>
                  <strong className="text-gray-900 dark:text-white">{hospital.email}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal interactif : Prise de Rendez-vous (Flow Spécifié) */}
      {selectedDoctor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="px-6 py-4 bg-gradient-to-r from-teal-700 to-emerald-800 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <h3 className="font-bold text-lg">Prise de Rendez-vous Médical</h3>
              </div>
              <button onClick={() => setSelectedDoctor(null)} className="text-white/80 hover:text-white text-2xl cursor-pointer">&times;</button>
            </div>

            {bookingStep === 1 ? (
              <form onSubmit={handleConfirmBooking} className="p-6 space-y-4">
                {/* Récap Médecin */}
                <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-100 dark:border-teal-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    Dr
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                      {selectedDoctor.user_details?.first_name || selectedDoctor.full_name || selectedDoctor.name} {selectedDoctor.user_details?.last_name || ''}
                    </h4>
                    <p className="text-xs text-teal-700 dark:text-teal-300 font-semibold">
                      {hospital.name} • Tarif: {Number(selectedDoctor.consultation_fee || selectedDoctor.fee || 0).toLocaleString()} BIF
                    </p>
                  </div>
                </div>

                {/* Sélecteur de Créneau / Session de Rendez-vous */}
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-600" /> Session / Créneau de Consultation
                  </h3>
                  {doctorSlots.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                      Aucune session de consultation n'a été planifiée pour ce médecin. Veuillez contacter l'hôpital pour prendre rendez-vous.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {doctorSlots.map(slot => {
                        const isFull = slot.remaining_slots <= 0;
                        const isSelected = selectedSlot?.id === slot.id;
                        const dateObj = new Date(slot.slot_date);
                        const displayDate = dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

                        return (
                          <div 
                            key={slot.id}
                            onClick={() => !isFull && setSelectedSlot(slot)}
                            className={`p-3 rounded-xl border ${isSelected ? 'border-teal-600 bg-teal-50 dark:bg-teal-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-teal-300'} ${isFull ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800' : 'cursor-pointer'} transition`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                {slot.title}
                                {isFull && <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-bold uppercase tracking-wide">Complet</span>}
                              </h4>
                              {!isFull && (
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-teal-600' : 'border-gray-300'}`}>
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-teal-600"></div>}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mt-2">
                              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {displayDate}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {slot.start_time?.substring(0,5)} - {slot.end_time?.substring(0,5)}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap justify-between items-center text-[11px] gap-2">
                              <span className="font-medium text-teal-700 dark:text-teal-400 flex items-center gap-1">
                                {slot.consultation_type === 'TELEMEDICINE' ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                {slot.consultation_type === 'TELEMEDICINE' ? 'Téléconsultation' : 'Présentiel'}
                              </span>
                              <span className={`font-bold ${isFull ? 'text-red-600' : 'text-emerald-600'}`}>
                                Places restantes : {slot.remaining_slots} / {slot.max_patients}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Motif de consultation */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Motif de consultation</label>
                  <textarea 
                    required
                    rows={2}
                    placeholder="ex: Maux de tête fréquents, suivi annuel, bilan de santé..."
                    value={bookingData.reason}
                    onChange={e => setBookingData({ ...bookingData, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                {/* Coordonnées du Patient */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nom complet du patient</label>
                    <input 
                      type="text"
                      required
                      placeholder="Votre nom..."
                      value={bookingData.patient_name}
                      onChange={e => setBookingData({ ...bookingData, patient_name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Téléphone (WhatsApp/SMS)</label>
                    <input 
                      type="tel"
                      required
                      placeholder="+257 79 00 00 00"
                      value={bookingData.patient_phone}
                      onChange={e => setBookingData({ ...bookingData, patient_phone: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input 
                      type="email"
                      required
                      placeholder="patient@email.com"
                      value={bookingData.patient_email}
                      onChange={e => setBookingData({ ...bookingData, patient_email: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button type="button" onClick={() => setSelectedDoctor(null)} className="px-4 py-2 text-gray-600 dark:text-gray-300 text-sm font-medium cursor-pointer">Annuler</button>
                  <button 
                    type="submit" 
                    disabled={submittingBooking}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl shadow-md transition cursor-pointer"
                  >
                    {submittingBooking ? 'Confirmation...' : 'Confirmer le Rendez-vous'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 dark:text-white">Rendez-vous Confirmé !</h4>
                
                {/* Queue Number Badge */}
                {confirmedAppointment && (
                  <div className="inline-block px-4 py-2 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 rounded-2xl border border-teal-200 dark:border-teal-800">
                    <p className="text-xs font-semibold uppercase tracking-wider">Votre Position dans la File</p>
                    <p className="text-3xl font-extrabold text-teal-600 dark:text-teal-400">
                      N° {confirmedAppointment.queue_number || 1}
                    </p>
                    <p className="text-[11px] text-teal-600/80 mt-0.5">Ordre de passage basé sur l'heure d'inscription</p>
                  </div>
                )}

                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Votre demande de rendez-vous avec <strong>Dr. {selectedDoctor.user_details?.first_name || selectedDoctor.full_name || selectedDoctor.name}</strong> a été enregistrée avec succès.
                </p>

                {confirmedAppointment?.slot_details ? (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-600 dark:text-gray-300 font-medium space-y-1">
                    <p>Session : <strong>{confirmedAppointment.slot_details.title}</strong></p>
                    <p>Capacité restante sur ce créneau : <strong>{confirmedAppointment.slot_details.remaining_slots} / {confirmedAppointment.slot_details.max_patients} places</strong></p>
                    <p>Mode : <strong>{confirmedAppointment.slot_details.consultation_type === 'TELEMEDICINE' ? 'Téléconsultation' : 'Présentiel'}</strong></p>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-500 font-mono">
                    Mode : {bookingData.type === 'TELEMEDICINE' ? 'Téléconsultation Vidéo' : 'Consultation Présentielle'}
                  </div>
                )}

                <button 
                  onClick={() => setSelectedDoctor(null)}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition cursor-pointer text-sm"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
