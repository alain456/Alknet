import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import retailService from './retailService';

const money = (v) => `${Number(v || 0).toLocaleString('fr-BI')} BIF`;
const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-ink outline-none focus:ring-2 focus:ring-primary';

export default function RetailPatients() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    retailService.getPatients()
      .then((data) => setItems(Array.isArray(data) ? data : data?.results || []))
      .catch((err) => setError(err.message || 'Impossible de charger les patients'));
  }, []);

  const selected = id ? items.find((p) => String(p.id) === decodeURIComponent(id)) : null;
  const visible = items.filter((p) => {
    const hay = `${p.name} ${p.email} ${p.phone || ''}`.toLowerCase();
    return !q || hay.includes(q.toLowerCase());
  });

  if (selected) {
    return (
      <section className="space-y-4 max-w-4xl">
        <Link to="/retail-pharmacy/patients" className="text-sm text-primary font-semibold hover:underline">← Patients</Link>
        <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-ink">{selected.name}</h1>
            <p className="text-sm text-ink-muted">{selected.email} · {selected.phone || '—'}</p>
          </div>
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              ['Commandes', selected.orders_count],
              ['En attente', selected.orders_pending],
              ['Acceptées', selected.orders_accepted],
              ['Montant accepté', money(selected.amount_accepted)],
            ].map(([label, value]) => (
              <div key={label} className="bg-paper rounded-xl p-3 border border-border">
                <b className="block text-ink">{value}</b>
                <span className="text-xs text-ink-muted">{label}</span>
              </div>
            ))}
          </div>
          <Link
            to={`/retail-pharmacy/orders?patient_email=${encodeURIComponent(selected.email || '')}`}
            className="inline-flex px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold"
          >
            Voir les commandes
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Patients</h1>
          <p className="text-sm text-ink-muted">Patientèle issue des commandes.</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${inputClass} sm:max-w-xs`}
          placeholder="Rechercher…"
        />
      </div>
      {error && <div className="p-3 rounded-xl bg-red-50 text-error text-sm">{error}</div>}
      <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden">
        {visible.map((p) => (
          <Link
            key={p.id}
            to={`/retail-pharmacy/patients/${encodeURIComponent(p.id)}`}
            className="p-4 flex justify-between gap-3 hover:bg-paper transition"
          >
            <span>
              <b className="text-ink">{p.name}</b>
              <small className="block text-ink-muted">{p.email} · {p.phone || '—'}</small>
            </span>
            <span className="text-right shrink-0">
              <b className="text-ink">{p.orders_count} commande(s)</b>
              <small className="block text-ink-muted">{money(p.amount_accepted)}</small>
            </span>
          </Link>
        ))}
        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-ink-muted text-sm">Aucun patient</p>
        )}
      </div>
    </section>
  );
}
