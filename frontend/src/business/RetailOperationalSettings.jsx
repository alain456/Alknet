import React, { useEffect, useState } from 'react';
import retailService from '../retail/retailService';

/** Réglages opérationnels pharmacie de détail (sous Informations Générales). */
export default function RetailOperationalSettings() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    retailService.getProfile()
      .then(setData)
      .catch((err) => setError(err.message || 'Impossible de charger'));
  }, []);

  if (!data && !error) {
    return <p className="text-sm text-gray-500">Chargement des paramètres métier…</p>;
  }
  if (error && !data) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setError('');
    try {
      setData(await retailService.updateProfile({
        order_reference_prefix: data.order_reference_prefix,
        acceptance_email_message: data.acceptance_email_message,
      }));
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
        Paramètres métier (pharmacie de détail)
      </h2>
      {msg && <p className="text-sm text-emerald-700 font-medium">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <label className="text-sm space-y-1 block">
        <span className="font-medium text-gray-700 dark:text-gray-300">Préfixe des commandes</span>
        <input
          className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800"
          value={data.order_reference_prefix || ''}
          onChange={(e) => setData({ ...data, order_reference_prefix: e.target.value })}
        />
      </label>
      <label className="text-sm space-y-1 block">
        <span className="font-medium text-gray-700 dark:text-gray-300">Message envoyé à l&apos;acceptation</span>
        <textarea
          rows={5}
          className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800"
          value={data.acceptance_email_message || ''}
          onChange={(e) => setData({ ...data, acceptance_email_message: e.target.value })}
        />
      </label>
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
