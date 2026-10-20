import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare, Clock, AlertTriangle, TrendingUp, TrendingDown, Minus, CheckCircle2,
} from 'lucide-react';
import hotelService from '../hotelService';
import { HotelPage, StatCard, Panel, Empty } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

function formatBif(n) {
  return `${Number(n || 0).toLocaleString('fr-FR')} BIF`;
}

function TrendHint({ pct }) {
  if (pct == null || Number.isNaN(Number(pct))) {
    return <span className="text-xs text-ink-muted">vs 7j préc.</span>;
  }
  const v = Number(pct);
  if (v > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700">
        <TrendingUp className="w-3.5 h-3.5" /> +{v}% vs 7j préc.
      </span>
    );
  }
  if (v < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-alert">
        <TrendingDown className="w-3.5 h-3.5" /> {v}% vs 7j préc.
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-ink-muted">
      <Minus className="w-3.5 h-3.5" /> stable vs 7j préc.
    </span>
  );
}

function OccupancyChart({ trend }) {
  const rows = Array.isArray(trend) ? trend : [];
  if (!rows.length) return <p className="text-sm text-ink-muted">Pas encore d’occupation sur la période.</p>;
  const w = 640;
  const h = 168;
  const padX = 12;
  const padY = 16;
  const pts = rows.map((r, i) => {
    const x = padX + (i * (w - padX * 2)) / Math.max(rows.length - 1, 1);
    const rate = Math.max(0, Math.min(100, Number(r.occupancy_rate) || 0));
    const y = h - padY - (rate / 100) * (h - padY * 2);
    return { x, y, r };
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${h - padY} L${pts[0].x.toFixed(1)},${h - padY} Z`;
  const today = pts.find((p) => p.r.is_today);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40" role="img" aria-label="Occupation sur 13 jours">
        <path d={area} fill="color-mix(in srgb, #32667F 18%, transparent)" />
        <path d={line} fill="none" stroke="#32667F" strokeWidth="2.5" strokeLinejoin="round" />
        {today && (
          <>
            <line x1={today.x} y1={padY} x2={today.x} y2={h - padY} stroke="#EA8B33" strokeDasharray="3 3" />
            <circle cx={today.x} cy={today.y} r="5" fill="#EA8B33" stroke="#132F45" strokeWidth="1.5" />
          </>
        )}
      </svg>
      <div className="flex justify-between text-[10px] font-bold text-ink-muted px-1">
        <span>{rows[0].label}</span>
        <span>{today ? `Aujourd’hui ${Math.round(Number(today.r.occupancy_rate) || 0)}%` : ''}</span>
        <span>{rows[rows.length - 1].label}</span>
      </div>
    </div>
  );
}

function weekDays(trend) {
  const rows = Array.isArray(trend) ? trend : [];
  const today = rows.find((r) => r.is_today);
  if (!today) return rows.slice(0, 7);
  const start = new Date(`${today.date}T12:00:00`);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const keys = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    keys.push(`${d.getFullYear()}-${m}-${day}`);
  }
  return keys.map((key) => rows.find((r) => r.date === key)).filter(Boolean);
}

function heatStyle(rate) {
  const r = Number(rate) || 0;
  if (r <= 0) return { background: '#F5F5F5', color: '#132F45' };
  if (r < 34) return { background: 'color-mix(in srgb, #32667F 30%, #F5F5F5)', color: '#132F45' };
  if (r < 67) return { background: 'color-mix(in srgb, #32667F 62%, #F5F5F5)', color: '#132F45' };
  return { background: '#32667F', color: '#F5F5F5' };
}

function WeekHeat({ trend }) {
  const days = weekDays(trend);
  if (!days.length) return null;
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((r) => {
          const name = new Date(`${r.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
          return (
            <div key={r.date} className="text-center">
              <p className="text-[10px] font-bold text-ink-muted capitalize mb-1">{name}</p>
              <div
                className="aspect-square rounded-lg flex items-center justify-center text-[11px] font-extrabold"
                style={{
                  ...heatStyle(r.occupancy_rate),
                  outline: r.is_today ? '2px solid #EA8B33' : 'none',
                  outlineOffset: '1px',
                }}
                title={`${r.label} · ${r.occupancy_rate}% · ${r.occupied} chambre(s)`}
              >
                {r.occupied || 0}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-bold text-ink-muted">
        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: '#F5F5F5', border: '1px solid #32667F' }} /> 0</span>
        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: 'color-mix(in srgb, #32667F 30%, #F5F5F5)' }} /> faible</span>
        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: 'color-mix(in srgb, #32667F 62%, #F5F5F5)' }} /> moyen</span>
        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: '#32667F' }} /> élevé</span>
      </div>
    </div>
  );
}

