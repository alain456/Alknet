import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Lock, Clock, Search, Filter, AlertCircle,
  Shield, Scale, Wrench, Eye, X, User, FileText, Laptop, MapPin, Globe,
  CheckCircle2, XCircle, AlertTriangle, KeyRound, UserCog, CreditCard,
  Database, Webhook, Activity,
} from 'lucide-react';
import api from '../shared/api';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  BUSINESS_OWNER: 'Admin entreprise',
  PROFESSIONAL: 'Staff / Professionnel',
  CUSTOMER: 'Client',
  STAFF: 'Staff',
  ANONYMOUS: 'Anonyme',
};

const ACTION_LABELS = {
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
  LOGIN_FAILED: 'Échec connexion',
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  APPOINTMENT_BOOKED: 'Demande RDV',
  APPOINTMENT_CONFIRMED: 'RDV confirmé',
  APPOINTMENT_REJECTED: 'RDV refusé',
  APPOINTMENT_CHECK_IN: 'Arrivée patient',
  APPOINTMENT_COMPLETED: 'Consultation terminée',
  APPOINTMENT_CANCELLED: 'RDV annulé',
  PUBLIC_BOOK: 'Réservation en ligne',
  CONFIRM: 'Confirmation',
  CANCEL: 'Annulation',
  MARK_PAID: 'Paiement marqué',
  ROOM_READY: 'Chambre prête',
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
  ROOM_TYPE_DELETE: 'Suppression type chambre',
  ROOM_TYPE_DEACTIVATE: 'Désactivation type chambre',
  ROOM_DELETE: 'Suppression chambre',
  ROOM_DEACTIVATE: 'Désactivation chambre',
};

const CATEGORY_META = {
  ACCESS: { label: 'Accès', icon: KeyRound, color: 'bg-blue-50 text-blue-800 border-blue-200' },
  SECURITY: { label: 'Sécurité / RBAC', icon: UserCog, color: 'bg-purple-50 text-purple-800 border-purple-200' },
  BILLING: { label: 'Paiement / Facturation', icon: CreditCard, color: 'bg-amber-50 text-amber-900 border-amber-200' },
  DATA_EXPORT: { label: 'Export', icon: Database, color: 'bg-rose-50 text-rose-800 border-rose-200' },
  INTEGRATIONS: { label: 'Intégrations', icon: Webhook, color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  DATA_CHANGE: { label: 'Création / Modif. / Suppression', icon: FileText, color: 'bg-slate-50 text-slate-800 border-slate-200' },
  OTHER: { label: 'Opération', icon: Activity, color: 'bg-gray-50 text-gray-700 border-gray-200' },
};

function actionLabel(action) {
  if (!action) return '—';
  return ACTION_LABELS[action] || String(action).replace(/_/g, ' ');
}

function statusBadge(status) {
  const key = (status || 'SUCCESS').toUpperCase();
  if (key === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
        <XCircle className="w-3.5 h-3.5" /> Échec
      </span>
    );
  }
  if (key === 'WARNING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
        <AlertTriangle className="w-3.5 h-3.5" /> Avertissement
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
      <CheckCircle2 className="w-3.5 h-3.5" /> Succès
    </span>
  );
}

function categoryBadge(cat) {
  const meta = CATEGORY_META[cat] || CATEGORY_META.OTHER;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.color}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

function formatChanges(changes) {
  if (!changes) return null;
  if (typeof changes === 'object' && ('old' in changes || 'new' in changes)) return changes;
  return null;
}

function stringifyVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

/**
 * Journal d'audit entreprise — qui / quoi / quand / où pour chaque action critique.
 */
