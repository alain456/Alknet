import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import restaurantService from '../restaurantService';
import { btnPrimary, fieldClass, Panel, RestaurantPage } from '../ui';

const KINDS = [
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'BAR', label: 'Bar' },
  { value: 'CAFE', label: 'Café' },
  { value: 'TRAITEUR', label: 'Traiteur' },
];

const empty = {
  trade_name: '',
  venue_kind: 'RESTAURANT',
  cuisine_type: '',
  seats: '',
  opening_hours: '',
  description: '',
  takeaway: false,
  delivery: false,
  reservations_open: true,
  price_range: '',
};

export default function RestaurantCompany() {
  const [form, setForm] = useState(empty);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    restaurantService.profile()
      .then((data) => {
        setMeta(data);
        setForm({
          trade_name: data.trade_name || '',
          venue_kind: data.venue_kind || 'RESTAURANT',
          cuisine_type: data.cuisine_type || '',
          seats: data.seats ?? '',
          opening_hours: data.opening_hours || '',
          description: data.description || '',
          takeaway: !!data.takeaway,
          delivery: !!data.delivery,
          reservations_open: data.reservations_open !== false,
          price_range: data.price_range || '',
        });
      })
      .catch((err) => setError(err.message || 'Impossible de charger la fiche.'));
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setOk('');
    try {
      const payload = {
        ...form,
        seats: form.seats === '' ? null : Number(form.seats),
      };
      const updated = await restaurantService.updateProfile(payload);
      setOk('Fiche enregistrée. L’annuaire public est à jour.');
      setMeta(updated);
    } catch (err) {
      setError(err.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RestaurantPage
      title="Mon établissement"
      subtitle="Fiche café, bar, traiteur ou restaurant — distincte de l’hôtel."
      actions={meta?.id && meta?.business_id ? (
        <Link to={`/restaurants/${meta.business_id}`} className={`${btnPrimary} inline-flex`}>
          Voir la fiche publique
        </Link>
      ) : null}
    >
      {error && <p className="text-error text-sm font-medium">{error}</p>}
      {ok && <p className="text-sm font-bold text-ink">{ok}</p>}
      <form onSubmit={save} className="space-y-4">
        <Panel className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm font-bold text-ink">
            Nom affiché
            <input className={`${fieldClass} mt-1`} value={form.trade_name} onChange={(e) => setField('trade_name', e.target.value)} />
          </label>
          <label className="block text-sm font-bold text-ink">
            Type
            <select className={`${fieldClass} mt-1`} value={form.venue_kind} onChange={(e) => setField('venue_kind', e.target.value)}>
              {KINDS.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold text-ink">
            Cuisine / spécialité
            <input className={`${fieldClass} mt-1`} value={form.cuisine_type} onChange={(e) => setField('cuisine_type', e.target.value)} />
          </label>
          <label className="block text-sm font-bold text-ink">
            Places assises
            <input type="number" min="0" className={`${fieldClass} mt-1`} value={form.seats} onChange={(e) => setField('seats', e.target.value)} />
          </label>
          <label className="sm:col-span-2 block text-sm font-bold text-ink">
            Horaires
            <input className={`${fieldClass} mt-1`} placeholder="Ex. Lun–Dim 11:00–22:00" value={form.opening_hours} onChange={(e) => setField('opening_hours', e.target.value)} />
          </label>
          <label className="sm:col-span-2 block text-sm font-bold text-ink">
            Présentation
            <textarea rows={4} className={`${fieldClass} mt-1`} value={form.description} onChange={(e) => setField('description', e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input type="checkbox" checked={form.takeaway} onChange={(e) => setField('takeaway', e.target.checked)} />
            À emporter
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input type="checkbox" checked={form.delivery} onChange={(e) => setField('delivery', e.target.checked)} />
            Livraison
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input type="checkbox" checked={form.reservations_open} onChange={(e) => setField('reservations_open', e.target.checked)} />
            Réservations de table ouvertes
          </label>
        </Panel>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </RestaurantPage>
  );
}