function Meter({ label, value, max, color }) {
  const width = max > 0 ? Math.max(value > 0 ? 8 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs font-bold text-ink mb-1">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-2.5 rounded-full" style={{ background: 'color-mix(in srgb, #32667F 16%, #F5F5F5)' }}>
        <div className="h-2.5 rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

function Ring({ pct, label, detail, color }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className="flex flex-col items-center text-center gap-2">
      <div
        className="w-28 h-28 rounded-full grid place-items-center"
        style={{ background: `conic-gradient(${color} ${p * 3.6}deg, color-mix(in srgb, ${color} 16%, #F5F5F5) 0deg)` }}
      >
        <div className="w-20 h-20 rounded-full bg-surface grid place-items-center">
          <span className="text-lg font-extrabold text-ink">{Math.round(p)}%</span>
        </div>
      </div>
      <p className="text-sm font-extrabold text-ink">{label}</p>
      <p className="text-xs text-ink-muted font-medium">{detail}</p>
    </div>
  );
}

function ratioPct(done, waiting) {
  const a = Number(done) || 0;
  const b = Number(waiting) || 0;
  const total = a + b;
  if (!total) return 0;
  return Math.round((a / total) * 100);
}

function PriorityItem({ tone = 'amber', title, detail, to, cta }) {
  const tones = {
    red: 'border-alert bg-alert/5',
    amber: 'border-amber-400 bg-amber-50',
    teal: 'border-teal-500 bg-teal-50',
    orange: 'border-orange-400 bg-orange-50',
  };
  return (
    <li className={`rounded-xl border-2 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 ${tones[tone] || tones.amber}`}>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-ink">{title}</p>
        {detail ? <p className="text-xs text-ink-muted mt-0.5">{detail}</p> : null}
      </div>
      {to && (
        <Link
          to={to}
          className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-xl bg-primary text-surface border-2 border-accent"
        >
          {cta || 'Traiter'}
        </Link>
      )}
    </li>
  );
}

export default function HotelDashboard() {
  const { can, canCreate, canView } = useHotelPerm();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const isManagerView = can('hotel.manage') || canView('reports') || canView('audit');
  const canResCreate = canCreate('reservations');
  const canResView = canView('reservations');
  const canReply = can('hotel.reservations.reply');
  const canReview = can('hotel.reservations.confirm');
  const canArrivals = can('hotel.stays.check_in') || can('hotel.front_desk');
  const canDepartures = can('hotel.stays.check_out') || can('hotel.front_desk');
  const canStays = canView('stays');
  const canRooms = canView('rooms');
  const canCashier = canView('cashier');
  const canHk = canView('housekeeping');
  const canHkLead = can('hotel.housekeeping.assign') || can('hotel.housekeeping.lead') || can('hotel.manage');
  const canMaint = canView('maintenance');
  const canGuests = canView('guests');
  const canCalendar = canView('reservations') || can('hotel.manage');
  const canReports = canView('reports') || can('hotel.manage');

  const messagesPath = '/hotel/messages';
  const reschedulesPath = '/hotel/reschedules';
  const departuresPath = '/hotel/front-desk/departures';

  useEffect(() => {
    hotelService.dashboard()
      .then(setStats)
      .catch((e) => setError(e.message || 'Erreur chargement'));
  }, []);

  useEffect(() => {
    if (!canHkLead && !canResView && !canReply && !canReview && !isManagerView) return undefined;
    const id = setInterval(() => {
      hotelService.dashboard().then(setStats).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [canHkLead, canResView, canReply, canReview, isManagerView]);

  const priorities = useMemo(() => {
    if (!stats) return [];
    const items = [];
    const msg = stats.client_messages_pending || 0;
    const resched = stats.reschedule_pending || 0;
    const unpaid = stats.unpaid_folios || 0;
    const hk = stats.hk_cleaning_required || stats.hk_unassigned || 0;
    const maint = stats.maintenance_open || 0;
    const depT = stats.departures_tomorrow || 0;
    const pendingPay = stats.pending_payment || 0;
    const pendingConf = stats.pending_confirm || 0;

    if ((canResView || canReply) && msg > 0) {
      items.push({
        key: 'msg',
        tone: 'teal',
        title: `${msg} message(s) client sans réponse`,
        detail: 'Répondez pour que le client voie la réponse dans son historique.',
        to: messagesPath,
        cta: 'Répondre',
      });
    }
    if ((canResView || canReview) && resched > 0) {
      items.push({
        key: 'resched',
        tone: 'amber',
        title: `${resched} demande(s) anticiper / reporter`,
        detail: 'Acceptez ou refusez les nouvelles dates.',
        to: reschedulesPath,
        cta: 'Traiter',
      });
    }
    if ((canCashier || isManagerView) && unpaid > 0) {
      items.push({
        key: 'folios',
        tone: 'red',
        title: `${unpaid} folio(s) ouvert(s) avec solde`,
        detail: 'Encaisser avant le départ pour éviter les impayés.',
        to: '/hotel/cashier?section=encaisser',
        cta: 'Caisse / Folios',
      });
    }
    if ((canResView || canReview) && pendingConf > 0) {
      items.push({
        key: 'confirm',
        tone: 'orange',
        title: `${pendingConf} réservation(s) en attente de confirmation`,
        detail: 'Confirmez après paiement ou refusez.',
        to: '/hotel/reservations',
        cta: 'Voir',
      });
    }
    if (canResView && pendingPay > 0) {
      items.push({
        key: 'pay',
        tone: 'orange',
        title: `${pendingPay} réservation(s) non payée(s)`,
        detail: 'Suivre le paiement avant l’arrivée.',
        to: '/hotel/reservations',
        cta: 'Suivre',
      });
    }
    if ((canArrivals || canResView) && (stats.arrivals_today || 0) > 0) {
      items.push({
        key: 'arrivals',
        tone: 'teal',
        title: `${stats.arrivals_today} arrivée(s) aujourd’hui`,
        detail: 'Préparer réception et chambres prêtes.',
        to: canArrivals ? '/hotel/front-desk/arrivals' : '/hotel/reservations',
        cta: 'Arrivées',
      });
    }
    if ((canDepartures || canResView) && depT > 0) {
      items.push({
        key: 'dep',
        tone: 'orange',
        title: `${depT} départ(s) demain (alerte J-1)`,
        detail: 'Rappeler le client et préparer le check-out.',
        to: canDepartures ? departuresPath : '/hotel/reservations',
        cta: 'Départs',
      });
    }
    if (canHkLead && hk > 0) {
      items.push({
        key: 'hk',
        tone: 'amber',
        title: `${hk} chambre(s) à nettoyer / non assignée(s)`,
        detail: 'Assigner un agent, inspecter, marquer Prête.',
        to: '/hotel/housekeeping',
        cta: 'Housekeeping',
      });
    }
    if (canMaint && maint > 0) {
      items.push({
        key: 'maint',
        tone: 'red',
        title: `${maint} ticket(s) maintenance ouvert(s)`,
        detail: `${stats.rooms_oos || 0} chambre(s) hors service.`,
        to: '/hotel/maintenance',
        cta: 'Maintenance',
      });
    }
    return items.slice(0, 7);
  }, [
    stats, canResView, canReply, canReview, canCashier, isManagerView,
    canArrivals, canDepartures, canHkLead, canMaint,
  ]);

  const statusLine = useMemo(() => {
    if (!stats) return '';
    const parts = [];
    if (canRooms) parts.push(`Occupation ${stats.occupancy_rate}%`);
    if (canCashier || isManagerView) parts.push(`Revenu jour ${formatBif(stats.revenue_today)}`);
    const n = priorities.length;
    if (n > 0) parts.push(`${n} alerte${n > 1 ? 's' : ''}`);
    else parts.push('Aucune alerte urgente');
    return parts.join(' · ');
  }, [stats, canRooms, canCashier, isManagerView, priorities.length]);

  const quickLinks = useMemo(() => {
    const links = [];
    if (canArrivals) links.push(['/hotel/front-desk/arrivals', 'Réception']);
    if (canCashier) links.push(['/hotel/cashier', 'Caisse']);
    if (canHk) links.push(['/hotel/housekeeping', 'Housekeeping']);
    if (canCalendar) links.push(['/hotel/calendar', 'Calendrier']);
    if (canReports) links.push(['/hotel/reports', 'Rapports']);
    if (canRooms) links.push(['/hotel/rooms', 'Chambres']);
    if (canGuests) links.push(['/hotel/guests', 'Clients']);
    if (canStays) links.push(['/hotel/stays', 'Séjours']);
    return links;
  }, [canArrivals, canCashier, canHk, canCalendar, canReports, canRooms, canGuests, canStays]);

  if (error) {
    return (
      <HotelPage title="Tableau de bord hôtel">
        <Panel className="border-alert"><p className="text-alert font-bold">{error}</p></Panel>
      </HotelPage>
    );
  }

  if (!stats) {
    return <HotelPage title="Tableau de bord hôtel"><Empty>Chargement…</Empty></HotelPage>;
  }

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const dayMax = Math.max(
    1,
    Number(stats.arrivals_today) || 0,
    Number(stats.in_house) || 0,
    Number(stats.departures_today) || 0,
  );
  const checkInPct = ratioPct(stats.checked_in_today, stats.arrivals_today);
  const checkOutPct = ratioPct(stats.checked_out_today, stats.departures_today);

  return (
    <HotelPage
      title="Tableau de bord"
      subtitle={isManagerView
        ? `${todayLabel.charAt(0).toUpperCase()}${todayLabel.slice(1)} — vue direction`
        : `${todayLabel.charAt(0).toUpperCase()}${todayLabel.slice(1)} — votre journée`}
      actions={(
        <>
          {canResCreate && (
            <Link to="/hotel/reservations/new" className="px-4 py-2.5 text-sm font-bold bg-primary text-surface rounded-xl border-2 border-accent">
              Nouvelle réservation
            </Link>
          )}
          {canArrivals && (
            <Link to="/hotel/front-desk/arrivals" className="px-4 py-2.5 text-sm font-bold text-ink border-2 border-accent rounded-xl">
              Arrivées
            </Link>
          )}
          {canDepartures && (
            <Link to="/hotel/front-desk/departures" className="px-4 py-2.5 text-sm font-bold text-ink border-2 border-accent rounded-xl">
              Départs
            </Link>
          )}
        </>
      )}
    >
      {/* État du business */}
      <div className={`rounded-2xl border-2 px-4 py-3 ${priorities.length ? 'border-amber-400 bg-amber-50/80' : 'border-primary/30 bg-primary/5'}`}>
        <p className="text-sm font-extrabold text-ink inline-flex items-center gap-2">
          {priorities.length ? <AlertTriangle className="w-4 h-4 text-amber-700" /> : <CheckCircle2 className="w-4 h-4 text-primary" />}
          {statusLine}
        </p>
        <p className="text-xs text-ink-muted mt-1 font-medium">
          {isManagerView
            ? 'Contrôle rapide : occupation, revenus et actions prioritaires.'
            : 'Focus sur les tâches de votre rôle aujourd’hui.'}
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {(canCashier || isManagerView) ? (
          <StatCard
            label="Revenu 7 jours"
            value={formatBif(stats.revenue_7d)}
            hint={<TrendHint pct={stats.revenue_7d_change_pct} />}
          />
        ) : canRooms ? (
          <StatCard
            label="Occupation"
            value={`${stats.occupancy_rate}%`}
            hint={`${stats.rooms_occupied}/${stats.rooms_total} chambres`}
          />
        ) : (
          <StatCard label="Arrivées" value={stats.arrivals_today} hint="aujourd’hui" />
        )}
        <StatCard
          label="Réservations"
          value={stats.upcoming_reservations || 0}
          hint="séjours à venir"
        />
        <StatCard
          label="Nouveaux clients"
          value={stats.guests_new_30d || 0}
          hint={`${stats.guests_total || 0} au total · 30 jours`}
        />
      </div>

      {(isManagerView || canRooms || canResView) && (
        <div className="grid lg:grid-cols-5 gap-4">
          <Panel className="lg:col-span-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-extrabold text-ink">Occupation</h2>
              {canCalendar && (
                <Link to="/hotel/calendar" className="text-xs font-bold text-accent hover:underline">
                  Calendrier
                </Link>
              )}
            </div>
            <p className="text-[11px] text-ink-muted font-medium mb-1">
              7 jours passés et 7 jours à venir · le point orange est aujourd’hui
            </p>
            <OccupancyChart trend={stats.occupancy_trend} />
          </Panel>
          <Panel className="lg:col-span-2">
            <h2 className="font-extrabold text-ink mb-1">Semaine</h2>
            <p className="text-[11px] text-ink-muted font-medium mb-3">
              Chambres occupées par jour
            </p>
            <WeekHeat trend={stats.occupancy_trend} />
          </Panel>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <h2 className="font-extrabold text-ink mb-4">Chambres du jour</h2>
          <div className="space-y-3">
            <Meter label="Arrivées encore attendues" value={stats.arrivals_today || 0} max={dayMax} color="#EA8B33" />
            <Meter label="En séjour" value={stats.in_house || 0} max={dayMax} color="#32667F" />
            <Meter label="Départs encore à faire" value={stats.departures_today || 0} max={dayMax} color="#132F45" />
          </div>
          <p className="text-xs text-ink-muted font-medium mt-3">
            {stats.rooms_available || 0} prête(s) · {stats.rooms_oos || 0} hors service
            {(canCashier || isManagerView) ? ` · revenu du jour ${formatBif(stats.revenue_today)}` : ''}
          </p>
        </Panel>
        <Panel>
          <h2 className="font-extrabold text-ink mb-4">Check-in et check-out</h2>
          <div className="flex flex-wrap justify-around gap-4">
            <Ring
              pct={checkInPct}
              color="#EA8B33"
              label="Check-in"
              detail={`${stats.checked_in_today || 0} fait(s) · ${stats.arrivals_today || 0} restant(s)`}
            />
            <Ring
              pct={checkOutPct}
              color="#32667F"
              label="Check-out"
              detail={`${stats.checked_out_today || 0} fait(s) · ${stats.departures_today || 0} restant(s)`}
            />
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* À faire */}
        <Panel className="lg:col-span-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-extrabold text-ink">À faire en priorité</h2>
            {priorities.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-alert text-white">
                {priorities.length}
              </span>
            )}
          </div>
          {priorities.length === 0 ? (
            <p className="text-sm text-ink-muted font-medium py-4">
              Rien d’urgent. L’établissement est sous contrôle.
            </p>
          ) : (
            <ul className="space-y-2">
              {priorities.map(({ key, ...item }) => (
                <PriorityItem key={key} {...item} />
              ))}
            </ul>
          )}

          {/* Mini listes alertes existantes (détail) */}
          {(canResView || canReply) && (stats.client_messages || []).length > 0 && (
            <div className="mt-4 pt-3 border-t border-accent/30">
              <p className="text-xs font-bold uppercase text-ink-muted mb-2 inline-flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" /> Derniers messages
              </p>
              <ul className="space-y-1.5">
                {stats.client_messages.slice(0, 3).map((m) => (
                  <li key={m.id} className="text-sm text-ink">
                    <Link to={messagesPath} className="font-bold text-accent hover:underline">
                      {m.reference || 'Résa'}
                    </Link>
                    {m.guest_name ? ` · ${m.guest_name}` : ''}
                    {m.preview ? <span className="text-ink-muted"> — « {m.preview} »</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(canResView || canReview) && (stats.reschedule_requests || []).length > 0 && (
            <div className="mt-3 pt-3 border-t border-accent/30">
              <p className="text-xs font-bold uppercase text-ink-muted mb-2 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Demandes de dates
              </p>
              <ul className="space-y-1.5">
                {stats.reschedule_requests.slice(0, 3).map((m) => (
                  <li key={m.id} className="text-sm text-ink">
                    <Link to={reschedulesPath} className="font-bold text-accent hover:underline">
                      {m.reference || 'Résa'}
                    </Link>
                    {m.guest_name ? ` · ${m.guest_name}` : ''}
                    {' → '}
                    <strong>{m.preferred_check_in} → {m.preferred_check_out}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        {/* Vision 7j + raccourcis */}
        <div className="lg:col-span-2 space-y-4">
          <Panel>
            <h2 className="font-extrabold text-ink mb-3">Raccourcis</h2>
            <div className="flex flex-wrap gap-2">
              {quickLinks.map(([to, label]) => (
                <Link
                  key={to}
                  to={to}
                  className="px-3 py-2 text-sm font-bold border-2 border-accent rounded-xl text-ink hover:bg-primary/5"
                >
                  {label}
                </Link>
              ))}
              {quickLinks.length === 0 && (
                <p className="text-sm text-ink-muted">Aucun raccourci pour vos droits.</p>
              )}
            </div>
            {canReports && (
              <p className="text-xs text-ink-muted mt-3">
                Analyses détaillées :{' '}
                <Link to="/hotel/reports" className="font-bold text-accent hover:underline">
                  ouvrir les rapports
                </Link>
              </p>
            )}
          </Panel>
        </div>
      </div>
    </HotelPage>
  );
}
