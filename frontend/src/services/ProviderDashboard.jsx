import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import providerService from './providerService';

export default function ProviderDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    providerService.dashboard()
      .then(setStats)
      .catch((err) => setError(err.message || 'Tableau de bord indisponible'));
  }, []);

  if (error) return <p className="text-error">{error}</p>;
  if (!stats) return <p className="text-ink-muted">Chargement…</p>;

  const cards = [
    { label: 'Services publiés', value: stats.offers_published, to: '/provider/offers' },
    { label: 'Services au total', value: stats.offers_total, to: '/provider/offers' },
    { label: 'Nouvelles demandes', value: stats.requests_new, to: '/provider/inbox' },
    { label: 'Demandes ouvertes', value: stats.requests_open, to: '/provider/inbox' },
    { label: 'En attente 24 h', value: stats.requests_overdue || 0, to: '/provider/inbox' },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">{stats.provider_name || 'Espace prestataire'}</h1>
        <p className="text-sm text-ink-muted">Gérez votre fiche, vos services et les demandes des clients.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Link key={card.label} to={card.to} className="bg-white rounded-2xl p-4">
            <p className="text-xs text-ink-muted">{card.label}</p>
            <p className="text-2xl font-bold text-ink mt-1">{card.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
