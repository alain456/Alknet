import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import hotelService, { listOf } from '../hotelService';
import BurundiPayPayerField from '../../shared/components/BurundiPayPayerField';
import { isValidBurundiPayPhone } from '../../shared/components/burundiPayPhone';
import { HotelPage, Panel, fieldClass, btnPrimary, btnGhost, Empty } from '../ui';
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

function folioTitle(f) {
  return [
    f.guest_name || 'Client',
    f.room_number ? `Ch. ${f.room_number}` : null,
    f.reservation_ref || null,
  ].filter(Boolean).join(' · ');
}

export default function CashierFolios() {
  const { canCreate, canUpdate } = useHotelPerm();
  const canPay = canCreate('cashier') || canUpdate('cashier');
  const [searchParams, setSearchParams] = useSearchParams();
  const unpaidOnly = searchParams.get('unpaid') === '1';
  const folioParam = searchParams.get('folio') || '';

  const [folios, setFolios] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [payerPhone, setPayerPhone] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [pendingBp, setPendingBp] = useState(null);

  const load = async () => {
    const params = unpaidOnly ? { unpaid: '1' } : {};
    const [f, p] = await Promise.all([
      hotelService.folios(params),
      hotelService.payments(unpaidOnly ? {} : { today: '1' }),
    ]);
    const list = listOf(f);
    setFolios(list);
    setPayments(listOf(p).slice(0, 40));
    return list;
  };

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [unpaidOnly]);

  useEffect(() => {
    if (!folioParam || !folios.length) return;
    const match = folios.find((x) => String(x.id) === String(folioParam));
    if (match) {
      setSelected(match);
      setAmount(match.balance > 0 ? String(match.balance) : '');
      const awaiting = (match.payments || []).find(
        (p) => p.method === 'BURUNDIPAY' && p.status === 'AWAITING_PIN',
      );
      setPendingBp(awaiting || null);
    }
  }, [folioParam, folios]);

  const open = useMemo(() => {
    let rows = unpaidOnly
      ? folios.filter((f) => f.status === 'OPEN' && Number(f.balance) > 0)
      : folios.filter((f) => f.status === 'OPEN');
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((f) => {
        const hay = [f.guest_name, f.guest_phone, f.reservation_ref, f.room_number].join(' ').toLowerCase();
        return hay.includes(needle);
      });
    }
    return rows;
  }, [folios, unpaidOnly, q]);

  const selectFolio = (f) => {
    setSelected(f);
    setErr('');
    setMsg('');
    setPendingBp(null);
    setAmount(f.balance > 0 ? String(f.balance) : '');
    const awaiting = (f.payments || []).find(
      (p) => p.method === 'BURUNDIPAY' && p.status === 'AWAITING_PIN',
    );
    setPendingBp(awaiting || null);
    const next = new URLSearchParams(searchParams);
    next.set('folio', f.id);
    setSearchParams(next, { replace: true });
  };

  const refreshSelected = async (folioId) => {
    const list = await load();
    const refreshed = list.find((x) => x.id === folioId);
    setSelected(refreshed || null);
    setAmount(refreshed && refreshed.balance > 0 ? String(refreshed.balance) : '');
    const awaiting = (refreshed?.payments || []).find(
      (p) => p.method === 'BURUNDIPAY' && p.status === 'AWAITING_PIN',
    );
    setPendingBp(awaiting || null);
    return refreshed;
  };

  const payManual = async () => {
    if (!selected?.id) return;
    setBusy(true);
    setErr('');
    try {
      const res = await hotelService.createPayment({
        folio: selected.id,
        amount,
        method,
      });
      setMsg('Paiement enregistré');
      if (res?.receipt) setReceipt(res.receipt);
      else if (res?.id) {
        const r = await hotelService.paymentReceipt(res.id);
        setReceipt(r);
      }
      await refreshSelected(selected.id);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const payBurundiPay = async () => {
    if (!selected?.id) return;
    if (!isValidBurundiPayPhone(payerPhone)) {
      setErr('Numéro BurundiPay invalide (8 chiffres, ex. 79xxxxxx).');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await hotelService.folioPayBurundiPay(selected.id, {
        amount,
        payer_phone: payerPhone,
      });
      if (!res.ok) {
        setErr(res.message || 'Échec BurundiPay');
      } else {
        setMsg(res.message || 'PIN BurundiPay en attente');
        setPendingBp(res.payment);
      }
      await refreshSelected(selected.id);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmBurundiPay = async () => {
    if (!selected?.id) return;
    setBusy(true);
    setErr('');
    try {
      const res = await hotelService.folioConfirmBurundiPay(selected.id, {
        payment_id: pendingBp?.id,
      });
      if (!res.ok) {
        setErr(res.message || 'Confirmation impossible');
      } else {
        setMsg(res.message || 'Paiement confirmé');
        setPendingBp(null);
        if (res.payment?.id) {
          const r = await hotelService.paymentReceipt(res.payment.id);
          setReceipt(r);
        }
      }
      await refreshSelected(selected.id);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HotelPage
      title="Caisse — Folios & paiements"
      subtitle={canPay ? 'Encaissement (espèces / BurundiPay) et reçus' : 'Consultation des folios (lecture seule)'}
      actions={(
        <div className="flex flex-wrap gap-2">
          <Link to="/hotel/cashier" className={`${btnGhost} text-sm`}>Dashboard caisse</Link>
          <button
            type="button"
            className={`${unpaidOnly ? btnPrimary : btnGhost} text-sm`}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (unpaidOnly) next.delete('unpaid');
              else next.set('unpaid', '1');
              setSearchParams(next);
            }}
          >
            {unpaidOnly ? 'Tous les folios ouverts' : 'Soldes en attente seulement'}
          </button>
        </div>
      )}
    >
      {(err || msg) && (
        <p className={`text-sm font-bold mb-2 ${err ? 'text-alert' : 'text-primary'}`}>{err || msg}</p>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <h2 className="font-extrabold text-ink flex-1">
              {unpaidOnly ? 'Soldes en attente' : 'Folios ouverts'}
            </h2>
            <input
              className={`${fieldClass} sm:max-w-[14rem]`}
              placeholder="Client, chambre, réf…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {!open.length ? (
            <Empty>{unpaidOnly ? 'Aucun solde en attente' : 'Aucun folio ouvert'}</Empty>
          ) : open.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => selectFolio(f)}
              className={`w-full text-left p-3 rounded-xl border-2 mb-2 transition ${
                selected?.id === f.id ? 'border-primary bg-primary/5' : 'border-accent/30 hover:border-accent'
              }`}
            >
              <p className="font-extrabold text-ink text-sm">{folioTitle(f)}</p>
              <p className="text-xs text-ink-muted mt-0.5">
                {[
                  f.check_in_date && f.check_out_date ? `${f.check_in_date} → ${f.check_out_date}` : null,
                  f.stay_status,
                  f.guest_phone,
                ].filter(Boolean).join(' · ')}
              </p>
              <p className="text-sm font-bold text-primary mt-1">
                Solde {Number(f.balance).toLocaleString()} {f.currency || 'BIF'}
              </p>
            </button>
          ))}
          {selected && (
            <div className="mt-4 space-y-3 border-t-2 border-accent/20 pt-3">
              <p className="text-sm font-extrabold text-ink">{folioTitle(selected)}</p>
              <p className="text-xs text-ink-muted">
                {[
                  selected.reservation_ref && `Réf. ${selected.reservation_ref}`,
                  selected.room_number && `Chambre ${selected.room_number}`,
                  selected.guest_phone,
                ].filter(Boolean).join(' · ')}
              </p>
              {canPay ? (
                <>
                  <p className="text-sm font-bold text-ink">Encaisser</p>
                  <input
                    type="number"
                    min="0"
                    className={fieldClass}
                    placeholder="Montant"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <select className={fieldClass} value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="CASH">Espèces</option>
                    <option value="BURUNDIPAY">BurundiPay</option>
                    <option value="MOBILE_MONEY">Mobile money (manuel)</option>
                    <option value="CARD">Carte</option>
                    <option value="TRANSFER">Virement</option>
                  </select>

                  {method === 'BURUNDIPAY' ? (
                    <div className="space-y-2">
                      <BurundiPayPayerField
                        value={payerPhone}
                        onChange={setPayerPhone}
                        amountLabel={amount ? `${Number(amount).toLocaleString()} BIF` : ''}
                        hint="Le client valide le PIN BurundiPay. En simulation, utilisez « Confirmer PIN »."
                      />
                      <button
                        type="button"
                        disabled={busy || !amount}
                        className={btnPrimary}
                        onClick={payBurundiPay}
                      >
                        {busy ? 'Envoi…' : 'Initier BurundiPay'}
                      </button>
                      {pendingBp && (
                        <button
                          type="button"
                          disabled={busy}
                          className={`${btnGhost} w-full`}
                          onClick={confirmBurundiPay}
                        >
                          Confirmer PIN (simulation)
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || !amount}
                      className={btnPrimary}
                      onClick={payManual}
                    >
                      {busy ? 'Enregistrement…' : 'Enregistrer le paiement'}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-xs font-bold text-ink-muted">Lecture seule — pas d’encaissement.</p>
              )}
              <ul className="text-xs text-ink space-y-1 pt-1">
                {(selected.items || []).map((i) => (
                  <li key={i.id}>{i.description} — {Number(i.total).toLocaleString()} BIF</li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
        <Panel>
          <h2 className="font-extrabold text-ink mb-3">
            {unpaidOnly ? 'Derniers paiements' : 'Paiements du jour'}
          </h2>
          {!payments.length ? (
            <Empty>Aucun paiement</Empty>
          ) : payments.map((p) => (
            <div key={p.id} className="py-2 border-b border-accent/10 text-sm font-medium text-ink">
              <div className="flex justify-between gap-2 items-start">
                <div className="min-w-0">
                  <p className="font-bold truncate">
                    {[p.guest_name, p.room_number && `Ch. ${p.room_number}`, p.reservation_ref]
                      .filter(Boolean)
                      .join(' · ') || 'Paiement'}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {METHOD_LABELS[p.method] || p.method} · {p.status}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-primary">{Number(p.amount).toLocaleString()} BIF</p>
                  {p.status === 'PAID' && (
                    <button
                      type="button"
                      className="text-[11px] font-bold text-accent underline"
                      onClick={() => {
                        hotelService.paymentReceipt(p.id)
                          .then(setReceipt)
                          .catch((e) => setErr(e.message));
                      }}
                    >
                      Reçu
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      {receipt && (
        <PaymentReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </HotelPage>
  );
}