export default function BusinessAuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [logs, setLogs] = useState([]);
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeLog, setActiveLog] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (filterAction !== 'ALL') params.set('action', filterAction);
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      if (filterCategory !== 'ALL') params.set('category', filterCategory);
      const qs = params.toString();
      const data = await api.get(
        `businesses/me/audit-logs/${qs ? `?${qs}` : ''}`,
        { auth: true },
      );
      setLogs(normalizeList(data));
      if (data?.business_name) setBusinessName(data.business_name);
    } catch (err) {
      setError(err.message || 'Impossible de charger le journal d\'audit.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterAction, filterStatus, filterCategory]);

  useEffect(() => {
    const timer = setTimeout(loadLogs, searchQuery ? 400 : 0);
    return () => clearTimeout(timer);
  }, [loadLogs, searchQuery, filterAction, filterStatus, filterCategory]);

  const actionOptions = ['ALL', ...new Set(logs.map((l) => l.action).filter(Boolean))];

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-gradient-to-r from-slate-900 via-gray-900 to-zinc-900 p-6 rounded-2xl text-white shadow-xl border border-white/10 space-y-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-500/20 text-slate-300 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Traçabilité entreprise — qui, quoi, quand, où
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="text-emerald-400" />
            Journal d&apos;Audit
          </h1>
          <p className="text-gray-300 text-sm mt-1">
            {businessName
              ? `Registre chronologique des actions critiques pour « ${businessName} ».`
              : 'Registre chronologique des actions critiques de votre établissement.'}
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Sécurité</p>
              <p className="text-gray-400 mt-0.5">Accès non autorisés et comportements suspects.</p>
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex gap-2">
            <Scale className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Conformité</p>
              <p className="text-gray-400 mt-0.5">Qui a fait quoi, quand et depuis où.</p>
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex gap-2">
            <Wrench className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Résolution</p>
              <p className="text-gray-400 mt-0.5">Historique des changements pour diagnostiquer.</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border flex flex-col lg:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher auteur, action, cible ou IP…"
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-xl text-xs font-semibold outline-none"
          >
            <option value="ALL">Toutes catégories</option>
            <option value="ACCESS">Accès</option>
            <option value="SECURITY">Sécurité / RBAC</option>
            <option value="BILLING">Paiement</option>
            <option value="DATA_CHANGE">Création / Modif. / Suppression</option>
            <option value="DATA_EXPORT">Export</option>
            <option value="OTHER">Autres</option>
          </select>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-xl text-xs font-semibold outline-none"
          >
            {actionOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'ALL' ? 'Tous les types d\'action' : actionLabel(opt)}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-xl text-xs font-semibold outline-none"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="SUCCESS">Succès</option>
            <option value="FAILED">Échec</option>
            <option value="WARNING">Avertissement</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">Chargement du journal…</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm px-4">
            Aucun événement d&apos;audit. Les connexions, créations, modifications et suppressions apparaîtront ici.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b text-[11px] font-bold text-gray-400 uppercase bg-gray-50/50 dark:bg-gray-800/40">
                  <th className="py-3 px-4">Quand (UTC)</th>
                  <th className="py-3 px-4">Qui</th>
                  <th className="py-3 px-4">Quoi</th>
                  <th className="py-3 px-4">Où</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 cursor-pointer"
                    onClick={() => setActiveLog(log)}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono text-[11px] text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        {log.created_at_utc || (log.created_at ? new Date(log.created_at).toISOString() : '—')}
                      </div>
                      {log.created_at && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Local : {new Date(log.created_at).toLocaleString('fr-FR')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-900 dark:text-white">{log.user_name || log.user_email || 'Système'}</div>
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5">{log.user_email || '—'}</div>
                      <div className="text-[10px] mt-0.5">
                        <span className="font-bold text-emerald-700">{ROLE_LABELS[log.user_role] || log.user_role || '—'}</span>
                        {log.user_id && (
                          <span className="text-gray-400 font-mono"> · ID {String(log.user_id).slice(0, 8)}…</span>
                        )}
                      </div>
                      {log.impersonation && (
                        <div className="mt-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 inline-block">
                          Impersonnalisation
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="mb-1">{categoryBadge(log.event_category)}</div>
                      <div className="font-bold text-gray-900 dark:text-white">{actionLabel(log.action)}</div>
                      <div className="text-gray-600 dark:text-gray-300 max-w-xs truncate" title={log.resource || ''}>
                        {log.resource || '—'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-[11px] flex items-center gap-1 text-gray-600">
                        <Laptop className="w-3.5 h-3.5 text-emerald-500" />
                        {log.ip_address || '—'}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {log.geo_location || 'Localisation non renseignée'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {statusBadge(log.status)}
                      {log.error_code && (
                        <div className="text-[10px] text-rose-600 font-mono mt-1">Err {log.error_code}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={(e) => { e.stopPropagation(); setActiveLog(log); }}
                        title="Voir le détail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-slate-900 to-zinc-900 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Détail de l&apos;action critique</h3>
                <p className="text-xs text-slate-300 font-mono mt-0.5">ID : {activeLog.id}</p>
              </div>
              <button type="button" onClick={() => setActiveLog(null)} className="icon-btn">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              <section className="space-y-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Qui ?
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-xl border">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Nom</span>
                    <p className="font-semibold mt-1">{activeLog.user_name || '—'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border">
                    <span className="text-[10px] uppercase font-bold text-gray-400">E-mail</span>
                    <p className="font-mono mt-1">{activeLog.user_email || '—'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border">
                    <span className="text-[10px] uppercase font-bold text-gray-400">ID unique</span>
                    <p className="font-mono mt-1 break-all">{activeLog.user_id || '—'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Rôle</span>
                    <p className="font-semibold mt-1">{ROLE_LABELS[activeLog.user_role] || activeLog.user_role || '—'}</p>
                  </div>
                </div>
                {activeLog.impersonation && (
                  <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-950">
                    <p className="font-bold">Impersonnalisation</p>
                    <p className="mt-1">
                      {activeLog.impersonation.impersonated_by || 'support'} → {activeLog.impersonation.on_behalf_of || activeLog.user_email}
                    </p>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Quoi ?
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-xl border">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Type d&apos;événement</span>
                    <p className="font-bold mt-1">{actionLabel(activeLog.action)}</p>
                    <div className="mt-1">{categoryBadge(activeLog.event_category)}</div>
                    <p className="font-mono text-[10px] text-gray-400 mt-1">{activeLog.action}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Cible / objet</span>
                    <p className="font-medium mt-1 break-words">{activeLog.resource || '—'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Statut</span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {statusBadge(activeLog.status)}
                      {activeLog.error_code && <span className="font-mono text-rose-700">Code : {activeLog.error_code}</span>}
                    </div>
                    {activeLog.error_message && <p className="mt-2 text-rose-700">{activeLog.error_message}</p>}
                  </div>
                </div>
                {formatChanges(activeLog.changes) && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                      <span className="text-[10px] uppercase font-bold text-rose-700">Ancien état</span>
                      <pre className="mt-1 font-mono text-[11px] whitespace-pre-wrap break-all">{stringifyVal(formatChanges(activeLog.changes).old)}</pre>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-700">Nouvel état</span>
                      <pre className="mt-1 font-mono text-[11px] whitespace-pre-wrap break-all">{stringifyVal(formatChanges(activeLog.changes).new)}</pre>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Quand &amp; Où ?
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-xl border">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Horodatage UTC</span>
                    <p className="font-mono font-medium mt-1">{activeLog.created_at_utc || '—'}</p>
                    {activeLog.created_at && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        Local : {new Date(activeLog.created_at).toLocaleString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Adresse IP</span>
                    <p className="font-mono font-bold mt-1 flex items-center gap-1.5">
                      <Laptop className="w-3.5 h-3.5 text-emerald-500" />
                      {activeLog.ip_address || '—'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Localisation</span>
                    <p className="mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      {activeLog.geo_location || 'Non renseignée'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Agent utilisateur</span>
                    <p className="font-mono text-[11px] text-gray-600 mt-1 break-all">
                      {activeLog.user_agent || '—'}
                    </p>
                  </div>
                </div>
              </section>

              {activeLog.details && Object.keys(activeLog.details).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Détails techniques</span>
                  <div className="bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-[11px] overflow-x-auto">
                    <pre>{JSON.stringify(activeLog.details, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setActiveLog(null)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
