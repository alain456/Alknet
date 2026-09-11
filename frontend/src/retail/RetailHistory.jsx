import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import retailService, { ORDER_STATUS_LABELS } from './retailService';

const CLOSED_STATUSES = ['ACCEPTED', 'REJECTED', 'CANCELLED'];
const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);
const money = (value, currency = 'BIF') => `${Number(value || 0).toLocaleString('fr-BI')} ${currency}`;

export default function RetailHistory() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    retailService.getOrders()
      .then((data) => setOrders(normalize(data).filter((order) => CLOSED_STATUSES.includes(order.status))))
      .catch((err) => setError(err.message || 'Impossible de charger l’historique'));
  }, []);

  const filtered = useMemo(
    () => orders.filter((order) => !status || order.status === status),
    [orders, status],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Historique</h1>
          <p className="text-sm text-ink-muted">Commandes acceptées, refusées ou annulées.</p>
        </div>
        <label className="text-xs space-y-1 min-w-[220px]">
          <span className="text-ink-muted">Statut</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">Tous les statuts</option>
            {CLOSED_STATUSES.map((key) => <option key={key} value={key}>{ORDER_STATUS_LABELS[key]}</option>)}
          </select>
        </label>
      </div>
      {error && <div className="p-3 bg-red-50 text-error rounded-xl text-sm">{error}</div>}

      <div className="bg-white border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper text-xs uppercase text-ink-muted text-left">
            <tr>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((order) => (
              <tr key={order.id} className="hover:bg-paper/80">
                <td className="px-4 py-3">
                  <Link to={`/retail-pharmacy/orders/${order.id}`} className="font-semibold text-primary hover:underline">{order.reference}</Link>
                </td>
                <td className="px-4 py-3">
                  <div>{order.patient_name || '—'}</div>
                  <div className="text-xs text-ink-muted">{order.patient_email || '—'}</div>
                </td>
                <td className="px-4 py-3 text-xs">{new Date(order.created_at).toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3 font-semibold">{money(order.total_amount, order.currency)}</td>
                <td className="px-4 py-3 text-xs font-bold">{ORDER_STATUS_LABELS[order.status] || order.status}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-muted">Aucun historique</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
