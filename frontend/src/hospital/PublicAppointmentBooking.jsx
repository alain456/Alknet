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
  const [payerBurundiPay, setPayerBurundiPay] = useState('');
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
    if (consultationFee > 0 && !payerBurundiPay.trim()) {
      setError('Indiquez votre numéro BurundiPay pour payer la consultation.');
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
          payerBurundiPay.trim(),
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
        payerBurundiPay.trim(),
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
    <div className="min-h-screen bg-surface text-ink pb-16">
      <div className="bg-primary text-surface relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse at 15% 0%, #1E8B4A 0%, transparent 50%), radial-gradient(ellipse at 95% 90%, #E1302A 0%, transparent 45%)',
          }}
        />
        <div className="max-w-4xl mx-auto px-4 pt-10 pb-16 relative text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface/10 text-accent border border-accent/50 rounded-lg text-xs font-bold uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5" /> Isoko Hub — Prise de rendez-vous
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-surface">Prendre rendez-vous médical</h1>
          <p className="text-sm text-surface/80 max-w-xl mx-auto">
            Parcours guidé — seuls les créneaux publiés par l&apos;établissement sont disponibles.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-8 space-y-6 relative">
        <div className="bg-surface border-2 border-accent rounded-2xl shadow-md p-3 sm:p-4 flex flex-wrap justify-center gap-2">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 text-[10px] sm:text-xs font-bold px-2.5 py-1.5 rounded-lg border-2 ${
                i === step
                  ? 'bg-primary text-surface border-accent'
                  : i < step
                    ? 'bg-accent/15 text-ink border-accent'
                    : 'bg-surface text-ink-muted border-border'
              }`}
            >
              <span className="tabular-nums">{i + 1}</span> {label}
            </div>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-alert/10 border-2 border-alert text-ink rounded-xl text-sm font-medium">{error}</div>
        )}

        {step === 0 && (
          <div className="space-y-4 bg-surface border-2 border-accent rounded-2xl p-5 sm:p-7 shadow-sm">
            <h2 className="text-xl font-extrabold text-ink flex items-center gap-2">
              <Building2 className="text-accent" /> Choisir un établissement
            </h2>
            {loading ? (
              <p className="text-center py-12 text-ink-muted font-medium">Chargement...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hospitals.map((h, idx) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => handleSelectHospital(h)}
                    className={`text-left bg-surface p-5 sm:p-6 rounded-2xl border-2 transition hover:bg-primary/5 ${
                      idx % 2 === 0 ? 'border-accent' : 'border-alert'
                    }`}
                  >
                    <h3 className="font-bold text-lg text-ink">{h.name}</h3>
                    <p className="text-xs text-ink font-medium flex items-center gap-1 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-accent" /> {h.address || h.province || 'Burundi'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 1 && selectedHospital && (
          <div className="space-y-4 bg-surface border-2 border-alert rounded-2xl p-5 sm:p-7 shadow-sm">
            <button type="button" onClick={() => setStep(0)} className="text-xs text-primary font-bold flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Changer d&apos;établissement
            </button>
            <h2 className="text-xl font-extrabold text-ink flex items-center gap-2">
              <HeartPulse className="text-accent" /> Choisir un service
            </h2>
            <p className="text-sm text-ink-muted font-medium">{selectedHospital.name}</p>
            {loading ? (
              <p className="text-center py-12 text-ink-muted font-medium">Chargement...</p>
            ) : services.length === 0 ? (
              <div className="text-center py-12 bg-primary/5 rounded-2xl border-2 border-dashed border-accent">
                <p className="text-ink font-medium">Aucun service configuré pour cet établissement.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {services.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectService(s)}
                    className={`text-left p-5 bg-surface rounded-xl border-2 transition hover:bg-primary/5 ${
                      idx % 2 === 0 ? 'border-accent' : 'border-alert'
                    }`}
                  >
                    <p className="font-bold text-ink">{s.name}</p>
                    <p className="text-xs text-ink-muted mt-1 line-clamp-2 font-medium">{s.description || s.category_display}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && selectedHospital && selectedService && (
          <div className="space-y-4 bg-surface border-2 border-accent rounded-2xl p-5 sm:p-7 shadow-sm">
            <button type="button" onClick={() => setStep(1)} className="text-xs text-primary font-bold flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Changer de service
            </button>
            <h2 className="text-xl font-extrabold text-ink">{selectedService.name} — Créneaux disponibles</h2>
            {loading ? (
              <p className="text-center py-12 text-ink-muted font-medium">Chargement...</p>
            ) : publishedSlots.length === 0 ? (
              <div className="text-center py-16 bg-accent/10 rounded-2xl border-2 border-dashed border-alert">
                <Calendar className="w-12 h-12 text-accent mx-auto mb-3" />
                <h3 className="font-bold text-ink">Aucun créneau publié</h3>
                <p className="text-sm text-ink-muted mt-2 font-medium">Revenez plus tard ou contactez l&apos;hôpital.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {publishedSlots.map((slot, idx) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => { setSelectedSlot(slot); setStep(3); }}
                    className={`w-full text-left p-5 rounded-xl border-2 bg-surface hover:bg-primary/5 transition ${
                      idx % 2 === 0 ? 'border-accent' : 'border-alert'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-bold text-ink">{slot.title}</p>
                        {slot.doctor_name && (
                          <p className="text-xs text-ink font-semibold mt-1">
                            Avec {slot.doctor_name}{slot.doctor_title ? ` (${slot.doctor_title})` : ''}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-ink">{formatSlotDate(slot)}</p>
                        <p className="text-xs text-ink-muted flex items-center justify-end gap-1 mt-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-accent" />
                          {slot.start_time?.slice(0, 5)} — {slot.end_time?.slice(0, 5)}
                        </p>
                        <p className="text-xs text-primary font-bold mt-1">{slot.remaining_slots} place(s)</p>
                        {(slot.doctor_office_address || '').trim() && (
                          <p className="text-xs text-ink-muted font-medium mt-1">
                            Bureau: {slot.doctor_office_address}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && selectedSlot && (
          <form onSubmit={handleBook} className="space-y-5">
            <button type="button" onClick={() => setStep(2)} className="text-xs text-primary font-bold flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Changer de créneau
            </button>
            <div className="bg-primary text-surface p-4 rounded-xl border-2 border-accent text-sm space-y-1">
              <p className="font-bold text-surface">{selectedHospital.name}</p>
              {selectedService && <p className="text-surface/90">Service : {selectedService.name}</p>}
              <p className="text-surface/90">
                {selectedSlot.doctor_name || 'Médecin'} — {formatSlotDate(selectedSlot)} à {selectedSlot.start_time?.slice(0, 5)}
              </p>
              {(selectedSlot.doctor_office_address || '').trim() && (
                <p className="text-surface/90">
                  Bureau : {selectedSlot.doctor_office_address}
                </p>
              )}
            </div>
            <div className="bg-surface p-5 sm:p-7 rounded-2xl border-2 border-accent space-y-4 shadow-sm">
              <div>
                <label className="text-xs font-bold text-ink">Type de consultation</label>
                <select
                  value={bookingDetails.appointment_category}
                  onChange={(e) => setBookingDetails({ ...bookingDetails, appointment_category: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border-2 border-accent rounded-xl text-sm bg-surface text-ink outline-none focus:border-alert"
                >
                  <option value="GENERAL">Consultation générale</option>
                  <option value="SPECIALIZED">Consultation spécialisée</option>
                  <option value="FOLLOW_UP">Contrôle / suivi</option>
                  <option value="EXAM">Examen</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-ink">Motif de consultation *</label>
                <textarea
                  required
                  rows={3}
                  value={bookingDetails.reason}
                  onChange={(e) => setBookingDetails({ ...bookingDetails, reason: e.target.value })}
                  className="w-full mt-1 px-4 py-2 border-2 border-accent rounded-xl text-sm bg-surface text-ink outline-none focus:border-alert"
                  placeholder="Décrivez brièvement..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink">Nom complet *</label>
                  <input
                    required
                    type="text"
                    value={bookingDetails.patient_name}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, patient_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border-2 border-accent rounded-xl text-sm bg-surface text-ink outline-none focus:border-alert"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink">Téléphone *</label>
                  <input
                    required
                    type="tel"
                    value={bookingDetails.patient_phone}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, patient_phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border-2 border-accent rounded-xl text-sm bg-surface text-ink outline-none focus:border-alert"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink">Email *</label>
                  <input
                    required
                    type="email"
                    value={bookingDetails.patient_email}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, patient_email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border-2 border-accent rounded-xl text-sm bg-surface text-ink outline-none focus:border-alert"
                  />
                </div>
              </div>
              {consultationFee > 0 ? (
                <div className="rounded-xl border-2 border-accent overflow-hidden bg-surface">
                  <div className="bg-primary/5 px-4 py-3 flex flex-col items-center justify-center gap-1 border-b-2 border-accent/40">
                    <img src="/burundipay.png" alt="BurundiPay" className="h-16 w-auto object-contain" />
                    <p className="text-[10px] font-semibold text-accent tracking-wide text-center">
                      Riha, Ronka, Rungika amafaranga mu kanya isase
                    </p>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-ink-muted text-center font-medium">
                      Paiement de la consultation via BurundiPay
                    </p>
                    <p className="text-xs text-ink-muted text-center font-medium">
                      Numéro banque ou mobile money (BurundiPay)
                    </p>
                    <input
                      required
                      type="tel"
                      aria-label="Numéro BurundiPay"
                      placeholder="79xxxxxx"
                      value={payerBurundiPay}
                      onChange={(e) => setPayerBurundiPay(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-accent rounded-xl text-sm bg-surface text-ink outline-none focus:border-alert"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-alert/40 bg-accent/10 p-3 text-xs text-ink font-medium">
                  Aucun paiement requis pour ce médecin.
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary text-surface font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 border-2 border-accent"
              >
                {submitting
                  ? 'Traitement...'
                  : consultationFee > 0
                    ? 'Réserver et payer'
                    : 'Envoyer ma demande'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </form>
        )}

        {step === 4 && createdAppointment && (
          <div className="bg-surface rounded-2xl p-6 sm:p-8 text-center space-y-5 border-2 border-accent shadow-md text-ink">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary text-surface flex items-center justify-center border-2 border-accent">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-extrabold text-ink">Demande enregistrée</h2>
            <p className="text-sm text-ink">
              Statut RDV :{' '}
              <strong>{APPOINTMENT_STATUS_LABELS[createdAppointment.status] || 'En attente de confirmation'}</strong>
            </p>
            {createdAppointment.reference_code && (
              <div className="inline-block px-4 py-3 bg-primary/5 rounded-2xl border-2 border-accent space-y-1">
                <p className="text-lg font-black text-primary font-mono tracking-wide">{createdAppointment.reference_code}</p>
                <p className="text-xs text-ink-muted font-medium">Numéro de suivi — à conserver pour la consultation</p>
              </div>
            )}
            <div
              className={`p-4 rounded-xl text-sm text-left border-2 ${
                createdAppointment.payment_status === 'PAID' || createdAppointment.payment_status === 'WAIVED'
                  ? 'bg-primary/5 border-accent text-ink'
                  : 'bg-accent/10 border-alert text-ink'
              }`}
            >
              <p className="font-semibold">
                Paiement consultation :{' '}
                {createdAppointment.payment_status === 'PAID' && 'Payé'}
                {createdAppointment.payment_status === 'AWAITING_PIN' && 'En attente validation PIN BurundiPay'}
                {createdAppointment.payment_status === 'UNPAID' && 'Non payé'}
                {createdAppointment.payment_status === 'FAILED' && 'Échoué'}
                {createdAppointment.payment_status === 'WAIVED' && 'Exonéré'}
                {!createdAppointment.payment_status && '—'}
              </p>
              {(createdAppointment.location_notes || '').trim() && (
                <p className="text-xs mt-1 font-medium">
                  Bureau / lieu : {createdAppointment.location_notes}
                </p>
              )}
              {payMsg && <p className="text-xs mt-2">{payMsg}</p>}
              {(createdAppointment.payment_status === 'AWAITING_PIN'
                || createdAppointment.payment_status === 'UNPAID'
                || createdAppointment.payment_status === 'FAILED') && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {createdAppointment.payment_status === 'AWAITING_PIN' && (
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
                    Relancer le paiement
                  </button>
                </div>
              )}
            </div>
            {createdAppointment.queue_number && (
              <p className="text-xs font-mono bg-primary/10 text-ink inline-block px-4 py-2 rounded-lg border border-accent font-bold">
                Ordre de passage provisoire : #{createdAppointment.queue_number}
              </p>
            )}
            <div className="p-4 bg-primary/5 rounded-xl text-xs text-left space-y-1 border-2 border-alert/30 text-ink font-medium">
              <p><User className="w-3.5 h-3.5 inline mr-1 text-accent" />{bookingDetails.patient_name}</p>
              <p>{selectedHospital?.name} — {selectedService?.name || 'Consultation'}</p>
              <p>{selectedSlot?.doctor_name || 'Médecin'} — {formatSlotDate(selectedSlot)}</p>
            </div>
            {createdAppointment.patient_acknowledgment_message && (
              <div className="p-4 bg-primary/5 rounded-xl text-xs text-left space-y-2 border-2 border-accent">
                <p className="font-bold text-ink flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-accent" /> Message de confirmation
                </p>
                <p className="whitespace-pre-wrap text-ink leading-relaxed">
                  {createdAppointment.patient_acknowledgment_message}
                </p>
              </div>
            )}
            <div className="p-4 bg-accent/10 rounded-xl text-xs text-left flex gap-3 border-2 border-alert/40 text-ink">
              <BellRing className="w-5 h-5 text-accent shrink-0" />
              <span className="font-medium">
                {createdAppointment.email_notifications?.patient_email_sent
                  ? `Un email de confirmation a été envoyé à ${bookingDetails.patient_email}.`
                  : createdAppointment.email_notifications?.patient_email_error
                    ? `Demande enregistrée, mais l'email n'a pas pu être envoyé : ${createdAppointment.email_notifications.patient_email_error}`
                    : `Notification envoyée à ${bookingDetails.patient_email}. L'administration confirmera le RDV après paiement.`}
              </span>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                type="button"
                onClick={() => navigate('/hospitals')}
                className="px-5 py-2.5 bg-surface text-ink rounded-xl text-sm font-semibold border-2 border-accent"
              >
                Retour
              </button>
              {token && (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/bookings')}
                  className="px-5 py-2.5 bg-primary text-surface rounded-xl text-sm font-semibold border-2 border-alert"
                >
                  Mes rendez-vous
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
