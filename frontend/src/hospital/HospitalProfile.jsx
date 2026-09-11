import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, MapPin, Phone, Clock, Star, Users, CheckCircle, 
  Navigation, Calendar, Video, Stethoscope, ChevronRight, AlertCircle, X, Shield, FlaskConical, History
} from 'lucide-react';
import DoctorCard from './DoctorCard';
import { useParams, Link } from 'react-router-dom';
import api from '../shared/api';
import hospitalService from './hospitalService';
import { useAuth } from '../context/AuthContext';
export default function HospitalProfile() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [hospital, setHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [publishedSlots, setPublishedSlots] = useState([]);
  const [services, setServices] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Booking Modal State
  const [selectedService, setSelectedService] = useState(null);
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
  const [doctorSlots, setDoctorSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);
  const [payerLumicash, setPayerLumicash] = useState('');
  const [payMsg, setPayMsg] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);

  const doctorsWithPublishedSlots = new Set(
    publishedSlots.map((slot) => slot.doctor).filter(Boolean)
  );
  const servicesWithSlots = new Set(
    publishedSlots.map((slot) => slot.service).filter(Boolean).map(String)
  );
  const publicDoctors = doctors.filter(
    (doc) => doc.staff_category !== 'NURSE'
      && doc.staff_category !== 'RECEPTIONIST'
      && doc.professional_title !== 'INFIRMIER'
      && doc.is_public_directory !== false
  );

  const closeBooking = () => {
    setSelectedService(null);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setDoctorSlots([]);
    setBookingStep(1);
    setConfirmedAppointment(null);
    setPayerLumicash('');
    setPayMsg('');
  };

  const resetBookingForm = () => {
    setBookingStep(1);
    setSelectedSlot(null);
    setConfirmedAppointment(null);
    setPayerLumicash('');
    setPayMsg('');
    setBookingData({
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      reason: '',
      type: 'PRESENTIAL',
      patient_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
      patient_phone: user?.phone_number || '',
      patient_email: user?.email || '',
    });
  };

  const consultationFee = Number(
    selectedSlot?.consultation_fee
    ?? selectedDoctor?.consultation_fee
    ?? selectedDoctor?.fee
    ?? 0
  );
  const feeLabel = selectedSlot?.formatted_consultation_fee
    || (consultationFee > 0
      ? `${consultationFee.toLocaleString('fr-BI')} BIF`
      : 'Gratuit');

  useEffect(() => {
    const fetchHospitalDetails = async () => {
      try {
        const h = await api.get(`businesses/${id}/`);
        const [apiServices, apiExams] = await Promise.all([
          hospitalService.getServices(id).catch(() => []),
          hospitalService.getPublicExams(id).catch(() => []),
        ]);

        const normalizedServices = Array.isArray(apiServices) ? apiServices : [];
        const categoryServices = (h.categories_detail || []).map((c, idx) => ({
          id: c.id || `cat-${idx}`,
          name: c.name || 'Service',
        }));
        setServices(normalizedServices.length > 0 ? normalizedServices : categoryServices);
        setExams(Array.isArray(apiExams) ? apiExams : apiExams?.results || []);

        const fromExtra = h.extra_attributes?.insurances
          || h.extra_attributes?.accepted_insurances
          || [];
        const fromProfile = h.accepted_insurances || [];
        const insurances = [...new Set(
          [...(Array.isArray(fromExtra) ? fromExtra : []), ...(Array.isArray(fromProfile) ? fromProfile : [])]
            .map((x) => String(x || '').trim())
            .filter(Boolean)
        )];

        setHospital({
          id: h.id,
          name: h.name,
          logo: h.logo || null,
          category: h.primary_category?.name || h.primary_category_name || 'Hôpital',
          address: h.address || h.province || h.commune || 'Burundi',
          description: h.description || h.short_description || '',
          phone: h.phone || null,
          email: h.email || null,
          website: h.website || '',
          hours: h.extra_attributes?.is_24_7 ? 'Ouvert 24/7' : (h.opening_hours || 'Contactez l\'établissement'),
          hasEmergency: h.extra_attributes?.is_24_7 || false,
          licenseNumber: h.extra_attributes?.license_number || null,
          beds: h.extra_attributes?.rooms_count || h.extra_attributes?.bed_capacity || null,
          insurances,
        });

        fetchDoctors(h.id);
      } catch (error) {
        console.error('Error fetching hospital details:', error);
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
      const [docs, slots] = await Promise.all([
        hospitalService.getPublicDoctors(hospitalUuid),
        hospitalService.getPublishedSlots(hospitalUuid).catch(() => []),
      ]);
      setDoctors(Array.isArray(docs) ? docs : []);
      setPublishedSlots(Array.isArray(slots) ? slots : []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
      setDoctors([]);
      setPublishedSlots([]);
    }
  };

  const handleOpenServiceBooking = async (srv) => {
    setSelectedService(srv);
    setSelectedDoctor(null);
    resetBookingForm();
    try {
      const slotsData = await hospitalService.getPublishedSlots(id, undefined, srv.id);
      const list = Array.isArray(slotsData) ? slotsData : [];
      setDoctorSlots(list.filter((s) => (s.remaining_slots ?? 1) > 0));
    } catch (err) {
      console.error('Error fetching service slots:', err);
      setDoctorSlots([]);
    }
  };

  const handleOpenBooking = async (doc) => {
    setSelectedDoctor(doc);
    setSelectedService(null);
    resetBookingForm();

    try {
      const slotsData = await hospitalService.getPublishedSlots(id, doc.id);
      const list = Array.isArray(slotsData) ? slotsData : [];
      setDoctorSlots(list.filter((s) => (s.remaining_slots ?? 1) > 0));
    } catch (err) {
      console.error('Error fetching doctor slots:', err);
      setDoctorSlots([]);
    }
  };

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      alert('Veuillez sélectionner un créneau publié par l\'administration.');
      return;
    }
    const fee = Number(
      selectedSlot?.consultation_fee
      ?? selectedDoctor?.consultation_fee
      ?? selectedDoctor?.fee
      ?? 0
    );
    if (fee > 0 && !payerLumicash.trim()) {
      alert('Indiquez votre numéro Lumicash pour payer les frais de consultation.');
      return;
    }
    setSubmittingBooking(true);
    setPayMsg('');
    try {
      const data = await hospitalService.createAppointment({
        slot: selectedSlot.id,
        service: selectedSlot.service || selectedService?.id,
        reason: bookingData.reason,
        patient_name: bookingData.patient_name,
        patient_phone: bookingData.patient_phone,
        patient_email: bookingData.patient_email,
      }, !!token);

      let finalAppt = data;
      const amount = Number(data?.consultation_fee_amount ?? fee);
      if (amount > 0 && data?.payment_status !== 'PAID') {
        if (!payerLumicash.trim()) {
          alert('Numéro Lumicash obligatoire pour payer la consultation.');
          setConfirmedAppointment(data);
          setBookingStep(2);
          return;
        }
        const payRes = await hospitalService.payAppointment(
          data.id,
          payerLumicash.trim(),
          !!token,
        );
        finalAppt = payRes.appointment || data;
        setPayMsg(payRes.message || '');
        if (!payRes.ok && !payRes.already_paid) {
          alert(payRes.message || 'Paiement non initié. Vous pourrez réessayer.');
        }
      }
      setConfirmedAppointment(finalAppt);
      setBookingStep(2);
    } catch (err) {
      alert(`Erreur : ${err.message || 'Veuillez vérifier vos informations'}`);
    } finally {
      setSubmittingBooking(false);
    }
  };

  const confirmStubPayment = async () => {
    if (!confirmedAppointment?.id) return;
    setPaymentBusy(true);
    try {
      const res = await hospitalService.confirmAppointmentPayment(confirmedAppointment.id, !!token);
      if (!res.ok) throw new Error(res.message || 'Confirmation échouée');
      setConfirmedAppointment(res.appointment || confirmedAppointment);
      setPayMsg(res.message || 'Paiement confirmé.');
    } catch (err) {
      alert(err.message || 'Erreur confirmation paiement');
    } finally {
      setPaymentBusy(false);
    }
  };

  const retryPay = async () => {
    if (!confirmedAppointment?.id) return;
    if (!payerLumicash.trim()) {
      alert('Indiquez votre numéro Lumicash.');
      return;
    }
    setPaymentBusy(true);
    try {
      const res = await hospitalService.payAppointment(
        confirmedAppointment.id,
        payerLumicash.trim(),
        !!token,
      );
      setConfirmedAppointment(res.appointment || confirmedAppointment);
      setPayMsg(res.message || '');
      if (!res.ok && !res.already_paid) alert(res.message || 'Échec paiement');
    } catch (err) {
      alert(err.message || 'Erreur paiement');
    } finally {
      setPaymentBusy(false);
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
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-md shrink-0 border border-gray-100 dark:border-gray-800 overflow-hidden">
             <div className="w-full h-full bg-teal-50 dark:bg-teal-950/60 rounded-xl flex items-center justify-center overflow-hidden">
               {hospital.logo ? (
                 <img src={hospital.logo} alt={hospital.name} className="w-full h-full object-cover" />
               ) : (
                 <HeartPulse className="w-12 h-12 text-teal-600 dark:text-teal-400" />
               )}
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
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                  {hospital.beds != null && (
                    <span className="flex items-center gap-1"><Users className="w-4 h-4 text-gray-400" /> {hospital.beds} lits</span>
                  )}
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-gray-400" /> {hospital.address}</span>
                  {hospital.phone && (
                    <span className="flex items-center gap-1"><Phone className="w-4 h-4 text-gray-400" /> {hospital.phone}</span>
                  )}
                </div>
              </div>
              {hospital.phone && (
                <div className="flex gap-2 w-full md:w-auto flex-wrap">
                  <Link
                    to={`/hospitals/${id}/historique`}
                    className="flex-1 md:flex-none px-4 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-50 font-medium rounded-xl transition flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700"
                  >
                    <History className="w-4 h-4" /> Mon historique
                  </Link>
                  <a href={`tel:${hospital.phone}`} className="flex-1 md:flex-none px-4 py-2 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 hover:bg-teal-100 font-medium rounded-xl transition flex items-center justify-center gap-2 border border-teal-200 dark:border-teal-800">
                    <Phone className="w-4 h-4" /> Appeler ({hospital.phone})
                  </a>
                </div>
              )}
              {!hospital.phone && (
                <Link
                  to={`/hospitals/${id}/historique`}
                  className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-50 font-medium rounded-xl transition inline-flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700"
                >
                  <History className="w-4 h-4" /> Mon historique
                </Link>
              )}
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
              <p className="text-xs text-gray-500 mb-3">
                Choisissez d’abord le service souhaité, puis un créneau disponible.
              </p>
              {services.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun service publié pour le moment.</p>
              ) : (
                <div className="space-y-2">
                  {services.map((srv) => {
                    const hasSlots = servicesWithSlots.has(String(srv.id));
                    const bookable = srv.online_booking_available !== false && hasSlots;
                    return (
                      <div
                        key={srv.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-teal-100 dark:border-teal-900 bg-teal-50/50 dark:bg-teal-950/30"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-gray-900 dark:text-white">{srv.name}</div>
                          {srv.description && (
                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{srv.description}</div>
                          )}
                          {srv.formatted_cost && (
                            <div className="text-xs font-semibold text-teal-700 mt-1">{srv.formatted_cost}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!bookable}
                          onClick={() => handleOpenServiceBooking(srv)}
                          className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                            bookable
                              ? 'bg-teal-700 hover:bg-teal-800 text-white cursor-pointer'
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          {bookable ? 'Prendre RDV' : 'Pas de créneau'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Catalogue examens & tarifs */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 sm:p-8">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FlaskConical className="w-6 h-6 text-teal-600" />
                  Examens & tarifs
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Examens proposés par cet établissement et leur tarif.
                </p>
              </div>

              {exams.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                  <FlaskConical className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-50" />
                  <p className="text-gray-500 text-sm font-medium">Aucun examen publié pour le moment.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  {exams.map((ex) => (
                    <li
                      key={ex.id}
                      className="flex items-start justify-between gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white">{ex.name}</div>
                        {ex.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                            {ex.description}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-bold text-teal-800 dark:text-teal-300 whitespace-nowrap text-sm">
                          {ex.formatted_price
                            || (Number(ex.price)
                              ? `${Number(ex.price).toLocaleString('fr-BI')} ${ex.currency || 'BIF'}`
                              : 'Sur demande')}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Annuaire des Médecins Spécialistes */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Stethoscope className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                    Annuaire des Médecins Spécialistes
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Praticiens enregistrés par l&apos;établissement.
                  </p>
                </div>
              </div>

              {publicDoctors.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                  <Stethoscope className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-50" />
                  <p className="text-gray-500 text-sm font-medium">Aucun médecin répertorié pour le moment dans cet établissement.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {publicDoctors.map((doc) => (
                    <DoctorCard
                      key={doc.id}
                      doctor={doc}
                      onBook={handleOpenBooking}
                      hasPublishedSlots={doctorsWithPublishedSlots.has(doc.id)}
                    />
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

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="font-bold text-gray-900 dark:text-white text-base mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-600" /> Assurances &amp; mutuelles
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Assurances maladie et mutuelles acceptées par cet établissement.
              </p>
              {(hospital.insurances || []).length === 0 ? (
                <p className="text-sm text-gray-500">Aucune assurance déclarée pour le moment.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {hospital.insurances.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border border-teal-100 dark:border-teal-900"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal : RDV par service (prioritaire) ou par médecin */}
      {(selectedService || selectedDoctor) && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="px-6 py-4 bg-gradient-to-r from-teal-700 to-emerald-800 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <h3 className="font-bold text-lg">Prise de Rendez-vous Médical</h3>
              </div>
              <button type="button" onClick={closeBooking} className="text-white/80 hover:text-white text-2xl cursor-pointer">&times;</button>
            </div>

            {bookingStep === 1 ? (
              <form onSubmit={handleConfirmBooking} className="p-6 space-y-4">
                <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-100 dark:border-teal-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {selectedService ? <HeartPulse className="w-5 h-5" /> : 'Dr'}
                  </div>
                  <div className="min-w-0">
                    {selectedService ? (
                      <>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">{selectedService.name}</h4>
                        <p className="text-xs text-teal-700 dark:text-teal-300 font-semibold">
                          {hospital.name}
                          {selectedService.formatted_cost ? ` • ${selectedService.formatted_cost}` : ''}
                          {selectedSlot && ` • Consultation médecin : ${feeLabel}`}
                        </p>
                      </>
                    ) : (
                      <>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                          {selectedDoctor.user_details?.first_name || selectedDoctor.full_name || selectedDoctor.name}{' '}
                          {selectedDoctor.user_details?.last_name || ''}
                        </h4>
                        <p className="text-xs text-teal-700 dark:text-teal-300 font-semibold">
                          {hospital.name} • Tarif: {Number(selectedDoctor.consultation_fee || selectedDoctor.fee || 0).toLocaleString()} BIF
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-600" /> Session / Créneau de Consultation
                  </h3>
                  {doctorSlots.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                      {selectedService
                        ? 'Aucun créneau publié pour ce service. Contactez l’hôpital ou choisissez un autre service.'
                        : 'Aucune session planifiée pour ce médecin. Contactez l’hôpital pour prendre rendez-vous.'}
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {doctorSlots.map((slot) => {
                        const isFull = (slot.remaining_slots ?? 0) <= 0;
                        const isSelected = selectedSlot?.id === slot.id;
                        const dateObj = new Date(slot.slot_date);
                        const displayDate = dateObj.toLocaleDateString('fr-FR', {
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                        });

                        return (
                          <div
                            key={slot.id}
                            onClick={() => !isFull && setSelectedSlot(slot)}
                            className={`p-3 rounded-xl border ${isSelected ? 'border-teal-600 bg-teal-50 dark:bg-teal-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-teal-300'} ${isFull ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800' : 'cursor-pointer'} transition`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                {slot.title}
                                {isFull && (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-bold uppercase tracking-wide">
                                    Complet
                                  </span>
                                )}
                              </h4>
                              {!isFull && (
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-teal-600' : 'border-gray-300'}`}>
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-teal-600" />}
                                </div>
                              )}
                            </div>
                            {(selectedService ? slot.doctor_name : slot.service_name) && (
                              <p className="text-xs text-teal-700 dark:text-teal-400 font-medium mb-1">
                                {selectedService
                                  ? `Avec ${slot.doctor_name}${slot.doctor_title ? ` (${slot.doctor_title})` : ''}`
                                  : `Service : ${slot.service_name}`}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mt-2">
                              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {displayDate}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> {slot.start_time?.substring(0, 5)} - {slot.end_time?.substring(0, 5)}
                              </span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap justify-between items-center text-[11px] gap-2">
                  <span className="font-medium text-teal-700 dark:text-teal-400 flex items-center gap-1">
                                {slot.consultation_type === 'TELEMEDICINE' ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                {slot.consultation_type === 'TELEMEDICINE' ? 'Téléconsultation' : 'Présentiel'}
                              </span>
                              <span className="font-bold text-teal-800 dark:text-teal-300">
                                {slot.formatted_consultation_fee
                                  || (Number(slot.consultation_fee) > 0
                                    ? `${Number(slot.consultation_fee).toLocaleString('fr-BI')} BIF`
                                    : (selectedDoctor
                                      ? `${Number(selectedDoctor.consultation_fee || 0).toLocaleString('fr-BI')} BIF`
                                      : '—'))}
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

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Motif de consultation</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="ex: Maux de tête fréquents, suivi annuel, bilan de santé..."
                    value={bookingData.reason}
                    onChange={(e) => setBookingData({ ...bookingData, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nom complet du patient</label>
                    <input
                      type="text"
                      required
                      placeholder="Votre nom..."
                      value={bookingData.patient_name}
                      onChange={(e) => setBookingData({ ...bookingData, patient_name: e.target.value })}
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
                      onChange={(e) => setBookingData({ ...bookingData, patient_phone: e.target.value })}
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
                      onChange={(e) => setBookingData({ ...bookingData, patient_email: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>

                {(consultationFee > 0 || Number(selectedSlot?.consultation_fee || selectedDoctor?.consultation_fee || 0) > 0) && (
                  <div className="rounded-xl border border-[#1a237e]/20 overflow-hidden bg-white dark:bg-gray-900">
                    <div className="bg-[#FFD600] px-4 py-3 flex items-center justify-center">
                      <img
                        src="/lumicash.png"
                        alt="Lumicash"
                        className="h-12 w-auto object-contain"
                      />
                    </div>
                    <div className="p-4 space-y-3">
                      <p className="text-center text-base font-bold text-gray-900 dark:text-white">
                        {feeLabel}
                      </p>
                      <input
                        type="tel"
                        required
                        aria-label="Numéro Lumicash"
                        placeholder="79xxxxxx"
                        value={payerLumicash}
                        onChange={(e) => setPayerLumicash(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1a237e]"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button type="button" onClick={closeBooking} className="px-4 py-2 text-gray-600 dark:text-gray-300 text-sm font-medium cursor-pointer">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBooking || doctorSlots.length === 0}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    {submittingBooking
                      ? 'Traitement...'
                      : consultationFee > 0
                        ? `Réserver et payer ${feeLabel}`
                        : 'Confirmer le Rendez-vous'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 dark:text-white">Demande enregistrée</h4>

                {confirmedAppointment && (
                  <div className="inline-block px-4 py-2 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 rounded-2xl border border-teal-200 dark:border-teal-800">
                    <p className="text-xs font-semibold uppercase tracking-wider">Numéro de suivi</p>
                    <p className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 font-mono">
                      {confirmedAppointment.reference_code || `N° ${confirmedAppointment.queue_number || 1}`}
                    </p>
                    {confirmedAppointment.queue_number && (
                      <p className="text-[11px] text-teal-600/80 mt-0.5">
                        Ordre de passage provisoire : #{confirmedAppointment.queue_number}
                      </p>
                    )}
                  </div>
                )}

                {confirmedAppointment && Number(confirmedAppointment.consultation_fee_amount || 0) > 0 && (
                  <div className={`p-4 rounded-xl text-left text-sm border ${
                    ['PAID', 'WAIVED'].includes(confirmedAppointment.payment_status)
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <p className="font-semibold">
                      Paiement consultation :{' '}
                      {confirmedAppointment.payment_status === 'PAID' && 'Payé'}
                      {confirmedAppointment.payment_status === 'AWAITING_PIN' && 'En attente PIN Lumicash'}
                      {confirmedAppointment.payment_status === 'UNPAID' && 'Non payé'}
                      {confirmedAppointment.payment_status === 'FAILED' && 'Échoué'}
                      {confirmedAppointment.payment_status === 'WAIVED' && 'Exonéré'}
                    </p>
                    <p className="text-xs mt-1">
                      {Number(confirmedAppointment.consultation_fee_amount).toLocaleString('fr-BI')}{' '}
                      {confirmedAppointment.consultation_fee_currency || 'BIF'}
                    </p>
                    {payMsg && <p className="text-xs mt-2">{payMsg}</p>}
                    {!['PAID', 'WAIVED'].includes(confirmedAppointment.payment_status) && (
                      <div className="mt-3 space-y-2">
                        <input
                          type="tel"
                          placeholder="Numéro Lumicash"
                          value={payerLumicash}
                          onChange={(e) => setPayerLumicash(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                        />
                        <div className="flex flex-wrap gap-2">
                          {confirmedAppointment.payment_status === 'AWAITING_PIN' && (
                            <button
                              type="button"
                              disabled={paymentBusy}
                              onClick={confirmStubPayment}
                              className="px-3 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold disabled:opacity-50"
                            >
                              Confirmer le PIN (simulation)
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={paymentBusy}
                            onClick={retryPay}
                            className="px-3 py-2 rounded-lg bg-white border text-xs font-semibold disabled:opacity-50"
                          >
                            Payer / Relancer Lumicash
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {confirmedAppointment?.patient_acknowledgment_message && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-xs text-left text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed border border-emerald-100 dark:border-emerald-900">
                    {confirmedAppointment.patient_acknowledgment_message}
                  </div>
                )}

                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {confirmedAppointment?.email_notifications?.patient_email_sent
                    ? `Un email de confirmation a été envoyé à ${bookingData.patient_email}.`
                    : selectedService
                      ? `Votre demande pour « ${selectedService.name} » est en attente de validation.`
                      : `Votre demande avec Dr. ${selectedDoctor?.user_details?.first_name || selectedDoctor?.full_name || selectedDoctor?.name || ''} est en attente de validation.`}
                </p>

                {confirmedAppointment?.slot_details ? (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-600 dark:text-gray-300 font-medium space-y-1">
                    <p>Session : <strong>{confirmedAppointment.slot_details.title}</strong></p>
                    {confirmedAppointment.slot_details.doctor_name && (
                      <p>Médecin : <strong>{confirmedAppointment.slot_details.doctor_name}</strong></p>
                    )}
                    {confirmedAppointment.service_name && (
                      <p>Service : <strong>{confirmedAppointment.service_name}</strong></p>
                    )}
                    <p>
                      Capacité restante :{' '}
                      <strong>
                        {confirmedAppointment.slot_details.remaining_slots} /{' '}
                        {confirmedAppointment.slot_details.max_patients} places
                      </strong>
                    </p>
                    <p>
                      Mode :{' '}
                      <strong>
                        {confirmedAppointment.slot_details.consultation_type === 'TELEMEDICINE'
                          ? 'Téléconsultation'
                          : 'Présentiel'}
                      </strong>
                    </p>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={closeBooking}
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
