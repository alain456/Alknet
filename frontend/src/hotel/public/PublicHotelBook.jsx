import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  MapPin, Phone, Mail, Globe, Clock, Wifi, Shield, Utensils,
  Sparkles, BedDouble, Star, ChevronRight, Info, ConciergeBell, History, BadgeCheck,
} from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import ReservationBookingForm, { emptyReservationForm } from '../ReservationBookingForm';
import RoomTypesCarousel from './RoomTypesCarousel';
import { amenityIcon } from './hotelAmenityIcon';
import OrderPaymentSuccess from '../../shared/components/OrderPaymentSuccess';
import { useAuth } from '../../context/AuthContext';
import { websiteHref } from '../../shared/websiteUrl';
import { ROLES, getBusinessCategoryKey } from '../../auth/roleAccess';
import { isValidBurundiPayPhone } from '../../shared/components/burundiPayPhone';

const fieldClass =
  'w-full px-3 py-2.5 text-sm bg-surface border-2 border-accent rounded-xl text-ink font-medium outline-none focus:border-alert';

const EST_LABELS = {
  HOTEL: 'Hôtel', GUEST_HOUSE: 'Guest house', LODGE: 'Lodge',
  RESIDENCE: 'Résidence', HOSTEL: 'Auberge', OTHER: 'Hébergement',
};

