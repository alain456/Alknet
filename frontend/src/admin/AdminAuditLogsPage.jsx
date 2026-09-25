import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, Lock, Search, Filter, Clock, Activity, AlertTriangle,
  CheckCircle2, XCircle, Download, RefreshCw, Eye, User, FileText,
  Terminal, ShieldAlert, Laptop, X, MapPin, KeyRound, CreditCard,
  Database, Webhook, UserCog, Globe, Building2, Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const FALLBACK_ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  PLATFORM_FINANCE: 'Finance plateforme',
  PLATFORM_MODERATION: 'Modération',
  PLATFORM_SUPPORT: 'Support',
  PLATFORM_CONTENT: 'Contenu',
  BUSINESS_OWNER: 'Admin entreprise',
  PROFESSIONAL: 'Professionnel / Staff',
  CUSTOMER: 'Utilisateur standard',
  ANONYMOUS: 'Anonyme',
};

const PLATFORM_ROLE_KEYS = [
  { key: 'SUPER_ADMIN', code: 'super_admin' },
  { key: 'PLATFORM_FINANCE', code: 'finance' },
  { key: 'PLATFORM_MODERATION', code: 'moderation' },
  { key: 'PLATFORM_SUPPORT', code: 'support' },
  { key: 'PLATFORM_CONTENT', code: 'content' },
];

const BUSINESS_ROLES = [
  'BUSINESS_OWNER',
  'PROFESSIONAL',
  'CUSTOMER',
  'ANONYMOUS',
];

