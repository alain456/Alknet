import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import wholesaleService, { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PROFORMA_STATUS_LABELS } from './wholesaleService';

const normalize = (d) => (Array.isArray(d) ? d : d?.results || []);
const money = (n, c = 'BIF') => `${Number(n || 0).toLocaleString('fr-BI')} ${c}`;

export default function WholesaleOrders({ clientMode = false }) {
  const { id } = useParams();
  if (id) return <OrderDetail id={id} clientMode={clientMode} />;
  return <OrderList clientMode={clientMode} />;
}

function OrderList({ clientMode }) {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [client, setClient] = useState('');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Préfiltre depuis URL (?client=uuid ou ?buyer_email=)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('client')) setClient(sp.get('client'));
  }, []);

  const load = () => {
    const params = {};
    if (status) params.status = status;
    if (!clientMode && client) params.client = client;
    const sp = new URLSearchParams(window.location.search);
    if (!clientMode && sp.get('buyer_email')) params.buyer_email = sp.get('buyer_email');
    if (q) params.q = q;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (minAmount) params.min_amount = minAmount;
    if (maxAmount) params.max_amount = maxAmount;
    return wholesaleService.getOrders(params)
      .then((d) => setOrders(normalize(d).filter((o) => clientMode || o.status !== 'DRAFT')))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    if (!clientMode) {
      wholesaleService.getClients().then(setClients).catch(() => {});
    }
  }, [clientMode]);

  const base = clientMode ? '/wholesale-pharmacy/client/orders' : '/wholesale-pharmacy/orders';

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{clientMode ? 'Mes commandes' : 'Commandes reçues'}</h1>
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

      <div className="bg-white border rounded-2xl p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-xs space-y-1">
          <span className="text-slate-500">Statut</span>
          <select className="w-full border rounded-lg px-2 py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        {!clientMode && (
          <label className="text-xs space-y-1">
            <span className="text-slate-500">Pharmacie cliente</span>
            <select className="w-full border rounded-lg px-2 py-1.5 text-sm" value={client} onChange={(e) => setClient(e.target.value)}>
              <option value="">Toutes</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs space-y-1">
          <span className="text-slate-500">Référence</span>
          <input className="w-full border rounded-lg px-2 py-1.5 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="CMD-PG-…" />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-slate-500">Du</span>
          <input type="date" className="w-full border rounded-lg px-2 py-1.5 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-slate-500">Au</span>
          <input type="date" className="w-full border rounded-lg px-2 py-1.5 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-slate-500">Montant min</span>
          <input type="number" className="w-full border rounded-lg px-2 py-1.5 text-sm" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-slate-500">Montant max</span>
          <input type="number" className="w-full border rounded-lg px-2 py-1.5 text-sm" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="button" onClick={load} className="w-full px-3 py-2 bg-primary text-white rounded-xl text-sm font-semibold">
            Filtrer
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3">{clientMode ? 'Grossiste' : 'Pharmacie cliente'}</th>
              <th className="px-4 py-3">Envoi</th>
              <th className="px-4 py-3">Lignes</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Paiement</th>
              {!clientMode && <th className="px-4 py-3">Email</th>}
              <th className="px-4 py-3">MàJ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`${base}/${o.id}`} className="font-semibold text-primary hover:underline">
                    {o.reference || 'Brouillon'}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div>{clientMode ? o.wholesale_business_name : o.client_business_name}</div>
                  {!clientMode && o.notification_email && (
                    <div className="text-xs text-slate-400">{o.notification_email}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {o.submitted_at ? new Date(o.submitted_at).toLocaleString('fr-FR') : '—'}
                </td>
                <td className="px-4 py-3">{o.items_count}</td>
                <td className="px-4 py-3 font-semibold">{money(o.total_amount, o.currency)}</td>
                <td className="px-4 py-3 text-xs font-bold">{ORDER_STATUS_LABELS[o.status] || o.status}</td>
                <td className="px-4 py-3 text-xs font-semibold">
                  <span className={o.payment_status === 'PAID' ? 'text-emerald-700' : 'text-slate-500'}>
                    {PAYMENT_STATUS_LABELS[o.payment_status] || o.payment_status || 'Non payée'}
                  </span>
                </td>
                {!clientMode && (
                  <td className="px-4 py-3 text-xs">{o.email_status?.label || '—'}</td>
                )}
                <td className="px-4 py-3 text-xs">{new Date(o.updated_at).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Aucune commande</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderDetail({ id, clientMode }) {
  const [order, setOrder] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState('BURUNDIPAY');
  const [payNote, setPayNote] = useState('');
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => wholesaleService.getOrder(id).then(setOrder).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    if (!clientMode) wholesaleService.getRefusalReasons().then(setReasons).catch(() => {});
  }, [id, clientMode]);

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await wholesaleService.acceptOrder(id);
      setOrder(res);
      setAcceptOpen(false);
      setMsg(`Commande acceptée. ${res.email_notification?.label || res.email_status?.label || ''}`);
    } catch (e) {
      setError(e.message || 'Échec acceptation');
    } finally {
      setBusy(false);
    }
  };

  const reject = async (e) => {
    e.preventDefault();
    if (!reason) {
      setError('Le motif de refus est obligatoire.');
      return;
    }
    setBusy(true);
    try {
      const res = await wholesaleService.rejectOrder(id, { reason, comment });
      setOrder(res);
      setRejectOpen(false);
      setMsg('Commande refusée');
    } catch (err) {
      setError(err.message || 'Échec refus');
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await wholesaleService.markOrderPaid(id, {
        payment_method: payMethod,
        payment_note: payNote,
      });
      setOrder(res);
      setPayOpen(false);
      setMsg('Paiement confirmé.');
    } catch (err) {
      setError(err.message || 'Échec marquage payé');
    } finally {
      setBusy(false);
    }
  };

  const markUnpaid = async () => {
    if (!window.confirm('Annuler le marquage « payée » ?')) return;
    setBusy(true);
    try {
      const res = await wholesaleService.markOrderUnpaid(id);
      setOrder(res);
      setMsg('Marquage payé annulé.');
    } catch (err) {
      setError(err.message || 'Échec');
    } finally {
      setBusy(false);
    }
  };

  if (!order) return <div className="p-6 text-slate-500">{error || 'Chargement...'}</div>;

  const canDecide = !clientMode && ['SUBMITTED', 'PROCESSING'].includes(order.status);
  const paymentSettled = order.payment_status === 'PAID';
  const canAccept = canDecide && paymentSettled;
  const canMarkPaid = !clientMode
    && order.payment_status !== 'PAID'
    && ['SUBMITTED', 'PROCESSING', 'ACCEPTED'].includes(order.status);
  const canClearPaid = !clientMode && order.payment_status === 'PAID' && order.status !== 'ACCEPTED';
  const pf = order.proforma;

  return (
    <div className="space-y-4 max-w-4xl">
      <Link to={clientMode ? '/wholesale-pharmacy/client/orders' : '/wholesale-pharmacy/orders'} className="text-sm text-primary">
        ← Retour
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{order.reference || 'Brouillon'}</h1>
          <p className="text-slate-500 text-sm">
            {order.client_business_name} → {order.wholesale_business_name} · {ORDER_STATUS_LABELS[order.status]}
            {' · '}
            <span className={order.payment_status === 'PAID' ? 'text-emerald-700 font-semibold' : ''}>
              {PAYMENT_STATUS_LABELS[order.payment_status] || 'Non payée'}
            </span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {[order.client_contact_name, order.client_email || order.notification_email, order.client_phone]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {(order.payment_method || order.payer_phone) && (
            <p className="text-xs text-slate-500 mt-1">
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
                onClick={() => setAcceptOpen(true)}
                disabled={!canAccept}
                title={!canAccept ? 'L\'acheteur doit d\'abord payer via BurundiPay' : undefined}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold disabled:opacity-40"
              >
                Accepter
              </button>
              <button type="button" onClick={() => setRejectOpen(true)} className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold">
                Refuser
              </button>
            </>
          )}
          {canMarkPaid && (
            <button type="button" onClick={() => setPayOpen(true)} className="px-4 py-2 bg-teal-700 text-white rounded-xl font-semibold">
              {order.status === 'ACCEPTED' ? 'Marquer payée' : 'Confirmer paiement (caisse)'}
            </button>
          )}
          {canClearPaid && (
            <button type="button" onClick={markUnpaid} disabled={busy} className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-sm">
              Annuler marquage payé
            </button>
          )}
        </div>
      </div>
      {canDecide && !paymentSettled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Paiement non validé ({PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}).
          L&apos;acceptation n&apos;est possible qu&apos;après paiement BurundiPay
          {order.payer_phone ? ` (${order.payer_phone})` : ''}.
        </div>
      )}
      {msg && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm">{msg}</div>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

      {order.email_status && (
        <div className="p-3 bg-slate-50 border rounded-xl text-sm">
          Statut email : <strong>{order.email_status.label}</strong>
          {order.email_status.recipient_email && <> · {order.email_status.recipient_email}</>}
          {order.email_status.error_message && (
            <div className="text-red-600 text-xs mt-1">{order.email_status.error_message}</div>
          )}
        </div>
      )}

      {order.status === 'REJECTED' && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm">
          <strong>Motif du refus :</strong> {order.refusal_reason}
          {order.refusal_comment && <div className="mt-1">{order.refusal_comment}</div>}
        </div>
      )}

      {order.payment_status === 'PAID' && (
        <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl text-sm space-y-1">
          <strong>Paiement validé</strong>
          <div>Méthode : {order.payment_method || '—'}</div>
          {order.payer_phone && <div>BurundiPay : {order.payer_phone}</div>}
          {order.paid_at && <div>Le {new Date(order.paid_at).toLocaleString('fr-FR')}</div>}
          {order.payment_note && <div className="text-slate-600">{order.payment_note}</div>}
        </div>
      )}

      {pf && (
        <div className="p-4 bg-white border rounded-xl text-sm flex flex-wrap justify-between gap-2">
          <span>
            Facture proforma <strong>{pf.reference}</strong>
          </span>
          <span className="font-semibold">
            {PROFORMA_STATUS_LABELS[pf.status] || pf.status_label || pf.status}
          </span>
        </div>
      )}

      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Conditionnement</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Qté</th>
              <th className="px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(order.items || []).map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-medium">{i.product_name_snapshot}</td>
                <td className="px-4 py-3">{i.packaging_snapshot}</td>
                <td className="px-4 py-3">{money(i.unit_price_snapshot, order.currency)}</td>
                <td className="px-4 py-3">{i.quantity}</td>
                <td className="px-4 py-3 font-semibold">{money(i.line_total, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t font-bold text-right">Total : {money(order.total_amount, order.currency)}</div>
      </div>

      <div className="bg-white border rounded-2xl p-5">
        <h3 className="font-bold mb-2">Historique</h3>
        {(order.events || []).length === 0 && <p className="text-sm text-slate-500">Aucun historique.</p>}
        <ul className="space-y-2 text-sm">
          {(order.events || []).map((ev) => (
            <li key={ev.id} className="flex justify-between gap-3 border-b pb-2">
              <span><strong>{ev.event_type}</strong> — {ev.message}</span>
              <span className="text-xs text-slate-400">{new Date(ev.created_at).toLocaleString('fr-FR')}</span>
            </li>
          ))}
        </ul>
      </div>

      {acceptOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-bold text-lg">Accepter la commande ?</h3>
            <p className="text-sm text-slate-600">
              {order.reference} — {order.items_count} ligne(s) — {money(order.total_amount, order.currency)}
            </p>
            <p className="text-xs text-slate-500">
              Le stock sera réservé et un email professionnel sera envoyé à la pharmacie cliente.
              L&apos;acceptation est bloquée si le stock est insuffisant.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAcceptOpen(false)} className="px-4 py-2 border rounded-xl">Annuler</button>
              <button type="button" disabled={busy} onClick={accept} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold">
                Confirmer l&apos;acceptation
              </button>
            </div>
          </div>
        </div>
      )}

      {payOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-bold text-lg">Marquer comme payée</h3>
            <p className="text-xs text-slate-500">
              Confirmez le paiement (BurundiPay déjà reçu, espèces, virement…) pour permettre l&apos;acceptation.
              Isoko Hub n&apos;encaisse pas ce montant.
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
              <button type="button" onClick={() => setPayOpen(false)} className="px-4 py-2 border rounded-xl">Annuler</button>
              <button type="button" disabled={busy} onClick={markPaid} className="px-4 py-2 bg-teal-700 text-white rounded-xl font-semibold">
                Confirmer payée
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={reject} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-bold text-lg">Refuser {order.reference}</h3>
            <label className="text-sm block space-y-1">
              <span>Motif *</span>
              <select required className="w-full border rounded-lg px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Choisir...</option>
                {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="text-sm block space-y-1">
              <span>Commentaire</span>
              <textarea rows={3} className="w-full border rounded-lg px-3 py-2" value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectOpen(false)} className="px-4 py-2 border rounded-xl">Annuler</button>
              <button type="submit" disabled={!reason || busy} className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold disabled:opacity-50">
                Confirmer le refus
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
