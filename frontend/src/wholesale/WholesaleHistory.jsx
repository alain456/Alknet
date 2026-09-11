import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import wholesaleService, { ORDER_STATUS_LABELS } from './wholesaleService';

const normalize = (d) => (Array.isArray(d) ? d : d?.results || []);
const money = (n, c = 'BIF') => `${Number(n || 0).toLocaleString('fr-BI')} ${c}`;

/** Historique admin — commandes terminées (acceptées / refusées). */
export default function WholesaleHistory() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    wholesaleService.getOrders()
      .then((d) => setOrders(normalize(d).filter((o) => ['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(o.status))))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Historique</h1>
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
      <div className="bg-white border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/wholesale-pharmacy/orders/${o.id}`} className="font-semibold text-blue-700 hover:underline">
                    {o.reference}
                  </Link>
                </td>
                <td className="px-4 py-3">{o.client_business_name}</td>
                <td className="px-4 py-3 text-xs">{new Date(o.created_at).toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3 font-semibold">{money(o.total_amount, o.currency)}</td>
                <td className="px-4 py-3 text-xs font-bold">{ORDER_STATUS_LABELS[o.status] || o.status}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Aucun historique</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