const CATEGORY_META = {
  ACCESS: { label: 'Gestion des accès', icon: KeyRound, color: 'bg-blue-50 text-blue-800 border-blue-200' },
  SECURITY: { label: 'Sécurité / RBAC', icon: UserCog, color: 'bg-purple-50 text-purple-800 border-purple-200' },
  BILLING: { label: 'Facturation', icon: CreditCard, color: 'bg-amber-50 text-amber-900 border-amber-200' },
  DATA_EXPORT: { label: 'Export de données', icon: Database, color: 'bg-rose-50 text-rose-800 border-rose-200' },
  INTEGRATIONS: { label: 'Intégrations', icon: Webhook, color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  DATA_CHANGE: { label: 'Création / Modif. / Suppression', icon: FileText, color: 'bg-slate-50 text-slate-800 border-slate-200' },
  OTHER: { label: 'Autre', icon: Activity, color: 'bg-gray-50 text-gray-700 border-gray-200' },
};

function formatChanges(changes) {
  if (!changes) return null;
  if (typeof changes !== 'object') return String(changes);
  if ('old' in changes || 'new' in changes) {
    return { old: changes.old, new: changes.new };
  }
  return changes;
}

function stringifyVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

export default function AdminAuditLogsPage() {
  const { authFetch, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const scopeRaw = (searchParams.get('scope') || '').toLowerCase();
  const scope = scopeRaw === 'platform' ? 'platform' : 'business';
  const isPlatformScope = scope === 'platform';

  const roleLabelMap = (() => {
    const map = { ...FALLBACK_ROLE_LABELS };
    (user?.platform_roles || []).forEach((row) => {
      const hit = PLATFORM_ROLE_KEYS.find((item) => item.code === row.code);
      if (hit && row.name) map[hit.key] = row.name;
    });
    return map;
  })();

  const roleOptions = isPlatformScope
    ? PLATFORM_ROLE_KEYS.map((item) => ({
      value: item.key,
      label: roleLabelMap[item.key] || item.key,
    }))
    : BUSINESS_ROLES.map((key) => ({
      value: key,
      label: roleLabelMap[key] || key,
    }));

  const labelForRole = (roleKey, log) => (
    log?.user_role_label || roleLabelMap[roleKey] || roleKey || '—'
  );

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total_logs: 0,
    failed_logins_24h: 0,
    admin_actions_24h: 0,
    active_users_24h: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeLogModal, setActiveLogModal] = useState(null);

  useEffect(() => {
    if (scopeRaw !== 'platform' && scopeRaw !== 'business') {
      setSearchParams({ scope: 'platform' }, { replace: true });
    }
  }, [scopeRaw, setSearchParams]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('scope', scope);
      if (searchQuery) queryParams.append('search', searchQuery);
      if (selectedAction !== 'ALL') queryParams.append('action', selectedAction);
      if (selectedStatus !== 'ALL') queryParams.append('status', selectedStatus);
      if (selectedRole !== 'ALL') queryParams.append('role', selectedRole);
      if (selectedCategory !== 'ALL') queryParams.append('category', selectedCategory);

      const response = await authFetch(`/api/v1/accounts/admin/audit-logs/?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Erreur lors de la récupération du journal d\'audit');

      const data = await response.json();
      if (Array.isArray(data)) {
        setLogs(data);
      } else if (data.results) {
        setLogs(data.results);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [selectedAction, selectedStatus, selectedRole, selectedCategory, scope]);

  const setScope = (next) => {
    setSearchParams({ scope: next });
    setSelectedRole('ALL');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAuditLogs();
  };

  const exportToCSV = () => {
    if (!logs?.length) return;
    const headers = [
      'ID', 'UTC', 'User ID', 'Nom', 'Email', 'Rôle', 'Impersonation',
      'Action', 'Catégorie', 'Cible', 'Statut', 'Code erreur', 'IP', 'Localisation', 'User-Agent',
    ];
    const rows = logs.map((log) => [
      log.id,
      log.created_at_utc || log.created_at || '',
      log.user_id || '',
      log.user_name || '',
      log.user_email || '',
      log.user_role_label || log.user_role || '',
      log.impersonation ? `Oui (${log.impersonation.impersonated_by || ''} → ${log.impersonation.on_behalf_of || ''})` : 'Non',
      log.action || '',
      log.event_category || '',
      `"${(log.resource || '').replace(/"/g, '""')}"`,
      log.status || '',
      log.error_code || '',
      log.ip_address || '',
      log.geo_location || '',
      `"${(log.user_agent || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,'
      + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `journal_audit_${scope}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    if (status === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> Succès
        </span>
      );
    }
    if (status === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <XCircle className="w-3.5 h-3.5" /> Échec
        </span>
      );
    }
    if (status === 'WARNING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5" /> Avertissement
        </span>
      );
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100">{status}</span>;
  };

  const categoryBadge = (cat) => {
    const meta = CATEGORY_META[cat] || CATEGORY_META.OTHER;
    const Icon = meta.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.color}`}>
        <Icon className="w-3 h-3" /> {meta.label}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-16">
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-green-950 p-6 md:p-8 rounded-3xl text-white shadow-2xl border border-emerald-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {isPlatformScope
                ? 'Actions des acteurs plateforme (Super Admin, Finance, Modération…)'
                : 'Actions des acteurs entreprises (propriétaires, staff, clients)'}
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-white flex items-center gap-3">
              {isPlatformScope
                ? <Shield className="text-emerald-400 w-7 h-7" />
                : <Building2 className="text-emerald-400 w-7 h-7" />}
              {isPlatformScope ? 'Audit plateforme' : 'Audit entreprises'}
            </h1>
            <p className="text-slate-300 text-sm mt-2 max-w-3xl">
              {isPlatformScope
                ? 'Connexions et décisions des comptes Isoko Hub (rôles plateforme, modération, facturation SaaS).'
                : 'Connexions et actions des comptes rattachés aux tenants (entreprises, staff, clients).'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchAuditLogs}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium text-xs border border-white/10"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              type="button"
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs"
            >
              <Download className="w-4 h-4" />
              Exporter CSV
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5 relative z-10">
          <button
            type="button"
            onClick={() => setScope('platform')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition ${
              isPlatformScope
                ? 'bg-emerald-500/30 border-emerald-400/50 text-white'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Acteurs plateforme
          </button>
          <button
            type="button"
            onClick={() => setScope('business')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition ${
              !isPlatformScope
                ? 'bg-emerald-500/30 border-emerald-400/50 text-white'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> Acteurs entreprises
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-6 relative z-10">
          {[
            { key: 'ACCESS', tip: 'Connexions, déconnexions, 2FA, mots de passe' },
            { key: 'SECURITY', tip: 'Rôles, invitations admin, permissions RBAC' },
            { key: 'BILLING', tip: 'Forfaits, paiements, factures' },
            { key: 'DATA_EXPORT', tip: 'Téléchargements massifs / rapports' },
            { key: 'INTEGRATIONS', tip: 'Clés API, webhooks, OAuth' },
          ].map(({ key, tip }) => {
            const meta = CATEGORY_META[key];
            const Icon = meta.icon;
            const active = selectedCategory === key;
            return (
              <button
                key={key}
                type="button"
                title={tip}
                onClick={() => setSelectedCategory(active ? 'ALL' : key)}
                className={`text-left rounded-xl border px-3 py-2.5 transition ${
                  active ? 'bg-emerald-500/30 border-emerald-400/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Icon className="w-3.5 h-3.5 text-emerald-300" /> {meta.label}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{tip}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider">
              {isPlatformScope ? 'Événements plateforme' : 'Événements entreprises'}
            </p>
            <p className="text-2xl font-bold text-ink mt-1">{stats.total_logs || logs.length}</p>
          </div>
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Échecs connexion (24h)</p>
            <p className="text-2xl font-bold text-ink mt-1">{stats.failed_logins_24h}</p>
          </div>
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider">
              {isPlatformScope ? 'Actions admin plateforme (24h)' : 'Actions admin entreprises (24h)'}
            </p>
            <p className="text-2xl font-bold text-ink mt-1">{stats.admin_actions_24h}</p>
          </div>
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider">
              {isPlatformScope ? 'Acteurs plateforme actifs (24h)' : 'Acteurs entreprises actifs (24h)'}
            </p>
            <p className="text-2xl font-bold text-ink mt-1">{stats.active_users_24h}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface p-5 rounded-2xl border border-border space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-ink-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher email, ID, action, IP, cible…"
              className="w-full pl-10 pr-4 py-2.5 bg-paper border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-paper border border-border px-3 py-1.5 rounded-xl">
              <Filter className="w-3.5 h-3.5 text-ink-faint" />
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-transparent text-xs font-medium outline-none">
                <option value="ALL">Toutes catégories critiques</option>
                <option value="ACCESS">Gestion des accès</option>
                <option value="SECURITY">Sécurité / RBAC</option>
                <option value="BILLING">Facturation</option>
                <option value="DATA_EXPORT">Export de données</option>
                <option value="INTEGRATIONS">Intégrations</option>
                <option value="DATA_CHANGE">Création / Modif. / Suppression</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-paper border border-border px-3 py-1.5 rounded-xl">
              <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)} className="bg-transparent text-xs font-medium outline-none">
                <option value="ALL">Toutes les actions</option>
                <option value="LOGIN_SUCCESS">Connexions réussies</option>
                <option value="LOGIN_FAILED">Connexions échouées</option>
                <option value="USER_CREATED_BY_ADMIN">Utilisateurs créés</option>
                <option value="USER_UPDATED_BY_ADMIN">Utilisateurs modifiés</option>
                <option value="BUSINESS_APPROVED">Approbations établissements</option>
                <option value="ACCESS_SENSITIVE_DATA">Données sensibles</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-paper border border-border px-3 py-1.5 rounded-xl">
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="bg-transparent text-xs font-medium outline-none">
                <option value="ALL">Tous les statuts</option>
                <option value="SUCCESS">Succès</option>
                <option value="FAILED">Échecs</option>
                <option value="WARNING">Avertissements</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-paper border border-border px-3 py-1.5 rounded-xl">
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="bg-transparent text-xs font-medium outline-none">
                <option value="ALL">{isPlatformScope ? 'Tous les rôles plateforme' : 'Tous les rôles entreprises'}</option>
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl">
              Filtrer
            </button>
          </div>
        </form>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-ink-faint space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
            <p className="text-sm font-medium">Chargement du journal d&apos;audit…</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-semibold text-sm">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-ink-faint space-y-3">
            <ShieldCheck className="w-12 h-12 mx-auto text-slate-400 opacity-60" />
            <p className="text-sm font-semibold">Aucun événement d&apos;audit pour ces critères.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="border-b border-border text-[11px] font-bold text-ink-faint uppercase tracking-wider bg-paper/50">
                  <th className="py-3.5 px-4">Quand (UTC)</th>
                  <th className="py-3.5 px-4">Qui (identité)</th>
                  <th className="py-3.5 px-4">Quoi (action / cible)</th>
                  <th className="py-3.5 px-4">Où</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4 text-right">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-paper/80 transition cursor-pointer"
                    onClick={() => setActiveLogModal(log)}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono text-[11px] font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        {log.created_at_utc || new Date(log.created_at).toISOString()}
                      </div>
                      <div className="text-[10px] text-ink-faint mt-0.5">
                        Local : {new Date(log.created_at).toLocaleString('fr-FR')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-ink">{log.user_name || log.user_email || '—'}</div>
                      <div className="text-[10.5px] text-ink-faint font-mono mt-0.5">{log.user_email}</div>
                      <div className="text-[10px] mt-0.5">
                        <span className="font-bold text-emerald-700">{labelForRole(log.user_role, log)}</span>
                        {log.user_id && <span className="text-ink-faint font-mono"> · ID {String(log.user_id).slice(0, 8)}…</span>}
                      </div>
                      {log.impersonation && (
                        <div className="mt-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 inline-block">
                          Impersonnalisation : {log.impersonation.impersonated_by || 'support'} → {log.impersonation.on_behalf_of || log.user_email}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="mb-1">{categoryBadge(log.event_category)}</div>
                      <div className="font-bold text-ink">{log.action}</div>
                      <div className="text-ink-muted max-w-xs truncate" title={log.resource}>{log.resource || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-[11px] flex items-center gap-1">
                        <Laptop className="w-3.5 h-3.5 text-emerald-500" />
                        {log.ip_address || '—'}
                      </div>
                      <div className="text-[10px] text-ink-faint mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {log.geo_location || 'Localisation non renseignée'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(log.status)}
                      {log.error_code && (
                        <div className="text-[10px] text-rose-600 font-mono mt-1">Err {log.error_code}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActiveLogModal(log); }}
                        className="icon-btn"
                        title="Inspecter"
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

      {activeLogModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-slate-900 to-green-950 p-6 text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Détail événement d&apos;audit</h3>
                  <p className="text-xs text-slate-300 font-mono mt-0.5">ID événement : {activeLogModal.id}</p>
                </div>
              </div>
              <button type="button" onClick={() => setActiveLogModal(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              {/* 1. Qui */}
              <section className="space-y-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> 1. Identification (Qui ?)
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-paper rounded-xl border border-border">
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Nom</span>
                    <p className="font-semibold mt-1">{activeLogModal.user_name || '—'}</p>
                  </div>
                  <div className="p-3 bg-paper rounded-xl border border-border">
                    <span className="text-[10px] uppercase font-bold text-ink-faint">E-mail</span>
                    <p className="font-mono mt-1">{activeLogModal.user_email || '—'}</p>
                  </div>
                  <div className="p-3 bg-paper rounded-xl border border-border">
                    <span className="text-[10px] uppercase font-bold text-ink-faint">ID unique</span>
                    <p className="font-mono mt-1 break-all">{activeLogModal.user_id || '—'}</p>
                  </div>
                  <div className="p-3 bg-paper rounded-xl border border-border">
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Type de rôle</span>
                    <p className="font-semibold mt-1">{labelForRole(activeLogModal.user_role, activeLogModal)}</p>
                  </div>
                </div>
                {activeLogModal.impersonation ? (
                  <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-950">
                    <p className="font-bold">Impersonnalisation active</p>
                    <p className="mt-1">
                      Support / acteur : <strong>{activeLogModal.impersonation.impersonated_by || '—'}</strong>
                      {' '}au nom de <strong>{activeLogModal.impersonation.on_behalf_of || activeLogModal.user_email}</strong>
                    </p>
                    {activeLogModal.impersonation.reason && (
                      <p className="mt-1 text-amber-800">Motif : {activeLogModal.impersonation.reason}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-ink-faint italic">Aucune impersonnalisation signalée.</p>
                )}
              </section>

              {/* 2. Quoi */}
              <section className="space-y-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> 2. Détails de l&apos;action (Quoi ?)
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-paper rounded-xl border border-border">
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Type d&apos;événement</span>
                    <p className="font-bold mt-1">{activeLogModal.action}</p>
                    <div className="mt-1">{categoryBadge(activeLogModal.event_category)}</div>
                  </div>
                  <div className="p-3 bg-paper rounded-xl border border-border">
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Cible de l&apos;action</span>
                    <p className="font-medium mt-1 break-words">{activeLogModal.resource || '—'}</p>
                  </div>
                  <div className="p-3 bg-paper rounded-xl border border-border sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Statut du résultat</span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {getStatusBadge(activeLogModal.status)}
                      {activeLogModal.error_code && (
                        <span className="font-mono text-rose-700 text-[11px]">Code : {activeLogModal.error_code}</span>
                      )}
                    </div>
                    {activeLogModal.error_message && (
                      <p className="mt-2 text-rose-700">{activeLogModal.error_message}</p>
                    )}
                  </div>
                </div>
                {formatChanges(activeLogModal.changes) && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                      <span className="text-[10px] uppercase font-bold text-rose-700">Ancien état</span>
                      <pre className="mt-1 font-mono text-[11px] whitespace-pre-wrap break-all">{stringifyVal(formatChanges(activeLogModal.changes).old)}</pre>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-700">Nouvel état</span>
                      <pre className="mt-1 font-mono text-[11px] whitespace-pre-wrap break-all">{stringifyVal(formatChanges(activeLogModal.changes).new)}</pre>
                    </div>
                  </div>
                )}
              </section>

              {/* 3. Quand & Où */}
              <section className="space-y-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> 3. Temporel & géographique (Quand & Où ?)
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-paper rounded-xl border border-border">
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Horodatage UTC</span>
                    <p className="font-mono font-medium mt-1">{activeLogModal.created_at_utc || '—'}</p>
                    <p className="text-[10px] text-ink-faint mt-1">
                      Local : {new Date(activeLogModal.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <div className="p-3 bg-paper rounded-xl border border-border">
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Adresse IP</span>
                    <p className="font-mono font-bold mt-1 flex items-center gap-1.5">
                      <Laptop className="w-3.5 h-3.5 text-emerald-500" />
                      {activeLogModal.ip_address || '—'}
                    </p>
                  </div>
                  <div className="p-3 bg-paper rounded-xl border border-border">
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Localisation estimée</span>
                    <p className="mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      {activeLogModal.geo_location || 'Non renseignée'}
                    </p>
                  </div>
                  <div className="p-3 bg-paper rounded-xl border border-border sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Agent utilisateur (navigateur / OS / appareil)</span>
                    <p className="font-mono text-[11px] text-ink-muted mt-1 break-all">
                      {activeLogModal.user_agent || '—'}
                    </p>
                  </div>
                </div>
              </section>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-ink-faint tracking-wider">Payload technique (JSON)</span>
                <div className="bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-[11.5px] overflow-x-auto border border-emerald-500/20">
                  <pre>{JSON.stringify(activeLogModal.details || {}, null, 2)}</pre>
                </div>
              </div>
            </div>

            <div className="p-4 bg-paper border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setActiveLogModal(null)}
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
