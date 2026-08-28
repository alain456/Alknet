import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Search, Filter, Clock, Activity, AlertTriangle, 
  CheckCircle2, XCircle, Download, RefreshCw, Eye, User, FileText, 
  Terminal, ShieldAlert, Laptop, Server, ChevronRight, X, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminAuditLogsPage() {
  const { authFetch } = useAuth();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total_logs: 0,
    failed_logins_24h: 0,
    admin_actions_24h: 0,
    active_users_24h: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  
  // Selected log detail modal
  const [activeLogModal, setActiveLogModal] = useState(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append('search', searchQuery);
      if (selectedAction !== 'ALL') queryParams.append('action', selectedAction);
      if (selectedStatus !== 'ALL') queryParams.append('status', selectedStatus);
      if (selectedRole !== 'ALL') queryParams.append('role', selectedRole);

      const response = await authFetch(`/api/v1/accounts/admin/audit-logs/?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération du journal d\'audit');
      }


      const data = await response.json();
      if (Array.isArray(data)) {
        setLogs(data);
      } else if (data.results) {
        setLogs(data.results);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Fetch audit logs error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [selectedAction, selectedStatus, selectedRole]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAuditLogs();
  };

  // Export to CSV helper
  const exportToCSV = () => {
    if (!logs || logs.length === 0) return;

    const headers = ['ID', 'Horodatage', 'Utilisateur', 'Email', 'Role', 'Action', 'Ressource', 'Statut', 'IP'];
    const rows = logs.map(log => [
      log.id,
      new Date(log.created_at).toLocaleString('fr-FR'),
      log.user_name || '',
      log.user_email || '',
      log.user_role || '',
      log.action || '',
      `"${(log.resource || '').replace(/"/g, '""')}"`,
      log.status || '',
      log.ip_address || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `journal_audit_superadmin_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Succès
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Échec
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Avertissement
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  const getActionBadge = (action) => {
    if (action.startsWith('LOGIN_SUCCESS')) {
      return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Connexion</span>;
    }
    if (action.startsWith('LOGIN_FAILED')) {
      return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">Connexion Échouée</span>;
    }
    if (action.includes('ADMIN') || action.includes('USER_CREATED') || action.includes('USER_UPDATED')) {
      return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Action Admin</span>;
    }
    if (action.includes('BUSINESS')) {
      return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">Établissement</span>;
    }
    if (action.includes('SENSITIVE')) {
      return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Données Sensibles</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">{action}</span>;
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-green-950 p-6 md:p-8 rounded-3xl text-white shadow-2xl border border-emerald-500/20">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Traçabilité Global Platform & Sécurité Super Admin</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-white flex items-center gap-3">
              <Lock className="text-emerald-400 w-7 h-7" />
              Journal d'Audit & Traçabilité des Accès
            </h1>
            <p className="text-slate-300 text-sm mt-2 max-w-2xl">
              Consultez l'historique exhaustif des connexions, des modifications administratives et de l'accès aux ressources critiques sur l'ensemble de la plateforme Isoko Hub.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAuditLogs}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium text-xs backdrop-blur-md transition-all cursor-pointer border border-white/10"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Exporter CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface dark:bg-green-900/60 p-5 rounded-2xl border border-border dark:border-white/10 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-faint dark:text-green-100/60 uppercase tracking-wider">Total Événements</p>
            <p className="text-2xl font-bold text-ink dark:text-white mt-1">{stats.total_logs || logs.length}</p>
          </div>
        </div>

        <div className="bg-surface dark:bg-green-900/60 p-5 rounded-2xl border border-border dark:border-white/10 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-faint dark:text-green-100/60 uppercase tracking-wider">Échecs Connexion (24h)</p>
            <p className="text-2xl font-bold text-ink dark:text-white mt-1">{stats.failed_logins_24h}</p>
          </div>
        </div>

        <div className="bg-surface dark:bg-green-900/60 p-5 rounded-2xl border border-border dark:border-white/10 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center shrink-0">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-faint dark:text-green-100/60 uppercase tracking-wider">Actions Admin (24h)</p>
            <p className="text-2xl font-bold text-ink dark:text-white mt-1">{stats.admin_actions_24h}</p>
          </div>
        </div>

        <div className="bg-surface dark:bg-green-900/60 p-5 rounded-2xl border border-border dark:border-white/10 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-faint dark:text-green-100/60 uppercase tracking-wider">Utilisateurs Actifs (24h)</p>
            <p className="text-2xl font-bold text-ink dark:text-white mt-1">{stats.active_users_24h}</p>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-surface dark:bg-green-900/60 p-5 rounded-2xl border border-border dark:border-white/10 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-ink-faint dark:text-green-100/40" />
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher par email, action, adresse IP ou ressource..."
              className="w-full pl-10 pr-4 py-2.5 bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-xl text-xs text-ink dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Action */}
            <div className="flex items-center gap-2 bg-paper dark:bg-black/20 border border-border dark:border-white/10 px-3 py-1.5 rounded-xl">
              <Filter className="w-3.5 h-3.5 text-ink-faint dark:text-green-100/40" />
              <select
                value={selectedAction}
                onChange={e => setSelectedAction(e.target.value)}
                className="bg-transparent text-xs font-medium text-ink dark:text-white outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-surface dark:bg-slate-900">Toutes les actions</option>
                <option value="LOGIN_SUCCESS" className="bg-surface dark:bg-slate-900">Connexions Réussies</option>
                <option value="LOGIN_FAILED" className="bg-surface dark:bg-slate-900">Connexions Échouées</option>
                <option value="USER_CREATED_BY_ADMIN" className="bg-surface dark:bg-slate-900">Utilisateurs Créés</option>
                <option value="USER_UPDATED_BY_ADMIN" className="bg-surface dark:bg-slate-900">Utilisateurs Modifiés</option>
                <option value="BUSINESS_APPROVED" className="bg-surface dark:bg-slate-900">Approbations d'Établissements</option>
                <option value="ACCESS_SENSITIVE_DATA" className="bg-surface dark:bg-slate-900">Données Sensibles</option>
              </select>
            </div>

            {/* Filter Status */}
            <div className="flex items-center gap-2 bg-paper dark:bg-black/20 border border-border dark:border-white/10 px-3 py-1.5 rounded-xl">
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="bg-transparent text-xs font-medium text-ink dark:text-white outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-surface dark:bg-slate-900">Tous les statuts</option>
                <option value="SUCCESS" className="bg-surface dark:bg-slate-900">Succès</option>
                <option value="FAILED" className="bg-surface dark:bg-slate-900">Échecs</option>
                <option value="WARNING" className="bg-surface dark:bg-slate-900">Avertissements</option>
              </select>
            </div>

            {/* Filter Role */}
            <div className="flex items-center gap-2 bg-paper dark:bg-black/20 border border-border dark:border-white/10 px-3 py-1.5 rounded-xl">
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="bg-transparent text-xs font-medium text-ink dark:text-white outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-surface dark:bg-slate-900">Tous les rôles</option>
                <option value="SUPER_ADMIN" className="bg-surface dark:bg-slate-900">Super Admin</option>
                <option value="BUSINESS_OWNER" className="bg-surface dark:bg-slate-900">Business Owner</option>
                <option value="PROFESSIONAL" className="bg-surface dark:bg-slate-900">Professional</option>
                <option value="CUSTOMER" className="bg-surface dark:bg-slate-900">Customer</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl cursor-pointer transition"
            >
              Filtrer
            </button>
          </div>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="bg-surface dark:bg-green-900/60 rounded-2xl border border-border dark:border-white/10 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-ink-faint dark:text-green-100/60 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
            <p className="text-sm font-medium">Chargement du journal d'audit...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-semibold text-sm">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-ink-faint dark:text-green-100/60 space-y-3">
            <ShieldCheck className="w-12 h-12 mx-auto text-slate-400 opacity-60" />
            <p className="text-sm font-semibold">Aucun événement d'audit trouvé pour ces critères.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border dark:border-white/10 text-[11px] font-bold text-ink-faint dark:text-green-100/50 uppercase tracking-wider bg-paper/50 dark:bg-black/20">
                  <th className="py-3.5 px-6">Date & Heure</th>
                  <th className="py-3.5 px-6">Utilisateur & Rôle</th>
                  <th className="py-3.5 px-6">Type d'Action</th>
                  <th className="py-3.5 px-6">Ressource Visée</th>
                  <th className="py-3.5 px-6">Statut</th>
                  <th className="py-3.5 px-6 font-mono">Adresse IP</th>
                  <th className="py-3.5 px-6 text-right">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-white/10 text-xs">
                {logs.map((log) => {
                  const dateFormatted = new Date(log.created_at).toLocaleString('fr-FR', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                  });
                  return (
                    <tr 
                      key={log.id} 
                      className="hover:bg-paper/80 dark:hover:bg-white/5 transition duration-150 cursor-pointer"
                      onClick={() => setActiveLogModal(log)}
                    >
                      <td className="py-4 px-6">
                        <div className="font-mono text-ink dark:text-white font-medium text-[11px] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          {dateFormatted}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-ink dark:text-white text-xs">{log.user_name || log.user_email}</div>
                        <div className="text-[10.5px] text-ink-faint dark:text-green-100/50 font-mono mt-0.5">
                          {log.user_email} • <span className="text-emerald-600 dark:text-emerald-400 font-bold">{log.user_role}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="py-4 px-6 font-medium text-ink-muted dark:text-green-100/80 max-w-xs truncate">
                        {log.resource}
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="py-4 px-6 font-mono text-ink-faint dark:text-green-100/50 text-[11.5px]">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveLogModal(log);
                          }}
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition"
                          title="Inspecter le log"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {activeLogModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface dark:bg-slate-900 border border-border dark:border-white/10 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-green-950 p-6 text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Détails de l'Événement d'Audit</h3>
                  <p className="text-xs text-slate-300 font-mono mt-0.5">ID: {activeLogModal.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveLogModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-paper dark:bg-black/30 rounded-xl border border-border dark:border-white/10">
                  <span className="text-ink-faint dark:text-green-100/50 text-[10px] uppercase font-bold tracking-wider">Horodatage Précis</span>
                  <p className="font-mono font-medium text-ink dark:text-white mt-1">
                    {new Date(activeLogModal.created_at).toLocaleString('fr-FR', {
                      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </p>
                </div>

                <div className="p-3.5 bg-paper dark:bg-black/30 rounded-xl border border-border dark:border-white/10">
                  <span className="text-ink-faint dark:text-green-100/50 text-[10px] uppercase font-bold tracking-wider">Statut Général</span>
                  <div className="mt-1">{getStatusBadge(activeLogModal.status)}</div>
                </div>

                <div className="p-3.5 bg-paper dark:bg-black/30 rounded-xl border border-border dark:border-white/10">
                  <span className="text-ink-faint dark:text-green-100/50 text-[10px] uppercase font-bold tracking-wider">Utilisateur Identifié</span>
                  <p className="font-semibold text-ink dark:text-white mt-1">{activeLogModal.user_name || activeLogModal.user_email}</p>
                  <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">{activeLogModal.user_email}</p>
                </div>

                <div className="p-3.5 bg-paper dark:bg-black/30 rounded-xl border border-border dark:border-white/10">
                  <span className="text-ink-faint dark:text-green-100/50 text-[10px] uppercase font-bold tracking-wider">Adresse IP / Origine</span>
                  <p className="font-mono font-bold text-ink dark:text-white mt-1 flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-emerald-500" />
                    {activeLogModal.ip_address || '127.0.0.1'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-paper dark:bg-black/30 rounded-xl border border-border dark:border-white/10 text-xs">
                <span className="text-ink-faint dark:text-green-100/50 text-[10px] uppercase font-bold tracking-wider">Ressource Concernée</span>
                <p className="font-medium text-ink dark:text-white mt-1">{activeLogModal.resource}</p>
              </div>

              {activeLogModal.user_agent && (
                <div className="p-3.5 bg-paper dark:bg-black/30 rounded-xl border border-border dark:border-white/10 text-xs">
                  <span className="text-ink-faint dark:text-green-100/50 text-[10px] uppercase font-bold tracking-wider">User-Agent (Navigateur / OS)</span>
                  <p className="font-mono text-[11px] text-ink-muted dark:text-green-100/70 mt-1 break-all">{activeLogModal.user_agent}</p>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-ink-faint dark:text-green-100/50 text-[10px] uppercase font-bold tracking-wider">Payload / Détails Techniques JSON</span>
                <div className="bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-[11.5px] overflow-x-auto border border-emerald-500/20">
                  <pre>{JSON.stringify(activeLogModal.details || {}, null, 2)}</pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-paper dark:bg-black/20 border-t border-border dark:border-white/10 flex justify-end">
              <button
                onClick={() => setActiveLogModal(null)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-xs cursor-pointer transition"
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
