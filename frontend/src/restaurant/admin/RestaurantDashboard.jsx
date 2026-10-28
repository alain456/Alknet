import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import restaurantService, { listOf } from '../restaurantService';
import { Empty, Panel, RestaurantPage, StatCard } from '../ui';

const STATUS_LABEL = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  REFUSED: 'Refusée',
  CANCELLED: 'Annulée',
};

function whenLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function RestaurantDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    restaurantService.dashboard()
      .then(setStats)
      .catch((err) => setError(err.message || 'Tableau de bord indisponible'));
  }, []);

  if (error) return <p className="text-error">{error}</p>;
  if (!stats) return <p className="text-ink-muted">Chargement…</p>;

  const recent = listOf(stats.recent);

  return (
    <RestaurantPage
      title={stats.name || 'Espace restauration'}
      subtitle="Menu, tables et demandes de réservation — sans le PMS hôtel."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/restaurant/bookings">
          <StatCard label="Demandes en attente" value={stats.pending_bookings ?? 0} />
        </Link>
        <Link to="/restaurant/bookings">
          <StatCard label="Confirmées (7 jours)" value={stats.upcoming_week ?? 0} />
        </Link>
        <Link to="/restaurant/menu">
          <StatCard label="Plats au menu" value={stats.menu_items ?? 0} />
        </Link>
        <StatCard label="Réservations du jour" value={stats.today_covers ?? 0} />
      </div>
      <Panel>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-extrabold text-ink">Dernières demandes</h2>
          <Link to="/restaurant/bookings" className="text-sm font-bold text-accent hover:underline">
            Voir tout
          </Link>
        </div>
        {recent.length === 0 ? (
          <Empty>Aucune réservation de table pour le moment.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((row) => (
              <li key={row.id} className="py-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-bold text-ink">{row.guest_name}</p>
                  <p className="text-xs text-ink-muted">
                    {row.party_size} convives · {whenLabel(row.booked_for)}
                  </p>
                </div>
                <span className="text-xs font-bold text-ink-muted">
                  {STATUS_LABEL[row.status] || row.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </RestaurantPage>
  );
}
