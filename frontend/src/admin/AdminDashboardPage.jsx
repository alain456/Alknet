import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { platformHomePath, userHasPlatformPerm } from '../auth/platformPermissions';
import api from '../shared/api';

const STATUS_LABELS = {
  APPROVED: 'Approuvée',
  PENDING: 'En attente',
  REJECTED: 'Rejetée',
};

const fmt = (value) => Number(value || 0).toLocaleString('fr-BI');

function Trend({ value }) {
  const n = Number(value || 0);
  const up = n >= 0;
  return (
    <span className={up ? 'text-primary' : 'text-alert'}>
      {up ? '+' : ''}{n}%
    </span>
  );
}

function MiniStat({ label, value, hint }) {
  return (
    <div className="rounded-3xl bg-surface px-4 py-3">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-primary">{hint}</p> : null}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token, user } = useAuth();
  const canViewDashboard = userHasPlatformPerm(user, 'platform.analytics.view');

  useEffect(() => {
    if (!token || !canViewDashboard) return undefined;
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
  }, [token, canViewDashboard]);

  if (user && !canViewDashboard) {
    return <Navigate to={platformHomePath(user)} replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Erreur de chargement</h2>
        <p className="text-sm mt-1 text-alert">{error}</p>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const recentActivity = data?.recent_activity || [];
  const recentBusinesses = data?.recent_businesses || [];
  const growth = data?.growth_businesses || [];
  const growthMax = data?.growth_max || 1;
  const monthActivity = (metrics.appointments_month || 0)
    + (metrics.retail_orders_month || 0)
    + (metrics.wholesale_orders_month || 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vue d&apos;ensemble</h1>
          <p className="text-sm mt-1 text-ink-muted">
            Données réelles
            {data?.generated_at ? ` · ${new Date(data.generated_at).toLocaleString('fr-FR')}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div
          className="school-dash-hero xl:col-span-8 rounded-3xl bg-ink p-6 sm:p-7 flex flex-col justify-between min-h-[210px]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="school-dash-kicker text-sm font-semibold">Abonnements actifs</p>
              <p className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight">
                {fmt(metrics.active_subscriptions)}
              </p>
              <p className="mt-3 text-sm">
                <Trend value={metrics.businesses_trend} /> entreprises vs le mois précédent
                {' · '}
                {fmt(metrics.users_this_month)} nouveaux comptes
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-accent text-ink">
              {fmt(metrics.businesses_this_month)} ce mois
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/admin/analytics" className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-ink">
              Voir l&apos;analytique <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link to="/admin/payments" className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-white/15">
              Abonnements
            </Link>
          </div>
        </div>

        <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
          <Link to="/admin/moderation" className="rounded-3xl bg-white p-5 block">
            <p className="text-sm text-ink-muted">En modération</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{fmt(metrics.pending_businesses)}</p>
            <p className="mt-2 text-xs text-ink-muted">Entreprises en attente de validation</p>
          </Link>
          <Link to="/admin/businesses" className="rounded-3xl bg-white p-5 block">
            <p className="text-sm text-ink-muted">Espaces actifs</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{fmt(metrics.active_businesses)}</p>
            <p className="mt-2 text-xs text-primary">
              <Trend value={metrics.businesses_trend} /> sur le mois
            </p>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-5 rounded-3xl bg-white p-5">
          <h2 className="text-base font-semibold text-ink">Activité</h2>
          <p className="text-xs mt-1 text-ink-muted">Comptes, établissements et opérations du mois</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <MiniStat label="Utilisateurs actifs" value={fmt(metrics.total_active_users)} hint={<Trend value={metrics.users_trend} />} />
            <MiniStat label="Comptes au total" value={fmt(metrics.total_users)} />
            <MiniStat label="Entreprises" value={fmt(metrics.registered_businesses)} />
            <MiniStat label="Services actifs" value={fmt(metrics.services_active)} hint={`${fmt(metrics.services_total)} au catalogue`} />
            <MiniStat label="RDV ce mois" value={fmt(metrics.appointments_month)} hint={`${fmt(metrics.appointments_pending)} en attente`} />
            <MiniStat label="Commandes ce mois" value={fmt(monthActivity)} />
          </div>
        </div>

        <div className="xl:col-span-7 rounded-3xl bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Nouvelles entreprises</h2>
              <p className="text-xs mt-1 text-ink-muted">Douze derniers mois</p>
            </div>
            <p className="text-sm font-semibold text-primary">
              <Trend value={metrics.users_trend} /> comptes
            </p>
          </div>
          <div className="mt-6 h-44 flex items-end gap-2">
            {growth.map((row) => {
              const h = Math.max(8, Math.round((row.count / growthMax) * 100));
              const short = (row.label || '').split(' ')[0];
              return (
                <div key={row.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end" title={`${row.label}: ${row.count}`}>
                  <div className="w-full rounded-t-md bg-accent" style={{ height: `${h}%` }} />
                  <span className="text-[10px] text-ink-muted">{short}</span>
                </div>
              );
            })}
            {growth.length === 0 && (
              <p className="text-sm text-ink-muted">Pas encore d&apos;inscription.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 rounded-3xl bg-white overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Dernières entreprises</h2>
            <Link to="/admin/businesses" className="text-xs font-semibold text-primary">Tout voir</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-ink-muted">
                  <th className="px-5 py-2 font-medium">Entreprise</th>
                  <th className="px-5 py-2 font-medium">Secteur</th>
                  <th className="px-5 py-2 font-medium text-right">Statut</th>
                </tr>
              </thead>
              <tbody>
                {recentBusinesses.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-center text-ink-muted">Aucune entreprise.</td>
                  </tr>
                )}
                {recentBusinesses.map((biz) => (
                  <tr key={biz.id}>
                    <td className="px-5 py-3">
                      <div className="text-ink">{biz.name}</div>
                      <div className="text-[11px] text-ink-faint">{biz.created_label}</div>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{biz.category}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                        biz.status === 'APPROVED'
                          ? 'bg-primary/10 text-primary'
                          : biz.status === 'PENDING'
                            ? 'bg-accent/15 text-ink'
                            : 'bg-alert/10 text-alert'
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

        <div className="xl:col-span-5 space-y-4">
          <div className="rounded-3xl bg-white p-5">
            <h2 className="text-base font-semibold text-ink">Flux du mois</h2>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <MiniStat label="Rendez-vous" value={fmt(metrics.appointments_month)} />
              <MiniStat label="Pharmacie détail" value={fmt(metrics.retail_orders_month)} />
              <MiniStat label="Pharmacie gros" value={fmt(metrics.wholesale_orders_month)} />
              <MiniStat label="Abonnements actifs" value={fmt(metrics.active_subscriptions)} />
            </div>
          </div>
          <div className="rounded-3xl bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Activité récente</h2>
              <Link to="/admin/audit-logs?scope=platform" className="text-xs font-semibold text-primary">Journal</Link>
            </div>
            <ul className="mt-3 space-y-2">
              {recentActivity.length === 0 && (
                <li className="text-sm text-ink-muted">Aucune entrée pour le moment.</li>
              )}
              {recentActivity.slice(0, 5).map((log) => (
                <li key={log.id} className="flex items-start justify-between gap-3 text-sm">
                  <span>
                    <span className="text-ink">{log.action}</span>
                    <span className="block text-[11px] text-ink-muted">{log.target}</span>
                  </span>
                  <span className="text-[11px] shrink-0 text-ink-faint">{log.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