function Section({ title, icon: Icon, children, id }) {
  return (
    <section id={id} className="rounded-2xl border-2 border-accent/40 bg-surface p-5 space-y-3 scroll-mt-24">
      <h2 className="text-lg font-extrabold text-ink flex items-center gap-2 font-display">
        {Icon && <Icon className="w-5 h-5 text-accent shrink-0" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function PublicHotelBook() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [hotel, setHotel] = useState(null);
  const [avail, setAvail] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(null);
  const [showBook, setShowBook] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyReservationForm({ payment_mode: 'BURUNDIPAY' }));

  const isCustomer = user?.role === ROLES.CUSTOMER;
  const isHotelOperator = Boolean(
    user
    && (
      user.role === ROLES.BUSINESS_OWNER
      || user.role === ROLES.PROFESSIONAL
      || getBusinessCategoryKey(user) === 'hotel'
    )
  );

  useEffect(() => {
    hotelService.publicHotel(id).then(setHotel).catch((e) => setErr(e.message));
  }, [id]);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      first_name: prev.first_name || user.first_name || '',
      last_name: prev.last_name || user.last_name || '',
      email: prev.email || user.email || '',
      phone: prev.phone || user.phone_number || '',
    }));
  }, [user]);

  useEffect(() => {
    if (!showBook || !form.room_type || !form.check_in_date || !form.check_out_date) return;
    hotelService.publicAvailability(id, {
      room_type: form.room_type,
      check_in: form.check_in_date,
      check_out: form.check_out_date,
    }).then(setAvail).catch(() => setAvail(null));
  }, [id, showBook, form.room_type, form.check_in_date, form.check_out_date]);

  if (!hotel && !err) {
    return <div className="p-10 text-ink-muted font-medium">Chargement de l&apos;établissement…</div>;
  }

  if (err && !hotel) {
    return (
      <div className="p-10 space-y-3">
        <p className="text-alert font-bold">{err}</p>
        <Link to="/hotels" className="text-sm font-bold text-accent">← Retour aux hôtels</Link>
      </div>
    );
  }

  const info = hotel.guest_info || {};
  const dining = info.dining || {};
  const tips = Array.isArray(info.local_tips) ? info.local_tips : [];
  const amenities = listOf(hotel.amenities);
  const roomTypes = listOf(hotel.room_types);
  const rates = listOf(hotel.rates).filter((r) => r.is_active !== false);
  const services = listOf(hotel.services);
  const gallery = listOf(hotel.gallery).filter(Boolean);
  const cover = hotel.cover_photo || hotel.logo || gallery[0] || '';
  const ratePrices = rates.map((r) => Number(r.price_per_night) || 0).filter((n) => n > 0);
  const fromPrice = ratePrices.length
    ? Math.min(...ratePrices)
    : (roomTypes.length ? Math.min(...roomTypes.map((t) => Number(t.base_price) || 0)) : 0);

  const minRateForType = (typeId) => {
    const matches = rates.filter((r) => String(r.room_type) === String(typeId));
    if (!matches.length) return null;
    return matches.reduce((best, r) => (
      !best || Number(r.price_per_night) < Number(best.price_per_night) ? r : best
    ), null);
  };

  const openBook = (roomType) => {
    if (roomType && typeof roomType === 'object' && roomType.id) {
      setForm((prev) => ({ ...prev, room_type: String(roomType.id) }));
    }
    setShowBook(true);
    setTimeout(() => document.getElementById('reserver')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleBook = async (payload) => {
    setErr('');
    if (!payload.accept_conditions) {
      setErr('Veuillez accepter les conditions de séjour et d\'annulation.');
      return;
    }
    if (payload.estimated_total > 0 && !String(payload.payer_phone || '').trim()) {
      setErr('Indiquez votre numéro BurundiPay pour payer la réservation.');
      return;
    }
    if (payload.estimated_total > 0 && !isValidBurundiPayPhone(payload.payer_phone)) {
      setErr('Numéro BurundiPay invalide. Utilisez 8 chiffres (ex. 79xxxxxx) ou 257XXXXXXXX.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        room_type: payload.room_type,
        check_in_date: payload.check_in_date,
        check_out_date: payload.check_out_date,
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone: payload.phone,
        email: payload.email,
        adults: Number(payload.adults) || 1,
        children: Number(payload.children) || 0,
        special_requests: payload.special_requests,
        payer_phone: String(payload.payer_phone || '').trim(),
      };
      if (payload.rate_plan && !String(payload.rate_plan).startsWith('base:')) {
        body.rate_plan = payload.rate_plan;
      }
      const res = await hotelService.publicBook(id, body, { auth: !!isAuthenticated });
      setOk(res);
    } catch (ex) {
      setErr(ex.message || 'Erreur de réservation');
    } finally {
      setSaving(false);
    }
  };

  if (ok) {
    const doneLabel = isCustomer
      ? 'Voir mon historique'
      : isHotelOperator
        ? 'Traiter dans Réservations'
        : 'Retour à l\'hôtel';
    const emailInfo = ok.email_notification;
    const emailNote = emailInfo
      ? (emailInfo.sent
        ? ` Email de réception envoyé à ${emailInfo.recipient}.`
        : ` Email non envoyé : ${emailInfo.error || 'adresse manquante'}.`)
      : '';
    return (
      <OrderPaymentSuccess
        order={ok}
        title="Réservation envoyée"
        referenceLabel="Votre réservation"
        doneLabel={doneLabel}
        paidHint={`Paiement validé. L'hôtel pourra confirmer votre réservation.${emailNote}`}
        unpaidHint={`Validez le paiement BurundiPay. L'hôtel confirmera ensuite ; vous recevrez un email de confirmation ou de refus.${emailNote}`}
        confirmPayment={(rid) => hotelService.publicConfirmReservationPayment(rid, { auth: !!isAuthenticated })}
        retryPayment={(rid, phone) => hotelService.publicPayReservation(rid, phone || form.payer_phone, { auth: !!isAuthenticated })}
        onOrderUpdate={(next) => setOk((prev) => ({ ...prev, ...next }))}
        onDone={() => {
          // Client → historique personnel (pas l'admin hôtel)
          if (isCustomer) {
            navigate(`/hotels/${id}/historique`);
            return;
          }
          // Owner / staff qui a testé le parcours public → suite ops PMS
          if (isHotelOperator) {
            navigate('/hotel/reservations');
            return;
          }
          setOk(null);
          setShowBook(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface text-ink pb-24 sm:pb-8">
      {/* Hero full-bleed */}
      <header className="relative min-h-[min(78vh,620px)] flex flex-col justify-end overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-105 animate-[fadeIn_1.2s_ease-out]"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 15% 0%, #1E8B4A 0%, transparent 50%), linear-gradient(160deg, #1B4F9C 0%, #1a0c0b 100%)',
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/15" />

        <div className="relative max-w-5xl mx-auto w-full px-4 pt-10 pb-10 space-y-5">
          <Link to="/hotels" className="text-sm font-bold text-accent inline-flex items-center gap-1 hover:underline">
            ← Hôtels
          </Link>

          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-end">
            {hotel.logo ? (
              <img
                src={hotel.logo}
                alt=""
                className="w-20 h-20 rounded-2xl object-cover border-2 border-accent bg-surface shadow-lg shrink-0"
              />
            ) : null}
            <div className="flex-1 min-w-0 space-y-2">
              {hotel.establishment_type && (
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                  {EST_LABELS[hotel.establishment_type] || hotel.establishment_type}
                </p>
              )}
              <h1 className="font-display text-4xl sm:text-5xl font-semibold text-surface leading-tight drop-shadow">
                {hotel.trade_name || hotel.name}
              </h1>
              {hotel.stars ? (
                <p className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-0.5">
                    {Array.from({ length: Number(hotel.stars) }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                    ))}
                  </span>
                  <span className="text-xs font-bold text-surface/80 inline-flex items-center gap-1">
                    {hotel.classification_verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-300" />}
                    {hotel.classification_verified ? 'Classification vérifiée' : 'Classification déclarée'}
                  </span>
                </p>
              ) : null}
              <p className="text-surface/90 font-medium flex items-start gap-2 text-sm sm:text-base">
                <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span>
                  {[hotel.address, hotel.city, hotel.province].filter(Boolean).join(' · ')
                    || 'Adresse non renseignée'}
                </span>
              </p>
              {fromPrice > 0 && (
                <p className="text-lg font-extrabold text-accent">
                  Dès {fromPrice.toLocaleString('fr-FR')} {hotel.currency || 'BIF'}
                  <span className="text-sm font-bold text-surface/80"> /nuit</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <a href="#infos" className="px-4 py-2 rounded-xl border border-surface/30 text-sm font-bold text-surface hover:bg-surface/10 backdrop-blur-sm">
              Infos
            </a>
            <a href="#galerie" className="px-4 py-2 rounded-xl border border-surface/30 text-sm font-bold text-surface hover:bg-surface/10 backdrop-blur-sm">
              Galerie
            </a>
            <a href="#chambres" className="px-4 py-2 rounded-xl border border-surface/30 text-sm font-bold text-surface hover:bg-surface/10 backdrop-blur-sm">
              Chambres
            </a>
            <Link
              to={`/hotels/${id}/historique`}
              className="px-4 py-2 rounded-xl border border-surface/30 text-sm font-bold text-surface hover:bg-surface/10 inline-flex items-center gap-1.5 backdrop-blur-sm"
            >
              <History className="w-4 h-4" /> Historique
            </Link>
            <button
              type="button"
              onClick={() => openBook()}
              className="px-5 py-2 rounded-xl bg-accent text-surface text-sm font-extrabold border border-accent shadow-md hover:opacity-95"
            >
              Réserver un séjour
            </button>
          </div>
        </div>
      </header>

      {/* Pourquoi réserver */}
      <div className="border-b-2 border-accent/20 bg-primary/5">
        <div className="max-w-5xl mx-auto px-4 py-5 grid sm:grid-cols-3 gap-4">
          {[
            { icon: Clock, t: `Check-in ${hotel.check_in_time || '14:00'}`, d: `Départ ${hotel.check_out_time || '12:00'}` },
            { icon: hotel.classification_verified ? BadgeCheck : Star, t: hotel.classification_verified ? 'Classement vérifié' : 'Classement déclaré', d: hotel.stars ? `${hotel.stars} étoile(s)` : 'Fiche établissement' },
            { icon: Shield, t: 'Paiement BurundiPay', d: 'Réservation sécurisée en ligne' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex gap-3 items-start">
              <div className="w-10 h-10 rounded-xl bg-surface border-2 border-accent flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-ink">{t}</p>
                <p className="text-xs text-ink-muted font-medium">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {hotel.description && (
          <Section title="À propos" icon={Info}>
            <p className="text-sm font-medium text-ink leading-relaxed whitespace-pre-line">{hotel.description}</p>
          </Section>
        )}

        {gallery.length > 0 && (
          <Section title="Galerie" icon={Sparkles} id="galerie">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {gallery.slice(0, 6).map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}
                  className={`relative overflow-hidden rounded-xl border-2 border-accent/30 ${
                    i === 0 ? 'col-span-2 row-span-2 min-h-[180px] sm:min-h-[240px]' : 'aspect-[4/3]'
                  }`}
                >
                  <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition duration-500" />
                </button>
              ))}
            </div>
          </Section>
        )}

        <div id="infos" className="grid md:grid-cols-2 gap-4">
          <Section title="Horaires & accès" icon={Clock}>
            <ul className="space-y-2 text-sm font-medium text-ink">
              <li>Check-in : <strong>{hotel.check_in_time || '—'}</strong></li>
              <li>Check-out : <strong>{hotel.check_out_time || '—'}</strong></li>
              {hotel.customer_service_hours ? (
                <li>Service clientèle : <strong>{hotel.customer_service_hours}</strong></li>
              ) : null}
              {Array.isArray(hotel.languages) && hotel.languages.length > 0 ? (
                <li>Langues : <strong>{hotel.languages.join(', ')}</strong></li>
              ) : null}
              {info.wifi ? (
                <li className="flex gap-2"><Wifi className="w-4 h-4 text-accent shrink-0 mt-0.5" /><span>{info.wifi}</span></li>
              ) : null}
              {hotel.latitude != null && hotel.longitude != null && (
                <li>
                  <a
                    className="font-bold text-accent hover:underline"
                    href={`https://www.openstreetmap.org/?mlat=${hotel.latitude}&mlon=${hotel.longitude}#map=16/${hotel.latitude}/${hotel.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Voir sur la carte (GPS)
                  </a>
                </li>
              )}
            </ul>
          </Section>

          <Section title="Réception & contacts" icon={Phone}>
            <ul className="space-y-2 text-sm font-medium text-ink">
              {hotel.phone ? (
                <li className="flex gap-2"><Phone className="w-4 h-4 text-accent shrink-0" /><a href={`tel:${hotel.phone}`} className="hover:text-accent">{hotel.phone}</a></li>
              ) : null}
              {hotel.email ? (
                <li className="flex gap-2"><Mail className="w-4 h-4 text-accent shrink-0" /><a href={`mailto:${hotel.email}`} className="hover:text-accent">{hotel.email}</a></li>
              ) : null}
              {hotel.website ? (
                <li className="flex gap-2"><Globe className="w-4 h-4 text-accent shrink-0" /><a href={websiteHref(hotel.website)} target="_blank" rel="noreferrer" className="hover:text-accent truncate">{hotel.website}</a></li>
              ) : null}
              {info.reception ? <li className="text-ink-muted pt-1">{info.reception}</li> : null}
              {!hotel.phone && !hotel.email && !hotel.website && !info.reception ? (
                <li className="text-ink-muted">Aucun contact publié pour le moment.</li>
              ) : null}
            </ul>
          </Section>
        </div>

        {info.safety ? (
          <Section title="Consignes de sécurité" icon={Shield}>
            <p className="text-sm font-medium text-ink leading-relaxed whitespace-pre-line">{info.safety}</p>
          </Section>
        ) : null}

        {(dining.breakfast || dining.restaurant || dining.room_service) ? (
          <Section title="Restauration" icon={Utensils}>
            <div className="grid sm:grid-cols-3 gap-3 text-sm font-medium text-ink">
              {dining.breakfast ? (
                <div className="p-3 rounded-xl border-2 border-accent/30">
                  <p className="font-bold text-primary mb-1">Petit-déjeuner</p>
                  <p className="text-ink-muted">{dining.breakfast}</p>
                </div>
              ) : null}
              {dining.restaurant ? (
                <div className="p-3 rounded-xl border-2 border-accent/30">
                  <p className="font-bold text-primary mb-1">Restaurant</p>
                  <p className="text-ink-muted">{dining.restaurant}</p>
                </div>
              ) : null}
              {dining.room_service ? (
                <div className="p-3 rounded-xl border-2 border-accent/30">
                  <p className="font-bold text-primary mb-1">Room service</p>
                  <p className="text-ink-muted">{dining.room_service}</p>
                </div>
              ) : null}
            </div>
          </Section>
        ) : null}

        {(amenities.length > 0 || info.wellness || info.room_guide) ? (
          <Section title="Équipements & espaces" icon={Sparkles}>
            {amenities.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {amenities.map((a) => {
                  const Icon = amenityIcon(a);
                  return (
                    <div
                      key={a}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 border-accent/40 bg-primary/5"
                    >
                      <Icon className="w-4 h-4 text-accent shrink-0" />
                      <span className="text-sm font-bold text-ink">{a}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {info.wellness ? <p className="text-sm font-medium text-ink mt-3">{info.wellness}</p> : null}
            {info.room_guide ? (
              <p className="text-sm text-ink-muted mt-2">
                <strong className="text-ink">Guide chambre :</strong> {info.room_guide}
              </p>
            ) : null}
          </Section>
        ) : null}

        <div id="chambres" />
        <Section title="Types de chambres" icon={BedDouble}>
          <RoomTypesCarousel
            roomTypes={roomTypes}
            currency={hotel.currency || 'BIF'}
            minRateForType={minRateForType}
            onBook={openBook}
          />
        </Section>

        {services.length > 0 && (
          <Section title="Services à la carte" icon={ConciergeBell}>
            <ul className="space-y-2 text-sm font-medium text-ink">
              {services.map((s) => (
                <li key={s.id} className="flex justify-between gap-3 border-b border-accent/15 pb-2">
                  <span>{s.name}{s.description ? ` — ${s.description}` : ''}</span>
                  <span className="font-bold text-primary shrink-0">{Number(s.unit_price).toLocaleString()} {s.currency || hotel.currency}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-muted">Ces services peuvent être ajoutés pendant le séjour via la réception.</p>
          </Section>
        )}

        {tips.length > 0 && (
          <Section title="Recommandations locales" icon={MapPin}>
            <ul className="space-y-3">
              {tips.map((t, i) => (
                <li key={i} className="text-sm">
                  <p className="font-bold text-ink">{t.title || 'Suggestion'}</p>
                  <p className="text-ink-muted font-medium">{t.detail || t.description || ''}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(hotel.stay_conditions || hotel.deposit_policy) && (
          <Section title="Conditions de séjour" icon={Shield}>
            {hotel.stay_conditions && (
              <p className="text-sm font-medium text-ink whitespace-pre-line">{hotel.stay_conditions}</p>
            )}
            {hotel.deposit_policy && (
              <p className="text-sm text-ink-muted mt-2">
                <strong className="text-ink">Dépôt :</strong> {hotel.deposit_policy}
              </p>
            )}
            <p className="text-xs text-ink-muted mt-2">
              Animaux : {hotel.pets_allowed ? 'acceptés' : 'non acceptés'} ·
              Tabac : {hotel.smoking_allowed ? 'autorisé' : 'non autorisé'}
            </p>
          </Section>
        )}

        {hotel.cancellation_policy && (
          <Section title="Politique d'annulation" icon={Shield}>
            <p className="text-sm font-medium text-ink whitespace-pre-line">{hotel.cancellation_policy}</p>
          </Section>
        )}

        <Section title="Actions" icon={ChevronRight}>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => openBook()}
              className="px-5 py-2.5 rounded-xl bg-primary text-surface font-bold border-2 border-accent"
            >
              Réserver un séjour
            </button>
            {hotel.phone && (
              <a href={`tel:${hotel.phone}`} className="px-5 py-2.5 rounded-xl border-2 border-accent font-bold text-ink">
                Appeler la réception
              </a>
            )}
            {isAuthenticated && (
              <Link to="/dashboard/bookings" className="px-5 py-2.5 rounded-xl border-2 border-accent font-bold text-ink">
                Mes réservations
              </Link>
            )}
          </div>
        </Section>

        {showBook && (
          <div id="reserver">
            <Section title="Réserver un séjour" icon={BedDouble}>
              <ReservationBookingForm
                mode="public"
                form={form}
                setForm={setForm}
                roomTypes={roomTypes}
                rates={rates}
                currency={hotel.currency || 'BIF'}
                fieldClass={fieldClass}
                availability={avail}
                err={err}
                saving={saving}
                submitLabel="Réserver et payer"
                onSubmit={handleBook}
              />
            </Section>
          </div>
        )}
      </div>

      {/* Sticky CTA mobile */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t-2 border-accent bg-surface/95 backdrop-blur-md px-4 py-3 safe-pb">
        <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wide">À partir de</p>
            <p className="text-base font-extrabold text-primary truncate">
              {fromPrice > 0
                ? `${fromPrice.toLocaleString('fr-FR')} ${hotel.currency || 'BIF'}/nuit`
                : 'Sur demande'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openBook()}
            className="shrink-0 px-5 py-3 rounded-xl bg-accent text-surface text-sm font-extrabold border-2 border-primary/20 shadow"
          >
            Réserver
          </button>
        </div>
      </div>
    </div>
  );
}
