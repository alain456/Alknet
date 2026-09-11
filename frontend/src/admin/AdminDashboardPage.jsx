import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DataSummaryCard from './components/DataSummaryCard';
import AdminChartCard from './components/AdminChartCard';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';

const STATUS_LABELS = {
  APPROVED: 'Approuvée',
  PENDING: 'En attente',
  REJECTED: 'Rejetée',
};

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.get('analytics/dashboard-stats/', { auth: true });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Échec du chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-error rounded-md border border-error/20">
        <h3 className="font-semibold">Erreur de chargement</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const recentActivity = data?.recent_activity || [];
  const recentBusinesses = data?.recent_businesses || [];
  const growth = data?.growth_businesses || [];
  const growthMax = data?.growth_max || 1;
  const acquisition = data?.acquisition || [];

  const trendUsers = Number(metrics.users_trend || 0);
  const trendBiz = Number(metrics.businesses_trend || 0);

  return (
    <div className="space-y-8 max-w-350 mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-green-900 dark:text-white tracking-tight">Vue d&apos;ensemble</h1>
          <p className="text-[15px] text-ink-muted dark:text-green-100/70 mt-1">
            Données réelles de la plateforme
            {data?.generated_at ? ` · maj ${new Date(data.generated_at).toLocaleString('fr-FR')}` : ''}.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/payments"
            className="px-4 py-2 text-[14px] font-semibold bg-surface dark:bg-transparent border-[1.5px] border-border dark:border-white/20 text-green-700 dark:text-green-100 rounded-md hover:bg-green-50 dark:hover:bg-white/5 transition-colors shadow-sm"
          >
            Abonnements / paiements
          </Link>
          <Link
            to="/admin/businesses"
            className="px-4 py-2 text-[14px] font-semibold bg-surface dark:bg-transparent border-[1.5px] border-border dark:border-white/20 text-green-700 dark:text-green-100 rounded-md hover:bg-green-50 dark:hover:bg-white/5 transition-colors shadow-sm"
          >
            Entreprises
          </Link>
          <Link
            to="/admin/analytics"
            className="px-4 py-2 text-[14px] font-semibold bg-green-700 text-white rounded-md hover:bg-green-900 transition-colors shadow-sm"
          >
            Voir Analytique
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <DataSummaryCard
          title="Utilisateurs actifs"
          value={Number(metrics.total_active_users || 0).toLocaleString('fr-BI')}
          trend={trendUsers >= 0 ? 'up' : 'down'}
          trendValue={`${trendUsers >= 0 ? '+' : ''}${trendUsers}%`}
          trendLabel="vs mois précédent"
        />
        <DataSummaryCard
          title="Entreprises actives"
          value={Number(metrics.active_businesses || 0).toLocaleString('fr-BI')}
          trend={trendBiz >= 0 ? 'up' : 'down'}
          trendValue={`${trendBiz >= 0 ? '+' : ''}${trendBiz}%`}
          trendLabel={`${metrics.pending_businesses || 0} en modération`}
        />
        <DataSummaryCard
          title="Services actifs"
          value={Number(metrics.services_active || 0).toLocaleString('fr-BI')}
          trend="up"
          trendValue={`${metrics.services_total || 0} au total`}
          trendLabel="catalogue plateforme"
        />
        <DataSummaryCard
          title="Activité du mois"
          value={Number(
            (metrics.appointments_month || 0)
            + (metrics.retail_orders_month || 0)
            + (metrics.wholesale_orders_month || 0)
          ).toLocaleString('fr-BI')}
          trend="up"
          trendValue={`${metrics.appointments_pending || 0} RDV en attente`}
          trendLabel="RDV + commandes pharma"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AdminChartCard
            title="Nouvelles entreprises"
            subtitle="Inscriptions sur les 12 derniers mois"
          >
            <div className="absolute inset-x-0 bottom-0 h-40 flex items-end gap-2 p-2">
              {growth.map((g) => {
                const h = Math.max(8, Math.round((g.count / growthMax) * 100));
                return (
                  <div
                    key={g.month}
                    className="flex-1 bg-green-100 dark:bg-green-700/50 rounded-t-[4px] hover:bg-gold-600 dark:hover:bg-gold-600 transition-colors relative group"
                    style={{ height: `${h}%` }}
                    title={`${g.label}: ${g.count}`}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-green-900 dark:bg-white text-white dark:text-green-900 text-[11px] font-mono py-1.5 px-2.5 rounded shadow-sm pointer-events-none whitespace-nowrap transition-opacity">
                      {g.count} · {g.label}
                    </div>
                  </div>
                );
              })}
              {growth.length === 0 && (
                <p className="text-sm text-ink-muted p-4">Pas encore de données d&apos;inscription.</p>
              )}
            </div>
          </AdminChartCard>
        </div>
        <div>
          <AdminChartCard
            title="Répartition des comptes"
            subtitle="Par rôle plateforme"
          >
            <div className="absolute inset-0 flex flex-col justify-center gap-4 p-4">
              {acquisition.map((row, idx) => {
                const colors = ['bg-green-700 dark:bg-green-500', 'bg-gold-600', 'bg-clay-600', 'bg-primary'];
                return (
                  <div key={row.key} className="w-full">
                    <div className="flex justify-between text-[13px] mb-1.5 text-ink-muted dark:text-green-100/70">
                      <span>{row.label}</span>
                      <span className="font-mono text-green-900 dark:text-white">{row.percent}% ({row.count})</span>
                    </div>
                    <div className="h-2 w-full bg-paper dark:bg-black/30 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[idx % colors.length]}`} style={{ width: `${Math.max(row.percent, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
              {acquisition.length === 0 && (
                <p className="text-sm text-ink-muted">Aucun utilisateur.</p>
              )}
            </div>
          </AdminChartCard>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border dark:border-white/10 rounded-lg bg-surface dark:bg-[#1A2E25] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border dark:border-white/10 flex justify-between items-center">
            <h3 className="text-[15px] font-semibold text-green-900 dark:text-white">Activité récente</h3>
            <Link to="/admin/audit-logs" className="text-[13px] font-medium text-green-700 hover:text-green-900 dark:text-green-100/70 dark:hover:text-white transition-colors">
              Tout voir
            </Link>
          </div>
          <div className="divide-y divide-border dark:divide-white/10">
            {recentActivity.length === 0 && (
              <p className="p-6 text-sm text-ink-muted">Aucune entrée d&apos;audit pour le moment.</p>
            )}
            {recentActivity.map((log) => (
              <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-green-50 dark:hover:bg-white/5 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  log.status === 'success' ? 'bg-success'
                    : log.status === 'error' ? 'bg-error'
                      : log.status === 'warning' ? 'bg-gold-600' : 'bg-green-500'
                }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink dark:text-white truncate">{log.action}</p>
                  <p className="text-[13px] text-ink-muted dark:text-green-100/60 truncate mt-0.5">{log.target} · {log.user}</p>
                </div>
                <div className="text-[12px] text-ink-faint dark:text-green-100/40 whitespace-nowrap">{log.time}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border dark:border-white/10 rounded-lg bg-surface dark:bg-[#1A2E25] overflow-hidden flex flex-col shadow-sm">
          <div className="px-5 py-4 border-b border-border dark:border-white/10 flex justify-between items-center">
            <h3 className="text-[15px] font-semibold text-green-900 dark:text-white">Dernières entreprises</h3>
            <Link to="/admin/businesses" className="text-[13px] font-medium text-green-700 hover:text-green-900 dark:text-green-100/70 dark:hover:text-white transition-colors">
              Tout voir
            </Link>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border dark:border-white/10 text-[11px] text-ink-faint dark:text-green-100/50 uppercase tracking-[0.05em] bg-paper dark:bg-black/10">
                  <th className="px-5 py-3 font-semibold">Entreprise</th>
                  <th className="px-5 py-3 font-semibold">Secteur</th>
                  <th className="px-5 py-3 font-semibold text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-white/10">
                {recentBusinesses.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-sm text-ink-muted">Aucune entreprise.</td>
                  </tr>
                )}
                {recentBusinesses.map((biz) => (
                  <tr key={biz.id} className="hover:bg-green-50 dark:hover:bg-white/5 transition-colors text-[13.5px]">
                    <td className="px-5 py-3.5 text-ink dark:text-white font-medium">
                      <div>{biz.name}</div>
                      <div className="text-[11px] text-ink-faint">{biz.created_label}</div>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted dark:text-green-100/70">{biz.category}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${
                        biz.status === 'APPROVED'
                          ? 'bg-green-100 text-green-700 dark:bg-success/20 dark:text-green-100'
                          : biz.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-clay-100 text-clay-600 dark:bg-error/20 dark:text-red-200'
                      }`}
                      >
                        {STATUS_LABELS[biz.status] || biz.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
