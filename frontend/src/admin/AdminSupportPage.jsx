import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, Mail, Trash2 } from 'lucide-react';
import api, { invalidateApiCache } from '../shared/api';
import { notifyContactUnread } from './contactInbox';

export default function AdminSupportPage() {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [users, setUsers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const authOpts = useMemo(() => ({ auth: true }), []);

  const applyUnread = useCallback((list) => {
    const unread = list.filter((m) => !m.is_read).length;
    setUnreadCount(unread);
    notifyContactUnread(unread);
    return unread;
  }, []);

  const markRead = useCallback(async (msg, currentList) => {
    if (!msg || msg.is_read) return { msg, list: currentList };

    // Optimistic : badge baisse immédiatement à l’ouverture
    const optimistic = (currentList || []).map((m) =>
      m.id === msg.id ? { ...m, is_read: true } : m,
    );
    setMessages(optimistic);
    applyUnread(optimistic);

    let updated = null;
    try {
      updated = await api.patch(`cms/admin/contact-messages/${msg.id}/`, { is_read: true }, authOpts);
    } catch {
      try {
        updated = await api.post(`cms/admin/contact-messages/${msg.id}/mark_read/`, {}, authOpts);
      } catch {
        updated = { ...msg, is_read: true };
      }
    }
    invalidateApiCache('cms/admin/contact-messages');
    const next = { ...msg, ...updated, is_read: true };
    const synced = optimistic.map((m) => (m.id === msg.id ? next : m));
    setMessages(synced);
    applyUnread(synced);
    return { msg: next, list: synced };
  }, [applyUnread, authOpts]);

  const openMessage = useCallback(async (msg, listOverride) => {
    if (!msg) return;
    setSelected(msg);
    setReplyDraft('');
    setNotice('');
    const list = listOverride || messages;
    const { msg: next } = await markRead(msg, list);
    setSelected(next);
  }, [markRead, messages]);

  const loadInbox = useCallback(async () => {
    const data = await api.get('cms/admin/contact-messages/', { ...authOpts, noCache: true });
    const list = Array.isArray(data) ? data : (data?.results || []);
    setMessages(list);
    return list;
  }, [authOpts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [msgList, userData, subData, logData] = await Promise.all([
          loadInbox(),
          api.get('accounts/admin/users/?scope=business', authOpts).catch(() => []),
          api.get('businesses/admin/subscriptions/', authOpts).catch(() => ({ results: [] })),
          api.get('accounts/admin/audit-logs/?scope=business', authOpts).catch(() => []),
        ]);
        if (cancelled) return;
        const userList = Array.isArray(userData) ? userData : (userData?.results || []);
        setUsers(userList.slice(0, 8));
        setSubs((subData?.results || []).slice(0, 8));
        const logList = Array.isArray(logData) ? logData : (logData?.results || []);
        setLogs(logList.slice(0, 8));
        if (msgList.length) {
          const first = msgList.find((m) => !m.is_read) || msgList[0];
          if (!cancelled) await openMessage(first, msgList);
        } else if (!cancelled) {
          applyUnread([]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Impossible de charger les messages de contact.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authOpts, loadInbox]);

  const markAllRead = async () => {
    try {
      await api.post('cms/admin/contact-messages/mark_all_read/', {}, authOpts);
    } catch {
      await Promise.all(
        messages.filter((m) => !m.is_read).map((m) =>
          api.patch(`cms/admin/contact-messages/${m.id}/`, { is_read: true }, authOpts).catch(() => null),
        ),
      );
    }
    invalidateApiCache('cms/admin/contact-messages');
    const next = messages.map((m) => ({ ...m, is_read: true }));
    setMessages(next);
    applyUnread(next);
    setNotice('Tous les messages sont marqués comme lus.');
  };

  const deleteMessage = async (id) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    await api.delete(`cms/admin/contact-messages/${id}/`, authOpts);
    invalidateApiCache('cms/admin/contact-messages');
    const next = messages.filter((m) => m.id !== id);
    setMessages(next);
    applyUnread(next);
    if (selected?.id === id) setSelected(null);
    setNotice('Message supprimé.');
  };

  const saveNotesAndReply = async () => {
    if (!selected) return;
    const body = replyDraft.trim();
    if (body.length < 3) {
      setError('Rédigez une réponse (au moins 3 caractères) pour l’envoyer au client.');
      return;
    }
    setError('');
    setNotice('');
    try {
      const updated = await api.post(
        `cms/admin/contact-messages/${selected.id}/reply/`,
        { body, admin_notes: body },
        authOpts,
      );
      const next = {
        ...selected,
        ...updated,
        reply_body: updated?.reply_body || body,
        is_read: true,
      };
      setMessages((prev) => prev.map((m) => (m.id === selected.id ? next : m)));
      setSelected(next);
      setReplyDraft('');
      setNotice(updated?.message || `Réponse envoyée à ${selected.email}.`);
      applyUnread(
        messages.map((m) => (m.id === selected.id ? next : m)),
      );
    } catch (err) {
      setError(err.message || 'Impossible d’envoyer la réponse.');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages contact</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
          Boîte de réception des messages envoyés depuis la page Contact Us.
          {unreadCount > 0 ? ` · ${unreadCount} non lu(s)` : ''}
        </p>
      </header>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
      {notice && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm">{notice}</div>}
      {loading && <div className="text-sm text-gray-500">Chargement…</div>}

      {!loading && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Source : <strong>/pages/contact</strong>
              {' · '}
              <Link to="/admin/cms?tab=messages" className="text-primary font-semibold hover:underline">
                Aussi dans CMS → Messages
              </Link>
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg hover:bg-gray-50"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Tout marquer lu
              </button>
            )}
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden max-h-[70vh] overflow-y-auto">
              <ul className="divide-y">
                {messages.map((msg) => (
                  <li key={msg.id}>
                    <button
                      type="button"
                      onClick={() => openMessage(msg)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                        selected?.id === msg.id ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {!msg.is_read && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                        <span className={`text-sm truncate ${msg.is_read ? 'font-medium text-gray-800' : 'font-bold text-gray-900'}`}>
                          {msg.subject}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{msg.name} · {msg.email}</div>
                      <div className="text-[11px] text-gray-400 mt-1">
                        {msg.created_at ? new Date(msg.created_at).toLocaleString('fr-FR') : ''}
                      </div>
                    </button>
                  </li>
                ))}
                {messages.length === 0 && (
                  <li className="p-8 text-center text-sm text-gray-500">
                    Aucun message de contact pour le moment.
                  </li>
                )}
              </ul>
            </div>

            <div className="lg:col-span-3 bg-white rounded-2xl border p-6 min-h-[280px]">
              {!selected ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500 py-16">
                  Sélectionnez un message pour le lire et répondre.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{selected.subject}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        De <strong>{selected.name}</strong> ·{' '}
                        <a href={`mailto:${selected.email}`} className="text-primary hover:underline">
                          {selected.email}
                        </a>
                        {selected.phone ? ` · ${selected.phone}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {selected.created_at
                          ? new Date(selected.created_at).toLocaleString('fr-FR')
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteMessage(selected.id)}
                      className="icon-btn icon-btn--danger"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="rounded-xl bg-gray-50 border p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {selected.message}
                  </div>

                  {selected.reply_body ? (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-ink">
                      <p className="text-xs font-bold text-primary mb-1">
                        Réponse envoyée
                        {selected.replied_at
                          ? ` · ${new Date(selected.replied_at).toLocaleString('fr-FR')}`
                          : ''}
                      </p>
                      <p className="whitespace-pre-wrap">{selected.reply_body}</p>
                    </div>
                  ) : null}

                  {selected.admin_notes && selected.admin_notes !== selected.reply_body ? (
                    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-gray-800 dark:text-ink">
                      <p className="text-xs font-bold text-accent mb-1">Note interne</p>
                      <p className="whitespace-pre-wrap">{selected.admin_notes}</p>
                    </div>
                  ) : null}

                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-gray-700 dark:text-ink">Votre réponse</span>
                    <textarea
                      rows={4}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Écrivez la réponse envoyée par email au client…"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary bg-surface text-ink"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={saveNotesAndReply}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold"
                  >
                    <Mail className="w-4 h-4" /> Envoyer la réponse
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">Aperçu comptes entreprises</h2>
          <div className="grid lg:grid-cols-3 gap-4">
            <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Utilisateurs</h3>
                <Link to="/admin/users?scope=business" className="text-xs font-semibold text-teal-700">Tout voir</Link>
              </div>
              <ul className="text-sm divide-y">
                {users.map((row) => (
                  <li key={row.id} className="py-2">
                    <p className="font-semibold text-gray-900">{row.email}</p>
                    <p className="text-xs text-gray-500">{row.role}</p>
                  </li>
                ))}
                {users.length === 0 && <li className="py-2 text-xs text-gray-500">Aucun</li>}
              </ul>
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
              <h3 className="font-bold text-gray-900">Abonnements</h3>
              <ul className="text-sm divide-y">
                {subs.map((row) => (
                  <li key={row.business_id} className="py-2">
                    <p className="font-semibold text-gray-900">{row.business_name}</p>
                    <p className="text-xs text-gray-500">{row.status_display || row.status}</p>
                  </li>
                ))}
                {subs.length === 0 && <li className="py-2 text-xs text-gray-500">Aucun</li>}
              </ul>
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Audit entreprises</h3>
                <Link to="/admin/audit-logs?scope=business" className="text-xs font-semibold text-teal-700">Tout voir</Link>
              </div>
              <ul className="text-sm divide-y">
                {logs.map((row) => (
                  <li key={row.id} className="py-2">
                    <p className="font-semibold text-gray-900">{row.action}</p>
                    <p className="text-xs text-gray-500">{row.user_email || '—'}</p>
                  </li>
                ))}
                {logs.length === 0 && <li className="py-2 text-xs text-gray-500">Aucun</li>}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
