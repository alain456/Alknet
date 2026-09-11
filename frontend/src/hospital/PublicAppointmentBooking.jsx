import React, { useState, useEffect } from 'react';
import {
  Building2, Calendar, Clock, CheckCircle2,
  ChevronRight, ChevronLeft, MapPin, BellRing, Sparkles, HeartPulse, User
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';
import hospitalService, { APPOINTMENT_STATUS_LABELS } from './hospitalService';

const STEPS = ['Hôpital', 'Service', 'Créneau', 'Motif & paiement', 'Confirmation'];

/**
 * Parcours patient :
 * Hôpital → Service → Créneau publié (avec médecin) → Motif → Confirmation
 */
export default function PublicAppointmentBooking() {
  const [searchParams] = useSearchParams();
  const initialHospitalId = searchParams.get('hospital');
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [hospitals, setHospitals] = useState([]);
  const [services, setServices] = useState([]);
  const [publishedSlots, setPublishedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingDetails, setBookingDetails] = useState({
    reason: '',
    appointment_category: 'GENERAL',
    patient_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
    patient_phone: user?.phone_number || '',
    patient_email: user?.email || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [createdAppointment, setCreatedAppointment] = useState(null);
  const [payerLumicash, setPayerLumicash] = useState('');
  const [payMsg, setPayMsg] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);

  useEffect(() => { loadHospitals(); }, []);

  useEffect(() => {
    if (user) {
      setBookingDetails((prev) => ({
        ...prev,
        patient_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || prev.patient_name,
        patient_phone: user.phone_number || prev.patient_phone,
        patient_email: user.email || prev.patient_email,
      }));
    }
  }, [user]);

  const loadHospitals = async () => {
    try {
      const businesses = await api.get('businesses/');
      const healthTerms = ['santé', 'sante', 'health', 'hôpital', 'hopital', 'clinique', 'clinic', 'médical', 'medical'];
      const healthHospitals = businesses.filter((b) => {
        const cat = (b.primary_category_name || b.category_name || '').toLowerCase();
        const name = (b.name || '').toLowerCase();
        return healthTerms.some((t) => cat.includes(t) || name.includes(t));
      });
      const list = healthHospitals.length > 0 ? healthHospitals : businesses;
      setHospitals(list);
      if (initialHospitalId) {
        const found = list.find((h) => h.id === initialHospitalId);
        if (found) {
          setSelectedHospital(found);
          await loadServices(found.id);
          setStep(1);
        }
      }
    } catch {
      setError('Impossible de charger les établissements.');
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async (hospitalId) => {
    setLoading(true);
    try {
      const data = await hospitalService.getPublicServices(hospitalId);
      setServices(Array.isArray(data) ? data.filter((s) => s.is_active !== false) : []);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPublishedSlots = async (hospitalId, serviceId) => {
    setLoading(true);
    try {
      const slots = await hospitalService.getPublishedSlots(hospitalId, undefined, serviceId);
      setPublishedSlots(Array.isArray(slots) ? slots.filter((s) => (s.remaining_slots ?? 1) > 0) : []);
    } catch {
      setPublishedSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHospital = async (hosp) => {
    setSelectedHospital(hosp);
    setSelectedService(null);
    setSelectedSlot(null);
    await loadServices(hosp.id);
    setStep(1);
  };

  const handleSelectService = async (svc) => {
    setSelectedService(svc);
    setSelectedSlot(null);
    await loadPublishedSlots(selectedHospital.id, svc.id);
    setStep(2);
  };

  const consultationFee = Number(
    selectedSlot?.consultation_fee
    ?? selectedSlot?.doctor_details?.consultation_fee
    ?? 0
  );
  const feeLabel = selectedSlot?.formatted_consultation_fee
    || (consultationFee > 0
      ? `${consultationFee.toLocaleString('fr-BI')} ${selectedSlot?.consultation_fee_currency || 'BIF'}`
      : 'Gratuit');

  const handleBook = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Veuillez sélectionner un créneau publié.');
      return;
    }
    if (consultationFee > 0 && !payerLumicash.trim()) {
      setError('Indiquez votre numéro Lumicash pour payer la consultation.');
      return;
    }
    setSubmitting(true);
    setError('');
    setPayMsg('');
    try {
      const created = await hospitalService.createAppointment({
        slot: selectedSlot.id,
        hospital: selectedHospital.id,
        doctor: selectedSlot.doctor,
        service: selectedService?.id,
        reason: bookingDetails.reason,
        appointment_category: bookingDetails.appointment_category,
        patient_name: bookingDetails.patient_name,
        patient_phone: bookingDetails.patient_phone,
        patient_email: bookingDetails.patient_email,
      }, !!token);

      let finalAppt = created;
      const amount = Number(created?.consultation_fee_amount ?? consultationFee);
      if (amount > 0 && created?.payment_status !== 'PAID') {
        const payRes = await hospitalService.payAppointment(
          created.id,
          payerLumicash.trim(),
          !!token,
        );
        finalAppt = payRes.appointment || created;
        setPayMsg(payRes.message || '');
        if (!payRes.ok && !payRes.already_paid) {
          setCreatedAppointment(finalAppt);
          setStep(4);
          setError(payRes.message || 'Paiement non initié. Vous pourrez réessayer.');
          return;
        }
      }
      setCreatedAppointment(finalAppt);
      setStep(4);
    } catch (err) {
      setError(err.message || 'Erreur lors de la réservation.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmStubPayment = async () => {
    if (!createdAppointment?.id) return;
    setPaymentBusy(true);
    setError('');
    try {
      const res = await hospitalService.confirmAppointmentPayment(createdAppointment.id, !!token);
      if (!res.ok) throw new Error(res.message || 'Confirmation échouée');
      setCreatedAppointment(res.appointment || createdAppointment);
      setPayMsg(res.message || 'Paiement confirmé.');
    } catch (err) {
      setError(err.message || 'Erreur confirmation paiement');
    } finally {
      setPaymentBusy(false);
    }
  };

  const retryPay = async () => {
    if (!createdAppointment?.id) return;
    setPaymentBusy(true);
    setError('');
    try {
      const res = await hospitalService.payAppointment(
        createdAppointment.id,
        payerLumicash.trim(),
        !!token,
      );
      setCreatedAppointment(res.appointment || createdAppointment);
      setPayMsg(res.message || '');
      if (!res.ok && !res.already_paid) setError(res.message || 'Échec paiement');
    } catch (err) {
      setError(err.message || 'Erreur paiement');
    } finally {
      setPaymentBusy(false);
    }
  };

  const formatSlotDate = (slot) => {
    const d = new Date(slot.slot_date);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-bold uppercase">
            <Sparkles className="w-3.5 h-3.5" /> Isoko Hub — Prise de rendez-vous
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Prendre rendez-vous</h1>
          <p className="text-sm text-gray-500">Parcours guidé — créneaux publiés par l'administration uniquement</p>
        </div>

        {/* Stepper */}
        <div className="flex flex-wrap justify-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
              i === step ? 'bg-teal-600 text-white' : i < step ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-400'
            }`}>
              <span>{i + 1}</span> {label}
            </div>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
        )}

        {/* Étape 0 : Hôpital */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Building2 className="text-teal-600" /> Choisir un établissement</h2>
            {loading ? <p className="text-center py-12 text-gray-500">Chargement...</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hospitals.map((h) => (
                  <button key={h.id} type="button" onClick={() => handleSelectHospital(h)}
                    className="text-left bg-white p-6 rounded-2xl border hover:border-teal-500 transition">
                    <h3 className="font-bold text-lg">{h.name}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5" /> {h.address || h.province || 'Burundi'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Étape 1 : Service */}
        {step === 1 && selectedHospital && (
          <div className="space-y-4">
            <button type="button" onClick={() => setStep(0)} className="text-xs text-teal-600 flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Changer d'établissement
            </button>
            <h2 className="text-xl font-bold flex items-center gap-2"><HeartPulse className="text-teal-600" /> Choisir un service</h2>
            {loading ? <p className="text-center py-12 text-gray-500">Chargement...</p> : services.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
                <p className="text-gray-600">Aucun service configuré pour cet établissement.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {services.map((s) => (
                  <button key={s.id} type="button" onClick={() => handleSelectService(s)}
                    className="text-left p-5 bg-white rounded-xl border hover:border-teal-500 transition">
                    <p className="font-bold">{s.name}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description || s.category_display}</p>
                    {s.formatted_cost && <p className="text-xs text-teal-700 font-semibold mt-2">{s.formatted_cost}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Étape 2 : Créneaux du service */}
        {step === 2 && selectedHospital && selectedService && (
          <div className="space-y-4">
            <button type="button" onClick={() => setStep(1)} className="text-xs text-teal-600 flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Changer de service
            </button>
            <h2 className="text-xl font-bold">{selectedService.name} — Créneaux disponibles</h2>
            {loading ? <p className="text-center py-12 text-gray-500">Chargement...</p> : publishedSlots.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-gray-700">Aucun créneau publié</h3>
                <p className="text-sm text-gray-500 mt-2">Revenez plus tard ou contactez l'hôpital.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {publishedSlots.map((slot) => (
                  <button key={slot.id} type="button"
                    onClick={() => { setSelectedSlot(slot); setStep(3); }}
                    className="w-full text-left p-5 rounded-xl border bg-white hover:border-teal-400 transition">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-bold">{slot.title}</p>
                        {slot.doctor_name && (
                          <p className="text-xs text-teal-700 font-medium mt-1">
                            Avec {slot.doctor_name}{slot.doctor_title ? ` (${slot.doctor_title})` : ''}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{formatSlotDate(slot)}</p>
                        <p className="text-xs text-gray-500 flex items-center justify-end gap-1 mt-1">
                          <Clock className="w-3.5 h-3.5" />
                          {slot.start_time?.slice(0, 5)} — {slot.end_time?.slice(0, 5)}
                        </p>
                        <p className="text-xs text-emerald-600 font-semibold mt-1">{slot.remaining_slots} place(s)</p>
                        <p className="text-xs text-teal-800 font-bold mt-1">
                          {slot.formatted_consultation_fee
                            || (Number(slot.consultation_fee) > 0
                              ? `${Number(slot.consultation_fee).toLocaleString('fr-BI')} BIF`
                              : 'Gratuit')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Étape 3 : Motif & coordonnées */}
        {step === 3 && selectedSlot && (
          <form onSubmit={handleBook} className="space-y-6">
            <button type="button" onClick={() => setStep(2)} className="text-xs text-teal-600 flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Changer de créneau
            </button>
            <div className="bg-teal-50 p-4 rounded-xl border border-teal-200 text-sm space-y-1">
              <p><strong>{selectedHospital.name}</strong></p>
              {selectedService && <p>Service : {selectedService.name}</p>}
              <p>
                {selectedSlot.doctor_name || 'Médecin'} — {formatSlotDate(selectedSlot)} à {selectedSlot.start_time?.slice(0, 5)}
              </p>
              <p className="font-bold text-teal-900 pt-1">
                Tarif consultation (médecin) : {feeLabel}
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border space-y-4">
              <div>
                <label className="text-xs font-medium">Type de consultation</label>
                <select value={bookingDetails.appointment_category}
                  onChange={(e) => setBookingDetails({ ...bookingDetails, appointment_category: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm">
                  <option value="GENERAL">Consultation générale</option>
                  <option value="SPECIALIZED">Consultation spécialisée</option>
                  <option value="FOLLOW_UP">Contrôle / suivi</option>
                  <option value="EXAM">Examen</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Motif de consultation *</label>
                <textarea required rows={3} value={bookingDetails.reason}
                  onChange={(e) => setBookingDetails({ ...bookingDetails, reason: e.target.value })}
                  className="w-full mt-1 px-4 py-2 border rounded-xl text-sm" placeholder="Décrivez brièvement..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium">Nom complet *</label>
                  <input required type="text" value={bookingDetails.patient_name}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, patient_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium">Téléphone *</label>
                  <input required type="tel" value={bookingDetails.patient_phone}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, patient_phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium">Email *</label>
                  <input required type="email" value={bookingDetails.patient_email}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, patient_email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" />
                </div>
              </div>
              {consultationFee > 0 ? (
                <div className="rounded-xl border border-[#1a237e]/20 overflow-hidden bg-white">
                  <div className="bg-[#FFD600] px-4 py-3 flex items-center justify-center">
                    <img
                      src="/lumicash.png"
                      alt="Lumicash"
                      className="h-14 w-auto object-contain"
                    />
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-center text-lg font-bold text-gray-900">
                      {feeLabel}
                    </p>
                    <input
                      required
                      type="tel"
                      aria-label="Numéro Lumicash"
                      placeholder="79xxxxxx"
                      value={payerLumicash}
                      onChange={(e) => setPayerLumicash(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-[#1a237e]"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                  Consultation sans frais pour ce médecin (tarif = 0 BIF).
                </div>
              )}
              <button type="submit" disabled={submitting}
                className="w-full py-3 bg-teal-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting
                  ? 'Traitement...'
                  : consultationFee > 0
                    ? `Réserver et payer ${feeLabel}`
                    : 'Envoyer ma demande'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </form>
        )}

        {/* Étape 4 : Confirmation */}
        {step === 4 && createdAppointment && (
          <div className="bg-white rounded-3xl p-8 text-center space-y-6 border shadow-lg">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold">Demande enregistrée</h2>
            <p className="text-sm text-gray-600">
              Statut RDV : <strong>{APPOINTMENT_STATUS_LABELS[createdAppointment.status] || 'En attente de confirmation'}</strong>
            </p>
            {createdAppointment.reference_code && (
              <div className="space-y-1">
                <p className="text-lg font-black text-teal-700 font-mono tracking-wide">{createdAppointment.reference_code}</p>
                <p className="text-xs text-gray-500">Numéro de suivi — à conserver pour la consultation</p>
              </div>
            )}
            <div className={`p-4 rounded-xl text-sm text-left border ${
              createdAppointment.payment_status === 'PAID' || createdAppointment.payment_status === 'WAIVED'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <p className="font-semibold">
                Paiement consultation :{' '}
                {createdAppointment.payment_status === 'PAID' && 'Payé'}
                {createdAppointment.payment_status === 'AWAITING_PIN' && 'En attente validation PIN Lumicash'}
                {createdAppointment.payment_status === 'UNPAID' && 'Non payé'}
                {createdAppointment.payment_status === 'FAILED' && 'Échoué'}
                {createdAppointment.payment_status === 'WAIVED' && 'Exonéré'}
                {!createdAppointment.payment_status && '—'}
              </p>
              <p className="text-xs mt-1">
                Montant : {Number(createdAppointment.consultation_fee_amount || 0).toLocaleString('fr-BI')}{' '}
                {createdAppointment.consultation_fee_currency || 'BIF'}
                {createdAppointment.payment_merchant_account
                  ? ` → marchand ${createdAppointment.payment_merchant_account}`
                  : ''}
              </p>
              {payMsg && <p className="text-xs mt-2">{payMsg}</p>}
              {(createdAppointment.payment_status === 'AWAITING_PIN' || createdAppointment.payment_status === 'UNPAID' || createdAppointment.payment_status === 'FAILED') && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {createdAppointment.payment_status === 'AWAITING_PIN' && (
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
                    Relancer le paiement
                  </button>
                </div>
              )}
            </div>
            {createdAppointment.queue_number && (
              <p className="text-xs font-mono bg-teal-50 text-teal-700 inline-block px-4 py-2 rounded-full">
                Ordre de passage provisoire : #{createdAppointment.queue_number}
              </p>
            )}
            <div className="p-4 bg-gray-50 rounded-xl text-xs text-left space-y-1">
              <p><User className="w-3.5 h-3.5 inline mr-1" />{bookingDetails.patient_name}</p>
              <p>{selectedHospital?.name} — {selectedService?.name || 'Consultation'}</p>
              <p>{selectedSlot?.doctor_name || 'Médecin'} — {formatSlotDate(selectedSlot)}</p>
            </div>
            {createdAppointment.patient_acknowledgment_message && (
              <div className="p-4 bg-emerald-50 rounded-xl text-xs text-left space-y-2 border border-emerald-100">
                <p className="font-bold text-emerald-800 flex items-center gap-2">
                  <BellRing className="w-4 h-4" /> Message de confirmation
                </p>
                <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {createdAppointment.patient_acknowledgment_message}
                </p>
              </div>
            )}
            <div className="p-4 bg-emerald-50 rounded-xl text-xs text-left flex gap-3">
              <BellRing className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                {createdAppointment.email_notifications?.patient_email_sent
                  ? `Un email de confirmation a été envoyé à ${bookingDetails.patient_email}.`
                  : createdAppointment.email_notifications?.patient_email_error
                    ? `Demande enregistrée, mais l'email n'a pas pu être envoyé : ${createdAppointment.email_notifications.patient_email_error}`
                    : `Notification envoyée à ${bookingDetails.patient_email}. L'administration confirmera le RDV après paiement.`}
              </span>
            </div>
            <div className="flex gap-3 justify-center">
              <button type="button" onClick={() => navigate('/hospitals')} className="px-5 py-2 bg-gray-100 rounded-xl text-sm">Retour</button>
              {token && (
                <button type="button" onClick={() => navigate('/dashboard/bookings')} className="px-5 py-2 bg-teal-600 text-white rounded-xl text-sm">Mes rendez-vous</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
