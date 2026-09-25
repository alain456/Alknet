import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Calendar, History, Package, Search, Stethoscope, Building2, Clock, X, BedDouble, MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';
import hospitalService, { APPOINTMENT_STATUS_LABELS } from '../hospital/hospitalService';
import retailService, { ORDER_STATUS_LABELS as RETAIL_ORDER_LABELS } from '../retail/retailService';
import wholesaleService, {
  ORDER_STATUS_LABELS as WHOLESALE_ORDER_LABELS,
} from '../wholesale/wholesaleService';
import hotelService from '../hotel/hotelService';

const HOTEL_STATUS_LABELS = {
  DRAFT: 'Brouillon',
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  EXPECTED: 'Arrivée prévue',
  CHECKED_IN: 'En séjour',
  CHECKED_OUT: 'Terminée',
  CANCELLED: 'Annulée',
  NO_SHOW: 'No-show',
  EXPIRED: 'Expirée',
};

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

function categoryName(business) {
  return (
    business?.primary_category_name
    || business?.category_name
    || business?.category?.name
    || business?.primary_category_detail?.name
    || ''
  );
}

function categorySlug(business) {
  return (
    business?.primary_category_slug
    || business?.category_slug
    || business?.primary_category_detail?.slug
    || business?.category?.slug
    || ''
  ).toLowerCase();
}

function isWholesalePharmacy(business) {
  const name = categoryName(business).toLowerCase();
  const slug = categorySlug(business);
  return name.includes('pharmacie de gros')
    || (name.includes('pharmac') && name.includes('gros'))
    || slug.includes('gros')
    || slug.includes('wholesale');
}

function isRetailPharmacy(business) {
  const name = categoryName(business).toLowerCase();
  const slug = categorySlug(business);
  if (isWholesalePharmacy(business)) return false;
  return name.includes('pharmacie de détail')
    || name.includes('pharmacie de detail')
    || (name.includes('pharmac') && (name.includes('détail') || name.includes('detail') || name.includes('officine')))
    || name.trim() === 'pharmacie'
    || slug.includes('detail')
    || slug.includes('retail')
    || slug.includes('officine');
}

function isHospitalBusiness(business) {
  const name = categoryName(business).toLowerCase();
  const slug = categorySlug(business);
  if (isWholesalePharmacy(business)) return false;
  const terms = ['sant', 'hôpital', 'hopital', 'hospital', 'clinique', 'cabinet', 'médical', 'medical', 'health'];
  return terms.some((t) => name.includes(t) || slug.includes(t));
}

function isCommerceBusiness(business) {
  const name = categoryName(business).toLowerCase();
  const slug = categorySlug(business);
  const keywords = ['commerce', 'boutique', 'mode', 'quincaillerie', 'supermarché', 'supermarche', 'électronique', 'electronique'];
  return keywords.some((k) => name.includes(k) || slug.includes(k));
}

function isHotelBusiness(business) {
  const name = categoryName(business).toLowerCase();
  const slug = categorySlug(business);
  return name.includes('hôtel')
    || name.includes('hotel')
    || name.includes('hôtellerie')
    || name.includes('hotellerie')
    || slug.includes('hotel')
    || slug.includes('hotellerie');
}

/** Priorité : chemin URL (fiable) puis catégorie métier. */
function detectSector(business, pathname = '') {
  const path = String(pathname || '');
  if (path.includes('/hospitals/')) return 'hospital';
  if (path.includes('/hotels/')) return 'hotel';
  if (path.includes('/pharmacy')) return 'retail';
  if (path.includes('/catalog')) return 'wholesale';
  if (path.includes('/shop')) return 'commerce';
  if (isWholesalePharmacy(business)) return 'wholesale';
  if (isRetailPharmacy(business)) return 'retail';
  if (isHospitalBusiness(business)) return 'hospital';
  if (isHotelBusiness(business)) return 'hotel';
  if (isCommerceBusiness(business)) return 'commerce';
  return 'generic';
}

function profileBackPath(businessId, sector) {
  if (sector === 'hospital') return `/hospitals/${businessId}`;
  if (sector === 'hotel') return `/hotels/${businessId}`;
  if (sector === 'retail') return `/businesses/${businessId}/pharmacy`;
  if (sector === 'wholesale') return `/businesses/${businessId}/catalog`;
  if (sector === 'commerce') return `/businesses/${businessId}/shop`;
  return `/businesses`;
}

