import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, RefreshCw, Lock } from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import { HotelPage, Panel, StatCard, Empty, btnPrimary, btnGhost } from '../ui';
import { useHotelPerm } from '../useHotelPerm';
import PaymentReceiptModal from './PaymentReceiptModal';

const METHOD_LABELS = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile money',
  CARD: 'Carte',
  TRANSFER: 'Virement',
  BURUNDIPAY: 'BurundiPay',
  OTHER: 'Autre',
};

function money(n, currency = 'BIF') {
  return `${Number(n || 0).toLocaleString()} ${currency}`;
}

function folioLabel(f) {
  return [
    f.guest_name || 'Client',
    f.room_number ? `Ch. ${f.room_number}` : null,
    f.reservation_ref || null,
  ].filter(Boolean).join(' · ');
}

export default function CashierDashboard() {
  const { canView, canCreate, canUpdate } = useHotelPerm();
  const canSee = canView('cashier');
  const canPay = canCreate('cashier') || canUpdate('cashier');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [closingBusy, setClosingBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const load = () => {
    setLoading(true);
    setErr('');
    return hotelService.cashierDashboard()
      .then((d) => {
        setData(d);
        setErr('');
      })
      .catch((e) => setErr(e.message || 'Impossible de charger la caisse'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canSee) return undefined;
    load();
    const id = setInterval(() => { load().catch(() => {}); }, 45000);
    return () => clearInterval(id);
  }, [canSee]);

  const methods = useMemo(() => listOf(data?.payments_by_method), [data]);
  const closed = Boolean(data?.cash_closed_today);

  const closeCash = async () => {
    if (!window.confirm(
      `Clôturer la caisse du ${data?.date || 'jour'} ?\n`
      + `Total : ${money(data?.revenue_today)}\n`
      + 'Aucun nouvel encaissement ne sera possible pour cette journée.',
    )) return;
    setClosingBusy(true);
    setErr('');
    setOk('');
    try {
      const c = await hotelService.closeCash({ period_date: data.date });
      setOk(
        `Caisse clôturée — ${Number(c.total_collected).toLocaleString()} BIF`
        + (c.breakdown?.payment_count != null ? ` (${c.breakdown.payment_count} paiement(s))` : ''),
      );
      await load();
    } catch (e) {
      setErr(e.message || 'Clôture impossible');
    } finally {
      setClosingBusy(false);
    }
  };

  if (!canSee) {
    return (
      <HotelPage title="Caisse">
        <Panel className="border-alert">
          <p className="text-sm text-alert font-bold">
            Droits insuffisants. Ajoutez « Voir » caisse (hotel.cashier.view).
          </p>
        </Panel>
      </HotelPage>
    );
  }

  return (
    <HotelPage
      title="Caisse"
      subtitle="Encaissements du jour, soldes en attente et clôture"
      actions={(
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${btnGhost} text-sm inline-flex items-center gap-1.5`}
            onClick={() => load().catch((e) => setErr(e.message))}
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          {canPay && !closed && (
            <button
              type="button"
              disabled={closingBusy || loading}
              className={`${btnPrimary} text-sm inline-flex items-center gap-1.5`}
              onClick={closeCash}
            >
              <Lock className="w-4 h-4" />
              {closingBusy ? 'Clôture…' : 'Clôturer la caisse'}
            </button>
          )}
          <Link to="/hotel/folios" className={`${btnGhost} text-sm inline-flex items-center gap-1.5`}>
            <CreditCard className="w-4 h-4" />
            Folios & paiements
          </Link>
        </div>
      )}
    >
      {err && (
        <Panel className="border-alert mb-4">
          <p className="text-sm text-alert font-bold">{err}</p>
        </Panel>
      )}
      {ok && (
        <Panel className="mb-4">
          <p className="text-sm text-emerald-700 font-bold">{ok}</p>
        </Panel>
      )}

      {loading && !data ? (
        <Empty>Chargement…</Empty>
      ) : !data ? (
        <Empty>Aucune donnée</Empty>
      ) : (
        <>
          {closed && (
            <div className="mb-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              <p className="font-extrabold inline-flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Caisse clôturée pour le {data.date}
              </p>
              <p className="mt-1">
                Total verrouillé : {money(data.cash_closing?.total_collected ?? data.revenue_today)}.
                Nouveaux encaissements refusés pour cette journée.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
              label="Encaissé aujourd’hui"
              value={money(data.revenue_today)}
              hint={`${data.payments_today_count || 0} paiement(s)`}
            />
            <StatCard
              label="Soldes en attente"
              value={money(data.unpaid_balance_total)}
              hint={`${data.unpaid_folios_count || 0} folio(s)`}
            />
            <StatCard label="Paiements du jour" value={data.payments_today_count || 0} />
            <StatCard
              label="Statut caisse"
              value={closed ? 'Clôturée' : 'Ouverte'}
              hint={closed ? 'verrouillée' : 'encaissements possibles'}
            />
          </div>

          {methods.length > 0 && (
            <Panel className="mb-4">
              <h2 className="font-extrabold text-ink mb-2">Répartition du jour</h2>
              <ul className="flex flex-wrap gap-2">
                {methods.map((m) => (
                  <li
                    key={m.method}
                    className="px-3 py-1.5 rounded-xl border-2 border-accent/30 text-xs font-bold text-ink"
                  >
                    {METHOD_LABELS[m.method] || m.method}
                    {' · '}
                    {money(m.total)}
                    {' '}
                    ({m.count})
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <Panel>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="font-extrabold text-ink">Soldes en attente</h2>
                <Link to="/hotel/folios?unpaid=1" className="text-xs font-bold text-accent hover:underline">
                  Tout encaisser →
                </Link>
              </div>
              {!listOf(data.unpaid_folios).length ? (
                <Empty>Aucun solde en attente</Empty>
              ) : (
                <ul className="space-y-2">
                  {listOf(data.unpaid_folios).map((f) => (
                    <li key={f.id}>
                      <Link
                        to={`/hotel/folios?folio=${f.id}`}
                        className="block p-3 rounded-xl border-2 border-amber-200 bg-amber-50/50 hover:border-amber-400 transition"
                      >
                        <p className="font-extrabold text-ink text-sm">{folioLabel(f)}</p>
                        <p className="text-sm font-extrabold text-amber-900 mt-1">
                          Solde {money(f.balance, f.currency)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel>
              <h2 className="font-extrabold text-ink mb-3">Encaissements du jour</h2>
              {!listOf(data.payments_today).length ? (
                <Empty>Aucun paiement aujourd’hui</Empty>
              ) : (
                <ul className="space-y-2">
                  {listOf(data.payments_today).map((p) => (
                    <li key={p.id} className="py-2 border-b border-accent/10 last:border-0 text-sm">
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-ink truncate">
                            {[p.guest_name, p.room_number && `Ch. ${p.room_number}`, p.reservation_ref]
                              .filter(Boolean)
                              .join(' · ') || 'Paiement'}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {METHOD_LABELS[p.method] || p.method}
                            {p.paid_at ? ` · ${new Date(p.paid_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </p>
                          <button
                            type="button"
                            className="text-[11px] font-bold text-accent underline mt-0.5"
                            onClick={() => {
                              hotelService.paymentReceipt(p.id)
                                .then(setReceipt)
                                .catch((e) => setErr(e.message));
                            }}
                          >
                            Voir / imprimer reçu
                          </button>
                        </div>
                        <p className="font-extrabold text-primary shrink-0">{money(p.amount)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      {receipt && (
        <PaymentReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </HotelPage>
  );
}
