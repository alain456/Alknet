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
  purchase_price: '',
  price: '',
  stock: '0',
  sku: '',
  category_name: '',
  image_url: '',
  is_active: true,
  low_stock_threshold: '5',
  colors: [],
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
  const [shopCategories, setShopCategories] = useState([]);

  const load = () => {
    setLoading(true);
    Promise.all([
      commerceService.listProducts(),
      commerceService.listShopCategories().catch(() => []),
    ])
      .then(([data, cats]) => {
        setProducts(Array.isArray(data) ? data : data.results || []);
        setShopCategories(Array.isArray(cats) ? cats : cats.results || []);
      })
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

  const pickColorImage = async (index, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageError('');
    setUploading(true);
    try {
      const dataUrl = await readImageAsDataUrl(file, { maxSize: 900, quality: 0.8 });
      setForm((prev) => ({
        ...prev,
        colors: prev.colors.map((row, at) => (at === index ? { ...row, image_url: dataUrl } : row)),
      }));
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
      purchase_price: String(p.purchase_price ?? ''),
      price: String(p.price ?? ''),
      stock: String(p.stock ?? 0),
      sku: p.sku || '',
      category_name: p.shop_category_name || '',
      image_url: (p.image_urls || [])[0] || '',
      is_active: p.is_active !== false,
      low_stock_threshold: String(p.low_stock_threshold ?? 5),
      colors: (p.variant_rows || [])
        .filter((row) => String(row.color || '').trim())
        .map((row) => ({
          id: row.id,
          color: row.color,
          stock: String(row.stock ?? 0),
          image_url: row.image_url || '',
        })),
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
    try {
      const categoryName = form.category_name.trim();
      let shopCategoryId = null;
      if (categoryName) {
        const known = shopCategories.find(
          (row) => String(row.name || '').trim().toLowerCase() === categoryName.toLowerCase(),
        );
        if (known) {
          shopCategoryId = known.id;
        } else {
          const created = await commerceService.createShopCategory({ name: categoryName });
          shopCategoryId = created.id;
          setShopCategories((prev) => [...prev, created]);
        }
      }
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        purchase_price: form.purchase_price,
        price: form.price,
        sku: form.sku.trim(),
        shop_category: shopCategoryId,
        image_urls: form.image_url ? [form.image_url] : [],
        is_active: form.is_active,
        low_stock_threshold: Number(form.low_stock_threshold) || 5,
      };
      if (!editingId) {
        payload.stock = Number(form.stock) || 0;
        payload.business = businessId;
      }
      let productId = editingId;
      if (editingId) {
        await commerceService.updateProduct(editingId, payload);
      } else {
        const created = await commerceService.createProduct(payload);
        productId = created.id;
      }
      const previous = editingId
        ? (products.find((item) => item.id === editingId)?.variant_rows || [])
          .filter((row) => String(row.color || '').trim())
          .map((row) => row.id)
        : [];
      const kept = new Set();
      for (const color of form.colors) {
        const name = color.color.trim();
        if (!name) continue;
        const body = {
          product: productId,
          color: name,
          size: '',
          stock: Number(color.stock) || 0,
          image_url: color.image_url || '',
          is_active: true,
        };
        if (color.id) {
          const { stock: _stock, ...colorUpdate } = body;
          await commerceService.updateVariant(color.id, colorUpdate);
          kept.add(color.id);
        } else {
          const createdColor = await commerceService.createVariant(body);
          kept.add(createdColor.id);
        }
      }
      for (const id of previous) {
        if (!kept.has(id)) await commerceService.deleteVariant(id);
      }
      setMessage(editingId ? 'Produit mis à jour' : 'Produit créé');
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
                      <button type="button" onClick={() => openEdit(p)} className="icon-btn" title="Modifier la fiche">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => removeProduct(p.id)} className="icon-btn icon-btn--danger" title="Supprimer">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <input
                value={form.category_name}
                onChange={(e) => setForm({ ...form, category_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Ex. Téléphones"
                list="shop-categories"
              />
              <datalist id="shop-categories">
                {shopCategories.map((row) => (
                  <option key={row.id} value={row.name} />
                ))}
              </datalist>
              <p className="text-[11px] text-gray-400 mt-1">Affichée sur la fiche à la place du tiret.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={3} placeholder="Détails visibles en boutique…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix d’achat (BIF) *</label>
                <input required type="number" min="0" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (BIF) *</label>
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
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-gray-700">Couleurs</label>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({
                    ...prev,
                    colors: [...prev.colors, { id: '', color: '', stock: '0', image_url: '' }],
                  }))}
                  className="text-sm font-semibold text-primary"
                >
                  Ajouter une couleur
                </button>
              </div>
              <p className="text-[11px] text-gray-400">Chaque couleur a sa photo et son stock. Le client les fait défiler sur la fiche.</p>
              {form.colors.map((color, index) => (
                <div key={color.id || `new-${index}`} className="grid grid-cols-[72px_1fr_88px_auto] gap-2 items-center">
                  <label className="h-16 rounded-lg border border-dashed border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center cursor-pointer">
                    {color.image_url
                      ? <img src={color.image_url} alt="" className="w-full h-full object-cover" />
                      : <ImageIcon className="w-5 h-5 text-gray-300" />}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/jpg" className="hidden" onChange={(event) => pickColorImage(index, event)} />
                  </label>
                  <input
                    value={color.color}
                    onChange={(event) => setForm((prev) => ({
                      ...prev,
                      colors: prev.colors.map((row, at) => (at === index ? { ...row, color: event.target.value } : row)),
                    }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Nom de la couleur"
                  />
                  <input
                    type="number"
                    min="0"
                    value={color.stock}
                    disabled={Boolean(color.id)}
                    onChange={(event) => setForm((prev) => ({
                      ...prev,
                      colors: prev.colors.map((row, at) => (at === index ? { ...row, stock: event.target.value } : row)),
                    }))}
                    className="w-full border rounded-lg px-2 py-2 text-sm disabled:bg-gray-100"
                    title={color.id ? 'Stock ajusté depuis la page Stock' : 'Stock'}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, colors: prev.colors.filter((_, at) => at !== index) }))}
                    className="text-red-600 p-1"
                    aria-label="Retirer la couleur"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
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
