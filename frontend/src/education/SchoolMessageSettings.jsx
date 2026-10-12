import React, { useEffect, useState } from 'react';
import { Mail, Save, RefreshCw } from 'lucide-react';
import api from '../shared/api';

const FIELDS = [
  {
    key: 'received',
    label: 'Dossier enregistré',
    help: 'Envoyé à l’élève dès que le dossier arrive en liste d’attente.',
  },
  {
    key: 'accepted',
    label: 'Confirmation',
    help: 'Envoyé tel quel quand l’école accepte le dossier.',
  },
  {
    key: 'refusal',
    label: 'Refus',
    help: 'Envoyé tel quel quand l’école refuse le dossier.',
  },
];

export default function SchoolMessageSettings() {
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({ received: '', accepted: '', refusal: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setError('');
    setSuccess('');
    try {
      const data = await api.get('education/profiles/message-settings/', { auth: true });
      setSettings(data);
      setDraft({
        received: data.received_message || data.default_received_message || '',
        accepted: data.accepted_message || data.default_accepted_message || '',
        refusal: data.refusal_message || data.default_refusal_message || '',
      });
    } catch (err) {
      setError(err.message || 'Impossible de charger les messages');
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await api.patch('education/profiles/message-settings/', {
        received_message: draft.received,
        accepted_message: draft.accepted,
        refusal_message: draft.refusal,
      }, { auth: true });
      setSettings(data);
      setSuccess('Messages enregistrés. Les prochains e-mails utiliseront ces textes.');
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  if (!settings && !error) {
    return <div className="text-sm text-gray-500">Chargement des messages…</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
        Messages d’inscription (école)
      </h2>
      <form onSubmit={save} className="bg-white rounded-2xl border border-teal-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-teal-50 border-b border-teal-100 flex items-center gap-2">
          <Mail className="w-5 h-5 text-teal-700" />
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Textes envoyés à l’élève</h3>
            <p className="text-xs text-gray-500">
              Dossier enregistré, confirmation et refus. Accepter ou refuser envoie ce texte, sans le retaper.
            </p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>}
          {success && <div className="text-xs text-green-700 bg-green-50 p-2 rounded-lg">{success}</div>}
          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase w-full">Variables</span>
            {(settings?.placeholders || []).map((item) => (
              <code key={item} className="text-[10px] bg-white px-2 py-0.5 rounded border text-teal-800">{item}</code>
            ))}
          </div>
          {FIELDS.map((field) => (
            <div key={field.key}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-xs font-bold text-gray-700">{field.label}</label>
                <button
                  type="button"
                  className="text-[10px] text-teal-700 font-semibold hover:underline"
                  onClick={() => setDraft({
                    ...draft,
                    [field.key]: settings?.[`default_${field.key}_message`] || '',
                  })}
                >
                  Réinitialiser
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mb-2">{field.help}</p>
              <textarea
                rows={8}
                value={draft[field.key]}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm font-mono leading-relaxed outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={load} className="px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Actualiser
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center gap-1">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
