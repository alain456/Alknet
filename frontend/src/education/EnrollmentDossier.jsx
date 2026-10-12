import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileText, GraduationCap } from 'lucide-react';
import { api } from '../shared/api';
import BurundiPayPayerField from '../shared/components/BurundiPayPayerField';
import { isValidBurundiPayPhone, normalizeBurundiPayPhone } from '../shared/components/burundiPayPhone';

const PAY_LABEL = {
  PAID: 'Payé',
  UNPAID: 'Non payé',
  AWAITING_PIN: 'Paiement en cours',
  FAILED: 'Paiement échoué',
  WAIVED: 'Aucun frais',
};

/**
 * Suivi public d'un dossier d'inscription (lien envoyé par e-mail).
 */
export default function EnrollmentDossier() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [dossier, setDossier] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [payerPhone, setPayerPhone] = useState('');
  const [payMsg, setPayMsg] = useState('');
  const [paymentToken, setPaymentToken] = useState('');

  const load = () => {
    if (!token) {
      setError('Lien de suivi incomplet.');
      setLoading(false);
      return Promise.resolve();
    }
    return api.get(`education/applications/suivi/?token=${encodeURIComponent(token)}`)
      .then((data) => {
        setDossier(data);
        setError('');
      })
      .catch((err) => setError(err.message || 'Dossier introuvable.'));
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [token]);

  const upload = async (e) => {
    e.preventDefault();
    setError('');
    if (!label.trim() || !file) {
      setError('Indiquez le nom de la pièce et joignez le fichier.');
      return;
    }
    setSending(true);
    try {
      const body = new FormData();
      body.append('token', token);
      body.append('label', label.trim());
      body.append('file', file);
      const data = await api.post('education/applications/suivi/document/', body);
      setDossier(data);
      setLabel('');
      setFile(null);
      setPayMsg('Complément envoyé. L’école reprend l’instruction du dossier.');
    } catch (err) {
      setError(err.message || 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  };

  const pay = async () => {
    setError('');
    if (!isValidBurundiPayPhone(payerPhone)) {
      setError('Numéro BurundiPay invalide : 8 chiffres requis.');
      return;
    }
    setSending(true);
    try {
      const data = await api.post('education/applications/suivi/pay/', {
        token,
        payer_phone: normalizeBurundiPayPhone(payerPhone),
      });
      setPaymentToken(data.payment_token || '');
      setPayMsg(data.message || '');
      if (data.dossier) setDossier(data.dossier);
    } catch (err) {
      setError(err.message || 'Paiement impossible.');
    } finally {
      setSending(false);
    }
  };

  const confirmPay = async () => {
    setSending(true);
    setError('');
    try {
      const data = await api.post('education/applications/suivi/confirm-payment/', { token });
      setPayMsg(data.message || 'Paiement confirmé.');
      if (data.dossier) setDossier(data.dossier);
    } catch (err) {
      setError(err.message || 'Confirmation impossible.');
    } finally {
      setSending(false);
    }
  };

  const payment = dossier?.payment || {};
  const payStatus = payment.status || '';

  return (
    <div className="max-w-xl mx-auto px-4 py-8 text-ink">
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap className="text-primary" />
        <h1 className="text-2xl font-extrabold">Mon dossier</h1>
      </div>
      {loading && <p className="text-sm text-ink-muted">Chargement…</p>}
      {error && <p className="text-sm text-alert font-medium mb-3">{error}</p>}
      {dossier && (
        <div className="bg-surface rounded-2xl border-2 border-accent p-5 sm:p-7 space-y-4 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{dossier.school_name}</p>
            <p className="text-lg font-extrabold">{dossier.title}</p>
            <p className="text-sm text-ink-muted">{dossier.academic_year} · {dossier.student_name}</p>
          </div>
          <p className="inline-flex px-3 py-1 rounded-xl border-2 border-accent text-sm font-bold">
            {dossier.status_label}
          </p>
          {dossier.decision_note && (
            <p className="text-sm">
              <span className="font-bold">Message de l’école : </span>
              {dossier.decision_note}
            </p>
          )}
          <div>
            <p className="text-sm font-extrabold flex items-center gap-2">
              <FileText className="w-4 h-4" /> Pièces déposées
            </p>
            {(dossier.files || []).length === 0 ? (
              <p className="text-sm text-ink-muted mt-1">Aucune pièce pour le moment.</p>
            ) : (
              <ul className="mt-1 text-sm space-y-1">
                {dossier.files.map((doc) => (
                  <li key={doc.label}>
                    {doc.url ? (
                      <a className="text-primary font-semibold" href={doc.url} target="_blank" rel="noreferrer">{doc.label}</a>
                    ) : doc.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-sm">
            <span className="font-bold">Paiement : </span>
            {PAY_LABEL[payStatus] || payStatus}
            {payment.amount_bif > 0 ? ` · ${Number(payment.amount_bif).toLocaleString('fr-BI')} BIF` : ''}
          </p>
          {payStatus !== 'PAID' && payStatus !== 'WAIVED' && (
            <div className="space-y-2">
              <BurundiPayPayerField
                value={payerPhone}
                onChange={setPayerPhone}
                amountLabel={payment.label || 'Frais d’inscription'}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={sending} onClick={pay} className="px-4 py-2 rounded-xl bg-primary text-surface font-bold border-2 border-accent disabled:opacity-50">
                  Payer avec BurundiPay
                </button>
                {(payStatus === 'AWAITING_PIN' || paymentToken) && (
                  <button type="button" disabled={sending} onClick={confirmPay} className="px-4 py-2 rounded-xl border-2 border-accent font-bold disabled:opacity-50">
                    Confirmer PIN (simulation)
                  </button>
                )}
              </div>
            </div>
          )}
          {payMsg && <p className="text-sm font-medium text-primary">{payMsg}</p>}
          {dossier.can_upload_complement && (
            <form onSubmit={upload} className="space-y-2 border-t border-accent/40 pt-3">
              <p className="text-sm font-extrabold">Déposer le complément demandé</p>
              <input
                className="w-full px-3 py-2 border-2 border-accent rounded-xl text-sm"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Nom de la pièce"
                required
              />
              <input type="file" required className="block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button type="submit" disabled={sending} className="px-4 py-2 rounded-xl bg-primary text-surface font-bold border-2 border-accent disabled:opacity-50">
                Envoyer le complément
              </button>
            </form>
          )}
          {dossier.status === 'LISTE_ATTENTE' && (
            <p className="text-sm font-semibold text-ink">
              Votre dossier est en liste d’attente. L’école va l’accepter ou le refuser.
            </p>
          )}
          {(dossier.status === 'ACCEPTEE' || dossier.status === 'CONFIRMEE') && (
            <p className="text-sm font-semibold text-primary flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Inscription retenue par l’école.
            </p>
          )}
          <Link to="/education" className="inline-flex text-sm font-bold text-primary">Retour à l’annuaire</Link>
        </div>
      )}
    </div>
  );
}
