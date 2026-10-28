import React, { useEffect, useState } from 'react';
import providerService, { REQUEST_STATUS_LABELS } from './providerService';
import RequestThread from './RequestThread';
import { REPLY_TEMPLATES, formatRequestWhen, telHref, waHref } from './requestUtils';

const PAGE_SIZE = 24;
const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);

export default function ProviderInbox() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const load = (nextStatus = status, nextPage = page, nextOverdue = overdue) => {
    const params = { page: nextPage, page_size: PAGE_SIZE };
    if (nextStatus) params.status = nextStatus;
    if (nextOverdue) params.overdue = 1;
    return providerService.listInbox(params)
      .then((data) => {
        const list = normalize(data);
        const total = Array.isArray(data) ? list.length : Number(data?.count || list.length);
        setRows(list);
        setCount(total);
        setError('');
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (nextPage > pages) setPage(pages);
      })
      .catch((err) => setError(err.message || 'Demandes indisponibles'));
  };

  useEffect(() => { load(); }, [status, page, overdue]);

  const openDossier = async (id) => {
    setSelectedId(id);
    setError('');
    try {
      const data = await providerService.getInboxRequest(id);
      setDetail(data);
      load();
    } catch (err) {
      setError(err.message || 'Dossier indisponible');
    }
  };

  const sendReply = async (internal = false) => {
    const body = (internal ? note : reply).trim();
    if (!detail || !body) return;
    setBusy(true);
    setError('');
    try {
      const data = await providerService.replyInboxRequest(detail.id, { body, internal });
      setDetail(data);
      if (internal) setNote('');
      else setReply('');
      load();
    } catch (err) {
      setError(err.message || 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };

  const setFilter = (value) => {
    setStatus(value);
    setOverdue(false);
    setPage(1);
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-2xl font-bold text-ink">Demandes de contact</h1>
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {['', 'NEW', 'IN_PROGRESS', 'REPLIED', 'CLOSED'].map((value) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold ${!overdue && status === value ? 'bg-accent text-ink' : 'bg-white text-ink'}`}
          >
            {value ? REQUEST_STATUS_LABELS[value] : 'Toutes'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setOverdue(true); setStatus('NEW'); setPage(1); }}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold ${overdue ? 'bg-accent text-ink' : 'bg-white text-ink'}`}
        >
          En attente 24 h
        </button>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        <div className="space-y-3">
          {rows.length === 0 && <p className="text-ink-muted text-sm">Aucune demande pour le moment.</p>}
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => openDossier(row.id)}
              className={`w-full text-left rounded-2xl p-4 space-y-1 ${selectedId === row.id ? 'bg-accent text-ink' : 'bg-white'}`}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-bold text-ink">{row.reference || row.client_name}</p>
                <span className="text-xs font-semibold">{REQUEST_STATUS_LABELS[row.status] || row.status}</span>
              </div>
              <p className="text-sm text-ink">{row.client_name}</p>
              <p className={`text-sm ${selectedId === row.id ? 'text-ink' : 'text-ink-muted'}`}>
                {row.service_title || 'Demande générale'}
                {row.created_at ? ` · ${formatRequestWhen(row.created_at)}` : ''}
              </p>
              {row.is_overdue ? (
                <p className="text-sm text-error">Sans réponse depuis plus de 24 h</p>
              ) : null}
            </button>
          ))}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="px-3 py-2 border border-border rounded-lg text-sm font-semibold disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-sm text-ink-muted">Page {page} / {pageCount}</span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => current + 1)}
                className="px-3 py-2 border border-border rounded-lg text-sm font-semibold disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          )}
        </div>
        <div>
          {!detail ? (
            <p className="text-sm text-ink-muted">Ouvrez une demande pour répondre.</p>
          ) : (
            <section className="bg-white rounded-2xl p-4 space-y-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-ink-muted">{detail.reference}</p>
                  <h2 className="text-lg font-bold text-ink">{detail.client_name}</h2>
                  <p className="text-sm text-ink-muted">
                    {detail.service_title || 'Demande générale'}
                    {detail.created_at ? ` · ${formatRequestWhen(detail.created_at)}` : ''}
                  </p>
                </div>
                <span className="text-xs font-semibold">{REQUEST_STATUS_LABELS[detail.status] || detail.status}</span>
              </div>
              <p className="text-sm text-ink-muted">
                {detail.client_email ? (
                  <a href={`mailto:${detail.client_email}`} className="text-primary font-semibold">{detail.client_email}</a>
                ) : null}
                {detail.client_phone ? (
                  <>
                    {' · '}
                    <a href={telHref(detail.client_phone)} className="text-primary font-semibold">{detail.client_phone}</a>
                  </>
                ) : null}
              </p>
              {detail.client_address ? (
                <p className="text-sm text-ink-muted">Adresse : {detail.client_address}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {detail.client_phone ? (
                  <>
                    <a href={telHref(detail.client_phone)} className="px-3 py-1.5 border border-border rounded-xl text-xs font-semibold">Appeler</a>
                    <a
                      href={waHref(detail.client_phone, `Bonjour, au sujet du dossier ${detail.reference} sur Isoko Hub.`)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 border border-border rounded-xl text-xs font-semibold"
                    >
                      WhatsApp
                    </a>
                  </>
                ) : null}
                {detail.client_email ? (
                  <a href={`mailto:${detail.client_email}?subject=${encodeURIComponent(`Dossier ${detail.reference}`)}`} className="px-3 py-1.5 border border-border rounded-xl text-xs font-semibold">
                    Écrire
                  </a>
                ) : null}
              </div>
              <RequestThread messages={detail.messages} showInternal />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-ink">Répondre au client</p>
                <div className="flex flex-wrap gap-2">
                  {REPLY_TEMPLATES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="px-3 py-1.5 border border-border rounded-xl text-xs font-semibold"
                      onClick={() => setReply(item)}
                    >
                      {item.slice(0, 42)}…
                    </button>
                  ))}
                </div>
                <textarea
                  rows={4}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-white"
                />
                <button
                  type="button"
                  disabled={busy || !reply.trim()}
                  onClick={() => sendReply(false)}
                  className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-40"
                >
                  Envoyer la réponse
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-ink">Note interne</p>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-white"
                />
                <button
                  type="button"
                  disabled={busy || !note.trim()}
                  onClick={() => sendReply(true)}
                  className="px-3 py-1.5 border border-border rounded-xl text-xs font-semibold disabled:opacity-40"
                >
                  Enregistrer la note
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {['IN_PROGRESS', 'REPLIED', 'CLOSED'].filter((next) => next !== detail.status).map((next) => (
                  <button
                    key={next}
                    type="button"
                    className="px-3 py-1.5 border border-border rounded-xl text-xs font-semibold"
                    onClick={async () => {
                      try {
                        const data = await providerService.setRequestStatus(detail.id, next);
                        setDetail(data);
                        load();
                      } catch (err) {
                        setError(err.message || 'Mise à jour impossible');
                      }
                    }}
                  >
                    {REQUEST_STATUS_LABELS[next]}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
