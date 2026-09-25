import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert, Building2, CheckCircle2, XCircle, FileWarning, Clock, RefreshCw, Ban, Play,
} from 'lucide-react';
import api from '../shared/api';
import { useAuth } from '../context/AuthContext';
import { platformRoleLabel, userHasPlatformPerm } from '../auth/platformPermissions';
import DataSummaryCard from './components/DataSummaryCard';
import AdminModerationModal from './AdminModerationModal';

export default function AdminModerationPage() {
  const { user } = useAuth();
  const canSuspend = userHasPlatformPerm(user, 'platform.businesses.suspend');
  const [desk, setDesk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [queueOpen, setQueueOpen] = useState(true);
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);

  const roleTitle = platformRoleLabel(user) || 'Modération plateforme';

  const load = useCallback(async ({ refreshQueue = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('businesses/admin/moderation/desk/', { auth: true });
      setDesk(data);
      if (refreshQueue) setQueueRefreshKey((n) => n + 1);
    } catch (err) {
      setError(err.message || 'Impossible de charger le tableau de bord');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (biz, activate) => {
    if (!canSuspend) return;
    const label = activate ? 'réactiver' : 'suspendre';
    if (!window.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} « ${biz.name} » ?`)) return;
    setBusyId(biz.id);
    setError('');
    try {
      await api.patch(`businesses/admin/${biz.id}/`, { is_active: activate }, { auth: true });
      await load({ refreshQueue: true });
    } catch (err) {
      setError(err.message || `Impossible de ${label}`);
    } finally {
      setBusyId(null);
    }
  };

  const metrics = desk?.metrics || {};
  const byCategory = desk?.by_category || [];
  const decisions = desk?.recent_decisions || [];
  const active = desk?.active || [];
  const suspended = desk?.suspended || [];

  const decisionLabel = (status) => {
    if (status === 'APPROVED') return 'Approuvée';
    if (status === 'REJECTED') return 'Refusée';
    if (status === 'SUSPENDED') return 'Suspendue';
    if (status === 'REACTIVATED') return 'Réactivée';
    return status || '—';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4" />
            {roleTitle}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tableau de bord modération</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
            Approuvez ou refusez les dossiers, puis suspendez clairement une entreprise active si besoin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load({ refreshQueue: true })}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </header>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {loading && !desk ? (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <DataSummaryCard
              title="En attente"
              value={Number(metrics.pending || 0).toLocaleString('fr-BI')}
              trend="neutral"
              trendValue="à traiter"
              trendLabel="file d’attente"
            />
            <DataSummaryCard
              title="Approuvées"
              value={Number(metrics.approved || 0).toLocaleString('fr-BI')}
              trend="up"
              trendValue="catalogue"
              trendLabel="entreprises actives"
            />
            <DataSummaryCard
              title="Suspendues"
              value={Number(metrics.suspended || 0).toLocaleString('fr-BI')}
              trend="down"
              trendValue="hors ligne"
              trendLabel="is_active = false"
            />
            <DataSummaryCard
              title="Refusées"
              value={Number(metrics.rejected || 0).toLocaleString('fr-BI')}
              trend="down"
              trendValue="dossiers"
              trendLabel="refusés"
            />
            <DataSummaryCard
              title="Décisions (7 j)"
              value={Number(metrics.decisions_week || 0).toLocaleString('fr-BI')}
              trend="up"
              trendValue={`${metrics.missing_docs || 0} sans doc`}
              trendLabel={`${metrics.missing_logo || 0} sans logo`}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <section className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  File d’attente
                </h2>
                <button
                  type="button"
                  onClick={() => setQueueOpen(true)}
                  className="text-sm font-semibold text-teal-700 dark:text-teal-300"
                >
                  Ouvrir la file
                </button>
              </div>
              {(desk?.pending || []).length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  <CheckCircle2 className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                  Aucune demande en attente.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(desk?.pending || []).slice(0, 8).map((biz) => (
                    <li key={biz.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{biz.name}</p>
                        <p className="text-xs text-gray-500">
                          {biz.primary_category_name || 'Sans catégorie'}
                          {' · '}
                          {biz.owner_email || biz.email || '—'}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {!biz.logo && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-semibold dark:bg-amber-950/40 dark:text-amber-200">
                              <FileWarning className="w-3 h-3" /> Sans logo
                            </span>
                          )}
                          {!biz.proof_document && !(biz.commerce_compliance || {}).nif_document && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-semibold dark:bg-amber-950/40 dark:text-amber-200">
                              <FileWarning className="w-3 h-3" /> Docs à vérifier
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQueueOpen(true)}
                        className="shrink-0 text-xs font-semibold text-teal-700 dark:text-teal-300"
                      >
                        Examiner
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="space-y-4">
              <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
                <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-700" />
                  Par secteur
                </h2>
                {byCategory.length === 0 ? (
                  <p className="text-sm text-gray-500">Rien en attente.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {byCategory.map((row) => (
                      <li key={row.name} className="flex justify-between gap-3">
                        <span className="text-gray-700 dark:text-gray-200">{row.name}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
                <h2 className="font-bold text-gray-900 dark:text-white">Décisions récentes</h2>
                {decisions.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucune décision cette semaine.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {decisions.slice(0, 8).map((row) => (
                      <li key={row.id} className="flex items-start gap-2">
                        {row.status === 'APPROVED' || row.status === 'REACTIVATED' ? (
                          <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {row.business_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {decisionLabel(row.status)}
                            {row.actor_email ? ` · ${row.actor_email}` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          {canSuspend && (
            <div className="grid lg:grid-cols-2 gap-4">
              <section className="rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-gray-900 p-5 space-y-3">
                <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Ban className="w-4 h-4 text-red-600" />
                  Suspendre une entreprise active
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Retire l’entreprise du catalogue public (is_active = false). Visible aussi sur Hôtels pour le secteur hôtelier.
                </p>
                {active.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucune entreprise active récente.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
                    {active.map((biz) => (
                      <li key={biz.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{biz.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {biz.primary_category_name || '—'} · {biz.owner_email || biz.email || '—'}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busyId === biz.id}
                          onClick={() => toggleActive(biz, false)}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold text-red-700 border-red-300 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-950/40"
                        >
                          <Ban className="w-3.5 h-3.5" /> Suspendre
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-gray-900 p-5 space-y-3">
                <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-600" />
                  Réactiver une entreprise suspendue
                </h2>
                {suspended.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucune suspension en cours.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
                    {suspended.map((biz) => (
                      <li key={biz.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{biz.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {biz.primary_category_name || '—'} · {biz.verification_status || '—'}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busyId === biz.id}
                          onClick={() => toggleActive(biz, true)}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
                        >
                          <Play className="w-3.5 h-3.5" /> Réactiver
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          <section className="rounded-2xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="font-bold text-gray-900 dark:text-white">Espace de décision</h2>
              <button
                type="button"
                onClick={() => setQueueOpen((open) => !open)}
                className="text-sm font-semibold text-amber-800 dark:text-amber-200"
              >
                {queueOpen ? 'Réduire' : 'Déplier'}
              </button>
            </div>
            {queueOpen && (
              <AdminModerationModal
                embedded
                isOpen
                refreshKey={queueRefreshKey}
                onClose={() => setQueueOpen(false)}
                onRefresh={load}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
