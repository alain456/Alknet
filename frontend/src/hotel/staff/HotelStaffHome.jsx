import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import hotelService from '../hotelService';
import { HotelPage, StatCard, Panel } from '../ui';

export default function HotelStaffHome({ mode = 'front' }) {
  const [stats, setStats] = useState(null);
  useEffect(() => { hotelService.dashboard().then(setStats).catch(() => {}); }, []);

  const titles = {
    front: ['Réception', 'Arrivées, départs et séjours'],
    reservations: ['Réservations', 'Demandes et confirmations (sans check-in)'],
    housekeeping: ['Housekeeping', 'Tâches et chambres'],
    cashier: ['Caisse', 'Folios et paiements'],
    maintenance: ['Maintenance', 'Tickets et blocages'],
  };
  const [title, sub] = titles[mode] || titles.front;
  const messagesPath = '/hotel/messages';
  const showClientMessages = (
    (mode === 'reservations' || mode === 'front')
    && (stats?.client_messages_pending || 0) > 0
  );

  return (
    <HotelPage title={title} subtitle={sub}>
      {showClientMessages && (
        <div className="mb-4 rounded-xl border-2 border-teal-500 bg-teal-50 px-4 py-3 text-sm text-teal-950">
          <p className="font-extrabold inline-flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            {stats.client_messages_pending} message(s) client à traiter
          </p>
          <p className="mt-1">
            <Link to={messagesPath} className="font-bold text-accent underline">
              Ouvrir Réservations → Répondre
            </Link>
          </p>
        </div>
      )}
      {stats && mode === 'housekeeping' && (stats.hk_cleaning_required > 0 || stats.hk_unassigned > 0) && (
        <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-extrabold">
            CLEANING_REQUIRED — {stats.hk_cleaning_required || stats.hk_unassigned} chambre(s) après check-out
          </p>
          <p className="mt-1">
            Assignez un agent, inspectez, puis marquez Prête.{' '}
            <Link to="/hotel/staff/housekeeping/tasks" className="font-bold text-accent underline">Voir les tâches</Link>
          </p>
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {mode === 'cashier' ? (
            <>
              <StatCard
                label="Encaissé du jour"
                value={`${Number(stats.revenue_today || 0).toLocaleString()} BIF`}
              />
              <StatCard
                label="Folios impayés"
                value={stats.unpaid_folios || 0}
              />
              <StatCard label="Arrivées" value={stats.arrivals_today} />
              <StatCard label="Départs" value={stats.departures_today} />
            </>
          ) : (
            <>
              <StatCard label="Arrivées" value={stats.arrivals_today} />
              <StatCard label="Départs" value={stats.departures_today} />
              <StatCard label="Disponibles" value={stats.rooms_available} />
              {(mode === 'reservations' || mode === 'front') ? (
                <StatCard
                  label="Messages clients"
                  value={stats.client_messages_pending || 0}
                  hint="en attente"
                />
              ) : (
                <StatCard
                  label="HK ouvertes"
                  value={stats.hk_pending}
                  hint={stats.hk_cleaning_required ? `${stats.hk_cleaning_required} à nettoyer` : undefined}
                />
              )}
            </>
          )}
        </div>
      )}
      <Panel>
        <div className="flex flex-wrap gap-2">
          {mode === 'front' && (
            <>
              <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/front-desk/arrivals">Arrivées</Link>
              <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/front-desk/departures">Départs</Link>
              <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/front-desk/stays">Séjours</Link>
              <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/front-desk/reservations">Réservations</Link>
              {(stats?.client_messages_pending || 0) > 0 && (
                <Link className="px-3 py-2 font-bold border-2 border-teal-600 rounded-xl text-sm text-teal-800 bg-teal-50" to={messagesPath}>
                  Messages clients
                </Link>
              )}
              <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/front-desk/settings">Paramètres</Link>
            </>
          )}
          {mode === 'reservations' && (
            <>
              <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/reservations/list">Réservations</Link>
              <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/reservations/new">Nouvelle réservation</Link>
              {(stats?.client_messages_pending || 0) > 0 && (
                <Link className="px-3 py-2 font-bold border-2 border-teal-600 rounded-xl text-sm text-teal-800 bg-teal-50" to={messagesPath}>
                  Répondre aux messages
                </Link>
              )}
              <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/reservations/settings">Paramètres</Link>
            </>
          )}
          {mode === 'housekeeping' && (
            <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/housekeeping/tasks">Mes tâches</Link>
          )}
          {mode === 'cashier' && (
            <>
              <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/cashier">Dashboard caisse</Link>
              <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/cashier/folios">Folios</Link>
              <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/cashier/invoices">Factures</Link>
            </>
          )}
          {mode === 'maintenance' && (
            <Link className="px-3 py-2 font-bold border-2 border-accent rounded-xl text-sm" to="/hotel/staff/maintenance/tickets">Tickets</Link>
          )}
        </div>
      </Panel>
    </HotelPage>
  );
}
