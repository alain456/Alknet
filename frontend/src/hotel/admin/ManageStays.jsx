import React, { useEffect, useState } from 'react';
import hotelService, { listOf } from '../hotelService';
import { HotelPage, Panel, fieldClass, btnPrimary, btnGhost, Empty } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

export default function ManageStays() {
  const { can, canUpdate, canCreate, canView } = useHotelPerm();
  const allowUpdate = canUpdate('stays');
  const allowCheckOut = can('hotel.stays.check_out') || allowUpdate;
  const allowForceOut = can('hotel.manage');
  const allowPay = canCreate('cashier') || canUpdate('cashier');
  const canViewServices = canView('services');
  const [stays, setStays] = useState([]);
  const [services, setServices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [svcId, setSvcId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [s, r] = await Promise.all([
      hotelService.stays({ status: 'IN_HOUSE' }),
      hotelService.rooms().catch(() => []),
    ]);
    setStays(listOf(s));
    setRooms(listOf(r));
    // Services : uniquement si droit view (sinon 403 pour réceptionniste)
    if (canViewServices) {
      try {
        const svc = await hotelService.services();
        setServices(listOf(svc).filter((x) => x.is_active !== false));
      } catch {
        setServices([]);
      }
    } else {
      setServices([]);
    }
  };
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [canViewServices]);

  const refreshSelected = async (id) => {
    const all = listOf(await hotelService.stays());
    const found = all.find((x) => x.id === id);
    setSelected(found || null);
    setStays(all.filter((x) => x.status === 'IN_HOUSE'));
  };

  const addSvc = async () => {
    if (!selected || !svcId) return;
    try {
      await hotelService.addService(selected.id, svcId, 1);
      setMsg('Service ajouté');
      refreshSelected(selected.id);
    } catch (e) { setErr(e.message); }
  };

  const pay = async () => {
    if (!selected?.folio || !payAmount) return;
    try {
      await hotelService.createPayment({ folio: selected.folio.id, amount: payAmount, method: 'CASH' });
      setPayAmount('');
      setMsg('Paiement enregistré');
      refreshSelected(selected.id);
    } catch (e) { setErr(e.message); }
  };

  const checkout = async (allow = false) => {
    if (!selected) return;
    try {
      const inv = await hotelService.checkOut(selected.id, allow);
      const mail = inv?.email_notification;
      const note = mail?.sent
        ? ` Email client envoyé${mail.recipient ? ` (${mail.recipient})` : ''}.`
        : (mail ? ` Email non envoyé : ${mail.error || 'pas d’adresse client'}.` : '');
      const hk = inv?.housekeeping_notification;
      const hkNote = hk?.ok || hk?.sent || hk?.in_app
        ? ` Gouvernante notifiée (CLEANING_REQUIRED Ch. ${hk.room_number || selected.room_number || '?'}).`
        : (hk ? ` Gouvernante non notifiée : ${hk.error || 'aucun lead'}.` : '');
      setMsg(`Check-out OK — facture ${inv.number}.${note}${hkNote}`);
      setSelected(null);
      load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <HotelPage title="Séjours" subtitle="Clients présents, services, check-out">
      {(err || msg) && (
        <Panel className={err ? 'border-alert' : ''}>
          <p className={`text-sm font-bold ${err ? 'text-alert' : 'text-primary'}`}>{err || msg}</p>
        </Panel>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <h2 className="font-extrabold text-ink mb-3">En maison</h2>
          {!stays.length ? <Empty>Aucun séjour</Empty> : stays.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setErr(''); setMsg(''); setSelected(s); }}
              className={`w-full text-left p-3 rounded-xl border-2 mb-2 ${selected?.id === s.id ? 'border-primary bg-primary/5' : 'border-accent/30'}`}
            >
              <p className="font-bold text-ink">{s.guest_name} · Ch. {s.room_number}</p>
              <p className="text-xs text-ink-muted">{s.reservation_ref} · solde {s.folio ? Number(s.folio.balance).toLocaleString() : '—'} BIF</p>
            </button>
          ))}
        </Panel>
        <Panel>
          {!selected ? <Empty>Sélectionnez un séjour</Empty> : (
            <div className="space-y-4">
              <div>
                <h2 className="font-extrabold text-ink">{selected.guest_name}</h2>
                <p className="text-sm text-ink-muted">Chambre {selected.room_number} · {selected.reservation_ref}</p>
              </div>
              {selected.folio && (
                <div className="text-sm space-y-1 font-medium text-ink">
                  <p>Total : {Number(selected.folio.total).toLocaleString()} BIF</p>
                  <p>Payé : {Number(selected.folio.paid_amount).toLocaleString()} BIF</p>
                  <p className="font-extrabold text-primary">Solde : {Number(selected.folio.balance).toLocaleString()} BIF</p>
                  <ul className="mt-2 text-xs space-y-1">
                    {(selected.folio.items || []).map((i) => (
                      <li key={i.id}>{i.description} × {i.quantity} = {Number(i.total).toLocaleString()}</li>
                    ))}
                  </ul>
                </div>
              )}
              {allowUpdate && canViewServices && (
              <div className="flex gap-2">
                <select className={fieldClass} value={svcId} onChange={(e) => setSvcId(e.target.value)}>
                  <option value="">Service…</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({Number(s.unit_price).toLocaleString()})</option>)}
                </select>
                <button type="button" className={btnPrimary} onClick={addSvc}>Ajouter</button>
              </div>
              )}
              {allowPay && (
              <div className="flex gap-2">
                <input className={fieldClass} type="number" min="0" placeholder="Montant paiement" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <button type="button" className={btnPrimary} onClick={pay}>Encaisser</button>
              </div>
              )}
              {allowCheckOut ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={() => checkout(false)}>Check-out</button>
                {allowForceOut && (
                <button
                  type="button"
                  className={btnGhost}
                  title="Départ autorisé même si le folio a un solde impayé (manager)"
                  onClick={() => checkout(true)}
                >
                  Malgré solde (manager)
                </button>
                )}
              </div>
              ) : (
                <p className="text-xs font-bold text-ink-muted">Lecture seule</p>
              )}
              <div>
                <label className="text-sm font-bold text-ink">Changer de chambre</label>
                <select
                  className={fieldClass}
                  defaultValue=""
                  onChange={async (e) => {
                    if (!e.target.value) return;
                    try {
                      await hotelService.changeRoom(selected.id, e.target.value);
                      refreshSelected(selected.id);
                    } catch (ex) { setErr(ex.message); }
                  }}
                >
                  <option value="">Choisir…</option>
                  {rooms.filter((r) => r.id !== selected.room && ['AVAILABLE', 'RESERVED'].includes(r.operational_status)).map((r) => (
                    <option key={r.id} value={r.id}>{r.number}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </HotelPage>
  );
}
