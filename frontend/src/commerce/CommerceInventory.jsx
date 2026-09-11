import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Package } from 'lucide-react';
import commerceService from './commerceService';

const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);
const dateTime = (value) => (value ? new Date(value).toLocaleString('fr-BI') : '—');

const MOVEMENT_LABELS = {
  IN: 'Entrée',
  OUT: 'Sortie',
  ADJUST: 'Ajustement',
  SALE: 'Vente',
  CANCEL: 'Annulation',
};

function stockStatus(p) {
  const avail = Number(p.stock_available ?? p.stock ?? 0);
  const thr = Number(p.low_stock_threshold ?? 5);
  if (avail <= 0) return { key: 'OUT_OF_STOCK', label: 'Rupture' };
  if (avail <= thr) return { key: 'LOW_STOCK', label: 'Stock faible' };
  return { key: 'AVAILABLE', label: 'Disponible' };
}

export default function CommerceInventory() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('ADJUST'); // ADJUST | IN | OUT
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('Correction stock');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setError('');
      const [productData, movementData] = await Promise.all([
        commerceService.listProducts(),
        commerceService.listStockMovements(),
      ]);
      setProducts(normalize(productData));
      setMovements(normalize(movementData));
    } catch (err) {
      setError(err.message || 'Impossible de charger le stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) => `${p.name || ''} ${p.sku || ''}`.toLowerCase().includes(needle));
  }, [products, q]);

  const openAdjust = (product) => {
    setSelected(product);
    setMode('ADJUST');
    setQuantity(product.stock_available ?? product.stock ?? 0);
    setReason('Correction stock');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const qty = Number(quantity);
      if (Number.isNaN(qty) || qty < 0) {
        throw new Error('Quantité invalide');
      }
      await commerceService.createStockMovement({
        product: selected.id,
        movement_type: mode,
        quantity: qty,
        note: reason.trim() || (mode === 'ADJUST' ? 'Correction stock' : ''),
      });
      setSelected(null);
      setMessage(mode === 'ADJUST' ? 'Stock ajusté' : mode === 'IN' ? 'Entrée enregistrée' : 'Sortie enregistrée');
      await load();
    } catch (err) {
      setError(err.message || 'Échec de l’opération stock');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Chargement…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
        <p className="text-sm text-gray-500">
          Mêmes produits que le{' '}
          <Link to="/commerce/catalog" className="text-primary font-semibold underline">catalogue</Link>
          {' '}— ici vous ajustez les quantités et consultez l&apos;historique.
        </p>
      </div>

      {message && <div className="p-3 bg-green-50 text-emerald-700 rounded-xl text-sm">{message}</div>}
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}

      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 max-w-md">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer un produit…"
          className="flex-1 outline-none text-sm"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Disponible</th>
              <th className="px-4 py-3">Seuil</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((product) => {
              const st = stockStatus(product);
              const avail = product.stock_available ?? product.stock ?? 0;
              return (
                <tr key={product.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3 font-semibold">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400 shrink-0" />
                      <div>
                        {product.name}
                        {!product.is_active && (
                          <span className="ml-2 text-[10px] uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Inactif</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{product.sku || '—'}</td>
                  <td className="px-4 py-3 font-bold">{avail}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{product.low_stock_threshold ?? 5}</td>
                  <td className="px-4 py-3 text-xs font-bold">
                    <span className={
                      st.key === 'AVAILABLE' ? 'text-emerald-700'
                        : st.key === 'LOW_STOCK' ? 'text-amber-700' : 'text-red-600'
                    }
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openAdjust(product)}
                      className="text-primary font-semibold text-xs hover:underline"
                    >
                      Ajuster
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  Aucun produit. Créez-en d&apos;abord dans le{' '}
                  <Link to="/commerce/catalog" className="text-primary underline">catalogue</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="font-bold mb-3">Mouvements de stock</h2>
        <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto text-sm">
          {movements.map((movement) => {
            const qty = Number(movement.quantity);
            const type = movement.movement_type;
            let qtyLabel = String(qty);
            if (type === 'IN' || type === 'CANCEL') qtyLabel = `+${Math.abs(qty)}`;
            else if (type === 'OUT' || type === 'SALE') qtyLabel = `-${Math.abs(qty)}`;
            else if (type === 'ADJUST') qtyLabel = `→ ${qty}`;
            return (
              <li key={movement.id} className="py-2 flex justify-between gap-3">
                <div>
                  <div className="font-medium">{movement.product_name}</div>
                  <div className="text-xs text-gray-500">
                    {MOVEMENT_LABELS[type] || type}
                    {movement.note ? ` · ${movement.note}` : ''}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-semibold">{qtyLabel}</div>
                  <div className="text-gray-400">{dateTime(movement.created_at)}</div>
                </div>
              </li>
            );
          })}
          {movements.length === 0 && <li className="text-gray-500 py-4">Aucun mouvement.</li>}
        </ul>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-lg">Stock — {selected.name}</h2>
            <p className="text-xs text-gray-500">
              Disponible actuel : <strong>{selected.stock_available ?? selected.stock ?? 0}</strong>
            </p>

            <div className="flex gap-2">
              {[
                { key: 'ADJUST', label: 'Ajuster (valeur)' },
                { key: 'IN', label: 'Entrée (+)' },
                { key: 'OUT', label: 'Sortie (−)' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setMode(opt.key);
                    if (opt.key === 'ADJUST') {
                      setQuantity(selected.stock_available ?? selected.stock ?? 0);
                      setReason('Correction stock');
                    } else {
                      setQuantity(1);
                      setReason(opt.key === 'IN' ? 'Réapprovisionnement' : 'Sortie stock');
                    }
                  }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold border ${
                    mode === opt.key ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="text-sm block space-y-1">
              <span>{mode === 'ADJUST' ? 'Nouvelle quantité' : 'Quantité'}</span>
              <input
                required
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </label>
            <label className="text-sm block space-y-1">
              <span>Motif</span>
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setSelected(null)} className="px-4 py-2 border rounded-xl">Annuler</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
