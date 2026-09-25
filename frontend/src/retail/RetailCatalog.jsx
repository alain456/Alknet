import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Pencil, Plus, Search, ShoppingCart, Upload, X } from 'lucide-react';
import retailService, { STOCK_STATUS_LABELS } from './retailService';

const UNITS = ['Boîte', 'Flacon', 'Tube', 'Ampoule', 'Unité', 'Sachet'];
const ROUTES = ['Orale', 'Injectable', 'Topique', 'Rectale', 'Oculaire', 'Nasale', 'Inhalation', 'Autre'];
const THERAPEUTIC = [
  'Antidouleur', 'Antibiotique', 'Vitamines', 'Antipaludéen', 'Anti-inflammatoire',
  'Chronique', 'Premiers secours', 'Soins de la peau', 'Gastro-entérologie', 'Autre',
];
const emptyForm = {
  name: '',
  therapeutic_class: 'Antidouleur',
  dosage: '',
  administration_route: 'Orale',
  expiration_date: '',
  sales_unit: 'Boîte',
  retail_price: '',
  quantity_real: 0,
  prescription_required: false,
  image_url: '',
};
const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);
const money = (value, currency = 'BIF') => `${Number(value || 0).toLocaleString('fr-BI')} ${currency}`;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type.startsWith('image/')) return reject(new Error('Fichier image requis (JPG, PNG, WebP)'));
    if (file.size > 2.5 * 1024 * 1024) return reject(new Error('Image trop lourde (max 2,5 Mo)'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Image invalide'));
      image.onload = () => {
        const scale = Math.min(1, 800 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Compression impossible'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function RetailCatalog({ clientMode = false }) {
  const [products, setProducts] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [pharmacy, setPharmacy] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const params = clientMode ? { public: true, ...(pharmacy ? { pharmacy } : {}) } : {};
      setProducts(normalize(await retailService.getProducts(params)));
    } catch (err) {
      setProducts([]);
      setError(err.message || 'Impossible de charger le catalogue');
    }
  }, [clientMode, pharmacy]);

  useEffect(() => {
    if (clientMode) retailService.listPharmacies().then(setPharmacies).catch(() => setPharmacies([]));
  }, [clientMode]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => products.filter((product) => {
    const haystack = `${product.name} ${product.therapeutic_class || ''} ${product.dosage || ''} ${product.administration_route || ''}`.toLowerCase();
    return (!q || haystack.includes(q.toLowerCase()))
      && (status === 'ALL' || product.status === status || product.stock_status === status);
  }), [products, q, status]);

  const edit = (product) => {
    setEditingId(product.id);
    setForm({
      ...emptyForm,
      ...product,
      expiration_date: product.expiration_date || '',
      image_url: product.image_url || '',
      prescription_required: Boolean(product.prescription_required),
    });
    setError('');
    setOpen(true);
  };

  const pickImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const imageUrl = await compressImage(file);
      setForm((current) => ({ ...current, image_url: String(imageUrl) }));
    } catch (err) {
      setError(err.message || 'Téléversement impossible');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        packaging: form.sales_unit,
        retail_price: Number(form.retail_price),
        quantity_real: Number(form.quantity_real || 0),
        prescription_required: Boolean(form.prescription_required),
        currency: 'BIF',
        status: form.status || 'ACTIVE',
      };
      if (!payload.expiration_date) delete payload.expiration_date;
      if (editingId) await retailService.updateProduct(editingId, payload);
      else await retailService.createProduct(payload);
      setOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      setMessage('Produit enregistré');
      await load();
    } catch (err) {
      setError(err.message || 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const addToCart = async (product) => {
    try {
      await retailService.addToCart({ product_id: product.id, quantity: 1 });
      setMessage(`${product.name} ajouté au panier`);
    } catch (err) {
      setError(err.message || 'Ajout au panier impossible');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{clientMode ? 'Catalogue des pharmacies' : 'Catalogue'}</h1>
          <p className="text-sm text-ink-muted">Médicaments, unités de vente et prix au détail</p>
        </div>
        {!clientMode && (
          <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setOpen(true); setError(''); }} className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-secondary text-white rounded-xl font-semibold">
            <Plus className="w-4 h-4" /> Nouveau produit
          </button>
        )}
      </div>

      {message && <div className="p-3 bg-green-50 text-success rounded-xl text-sm">{message}</div>}
      {error && !open && <div className="p-3 bg-red-50 text-error rounded-xl text-sm">{error}</div>}

      <div className="flex flex-wrap gap-3">
        {clientMode && (
          <select value={pharmacy} onChange={(event) => setPharmacy(event.target.value)} className="px-3 py-2 border border-border rounded-xl text-sm bg-white">
            <option value="">Toutes les pharmacies</option>
            {pharmacies.map((item) => <option key={item.id} value={item.id}>{item.commercial_name || item.name}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-ink-faint" />
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Nom, classe, dosage, voie…" className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-sm" />
        </div>
        {!clientMode && (
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="px-3 py-2 border border-border rounded-xl text-sm bg-white">
            <option value="ALL">Tous statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
            <option value="OUT_OF_STOCK">Rupture</option>
          </select>
        )}
      </div>

      <div className="bg-white border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Conditionnement / Prix</th>
              <th className="px-4 py-3">Disponibilité</th>
              {!clientMode && <th className="px-4 py-3">Stock</th>}
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((product) => (
              <tr key={product.id} className="hover:bg-paper/80">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 min-w-[250px]">
                    {product.image_url
                      ? <img src={product.image_url} alt="" className="w-16 h-12 rounded-lg object-cover border border-border shrink-0" />
                      : <div className="w-16 h-12 rounded-lg bg-green-50 text-primary flex items-center justify-center shrink-0"><ImageIcon className="w-5 h-5" /></div>}
                    <div>
                      <div className="font-semibold text-ink">{product.name}</div>
                      <div className="text-xs text-ink-muted">{[product.therapeutic_class, product.dosage, product.administration_route].filter(Boolean).join(' · ')}</div>
                      {product.prescription_required && <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px] font-semibold">Ordonnance requise</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{product.price_display || `${money(product.retail_price, product.currency)} / ${product.sales_unit}`}</div>
                  <div className="text-xs text-ink-muted">{product.sales_unit || product.packaging}</div>
                </td>
                <td className="px-4 py-3 text-xs font-bold">{product.availability || STOCK_STATUS_LABELS[product.stock_status] || product.status}</td>
                {!clientMode && <td className="px-4 py-3 text-xs text-ink-muted">Réel {product.quantity_real} · Rés. {product.quantity_reserved} · Disp. {product.quantity_available}</td>}
                <td className="px-4 py-3 text-right">
                  {clientMode ? (
                    <button type="button" disabled={!product.quantity_available} onClick={() => addToCart(product)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold disabled:opacity-40">
                      <ShoppingCart className="w-3.5 h-3.5" /> Ajouter
                    </button>
                  ) : (
                    <button type="button" onClick={() => edit(product)} className="icon-btn" aria-label={`Modifier ${product.name}`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-muted">Aucun produit</td></tr>}
          </tbody>
        </table>
      </div>

      {open && !clientMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={save} className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink">{editingId ? 'Modifier le produit' : 'Nouveau produit'}</h2>
                <p className="text-sm text-ink-muted">Informations du catalogue patient.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink"><X className="w-5 h-5" /></button>
            </div>
            {error && <div className="p-3 bg-red-50 text-error rounded-xl text-sm">{error}</div>}

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-32 h-24 rounded-xl border border-border bg-paper overflow-hidden flex items-center justify-center shrink-0">
                {form.image_url ? <img src={form.image_url} alt="Aperçu" className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-ink-faint" />}
              </div>
              <div className="space-y-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pickImage} />
                <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-60">
                  <Upload className="w-4 h-4" /> {uploading ? 'Compression…' : 'Téléverser une image'}
                </button>
                {form.image_url && <button type="button" onClick={() => setForm({ ...form, image_url: '' })} className="block text-xs text-error underline">Retirer l’image</button>}
                <p className="text-xs text-ink-muted">JPG, PNG ou WebP · max 2,5 Mo · sortie JPEG 800 px.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm space-y-1 sm:col-span-2">
                <span className="font-medium text-gray-700">Nom *</span>
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary" />
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium text-gray-700">Classe thérapeutique</span>
                <select value={form.therapeutic_class} onChange={(event) => setForm({ ...form, therapeutic_class: event.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary">
                  {THERAPEUTIC.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium text-gray-700">Dosage</span>
                <input value={form.dosage} onChange={(event) => setForm({ ...form, dosage: event.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="500 mg" />
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium text-gray-700">Voie d’administration</span>
                <select value={form.administration_route} onChange={(event) => setForm({ ...form, administration_route: event.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary">
                  {ROUTES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium text-gray-700">Date d’expiration</span>
                <input type="date" value={form.expiration_date || ''} onChange={(event) => setForm({ ...form, expiration_date: event.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary" />
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium text-gray-700">Unité de vente *</span>
                <select required value={form.sales_unit} onChange={(event) => setForm({ ...form, sales_unit: event.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary">
                  {UNITS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium text-gray-700">Prix détail (BIF) *</span>
                <input required type="number" min="0" step="1" value={form.retail_price} onChange={(event) => setForm({ ...form, retail_price: event.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary" />
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium text-gray-700">Quantité réelle</span>
                <input type="number" min="0" value={form.quantity_real} onChange={(event) => setForm({ ...form, quantity_real: event.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary" />
              </label>
              <label className="flex items-center gap-2 text-sm sm:self-end sm:pb-2 text-gray-700">
                <input type="checkbox" checked={form.prescription_required} onChange={(event) => setForm({ ...form, prescription_required: event.target.checked })} />
                Ordonnance obligatoire
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 border border-border rounded-xl">Annuler</button>
              <button type="submit" disabled={saving || uploading} className="px-5 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl font-semibold disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
