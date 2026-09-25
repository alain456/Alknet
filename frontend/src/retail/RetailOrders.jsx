import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PrescriptionOpenButton } from './PrescriptionViewer';
import retailService, { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PROFORMA_STATUS_LABELS } from './retailService';

const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);
const money = (value, currency = 'BIF') => `${Number(value || 0).toLocaleString('fr-BI')} ${currency}`;
const dateTime = (value) => (value ? new Date(value).toLocaleString('fr-FR') : '—');

export default function RetailOrders({ clientMode = false }) {
  const { id } = useParams();
  return id ? <OrderDetail id={id} clientMode={clientMode} /> : <OrderList clientMode={clientMode} />;
}

function OrderList({ clientMode }) {
  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get('patient_email')) setPatientEmail(search.get('patient_email'));
  }, []);

  const load = useCallback(async () => {
    setError('');
    const params = {};
    if (status) params.status = status;
    if (q) params.q = q;
    if (!clientMode && patientEmail) params.patient_email = patientEmail;
    try {
      setOrders(normalize(await retailService.getOrders(params)).filter((order) => clientMode || order.status !== 'DRAFT'));
    } catch (err) {
      setError(err.message || 'Impossible de charger les commandes');
    }
  }, [clientMode, patientEmail, q, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!clientMode) retailService.getPatients().then((data) => setPatients(normalize(data))).catch(() => setPatients([]));
  }, [clientMode]);

  const filtered = useMemo(() => orders.filter((order) => {
    const created = new Date(order.submitted_at || order.created_at);
    const amount = Number(order.total_amount || 0);
    if (dateFrom && created < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo && created > new Date(`${dateTo}T23:59:59`)) return false;
    if (minAmount !== '' && amount < Number(minAmount)) return false;
    if (maxAmount !== '' && amount > Number(maxAmount)) return false;
    return true;
  }), [orders, dateFrom, dateTo, minAmount, maxAmount]);
  const base = clientMode ? '/retail-pharmacy/client/orders' : '/retail-pharmacy/orders';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{clientMode ? 'Mes commandes' : 'Commandes reçues'}</h1>
        <p className="text-sm text-ink-muted">{clientMode ? 'Suivez vos commandes auprès des pharmacies.' : 'Consultez et traitez les commandes des patients.'}</p>
      </div>
      {error && <div className="p-3 bg-red-50 text-error rounded-xl text-sm">{error}</div>}

      <div className="bg-white border border-border rounded-2xl p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Filter label="Statut">
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full border border-border rounded-lg px-2 py-1.5 text-sm">
            <option value="">Tous</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Filter>
        {!clientMode && (
          <Filter label="Patient">
            <select value={patientEmail} onChange={(event) => setPatientEmail(event.target.value)} className="w-full border border-border rounded-lg px-2 py-1.5 text-sm">
              <option value="">Tous</option>
              {patients.map((patient) => <option key={patient.id || patient.email} value={patient.email}>{patient.name} · {patient.email}</option>)}
            </select>
          </Filter>
        )}
        <Filter label="Référence">
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="CMD-PD-…" className="w-full border border-border rounded-lg px-2 py-1.5 text-sm" />
        </Filter>
        <Filter label="Du"><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full border border-border rounded-lg px-2 py-1.5 text-sm" /></Filter>
        <Filter label="Au"><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full border border-border rounded-lg px-2 py-1.5 text-sm" /></Filter>
        <Filter label="Montant min"><input type="number" min="0" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} className="w-full border border-border rounded-lg px-2 py-1.5 text-sm" /></Filter>
        <Filter label="Montant max"><input type="number" min="0" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} className="w-full border border-border rounded-lg px-2 py-1.5 text-sm" /></Filter>
        <div className="flex items-end">
          <button type="button" onClick={load} className="w-full px-3 py-2 bg-primary hover:bg-secondary text-white rounded-xl text-sm font-semibold">Filtrer</button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Envoi</th>
              <th className="px-4 py-3">Lignes</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Paiement</th>
              <th className="px-4 py-3">MàJ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((order) => (
              <tr key={order.id} className="hover:bg-paper/80">
                <td className="px-4 py-3"><Link to={`${base}/${order.id}`} className="font-semibold text-primary hover:underline">{order.reference || 'Brouillon'}</Link></td>
                <td className="px-4 py-3">
                  <div>{order.patient_name || '—'}</div>
                  <div className="text-xs text-ink-muted">{order.patient_email || '—'}</div>
                </td>
                <td className="px-4 py-3 text-xs">{dateTime(order.submitted_at)}</td>
                <td className="px-4 py-3">{order.items_count ?? order.items?.length ?? 0}</td>
                <td className="px-4 py-3 font-semibold">{money(order.total_amount, order.currency)}</td>
                <td className="px-4 py-3 text-xs font-bold">{ORDER_STATUS_LABELS[order.status] || order.status}</td>
                <td className={`px-4 py-3 text-xs font-semibold ${order.payment_status === 'PAID' ? 'text-success' : 'text-ink-muted'}`}>
                  {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status || 'Non payée'}
                </td>
                <td className="px-4 py-3 text-xs">{dateTime(order.updated_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-muted">Aucune commande</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Filter({ label, children }) {
  return <label className="text-xs space-y-1"><span className="text-ink-muted">{label}</span>{children}</label>;
}

function OrderDetail({ id, clientMode }) {
  const [order, setOrder] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [modal, setModal] = useState('');
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [payMethod, setPayMethod] = useState('BURUNDIPAY');
  const [payNote, setPayNote] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const base = clientMode ? '/retail-pharmacy/client/orders' : '/retail-pharmacy/orders';

  const load = useCallback(
    () => retailService.getOrder(id).then(setOrder).catch((err) => setError(err.message || 'Commande introuvable')),
    [id],
  );
  useEffect(() => {
    load();
    if (!clientMode) {
      retailService.getRefusalReasons()
        .then((data) => setReasons(Array.isArray(data) ? data : data?.reasons || []))
        .catch(() => setReasons([]));
    }
  }, [clientMode, load]);

  const run = async (action, success) => {
    setBusy(true);
    setError('');
    try {
      const result = await action();
      setOrder(result);
      setModal('');
      setComment('');
      setReason('');
      setMessage(success);
    } catch (err) {
      setError(err.message || 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  if (!order) return <div className="p-6 text-ink-muted">{error || 'Chargement…'}</div>;

  const canDecide = !clientMode && ['SUBMITTED', 'PROCESSING', 'CLARIFICATION_REQUESTED'].includes(order.status);
  const canCancel = clientMode && ['DRAFT', 'SUBMITTED', 'CLARIFICATION_REQUESTED'].includes(order.status);
  const paymentSettled = order.payment_status === 'PAID';
  const canAccept = canDecide && paymentSettled;
  const canMarkPaid = !clientMode
    && order.payment_status !== 'PAID'
    && ['SUBMITTED', 'PROCESSING', 'CLARIFICATION_REQUESTED', 'ACCEPTED'].includes(order.status);
  const canClearPaid = !clientMode && order.payment_status === 'PAID' && order.status !== 'ACCEPTED';
  const proforma = order.proforma;

  return (
    <div className="space-y-4 max-w-5xl">
      <Link to={base} className="text-sm text-primary">← Retour</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{order.reference || 'Brouillon'}</h1>
          <p className="text-sm text-ink-muted">
            {order.patient_name} → {order.retail_business_name} · {ORDER_STATUS_LABELS[order.status] || order.status}
            {' · '}
            <span className={order.payment_status === 'PAID' ? 'text-success font-semibold' : ''}>
              {PAYMENT_STATUS_LABELS[order.payment_status] || 'Non payée'}
            </span>
          </p>
          <p className="text-xs text-ink-faint mt-1">{[order.patient_email, order.patient_phone].filter(Boolean).join(' · ')}</p>
          {(order.payment_method || order.payer_phone) && (
            <p className="text-xs text-ink-muted mt-1">
              Paiement prévu : {order.payment_method || 'BURUNDIPAY'}
              {order.payer_phone ? ` · BurundiPay ${order.payer_phone}` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canDecide && (
            <>
              <button
                type="button"
                onClick={() => setModal('accept')}
                disabled={!canAccept}
                title={!canAccept ? 'Le client doit d\'abord payer via BurundiPay' : undefined}
                className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-40"
              >
                Accepter
              </button>
              <button type="button" onClick={() => setModal('clarify')} className="px-4 py-2 border border-border rounded-xl font-semibold">Demander des précisions</button>
              <button type="button" onClick={() => setModal('reject')} className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold">Refuser</button>
            </>
          )}
          {canMarkPaid && (
            <button type="button" onClick={() => setModal('paid')} className="px-4 py-2 bg-teal-700 text-white rounded-xl font-semibold">
              {order.status === 'ACCEPTED' ? 'Marquer payée' : 'Confirmer paiement (caisse)'}
            </button>
          )}
          {canClearPaid && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => retailService.markOrderUnpaid(id), 'Marquage payé annulé.')}
              className="px-4 py-2 border border-border rounded-xl font-semibold text-sm"
            >
              Annuler marquage payé
            </button>
          )}
          {canCancel && <button type="button" onClick={() => setModal('cancel')} className="px-4 py-2 border border-red-200 text-error rounded-xl font-semibold">Annuler la commande</button>}
        </div>
      </div>
      {canDecide && !paymentSettled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Paiement non validé ({PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}).
          L&apos;acceptation n&apos;est possible qu&apos;après paiement BurundiPay du client
          {order.payer_phone ? ` (${order.payer_phone})` : ''}.
        </div>
      )}

      {message && <div className="p-3 bg-green-50 text-success rounded-xl text-sm">{message}</div>}
      {error && <div className="p-3 bg-red-50 text-error rounded-xl text-sm">{error}</div>}
      {order.clarification_comment && <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm"><strong>Précisions demandées :</strong> {order.clarification_comment}</div>}
      {order.status === 'REJECTED' && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm">
          <strong>Motif du refus :</strong> {order.rejection_reason || '—'}
          {order.rejection_comment && <div className="mt-1">{order.rejection_comment}</div>}
        </div>
      )}
      {order.payment_status === 'PAID' && (
        <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl text-sm space-y-1">
          <strong>Paiement validé</strong>
          <div>Méthode : {order.payment_method || '—'}</div>
          {order.payer_phone && <div>BurundiPay : {order.payer_phone}</div>}
          {order.paid_at && <div>Le {dateTime(order.paid_at)}</div>}
          {order.payment_note && <div className="text-ink-muted">{order.payment_note}</div>}
        </div>
      )}
      {proforma && (
        <div className="p-4 bg-white border border-border rounded-xl text-sm flex flex-wrap justify-between gap-2">
          <span>Facture proforma <strong>{proforma.reference}</strong></span>
          <span className="font-semibold">{PROFORMA_STATUS_LABELS[proforma.status] || proforma.status}</span>
        </div>
      )}

      <div className="bg-white border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Unité de vente</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Qté</th>
              <th className="px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(order.items || []).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium">
                  {item.product_name_snapshot}
                  {item.prescription_required_snapshot && <span className="block text-[11px] text-amber-700">Ordonnance requise</span>}
                </td>
                <td className="px-4 py-3">{item.sales_unit_snapshot || item.packaging_snapshot}</td>
                <td className="px-4 py-3">{money(item.unit_price_snapshot, order.currency)}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3 font-semibold">{money(item.line_total, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border font-bold text-right">Total : {money(order.total_amount, order.currency)}</div>
      </div>

      {(order.prescriptions || []).length > 0 && (
        <div className="bg-white border border-border rounded-2xl p-5">
          <h2 className="font-bold mb-3">Ordonnances</h2>
          <div className="space-y-2">
            {order.prescriptions.map((prescription, index) => (
              <div key={prescription.id} className="flex flex-wrap items-center gap-2">
                <PrescriptionOpenButton
                  fileUrl={prescription.file_url}
                  label={`Voir l’ordonnance ${index + 1}`}
                  className="text-sm text-primary hover:underline font-semibold"
                />
                <span className="text-xs text-ink-muted">· {prescription.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-border rounded-2xl p-5">
        <h2 className="font-bold mb-3">Historique</h2>
        <ul className="divide-y divide-border text-sm">
          {(order.events || []).map((event) => (
            <li key={event.id} className="py-2 flex justify-between gap-3">
              <span><strong>{event.event_type}</strong> — {event.message}</span>
              <span className="text-xs text-ink-faint shrink-0">{dateTime(event.created_at)}</span>
            </li>
          ))}
          {(order.events || []).length === 0 && <li className="py-3 text-ink-muted">Aucun historique.</li>}
        </ul>
      </div>

      {modal === 'accept' && (
        <ConfirmModal title="Accepter la commande ?" busy={busy} onClose={() => setModal('')} onConfirm={() => run(() => retailService.acceptOrder(id), 'Commande acceptée.')}>
          Le stock sera réservé pour {order.patient_name}. L’acceptation échouera si le stock est insuffisant.
        </ConfirmModal>
      )}
      {modal === 'paid' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-lg">Marquer comme payée</h2>
            <p className="text-xs text-ink-muted">
              Confirmez le paiement (BurundiPay déjà reçu, espèces…) pour permettre l&apos;acceptation de la commande.
            </p>
            <label className="text-sm block space-y-1">
              <span>Méthode</span>
              <select className="w-full border rounded-lg px-3 py-2" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="BURUNDIPAY">BurundiPay</option>
                <option value="CASH">Espèces</option>
                <option value="BANK">Virement / banque</option>
                <option value="OTHER">Autre</option>
              </select>
            </label>
            <label className="text-sm block space-y-1">
              <span>Note (optionnel)</span>
              <textarea className="w-full border rounded-lg px-3 py-2" rows={2} value={payNote} onChange={(e) => setPayNote(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal('')} className="px-4 py-2 border rounded-xl">Annuler</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(
                  () => retailService.markOrderPaid(id, { payment_method: payMethod, payment_note: payNote }),
                  'Paiement privé confirmé.',
                )}
                className="px-4 py-2 bg-teal-700 text-white rounded-xl font-semibold"
              >
                Confirmer payée
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'cancel' && (
        <ConfirmModal title="Annuler la commande ?" busy={busy} danger onClose={() => setModal('')} onConfirm={() => run(() => retailService.cancelOrder(id), 'Commande annulée.')}>
          Cette action annulera la commande {order.reference}.
        </ConfirmModal>
      )}
      {modal === 'clarify' && (
        <TextModal title="Demander des précisions" label="Message au patient *" value={comment} onChange={setComment} busy={busy} disabled={!comment.trim()} onClose={() => setModal('')} onSubmit={() => run(() => retailService.requestClarification(id, comment.trim()), 'Demande de précisions envoyée.')} />
      )}
      {modal === 'reject' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={(event) => { event.preventDefault(); run(() => retailService.rejectOrder(id, { reason, comment }), 'Commande refusée.'); }} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-lg">Refuser {order.reference}</h2>
            <label className="text-sm block space-y-1">
              <span>Motif *</span>
              <select required value={reason} onChange={(event) => setReason(event.target.value)} className="w-full border border-border rounded-lg px-3 py-2">
                <option value="">Choisir…</option>
                {reasons.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-sm block space-y-1">
              <span>Commentaire</span>
              <textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal('')} className="px-4 py-2 border border-border rounded-xl">Annuler</button>
              <button type="submit" disabled={!reason || busy} className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold disabled:opacity-50">Confirmer le refus</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ title, children, busy, danger = false, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
        <h2 className="font-bold text-lg">{title}</h2>
        <p className="text-sm text-ink-muted">{children}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-xl">Retour</button>
          <button type="button" disabled={busy} onClick={onConfirm} className={`px-4 py-2 text-white rounded-xl font-semibold disabled:opacity-50 ${danger ? 'bg-red-600' : 'bg-primary'}`}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}

function TextModal({ title, label, value, onChange, busy, disabled, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
        <h2 className="font-bold text-lg">{title}</h2>
        <label className="text-sm block space-y-1">
          <span>{label}</span>
          <textarea autoFocus required rows={4} value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-xl">Annuler</button>
          <button type="submit" disabled={disabled || busy} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-50">Envoyer</button>
        </div>
      </form>
    </div>
  );
}
