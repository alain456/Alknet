import React, { useEffect, useState } from 'react';
import retailService from './retailService';
import { normalizeWebsiteUrl } from '../shared/websiteUrl';

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-ink outline-none focus:ring-2 focus:ring-primary';

export default function RetailSettings() {
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    retailService.getProfile()
      .then(setData)
      .catch((err) => setError(err.message || 'Impossible de charger les paramètres'));
  }, []);

  if (!data && !error) {
    return <p className="text-sm text-ink-muted">Chargement…</p>;
  }

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      setData(await retailService.updateProfile({
        ...data,
        website: normalizeWebsiteUrl(data.website),
      }));
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">Paramètres</h1>
        <p className="text-sm text-ink-muted">Coordonnées, références et message d&apos;acceptation.</p>
      </div>
      {saved && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">Enregistré.</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 text-error text-sm">{error}</div>}
      {data && (
        <form onSubmit={submit} className="bg-white border border-border rounded-2xl p-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Site web officiel</span>
            <input
              type="url"
              placeholder="https://www.exemple.com"
              value={data.website || ''}
              onChange={(e) => setData({ ...data, website: e.target.value })}
              className={inputClass}
            />
            <span className="text-xs text-ink-muted">Visible côté clients dans les informations de l&apos;entreprise.</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Préfixe des commandes</span>
            <input
              value={data.order_reference_prefix || ''}
              onChange={(e) => setData({ ...data, order_reference_prefix: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Message envoyé à l&apos;acceptation</span>
            <textarea
              rows={6}
              value={data.acceptance_email_message || ''}
              onChange={(e) => setData({ ...data, acceptance_email_message: e.target.value })}
              className={inputClass}
            />
          </label>
          <div className="pt-2 border-t border-border">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl font-semibold disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
