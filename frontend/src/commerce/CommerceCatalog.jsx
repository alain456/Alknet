import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, Upload, ImageIcon, X, Pencil, Search, Warehouse,
} from 'lucide-react';
import commerceService from './commerceService';
import { useAuth } from '../context/AuthContext';
import { readImageAsDataUrl } from '../shared/imageUpload';

const money = (n, c = 'BIF') => `${Number(n || 0).toLocaleString('fr-BI')} ${c}`;

const emptyForm = {
  name: '',
  description: '',
  price: '',
  stock: '0',
  sku: '',
  image_url: '',
  is_active: true,
  low_stock_threshold: '5',
};

function stockLabel(p) {
  const avail = Number(p.stock_available ?? p.stock ?? 0);
  const thr = Number(p.low_stock_threshold ?? 5);
  if (p.is_active === false) return { key: 'off', label: 'Inactif' };
  if (avail <= 0) return { key: 'out', label: 'Rupture' };
  if (avail <= thr) return { key: 'low', label: 'Stock faible' };
  return { key: 'in', label: 'Disponible' };
}

export default function CommerceCatalog() {
  const { user } = useAuth();
  const businessId = user?.business_info?.id;
  const fileRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [productModal, setProductModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    commerceService.listProducts()
      .then((data) => setProducts(Array.isArray(data) ? data : data.results || []))
      .catch((e) => setError(e.message || 'Erreur'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      const hay = `${p.name || ''} ${p.sku || ''} ${p.description || ''}`.toLowerCase();
      if (needle && !hay.includes(needle)) return false;
      const st = stockLabel(p);
      if (statusFilter === 'ACTIVE' && p.is_active === false) return false;
      if (statusFilter === 'INACTIVE' && p.is_active !== false) return false;
      if (statusFilter === 'OUT' && st.key !== 'out') return false;
      return true;
    });
  }, [products, q, statusFilter]);

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError('');
    setUploading(true);
    try {
      const dataUrl = await readImageAsDataUrl(file, { maxSize: 900, quality: 0.8 });
      setForm((prev) => ({ ...prev, image_url: dataUrl }));
    } catch (err) {
      setImageError(err.message || 'Image invalide');
    } finally {
      setUploading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageError('');
    setProductModal(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      description: p.description || '',
      price: String(p.price ?? ''),
      stock: String(p.stock ?? 0),
      sku: p.sku || '',
      image_url: (p.image_urls || [])[0] || '',
      is_active: p.is_active !== false,
      low_stock_threshold: String(p.low_stock_threshold ?? 5),
    });
    setImageError('');
    setProductModal(true);
  };

  const closeProductModal = () => {
    setProductModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setImageError('');
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    if (!businessId && !editingId) {
      setError('Boutique introuvable. Reconnectez-vous.');
      return;
    }
    setBusy(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price,
      sku: form.sku.trim(),
      image_urls: form.image_url ? [form.image_url] : [],
      is_active: form.is_active,
      low_stock_threshold: Number(form.low_stock_threshold) || 5,
    };
    // Stock initial uniquement à la création — les ajustements passent par /commerce/inventory
    if (!editingId) {
      payload.stock = Number(form.stock) || 0;
      payload.business = businessId;
    }
    try {
      if (editingId) {
        await commerceService.updateProduct(editingId, payload);
        setMessage('Produit mis à jour');
      } else {
        await commerceService.createProduct(payload);
        setMessage('Produit créé — gérez les quantités dans Stock');
      }
      closeProductModal();
      load();
    } catch (err) {
      setError(err.message || (editingId ? 'Mise à jour impossible' : 'Création impossible'));
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (id) => {
    if (!confirm('Supprimer définitivement ce produit ?')) return;
    try {
      await commerceService.deleteProduct(id);
      setMessage('Produit supprimé');
      load();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Chargement…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalogue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Fiches produits (nom, prix, photo). Les quantités se gèrent dans{' '}
            <Link to="/commerce/inventory" className="text-primary font-semibold underline">Stock</Link>.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold shrink-0"
        >
          <Plus className="w-4 h-4" /> Nouveau produit
        </button>
      </div>

      {message && (
        <div className="p-3 bg-green-50 text-emerald-700 rounded-xl text-sm flex justify-between gap-2">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="underline shrink-0">OK</button>
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="underline shrink-0">Fermer</button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher nom, SKU…"
            className="flex-1 outline-none text-sm bg-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
        >
          <option value="ALL">Tous</option>
          <option value="ACTIVE">Actifs</option>
          <option value="INACTIVE">Inactifs</option>
          <option value="OUT">En rupture</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Disponibilité</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p) => {
              const thumb = (p.image_urls || [])[0];
              const st = stockLabel(p);
              return (
                <tr key={p.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-[220px]">
                      {thumb
                        ? <img src={thumb} alt="" className="w-14 h-12 rounded-lg object-cover border border-gray-200 shrink-0" />
                        : (
                          <div className="w-14 h-12 rounded-lg bg-green-50 text-primary flex items-center justify-center shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      <div>
                        <div className="font-semibold text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-500">
                          {[p.sku, p.shop_category_name].filter(Boolean).join(' · ') || 'Article boutique'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{money(p.effective_price || p.price, p.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${
                      st.key === 'in' ? 'text-emerald-700'
                        : st.key === 'low' ? 'text-amber-700'
                          : st.key === 'out' ? 'text-red-600' : 'text-gray-500'
                    }`}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {p.stock_available ?? p.stock}
                    <div className="text-[11px] text-gray-400">seuil {p.low_stock_threshold ?? 5}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => openEdit(p)} className="p-2 hover:bg-green-50 rounded-lg text-primary" title="Modifier la fiche">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => removeProduct(p.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  Aucun produit. Créez le premier article du catalogue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-dashed border-gray-200 rounded-xl px-4 py-3">
        <Warehouse className="w-4 h-4 text-primary" />
        Pour entrer / sortir / corriger une quantité, ouvrez{' '}
        <Link to="/commerce/inventory" className="text-primary font-semibold underline">Stock</Link>.
      </div>

      {productModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={saveProduct} className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto relative">
            <button
              type="button"
              onClick={closeProductModal}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-900 pr-8">
                {editingId ? 'Modifier le produit' : 'Nouveau produit'}
              </h2>
              <p className="text-sm text-gray-500">Informations catalogue client.</p>
            </div>

            <div className="flex gap-3 items-start">
              <div className="w-24 h-24 rounded-xl border border-dashed border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                {form.image_url
                  ? <img src={form.image_url} alt="Aperçu" className="w-full h-full object-cover" />
                  : <ImageIcon className="w-8 h-8 text-gray-300" />}
              </div>
              <div className="flex-1 space-y-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/jpg" className="hidden" onChange={pickImage} />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Compression…' : 'Choisir une image'}
                </button>
                {form.image_url && (
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, image_url: '' }))} className="block text-xs text-red-600 underline">
                    Retirer l&apos;image
                  </button>
                )}
                {imageError && <p className="text-xs text-red-600">{imageError}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Ex: Chemise lin beige" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={3} placeholder="Détails visibles en boutique…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix (BIF) *</label>
                <input required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Réf. interne" />
              </div>
              {!editingId ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock initial</label>
                  <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                  <p className="text-[11px] text-gray-400 mt-1">Ensuite : page Stock.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock actuel</label>
                  <div className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-600">
                    {form.stock}
                    {' '}
                    <Link to="/commerce/inventory" className="text-primary text-xs underline ml-1">Ajuster →</Link>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seuil stock faible</label>
                <input type="number" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            {editingId && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Produit visible / actif dans la boutique
              </label>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={closeProductModal} className="px-4 py-2 border rounded-lg">Annuler</button>
              <button type="submit" disabled={busy || uploading} className="px-4 py-2 bg-primary text-white rounded-lg font-semibold disabled:opacity-60">
                {busy ? 'Enregistrement…' : (editingId ? 'Enregistrer' : 'Créer')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
