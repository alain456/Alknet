import React, { useEffect, useState } from 'react';
import api from './api';

const money = (value) => `${Number(value || 0).toLocaleString('fr-BI')} BIF`;

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function kindLabel(kind) {
  if (kind === 'LOSS') return 'Manque';
  if (kind === 'MISSING') return 'Prix d’achat manquant';
  return 'Bénéfice';
}

export default function MarginBoard() {
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (from, to) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`businesses/me/margins/?date_from=${from}&date_to=${to}`, { auth: true });
      setReport(data);
    } catch (err) {
      setError(err.message || 'Impossible de calculer les marges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(dateFrom, dateTo); }, []);

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Prix et bénéfice</h2>
          <p className="text-sm text-ink-muted">
            Chaque article a un prix d’achat et un prix de vente. Le bénéfice de la période vient des ventes payées.
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => { event.preventDefault(); load(dateFrom, dateTo); }}
        >
          <label className="text-xs text-ink-muted">
            Du
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="block mt-1 border border-gray-200 rounded-lg px-2 py-1 text-sm text-ink" />
          </label>
          <label className="text-xs text-ink-muted">
            Au
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="block mt-1 border border-gray-200 rounded-lg px-2 py-1 text-sm text-ink" />
          </label>
          <button type="submit" className="px-3 py-2 rounded-xl bg-accent text-ink text-sm font-semibold">Voir</button>
        </form>
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}
      {loading && <p className="text-sm text-ink-muted">Calcul…</p>}
      {report && !loading && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Total label="Bénéfice des ventes" value={money(report.period_profit)} />
            <Total label="Chiffre des ventes" value={money(report.period_revenue)} />
            <Total label="Valeur d’achat du stock" value={money(report.stock_purchase_value)} />
            <Total label="Bénéfice potentiel du stock" value={money(report.stock_potential_profit)} />
          </div>
          {report.missing_count > 0 && (
            <p className="text-sm text-alert">
              {report.missing_count} article(s) sans prix d’achat : leur bénéfice n’est pas calculé.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-ink-muted text-left">
                <tr>
                  <th className="px-2 py-2">Article</th>
                  <th className="px-2 py-2">Prix d’achat</th>
                  <th className="px-2 py-2">Prix de vente</th>
                  <th className="px-2 py-2">Par unité</th>
                  <th className="px-2 py-2">Stock</th>
                  <th className="px-2 py-2">Bénéfice du stock</th>
                  <th className="px-2 py-2">Vendus</th>
                  <th className="px-2 py-2">Bénéfice période</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-2 py-2 font-semibold text-ink">{line.name}</td>
                    <td className="px-2 py-2">{line.kind === 'MISSING' ? '—' : money(line.purchase_price)}</td>
                    <td className="px-2 py-2">{money(line.sale_price)}</td>
                    <td className={`px-2 py-2 font-semibold ${line.kind === 'LOSS' ? 'text-alert' : 'text-ink'}`}>
                      {line.kind === 'MISSING' ? kindLabel(line.kind) : `${line.kind === 'LOSS' ? 'Manque ' : ''}${money(Math.abs(Number(line.unit_margin)))}`}
                    </td>
                    <td className="px-2 py-2">{line.quantity}</td>
                    <td className="px-2 py-2">{line.stock_margin == null ? '—' : money(line.stock_margin)}</td>
                    <td className="px-2 py-2">{line.sold_quantity}</td>
                    <td className={`px-2 py-2 font-semibold ${Number(line.period_profit) < 0 ? 'text-alert' : 'text-ink'}`}>
                      {line.period_profit == null ? '—' : money(line.period_profit)}
                    </td>
                  </tr>
                ))}
                {report.lines.length === 0 && (
                  <tr><td colSpan={8} className="px-2 py-6 text-center text-ink-muted">Aucun article.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Total({ label, value }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  );
}
