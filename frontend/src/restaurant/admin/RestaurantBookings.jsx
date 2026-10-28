import React, { useEffect, useState } from 'react';
import restaurantService, { listOf } from '../restaurantService';
import { btnGhost, btnPrimary, Empty, Panel, RestaurantPage } from '../ui';

const FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirmées' },
  { value: 'REFUSED', label: 'Refusées' },
  { value: 'CANCELLED', label: 'Annulées' },
];

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

export default function RestaurantBookings() {
  const [filter, setFilter] = useState('PENDING');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = (status = filter) => {
    restaurantService.bookings(status)
      .then((data) => setRows(listOf(data)))
      .catch((err) => setError(err.message || 'Réservations indisponibles'));
  };

  useEffect(() => { load(filter); }, [filter]);

  const act = async (id, fn) => {
    setBusy(id);
    setError('');
    try {
      await fn(id);
      load(filter);
    } catch (err) {
      setError(err.message || 'Action impossible.');
    } finally {
      setBusy('');
    }
  };

  return (
    <RestaurantPage title="Réservations de table" subtitle="Accepter ou refuser les demandes clients.">
      {error && <p className="text-error text-sm font-medium">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((row) => (
          <button
            key={row.value || 'all'}
            type="button"
            onClick={() => setFilter(row.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
              filter === row.value ? 'bg-accent text-ink' : 'bg-surface text-ink'
            }`}
          >
            {row.label}
          </button>
        ))}
      </div>
      <Panel>
        {rows.length === 0 ? (
          <Empty>Aucune réservation dans ce filtre.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="py-4 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-ink">{row.guest_name}</p>
                    <p className="text-xs text-ink-muted">
                      {row.party_size} convives · {whenLabel(row.booked_for)}
                    </p>
                    {(row.guest_phone || row.guest_email) && (
                      <p className="text-xs text-ink-muted">{[row.guest_phone, row.guest_email].filter(Boolean).join(' · ')}</p>
                    )}
                    {row.notes ? <p className="text-sm text-ink mt-1">{row.notes}</p> : null}
                  </div>
                  <span className="text-xs font-bold text-ink-muted">{STATUS_LABEL[row.status] || row.status}</span>
                </div>
                {row.status === 'PENDING' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy === row.id}
                      className={btnPrimary}
                      onClick={() => act(row.id, restaurantService.confirmBooking)}
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      disabled={busy === row.id}
                      className={btnGhost}
                      onClick={() => act(row.id, restaurantService.refuseBooking)}
                    >
                      Refuser
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </RestaurantPage>
  );
}
