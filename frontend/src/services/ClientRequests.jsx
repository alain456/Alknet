import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import providerService, { REQUEST_STATUS_LABELS } from './providerService';
import { formatRequestWhen } from './requestUtils';

const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);

export default function ClientRequests() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = status ? { status } : {};
    providerService.listMyRequests(params)
      .then((data) => setRows(normalize(data)))
      .catch((err) => setError(err.message || 'Demandes indisponibles'));
  }, [status]);

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">Mes demandes</h1>
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {['', 'NEW', 'IN_PROGRESS', 'REPLIED', 'CLOSED'].map((value) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => setStatus(value)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold ${status === value ? 'bg-accent text-ink' : 'bg-white text-ink'}`}
          >
            {value ? REQUEST_STATUS_LABELS[value] : 'Toutes'}
          </button>
        ))}
      </div>
      {rows.length === 0 && !error && (
        <p className="text-sm text-ink-muted">
          Aucune demande pour le moment.{' '}
          <Link to="/services" className="text-primary font-semibold">Trouver un prestataire</Link>
        </p>
      )}
      <div className="space-y-3">
        {rows.map((row) => (
          <Link key={row.id} to={`/dashboard/demandes/${row.id}`} className="block bg-white rounded-2xl p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-bold text-ink">{row.reference}</p>
              <span className="text-xs font-semibold">{REQUEST_STATUS_LABELS[row.status] || row.status}</span>
            </div>
            <p className="text-sm text-ink">{row.provider_name}</p>
            <p className="text-sm text-ink-muted">
              {row.service_title || 'Demande générale'}
              {row.created_at ? ` · ${formatRequestWhen(row.created_at)}` : ''}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
