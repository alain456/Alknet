import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import wholesaleService, { PROFORMA_STATUS_LABELS } from './wholesaleService';

const money = (n, c = 'BIF') => `${Number(n || 0).toLocaleString('fr-BI')} ${c}`;

export default function WholesaleProforma() {
  const [list, setList] = useState([]);
  const [carts, setCarts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      wholesaleService.getProformas().catch(() => []),
      wholesaleService.getCart().catch(() => []),
    ])
      .then(([proformas, cartData]) => {
        setList(Array.isArray(proformas) ? proformas : []);
        setCarts(Array.isArray(cartData) ? cartData : cartData?.results || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const draftFromCart = carts
    .filter((c) => (c.items || []).length > 0 && c.proforma)
    .map((c) => c.proforma);

  const drafts = draftFromCart.length
    ? draftFromCart
    : list.filter((p) => p.status === 'DRAFT');
  const history = list.filter((p) => p.status !== 'DRAFT' && p.status !== 'CANCELLED');

  if (loading) return <div className="p-6 text-slate-500">Chargement des factures proforma…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facture proforma</h1>
        <p className="text-sm text-slate-500">
          Document recalculé automatiquement avec le panier.
        </p>
      </div>
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

      <section className="space-y-3">
        <h2 className="font-bold text-lg">Brouillons actifs</h2>
        {drafts.length === 0 && (
          <div className="bg-white border rounded-2xl p-8 text-center text-slate-500">
            Aucune proforma en brouillon.{' '}
            <Link to="/wholesale-pharmacy/client/catalog" className="text-primary font-semibold">
              Parcourir le catalogue
            </Link>
          </div>
        )}
        {drafts.map((pf) => (
          <ProformaCard key={pf.id || pf.reference} pf={pf} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold text-lg">Historique</h2>
        {history.length === 0 && (
          <p className="text-sm text-slate-500">Aucun historique.</p>
        )}
        {history.map((pf) => (
          <ProformaCard key={pf.id} pf={pf} showOrderLink />
        ))}
      </section>
    </div>
  );
}

function ProformaCard({ pf, showOrderLink }) {
  const status = pf.status || 'DRAFT';
  const isConfirmed = status === 'CONFIRMED';
  return (
    <div className={`bg-white border rounded-2xl p-5 ${isConfirmed ? 'border-emerald-200' : ''}`}>
      <div className="flex flex-wrap justify-between gap-2 mb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">
            {isConfirmed ? 'Facture confirmée' : 'Facture proforma'}
          </div>
          <div className="font-bold">{pf.reference || '—'}</div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border h-fit ${
          status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
            : status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-100'
              : 'bg-amber-50 text-amber-800 border-amber-100'
        }`}
        >
          {PROFORMA_STATUS_LABELS[status] || status}
        </span>
      </div>
      <dl className="grid sm:grid-cols-2 gap-2 text-sm mb-4">
        <div><span className="text-slate-500">Grossiste :</span> {pf.wholesale_business_name}</div>
        <div><span className="text-slate-500">Client :</span> {pf.client_business_name}</div>
        <div>
          <span className="text-slate-500">Date :</span>{' '}
          {pf.generated_at ? new Date(pf.generated_at).toLocaleString('fr-FR') : '—'}
        </div>
        {pf.order_reference && (
          <div><span className="text-slate-500">Commande :</span> {pf.order_reference}</div>
        )}
      </dl>
      <table className="w-full text-sm mb-3">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-400 border-b">
            <th className="py-2">Produit</th>
            <th className="py-2">Cond.</th>
            <th className="py-2 text-right">Qté</th>
            <th className="py-2 text-right">Prix</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {(pf.lines_snapshot || []).map((line, i) => (
            <tr key={i} className="border-b border-slate-50">
              <td className="py-2">{line.product_name}</td>
              <td className="py-2 text-slate-500">{line.packaging}</td>
              <td className="py-2 text-right">{line.quantity}</td>
              <td className="py-2 text-right">{money(line.unit_price, pf.currency)}</td>
              <td className="py-2 text-right font-medium">{money(line.line_total, pf.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span>{money(pf.total, pf.currency)}</span>
      </div>
      <div className="flex gap-3 mt-4 text-sm">
        <Link to="/wholesale-pharmacy/client/cart" className="text-primary font-semibold hover:underline">
          Voir le panier
        </Link>
        {showOrderLink && pf.order && (
          <Link
            to={`/wholesale-pharmacy/client/orders/${pf.order}`}
            className="text-primary font-semibold hover:underline"
          >
            Voir la commande
          </Link>
        )}
      </div>
    </div>
  );
}
