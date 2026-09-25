import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare, Clock, AlertTriangle, TrendingUp, TrendingDown, Minus,
  BedDouble, Wallet, Users, CheckCircle2, Wrench, Sparkles,
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

function OccupancyBars({ trend }) {
  const rows = Array.isArray(trend) ? trend : [];
  if (!rows.length) return null;
  const max = Math.max(100, ...rows.map((r) => Number(r.occupancy_rate) || 0));
  return (
    <div className="flex items-end gap-1.5 h-28">
      {rows.map((r) => {
        const rate = Number(r.occupancy_rate) || 0;
        const h = Math.max(4, Math.round((rate / max) * 100));
        return (
          <div key={r.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] font-bold text-ink-muted tabular-nums">{Math.round(rate)}%</span>
            <div
              className={`w-full rounded-t-md ${
                r.is_today ? 'bg-accent' : r.is_future ? 'bg-primary/35' : 'bg-primary'
              }`}
              style={{ height: `${h}%` }}
              title={`${r.label} · ${rate}% (${r.occupied} ch.)`}
            />
            <span className={`text-[9px] font-semibold truncate w-full text-center ${r.is_today ? 'text-accent' : 'text-ink-muted'}`}>
              {r.label}
            </span>
          </div>
        );
      })}
    </div>
  );
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
        to: '/hotel/folios',
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
    if (canCashier) links.push(['/hotel/invoices', 'Factures']);
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

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {canRooms && (
          <StatCard
            label="Occupation"
            value={`${stats.occupancy_rate}%`}
            hint={`${stats.rooms_occupied}/${stats.rooms_total} chambres`}
          />
        )}
        {(canCashier || isManagerView) && (
          <div className="bg-surface border-2 border-accent rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted inline-flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" /> Revenu du jour
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-primary mt-1">{formatBif(stats.revenue_today)}</p>
            <p className="text-xs text-ink-muted mt-1">7j : {formatBif(stats.revenue_7d)}</p>
          </div>
        )}
        {(canCashier || isManagerView) && (
          <div className="bg-surface border-2 border-accent rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Revenu 7 jours</p>
            <p className="text-xl sm:text-2xl font-extrabold text-primary mt-1">{formatBif(stats.revenue_7d)}</p>
            <div className="mt-1"><TrendHint pct={stats.revenue_7d_change_pct} /></div>
          </div>
        )}
        {(canArrivals || canResView) && (
          <StatCard label="Arrivées" value={stats.arrivals_today} hint="aujourd’hui" />
        )}
        {(canDepartures || canStays) && (
          <StatCard label="Départs" value={stats.departures_today} hint="aujourd’hui" />
        )}
        {canStays && (
          <StatCard
            label="En séjour"
            value={stats.in_house}
            hint={`${stats.rooms_available || 0} dispo.`}
          />
        )}
        {(canCashier || isManagerView) && (
          <StatCard
            label="Impayés"
            value={stats.unpaid_folios || 0}
            hint="folios ouverts"
          />
        )}
        {(canResView || canReply) && !isManagerView && (
          <StatCard label="Messages" value={stats.client_messages_pending || 0} hint="en attente" />
        )}
        {canHk && !isManagerView && (
          <StatCard label="Ménage" value={stats.hk_pending} hint="tâches ouvertes" />
        )}
      </div>

      {(isManagerView || canCashier) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-surface border-2 border-accent/40 rounded-2xl p-3 flex items-center gap-3">
            <BedDouble className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-ink-muted uppercase">30 jours</p>
              <p className="text-sm font-extrabold text-ink">{formatBif(stats.revenue_30d)}</p>
            </div>
          </div>
          <div className="bg-surface border-2 border-accent/40 rounded-2xl p-3 flex items-center gap-3">
            <Users className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-ink-muted uppercase">À venir</p>
              <p className="text-sm font-extrabold text-ink">{stats.upcoming_reservations || 0} résa.</p>
            </div>
          </div>
          <div className="bg-surface border-2 border-accent/40 rounded-2xl p-3 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-ink-muted uppercase">Chambres prêtes</p>
              <p className="text-sm font-extrabold text-ink">{stats.rooms_available || 0}</p>
            </div>
          </div>
          <div className="bg-surface border-2 border-accent/40 rounded-2xl p-3 flex items-center gap-3">
            <Wrench className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-ink-muted uppercase">Hors service</p>
              <p className="text-sm font-extrabold text-ink">{stats.rooms_oos || 0}</p>
            </div>
          </div>
        </div>
      )}

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
          {(isManagerView || canRooms || canResView) && (
            <Panel>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-extrabold text-ink">Occupation 7j ±</h2>
                {canCalendar && (
                  <Link to="/hotel/calendar" className="text-xs font-bold text-accent hover:underline">
                    Calendrier
                  </Link>
                )}
              </div>
              <p className="text-[11px] text-ink-muted mb-2 font-medium">
                Plein = passé/aujourd’hui · clair = à venir · orange = aujourd’hui
              </p>
              <OccupancyBars trend={stats.occupancy_trend} />
            </Panel>
          )}

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
