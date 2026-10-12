/**
 * Caisse pharmacie — suivi de l'argent réellement encaissé.
 *
 * Les montants viennent du journal d'encaissements, pas du statut de la
 * commande : une commande « payée » sans trace d'argent apparaît ici comme un
 * écart de rapprochement, jamais comme de la recette.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import retailService from './retailService';
import CashExportButtons from './CashExportButtons';

const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);
const money = (value, currency = 'BIF') =>
  `${Number(value || 0).toLocaleString('fr-BI')} ${currency}`;

const RANGES = [
  { days: 1, label: "Aujourd'hui" },
  { days: 7, label: '7 derniers jours' },
  { days: 30, label: '30 derniers jours' },
  { days: 90, label: '90 derniers jours' },
];

const dateTime = (value) =>
  value ? new Date(value).toLocaleString('fr-BI', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export default function RetailCashier() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [collections, setCollections] = useState([]);
  const [missing, setMissing] = useState({ count: 0, orders: [] });
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [sum, rows, pending, recon] = await Promise.all([
        retailService.getCashDashboard(days),
        retailService.getCashCollections(),
        retailService.getMissingCollections(),
        retailService.getCashReconciliation(days),
      ]);
      setSummary(sum);
      setCollections(normalize(rows));
      setMissing(pending);
      setReport(recon);
    } catch (err) {
      setError(err.message || 'Impossible de charger la caisse.');
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const collect = async (order) => {
    setBusyId(order.order_id);
    setError('');
    setNotice('');
    try {
      await retailService.recordMissingCollection(order.order_id);
      setNotice(`Encaissement enregistré pour ${order.reference}.`);
      await load();
    } catch (err) {
      setError(err.message || "L'encaissement a échoué.");
    } finally {
      setBusyId('');
    }
  };

  const outstanding = useMemo(() => missing.orders, [missing]);

  // Les exports PDF se construisent sur les lignes déjà affichées : une seule
  // source de vérité, donc le PDF ne peut pas contredire le tableau.
  const journalColumns = useMemo(
    () => [
      { label: 'Date' },
      { label: 'Référence' },
      { label: 'Client' },
      { label: 'Méthode' },
      { label: 'Réf. paiement' },
      { label: 'Encaissé par' },
      { label: 'Montant', numeric: true },
    ],
    [],
  );
  const journalRows = useMemo(
    () =>
      collections.map((c) => [
        c.collected_at ? new Date(c.collected_at).toLocaleString('fr-BI') : '—',
        c.source_order_ref || '—',
        c.customer_name || '—',
        c.method_display || c.method || '—',
        c.external_reference || '—',
        c.received_by_name || '—',
        money(c.signed_amount ?? c.amount),
      ]),
    [collections],
  );
  const journalTotal = useMemo(
    () =>
      money(
        collections.reduce((sum, c) => sum + Number(c.signed_amount ?? c.amount ?? 0), 0),
      ),
    [collections],
  );

  const missingColumns = useMemo(
    () => [
      { label: 'Référence' },
      { label: 'Client' },
      { label: 'Paiement' },
      { label: 'Payé le' },
      { label: 'Montant manquant', numeric: true },
    ],
    [],
  );
  const missingRows = useMemo(
    () =>
      outstanding.map((o) => [
        o.reference,
        o.customer_name || '—',
        o.method || 'BurundiPay',
        o.paid_at ? new Date(o.paid_at).toLocaleString('fr-BI') : '—',
        money(o.total_amount),
      ]),
    [outstanding],
  );
  const missingTotal = useMemo(
    () => money(outstanding.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)),
    [outstanding],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Caisse</h1>
          <p className="text-sm text-ink-muted">
            Argent réellement encaissé. Une commande marquée payée sans encaissement
            apparaît en écart, jamais en recette.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs space-y-1">
            <span className="text-ink-muted">Période</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="border border-border rounded-xl px-3 py-2 text-sm bg-white"
            >
              {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={load}
            className="border border-border rounded-xl px-3 py-2 text-sm bg-white hover:bg-paper"
          >
            Actualiser
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-error rounded-xl text-sm">{error}</div>}
      {notice && <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm">{notice}</div>}

      {/* Totaux */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-ink-muted uppercase">Total encaissé</p>
          <p className="text-xl font-bold text-ink mt-1">
            {money(summary?.total_collected, summary?.currency)}
          </p>
        </div>
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-ink-muted uppercase">En espèces (tiroir)</p>
          <p className="text-xl font-bold text-ink mt-1">
            {money(summary?.cash_on_hand, summary?.currency)}
          </p>
        </div>
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-ink-muted uppercase">Remboursé</p>
          <p className="text-xl font-bold text-ink mt-1">
            {money(summary?.refunded_total, summary?.currency)}
          </p>
        </div>
      </div>

      {/* Répartition */}
      <div className="bg-white border border-border rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-ink mb-3">Répartition par méthode</h2>
        {!summary?.by_method?.length ? (
          <p className="text-sm text-ink-muted">Aucun encaissement sur cette période.</p>
        ) : (
          <ul className="space-y-2">
            {summary.by_method.map((row) => {
              const pct = Number(summary.total_collected) > 0
                ? (Number(row.amount) / Number(summary.total_collected)) * 100
                : 0;
              return (
                <li key={row.method} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink">{row.label} <span className="text-ink-muted">({row.count})</span></span>
                    <span className="font-medium text-ink">{money(row.amount, summary?.currency)}</span>
                  </div>
                  <div className="h-1.5 bg-paper rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Écarts */}
      {report && !report.clean && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            {report.count} écart{report.count > 1 ? 's' : ''} de rapprochement
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {report.anomalies.slice(0, 8).map((a, i) => (
              <li key={`${a.order_id}-${i}`}>
                <span className="font-medium">{a.reference}</span> — {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Encaissements manquants */}
      <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
        <div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-ink">
              Encaissements manquants ({outstanding.length})
            </h2>
            <CashExportButtons
              report="missing"
              title="Encaissements manquants"
              subtitle="Pharmacie — commandes payées sans ligne d'encaissement"
              columns={missingColumns}
              rows={missingRows}
              totals={{ label: 'Total manquant', value: missingTotal }}
            />
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Ces commandes sont marquées payées mais l&apos;argent n&apos;a pas
            été enregistré dans la caisse. Les paiements BurundiPay
            s&apos;enregistrent tout seuls&nbsp;: vérifiez d&apos;abords que le
            paiement a bien abouti.
          </p>
        </div>

        {!outstanding.length ? (
          <p className="text-sm text-ink-muted">
            Tous les encaissements sont auComplet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-xs uppercase text-ink-muted text-left">
                <tr>
                  <th className="px-3 py-2">Référence</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Paiement</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {outstanding.map((order) => (
                  <tr key={order.order_id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-ink">{order.reference}</td>
                    <td className="px-3 py-2 text-ink-muted">{order.customer_name || '—'}</td>
                    <td className="px-3 py-2 text-ink-muted">
                      {order.method || 'BurundiPay'}
                      {order.provider_reference && (
                        <span className="ml-1 text-xs">{order.provider_reference}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-error">
                      {money(order.total_amount)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={busyId === order.order_id}
                        onClick={() => collect(order)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-50"
                      >
                        {busyId === order.order_id ? 'En cours…' : 'Enregistrer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Journal */}
      <div className="bg-white border border-border rounded-2xl overflow-x-auto">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-ink">Journal des encaissements</h2>
            <CashExportButtons
              report="journal"
              title="Journal des encaissements"
              subtitle="Pharmacie — suivi de l'argent réellement encaissé"
              columns={journalColumns}
              rows={journalRows}
              totals={{ label: 'Total encaissé', value: journalTotal }}
            />
          </div>
        </div>
        {!collections.length ? (
          <p className="p-4 text-sm text-ink-muted">Aucun encaissement enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper text-xs uppercase text-ink-muted text-left">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Référence</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Méthode</th>
                <th className="px-3 py-2">Reçu par</th>
                <th className="px-3 py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2 text-ink-muted whitespace-nowrap">{dateTime(row.collected_at)}</td>
                  <td className="px-3 py-2 font-medium text-ink">{row.source_order_ref || '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">{row.customer_name || '—'}</td>
                  <td className="px-3 py-2">
                    {row.method_display}
                    {row.status === 'REFUNDED' && (
                      <span className="ml-1 text-xs text-error">(remboursement)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-muted">{row.received_by_name || '—'}</td>
                  <td className="px-3 py-2 text-right font-medium text-ink">
                    {row.status === 'REFUNDED' ? '−' : ''}{money(row.amount, row.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
