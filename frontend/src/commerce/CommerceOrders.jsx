import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, RefreshCw } from 'lucide-react';
import commerceService, { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from './commerceService';
import { useSmartPolling } from '../shared/useSmartPolling';

const money = (n, c = 'BIF') => `${Number(n || 0).toLocaleString('fr-BI')} ${c}`;

const COLUMNS = [
  {
    key: 'pay',
    title: 'À encaisser',
    hint: 'Paiement en attente',
    match: (o) => o.status === 'PENDING' && o.payment_status !== 'PAID' && o.status !== 'REJECTED',
  },
  {
    key: 'prep',
    title: 'À préparer',
    hint: 'Payée — à accepter / préparer',
    match: (o) =>
      (o.status === 'PENDING' && o.payment_status === 'PAID')
      || (o.status === 'CONFIRMED' && o.payment_status === 'PAID'),
  },
  {
    key: 'ready',
    title: 'Prête au retrait',
    hint: 'Client peut venir',
    match: (o) => o.status === 'READY',
  },
  {
    key: 'done',
    title: 'Retirée / close',
    hint: 'Terminées récemment',
    match: (o) => ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.status),
  },
];

function printPickupTicket(order) {
  const items = (order.items || [])
    .map((it) => `<tr>
      <td style="padding:4px 0;border-bottom:1px dashed #ccc">${it.quantity}× ${it.product_name || 'Article'}${it.variant_label ? ` (${it.variant_label})` : ''}</td>
      <td style="padding:4px 0;border-bottom:1px dashed #ccc;text-align:right">${money(Number(it.price_at_time) * Number(it.quantity), order.currency)}</td>
    </tr>`)
    .join('');
  const phone = order.contact_phone || order.guest_phone || '—';
  const name = order.customer_name || order.guest_name || 'Client';
  const ref = order.reference_code || String(order.id).slice(0, 8);
  const when = order.created_at ? new Date(order.created_at).toLocaleString('fr-BI') : '';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Retrait ${ref}</title>
    <style>
      body{font-family:system-ui,sans-serif;padding:16px;max-width:360px;margin:0 auto;color:#111}
      h1{font-size:18px;margin:0 0 4px}
      .muted{color:#555;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
      .total{font-weight:700;font-size:15px;margin-top:10px;display:flex;justify-content:space-between}
      .box{border:2px solid #111;padding:10px;margin:12px 0;text-align:center}
      .ref{font-size:22px;font-weight:800;letter-spacing:1px}
      @media print{button{display:none}}
    </style></head><body>
    <h1>Ticket de retrait</h1>
    <div class="muted">${order.business_name || 'Boutique'} · ${when}</div>
    <div class="box">
      <div class="muted">Référence</div>
      <div class="ref">${ref}</div>
    </div>
    <div><strong>${name}</strong></div>
    <div class="muted">Tél. ${phone}</div>
    ${order.notes ? `<div class="muted" style="margin-top:6px">Note: ${order.notes}</div>` : ''}
    <table>${items}</table>
    <div class="total"><span>Total</span><span>${money(order.total_amount, order.currency)}</span></div>
    <div class="muted" style="margin-top:12px">Paiement: ${PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}</div>
    <p class="muted" style="margin-top:16px">Présenter ce ticket au magasin.</p>
    <script>window.onload=()=>window.print()</script>
  </body></html>`;
  const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=640');
  if (!w) {
    alert('Autorisez les pop-ups pour imprimer le ticket.');
    return;
  }
  w.document.write(html);
  w.document.close();
}

export default function CommerceOrders() {
  const [searchParams] = useSearchParams();
  const highlightCol = searchParams.get('col');
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await commerceService.listOrders();
      setOrders(Array.isArray(data) ? data : data.results || []);
      setError('');
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useSmartPolling(() => load(true), 20000, true);

  const columns = useMemo(() => COLUMNS.map((col) => ({
    ...col,
    items: orders.filter(col.match).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  })), [orders]);

  const act = async (orderId, fn) => {
    setBusyId(orderId);
    setError('');
    try {
      await fn();
      await load(true);
    } catch (e) {
      setError(e.message || 'Action impossible');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Chargement…</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
          <p className="text-sm text-gray-500">File de travail · acceptation si payée · ticket de retrait</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-2 px-3 py-2 border rounded-xl text-sm font-semibold hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {columns.map((col) => (
          <div
            key={col.key}
            className={`bg-gray-50 border rounded-2xl p-3 min-h-[280px] ${
              highlightCol === col.key ? 'ring-2 ring-primary border-primary' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <h2 className="font-bold text-sm text-gray-900">{col.title}</h2>
                <p className="text-[11px] text-gray-500">{col.hint}</p>
              </div>
              <span className="text-xs font-mono bg-white border border-gray-200 rounded-full px-2 py-0.5">
                {col.items.length}
              </span>
            </div>
            <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-0.5">
              {col.items.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  busy={busyId === o.id}
                  onPrint={() => printPickupTicket(o)}
                  onConfirmPay={() => act(o.id, () => commerceService.confirmPaymentManual(o.id))}
                  onAccept={() => act(o.id, () => commerceService.confirmOrder(o.id))}
                  onReject={() => act(o.id, () => commerceService.rejectOrder(o.id, 'Indisponible'))}
                  onReady={() => act(o.id, () => commerceService.markReady(o.id))}
                  onDone={() => act(o.id, () => commerceService.markCompleted(o.id))}
                />
              ))}
              {col.items.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">Aucune commande</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  order: o, busy, onPrint, onConfirmPay, onAccept, onReject, onReady, onDone,
}) {
  const phone = o.contact_phone || o.guest_phone || '—';
  const paid = o.payment_status === 'PAID';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm text-gray-900 truncate">{o.reference_code || o.id.slice(0, 8)}</p>
          <p className="text-xs text-gray-500 truncate">{o.customer_name} · {phone}</p>
        </div>
        <button
          type="button"
          onClick={onPrint}
          className="p-1.5 text-gray-500 hover:text-primary hover:bg-green-50 rounded-lg shrink-0"
          title="Imprimer ticket de retrait"
        >
          <Printer className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
        <span className={`px-1.5 py-0.5 rounded ${paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
          {PAYMENT_STATUS_LABELS[o.payment_status] || o.payment_status}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
          {ORDER_STATUS_LABELS[o.status] || o.status}
        </span>
      </div>

      <p className="text-sm font-semibold text-gray-900">{money(o.total_amount, o.currency)}</p>

      <ul className="text-xs text-gray-600 space-y-0.5 border-t border-dashed pt-2">
        {(o.items || []).slice(0, 4).map((it) => (
          <li key={it.id}>{it.quantity}× {it.product_name || 'Article'}</li>
        ))}
        {(o.items || []).length > 4 && (
          <li className="text-gray-400">+{(o.items || []).length - 4} autre(s)</li>
        )}
      </ul>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {!paid && o.status === 'PENDING' && (
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmPay}
            className="px-2 py-1 text-[11px] border rounded-lg font-semibold disabled:opacity-40"
          >
            Confirmer paiement
          </button>
        )}
        {o.status === 'PENDING' && (
          <>
            <button
              type="button"
              disabled={busy || !paid}
              title={!paid ? 'Paiement requis' : ''}
              onClick={onAccept}
              className="px-2 py-1 text-[11px] bg-primary text-white rounded-lg font-semibold disabled:opacity-40"
            >
              Accepter
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="px-2 py-1 text-[11px] border rounded-lg font-semibold disabled:opacity-40"
            >
              Refuser
            </button>
          </>
        )}
        {o.status === 'CONFIRMED' && (
          <button
            type="button"
            disabled={busy}
            onClick={onReady}
            className="px-2 py-1 text-[11px] bg-amber-500 text-white rounded-lg font-semibold disabled:opacity-40"
          >
            Prête au retrait
          </button>
        )}
        {o.status === 'READY' && (
          <button
            type="button"
            disabled={busy}
            onClick={onDone}
            className="px-2 py-1 text-[11px] bg-green-600 text-white rounded-lg font-semibold disabled:opacity-40"
          >
            Marquer retirée
          </button>
        )}
      </div>
    </div>
  );
}
