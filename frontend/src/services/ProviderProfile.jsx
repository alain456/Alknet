import React, { useEffect, useState } from 'react';
import api from '../shared/api';
import LocationSelector from '../shared/components/LocationSelector';
import providerService from './providerService';

const empty = {
  commercial_name: '',
  business_name: '',
  about: '',
  coverage_zones: '',
  opening_hours: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  commune: '',
  province: 'Bujumbura Mairie',
  zone: '',
  quartier: '',
  avenue: '',
  latitude: '',
  longitude: '',
  category_name: '',
  category_id: '',
  show_phone: true,
  show_email: true,
  show_address: true,
  show_website: true,
  is_published: true,
};

const fieldClass = 'w-full border border-border rounded-lg px-3 py-2';
const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);

export default function ProviderProfile() {
  const [form, setForm] = useState(empty);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    providerService.getProfile()
      .then((data) => setForm({
        ...empty,
        ...data,
        category_id: data.category_id || '',
        latitude: data.latitude ?? '',
        longitude: data.longitude ?? '',
      }))
      .catch((err) => setError(err.message || 'Fiche indisponible'));
    api.get('business-categories/')
      .then((data) => {
        const rows = normalize(data);
        setCategories(rows.filter((row) => row.module === 'services' && row.parent));
      })
      .catch(() => setCategories([]));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await providerService.saveProfile({
        ...form,
        latitude: form.latitude === '' ? null : form.latitude,
        longitude: form.longitude === '' ? null : form.longitude,
      });
      setForm({
        ...empty,
        ...saved,
        category_id: saved.category_id || form.category_id,
        latitude: saved.latitude ?? '',
        longitude: saved.longitude ?? '',
      });
      setMessage('Fiche enregistrée.');
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key) => setForm((current) => ({ ...current, [key]: !current[key] }));

  return (
    <form onSubmit={save} className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Ma fiche</h1>
        <p className="text-sm text-ink-muted mt-1">
          Informations essentielles de l’entreprise. Les services se gèrent dans le menu Services.
        </p>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      {message && <p className="text-sm font-semibold text-ink">{message}</p>}

      <section className="bg-white rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-ink">Identité de l’entreprise</h2>
        <label className="block text-sm space-y-1">
          <span className="font-medium">Raison sociale</span>
          <input value={form.business_name} readOnly className={`${fieldClass} bg-surface text-ink-muted`} />
        </label>
        <label className="block text-sm space-y-1">
          <span className="font-medium">Nom affiché *</span>
          <input
            required
            value={form.commercial_name}
            onChange={(e) => setForm({ ...form, commercial_name: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="font-medium">Catégorie de service *</span>
          <select
            required
            value={form.category_id || ''}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className={fieldClass}
          >
            <option value="" disabled>-- Choisir votre catégorie --</option>
            {categories.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm space-y-1">
          <span className="font-medium">Présentation</span>
          <textarea
            rows={5}
            value={form.about}
            onChange={(e) => setForm({ ...form, about: e.target.value })}
            className={fieldClass}
            placeholder="Qui vous êtes, ce que vous proposez, pour qui."
          />
        </label>
      </section>

      <section className="bg-white rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-ink">Coordonnées</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="font-medium">Téléphone</span>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldClass} />
          </label>
          <label className="text-sm space-y-1">
            <span className="font-medium">E-mail</span>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass} />
          </label>
          <label className="text-sm space-y-1 sm:col-span-2">
            <span className="font-medium">Site web</span>
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={fieldClass} />
          </label>
        </div>
      </section>

      <section className="bg-white rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-ink">Adresse du siège</h2>
        <LocationSelector
          province={form.province}
          commune={form.commune}
          zone={form.zone}
          quartier={form.quartier}
          avenue={form.avenue}
          address={form.address}
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={(loc) => setForm((current) => ({ ...current, ...loc }))}
        />
      </section>

      <section className="bg-white rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-ink">Intervention</h2>
        <label className="block text-sm space-y-1">
          <span className="font-medium">Zones ou adresses d’intervention</span>
          <textarea
            rows={2}
            value={form.coverage_zones}
            onChange={(e) => setForm({ ...form, coverage_zones: e.target.value })}
            className={fieldClass}
            placeholder="Communes, quartiers ou adresses où vous vous déplacez."
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="font-medium">Horaires</span>
          <input
            value={form.opening_hours}
            onChange={(e) => setForm({ ...form, opening_hours: e.target.value })}
            className={fieldClass}
            placeholder="Ex. Lun–Sam 7h–19h"
          />
        </label>
      </section>

      <section className="bg-white rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-ink">Visible sur la fiche publique</h2>
        <fieldset className="space-y-2 text-sm">
          <legend className="sr-only">Visible sur la fiche publique</legend>
          {[
            ['show_phone', 'Téléphone'],
            ['show_email', 'E-mail'],
            ['show_address', 'Adresse'],
            ['show_website', 'Site web'],
            ['is_published', 'Publier la fiche'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(form[key])} onChange={() => toggle(key)} />
              {label}
            </label>
          ))}
        </fieldset>
      </section>

      <button type="submit" disabled={busy} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-40">
        Enregistrer
      </button>
    </form>
  );
}
