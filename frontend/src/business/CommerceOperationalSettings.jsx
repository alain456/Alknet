import React, { useEffect, useState } from 'react';
import commerceService from '../commerce/commerceService';

const FIELDS = [
  {
    key: 'order_received_message',
    label: 'Commande enregistrée',
    help: 'Envoyé au client dès que la commande est enregistrée. Variables : {client_name} {reference} {shop_name} {total_amount} {currency}.',
  },
  {
    key: 'order_accepted_message',
    label: 'Commande acceptée',
    help: 'Envoyé tel quel quand la boutique accepte la commande. Sans cet e-mail, l’acceptation est refusée.',
  },
  {
    key: 'order_refused_message',
    label: 'Commande refusée',
    help: 'Envoyé tel quel quand la boutique refuse la commande. Sans cet e-mail, le refus est refusé.',
  },
];

export default function CommerceOperationalSettings() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    commerceService.getShopStatus()
      .then(setData)
      .catch((err) => setError(err.message || 'Impossible de charger'));
  }, []);

  if (!data && !error) {
    return <p className="text-sm text-gray-500">Chargement des messages de commande…</p>;
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
      setData(await commerceService.updateShopStatus({
        order_received_message: data.order_received_message,
        order_accepted_message: data.order_accepted_message,
        order_refused_message: data.order_refused_message,
      }));
      setMsg('Messages enregistrés. Les prochains e-mails utiliseront ces textes.');
    } catch (err) {
      setError(err.message || 'Échec');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
        Messages de commande (boutique)
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Accepter ou refuser une commande envoie obligatoirement l’e-mail défini ici. Le client est aussi prévenu dès l’enregistrement.
      </p>
      {msg && <p className="text-sm text-emerald-700 font-medium">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {FIELDS.map((field) => (
        <label key={field.key} className="text-sm space-y-1 block">
          <span className="font-medium text-gray-700 dark:text-gray-300">{field.label}</span>
          <textarea
            rows={5}
            required
            className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800"
            value={data[field.key] || ''}
            onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
          />
          <span className="text-xs text-gray-500">{field.help}</span>
        </label>
      ))}
      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold disabled:opacity-50"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer les messages'}
      </button>
    </form>
  );
}
