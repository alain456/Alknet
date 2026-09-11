import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Lock, Clock, Search, Filter, AlertCircle,
} from 'lucide-react';
import hospitalService from '../hospitalService';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

const ACTION_LABELS = {
  APPOINTMENT_BOOKED: 'Demande RDV',
  APPOINTMENT_CONFIRMED: 'RDV confirmé',
  APPOINTMENT_REJECTED: 'RDV refusé',
  APPOINTMENT_CHECK_IN: 'Arrivée patient',
  APPOINTMENT_COMPLETED: 'Consultation terminée',
  APPOINTMENT_CANCELLED: 'RDV annulé',
  LOGIN: 'Connexion',
  LOGIN_FAILED: 'Échec connexion',
};

export default function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (filterAction !== 'ALL') params.action = filterAction;
      const data = await hospitalService.getHospitalAuditLogs(params);
      setLogs(normalizeList(data));
    } catch (err) {
      setError(err.message || 'Impossible de charger le journal d\'audit.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterAction]);

  useEffect(() => {
    const timer = setTimeout(loadLogs, searchQuery ? 400 : 0);
    return () => clearTimeout(timer);
  }, [loadLogs, searchQuery, filterAction]);

  const actionOptions = ['ALL', ...new Set(logs.map((l) => l.action).filter(Boolean))];

  const getActionBadge = (action) => {
    const label = ACTION_LABELS[action] || action.replace(/_/g, ' ');
    const color = action?.includes('FAILED') || action?.includes('REJECTED')
      ? 'bg-red-100 text-red-700'
      : action?.includes('APPOINTMENT')
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-700';
    return (
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>{label}</span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-gray-900 to-zinc-900 p-6 rounded-2xl text-white shadow-xl border border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-500/20 text-slate-300 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Données en direct — journal PostgreSQL
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="text-emerald-400" />
            Journal d&apos;Audit & Accès
          </h1>
          <p className="text-gray-300 text-sm mt-1">Événements réels enregistrés par le système pour votre établissement.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher utilisateur, action ou ressource..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-xl text-xs font-semibold outline-none"
          >
            {actionOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'ALL' ? 'Toutes les actions' : (ACTION_LABELS[opt] || opt)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">Chargement du journal...</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            Aucun événement d&apos;audit pour cet établissement. Les actions (RDV, connexions…) apparaîtront ici automatiquement.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-[11px] font-bold text-gray-400 uppercase bg-gray-50/50">
                  <th className="py-3 px-6">Horodatage</th>
                  <th className="py-3 px-6">Utilisateur</th>
                  <th className="py-3 px-6">Action</th>
                  <th className="py-3 px-6">Ressource</th>
                  <th className="py-3 px-6 text-right">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {logs.map((log) => {
                  const dateFormatted = new Date(log.created_at).toLocaleString('fr-FR');
                  const userName = log.user_name || log.user_email || '—';
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="py-3.5 px-6 font-mono text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {dateFormatted}
                        </div>
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-gray-900 dark:text-white">{userName}</div>
                        <div className="text-[11px] text-gray-400">{log.user_role || '—'}</div>
                      </td>
                      <td className="py-3.5 px-6">{getActionBadge(log.action)}</td>
                      <td className="py-3.5 px-6 text-gray-700 dark:text-gray-300 max-w-xs truncate">{log.resource || '—'}</td>
                      <td className="py-3.5 px-6 text-right font-mono text-gray-400">{log.ip_address || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
