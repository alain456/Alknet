import React, { useEffect, useMemo } from 'react';
import BurundiPayPayerField from '../shared/components/BurundiPayPayerField';
import { isValidBurundiPayPhone } from '../shared/components/burundiPayPhone';

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const emptyReservationForm = (overrides = {}) => ({
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  room_type: '',
  room: '',
  rate_plan: '',
  check_in_date: today(),
  check_out_date: plusDays(1),
  adults: 1,
  children: 0,
  special_requests: '',
  amount_per_night: '',
  accept_conditions: false,
  payment_mode: 'BURUNDIPAY',
  payer_phone: '',
  ...overrides,
});

function nightsBetween(checkIn, checkOut) {
  try {
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    const n = Math.round((b - a) / 86400000);
    return Math.max(n, 0);
  } catch {
    return 0;
  }
}

/**
 * Formulaire réservation partagé (client public + admin / réception).
 * mode: 'public' | 'admin'
 */
export default function ReservationBookingForm({
  mode = 'public',
  form,
  setForm,
  roomTypes = [],
  rates = [],
  availableRooms = [],
  availability,
  currency = 'BIF',
  fieldClass,
  submitLabel,
  onSubmit,
  err = '',
  saving = false,
  showConditions = mode === 'public',
  showAdminExtras = mode === 'admin',
}) {
  const nights = nightsBetween(form.check_in_date, form.check_out_date);

  const ratesForType = useMemo(() => {
    const fromApi = rates.filter((r) => (
      r.is_active !== false
      && (!form.room_type || String(r.room_type) === String(form.room_type))
    ));
    if (fromApi.length || !form.room_type) return fromApi;
    const t = roomTypes.find((x) => String(x.id) === String(form.room_type));
    const base = Number(t?.base_price || 0);
    if (!t || !(base > 0)) return fromApi;
    return [{
      id: `base:${t.id}`,
      room_type: t.id,
      name: 'Standard',
      price_per_night: base,
      currency,
      min_nights: 1,
      is_active: true,
      is_synthetic: true,
    }];
  }, [rates, form.room_type, roomTypes, currency]);

  const selectedType = useMemo(
    () => roomTypes.find((t) => String(t.id) === String(form.room_type)),
    [roomTypes, form.room_type],
  );

  const selectedRate = useMemo(
    () => ratesForType.find((r) => String(r.id) === String(form.rate_plan)),
    [ratesForType, form.rate_plan],
  );

  // Auto-sélection du tarif (unique ou synthétique depuis prix de base)
  useEffect(() => {
    if (!form.room_type || !ratesForType.length) return;
    const stillValid = ratesForType.some((r) => String(r.id) === String(form.rate_plan));
    if (stillValid) return;
    if (ratesForType.length === 1 || mode === 'public') {
      setForm((prev) => ({ ...prev, rate_plan: String(ratesForType[0].id) }));
    }
  }, [form.room_type, form.rate_plan, ratesForType, setForm, mode]);

  // Préremplir le numéro BurundiPay depuis le téléphone client
  useEffect(() => {
    if (form.payer_phone || !form.phone) return;
    const digits = String(form.phone).replace(/\D/g, '');
    if (digits.length >= 8) {
      setForm((prev) => (prev.payer_phone ? prev : { ...prev, payer_phone: prev.phone }));
    }
  }, [form.phone, form.payer_phone, setForm]);

  const capAdults = Number(selectedType?.capacity_adults ?? 0) || 0;
  const capChildren = Number(selectedType?.capacity_children ?? 0) || 0;
  const adultsN = Number(form.adults) || 1;
  const childrenN = Number(form.children) || 0;
  const capacityError = (() => {
    if (!selectedType) return '';
    if (capAdults && adultsN > capAdults) {
      return `Maximum ${capAdults} adulte(s) pour « ${selectedType.name} ».`;
    }
    if (childrenN > capChildren) {
      return `Maximum ${capChildren} enfant(s) pour « ${selectedType.name} ».`;
    }
    return '';
  })();

  const perNight = Number(
    selectedRate?.price_per_night
    || selectedType?.base_price
    || 0,
  );
  const rateCurrency = selectedRate?.currency || currency;
  const estimatedTotal = perNight * nights;
  const priceUnavailable = Boolean(form.room_type) && !(perNight > 0) && !ratesForType.length;
  const showPaymentBlock = mode === 'public' || estimatedTotal > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (capacityError || priceUnavailable) return;
    if (estimatedTotal > 0 && !isValidBurundiPayPhone(form.payer_phone)) {
      return;
    }
    const rateId = form.rate_plan && !String(form.rate_plan).startsWith('base:')
      ? form.rate_plan
      : '';
    onSubmit?.({
      ...form,
      rate_plan: rateId || undefined,
      payment_mode: 'BURUNDIPAY',
      nights,
      estimated_total: estimatedTotal,
      amount_per_night_resolved: perNight,
      amount_per_night: perNight,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {err && <p className="text-sm text-alert font-bold whitespace-pre-wrap">{err}</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-ink-muted mb-1">Arrivée *</label>
          <input
            type="date"
            required
            className={fieldClass}
            value={form.check_in_date}
            onChange={(e) => setForm({ ...form, check_in_date: e.target.value, room: '' })}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-ink-muted mb-1">Départ *</label>
          <input
            type="date"
            required
            className={fieldClass}
            value={form.check_out_date}
            onChange={(e) => setForm({ ...form, check_out_date: e.target.value, room: '' })}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-ink-muted mb-1">Type de chambre *</label>
        <select
          required
          className={fieldClass}
          value={form.room_type}
          onChange={(e) => setForm({
            ...form,
            room_type: e.target.value,
            room: '',
            rate_plan: '',
            adults: 1,
            children: 0,
          })}
        >
          <option value="">Sélectionner…</option>
          {roomTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.capacity_adults != null
                ? ` · max ${t.capacity_adults} ad. / ${t.capacity_children ?? 0} enf.`
                : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-ink-muted mb-1">
          {ratesForType.length > 1 ? 'Tarif *' : 'Tarif'}
        </label>
        {ratesForType.length > 1 ? (
          <select
            required
            className={fieldClass}
            value={form.rate_plan}
            onChange={(e) => setForm({ ...form, rate_plan: e.target.value })}
            disabled={!form.room_type}
          >
            <option value="">
              {!form.room_type ? 'Choisir d’abord un type…' : 'Sélectionner un tarif…'}
            </option>
            {ratesForType.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {Number(r.price_per_night).toLocaleString()} {r.currency || currency}/nuit
                {r.min_nights > 1 ? ` (min. ${r.min_nights} nuits)` : ''}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm font-bold text-ink py-2.5 px-3 rounded-xl border-2 border-accent/20 bg-surface">
            {form.room_type && perNight > 0
              ? `${(selectedRate?.name || 'Standard')} — ${perNight.toLocaleString()} ${rateCurrency}/nuit`
              : (form.room_type
                ? (mode === 'public'
                  ? 'Tarif en cours de confirmation…'
                  : 'Le système appliquera le prix de base du type (ou créera un tarif).')
                : 'Choisissez un type de chambre')}
          </p>
        )}
        {priceUnavailable && (
          <p className="text-[11px] text-ink-muted font-medium mt-1">
            {mode === 'public'
              ? 'Ce type n’est pas disponible pour le moment. Choisissez un autre type ou réessayez plus tard.'
              : 'Aucun prix défini : le manager / agent tarifs a été (sera) alerté. Définissez un tarif ou un prix de base sur le type.'}
          </p>
        )}
      </div>

      {availability && (
        <p className={`text-sm font-bold ${availability.available_count ? 'text-primary' : 'text-alert'}`}>
          {availability.available_count
            ? `${availability.available_count} chambre(s) disponible(s)`
            : 'Indisponible sur ces dates'}
        </p>
      )}

      {showAdminExtras && (
        <div>
          <label className="block text-xs font-bold text-ink-muted mb-1">Chambre</label>
          <select
            className={fieldClass}
            value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
          >
            <option value="">Attribuer plus tard…</option>
            {availableRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number} ({r.housekeeping_status || r.operational_status || '—'})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-ink-muted mb-1">Prénom *</label>
          <input
            required
            className={fieldClass}
            placeholder="Prénom"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-ink-muted mb-1">Nom *</label>
          <input
            required
            className={fieldClass}
            placeholder="Nom"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-ink-muted mb-1">Téléphone</label>
          <input
            className={fieldClass}
            placeholder="Téléphone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-ink-muted mb-1">Email</label>
          <input
            type="email"
            className={fieldClass}
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-ink-muted mb-1">
            Adultes{capAdults ? ` (max ${capAdults})` : ''}
          </label>
          <input
            type="number"
            min={1}
            max={capAdults || undefined}
            className={fieldClass}
            value={form.adults}
            onChange={(e) => setForm({ ...form, adults: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-ink-muted mb-1">
            Enfants{selectedType ? ` (max ${capChildren})` : ''}
          </label>
          <input
            type="number"
            min={0}
            max={capChildren || undefined}
            className={fieldClass}
            value={form.children}
            onChange={(e) => setForm({ ...form, children: e.target.value })}
          />
        </div>
      </div>
      {capacityError && (
        <p className="text-xs text-alert font-bold -mt-2">{capacityError}</p>
      )}

      <div>
        <label className="block text-xs font-bold text-ink-muted mb-1">Demandes spéciales</label>
        <textarea
          className={fieldClass}
          placeholder="Arrivée tardive, lit bébé…"
          value={form.special_requests}
          onChange={(e) => setForm({ ...form, special_requests: e.target.value })}
        />
      </div>

      {nights > 0 && selectedRate && (
        <div className="rounded-xl border-2 border-accent/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-bold text-ink">
            Tarif « {selectedRate.name} » · {nights} nuit(s) · {perNight.toLocaleString()} {rateCurrency}/nuit
          </p>
          <p className="text-primary font-extrabold text-base mt-0.5">
            Total estimé : {estimatedTotal.toLocaleString()} {rateCurrency}
          </p>
        </div>
      )}

      {showPaymentBlock && (
        <div className="space-y-3 rounded-2xl border-2 border-accent bg-surface p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
              Moyen de paiement
            </p>
            <div className="mt-2 flex items-center gap-3 rounded-xl border-2 border-accent/50 bg-primary/5 px-3 py-2.5">
              <img
                src="/burundipay.png"
                alt=""
                className="h-9 w-auto object-contain shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-ink">BurundiPay</p>
                <p className="text-[11px] font-medium text-ink-muted">
                  Banque ou mobile money · paiement en ligne
                </p>
              </div>
              <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wide text-primary border-2 border-accent rounded-lg px-2 py-1">
                Sélectionné
              </span>
            </div>
          </div>

          {estimatedTotal > 0 ? (
            <BurundiPayPayerField
              value={form.payer_phone}
              onChange={(v) => setForm({ ...form, payer_phone: v })}
              amountLabel={`${estimatedTotal.toLocaleString()} ${rateCurrency}`}
              required
              hint="Saisissez le numéro BurundiPay (banque ou mobile money) pour payer la réservation. Validez ensuite le PIN."
            />
          ) : (
            <p className="text-xs font-medium text-ink-muted">
              Choisissez un type de chambre et un tarif pour afficher le montant, puis saisissez votre numéro BurundiPay.
            </p>
          )}
        </div>
      )}

      {showConditions && (
        <label className="flex items-start gap-2 text-sm font-medium text-ink cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={!!form.accept_conditions}
            onChange={(e) => setForm({ ...form, accept_conditions: e.target.checked })}
          />
          <span>
            J&apos;accepte les conditions de séjour et la politique d&apos;annulation de l&apos;établissement.
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={
          saving
          || Boolean(capacityError)
          || priceUnavailable
          || (availability && !availability.available_count)
          || (estimatedTotal > 0 && !isValidBurundiPayPhone(form.payer_phone))
        }
        className="w-full py-3 rounded-xl bg-primary text-surface font-bold border-2 border-accent disabled:opacity-50"
      >
        {saving ? 'Enregistrement…' : (submitLabel || (mode === 'public' ? 'Réserver et payer' : 'Enregistrer'))}
      </button>
    </form>
  );
}