function statusStyle(status) {
  const s = String(status || '').toUpperCase();
  if (['COMPLETED', 'ACCEPTED', 'CONFIRMED', 'PAID', 'CHECKED_IN', 'EXPECTED'].includes(s)) return 'bg-emerald-100 text-emerald-800';
  if (['CANCELLED', 'REJECTED', 'FAILED', 'NO_SHOW', 'EXPIRED'].includes(s)) return 'bg-red-100 text-red-800';
  if (['PENDING', 'REQUEST_SENT', 'SUBMITTED', 'PROCESSING', 'AWAITING_PIN', 'UNPAID', 'DRAFT', 'CHECKED_OUT'].includes(s)) {
    return 'bg-amber-100 text-amber-800';
  }
  return 'bg-gray-100 text-gray-700';
}

function toLocalYmd(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addLocalDaysYmd(ymd, days) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toLocalYmd(dt);
}

function localDateTimeIso(ymd, hm = '09:00') {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh, mm] = String(hm || '09:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).toISOString();
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function money(amount, currency = 'BIF') {
  if (amount == null || amount === '') return null;
  return `${Number(amount).toLocaleString('fr-BI')} ${currency}`;
}

export default function BusinessClientHistoryPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [business, setBusiness] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [reloadKey, setReloadKey] = useState(0);
  const [anticipateTarget, setAnticipateTarget] = useState(null);
  const [anticipateReason, setAnticipateReason] = useState('');
  const [anticipateDate, setAnticipateDate] = useState('');
  const [anticipateTime, setAnticipateTime] = useState('09:00');
  const [anticipateBusy, setAnticipateBusy] = useState(false);
  const [anticipateError, setAnticipateError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [messageTarget, setMessageTarget] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleIn, setRescheduleIn] = useState('');
  const [rescheduleOut, setRescheduleOut] = useState('');
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const anticipateDateRef = useRef(null);

  const sector = useMemo(
    () => detectSector(business, location.pathname),
    [business, location.pathname],
  );
  const backPath = profileBackPath(id, sector);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const isHotelPath = String(location.pathname || '').includes('/hotels/');
        if (isHotelPath) {
          const h = await hotelService.publicHotel(id);
          if (!cancelled) {
            setBusiness({
              id: h.id,
              name: h.trade_name || h.name,
              logo: h.logo,
              primary_category_name: 'Hôtel',
              primary_category_slug: 'hotel',
              phone: h.phone,
              email: h.email,
              address: h.address,
              commune: h.city,
              province: h.province,
              description: h.description,
            });
          }
          return;
        }
        const b = await api.get(`businesses/${id}/`);
        if (!cancelled) setBusiness(b);
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.status === 429
              ? 'Trop de requêtes. Patientez quelques secondes puis rechargez.'
              : (err.message || 'Entreprise introuvable'),
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id, location.pathname]);

  useEffect(() => {
    if (authLoading || !business || !isAuthenticated) {
      if (!authLoading && !isAuthenticated) setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const sectorKey = detectSector(business, location.pathname);
        const rows = [];

        // Hôpital + entreprises génériques : RDV + réservations services
        if (sectorKey === 'hospital' || sectorKey === 'generic') {
          const [apptsRaw, bookingsRaw] = await Promise.all([
            hospitalService.getAppointments({ hospital: id }).catch(() => []),
            api.get(`bookings/?business=${id}`, { auth: true }).catch(() => []),
          ]);
          normalizeList(apptsRaw).forEach((a) => {
            const doctorUser = a.doctor_details?.user_details;
            const doctorName = doctorUser
              ? `${doctorUser.first_name || ''} ${doctorUser.last_name || ''}`.trim()
              : (a.doctor_name || '');
            rows.push({
              id: `apt-${a.id}`,
              rawId: a.id,
              kind: 'appointment',
              kindLabel: 'Rendez-vous',
              title: a.service_name || doctorName || 'Consultation',
              subtitle: a.reference_code || a.reason || '',
              date: a.appointment_date || a.created_at,
              status: a.status,
              statusLabel: a.status_display || APPOINTMENT_STATUS_LABELS[a.status] || a.status,
              amount: a.consultation_fee_amount,
              currency: a.consultation_fee_currency || 'BIF',
              paymentStatus: a.payment_status,
              anticipationStatus: a.anticipation_status || 'NONE',
              anticipationReason: a.anticipation_reason || '',
              anticipationPreferredAt: a.anticipation_preferred_at || null,
              anticipationAdminNote: a.anticipation_admin_note || '',
              canAnticipate:
                ['PENDING', 'REQUEST_SENT', 'CONFIRMED'].includes(a.status)
                && a.anticipation_status !== 'PENDING'
                && new Date(a.appointment_date || 0) > new Date(),
            });
          });
          normalizeList(bookingsRaw).forEach((b) => {
            rows.push({
              id: `bk-${b.id}`,
              kind: 'booking',
              kindLabel: 'Réservation',
              title: b.service_title || 'Service',
              subtitle: b.notes || '',
              date: b.scheduled_date || b.created_at,
              status: b.status,
              statusLabel: b.status_display || b.status,
            });
          });
        }

        if (sectorKey === 'retail') {
          const ordersRaw = await retailService.getOrders({ business: id }).catch(() => []);
          normalizeList(ordersRaw)
            .filter((o) => {
              const bizId = o.retail_business?.id || o.retail_business || o.pharmacy;
              return String(bizId) === String(id);
            })
            .forEach((o) => {
              rows.push({
                id: `ro-${o.id}`,
                kind: 'retail_order',
                kindLabel: 'Commande pharmacie',
                title: o.reference || `Commande #${String(o.id).slice(0, 8)}`,
                subtitle: o.patient_name || o.patient_email || '',
                date: o.created_at || o.submitted_at,
                status: o.status,
                statusLabel: RETAIL_ORDER_LABELS[o.status] || o.status_display || o.status,
                amount: o.total_amount ?? o.total,
                currency: o.currency || 'BIF',
                paymentStatus: o.payment_status,
              });
            });
        }

        if (sectorKey === 'wholesale') {
          const ordersRaw = await wholesaleService.getOrders({ business: id }).catch(() => []);
          normalizeList(ordersRaw)
            .filter((o) => String(o.wholesale_business || '') === String(id))
            .forEach((o) => {
              rows.push({
                id: `wo-${o.id}`,
                kind: 'wholesale_order',
                kindLabel: 'Commande gros',
                title: o.reference || `Commande #${String(o.id).slice(0, 8)}`,
                subtitle: o.buyer_name || o.buyer_email || o.client_business_name || '',
                date: o.created_at || o.submitted_at,
                status: o.status,
                statusLabel: WHOLESALE_ORDER_LABELS[o.status] || o.status_display || o.status,
                amount: o.total_amount ?? o.total,
                currency: o.currency || 'BIF',
                paymentStatus: o.payment_status,
              });
            });
        }

        if (sectorKey === 'hotel') {
          let hotelsRaw = [];
          try {
            hotelsRaw = await hotelService.myReservations({ hotel: id });
          } catch (hotelErr) {
            if (!cancelled) {
              setError(
                hotelErr?.message
                || 'Impossible de charger vos réservations hôtel. Réessayez dans un instant.',
              );
            }
          }
          normalizeList(hotelsRaw)
            .filter((r) => !r.hotel_id || String(r.hotel_id) === String(id))
            .forEach((r) => {
              const nights = r.nights ? `${r.nights} nuit(s)` : '';
              const dates = [r.check_in_date, r.check_out_date].filter(Boolean).join(' → ');
              rows.push({
                id: `ht-${r.id}`,
                rawId: r.id,
                kind: 'hotel_reservation',
                kindLabel: 'Réservation hôtel',
                title: `${r.room_type_name || 'Chambre'}${r.room_number ? ` · Ch. ${r.room_number}` : ''}`,
                subtitle: [r.reference, dates, nights].filter(Boolean).join(' · '),
                date: r.check_in_date || r.created_at,
                checkIn: r.check_in_date,
                checkOut: r.check_out_date,
                status: r.status,
                statusLabel: HOTEL_STATUS_LABELS[r.status] || r.status,
                amount: r.total_amount,
                currency: r.currency || 'BIF',
                paymentStatus: r.payment_status,
                notes: r.special_requests || '',
                decisionNote: r.decision_note || '',
                decisionAt: r.decision_at || '',
                rescheduleStatus: r.reschedule_status || 'NONE',
                reschedulePreferredIn: r.reschedule_preferred_check_in || '',
                reschedulePreferredOut: r.reschedule_preferred_check_out || '',
                rescheduleReason: r.reschedule_reason || '',
                rescheduleAdminNote: r.reschedule_admin_note || '',
                departureTomorrow: Boolean(r.departure_tomorrow),
                departureReminderNote: r.departure_reminder_note || '',
                departureReminderAt: r.departure_reminder_sent_at || '',
                canMessage: !['CANCELLED', 'CHECKED_OUT', 'EXPIRED', 'NO_SHOW'].includes(r.status),
                canReschedule:
                  ['PENDING', 'CONFIRMED', 'EXPECTED'].includes(r.status)
                  && r.reschedule_status !== 'PENDING',
              });
            });
        }

        // Boutique commerce + autres entreprises : commandes catalogue
        if (sectorKey === 'generic' || sectorKey === 'commerce') {
          const [ordersRaw, bookingsRaw] = await Promise.all([
            api.get(`orders/?business=${id}`, { auth: true }).catch(() => []),
            sectorKey === 'commerce'
              ? api.get(`bookings/?business=${id}`, { auth: true }).catch(() => [])
              : Promise.resolve([]),
          ]);
          normalizeList(ordersRaw).forEach((o) => {
            rows.push({
              id: `ord-${o.id}`,
              kind: 'order',
              kindLabel: 'Commande',
              title: o.reference_code || o.reference || `Commande #${String(o.id).slice(0, 8)}`,
              subtitle: o.guest_name || o.contact_phone || o.guest_phone || '',
              date: o.created_at,
              status: o.status,
              statusLabel: o.status_display || o.status,
              amount: o.total_amount ?? o.total,
              currency: o.currency || 'BIF',
              paymentStatus: o.payment_status,
            });
          });
          normalizeList(bookingsRaw).forEach((b) => {
            rows.push({
              id: `bk-${b.id}`,
              kind: 'booking',
              kindLabel: 'Réservation',
              title: b.service_title || 'Service',
              subtitle: b.notes || '',
              date: b.scheduled_date || b.created_at,
              status: b.status,
              statusLabel: b.status_display || b.status,
            });
          });
        }

        rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        if (!cancelled) setItems(rows);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Impossible de charger l’historique');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated, business, id, reloadKey, location.pathname]);

  const openAnticipate = (item) => {
    setAnticipateTarget(item);
    setAnticipateReason('');
    setAnticipateDate('');
    setAnticipateTime('09:00');
    setAnticipateError('');
  };

  const anticipateMinDate = toLocalYmd(new Date());
  const anticipateApptDate = anticipateTarget?.date
    ? toLocalYmd(anticipateTarget.date)
    : undefined;
  // Anticiper OU reporter : de aujourd'hui jusqu'à ~6 mois
  const anticipateSelectableMax = addLocalDaysYmd(anticipateMinDate, 180);

  const moveKindLabel = (preferredAt, currentAt) => {
    if (!preferredAt || !currentAt) return 'déplacer';
    const p = new Date(preferredAt).getTime();
    const c = new Date(currentAt).getTime();
    if (Number.isNaN(p) || Number.isNaN(c)) return 'déplacer';
    if (p < c) return 'anticiper';
    if (p > c) return 'reporter';
    return 'déplacer';
  };

  const openAnticipateDatePicker = () => {
    const el = anticipateDateRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') el.showPicker();
      else el.click();
    } catch {
      el.click();
    }
  };

  const formatChosenAnticipateDate = () => {
    if (!anticipateDate) return null;
    try {
      const iso = localDateTimeIso(anticipateDate, anticipateTime || '09:00');
      return new Date(iso).toLocaleString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return `${anticipateDate} ${anticipateTime}`;
    }
  };

  const submitAnticipate = async (e) => {
    e.preventDefault();
    if (!anticipateTarget?.rawId) return;
    const reason = anticipateReason.trim();
    if (!reason) {
      setAnticipateError('Indiquez le motif de votre demande.');
      return;
    }

    let preferredIso = null;
    if (anticipateDate) {
      preferredIso = localDateTimeIso(anticipateDate, anticipateTime || '09:00');
      const preferred = new Date(preferredIso);
      const current = new Date(anticipateTarget.date);
      const now = new Date();
      if (Number.isNaN(preferred.getTime())) {
        setAnticipateError('Date invalide. Choisissez une autre date.');
        return;
      }
      if (preferred < now) {
        setAnticipateError('La date/heure choisie est déjà passée. Choisissez un créneau futur.');
        return;
      }
      if (Math.abs(preferred.getTime() - current.getTime()) < 2 * 60 * 1000) {
        setAnticipateError('Choisissez une date/heure différente de votre rendez-vous actuel.');
        return;
      }
    }

    setAnticipateBusy(true);
    setAnticipateError('');
    try {
      const payload = { reason };
      if (preferredIso) payload.preferred_date = preferredIso;
      const res = await hospitalService.requestAppointmentAnticipation(anticipateTarget.rawId, payload);
      setAnticipateTarget(null);
      setActionMessage(res.message || 'Demande envoyée à l\'hôpital.');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setAnticipateError(err.message || 'Impossible d\'envoyer la demande');
    } finally {
      setAnticipateBusy(false);
    }
  };

  const submitHotelMessage = async (e) => {
    e.preventDefault();
    if (!messageTarget?.rawId) return;
    const text = messageText.trim();
    if (!text) {
      setMessageError('Écrivez votre message.');
      return;
    }
    setMessageBusy(true);
    setMessageError('');
    try {
      const res = await hotelService.sendReservationMessage(messageTarget.rawId, text);
      setMessageTarget(null);
      setMessageText('');
      setActionMessage(res.message || 'Message envoyé à l’hôtel.');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setMessageError(err.message || 'Impossible d’envoyer le message');
    } finally {
      setMessageBusy(false);
    }
  };

  const openHotelReschedule = (item) => {
    setRescheduleTarget(item);
    setRescheduleReason('');
    setRescheduleIn(item.checkIn || '');
    setRescheduleOut(item.checkOut || '');
    setRescheduleError('');
  };

  const submitHotelReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleTarget?.rawId) return;
    const reason = rescheduleReason.trim();
    if (!reason) {
      setRescheduleError('Indiquez le motif (anticiper ou reporter).');
      return;
    }
    if (!rescheduleIn || !rescheduleOut) {
      setRescheduleError('Choisissez les nouvelles dates d’arrivée et de départ.');
      return;
    }
    setRescheduleBusy(true);
    setRescheduleError('');
    try {
      const res = await hotelService.requestReschedule(rescheduleTarget.rawId, {
        reason,
        preferred_check_in: rescheduleIn,
        preferred_check_out: rescheduleOut,
      });
      setRescheduleTarget(null);
      setActionMessage(res.message || 'Demande envoyée à l’hôtel.');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setRescheduleError(err.message || 'Impossible d’envoyer la demande');
    } finally {
      setRescheduleBusy(false);
    }
  };

  const filtered = items.filter((item) => {
    if (tab !== 'all' && item.kind !== tab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(q)
      || (item.subtitle || '').toLowerCase().includes(q)
      || (item.statusLabel || '').toLowerCase().includes(q)
      || (item.kindLabel || '').toLowerCase().includes(q)
    );
  });

  const tabs = useMemo(() => {
    const kinds = [...new Set(items.map((i) => i.kind))];
    const labels = {
      appointment: 'Rendez-vous',
      booking: 'Réservations',
      hotel_reservation: 'Séjours',
      retail_order: 'Commandes',
      wholesale_order: 'Commandes',
      order: 'Commandes',
    };
    return [{ key: 'all', label: 'Tout' }, ...kinds.map((k) => ({ key: k, label: labels[k] || k }))];
  }, [items]);

  const goLogin = () => {
    navigate('/login', {
      state: {
        from: location.pathname,
        message: 'Connectez-vous pour voir votre historique avec cet établissement.',
      },
    });
  };

  if (error && !business) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link to="/businesses" className="text-teal-700 font-semibold">Retour aux entreprises</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-16">
      <div className="bg-gradient-to-r from-slate-800 to-teal-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <Link
            to={backPath}
            className="inline-flex items-center gap-2 text-sm text-teal-100 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Retour au profil
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
              {business?.logo ? (
                <img src={business.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-7 h-7 text-teal-200" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-teal-200 font-semibold flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Mon historique
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold truncate">
                {business?.name || 'Établissement'}
              </h1>
              <p className="text-teal-100 text-sm mt-1">
                Vos interactions avec cet établissement uniquement.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-4">
        {actionMessage && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm">
            {actionMessage}
          </div>
        )}
        {!authLoading && !isAuthenticated ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center shadow-sm">
            <History className="w-10 h-10 text-teal-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Connexion requise
            </h2>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Connectez-vous pour consulter vos rendez-vous, réservations et commandes avec {business?.name || 'cet établissement'}.
            </p>
            <button
              type="button"
              onClick={goLogin}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-semibold"
            >
              Se connecter
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      tab === t.key
                        ? 'bg-teal-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm w-full sm:w-56 bg-white dark:bg-gray-950"
                />
              </div>
            </div>

            {loading || authLoading ? (
              <div className="p-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-600 text-sm">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-300 font-medium">Aucun historique pour le moment</p>
                <p className="text-sm text-gray-400 mt-1">
                  {sector === 'hotel'
                    ? 'Vos demandes de séjour et échanges avec cet hôtel apparaîtront ici.'
                    : 'Les rendez-vous et commandes passés avec cet établissement apparaîtront ici.'}
                </p>
                <Link
                  to={backPath}
                  className="inline-flex mt-5 px-4 py-2 bg-teal-700 text-white rounded-xl text-sm font-semibold"
                >
                  Continuer sur le profil
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((item) => (
                  <li key={item.id} className="p-4 sm:p-5 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition">
                    <div className="flex gap-3 sm:gap-4">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                        {item.kind === 'hotel_reservation'
                          ? <BedDouble className="w-5 h-5" />
                          : item.kind === 'appointment' || item.kind === 'booking'
                            ? <Stethoscope className="w-5 h-5" />
                            : item.kind.includes('order')
                              ? <Package className="w-5 h-5" />
                              : <Calendar className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                            {item.kindLabel}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle(item.status)}`}>
                            {item.statusLabel}
                          </span>
                          {item.paymentStatus && item.paymentStatus !== 'UNPAID' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                              {item.paymentStatus === 'PAID' ? 'Payé' : item.paymentStatus}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {item.title}
                        </p>
                        {item.subtitle ? (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{item.subtitle}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {item.kind === 'hotel_reservation' && item.checkIn && item.checkOut
                              ? `${item.checkIn} → ${item.checkOut}`
                              : formatDate(item.date)}
                          </span>
                          {money(item.amount, item.currency) && (
                            <span className="font-semibold text-teal-700 dark:text-teal-300">
                              {money(item.amount, item.currency)}
                            </span>
                          )}
                        </div>
                        {item.kind === 'appointment' && item.anticipationStatus === 'PENDING' && (
                          <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Demande de déplacement envoyée — en attente de l&apos;hôpital
                            {item.anticipationPreferredAt ? (
                              <> ({moveKindLabel(item.anticipationPreferredAt, item.date)})</>
                            ) : null}
                          </p>
                        )}
                        {item.kind === 'appointment' && item.anticipationStatus === 'ACCEPTED' && (
                          <p className="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                            Déplacement accepté
                            {item.anticipationAdminNote ? ` — ${item.anticipationAdminNote}` : ''}
                          </p>
                        )}
                        {item.kind === 'appointment' && item.anticipationStatus === 'REFUSED' && (
                          <p className="mt-2 text-xs font-medium text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                            Déplacement refusé
                            {item.anticipationAdminNote ? ` — ${item.anticipationAdminNote}` : ''}
                          </p>
                        )}
                        {item.notes ? (
                          <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 rounded-lg px-2.5 py-2">
                            {item.kind === 'hotel_reservation' ? (
                              <span className="font-semibold text-gray-800 dark:text-gray-100">Échanges avec l&apos;hôtel — </span>
                            ) : null}
                            {item.notes}
                          </p>
                        ) : null}
                        {item.kind === 'hotel_reservation' && item.decisionNote && (
                          <p className={`mt-2 text-xs font-medium rounded-lg px-2.5 py-1.5 border ${
                            item.status === 'CANCELLED'
                              ? 'text-red-800 bg-red-50 border-red-100'
                              : 'text-emerald-800 bg-emerald-50 border-emerald-100'
                          }`}
                          >
                            {item.status === 'CANCELLED' ? 'Refus hôtel : ' : 'Confirmation hôtel : '}
                            {item.decisionNote}
                          </p>
                        )}
                        {item.kind === 'hotel_reservation' && (item.departureTomorrow || item.departureReminderNote) && (
                          <p className="mt-2 text-xs font-medium text-orange-900 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5 inline-flex items-start gap-1.5">
                            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>
                              {item.departureReminderNote
                                || `Rappel : votre séjour se termine demain (check-out le ${item.checkOut}).`}
                            </span>
                          </p>
                        )}
                        {item.kind === 'hotel_reservation' && item.rescheduleStatus === 'PENDING' && (
                          <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Demande de dates ({item.reschedulePreferredIn} → {item.reschedulePreferredOut}) — en attente de l&apos;hôtel
                          </p>
                        )}
                        {item.kind === 'hotel_reservation' && item.rescheduleStatus === 'ACCEPTED' && (
                          <p className="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                            Modification de dates acceptée
                            {item.rescheduleAdminNote ? ` — ${item.rescheduleAdminNote}` : ''}
                          </p>
                        )}
                        {item.kind === 'hotel_reservation' && item.rescheduleStatus === 'REFUSED' && (
                          <p className="mt-2 text-xs font-medium text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                            Modification de dates refusée
                            {item.rescheduleAdminNote ? ` — ${item.rescheduleAdminNote}` : ''}
                          </p>
                        )}
                        {item.canAnticipate && (
                          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                            <p className="text-xs text-amber-900/80 mb-2">
                              Besoin de venir plus tôt ou plus tard ? Envoyez une demande à l&apos;hôpital.
                            </p>
                            <button
                              type="button"
                              onClick={() => openAnticipate(item)}
                              className="w-full sm:w-auto px-4 py-2.5 text-sm font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center justify-center gap-2 shadow-sm"
                            >
                              <Clock className="w-4 h-4" />
                              Anticiper ou reporter
                            </button>
                          </div>
                        )}
                        {item.canReschedule && (
                          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                            <p className="text-xs text-amber-900/80 mb-2">
                              Besoin d&apos;arriver plus tôt ou plus tard ? Proposez de nouvelles dates à l&apos;hôtel.
                            </p>
                            <button
                              type="button"
                              onClick={() => openHotelReschedule(item)}
                              className="w-full sm:w-auto px-4 py-2.5 text-sm font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center justify-center gap-2 shadow-sm"
                            >
                              <Clock className="w-4 h-4" />
                              Anticiper ou reporter
                            </button>
                          </div>
                        )}
                        {item.canMessage && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => {
                                setMessageTarget(item);
                                setMessageText('');
                                setMessageError('');
                              }}
                              className="w-full sm:w-auto px-4 py-2.5 text-sm font-bold rounded-xl bg-teal-700 hover:bg-teal-800 text-white inline-flex items-center justify-center gap-2"
                            >
                              <MessageSquare className="w-4 h-4" />
                              Envoyer un message à l&apos;hôtel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {anticipateTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={submitAnticipate}
            className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-amber-100 dark:border-gray-800 overflow-hidden max-h-[95vh] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-amber-100 font-semibold">Demande patient</p>
                <h3 className="text-xl font-bold flex items-center gap-2 mt-0.5">
                  <Clock className="w-5 h-5" />
                  Anticiper ou reporter
                </h3>
              </div>
              <button
                type="button"
                disabled={anticipateBusy}
                onClick={() => setAnticipateTarget(null)}
                className="icon-btn"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div className="rounded-xl p-4 bg-amber-50 border border-amber-100 text-sm">
                <p className="font-bold text-gray-900">{anticipateTarget.title}</p>
                <p className="text-sm text-amber-900 mt-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>Créneau actuel : <strong>{formatDate(anticipateTarget.date)}</strong></span>
                </p>
                {anticipateTarget.subtitle ? (
                  <p className="text-xs text-gray-500 font-mono mt-2">{anticipateTarget.subtitle}</p>
                ) : null}
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Choisissez une nouvelle date <strong>plus tôt</strong> (anticiper) ou <strong>plus tard</strong> (reporter).
                L&apos;administration de l&apos;hôpital acceptera ou refusera votre demande.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Nouvelle date souhaitée
                </label>
                <button
                  type="button"
                  onClick={openAnticipateDatePicker}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border-2 border-amber-300 bg-white hover:bg-amber-50 text-left transition shadow-sm"
                >
                  <span className="inline-flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-gray-900">
                        {anticipateDate ? (
                          moveKindLabel(
                            localDateTimeIso(anticipateDate, anticipateTime),
                            anticipateTarget.date,
                          ) === 'anticiper'
                            ? 'Anticiper — date choisie'
                            : moveKindLabel(
                              localDateTimeIso(anticipateDate, anticipateTime),
                              anticipateTarget.date,
                            ) === 'reporter'
                              ? 'Reporter — date choisie'
                              : 'Date choisie'
                        ) : 'Choisir une date'}
                      </span>
                      <span className="block text-xs text-gray-500 truncate mt-0.5">
                        {formatChosenAnticipateDate() || 'Ouvrir le calendrier'}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs font-bold text-amber-700 shrink-0 px-2.5 py-1 rounded-lg bg-amber-100">
                    Calendrier
                  </span>
                </button>
                <input
                  ref={anticipateDateRef}
                  type="date"
                  value={anticipateDate}
                  min={anticipateMinDate}
                  max={anticipateSelectableMax}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (!next) {
                      setAnticipateDate('');
                      return;
                    }
                    if (anticipateMinDate && next < anticipateMinDate) {
                      setAnticipateError('Choisissez une date à partir d\'aujourd\'hui.');
                      return;
                    }
                    if (anticipateSelectableMax && next > anticipateSelectableMax) {
                      setAnticipateError('Choisissez une date dans les 6 prochains mois.');
                      return;
                    }
                    setAnticipateError('');
                    setAnticipateDate(next);
                  }}
                  className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 bg-amber-50/40 text-sm font-semibold text-gray-900"
                  aria-label="Choisir une date"
                />
                {anticipateDate && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="text-xs font-semibold text-gray-600">Heure :</label>
                    <select
                      value={anticipateTime}
                      onChange={(e) => setAnticipateTime(e.target.value)}
                      className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold bg-white"
                    >
                      {['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
                        '11:00', '11:30', '12:00', '13:00', '13:30', '14:00', '14:30',
                        '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setAnticipateDate(''); setAnticipateTime('09:00'); setAnticipateError(''); }}
                      className="text-xs font-semibold text-gray-500 hover:text-red-600 underline"
                    >
                      Effacer la date
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-gray-400">
                  Optionnel — avant le RDV actuel pour anticiper, après pour reporter
                  {anticipateApptDate ? ` (actuel : ${anticipateApptDate.split('-').reverse().join('/')})` : ''}.
                </p>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Motif de la demande *
                </label>
                <textarea
                  required
                  rows={4}
                  value={anticipateReason}
                  onChange={(e) => setAnticipateReason(e.target.value)}
                  placeholder="Ex. : urgence familiale, disponibilité plus tôt…"
                  className="mt-2 w-full px-4 py-3 border-2 border-gray-200 focus:border-amber-400 rounded-xl text-sm dark:bg-gray-950 dark:border-gray-700 outline-none"
                />
              </div>

              {anticipateError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {anticipateError}
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={anticipateBusy}
                  onClick={() => setAnticipateTarget(null)}
                  className="px-4 py-3 text-sm font-semibold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={anticipateBusy || !anticipateReason.trim()}
                  className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  {anticipateBusy ? 'Envoi…' : 'Envoyer à l\'hôpital'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {messageTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={submitHotelMessage}
            className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-teal-100 dark:border-gray-800 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-teal-700 to-slate-800 text-white px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-teal-100 font-semibold">Message client</p>
                <h3 className="text-xl font-bold flex items-center gap-2 mt-0.5">
                  <MessageSquare className="w-5 h-5" />
                  Contacter l&apos;hôtel
                </h3>
              </div>
              <button
                type="button"
                disabled={messageBusy}
                onClick={() => setMessageTarget(null)}
                className="icon-btn"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="rounded-xl p-3 bg-teal-50 border border-teal-100 text-sm">
                <p className="font-bold text-gray-900">{messageTarget.title}</p>
                <p className="text-xs text-gray-500 mt-1">{messageTarget.subtitle}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Votre message *</label>
                <textarea
                  required
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Ex. : arrivée tardive, demande de lit bébé, question sur le paiement…"
                  className="mt-2 w-full px-4 py-3 border-2 border-gray-200 focus:border-teal-500 rounded-xl text-sm dark:bg-gray-950 dark:border-gray-700 outline-none"
                />
              </div>
              {messageError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {messageError}
                </p>
              )}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  disabled={messageBusy}
                  onClick={() => setMessageTarget(null)}
                  className="px-4 py-3 text-sm font-semibold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={messageBusy || !messageText.trim()}
                  className="px-5 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  {messageBusy ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={submitHotelReschedule}
            className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-amber-100 dark:border-gray-800 overflow-hidden max-h-[95vh] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-amber-100 font-semibold">Demande client</p>
                <h3 className="text-xl font-bold flex items-center gap-2 mt-0.5">
                  <Clock className="w-5 h-5" />
                  Anticiper ou reporter
                </h3>
              </div>
              <button
                type="button"
                disabled={rescheduleBusy}
                onClick={() => setRescheduleTarget(null)}
                className="icon-btn"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="rounded-xl p-3 bg-amber-50 border border-amber-100 text-sm">
                <p className="font-bold text-gray-900">{rescheduleTarget.title}</p>
                <p className="text-xs text-amber-900 mt-1">
                  Séjour actuel : <strong>{rescheduleTarget.checkIn} → {rescheduleTarget.checkOut}</strong>
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Nouvelle arrivée *</label>
                  <input
                    type="date"
                    required
                    min={toLocalYmd(new Date())}
                    value={rescheduleIn}
                    onChange={(e) => setRescheduleIn(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Nouveau départ *</label>
                  <input
                    type="date"
                    required
                    min={rescheduleIn || toLocalYmd(new Date())}
                    value={rescheduleOut}
                    onChange={(e) => setRescheduleOut(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Motif *</label>
                <textarea
                  required
                  rows={3}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Ex. : vol reporté, arrivée anticipée pour un événement…"
                  className="mt-1 w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm"
                />
              </div>
              {rescheduleError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {rescheduleError}
                </p>
              )}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  disabled={rescheduleBusy}
                  onClick={() => setRescheduleTarget(null)}
                  className="px-4 py-3 text-sm font-semibold rounded-xl border border-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={rescheduleBusy || !rescheduleReason.trim()}
                  className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  {rescheduleBusy ? 'Envoi…' : 'Envoyer à l’hôtel'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
