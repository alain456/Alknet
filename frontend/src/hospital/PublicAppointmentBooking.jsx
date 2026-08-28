import React, { useState, useEffect } from 'react';
import { 
  Building2, Stethoscope, User, Calendar, Clock, FileText, 
  Video, CheckCircle2, ChevronRight, ChevronLeft, Search, 
  MapPin, Star, ShieldCheck, Phone, Mail, BellRing, Sparkles
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicAppointmentBooking() {
  const [searchParams] = useSearchParams();
  const initialHospitalId = searchParams.get('hospital');
  
  const { token, user } = useAuth();
  const navigate = useNavigate();

  // Wizard Step: 1 -> 2 -> 3 -> 4 -> 5 -> 6 (Confirmation)
  const [currentStep, setCurrentStep] = useState(initialHospitalId ? 2 : 1);

  // Data List States
  const [hospitals, setHospitals] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected Booking Selections
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingDetails, setBookingDetails] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    reason: '',
    type: 'PRESENTIAL', // PRESENTIAL or TELEMEDICINE
    patient_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
    patient_phone: '',
    patient_email: user?.email || ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');

  useEffect(() => {
    fetchHospitals();
    fetchSpecialties();
  }, []);

  const fetchHospitals = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/businesses/');
      if (res.ok) {
        const data = await res.json();
        const healthTerms = ['santé', 'sante', 'health', 'hôpital', 'hopital', 'clinique', 'clinic', 'médical', 'medical', 'laboratoire', 'pharmacie'];
        const healthHospitals = data.filter(b => {
          const catName = (b.primary_category_name || b.category_name || '').toLowerCase();
          const busName = (b.name || '').toLowerCase();
          const subCats = (b.categories_detail || []).map(c => (c.name || '').toLowerCase());
          
          const inPrimary = healthTerms.some(term => catName.includes(term));
          const inName = healthTerms.some(term => busName.includes(term));
          const inSub = subCats.some(sub => healthTerms.some(term => sub && sub.includes(term)));
          
          return inPrimary || inName || inSub;
        });

        const finalHospitals = healthHospitals.length > 0 ? healthHospitals : data;
        setHospitals(finalHospitals);

        // Pre-select if passed in query param
        if (initialHospitalId) {
          const found = finalHospitals.find(h => h.id === initialHospitalId);
          if (found) {
            setSelectedHospital(found);
            fetchDoctorsForHospital(found.id);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecialties = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/hospital/specialties/');
      if (res.ok) {
        setSpecialties(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDoctorsForHospital = async (hospitalId, specialtyId = null) => {
    try {
      setLoading(true);
      let url = `http://localhost:8000/api/v1/hospital/doctors/?hospital=${hospitalId}`;
      if (specialtyId) {
        url += `&specialty=${specialtyId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        setDoctors(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleSelectHospital = (hosp) => {
    setSelectedHospital(hosp);
    setSelectedSpecialty(null);
    setSelectedDoctor(null);
    fetchDoctorsForHospital(hosp.id);
    setCurrentStep(2);
  };

  const handleSelectSpecialty = (spec) => {
    setSelectedSpecialty(spec);
    setSelectedDoctor(null);
    if (selectedHospital) {
      fetchDoctorsForHospital(selectedHospital.id, spec.id);
    }
    setCurrentStep(3);
  };

  const handleSelectDoctor = (doc) => {
    setSelectedDoctor(doc);
    if (doc.is_available_for_telemedicine) {
      setBookingDetails(prev => ({ ...prev, type: 'TELEMEDICINE' }));
    }
    setCurrentStep(4);
  };

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        hospital: selectedHospital.id,
        doctor: selectedDoctor.id,
        appointment_date: `${bookingDetails.date}T${bookingDetails.time}:00Z`,
        consultation_type: bookingDetails.type === 'TELEMEDICINE' ? 'TELEMEDICINE' : 'IN_PERSON',
        reason: bookingDetails.reason,
        notes: `Patient: ${bookingDetails.patient_name} (${bookingDetails.patient_phone})`,
        patient_name: bookingDetails.patient_name,
        patient_phone: bookingDetails.patient_phone,
        patient_email: bookingDetails.patient_email
      };

      const res = await fetch('http://localhost:8000/api/v1/hospital/appointments/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Booking error:', errorData);
        alert(`Erreur lors de la réservation : ${errorData.detail || JSON.stringify(errorData) || 'Veuillez vérifier les informations'}`);
        return;
      }

      const createdAppointment = await res.json();
      const code = `RDV-${createdAppointment.id ? createdAppointment.id.substring(0, 6).toUpperCase() : Math.floor(100000 + Math.random() * 900000)}`;
      setConfirmationCode(code);
      setCurrentStep(6);
    } catch (err) {
      console.error('Booking network error:', err);
      alert('Erreur de connexion au serveur. Veuillez vérifier votre réseau et réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step Progress Component
  const steps = [
    { num: 1, label: 'Hôpital' },
    { num: 2, label: 'Spécialité' },
    { num: 3, label: 'Médecin' },
    { num: 4, label: 'Date & Heure' },
    { num: 5, label: 'Motif & Mode' },
    { num: 6, label: 'Confirmation' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-full text-xs font-bold uppercase tracking-wider border border-teal-200 dark:border-teal-800">
            <Sparkles className="w-3.5 h-3.5" /> Module Indépendant • Prise de Rendez-vous Patient
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
            Réserver une Consultation Médicale
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            Prenez rendez-vous en quelques clics auprès des établissements et médecins spécialistes au Burundi.
          </p>
        </div>

        {/* Stepper Wizard Indicator */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between overflow-x-auto gap-2 pb-2 sm:pb-0">
            {steps.map((st, index) => {
              const isActive = currentStep === st.num;
              const isCompleted = currentStep > st.num;

              return (
                <React.Fragment key={st.num}>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition ${
                      isCompleted 
                        ? 'bg-emerald-600 text-white' 
                        : isActive 
                        ? 'bg-teal-600 text-white ring-4 ring-teal-100 dark:ring-teal-900' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : st.num}
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap hidden md:inline ${
                      isActive ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {st.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 min-w-[20px] rounded transition ${
                      currentStep > st.num ? 'bg-emerald-500' : 'bg-gray-100 dark:bg-gray-800'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Étape 1: Recherche Hôpital */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-teal-600" /> Étape 1 : Sélectionnez un Établissement Hospitalier
            </h2>

            {loading ? (
              <div className="text-center py-12 text-gray-500">Chargement des hôpitaux partenaires...</div>
            ) : hospitals.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-50" />
                <p className="text-gray-500">Aucun hôpital disponible pour le moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hospitals.map(h => (
                  <div 
                    key={h.id} 
                    onClick={() => handleSelectHospital(h)}
                    className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-teal-500 dark:hover:border-teal-500 transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-2.5 py-1 rounded">
                          {h.primary_category_name || 'Hôpital'}
                        </span>
                        <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400" /> 4.9
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{h.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-3">
                        <MapPin className="w-3.5 h-3.5" /> {h.address || h.province || 'Burundi'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{h.short_description || h.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs font-semibold text-teal-600 dark:text-teal-400">
                      <span>Choisir cet hôpital</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Étape 2: Sélectionne Spécialité */}
        {currentStep === 2 && selectedHospital && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <button onClick={() => setCurrentStep(1)} className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1 cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Changer d'hôpital ({selectedHospital.name})
              </button>
            </div>

            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Stethoscope className="w-6 h-6 text-teal-600" /> Étape 2 : Choisissez une Spécialité Médicale
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <div 
                onClick={() => {
                  setSelectedSpecialty(null);
                  fetchDoctorsForHospital(selectedHospital.id);
                  setCurrentStep(3);
                }}
                className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-teal-200 dark:border-teal-800 shadow-sm hover:shadow-md transition cursor-pointer text-center flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm text-gray-900 dark:text-white">Toutes spécialités</span>
                <span className="text-[11px] text-gray-400">Voir tous les médecins</span>
              </div>

              {specialties.map(sp => (
                <div 
                  key={sp.id}
                  onClick={() => handleSelectSpecialty(sp)}
                  className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-teal-500 transition cursor-pointer text-center flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                    {sp.name[0]}
                  </div>
                  <span className="font-bold text-sm text-gray-900 dark:text-white">{sp.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Étape 3: Sélectionne Médecin */}
        {currentStep === 3 && selectedHospital && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <button onClick={() => setCurrentStep(2)} className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1 cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Changer de spécialité {selectedSpecialty ? `(${selectedSpecialty.name})` : ''}
              </button>
            </div>

            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <User className="w-6 h-6 text-teal-600" /> Étape 3 : Choisissez votre Médecin Spécialiste
            </h2>

            {loading ? (
              <div className="text-center py-12 text-gray-500">Recherche des praticiens disponibles...</div>
            ) : doctors.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8">
                <Stethoscope className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-50" />
                <p className="text-gray-500">Aucun médecin disponible pour cette spécialité dans cet hôpital.</p>
                <button onClick={() => setCurrentStep(2)} className="mt-3 text-xs font-bold text-teal-600 hover:underline">
                  Voir d'autres spécialités
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doctors.map(doc => {
                  const docName = `${doc.user_details?.first_name || ''} ${doc.user_details?.last_name || ''}`;
                  const mainSpec = doc.specialties && doc.specialties.length > 0 ? doc.specialties[0].name : 'Spécialiste';
                  return (
                    <div 
                      key={doc.id}
                      onClick={() => handleSelectDoctor(doc)}
                      className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-teal-500 transition cursor-pointer flex flex-col justify-between"
                    >
                      <div className="flex gap-4 items-start">
                        <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-extrabold text-xl flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-800">
                          {doc.user_details?.first_name?.[0] || 'D'}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white text-base">{docName}</h3>
                          <p className="text-xs font-semibold text-teal-600 dark:text-teal-400">{mainSpec}</p>
                          <p className="text-xs text-gray-400 mt-1">Licence: {doc.medical_license_number}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 font-bold">
                            Tarif : {Number(doc.consultation_fee).toLocaleString()} BIF
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs font-semibold text-teal-600 dark:text-teal-400">
                        <span>Sélectionner ce médecin</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Étape 4 & 5: Date/Heure, Motif & Mode */}
        {(currentStep === 4 || currentStep === 5) && selectedDoctor && (
          <form onSubmit={handleConfirmBooking} className="space-y-6">
            <div className="flex justify-between items-center">
              <button type="button" onClick={() => setCurrentStep(3)} className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1 cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Changer de médecin
              </button>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
              
              {/* Recaptilatif Médecin Sélectionné */}
              <div className="p-4 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-teal-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
                  Dr
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">
                    {selectedDoctor.user_details?.first_name} {selectedDoctor.user_details?.last_name}
                  </h3>
                  <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                    {selectedHospital.name} • Fee: {Number(selectedDoctor.consultation_fee).toLocaleString()} BIF
                  </p>
                </div>
              </div>

              {/* Date et Créneau Horaire Paramétrés */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600" /> Étape 4 : Choisissez un Créneau Disponible
                </h3>
                {(!selectedDoctor.schedules || selectedDoctor.schedules.length === 0) ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    Aucun horaire n'a été configuré par l'administration pour ce médecin. Veuillez contacter l'hôpital.
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Sélectionnez une date et heure disponibles :</label>
                    <select 
                      required
                      value={`${bookingDetails.date}|${bookingDetails.time}`}
                      onChange={e => {
                        const [d, t] = e.target.value.split('|');
                        if (d && t) setBookingDetails({ ...bookingDetails, date: d, time: t });
                      }}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      <option value="|" disabled>-- Choisissez un créneau parmi les disponibilités --</option>
                      {(() => {
                        const options = [];
                        const today = new Date();
                        const daysMap = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
                        
                        // Map backend day_of_week (0=Lundi..6=Dimanche) to JS day (0=Dimanche..6=Samedi)
                        const getJSDay = (backendDay) => backendDay === 6 ? 0 : backendDay + 1;

                        for (let i = 0; i < 21; i++) { // Prochains 21 jours
                          const d = new Date(today);
                          d.setDate(today.getDate() + i);
                          const jsDay = d.getDay();
                          
                          // Trouver les horaires pour ce jour
                          const dailySchedules = selectedDoctor.schedules.filter(s => getJSDay(s.day_of_week) === jsDay && s.is_available);
                          
                          if (dailySchedules.length > 0) {
                            const dateStr = d.toISOString().split('T')[0];
                            const displayDate = `${daysMap[jsDay]} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                            
                            dailySchedules.forEach((sched, index) => {
                              const start = sched.start_time.slice(0, 5);
                              const end = sched.end_time.slice(0, 5);
                              // Générer des créneaux de 30 minutes dans cette plage
                              let currentH = parseInt(start.split(':')[0]);
                              let currentM = parseInt(start.split(':')[1]);
                              const endH = parseInt(end.split(':')[0]);
                              const endM = parseInt(end.split(':')[1]);
                              
                              while (currentH < endH || (currentH === endH && currentM < endM)) {
                                const timeStr = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;
                                options.push(
                                  <option key={`${dateStr}-${timeStr}`} value={`${dateStr}|${timeStr}`}>
                                    {displayDate} à {timeStr}
                                  </option>
                                );
                                
                                currentM += 30;
                                if (currentM >= 60) {
                                  currentH += 1;
                                  currentM = 0;
                                }
                              }
                            });
                          }
                        }
                        
                        return options.length > 0 ? options : <option disabled>Aucun créneau disponible dans les 3 prochaines semaines</option>;
                      })()}
                    </select>
                  </div>
                )}
              </div>

              {/* Motif et Mode de consultation */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" /> Étape 5 : Motif et Mode de Consultation
                </h3>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Motif de consultation</label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="Décrivez brièvement les symptômes ou l'objet du rendez-vous..."
                    value={bookingDetails.reason}
                    onChange={e => setBookingDetails({ ...bookingDetails, reason: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Mode de Consultation</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label 
                      onClick={() => setBookingDetails({ ...bookingDetails, type: 'PRESENTIAL' })}
                      className={`p-4 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                        bookingDetails.type === 'PRESENTIAL' 
                          ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 font-bold text-teal-900 dark:text-teal-300' 
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <Stethoscope className="w-6 h-6 text-teal-600" />
                      <div>
                        <div className="text-sm font-bold">Consultation Présentielle</div>
                        <div className="text-xs opacity-75">Rendez-vous sur place à l'Hôpital</div>
                      </div>
                    </label>

                    <label 
                      onClick={() => {
                        if (selectedDoctor.is_available_for_telemedicine) {
                          setBookingDetails({ ...bookingDetails, type: 'TELEMEDICINE' });
                        }
                      }}
                      className={`p-4 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                        !selectedDoctor.is_available_for_telemedicine ? 'opacity-40 cursor-not-allowed' : ''
                      } ${
                        bookingDetails.type === 'TELEMEDICINE' 
                          ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 font-bold text-teal-900 dark:text-teal-300' 
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <Video className="w-6 h-6 text-teal-600" />
                      <div>
                        <div className="text-sm font-bold">Téléconsultation (Vidéo)</div>
                        <div className="text-xs opacity-75">Consultation sécurisée à distance</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Coordonnées du Patient */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nom complet du patient</label>
                    <input 
                      type="text"
                      required
                      placeholder="Jean Ndayishimiye"
                      value={bookingDetails.patient_name}
                      onChange={e => setBookingDetails({ ...bookingDetails, patient_name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Téléphone (SMS Notification)</label>
                    <input 
                      type="tel"
                      required
                      placeholder="+257 79 00 00 00"
                      value={bookingDetails.patient_phone}
                      onChange={e => setBookingDetails({ ...bookingDetails, patient_phone: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input 
                      type="email"
                      required
                      placeholder="patient@gmail.com"
                      value={bookingDetails.patient_email}
                      onChange={e => setBookingDetails({ ...bookingDetails, patient_email: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>

              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 transition cursor-pointer flex items-center gap-2"
                >
                  {submitting ? 'Validation...' : 'Confirmer et Réserver mon Rendez-vous'} <ChevronRight className="w-5 h-5" />
                </button>
              </div>

            </div>
          </form>
        )}

        {/* Étape 6: Confirmation & Notification */}
        {currentStep === 6 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 sm:p-12 shadow-xl border border-gray-200 dark:border-gray-800 text-center space-y-6 max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Rendez-vous Confirmé avec Succès !</h2>
              <p className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 inline-block px-3 py-1 rounded-full border border-teal-200 dark:border-teal-800">
                Code de Référence : {confirmationCode}
              </p>
            </div>

            {/* Notification Alert Box */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs font-medium flex items-center gap-3 text-left">
              <BellRing className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <strong>Notification instantanée envoyée :</strong> Une confirmation par SMS au <strong>{bookingDetails.patient_phone}</strong> et par Email à <strong>{bookingDetails.patient_email}</strong> a été transmise.
              </div>
            </div>

            {/* Récapitulatif */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl text-left space-y-2 text-xs text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-800">
              <p className="flex justify-between"><span>Hôpital :</span> <strong className="text-gray-900 dark:text-white">{selectedHospital?.name}</strong></p>
              <p className="flex justify-between"><span>Médecin :</span> <strong className="text-gray-900 dark:text-white">{selectedDoctor?.user_details?.first_name || selectedDoctor?.full_name || selectedDoctor?.name} {selectedDoctor?.user_details?.last_name || ''}</strong></p>
              <p className="flex justify-between"><span>Date & Heure :</span> <strong className="text-gray-900 dark:text-white">{bookingDetails.date} à {bookingDetails.time}</strong></p>
              <p className="flex justify-between"><span>Mode de consultation :</span> <strong className="text-gray-900 dark:text-white">{bookingDetails.type === 'TELEMEDICINE' ? 'Téléconsultation Vidéo' : 'Présentiel à l\'hôpital'}</strong></p>
              <p className="flex justify-between"><span>Tarif estimé :</span> <strong className="text-teal-600 dark:text-teal-400 font-bold">{Number(selectedDoctor?.consultation_fee || 0).toLocaleString()} BIF</strong></p>
            </div>

            <button 
              onClick={() => navigate('/hospitals')}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition cursor-pointer text-sm shadow-md"
            >
              Retour à l'Annuaire des Hôpitaux
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
