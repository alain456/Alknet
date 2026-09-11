import React, { useEffect, useState } from 'react';
import wholesaleService, { STOCK_STATUS_LABELS } from './wholesaleService';

const normalize = (d) => (Array.isArray(d) ? d : d?.results || []);

export default function WholesaleInventory() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('Correction stock');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [p, m] = await Promise.all([
      wholesaleService.getProducts(),
      wholesaleService.getStockMovements(),
    ]);
    setProducts(normalize(p));
    setMovements(normalize(m));
  };

  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await wholesaleService.adjustStock(selected.id, { quantity_real: Number(qty), reason });
      setMsg('Stock mis à jour');
      setSelected(null);
      load();
    } catch (err) {
      setError(err.message || 'Échec');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stock</h1>
      {msg && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm">{msg}</div>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

      <div className="bg-white border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Réel</th>
              <th className="px-4 py-3">Réservé</th>
              <th className="px-4 py-3">Disponible</th>
              <th className="px-4 py-3">Lot / Exp.</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-semibold">{p.name}<div className="text-xs text-slate-500">{p.packaging}</div></td>
                <td className="px-4 py-3">{p.quantity_real}</td>
                <td className="px-4 py-3">{p.quantity_reserved}</td>
                <td className="px-4 py-3 font-bold">{p.quantity_available}</td>
                <td className="px-4 py-3 text-xs">{p.batch_number || '—'}<br />{p.expiration_date || '—'}</td>
                <td className="px-4 py-3 text-xs font-bold">{STOCK_STATUS_LABELS[p.stock_status] || p.stock_status}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="text-blue-700 font-semibold text-xs" onClick={() => { setSelected(p); setQty(p.quantity_real); }}>
                    Ajuster
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border rounded-2xl p-5">
        <h3 className="font-bold mb-3">Mouvements de stock</h3>
        <ul className="divide-y max-h-80 overflow-y-auto text-sm">
          {movements.map((m) => (
            <li key={m.id} className="py-2 flex justify-between gap-3">
              <div>
                <div className="font-medium">{m.product_name}</div>
                <div className="text-xs text-slate-500">{m.reason} · {m.user_email || '—'}</div>
              </div>
              <div className="text-right text-xs">
                <div>{m.old_quantity} → {m.new_quantity} ({m.difference > 0 ? '+' : ''}{m.difference})</div>
                <div className="text-slate-400">{new Date(m.created_at).toLocaleString('fr-FR')}</div>
              </div>
            </li>
          ))}
          {movements.length === 0 && <li className="text-slate-500 py-4">Aucun mouvement.</li>}
        </ul>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={save} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-bold">Ajuster — {selected.name}</h3>
            <label className="text-sm block space-y-1">
              <span>Nouvelle quantité réelle</span>
              <input type="number" min="0" className="w-full border rounded-lg px-3 py-2" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label className="text-sm block space-y-1">
              <span>Motif</span>
              <input className="w-full border rounded-lg px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="px-4 py-2 border rounded-xl">Annuler</button>
              <button type="submit" className="px-4 py-2 bg-blue-700 text-white rounded-xl font-semibold">Confirmer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
