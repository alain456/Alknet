import React, { useEffect, useState } from 'react';
import { Mail, Save } from 'lucide-react';
import api from '../shared/api';

const FIELDS = [
  {
    key: 'received',
    label: 'Dossier arrivé',
    help: 'Envoyé dès que l’entreprise dépose sa demande.',
  },
  {
    key: 'approved',
    label: 'Approbation',
    help: 'Envoyé quand vous approuvez le dossier. {note} reçoit le complément éventuel.',
  },
  {
    key: 'rejected',
    label: 'Refus',
    help: 'Envoyé quand vous refusez le dossier. {note} reçoit le motif.',
  },
];

export default function BusinessRegistrationMessages() {
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({ received: '', approved: '', rejected: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setError('');
    try {
      const data = await api.get('businesses/admin/registration-messages/', { auth: true });
      setSettings(data);
      setDraft({
        received: data.received_message || '',
        approved: data.approved_message || '',
        rejected: data.rejected_message || '',
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
      const data = await api.patch('businesses/admin/registration-messages/', {
        received_message: draft.received,
        approved_message: draft.approved,
        rejected_message: draft.rejected,
      }, { auth: true });
      setSettings(data);
      setDraft({
        received: data.received_message || '',
        approved: data.approved_message || '',
        rejected: data.rejected_message || '',
      });
      setSuccess('Messages enregistrés. Les prochains e-mails utiliseront ces textes.');
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  if (!settings && !error) {
    return <div className="text-sm text-ink-muted">Chargement des messages…</div>;
  }

  return (
    <form onSubmit={save} className="bg-white dark:bg-gray-900 rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-start gap-2">
        <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h2 className="font-bold text-ink">Messages d’inscription</h2>
          <p className="text-sm text-ink-muted">
            Dossier arrivé, approbation et refus. Le texte enregistré part tel quel, avec les variables remplacées.
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}
      {success && <p className="text-sm text-primary">{success}</p>}
      <p className="text-xs text-ink-muted">
        Variables : {(settings?.placeholders || []).join(' ')}
      </p>
      {FIELDS.map((field) => (
        <div key={field.key}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="text-sm font-bold text-ink">{field.label}</label>
            <button
              type="button"
              className="text-xs font-semibold text-primary"
              onClick={() => setDraft((prev) => ({
                ...prev,
                [field.key]: settings?.[`default_${field.key}_message`] || '',
              }))}
            >
              Texte par défaut
            </button>
          </div>
          <p className="text-xs text-ink-muted mb-2">{field.help}</p>
          <textarea
            rows={6}
            value={draft[field.key]}
            onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-ink text-sm font-bold disabled:opacity-60"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Enregistrement…' : 'Enregistrer les messages'}
      </button>
    </form>
  );
}
