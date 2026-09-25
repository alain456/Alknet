import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Pencil, Upload, Image as ImageIcon, X } from 'lucide-react';
import wholesaleService, { STOCK_STATUS_LABELS } from './wholesaleService';

const FORMS = ['Comprimé', 'Gélule', 'Sirop', 'Solution', 'Injectable', 'Pommade', 'Crème', 'Suppositoire', 'Poudre', 'Autre'];
const ROUTES = ['Orale', 'Injectable', 'Topique', 'Rectale', 'Oculaire', 'Nasale', 'Inhalation', 'Autre'];
const UNITS = ['Boîte', 'Carton', 'Flacon', 'Lot', 'Tube', 'Ampoule', 'Unité', 'Sachet'];
const THERAPEUTIC = [
  'Antidouleur', 'Antibiotique', 'Vitamines', 'Antipaludéen', 'Anti-inflammatoire',
  'Chronique', 'Premiers secours', 'Soins de la peau', 'Gastro-entérologie', 'Autre',
];

const emptyForm = {
  name: '',
  active_ingredient: '',
  dosage: '',
  pharmaceutical_form: 'Comprimé',
  administration_route: 'Orale',
  manufacturer: '',
  packaging: '',
  wholesale_unit: 'Boîte',
  wholesale_price: '',
  currency: 'BIF',
  quantity_real: '',
  low_stock_threshold: 10,
  batch_number: '',
  expiration_date: '',
  status: 'ACTIVE',
  description: '',
  min_order_quantity: 1,
  therapeutic_class: 'Antidouleur',
  image_url: '',
};

const normalize = (d) => (Array.isArray(d) ? d : d?.results || []);

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Aucun fichier'));
    if (!file.type.startsWith('image/')) return reject(new Error('Fichier image requis (JPG, PNG, WebP)'));
    if (file.size > 2.5 * 1024 * 1024) return reject(new Error('Image trop lourde (max 2,5 Mo)'));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
}

