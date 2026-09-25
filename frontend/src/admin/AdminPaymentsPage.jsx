import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Building2, AlertTriangle, CheckCircle2, Clock, Bell, History, Layers, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';
import { userHasPlatformPerm } from '../auth/platformPermissions';

/**
 * Super Admin — plans Free/Mensuel/Annuel + abonnements + paiements + notifications.
 */
export default function AdminPaymentsPage() {
  const { token, user } = useAuth();
  const canSettings = userHasPlatformPerm(user, 'platform.settings.view');
  const canAlerts = userHasPlatformPerm(user, 'platform.alerts.view');
  const canExport = userHasPlatformPerm(user, 'platform.billing.export');
  const canSuspend = userHasPlatformPerm(user, 'platform.businesses.suspend');
  const canReadBilling = userHasPlatformPerm(user, 'platform.billing.view')
    || userHasPlatformPerm(user, 'platform.subscriptions.view');
  const [tab, setTab] = useState('plans');
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState(null);
  const [notifs, setNotifs] = useState(null);
  const [plans, setPlans] = useState([]);
  const [plansNote, setPlansNote] = useState('');
  const [planDrafts, setPlanDrafts] = useState({});
  const [savingPlan, setSavingPlan] = useState(null);
  const [planMsg, setPlanMsg] = useState('');
  const [filter, setFilter] = useState('');
  const [payFilter, setPayFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [graceDays, setGraceDays] = useState('7');
  const [graceNote, setGraceNote] = useState('');
  const [savingGrace, setSavingGrace] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadSubs = async () => {
    const qs = filter ? `?status=${encodeURIComponent(filter)}` : '';
    const res = await api.get(`businesses/admin/subscriptions/${qs}`, { auth: true });
    setData(res);
  };

  const loadPayments = async () => {
    const qs = payFilter ? `?status=${encodeURIComponent(payFilter)}` : '';
    const res = await api.get(`businesses/admin/subscription-payments/${qs}`, { auth: true });
    setPayments(res);
  };

  const loadNotifs = async () => {
    const res = await api.get('businesses/admin/notifications/?limit=50', { auth: true });
    setNotifs(res);
  };

  const applyPlansPayload = (res) => {
    const list = res?.results || [];
    setPlans(list);
    setPlansNote(res?.note || '');
    const drafts = {};
    list.forEach((p) => {
      drafts[p.code] = {
        duration_days: String(p.duration_days ?? ''),
        price_bif: String(p.price_bif ?? ''),
        name: p.name || '',
        description: p.description || '',
        is_active: Boolean(p.is_active),
      };
    });
    setPlanDrafts(drafts);
  };

  const loadPlans = async () => {
    const res = await api.get('businesses/admin/plans/', { auth: true });
    applyPlansPayload(res);
  };

  const loadGrace = async () => {
    const res = await api.get('businesses/admin/subscription-settings/', { auth: true });
    setGraceDays(String(res?.grace_period_days ?? 7));
    setGraceNote(res?.note || '');
  };

  const load = async ({ soft = false } = {}) => {
    if (!token || !canReadBilling) {
      setLoading(false);
      if (token && !canReadBilling) {
        setError('Accès réservé à la finance plateforme ou au super admin.');
      }
      return;
    }
    if (!soft) setLoading(true);
    setError('');
    try {
      const jobs = [loadSubs(), loadPayments()];
      if (canSettings) jobs.push(loadPlans(), loadGrace());
      if (canAlerts) jobs.push(loadNotifs());
      await Promise.all(jobs);
    } catch (err) {
      setError(err.message || 'Impossible de charger les données');
    } finally {
      if (!soft) setLoading(false);
    }
  };

  useEffect(() => {
    if (!canSettings && tab === 'plans') setTab('subscriptions');
  }, [canSettings, tab]);

  useEffect(() => {
    load();
  }, [token, filter, payFilter, canReadBilling, canSettings, canAlerts]);

  const updateDraft = (code, field, value) => {
    setPlanDrafts((prev) => ({
      ...prev,
      [code]: { ...prev[code], [field]: value },
    }));
  };

  const saveGrace = async () => {
    const days = parseInt(graceDays, 10);
    if (Number.isNaN(days) || days < 0 || days > 365) {
      setError('La période de grâce doit être entre 0 et 365 jours.');
      return;
    }
    setSavingGrace(true);
    setError('');
    setPlanMsg('');
    try {
      const res = await api.patch(
        'businesses/admin/subscription-settings/',
        { grace_period_days: days },
        { auth: true },
      );
      setGraceDays(String(res?.grace_period_days ?? days));
      setPlanMsg('Période de grâce enregistrée pour toutes les entreprises.');
      await loadSubs();
    } catch (err) {
      setError(err.message || 'Échec enregistrement de la période de grâce');
    } finally {
      setSavingGrace(false);
    }
  };

  const savePlan = async (code) => {
    const draft = planDrafts[code] || {};
    setSavingPlan(code);
    setPlanMsg('');
    setError('');
    try {
      const body = { code };
      if (code === 'free') {
        body.duration_days = parseInt(draft.duration_days, 10);
        body.name = draft.name;
        body.description = draft.description;
      } else {
        body.price_bif = parseInt(draft.price_bif, 10);
        body.name = draft.name;
        body.description = draft.description;
        body.is_active = draft.is_active;
      }
      const res = await api.patch(`businesses/admin/plans/${code}/`, body, { auth: true });
      applyPlansPayload(res);
      setPlanMsg(
        code === 'free'
          ? 'Durée Free enregistrée (nouvelles inscriptions uniquement).'
          : 'Prix enregistré (nouveaux paiements uniquement).'
      );
    } catch (err) {
      setError(err.message || 'Échec enregistrement du plan');
    } finally {
      setSavingPlan(null);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('businesses/admin/notifications/', { all: true }, { auth: true });
      await loadNotifs();
    } catch (err) {
      alert(err.message || 'Échec');
    }
  };

  const activate = async (row) => {
    const daysRaw = window.prompt(
      `Activer / prolonger l'abonnement de « ${row.business_name} » (jours) :`,
      '30'
    );
    if (daysRaw === null) return;
    const days = parseInt(daysRaw, 10);
    if (!days || days < 1) {
      alert('Nombre de jours invalide.');
      return;
    }
    setBusyId(row.business_id);
    try {
      await api.post(
        `businesses/admin/${row.business_id}/subscription/`,
        { action: 'activate', days, plan_code: 'monthly' },
        { auth: true }
      );
      await load();
    } catch (err) {
      alert(err.message || 'Échec activation');
    } finally {
      setBusyId(null);
    }
  };

  const suspend = async (row) => {
    if (!window.confirm(`Suspendre l'abonnement de « ${row.business_name} » ?`)) return;
    setBusyId(row.business_id);
    try {
      await api.post(
        `businesses/admin/${row.business_id}/subscription/`,
        { action: 'suspend' },
        { auth: true }
      );
      await load();
    } catch (err) {
      alert(err.message || 'Échec suspension');
    } finally {
      setBusyId(null);
    }
  };

  const results = data?.results || [];
  const paymentRows = payments?.results || [];
  const notifRows = notifs?.results || [];
  const unread = notifs?.unread_count || 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="space-y-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700">
            <Crown className="w-4 h-4" /> Revenus plateforme
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Abonnements SaaS</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
            Plans Free / Mensuel / Annuel — durée Free et prix réglables. Les commandes restent privées.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load({ soft: true })}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </header>

      {unread > 0 && (
        <div className="rounded-xl border border-teal-300 bg-teal-50 dark:bg-teal-950/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-sm text-teal-950 dark:text-teal-100">
            <Bell className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{unread} notification(s) non lue(s)</p>
              <p className="text-teal-900/80 dark:text-teal-100/80">
                Des entreprises ont payé leur abonnement (y compris simulations).
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTab('notifications')} className="text-sm font-semibold text-teal-800 underline">
              Voir
            </button>
            <button type="button" onClick={markAllRead} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-teal-700 text-white">
              Tout marquer lu
            </button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-4 gap-4">
        <Metric icon={Building2} label="Entreprises listées" value={data?.count ?? '—'} />
        <Metric icon={CheckCircle2} label="Abo actifs" value={data?.active_count ?? '—'} accent="text-teal-700" />
        <Metric icon={History} label="Paiements réussis" value={payments?.success_count ?? '—'} accent="text-teal-700" />
        <Metric
          icon={Crown}
          label="Encaissé SaaS (BIF)"
          value={payments?.total_collected_bif != null ? Number(payments.total_collected_bif).toLocaleString('fr-BI') : '—'}
          accent="text-teal-700"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        {[
          canSettings ? { id: 'plans', label: 'Plans' } : null,
          canAlerts ? { id: 'notifications', label: `Notifications${unread ? ` (${unread})` : ''}` } : null,
          { id: 'payments', label: 'Historique paiements' },
          { id: 'subscriptions', label: 'Abonnements' },
        ].filter(Boolean).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              tab === t.id ? 'bg-teal-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
        {canSettings && (
        <Link to="/admin/businesses" className="ml-auto text-sm font-semibold text-teal-700 hover:underline self-center">
          Entreprises →
        </Link>
        )}
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
      {planMsg && tab === 'plans' && (
        <div className="p-3 rounded-xl bg-teal-50 text-teal-800 text-sm">{planMsg}</div>
      )}
      {loading && <div className="py-10 text-center text-sm text-gray-500">Chargement…</div>}

      {!loading && tab === 'plans' && canSettings && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-800 p-5 space-y-3">
            <h2 className="font-bold text-gray-900 dark:text-white">Période de grâce — toutes les entreprises</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {graceNote || 'Après l’échéance, l’accès reste ouvert pendant ce nombre de jours. Le décompte avance chaque jour. Une alerte part 5 jours avant l’expiration.'}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-gray-600">
                Jours de grâce
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={graceDays}
                  onChange={(e) => setGraceDays(e.target.value)}
                  className="mt-1 block w-28 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-950"
                />
              </label>
              <button
                type="button"
                onClick={saveGrace}
                disabled={savingGrace}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {savingGrace ? 'Enregistrement…' : 'Enregistrer la grâce'}
              </button>
            </div>
          </section>
          {plansNote && (
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
              <Layers className="w-4 h-4 mt-0.5 shrink-0 text-teal-700" />
              {plansNote}
            </p>
          )}
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const draft = planDrafts[plan.code] || {};
              const isFree = plan.code === 'free';
              return (
                <article
                  key={plan.code}
                  className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3 shadow-sm"
                >
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{plan.code}</p>
                  </div>
                  <label className="block text-xs font-semibold text-gray-600">
                    Libellé
                    <input
                      type="text"
                      value={draft.name || ''}
                      onChange={(e) => updateDraft(plan.code, 'name', e.target.value)}
                      className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-950"
                    />
                  </label>
                  {isFree ? (
                    <label className="block text-xs font-semibold text-gray-600">
                      Durée Free (jours)
                      <input
                        type="number"
                        min={1}
                        max={3650}
                        value={draft.duration_days || ''}
                        onChange={(e) => updateDraft(plan.code, 'duration_days', e.target.value)}
                        className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-950"
                      />
                      <span className="font-normal text-gray-500 mt-1 block">
                        S&apos;applique aux nouvelles inscriptions seulement.
                      </span>
                    </label>
                  ) : (
                    <>
                      <label className="block text-xs font-semibold text-gray-600">
                        Prix (BIF)
                        <input
                          type="number"
                          min={1}
                          value={draft.price_bif || ''}
                          onChange={(e) => updateDraft(plan.code, 'price_bif', e.target.value)}
                          className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-950"
                        />
                        <span className="font-normal text-gray-500 mt-1 block">
                          S&apos;applique aux nouveaux paiements / renouvellements.
                        </span>
                      </label>
                      <p className="text-xs text-gray-500">Durée fixe : {plan.duration_days} jours</p>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600">
                        <input
                          type="checkbox"
                          checked={Boolean(draft.is_active)}
                          onChange={(e) => updateDraft(plan.code, 'is_active', e.target.checked)}
                        />
                        Plan actif (proposé aux entreprises)
                      </label>
                    </>
                  )}
                  <label className="block text-xs font-semibold text-gray-600">
                    Description
                    <textarea
                      rows={2}
                      value={draft.description || ''}
                      onChange={(e) => updateDraft(plan.code, 'description', e.target.value)}
                      className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-950"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingPlan === plan.code}
                    onClick={() => savePlan(plan.code)}
                    className="w-full py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {savingPlan === plan.code ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {!loading && tab === 'notifications' && (
        <div className="space-y-3">
          {notifRows.length === 0 && (
            <p className="text-sm text-gray-500">Aucune notification pour le moment.</p>
          )}
          {notifRows.map((n) => (
            <article
              key={n.id}
              className={`rounded-xl border p-4 ${
                n.is_read
                  ? 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
                  : 'border-teal-200 bg-teal-50/60 dark:bg-teal-950/30'
              }`}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">{n.title}</h3>
                <span className="text-xs text-gray-500">
                  {n.created_at ? new Date(n.created_at).toLocaleString('fr-FR') : ''}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{n.message}</p>
              {n.details && Object.keys(n.details).length > 0 && (
                <dl className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                  {[
                    ['Entreprise', n.details.business_name],
                    ['Propriétaire', n.details.owner_email],
                    ['Plan', n.details.plan_name],
                    ['Montant', n.details.amount_bif != null ? `${Number(n.details.amount_bif).toLocaleString('fr-BI')} ${n.details.currency || 'BIF'}` : null],
                    ['BurundiPay', n.details.payer_phone],
                    ['Référence', n.details.provider_reference],
                    ['Marchand', n.details.merchant_account],
                    ['Initié par', n.details.initiated_by_email],
                    ['Abo jusqu\'au', n.details.subscription_ends_at ? new Date(n.details.subscription_ends_at).toLocaleDateString('fr-FR') : null],
                    ['Simulation', n.details.stub_mode ? 'Oui' : 'Non'],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="font-semibold text-gray-700 dark:text-gray-300">{k} :</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </article>
          ))}
        </div>
      )}

      {!loading && tab === 'payments' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
          <select
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
          >
            <option value="">Tous les paiements</option>
            <option value="SUCCESS">Réussis</option>
            <option value="AWAITING_PIN">En attente PIN</option>
            <option value="FAILED">Échoués</option>
            <option value="PENDING">En attente</option>
          </select>
          {canExport && (
            <button
              type="button"
              onClick={() => {
                const rows = paymentRows || [];
                const header = ['entreprise', 'plan', 'montant', 'statut', 'telephone', 'paye_le'];
                const lines = rows.map((p) => [
                  p.business_name, p.plan_name, p.amount_bif, p.status, p.payer_phone, p.paid_at,
                ].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
                const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'paiements-saas.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold"
            >
              Exporter CSV
            </button>
          )}
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-black/20 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Entreprise</th>
                  <th className="px-4 py-3">Plan / montant</th>
                  <th className="px-4 py-3">BurundiPay</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Réf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {paymentRows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Aucun paiement</td></tr>
                )}
                {paymentRows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.paid_at || p.created_at
                        ? new Date(p.paid_at || p.created_at).toLocaleString('fr-FR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{p.business_name}</div>
                      <div className="text-xs text-gray-500">{p.owner_email || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {p.plan_name}
                      <div className="font-semibold">{Number(p.amount_bif).toLocaleString('fr-BI')} {p.currency}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{p.payer_phone}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${p.status === 'SUCCESS' ? 'text-teal-700' : 'text-amber-700'}`}>
                        {p.status_display || p.status}
                        {p.stub_mode ? ' · sim' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">{p.provider_reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'subscriptions' && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
            >
              <option value="">Tous les statuts</option>
              <option value="ACTIVE">Actifs (Free + payants)</option>
              <option value="BLOCKED">Bloqués</option>
              <option value="TRIAL">Free</option>
              <option value="EXPIRED">Expirés</option>
              <option value="SUSPENDED">Suspendus</option>
            </select>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-black/20 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Entreprise</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Échéance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {results.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">Aucun abonnement</td>
                  </tr>
                )}
                {results.map((row) => (
                  <tr key={row.business_id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 dark:text-white">{row.business_name}</div>
                      <div className="text-xs text-gray-500">{row.owner_email || '—'} · {row.category || 'Sans catégorie'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.plan_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          row.is_blocked ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {row.is_blocked ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {row.status_display || row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {row.ends_at ? new Date(row.ends_at).toLocaleDateString('fr-FR') : '—'}
                        {row.in_grace
                          ? ` · grâce jour ${row.grace_days_elapsed}/${row.grace_period_days}`
                          : (typeof row.days_remaining === 'number' ? ` (${row.days_remaining}j)` : '')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {canSuspend && (
                        <>
                      <button
                        type="button"
                        disabled={busyId === row.business_id}
                        onClick={() => activate(row)}
                        className="text-xs font-semibold text-teal-700 hover:underline disabled:opacity-50"
                      >
                        Activer
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.business_id}
                        onClick={() => suspend(row)}
                        className="text-xs font-semibold text-amber-700 hover:underline disabled:opacity-50"
                      >
                        Suspendre
                      </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, accent = 'text-gray-900 dark:text-white' }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex items-start gap-3">
      <Icon className={`w-5 h-5 mt-0.5 ${accent}`} />
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`text-xl font-bold ${accent}`}>{value}</div>
      </div>
    </div>
  );
}
