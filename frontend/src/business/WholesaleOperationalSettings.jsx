import React, { useEffect, useState } from 'react';
import wholesaleService from '../wholesale/wholesaleService';

/** Réglages opérationnels pharmacie de gros (sous Informations Générales). */
export default function WholesaleOperationalSettings() {
  const [profile, setProfile] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    wholesaleService.getProfile().then(setProfile).catch((e) => setError(e.message));
  }, []);

  if (!profile && !error) {
    return <p className="text-sm text-gray-500">Chargement des paramètres métier…</p>;
  }
  if (error && !profile) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setError('');
    try {
      const updated = await wholesaleService.updateProfile({
        order_reference_prefix: profile.order_reference_prefix,
        acceptance_email_message: profile.acceptance_email_message,
        status: profile.status,
      });
      setProfile({ ...profile, ...updated });
      setMsg('Paramètres métier enregistrés.');
    } catch (err) {
      setError(err.message || 'Échec');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
        Paramètres métier (pharmacie de gros)
      </h2>
      {msg && <p className="text-sm text-emerald-700 font-medium">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm space-y-1 block">
          <span className="font-medium text-gray-700 dark:text-gray-300">Préfixe des références</span>
          <input
            className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800"
            value={profile.order_reference_prefix || ''}
            onChange={(e) => setProfile({ ...profile, order_reference_prefix: e.target.value })}
          />
        </label>
        <label className="text-sm space-y-1 block">
          <span className="font-medium text-gray-700 dark:text-gray-300">Statut catalogue</span>
          <select
            className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800"
            value={profile.status || 'DRAFT'}
            onChange={(e) => setProfile({ ...profile, status: e.target.value })}
          >
            <option value="DRAFT">Brouillon</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspendue</option>
            <option value="CLOSED">Fermée</option>
          </select>
        </label>
        <label className="text-sm space-y-1 block sm:col-span-2">
          <span className="font-medium text-gray-700 dark:text-gray-300">Modèle email d&apos;acceptation</span>
          <textarea
            rows={5}
            className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800"
            value={profile.acceptance_email_message || ''}
            onChange={(e) => setProfile({ ...profile, acceptance_email_message: e.target.value })}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold disabled:opacity-50"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer les paramètres métier'}
      </button>
    </form>
  );
}