export default function WholesaleCatalog({ clientMode = false }) {
  const [products, setProducts] = useState([]);
  const [wholesaleId, setWholesaleId] = useState('');
  const [pharmacies, setPharmacies] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [orderQty, setOrderQty] = useState(1);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    try {
      setError('');
      if (clientMode) {
        const list = await wholesaleService.listPharmacies();
        setPharmacies(list);
        const wid = wholesaleId || list[0]?.id;
        if (wid) {
          setWholesaleId(wid);
          const data = await wholesaleService.getProducts({ wholesale: wid, public: 'true' });
          setProducts(normalize(data));
        } else {
          setProducts([]);
        }
      } else {
        const data = await wholesaleService.getProducts();
        setProducts(normalize(data));
      }
    } catch (e) {
      setError(e.message || 'Erreur chargement catalogue');
      setProducts([]);
    }
  };

  useEffect(() => { load(); }, [clientMode]);
  useEffect(() => {
    if (clientMode && wholesaleId) {
      wholesaleService.getProducts({ wholesale: wholesaleId, public: 'true' })
        .then((d) => setProducts(normalize(d)))
        .catch(() => setProducts([]));
    }
  }, [wholesaleId, clientMode]);

  const filtered = useMemo(() => products.filter((p) => {
    const hay = `${p.name} ${p.active_ingredient} ${p.manufacturer} ${p.therapeutic_class}`.toLowerCase();
    const matchQ = !q || hay.includes(q.toLowerCase());
    const matchS = status === 'ALL' || p.status === status || p.availability === status;
    return matchQ && matchS;
  }), [products, q, status]);

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const dataUrl = await readImageFile(file);
      setForm((prev) => ({ ...prev, image_url: String(dataUrl) }));
    } catch (err) {
      setError(err.message || 'Upload impossible');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        wholesale_price: Number(form.wholesale_price),
        quantity_real: Number(form.quantity_real || 0),
        low_stock_threshold: Number(form.low_stock_threshold || 10),
        min_order_quantity: Number(form.min_order_quantity || 1),
      };
      if (!payload.expiration_date) delete payload.expiration_date;
      if (editingId) await wholesaleService.updateProduct(editingId, payload);
      else await wholesaleService.createProduct(payload);
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setMessage('Produit enregistré');
      load();
    } catch (err) {
      setError(err.message || 'Échec enregistrement');
    }
  };

  const addToCart = async (product, qty = 1) => {
    try {
      await wholesaleService.addToCart({ product_id: product.id, quantity: qty });
      setMessage(`${product.name} ajouté au panier`);
      setDetail(null);
    } catch (err) {
      setError(err.message || 'Impossible d\'ajouter au panier');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Catalogue</h1>
          <p className="text-sm text-ink-muted">Médicaments, conditionnements et prix de gros</p>
        </div>
        {!clientMode && (
          <button
            type="button"
            onClick={() => { setEditingId(null); setForm(emptyForm); setOpen(true); setError(''); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-secondary text-white rounded-xl font-semibold"
          >
            <Plus className="w-4 h-4" /> Nouveau produit
          </button>
        )}
      </div>

      {message && <div className="p-3 bg-green-50 text-success rounded-xl text-sm">{message}</div>}
      {error && !open && <div className="p-3 bg-red-50 text-error rounded-xl text-sm">{error}</div>}

      <div className="flex flex-wrap gap-3">
        {clientMode && (
          <select value={wholesaleId} onChange={(e) => setWholesaleId(e.target.value)} className="px-3 py-2 border border-border rounded-xl text-sm">
            {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.commercial_name || p.name}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, DCI, fabricant, classe..." className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-sm" />
        </div>
        {!clientMode && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-border rounded-xl text-sm">
            <option value="ALL">Tous statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
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
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-paper/80">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt=""
                        className={`${clientMode ? 'w-20 h-16' : 'w-12 h-12'} rounded-lg object-cover border border-border shrink-0`}
                      />
                    ) : (
                      <div className={`${clientMode ? 'w-20 h-16' : 'w-12 h-12'} rounded-lg bg-green-50 text-primary flex items-center justify-center shrink-0`}>
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-ink">{p.name}</div>
                      <div className="text-xs text-ink-muted">
                        {[p.therapeutic_class, p.active_ingredient, p.dosage].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{p.price_display || `${p.wholesale_price} ${p.currency} / ${p.packaging}`}</div>
                  <div className="text-xs text-ink-muted">{p.manufacturer}</div>
                </td>
                <td className="px-4 py-3 text-xs font-bold">
                  {p.availability || STOCK_STATUS_LABELS[p.stock_status] || p.status}
                </td>
                {!clientMode && (
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    Réel {p.quantity_real} · Rés. {p.quantity_reserved} · Disp. {p.quantity_available}
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  {clientMode ? (
                    <button type="button" onClick={() => { setDetail(p); setOrderQty(p.min_order_quantity || 1); }} className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold">
                      Ajouter
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(p.id);
                        setForm({ ...emptyForm, ...p, expiration_date: p.expiration_date || '', image_url: p.image_url || '' });
                        setOpen(true);
                        setError('');
                      }}
                      className="icon-btn"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-muted">Aucun produit</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={save} className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg text-ink">{editingId ? 'Modifier le produit' : 'Nouveau produit'}</h3>
                <p className="text-sm text-ink-muted">Renseignez les informations pharmaceutiques utiles à la vente en gros.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink"><X className="w-5 h-5" /></button>
            </div>

            {error && <div className="p-3 bg-red-50 text-error rounded-xl text-sm">{error}</div>}

            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Identification</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm space-y-1 sm:col-span-2">
                  <span className="font-medium">Nom du médicament *</span>
                  <input required className="w-full border border-border rounded-lg px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Paracétamol 500 mg" />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">DCI / principe actif</span>
                  <input className="w-full border border-border rounded-lg px-3 py-2" value={form.active_ingredient} onChange={(e) => setForm({ ...form, active_ingredient: e.target.value })} placeholder="Ex: Paracetamol" />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Dosage</span>
                  <input className="w-full border border-border rounded-lg px-3 py-2" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="Ex: 500 mg" />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Classe thérapeutique</span>
                  <select className="w-full border border-border rounded-lg px-3 py-2" value={form.therapeutic_class} onChange={(e) => setForm({ ...form, therapeutic_class: e.target.value })}>
                    {THERAPEUTIC.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Fabricant</span>
                  <input className="w-full border border-border rounded-lg px-3 py-2" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Forme & conditionnement</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm space-y-1">
                  <span className="font-medium">Forme pharmaceutique</span>
                  <select className="w-full border border-border rounded-lg px-3 py-2" value={form.pharmaceutical_form} onChange={(e) => setForm({ ...form, pharmaceutical_form: e.target.value })}>
                    {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Voie d&apos;administration</span>
                  <select className="w-full border border-border rounded-lg px-3 py-2" value={form.administration_route} onChange={(e) => setForm({ ...form, administration_route: e.target.value })}>
                    {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Conditionnement *</span>
                  <input required className="w-full border border-border rounded-lg px-3 py-2" value={form.packaging} onChange={(e) => setForm({ ...form, packaging: e.target.value })} placeholder="Ex: Boîte de 20 comprimés" />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Unité de vente en gros</span>
                  <select className="w-full border border-border rounded-lg px-3 py-2" value={form.wholesale_unit} onChange={(e) => setForm({ ...form, wholesale_unit: e.target.value })}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Prix & stock</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm space-y-1">
                  <span className="font-medium">Prix de gros (BIF) *</span>
                  <input type="number" min="0" step="1" required className="w-full border border-border rounded-lg px-3 py-2" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Quantité minimale de commande</span>
                  <input type="number" min="1" className="w-full border border-border rounded-lg px-3 py-2" value={form.min_order_quantity} onChange={(e) => setForm({ ...form, min_order_quantity: e.target.value })} />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Quantité réelle en stock</span>
                  <input type="number" min="0" className="w-full border border-border rounded-lg px-3 py-2" value={form.quantity_real} onChange={(e) => setForm({ ...form, quantity_real: e.target.value })} />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Seuil stock faible</span>
                  <input type="number" min="0" className="w-full border border-border rounded-lg px-3 py-2" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">N° de lot</span>
                  <input className="w-full border border-border rounded-lg px-3 py-2" value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Date d&apos;expiration</span>
                  <input type="date" className="w-full border border-border rounded-lg px-3 py-2" value={form.expiration_date || ''} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Statut</span>
                  <select className="w-full border border-border rounded-lg px-3 py-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="ACTIVE">Actif</option>
                    <option value="INACTIVE">Inactif</option>
                    <option value="ARCHIVED">Archivé</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Image du médicament</h4>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-32 h-32 rounded-xl border border-border bg-paper overflow-hidden flex items-center justify-center shrink-0">
                  {form.image_url ? (
                    <img src={form.image_url} alt="Aperçu" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-ink-faint" />
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickImage} />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-secondary text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Chargement...' : 'Téléverser une image'}
                  </button>
                  {form.image_url && (
                    <button type="button" onClick={() => setForm({ ...form, image_url: '' })} className="ml-2 text-sm text-error underline">
                      Retirer
                    </button>
                  )}
                  <p className="text-xs text-ink-muted">JPG, PNG ou WebP — max 2,5 Mo. L&apos;image apparaît dans le catalogue public.</p>
                </div>
              </div>
            </section>

            <label className="text-sm space-y-1 block">
              <span className="font-medium">Description</span>
              <textarea rows={3} className="w-full border border-border rounded-lg px-3 py-2" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Indications, précautions, remarques commerciales..." />
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 border border-border rounded-xl">Annuler</button>
              <button type="submit" className="px-4 py-2 bg-primary hover:bg-secondary text-white rounded-xl font-semibold">Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3">
            <h3 className="text-xl font-bold text-ink">{detail.name}</h3>
            <label className="text-sm block space-y-1">
              <span className="font-medium">Quantité</span>
              <input type="number" min={detail.min_order_quantity || 1} className="w-full border rounded-lg px-3 py-2" value={orderQty} onChange={(e) => setOrderQty(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDetail(null)} className="px-4 py-2 border rounded-xl">Fermer</button>
              <button type="button" onClick={() => addToCart(detail, Number(orderQty))} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold">Ajouter au panier</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
