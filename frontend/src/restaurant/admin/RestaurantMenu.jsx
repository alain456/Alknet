import React, { useEffect, useState } from 'react';
import restaurantService, { listOf } from '../restaurantService';
import { btnGhost, btnPrimary, Empty, fieldClass, Panel, RestaurantPage } from '../ui';

const SECTIONS = [
  { value: 'entrees', label: 'Entrées' },
  { value: 'plats', label: 'Plats' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'boissons', label: 'Boissons' },
  { value: 'autre', label: 'Autre' },
];

const blank = {
  name: '',
  description: '',
  section: 'plats',
  price: '',
  is_available: true,
};

export default function RestaurantMenu() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    restaurantService.menu()
      .then((data) => setItems(listOf(data)))
      .catch((err) => setError(err.message || 'Menu indisponible'));
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      price: form.price === '' ? 0 : form.price,
    };
    try {
      if (editing) {
        await restaurantService.updateMenuItem(editing, payload);
      } else {
        await restaurantService.createMenuItem(payload);
      }
      setForm(blank);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const edit = (row) => {
    setEditing(row.id);
    setForm({
      name: row.name || '',
      description: row.description || '',
      section: row.section || 'plats',
      price: row.price ?? '',
      is_available: row.is_available !== false,
    });
  };

  const remove = async (id) => {
    if (!window.confirm('Retirer ce plat du menu ?')) return;
    try {
      await restaurantService.deleteMenuItem(id);
      load();
    } catch (err) {
      setError(err.message || 'Suppression impossible.');
    }
  };

  return (
    <RestaurantPage title="Menu" subtitle="Les plats publiés apparaissent sur la fiche client.">
      {error && <p className="text-error text-sm font-medium">{error}</p>}
      <Panel>
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm font-bold text-ink">
            Nom
            <input className={`${fieldClass} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="block text-sm font-bold text-ink">
            Section
            <select className={`${fieldClass} mt-1`} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
              {SECTIONS.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2 block text-sm font-bold text-ink">
            Description
            <input className={`${fieldClass} mt-1`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className="block text-sm font-bold text-ink">
            Prix (BIF)
            <input type="number" min="0" className={`${fieldClass} mt-1`} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-ink self-end pb-2">
            <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />
            Disponible
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {editing ? 'Mettre à jour' : 'Ajouter au menu'}
            </button>
            {editing && (
              <button type="button" className={btnGhost} onClick={() => { setEditing(null); setForm(blank); }}>
                Annuler
              </button>
            )}
          </div>
        </form>
      </Panel>
      <Panel>
        {items.length === 0 ? (
          <Empty>Aucun plat pour l’instant.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((row) => (
              <li key={row.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-ink">{row.name}</p>
                  <p className="text-xs text-ink-muted">
                    {SECTIONS.find((s) => s.value === row.section)?.label || row.section}
                    {' · '}
                    {Number(row.price || 0).toLocaleString('fr-FR')} {row.currency || 'BIF'}
                    {row.is_available ? '' : ' · indisponible'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={btnGhost} onClick={() => edit(row)}>Modifier</button>
                  <button type="button" className={btnGhost} onClick={() => remove(row.id)}>Retirer</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </RestaurantPage>
  );
}
