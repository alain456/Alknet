import React, { useCallback, useEffect, useState } from 'react';
import { Crown, AlertTriangle, CheckCircle2, Clock, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Abonnement SaaS : Entreprise → compte marchand Isoko Hub (Lumicash).
 * Distinct des paiements privés client↔vendeur.
 */
export default function BusinessSubscriptionPage() {
  const { authFetch, user } = useAuth();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [planCode, setPlanCode] = useState('monthly');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [payMsg, setPayMsg] = useState('');
  const [pendingPaymentId, setPendingPaymentId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    return authFetch('/api/v1/businesses/me/subscription/')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Impossible de charger l\'abonnement'))))
      .then((data) => {
        setSub(data);
        setError(null);
        setPlanCode((prev) => {
          if (data?.plans?.length && !data.plans.find((p) => p.code === prev)) {
            return data.plans[0].code;
          }
          return prev || 'monthly';
        });
        const awaiting = (data.recent_payments || []).find((p) =>
          ['PENDING', 'AWAITING_PIN'].includes(p.status)
        );
        setPendingPaymentId(awaiting ? awaiting.id : null);
      })
      .catch((err) => setError(err.message || 'Erreur'))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedPlan = (sub?.plans || []).find((p) => p.code === planCode);

  const startPay = async (e) => {
    e.preventDefault();
    setBusy(true);
    setPayMsg('');
    setError(null);
    try {
      const res = await authFetch('/api/v1/businesses/me/subscription/pay/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_code: planCode, payer_phone: phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Échec initiation paiement');
      }
      setPendingPaymentId(data.payment_id);
      setPayMsg(data.message || 'Paiement initié. Validez sur votre téléphone Lumicash.');
      if (data.subscription) setSub((prev) => ({ ...prev, ...data.subscription, plans: prev?.plans, recent_payments: prev?.recent_payments, lumicash_stub: data.stub_mode }));
      await load();
    } catch (err) {
      setError(err.message || 'Erreur paiement');
    } finally {
      setBusy(false);
    }
  };

  const confirmStub = async () => {
    if (!pendingPaymentId) return;
    setBusy(true);
    setPayMsg('');
    try {
      const res = await authFetch('/api/v1/businesses/me/subscription/confirm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: pendingPaymentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Échec confirmation');
      }
      setPayMsg(data.message || 'Abonnement activé.');
      setPendingPaymentId(null);
      await load();
    } catch (err) {
      setError(err.message || 'Erreur confirmation');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !sub) {
    return (
      <div className="p-8 text-sm text-gray-500">Chargement de l'abonnement…</div>
    );
  }

  if (error && !sub) {
    return (
      <div className="p-8">
        <p className="text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  const blocked = sub?.is_blocked;
  const endsLabel = sub?.ends_at
    ? new Date(sub.ends_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '—';

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-10 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Crown className="w-8 h-8 text-teal-700" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Abonnement Isoko Hub
          </h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Paiement entreprise → compte marchand plateforme (Lumicash).  
          Ce n&apos;est pas le paiement des commandes clients.
        </p>
      </header>

      <section
        className={`rounded-xl border p-6 space-y-4 ${
          blocked
            ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700'
            : 'border-teal-200 bg-teal-50/50 dark:bg-teal-950/20 dark:border-teal-800'
        }`}
      >
        <div className="flex items-start gap-3">
          {blocked ? (
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-6 h-6 text-teal-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-semibold text-gray-900 dark:text-white">
              {blocked
                ? 'Espace bloqué — abonnement requis'
                : sub?.is_free_period
                  ? 'Période Free active'
                  : 'Abonnement actif'}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Statut : <strong>{sub?.status_display || sub?.status}</strong>
              {sub?.plan_name ? ` · Plan ${sub.plan_name}` : ''}
            </p>
            {sub?.is_free_period && !blocked && (
              <p className="text-sm text-teal-800 dark:text-teal-200">
                Profitez de la période gratuite. Après l&apos;échéance, choisissez Mensuel ou Annuel.
              </p>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Valide jusqu&apos;au {endsLabel}
              {typeof sub?.days_remaining === 'number' ? ` (${sub.days_remaining} j restants)` : ''}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-teal-700" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Payer avec Lumicash</h2>
        </div>
        <p className="text-xs text-gray-500">
          Marchand : <strong>{sub?.merchant_account || 'ISOKO_HUB_MERCHANT'}</strong>
          {sub?.lumicash_stub ? ' · mode simulation' : ''}
        </p>

        <form onSubmit={startPay} className="space-y-3">
          <label className="block text-sm space-y-1">
            <span className="text-gray-600">Plan</span>
            <select
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-950"
              value={planCode}
              onChange={(e) => setPlanCode(e.target.value)}
            >
              {(sub?.plans || []).map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} — {Number(p.price_bif).toLocaleString('fr-BI')} BIF / {p.duration_days} j
                </option>
              ))}
            </select>
          </label>
          {selectedPlan?.description && (
            <p className="text-xs text-gray-500">{selectedPlan.description}</p>
          )}
          <label className="block text-sm space-y-1">
            <span className="text-gray-600">Numéro Lumicash (payeur)</span>
            <input
              required
              type="tel"
              placeholder="79xxxxxx ou 25779xxxxxx"
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-950"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !(sub?.plans || []).length}
            className="w-full px-4 py-2.5 rounded-xl bg-teal-700 text-white font-semibold disabled:opacity-50"
          >
            {busy ? 'Traitement…' : `Payer ${selectedPlan ? `${Number(selectedPlan.price_bif).toLocaleString('fr-BI')} BIF` : ''}`}
          </button>
        </form>

        {pendingPaymentId && sub?.lumicash_stub && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 dark:bg-teal-950/30 p-4 space-y-2">
            <p className="text-sm text-teal-900 dark:text-teal-100">
              Simulation : après le push PIN, confirmez ici pour activer l&apos;abonnement.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={confirmStub}
              className="px-4 py-2 rounded-xl bg-teal-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              Confirmer le PIN (simulation)
            </button>
          </div>
        )}

        {payMsg && <p className="text-sm text-teal-800 dark:text-teal-200">{payMsg}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      {(sub?.recent_payments || []).length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Historique des paiements SaaS
            {sub?.payments_count != null ? ` (${sub.payments_count})` : ''}
          </h3>
          <p className="text-xs text-gray-500">
            Conservé côté entreprise et visible aussi par le Super Admin Isoko Hub.
          </p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
            {sub.recent_payments.map((p) => (
              <li key={p.id} className="px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between gap-3">
                  <div className="font-medium">
                    {p.plan_name} · {Number(p.amount_bif).toLocaleString('fr-BI')} {p.currency || 'BIF'}
                  </div>
                  <div className="text-xs text-gray-400 shrink-0">
                    {p.paid_at || p.created_at
                      ? new Date(p.paid_at || p.created_at).toLocaleString('fr-FR')
                      : ''}
                  </div>
                </div>
                <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                  <span>{p.status_display || p.status}{p.stub_mode ? ' · simulation' : ''}</span>
                  <span>{p.payer_phone}</span>
                  {p.provider_reference && <span className="font-mono">{p.provider_reference}</span>}
                  {p.merchant_account && <span>→ {p.merchant_account}</span>}
                  {p.initiated_by_email && <span>par {p.initiated_by_email}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
        <p>
          Compte : <span className="font-medium text-gray-800 dark:text-gray-200">{user?.email}</span>
        </p>
      </section>
    </div>
  );
}
