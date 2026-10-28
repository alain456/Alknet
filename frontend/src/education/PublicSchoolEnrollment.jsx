import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, ChevronLeft, ChevronRight, FileText, GraduationCap, Sparkles, User,
} from 'lucide-react';
import { api } from '../shared/api';
import { useAuth } from '../context/AuthContext';
import EnrollmentPaymentChoice from './EnrollmentPaymentChoice';
import BurundiPayPayerField from '../shared/components/BurundiPayPayerField';
import { downloadApplicationPdf } from './dossierPdf';
import { isValidBurundiPayPhone, normalizeBurundiPayPhone } from '../shared/components/burundiPayPhone';

const TRACK_META = {
  PRESCOLAIRE: 'Maternelle / Préscolaire',
  ECOFO: 'École fondamentale (ECOFO)',
  POST_FONDAMENTAL: 'Post-fondamental',
};

const STEPS = ['Parcours', 'Identité', 'Pièces & paiement', 'Confirmation'];
const fieldClass = 'w-full mt-1.5 px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-ink outline-none focus:border-accent';

import PublicUniversityEnrollment from './PublicUniversityEnrollment';

/**
 * Formulaire public d'inscription — même design que la prise de rendez-vous.
 */
export default function PublicSchoolEnrollment() {
  const [params] = useSearchParams();
  const campaignId = params.get('campaign') || '';
  const { user, token } = useAuth();

  const [step, setStep] = useState(0);
  const [campaign, setCampaign] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [payMsg, setPayMsg] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);

  const [track, setTrack] = useState('');
  const [ecofoYear, setEcofoYear] = useState('');
  const [postSection, setPostSection] = useState('');
  const [postYear, setPostYear] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [previousSchool, setPreviousSchool] = useState('');
  const [studentAddress, setStudentAddress] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianLink, setGuardianLink] = useState('Mère');
  const [files, setFiles] = useState({});
  const [payerPhone, setPayerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [bordereau, setBordereau] = useState(null);
  const [criteriaAck, setCriteriaAck] = useState(false);
  const [existingLink, setExistingLink] = useState('');

  useEffect(() => {
    if (!campaignId) {
      setError('Lien d’inscription incomplet (campagne manquante).');
      return;
    }
    api.get(`education/campaigns/${campaignId}/`)
      .then(setCampaign)
      .catch((err) => setError(err.message || 'Campagne introuvable.'));
  }, [campaignId]);

  useEffect(() => {
    if (!user) return;
    setStudentName((prev) => prev || `${user.first_name || ''} ${user.last_name || ''}`.trim());
    setStudentEmail((prev) => prev || user.email || '');
    setStudentPhone((prev) => prev || user.phone_number || '');
  }, [user]);

  const openTracks = campaign?.open_tracks || [];
  const options = campaign?.enrollment_options || { ecofo_years: [], post_sections: [] };
  const fee = campaign?.enrollment_fee;
  const feeAmount = Number(fee?.amount_bif || 0);
  const feeLabel = feeAmount > 0
    ? `${fee.label} — ${feeAmount.toLocaleString('fr-BI')} BIF`
    : 'Gratuit';
  const extraCriteria = campaign?.extra_criteria || [];
  const selectedSlot = (campaign?.seat_summary || []).find((slot) => {
    if (slot.track !== track) return false;
    if (track === 'ECOFO') return slot.year === ecofoYear;
    if (track === 'POST_FONDAMENTAL') return slot.section === postSection && slot.year === postYear;
    return true;
  });
  const classFull = selectedSlot ? Number(selectedSlot.remaining) <= 0 : false;

  const sectionYears = useMemo(() => {
    const row = (options.post_sections || []).find((item) => item.name === postSection);
    return row?.years || [];
  }, [options.post_sections, postSection]);

  const requiredDocs = useMemo(() => {
    if (!campaign?.documents_by_track || !track) return [];
    const block = campaign.documents_by_track[track];
    if (!block) return [];
    if (track === 'ECOFO') {
      const year = (block.years || []).find((item) => item.value === ecofoYear);
      return year?.documents || [];
    }
    if (track === 'POST_FONDAMENTAL') {
      const section = (block.sections || []).find((item) => item.name === postSection);
      const year = (section?.years || []).find((item) => item.value === postYear);
      if (year?.documents) return year.documents;
    }
    return block.documents || [];
  }, [campaign, track, ecofoYear, postSection, postYear]);

  const buildBody = () => {
    const body = new FormData();
    body.append('campaign', campaignId);
    body.append('student_name', studentName.trim());
    body.append('student_email', studentEmail.trim());
    body.append('student_phone', studentPhone.trim());
    body.append('birth_date', birthDate);
    body.append('gender', gender);
    body.append('previous_school', previousSchool.trim());
    body.append('student_address', studentAddress.trim());
    body.append('guardian_name', guardianName.trim());
    body.append('guardian_phone', guardianPhone.trim());
    body.append('guardian_link', guardianLink.trim());
    body.append('track', track);
    if (track === 'ECOFO') body.append('ecofo_year', ecofoYear);
    if (track === 'POST_FONDAMENTAL') {
      body.append('post_section', postSection);
      body.append('post_year', postYear);
    }
    if (feeAmount > 0) {
      body.append('payment_method', paymentMethod);
      if (paymentMethod === 'BURUNDIPAY') body.append('payer_phone', normalizeBurundiPayPhone(payerPhone));
      if (paymentMethod === 'BORDEREAU' && bordereau) body.append('bordereau', bordereau);
    }
    if (extraCriteria.length > 0) body.append('criteria_ack', '1');
    requiredDocs.forEach((doc, index) => {
      body.append(`doc_label_${index}`, doc.label);
      body.append(`doc_file_${index}`, files[doc.label]);
    });
    return body;
  };

  const downloadDossier = async () => {
    setError('');
    setPdfBusy(true);
    try {
      await downloadApplicationPdf('education/applications/preview-dossier/', {
        method: 'POST',
        body: buildBody(),
      });
    } catch (err) {
      setError(err.message || 'PDF indisponible.');
    } finally {
      setPdfBusy(false);
    }
  };

  const canGoIdentity = () => {
    if (!track) return false;
    if (track === 'ECOFO' && !ecofoYear) return false;
    if (track === 'POST_FONDAMENTAL' && (!postSection || !postYear)) return false;
    return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!campaign?.open_today) {
      setError('Les inscriptions sont fermées pour cette année.');
      return;
    }
    for (const doc of requiredDocs) {
      const file = files[doc.label];
      if (!file) {
        setError(`Joignez la pièce : ${doc.label}`);
        return;
      }
      if (String(doc.label || '').toLowerCase() === 'photo passeport' && !/\.(jpe?g|png|webp)$/i.test(file.name || '')) {
        setError('La photo passeport doit être une image JPEG, PNG ou WebP.');
        return;
      }
    }
    if (feeAmount > 0 && paymentMethod !== 'BURUNDIPAY' && paymentMethod !== 'BORDEREAU') {
      setError('Choisissez BurundiPay ou un bordereau PDF.');
      return;
    }
    if (feeAmount > 0 && paymentMethod === 'BURUNDIPAY' && !isValidBurundiPayPhone(payerPhone)) {
      setError('Numéro BurundiPay invalide : 8 chiffres requis (ex. 79xxxxxx).');
      return;
    }
    if (feeAmount > 0 && paymentMethod === 'BORDEREAU' && !bordereau?.name?.toLowerCase().endsWith('.pdf')) {
      setError('Le bordereau doit être un PDF.');
      return;
    }
    if (extraCriteria.length > 0 && !criteriaAck) {
      setError('Confirmez que vous avez pris connaissance des critères supplémentaires.');
      return;
    }

    setSubmitting(true);
    setPayMsg('');
    try {
      const result = await api.post('education/applications/apply/', buildBody(), { auth: !!token });
      setDone({
        application: result.application,
        payment: result.payment,
        fee: result.fee,
        message: result.message,
        payment_status: result.payment?.status || (feeAmount > 0 ? 'UNPAID' : 'WAIVED'),
        payment_token: result.payment?.payment_token || '',
        payer_phone: result.payment?.payer_phone || payerPhone,
      });
      setPayMsg(result.message || '');
      setStep(3);
    } catch (err) {
      const raw = err.data?.suivi_url;
      const link = Array.isArray(raw) ? raw[0] : raw;
      if (link) {
        setExistingLink(String(link));
        setError('Un dossier existe déjà pour cet e-mail sur cette année.');
      } else {
        setExistingLink('');
        setError(err.message || 'Envoi impossible.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmStubPayment = async () => {
    if (!done?.application?.id) return;
    setPaymentBusy(true);
    setError('');
    try {
      const res = await api.post(
        `education/applications/${done.application.id}/confirm-payment/`,
        { payment_token: done.payment_token },
      );
      setDone((prev) => ({
        ...prev,
        payment: res.payment,
        payment_status: res.payment?.status,
        payment_token: res.payment?.payment_token || prev.payment_token,
      }));
      setPayMsg(res.message || 'Paiement confirmé.');
    } catch (err) {
      setError(err.message || 'Erreur confirmation paiement');
    } finally {
      setPaymentBusy(false);
    }
  };

  const retryPay = async () => {
    if (!done?.application?.id) return;
    if (!isValidBurundiPayPhone(payerPhone)) {
      setError('Numéro BurundiPay invalide.');
      return;
    }
    setPaymentBusy(true);
    setError('');
    try {
      const res = await api.post(
        `education/applications/${done.application.id}/pay/`,
        { payer_phone: normalizeBurundiPayPhone(payerPhone), payment_token: done.payment_token },
      );
      setDone((prev) => ({
        ...prev,
        payment: res.payment,
        payment_status: res.payment?.status,
        payer_phone: res.payment?.payer_phone || payerPhone,
        payment_token: res.payment?.payment_token || prev.payment_token,
      }));
      setPayMsg(res.message || '');
      if (!res.ok) setError(res.message || 'Échec paiement');
    } catch (err) {
      setError(err.message || 'Erreur paiement');
    } finally {
      setPaymentBusy(false);
    }
  };

  const backTo = campaign?.establishment_id
    ? `/education/establishment/${campaign.establishment_id}#inscription`
    : '/education';

  if (campaign?.program) {
    return <PublicUniversityEnrollment campaign={campaign} campaignId={campaignId} />;
  }

  return (
    <div className="min-h-screen bg-surface text-ink pb-16">
      <div className="bg-primary text-surface relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse at 15% 0%, #EA8B33 0%, transparent 50%), radial-gradient(ellipse at 95% 90%, #E1302A 0%, transparent 45%)',
          }}
        />
        <div className="max-w-4xl mx-auto px-4 pt-6 pb-16 relative text-center space-y-3">
          <div className="text-left">
            <Link
              to={backTo}
              className="inline-flex items-center gap-1 text-sm font-bold text-surface"
            >
              <ChevronLeft className="w-4 h-4" /> Retour
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface/10 text-accent border border-accent/50 rounded-lg text-xs font-bold uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5" /> Isoko Hub — Inscription scolaire
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-surface">S&apos;inscrire à une école</h1>
          <p className="text-sm text-surface/80 max-w-xl mx-auto">
            Pièces selon le niveau. Une inscription payante se règle par BurundiPay ou par un bordereau PDF. Une inscription gratuite part sans paiement.
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
                  ? 'bg-accent text-ink border-accent'
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
          <div className="p-4 bg-alert/10 border-2 border-alert text-ink rounded-xl text-sm font-medium space-y-2">
            <p>{error}</p>
            {existingLink && (
              <a href={existingLink} className="inline-flex font-bold text-primary underline">
                Ouvrir le dossier déjà envoyé
              </a>
            )}
          </div>
        )}

        {!campaign && !error && (
          <p className="text-center py-12 text-ink-muted font-medium">Chargement…</p>
        )}

        {campaign && step === 0 && (
          <div className="space-y-4 bg-surface border-2 border-accent rounded-2xl p-5 sm:p-7 shadow-sm">
            <h2 className="text-xl font-extrabold text-ink flex items-center gap-2">
              <GraduationCap className="text-accent" /> Choisir le parcours
            </h2>
            <p className="text-sm text-ink-muted font-medium">
              Année scolaire {campaign.academic_year} · {campaign.opens_on} → {campaign.closes_on}
            </p>
            <p className="text-sm font-bold text-ink">
              {feeAmount > 0
                ? `${feeLabel}. Le règlement, BurundiPay ou bordereau, se fait à la dernière étape.`
                : 'Inscription gratuite — le dossier part sans paiement.'}
            </p>
            {!campaign.open_today && (
              <p className="text-sm text-alert font-medium">Les inscriptions ne sont pas ouvertes aujourd&apos;hui.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openTracks.map((code, idx) => (
                <button
                  key={code}
                  type="button"
                  disabled={!campaign.open_today}
                  onClick={() => {
                    setTrack(code);
                    setEcofoYear('');
                    setPostSection('');
                    setPostYear('');
                    setFiles({});
                  }}
                  className={`text-left bg-surface p-5 rounded-2xl border-2 transition hover:bg-primary/5 disabled:opacity-50 ${
                    track === code ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <h3 className="font-bold text-lg text-ink">{TRACK_META[code] || code}</h3>
                </button>
              ))}
            </div>

            {track === 'ECOFO' && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-ink">Classe ECOFO</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(options.ecofo_years || []).map((year) => (
                    <button
                      key={year.value}
                      type="button"
                      onClick={() => { setEcofoYear(year.value); setFiles({}); }}
                      className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold ${
                        ecofoYear === year.value ? 'bg-accent text-ink border-accent' : 'border-accent text-ink'
                      }`}
                    >
                      {year.label}
                      {year.seats != null && (
                        <span className="block text-[10px] font-medium opacity-80">{year.seats} places</span>
                      )}
                    </button>
                  ))}
                </div>
                {(options.ecofo_years || []).length === 0 && (
                  <p className="text-xs text-alert">Aucune année ECOFO n&apos;est ouverte pour cette inscription.</p>
                )}
              </div>
            )}

            {track === 'POST_FONDAMENTAL' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-ink">
                  Section
                  <select
                    className={fieldClass}
                    value={postSection}
                    onChange={(e) => { setPostSection(e.target.value); setPostYear(''); setFiles({}); }}
                  >
                    <option value="">Sélectionner</option>
                    {(options.post_sections || []).map((section) => (
                      <option key={section.name} value={section.name}>{section.name}</option>
                    ))}
                  </select>
                </label>
                {postSection && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-ink">Classe dans la section</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sectionYears.map((year) => (
                        <button
                          key={year.value}
                          type="button"
                          onClick={() => setPostYear(year.value)}
                          className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold ${
                            postYear === year.value ? 'bg-accent text-ink border-accent' : 'border-accent text-ink'
                          }`}
                        >
                          {year.label}
                          {year.seats != null && (
                            <span className="block text-[10px] font-medium opacity-80">{year.seats} places</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Link
                to={backTo}
                className="flex-1 py-3 rounded-xl border-2 border-accent text-ink font-bold flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" /> Retour
              </Link>
              <button
                type="button"
                disabled={!canGoIdentity() || !campaign.open_today}
                onClick={() => setStep(1)}
                className="flex-1 py-3 bg-primary text-surface font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 border-2 border-accent"
              >
                Continuer <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {campaign && step === 1 && (
          <div className="space-y-4 bg-surface border-2 border-border rounded-2xl p-5 sm:p-7 shadow-sm">
            <h2 className="text-xl font-extrabold text-ink flex items-center gap-2">
              <User className="text-accent" /> Identité de l&apos;élève
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block text-sm font-bold text-ink">
                Nom complet *
                <input required className={fieldClass} value={studentName} onChange={(e) => setStudentName(e.target.value)} />
              </label>
              <label className="block text-sm font-bold text-ink">
                Téléphone *
                <input required type="tel" className={fieldClass} value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} />
              </label>
              <label className="block text-sm font-bold text-ink">
                E-mail *
                <input required type="email" className={fieldClass} value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} />
              </label>
              <label className="block text-sm font-bold text-ink">
                Date de naissance *
                <input required type="date" className={fieldClass} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </label>
              <label className="block text-sm font-bold text-ink">
                Sexe *
                <select required className={fieldClass} value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Choisir</option>
                  <option value="F">Féminin</option>
                  <option value="M">Masculin</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-ink">
                École précédente
                <input className={fieldClass} value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} />
              </label>
              <label className="block text-sm font-bold text-ink sm:col-span-2">
                Adresse
                <input className={fieldClass} value={studentAddress} onChange={(e) => setStudentAddress(e.target.value)} />
              </label>
              <label className="block text-sm font-bold text-ink">
                Lien du parent *
                <select className={fieldClass} value={guardianLink} onChange={(e) => setGuardianLink(e.target.value)}>
                  <option>Mère</option>
                  <option>Père</option>
                  <option>Tuteur</option>
                  <option>Tutrice</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-ink">
                Nom du parent ou tuteur *
                <input required className={fieldClass} value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
              </label>
              <label className="block text-sm font-bold text-ink">
                Téléphone du parent *
                <input required type="tel" className={fieldClass} value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
              </label>
            </div>
            {!(studentName.trim() && studentEmail.trim() && studentPhone.trim() && birthDate && gender && guardianName.trim() && guardianPhone.trim()) && (
              <p className="text-sm text-ink-muted">Renseignez les champs marqués d’une étoile pour continuer.</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="flex-1 py-3 rounded-xl border-2 border-accent text-ink font-bold flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" /> Retour
              </button>
              <button
                type="button"
                disabled={!studentName.trim() || !studentEmail.trim() || !studentPhone.trim() || !birthDate || !gender || !guardianName.trim() || !guardianPhone.trim()}
                onClick={() => setStep(2)}
                className="flex-1 py-3 bg-primary text-surface font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 border-2 border-accent"
              >
                Continuer <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {campaign && step === 2 && (
          <form onSubmit={submit} className="space-y-4">
            <div className="bg-primary text-surface p-4 rounded-xl border-2 border-accent text-sm space-y-1">
              <p className="font-bold">{TRACK_META[track]}</p>
              {track === 'ECOFO' && <p className="text-surface/90">Année : {ecofoYear}</p>}
              {track === 'POST_FONDAMENTAL' && (
                <p className="text-surface/90">{postSection} · année {postYear}</p>
              )}
              <p className="text-surface/90">{studentName} · {studentEmail}</p>
              {classFull && (
                <p className="text-surface font-bold">Cette classe est complète. Le dossier sera placé sur la liste d’attente.</p>
              )}
            </div>
            <div className="bg-surface p-5 sm:p-7 rounded-2xl border-2 border-accent space-y-4 shadow-sm">
              <h2 className="text-xl font-extrabold text-ink flex items-center gap-2">
                <FileText className="text-accent" /> Pièces & paiement
              </h2>
              {requiredDocs.map((doc) => (
                <label key={doc.label} className="block text-xs font-bold text-ink">
                  {doc.label} *
                  <input
                    type="file"
                    required
                    accept={String(doc.label || '').toLowerCase() === 'photo passeport' ? 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp' : undefined}
                    className="mt-1 block w-full text-sm font-medium"
                    onChange={(e) => setFiles((prev) => ({ ...prev, [doc.label]: e.target.files?.[0] }))}
                  />
                </label>
              ))}
              {extraCriteria.length > 0 && (
                <div className="rounded-xl border-2 border-accent bg-accent/10 p-3 space-y-2">
                  <p className="text-sm font-extrabold text-ink">Critères supplémentaires de l&apos;école</p>
                  <ul className="text-sm text-ink space-y-1">
                    {extraCriteria.map((item, index) => (
                      <li key={index}>
                        <span className="font-semibold">{item.label}</span>
                        {item.date ? ` · ${item.date}` : ''}
                        {item.place ? ` · ${item.place}` : ''}
                        {item.details ? ` — ${item.details}` : ''}
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-2 text-sm font-bold text-ink">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={criteriaAck}
                      onChange={(e) => setCriteriaAck(e.target.checked)}
                      required
                    />
                    J&apos;ai pris connaissance de ces critères (test, entretien ou autre condition).
                  </label>
                </div>
              )}
              {feeAmount > 0 ? (
                <EnrollmentPaymentChoice
                  method={paymentMethod}
                  onMethod={setPaymentMethod}
                  payerPhone={payerPhone}
                  onPhone={setPayerPhone}
                  bordereauName={bordereau?.name || ''}
                  onBordereau={setBordereau}
                  amountLabel={feeLabel}
                />
              ) : (
                <div className="rounded-xl border-2 border-accent bg-accent/10 p-3 text-sm text-ink font-medium">
                  Inscription gratuite. Envoyez le dossier : aucun paiement n&apos;est demandé.
                </div>
              )}
              {error && (
                <p className="text-sm font-bold text-ink bg-alert/10 border-2 border-alert rounded-xl p-3">{error}</p>
              )}
              <p className="text-sm text-ink-muted">
                Vous pouvez télécharger un PDF avec toutes les informations et les pièces. Ce n’est pas obligatoire pour envoyer.
              </p>
              <button
                type="button"
                disabled={pdfBusy}
                onClick={downloadDossier}
                className="w-full py-3 rounded-xl border-2 border-accent text-ink font-bold disabled:opacity-50"
              >
                {pdfBusy ? 'Préparation du PDF…' : 'Télécharger le dossier (PDF)'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl border-2 border-accent text-ink font-bold flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" /> Retour
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary text-surface font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 border-2 border-accent"
                >
                  {submitting
                    ? 'Traitement…'
                    : classFull
                      ? 'Rejoindre la liste d’attente'
                      : feeAmount > 0 && paymentMethod === 'BURUNDIPAY'
                        ? 'Envoyer et payer'
                        : feeAmount > 0
                          ? 'Envoyer le dossier'
                          : 'Envoyer ma candidature'}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        )}

        {step === 3 && done && (
          <div className="bg-surface rounded-2xl p-6 sm:p-8 text-center space-y-5 border-2 border-accent shadow-md text-ink">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-2xl font-extrabold">Candidature enregistrée</h2>
            <p className="text-sm text-ink-muted max-w-md mx-auto">
              {payMsg || `Un e-mail de confirmation a été envoyé à ${done.application?.student_email || studentEmail}.`}
            </p>
            {done.application?.suivi_url && (
              <a
                href={done.application.suivi_url}
                className="inline-flex px-4 py-2 rounded-xl bg-primary text-surface font-bold border-2 border-accent"
              >
                Suivre mon dossier
              </a>
            )}
            {feeAmount > 0 && done.payment_status !== 'PAID' && done.payment_status !== 'WAIVED' && done.payment_status !== 'BORDEREAU_RECU' && (
              <div className="space-y-3 text-left max-w-md mx-auto">
                <BurundiPayPayerField
                  value={payerPhone}
                  onChange={setPayerPhone}
                  amountLabel={feeLabel}
                />
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    type="button"
                    disabled={paymentBusy}
                    onClick={retryPay}
                    className="px-4 py-2 rounded-xl bg-primary text-surface font-bold border-2 border-accent disabled:opacity-50"
                  >
                    Payer / Relancer BurundiPay
                  </button>
                  <button
                    type="button"
                    disabled={paymentBusy}
                    onClick={confirmStubPayment}
                    className="px-4 py-2 rounded-xl border-2 border-accent font-bold disabled:opacity-50"
                  >
                    Confirmer PIN (simulation)
                  </button>
                </div>
              </div>
            )}
            {(done.payment_status === 'PAID' || done.payment_status === 'WAIVED' || done.payment_status === 'BORDEREAU_RECU' || feeAmount === 0) && (
              <p className="text-sm font-semibold text-primary">
                {feeAmount === 0 ? 'Aucun paiement requis.' : done.payment_status === 'BORDEREAU_RECU' ? 'Bordereau reçu.' : 'Paiement validé.'}
              </p>
            )}
            <Link
              to="/education"
              className="inline-flex px-4 py-2 rounded-xl bg-primary text-surface font-bold border-2 border-accent"
            >
              Retour à l&apos;annuaire
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
