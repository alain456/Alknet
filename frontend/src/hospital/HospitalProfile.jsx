import React, { useState, useEffect } from 'react';
import {
  HeartPulse, MapPin, Phone, Clock, Users, CheckCircle,
  Calendar, Video, History,
} from 'lucide-react';
import DoctorCard from './DoctorCard';
import { useParams, Link } from 'react-router-dom';
import api from '../shared/api';
import hospitalService from './hospitalService';
import BurundiPayPayerField from '../shared/components/BurundiPayPayerField';
import { isValidBurundiPayPhone, normalizeBurundiPayPhone } from '../shared/components/burundiPayPhone';
import { useAuth } from '../context/AuthContext';
import { websiteHref } from '../shared/websiteUrl';
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
  const [payerBurundiPay, setPayerBurundiPay] = useState('');
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
      && doc.staff_category !== 'ACCOUNTANT'
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
    setPayerBurundiPay('');
    setPayMsg('');
  };

  const resetBookingForm = () => {
    setBookingStep(1);
    setSelectedSlot(null);
    setConfirmedAppointment(null);
    setPayerBurundiPay('');
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
    if (fee > 0 && !isValidBurundiPayPhone(payerBurundiPay)) {
      alert('Numéro BurundiPay invalide : 8 chiffres requis (ex. 79xxxxxx).');
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
        if (!isValidBurundiPayPhone(payerBurundiPay)) {
          alert('Numéro BurundiPay invalide : 8 chiffres requis (ex. 79xxxxxx).');
          setConfirmedAppointment(data);
          setBookingStep(2);
          return;
        }
        const payRes = await hospitalService.payAppointment(
          data.id,
          normalizeBurundiPayPhone(payerBurundiPay),
          !!token,
          data.payment_token || '',
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
      const res = await hospitalService.confirmAppointmentPayment(
        confirmedAppointment.id,
        !!token,
        confirmedAppointment.payment_token || '',
      );
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
    if (!isValidBurundiPayPhone(payerBurundiPay)) {
      alert('Numéro BurundiPay invalide : 8 chiffres requis (ex. 79xxxxxx).');
      return;
    }
    setPaymentBusy(true);
    try {
      const res = await hospitalService.payAppointment(
        confirmedAppointment.id,
        normalizeBurundiPayPhone(payerBurundiPay),
        !!token,
        confirmedAppointment.payment_token || '',
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
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!hospital) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-ink font-semibold">
        Hôpital introuvable
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-ink pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex gap-4 min-w-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white ring-1 ring-border flex items-center justify-center overflow-hidden shrink-0">
              {hospital.logo ? (
                <img src={hospital.logo} alt="" className="w-full h-full object-contain p-2" />
              ) : (
                <HeartPulse className="w-10 h-10 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-muted">{hospital.category || 'Hôpital'}</p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-ink">{hospital.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {hospital.hasEmergency && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-alert px-2.5 py-1 rounded-full">
                    Urgences 24/7
                  </span>
                )}
                {hospital.beds != null && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                    <Users className="w-4 h-4 text-accent" /> {hospital.beds} lits
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-accent" /> {hospital.address}
                </span>
                {hospital.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-accent" /> {hospital.phone}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-ink max-w-2xl leading-relaxed">
                {hospital.description || 'Aucune description fournie.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              to={`/hospitals/${id}/historique`}
              className="px-4 py-2.5 bg-white border border-border text-ink text-sm font-bold rounded-full inline-flex items-center gap-2"
            >
              <History className="w-4 h-4" /> Historique
            </Link>
            {hospital.phone && (
              <a
                href={`tel:${hospital.phone}`}
                className="px-4 py-2.5 bg-accent text-ink text-sm font-bold rounded-full inline-flex items-center gap-2"
              >
                <Phone className="w-4 h-4" /> Appeler
              </a>
            )}
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-12">
            <section>
              <h2 className="text-2xl font-extrabold text-ink">Services</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Choisissez un service, puis un créneau publié pour réserver.
              </p>
              {services.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">Aucun service publié pour le moment.</p>
              ) : (
                <div className="mt-5 grid sm:grid-cols-2 gap-4">
                  {services.map((srv) => {
                    const hasSlots = servicesWithSlots.has(String(srv.id));
                    const bookable = srv.online_booking_available !== false && hasSlots;
                    return (
                      <article key={srv.id} className="rounded-3xl bg-white ring-1 ring-border p-5 flex flex-col">
                        <h3 className="font-extrabold text-ink">{srv.name}</h3>
                        {srv.description && (
                          <p className="mt-1 text-sm text-ink-muted line-clamp-3">{srv.description}</p>
                        )}
                        <button
                          type="button"
                          disabled={!bookable}
                          onClick={() => handleOpenServiceBooking(srv)}
                          className={`mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold ${
                            bookable
                              ? 'bg-accent text-ink'
                              : 'bg-surface text-ink-muted'
                          }`}
                        >
                          <Calendar className="w-4 h-4" />
                          {bookable ? 'Prendre RDV' : 'Pas de créneau'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-extrabold text-ink">Examens</h2>
              <p className="mt-1 text-sm text-ink-muted">Examens proposés par l&apos;établissement.</p>
              {exams.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">Aucun examen publié pour le moment.</p>
              ) : (
                <ul className="mt-5 rounded-3xl bg-white ring-1 ring-border divide-y divide-border">
                  {exams.map((ex) => (
                    <li key={ex.id} className="px-5 py-4">
                      <p className="font-bold text-ink">{ex.name}</p>
                      {ex.description && (
                        <p className="text-sm text-ink-muted mt-0.5">{ex.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-extrabold text-ink">Médecins</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Praticiens enregistrés. Le rendez-vous s&apos;ouvre lorsqu&apos;un créneau est publié.
              </p>
              {publicDoctors.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">Aucun médecin répertorié pour le moment.</p>
              ) : (
                <div className="mt-5 space-y-4">
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
            </section>
          </div>

          <div className="space-y-5 lg:sticky lg:top-24 self-start">
            <section
              className="rounded-3xl bg-white p-6 shadow-md"
              style={{ border: '2px solid #32667F', borderTopWidth: '8px' }}
            >
              <h2 className="text-lg font-extrabold text-ink">Accès</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-ink-muted">Horaires</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{hospital.hours || '—'}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Téléphone</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{hospital.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Site web</dt>
                  <dd className="mt-0.5 font-semibold text-ink break-all">
                    {hospital.website ? (
                      <a href={websiteHref(hospital.website)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                        {hospital.website}
                      </a>
                    ) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Email</dt>
                  <dd className="mt-0.5 font-semibold text-ink break-all">{hospital.email || '—'}</dd>
                </div>
              </dl>
            </section>

            <section
              className="rounded-3xl bg-white p-6 shadow-md"
              style={{ border: '2px solid #EA8B33', borderTopWidth: '8px' }}
            >
              <h2 className="text-lg font-extrabold text-ink">Assurances</h2>
              {(hospital.insurances || []).length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">Aucune assurance déclarée pour le moment.</p>
              ) : (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {hospital.insurances.map((name) => (
                    <li
                      key={name}
                      className="px-3 py-1.5 rounded-full bg-surface text-sm font-semibold text-ink"
                      style={{ border: '1px solid #32667F' }}
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Modal : RDV par service (prioritaire) ou par médecin */}
      {(selectedService || selectedDoctor) && (
        <div className="fixed inset-0 bg-primary/70 z-50 flex items-center justify-center p-4">
          <div className="bg-surface text-ink rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-accent max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 bg-primary text-surface flex justify-between items-center border-b-2 border-accent">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                <h3 className="font-bold text-lg text-surface">Prise de rendez-vous médical</h3>
              </div>
              <button type="button" onClick={closeBooking} className="text-surface/80 hover:text-surface text-2xl cursor-pointer leading-none">&times;</button>
            </div>

            {bookingStep === 1 ? (
              <form onSubmit={handleConfirmBooking} className="p-6 space-y-4">
                <div className="p-3 bg-primary/5 rounded-xl border-2 border-accent flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-surface flex items-center justify-center font-bold text-sm shrink-0">
                    {selectedService ? <HeartPulse className="w-5 h-5" /> : 'Dr'}
                  </div>
                  <div className="min-w-0">
                    {selectedService ? (
                      <>
                        <h4 className="font-bold text-sm text-ink">{selectedService.name}</h4>
                        <p className="text-xs text-ink-muted font-semibold">
                          {hospital.name}
                        </p>
                      </>
                    ) : (
                      <>
                        <h4 className="font-bold text-sm text-ink">
                          {selectedDoctor.user_details?.first_name || selectedDoctor.full_name || selectedDoctor.name}{' '}
                          {selectedDoctor.user_details?.last_name || ''}
                        </h4>
                        <p className="text-xs text-ink-muted font-semibold">
                          {hospital.name}
                          {(selectedDoctor.office_address || '').trim()
                            ? ` • Bureau: ${selectedDoctor.office_address.trim()}`
                            : ''}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-ink text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent" /> Créneau de consultation
                  </h3>
                  {doctorSlots.length === 0 ? (
                    <div className="p-4 bg-accent/10 border-2 border-accent rounded-xl text-sm text-ink">
                      {selectedService
                        ? 'Aucun créneau publié pour ce service. Contactez l’hôpital ou choisissez un autre service.'
                        : 'Aucune session planifiée pour ce médecin. Contactez l’hôpital pour prendre rendez-vous.'}
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
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
                            className={`p-3 rounded-xl border-2 transition ${
                              isSelected
                                ? 'border-accent bg-accent/10'
                                : 'border-border hover:border-accent'
                            } ${isFull ? 'opacity-50 cursor-not-allowed bg-primary/5' : 'cursor-pointer bg-surface'}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-sm text-ink flex items-center gap-2">
                                {slot.title}
                                {isFull && (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-alert text-surface font-bold uppercase">
                                    Complet
                                  </span>
                                )}
                              </h4>
                              {!isFull && (
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-accent' : 'border-border'}`}>
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-accent" />}
                                </div>
                              )}
                            </div>
                            {(selectedService ? slot.doctor_name : slot.service_name) && (
                              <p className="text-xs text-ink font-medium mb-1">
                                {selectedService
                                  ? `Avec ${slot.doctor_name}${slot.doctor_title ? ` (${slot.doctor_title})` : ''}`
                                  : `Service : ${slot.service_name}`}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-ink-muted mt-2">
                              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-accent" /> {displayDate}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-accent" /> {slot.start_time?.substring(0, 5)} - {slot.end_time?.substring(0, 5)}
                              </span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-border flex flex-wrap justify-between items-center text-[11px] gap-2 text-ink">
                              <span className="font-medium flex items-center gap-1">
                                {slot.consultation_type === 'TELEMEDICINE' ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                {slot.consultation_type === 'TELEMEDICINE' ? 'Téléconsultation' : 'Présentiel'}
                              </span>
                              {(slot.doctor_office_address || selectedDoctor?.office_address) && (
                                <span className="font-medium text-ink-muted">
                                  Bureau: {slot.doctor_office_address || selectedDoctor.office_address}
                                </span>
                              )}
                              <span className={`font-bold ${isFull ? 'text-alert' : 'text-primary'}`}>
                                Places : {slot.remaining_slots} / {slot.max_patients}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Motif de consultation</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="ex: Maux de tête fréquents, suivi annuel, bilan de santé..."
                    value={bookingData.reason}
                    onChange={(e) => setBookingData({ ...bookingData, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border-2 border-accent rounded-xl text-sm text-ink outline-none focus:border-alert"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-ink mb-1">Nom complet du patient</label>
                    <input
                      type="text"
                      required
                      placeholder="Votre nom..."
                      value={bookingData.patient_name}
                      onChange={(e) => setBookingData({ ...bookingData, patient_name: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border-2 border-accent rounded-xl text-sm text-ink outline-none focus:border-alert"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Téléphone</label>
                    <input
                      type="tel"
                      required
                      placeholder="+257 79 00 00 00"
                      value={bookingData.patient_phone}
                      onChange={(e) => setBookingData({ ...bookingData, patient_phone: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border-2 border-accent rounded-xl text-sm text-ink outline-none focus:border-alert"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="patient@email.com"
                      value={bookingData.patient_email}
                      onChange={(e) => setBookingData({ ...bookingData, patient_email: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border-2 border-accent rounded-xl text-sm text-ink outline-none focus:border-alert"
                    />
                  </div>
                </div>

                {(consultationFee > 0 || Number(selectedSlot?.consultation_fee || selectedDoctor?.consultation_fee || 0) > 0) && (
                  <BurundiPayPayerField
                    value={payerBurundiPay}
                    onChange={setPayerBurundiPay}
                  />
                )}

                <div className="flex justify-end gap-3 pt-4 border-t-2 border-alert/20">
                  <button type="button" onClick={closeBooking} className="px-4 py-2 text-ink text-sm font-semibold cursor-pointer">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBooking || doctorSlots.length === 0}
                    className="px-5 py-2.5 bg-primary hover:opacity-95 text-surface font-semibold text-sm rounded-xl border-2 border-accent transition cursor-pointer disabled:opacity-50"
                  >
                    {submittingBooking
                      ? 'Traitement...'
                      : consultationFee > 0
                        ? 'Réserver et payer'
                        : 'Confirmer le rendez-vous'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-8 text-center space-y-4 bg-surface text-ink">
                <div className="w-16 h-16 bg-primary text-surface rounded-full flex items-center justify-center mx-auto border-2 border-accent">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-bold text-ink">Demande enregistrée</h4>

                {confirmedAppointment && (
                  <div className="inline-block px-4 py-2 bg-primary/5 text-ink rounded-2xl border-2 border-accent">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Numéro de suivi</p>
                    <p className="text-3xl font-extrabold text-primary font-mono">
                      {confirmedAppointment.reference_code || `N° ${confirmedAppointment.queue_number || 1}`}
                    </p>
                    {confirmedAppointment.queue_number && (
                      <p className="text-[11px] text-ink-muted mt-0.5 font-medium">
                        Ordre de passage provisoire : #{confirmedAppointment.queue_number}
                      </p>
                    )}
                  </div>
                )}

                {confirmedAppointment && Number(confirmedAppointment.consultation_fee_amount || 0) > 0 && (
                  <div className={`p-4 rounded-xl text-left text-sm border-2 ${
                    ['PAID', 'WAIVED'].includes(confirmedAppointment.payment_status)
                      ? 'bg-accent text-ink border-accent'
                      : 'bg-accent/10 border-alert text-ink'
                  }`}>
                    <p className="font-semibold">
                      Paiement consultation :{' '}
                      {confirmedAppointment.payment_status === 'PAID' && 'Payé'}
                      {confirmedAppointment.payment_status === 'AWAITING_PIN' && 'En attente PIN BurundiPay'}
                      {confirmedAppointment.payment_status === 'UNPAID' && 'Non payé'}
                      {confirmedAppointment.payment_status === 'FAILED' && 'Échoué'}
                      {confirmedAppointment.payment_status === 'WAIVED' && 'Exonéré'}
                    </p>
                    {payMsg && <p className="text-xs mt-2">{payMsg}</p>}
                    {(confirmedAppointment.location_notes || '').trim() && (
                      <p className="text-xs mt-2 font-medium">
                        Bureau / lieu : {confirmedAppointment.location_notes}
                      </p>
                    )}
                    {!['PAID', 'WAIVED'].includes(confirmedAppointment.payment_status) && (
                      <div className="mt-3 space-y-2">
                        <BurundiPayPayerField
                          value={payerBurundiPay}
                          onChange={setPayerBurundiPay}
                          hint="Corrigez le numéro si besoin, puis relancez le paiement."
                        />
                        <div className="flex flex-wrap gap-2">
                          {confirmedAppointment.payment_status === 'AWAITING_PIN' && (
                            <button
                              type="button"
                              disabled={paymentBusy}
                              onClick={confirmStubPayment}
                              className="px-3 py-2 rounded-lg bg-primary text-surface text-xs font-semibold disabled:opacity-50 border border-accent"
                            >
                              Confirmer le PIN (simulation)
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={paymentBusy}
                            onClick={retryPay}
                            className="px-3 py-2 rounded-lg bg-surface border-2 border-alert text-ink text-xs font-semibold disabled:opacity-50"
                          >
                            Payer / Relancer BurundiPay
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {confirmedAppointment?.patient_acknowledgment_message && (
                  <div className="p-4 bg-primary/5 rounded-xl text-xs text-left text-ink whitespace-pre-wrap leading-relaxed border-2 border-accent">
                    {confirmedAppointment.patient_acknowledgment_message}
                  </div>
                )}

                <p className="text-sm text-ink">
                  {confirmedAppointment?.email_notifications?.patient_email_sent
                    ? `Un email de confirmation a été envoyé à ${bookingData.patient_email}.`
                    : selectedService
                      ? `Votre demande pour « ${selectedService.name} » est en attente de validation.`
                      : `Votre demande avec Dr. ${selectedDoctor?.user_details?.first_name || selectedDoctor?.full_name || selectedDoctor?.name || ''} est en attente de validation.`}
                </p>

                <button
                  type="button"
                  onClick={closeBooking}
                  className="w-full py-2.5 bg-primary hover:opacity-95 text-surface font-semibold rounded-xl transition cursor-pointer text-sm border-2 border-accent"
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
