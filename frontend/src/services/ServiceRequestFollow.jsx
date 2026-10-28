import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import providerService, { REQUEST_STATUS_LABELS } from './providerService';
import RequestThread from './RequestThread';
import { formatRequestWhen } from './requestUtils';

export default function ServiceRequestFollow({ authMode = false }) {
  const { token, id } = useParams();
  const [dossier, setDossier] = useState(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    const loader = authMode
      ? providerService.getMyRequest(id)
      : providerService.getPublicRequest(token);
    return loader
      .then(setDossier)
      .catch((err) => setError(err.message || 'Demande introuvable'));
  };

  useEffect(() => { load(); }, [token, id, authMode]);

  const send = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const data = authMode
        ? await providerService.replyMyRequest(id, body.trim())
        : await providerService.replyPublicRequest(token, body.trim());
      setDossier(data);
      setBody('');
    } catch (err) {
      setError(err.message || 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };

  if (!dossier && !error) return <p className="text-ink-muted">Chargement…</p>;

  return (
    <div className={authMode ? 'space-y-4 max-w-3xl' : 'min-h-screen bg-surface'}>
      <div className={authMode ? '' : 'max-w-3xl mx-auto px-4 py-8 space-y-4'}>
        {!authMode && (
          <p className="text-sm">
            <Link to="/services" className="text-primary font-semibold">Prestataires</Link>
          </p>
        )}
        {authMode && (
          <p className="text-sm">
            <Link to="/dashboard/demandes" className="text-primary font-semibold">← Mes demandes</Link>
          </p>
        )}
        {error && <p className="text-sm text-error">{error}</p>}
        {dossier && (
          <section className="bg-white rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-ink-muted">{dossier.reference}</p>
                <h1 className="text-2xl font-bold text-ink">{dossier.provider_name || 'Demande'}</h1>
                <p className="text-sm text-ink-muted">
                  {dossier.service_title || 'Demande générale'}
                  {dossier.created_at ? ` · ${formatRequestWhen(dossier.created_at)}` : ''}
                </p>
              </div>
              <span className="text-xs font-semibold">{REQUEST_STATUS_LABELS[dossier.status] || dossier.status}</span>
            </div>
            <RequestThread messages={dossier.messages} />
            <form onSubmit={send} className="space-y-2">
              <label className="block text-sm space-y-1">
                <span className="font-medium text-ink">Votre message</span>
                <textarea
                  required
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-white"
                />
              </label>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-40">
                {busy ? 'Envoi…' : 'Envoyer'}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
