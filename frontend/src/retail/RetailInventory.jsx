import React, { useEffect, useState } from 'react';
import retailService, { STOCK_STATUS_LABELS } from './retailService';

const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);
const dateTime = (value) => (value ? new Date(value).toLocaleString('fr-FR') : '—');

export default function RetailInventory() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('Correction stock');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError('');
      const [productData, movementData] = await Promise.all([
        retailService.getProducts(),
        retailService.getStockMovements(),
      ]);
      setProducts(normalize(productData));
      setMovements(normalize(movementData));
    } catch (err) {
      setError(err.message || 'Impossible de charger le stock');
    }
  };
  useEffect(() => { load(); }, []);

  const adjust = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await retailService.adjustStock(selected.id, {
        quantity_real: Number(quantity),
        reason: reason.trim(),
      });
      setSelected(null);
      setMessage('Stock mis à jour');
      await load();
    } catch (err) {
      setError(err.message || 'Échec de l’ajustement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Stock</h1>
        <p className="text-sm text-ink-muted">Quantités disponibles, lots et mouvements.</p>
      </div>
      {message && <div className="p-3 bg-green-50 text-success rounded-xl text-sm">{message}</div>}
      {error && <div className="p-3 bg-red-50 text-error rounded-xl text-sm">{error}</div>}

      <div className="bg-white border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper text-xs uppercase text-ink-muted text-left">
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
          <tbody className="divide-y divide-border">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-paper/80">
                <td className="px-4 py-3 font-semibold">
                  {product.name}
                  <div className="text-xs text-ink-muted">{product.sales_unit || product.packaging}</div>
                </td>
                <td className="px-4 py-3">{product.quantity_real}</td>
                <td className="px-4 py-3">{product.quantity_reserved}</td>
                <td className="px-4 py-3 font-bold">{product.quantity_available}</td>
                <td className="px-4 py-3 text-xs">{product.batch_number || '—'}<br />{product.expiration_date || '—'}</td>
                <td className="px-4 py-3 text-xs font-bold">{STOCK_STATUS_LABELS[product.stock_status] || product.stock_status}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => { setSelected(product); setQuantity(product.quantity_real); setReason('Correction stock'); }} className="text-primary font-semibold text-xs">Ajuster</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-muted">Aucun produit</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5">
        <h2 className="font-bold mb-3">Mouvements de stock</h2>
        <ul className="divide-y divide-border max-h-80 overflow-y-auto text-sm">
          {movements.map((movement) => (
            <li key={movement.id} className="py-2 flex justify-between gap-3">
              <div>
                <div className="font-medium">{movement.product_name}</div>
                <div className="text-xs text-ink-muted">{movement.reason} · {movement.user_email || '—'}</div>
              </div>
              <div className="text-right text-xs">
                <div>{movement.old_quantity} → {movement.new_quantity} ({movement.difference > 0 ? '+' : ''}{movement.difference})</div>
                <div className="text-ink-faint">{dateTime(movement.created_at)}</div>
              </div>
            </li>
          ))}
          {movements.length === 0 && <li className="text-ink-muted py-4">Aucun mouvement.</li>}
        </ul>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={adjust} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-lg">Ajuster — {selected.name}</h2>
            <p className="text-xs text-ink-muted">Stock actuel : {selected.quantity_real} · réservé : {selected.quantity_reserved}</p>
            <label className="text-sm block space-y-1">
              <span>Nouvelle quantité réelle</span>
              <input required type="number" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm block space-y-1">
              <span>Motif</span>
              <input required value={reason} onChange={(event) => setReason(event.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="px-4 py-2 border border-border rounded-xl">Annuler</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary hover:bg-secondary text-white rounded-xl font-semibold disabled:opacity-50">{saving ? 'Enregistrement…' : 'Confirmer'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
