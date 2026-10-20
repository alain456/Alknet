import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, GraduationCap, Sparkles, User } from 'lucide-react';
import { api } from '../shared/api';
import { useAuth } from '../context/AuthContext';
import EnrollmentPaymentChoice from './EnrollmentPaymentChoice';
import { downloadApplicationPdf } from './dossierPdf';
import { isValidBurundiPayPhone, normalizeBurundiPayPhone } from '../shared/components/burundiPayPhone';

const STEPS = ['Niveau', 'Identité', 'Études antérieures', 'Contact', 'Documents'];
const COUNTRIES = ['Burundi', 'République démocratique du Congo', 'Rwanda', 'Tanzanie', 'Kenya', 'Ouganda', 'France', 'Belgique', 'Autre'];
const fieldClass = 'w-full mt-1.5 px-3 py-2.5 rounded-xl border border-border bg-white text-sm text-ink outline-none focus:border-accent';

function Field({ label, children, className = '' }) {
  return (
    <label className={`block text-sm font-semibold text-ink ${className}`}>
      {label}
      {children}
    </label>
  );
}

function Choice({ name, value, current, onPick, children }) {
  const selected = current === value;
  return (
    <label className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer ${selected ? 'bg-accent text-ink border-accent' : 'bg-white text-ink border-border'}`}>
      <input type="radio" className="h-4 w-4 shrink-0" name={name} checked={selected} onChange={() => onPick(value)} />
      {children}
    </label>
  );
}

const empty = {
  studyYear: '',
  option: '',
  firstName: '',
  middleName: '',
  lastName: '',
  birthDate: '',
  nationality: '',
  gender: '',
  marital: '',
  email: '',
  phone: '',
  avenue: '',
  zone: '',
  commune: '',
  province: '',
  country: 'Burundi',
  countryOther: '',
  school: '',
  lastPercent: '',
  examPercent: '',
  declared: '',
  link: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  contactAddress: '',
  terms: false,
};

export default function PublicUniversityEnrollment({ campaign, campaignId }) {
  const { user, token } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState({});
  const [payerPhone, setPayerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [bordereau, setBordereau] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      firstName: prev.firstName || user.first_name || '',
      lastName: prev.lastName || user.last_name || '',
      email: prev.email || user.email || '',
      phone: prev.phone || user.phone_number || '',
    }));
  }, [user]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const years = campaign?.study_years || [];
  const options = campaign?.program_options || [];
  const identityLabel = campaign?.identity_document_label || 'Carte d’identité';
  const listed = (campaign?.required_documents || []).filter((doc) => doc.label);
  const documents = [
    ...(listed.some((doc) => doc.label.toLowerCase() === 'photo passeport') ? [] : [{ label: 'Photo passeport', description: 'JPEG, PNG ou WebP' }]),
    ...(listed.some((doc) => doc.label === identityLabel) ? [] : [{ label: identityLabel, description: 'PDF' }]),
    ...listed,
  ];
  const isPassport = (label) => String(label || '').toLowerCase() === 'photo passeport';
  const feeAmount = Number(campaign?.enrollment_fee?.amount_bif || 0);
  const feeLabel = feeAmount > 0
    ? `${campaign.enrollment_fee.label || 'Frais d’inscription'} — ${feeAmount.toLocaleString('fr-BI')} BIF`
    : 'Inscription gratuite';
  const country = form.country === 'Autre' ? form.countryOther.trim() : form.country;

  const next = () => {
    setError('');
    if (step === 0) {
      if (!form.studyYear) return setError('Choisissez le niveau d’inscription.');
      if (options.length && !form.option) return setError('Choisissez une option.');
    }
    if (step === 1) {
      if (!form.firstName.trim() || !form.lastName.trim()) return setError('Indiquez le prénom et le nom.');
      if (!form.birthDate || !form.nationality.trim() || !form.gender || !form.marital) return setError('Complétez l’identité du candidat.');
      if (!form.email.trim() || !form.phone.trim()) return setError('Indiquez l’e-mail et le téléphone.');
      if (!form.avenue.trim() || !form.zone.trim() || !form.commune.trim() || !form.province.trim() || !country) {
        return setError('Indiquez l’adresse complète.');
      }
    }
    if (step === 2) {
      if (!form.school.trim() || !form.lastPercent || !form.examPercent || !form.declared) {
        return setError('Complétez les études antérieures.');
      }
    }
    if (step === 3) {
      if (!form.link.trim() || !form.contactName.trim() || !form.contactEmail.trim() || !form.contactPhone.trim() || !form.contactAddress.trim()) {
        return setError('Indiquez une personne de contact.');
      }
    }
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  };

  const buildBody = () => {
    const body = new FormData();
    body.append('campaign', campaignId);
    body.append('student_email', form.email.trim());
    body.append('student_phone', form.phone.trim());
    body.append('first_name', form.firstName.trim());
    body.append('middle_name', form.middleName.trim());
    body.append('last_name', form.lastName.trim());
    body.append('birth_date', form.birthDate);
    body.append('gender', form.gender);
    body.append('nationality', form.nationality.trim());
    body.append('marital_status', form.marital);
    body.append('avenue', form.avenue.trim());
    body.append('zone', form.zone.trim());
    body.append('commune', form.commune.trim());
    body.append('province', form.province.trim());
    body.append('country', country);
    body.append('previous_school', form.school.trim());
    body.append('last_percent', form.lastPercent);
    body.append('state_exam_percent', form.examPercent);
    body.append('studies_declared', form.declared);
    body.append('guardian_link', form.link.trim());
    body.append('guardian_name', form.contactName.trim());
    body.append('guardian_email', form.contactEmail.trim());
    body.append('guardian_phone', form.contactPhone.trim());
    body.append('guardian_address', form.contactAddress.trim());
    body.append('study_year', form.studyYear);
    if (form.option) body.append('program_option', form.option);
    body.append('terms_ack', form.terms ? '1' : '');
    if (feeAmount > 0) {
      body.append('payment_method', paymentMethod);
      if (paymentMethod === 'BURUNDIPAY') body.append('payer_phone', normalizeBurundiPayPhone(payerPhone));
      if (paymentMethod === 'BORDEREAU' && bordereau) body.append('bordereau', bordereau);
    }
    documents.forEach((doc, index) => {
      body.append(`doc_label_${index}`, doc.label);
      if (files[doc.label]) body.append(`doc_file_${index}`, files[doc.label]);
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

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!campaign?.open_today) return setError('Les inscriptions sont fermées pour cette année.');
    for (const doc of documents) {
      const file = files[doc.label];
      if (!file) return setError(`Téléchargez : ${doc.label}`);
      const name = file.name.toLowerCase();
      if (isPassport(doc.label)) {
        if (!/\.(jpe?g|png|webp)$/.test(name)) return setError('La photo passeport doit être une image JPEG, PNG ou WebP.');
      } else if (!name.endsWith('.pdf')) {
        return setError(`${doc.label} doit être un PDF.`);
      }
    }
    if (!form.terms) return setError('Confirmez avoir lu les conditions d’inscription.');
    if (feeAmount > 0 && paymentMethod !== 'BURUNDIPAY' && paymentMethod !== 'BORDEREAU') {
      return setError('Choisissez BurundiPay ou un bordereau PDF.');
    }
    if (feeAmount > 0 && paymentMethod === 'BURUNDIPAY' && !isValidBurundiPayPhone(payerPhone)) {
      return setError('Numéro BurundiPay invalide : 8 chiffres requis (ex. 79xxxxxx).');
    }
    if (feeAmount > 0 && paymentMethod === 'BORDEREAU' && !bordereau?.name?.toLowerCase().endsWith('.pdf')) {
      return setError('Le bordereau doit être un PDF.');
    }
    setSubmitting(true);
    try {
      const result = await api.post('education/applications/apply/', buildBody(), { auth: !!token });
      setDone(result);
    } catch (err) {
      setError(err.message || 'Envoi impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const paid = done.payment?.status === 'PAID' || done.payment_status === 'PAID';
    const confirmPayment = async () => {
      setPaymentBusy(true);
      setError('');
      try {
        const res = await api.post(
          `education/applications/${done.application.id}/confirm-payment/`,
          { payment_token: done.payment?.payment_token || '' },
          { auth: !!token },
        );
        setDone((prev) => ({ ...prev, payment: res.payment, message: res.message || prev.message }));
      } catch (err) {
        setError(err.message || 'Confirmation impossible.');
      } finally {
        setPaymentBusy(false);
      }
    };
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 mx-auto text-accent" />
        <h1 className="text-2xl font-extrabold">Dossier envoyé</h1>
        <p className="text-sm text-ink-muted">{done.message}</p>
        {feeAmount > 0 && !paid && done.payment?.status !== 'BORDEREAU_RECU' && (
          <div className="mx-auto max-w-md text-left space-y-3">
            <p className="text-sm font-semibold text-ink">{feeLabel}</p>
            <button type="button" className="px-4 py-2.5 rounded-xl bg-accent text-ink text-sm font-bold disabled:opacity-50" disabled={paymentBusy} onClick={confirmPayment}>
              {paymentBusy ? 'Confirmation…' : 'Confirmer le paiement (simulation)'}
            </button>
            {error && <p className="text-sm text-alert">{error}</p>}
          </div>
        )}
        {done.application?.suivi_url && (
          <a href={done.application.suivi_url} className="inline-flex font-bold text-primary underline">Suivre le dossier</a>
        )}
      </div>
    );
  }

  const card = 'rounded-2xl bg-white ring-1 ring-border p-5 sm:p-6 space-y-4';

  return (
    <div className="min-h-screen bg-surface text-ink pb-16">
      <div className="school-dash-hero bg-ink">
        <div className="max-w-3xl mx-auto px-4 py-8 text-center space-y-1">
          <div className="text-left">
            <Link
              to={campaign?.establishment_id ? `/education/establishment/${campaign.establishment_id}#inscription` : '/education'}
              className="inline-flex items-center gap-1 text-sm font-bold text-surface"
            >
              <ChevronLeft className="w-4 h-4" /> Retour
            </Link>
          </div>
          <p className="school-dash-kicker inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]">
            <Sparkles className="w-3.5 h-3.5" /> Inscription
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold">{campaign.program_title}</h1>
          <p className="text-sm">Année académique {campaign.academic_year}</p>
          <p className="text-sm">{feeAmount > 0 ? feeLabel : 'Inscription gratuite'}</p>
        </div>
      </div>
      <form onSubmit={submit} className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <ol className="grid grid-cols-5 gap-2">
          {STEPS.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => index < step && setStep(index)}
                className={`w-full rounded-xl px-1 py-2 text-center text-[11px] sm:text-xs font-bold ${
                  index === step ? 'bg-accent text-ink' : 'bg-white text-ink ring-1 ring-border'
                }`}
              >
                <span className="block tabular-nums">{index + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
        {error && <p className="rounded-xl border border-alert bg-alert/10 px-4 py-3 text-sm font-medium">{error}</p>}
        {!campaign.open_today && (
          <p className="rounded-xl bg-white ring-1 ring-border px-4 py-3 text-sm text-ink">
            Les inscriptions ouvrent le {campaign.opens_on}. Vous pouvez préparer le dossier ; l’envoi sera possible à partir de cette date.
          </p>
        )}

        {step === 0 && (
          <section className={card}>
            <h2 className="font-extrabold flex items-center gap-2"><GraduationCap className="w-5 h-5 text-accent" /> Inscription valable pour</h2>
            <div className="flex flex-wrap gap-2">
              {years.map((year) => (
                <button key={year} type="button" onClick={() => set('studyYear', year)} className={`px-4 py-2 rounded-xl border-2 text-sm font-bold ${form.studyYear === year ? 'bg-accent text-ink border-accent' : 'border-border'}`}>
                  {year}
                </button>
              ))}
            </div>
            {options.length > 0 && (
              <label className="block text-xs font-bold">
                Option
                <select className={fieldClass} value={form.option} onChange={(e) => set('option', e.target.value)}>
                  <option value="">Choisir</option>
                  {options.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
            )}
          </section>
        )}

        {step === 1 && (
          <section className={card}>
            <h2 className="font-extrabold flex items-center gap-2"><User className="w-5 h-5 text-accent" /> Identification du candidat</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Prénom"><input className={fieldClass} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required /></Field>
              <Field label="2e prénom"><input className={fieldClass} value={form.middleName} onChange={(e) => set('middleName', e.target.value)} /></Field>
              <Field label="Nom"><input className={fieldClass} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required /></Field>
              <Field label="Date de naissance"><input type="date" className={fieldClass} value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} required /></Field>
              <Field label="Nationalité"><input className={fieldClass} maxLength={20} value={form.nationality} onChange={(e) => set('nationality', e.target.value)} required /></Field>
              <Field label="E-mail"><input type="email" className={fieldClass} value={form.email} onChange={(e) => set('email', e.target.value)} required /></Field>
              <Field label="Téléphone"><input className={fieldClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} required /></Field>
              <div>
                <p className="text-xs font-semibold text-ink mb-1.5">Sexe</p>
                <div className="grid grid-cols-2 gap-2">
                  <Choice name="gender" value="M" current={form.gender} onPick={(value) => set('gender', value)}>Masculin</Choice>
                  <Choice name="gender" value="F" current={form.gender} onPick={(value) => set('gender', value)}>Féminin</Choice>
                </div>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold text-ink mb-1.5">État civil</p>
                <div className="grid grid-cols-2 gap-2">
                  <Choice name="marital" value="Célibataire" current={form.marital} onPick={(value) => set('marital', value)}>Célibataire</Choice>
                  <Choice name="marital" value="Marié(e)" current={form.marital} onPick={(value) => set('marital', value)}>Marié(e)</Choice>
                </div>
              </div>
              <Field label="Avenue, rue, n°"><input className={fieldClass} value={form.avenue} onChange={(e) => set('avenue', e.target.value)} required /></Field>
              <Field label="Zone, quartier"><input className={fieldClass} value={form.zone} onChange={(e) => set('zone', e.target.value)} required /></Field>
              <Field label="Commune"><input className={fieldClass} value={form.commune} onChange={(e) => set('commune', e.target.value)} required /></Field>
              <Field label="Province"><input className={fieldClass} value={form.province} onChange={(e) => set('province', e.target.value)} required /></Field>
              <Field label="Pays">
                <select className={fieldClass} value={form.country} onChange={(e) => set('country', e.target.value)}>
                  {COUNTRIES.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </Field>
              {form.country === 'Autre' && (
                <Field label="Préciser le pays"><input className={fieldClass} value={form.countryOther} onChange={(e) => set('countryOther', e.target.value)} /></Field>
              )}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className={card}>
            <h2 className="font-extrabold">Études antérieures du candidat</h2>
            <Field label="Dernier établissement fréquenté"><input className={fieldClass} value={form.school} onChange={(e) => set('school', e.target.value)} required /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Note de la dernière année au secondaire (%)"><input type="number" min="0" max="100" className={fieldClass} value={form.lastPercent} onChange={(e) => set('lastPercent', e.target.value)} required /></Field>
              <Field label="Note à l’examen d’État (%)"><input type="number" min="0" max="100" className={fieldClass} value={form.examPercent} onChange={(e) => set('examPercent', e.target.value)} required /></Field>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink mb-1.5">Ces informations ont-elles déjà été fournies ?</p>
              <div className="grid grid-cols-2 gap-2 max-w-xs">
                <Choice name="declared" value="Oui" current={form.declared} onPick={(value) => set('declared', value)}>Oui</Choice>
                <Choice name="declared" value="Non" current={form.declared} onPick={(value) => set('declared', value)}>Non</Choice>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className={card}>
            <h2 className="font-extrabold">Personne de contact</h2>
            <p className="text-sm text-ink-muted">Parent, frère ou tuteur qui peut être joint pour les frais académiques.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Lien de parenté"><input className={fieldClass} value={form.link} onChange={(e) => set('link', e.target.value)} required /></Field>
              <Field label="Nom et prénom"><input className={fieldClass} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} required /></Field>
              <Field label="E-mail"><input type="email" className={fieldClass} value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} required /></Field>
              <Field label="Téléphone"><input className={fieldClass} value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} required /></Field>
              <Field className="sm:col-span-2" label="Adresse de résidence"><input className={fieldClass} value={form.contactAddress} onChange={(e) => set('contactAddress', e.target.value)} required /></Field>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className={card}>
            <h2 className="font-extrabold flex items-center gap-2"><FileText className="w-5 h-5 text-accent" /> Documents exigés</h2>
            <p className="text-sm text-ink-muted">La photo passeport est une image JPEG, PNG ou WebP. Les autres pièces sont des PDF. Les originaux seront présentés au secrétariat.</p>
            {documents.length === 0 && <p className="text-sm">Aucun document n’est demandé pour cette inscription.</p>}
            {documents.map((doc) => (
              <Field key={doc.label} label={doc.label}>
                {doc.description && doc.description !== 'PDF' ? <span className="block font-medium text-ink-muted">{doc.description}</span> : null}
                <input
                  type="file"
                  accept={isPassport(doc.label) ? 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp' : 'application/pdf,.pdf'}
                  className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1 file:text-xs file:font-bold file:text-ink`}
                  onChange={(e) => setFiles((prev) => ({ ...prev, [doc.label]: e.target.files?.[0] || null }))}
                />
              </Field>
            ))}
            <label className="flex items-start gap-2 text-sm font-semibold">
              <input type="checkbox" checked={form.terms} onChange={(e) => set('terms', e.target.checked)} />
              Je confirme avoir lu les conditions d’inscription.
            </label>
            <p className="text-sm text-ink-muted">
              Vous pouvez télécharger un PDF avec toutes les informations et les pièces. Ce n’est pas obligatoire avant de soumettre.
            </p>
            <button
              type="button"
              disabled={pdfBusy}
              onClick={downloadDossier}
              className="w-full py-2.5 rounded-xl border-2 border-accent text-ink text-sm font-bold disabled:opacity-50"
            >
              {pdfBusy ? 'Préparation du PDF…' : 'Télécharger le dossier (PDF)'}
            </button>
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
              <p className="rounded-xl bg-white ring-1 ring-border px-4 py-3 text-sm">Inscription gratuite. Aucun paiement n’est demandé.</p>
            )}
          </section>
        )}

        <div className="flex gap-2">
          {step === 0 ? (
            <Link
              to={campaign?.establishment_id ? `/education/establishment/${campaign.establishment_id}#inscription` : '/education'}
              className="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl border-2 border-accent text-sm font-bold text-ink"
            >
              <ChevronLeft className="w-4 h-4" /> Retour
            </Link>
          ) : (
            <button type="button" className="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl border-2 border-accent text-sm font-bold" onClick={() => setStep((value) => value - 1)}>
              <ChevronLeft className="w-4 h-4" /> Retour
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl bg-accent text-ink text-sm font-bold" onClick={next}>
              Continuer <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-ink text-sm font-bold disabled:opacity-50" disabled={submitting || !campaign.open_today}>
              {submitting ? 'Envoi…' : 'Soumettre'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
