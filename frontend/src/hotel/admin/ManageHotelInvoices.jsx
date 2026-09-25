import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import { getToken } from '../../shared/api';
import { HotelPage, Panel, btnPrimary, btnGhost, Empty, fieldClass, StatCard } from '../ui';

const todayIso = () => new Date().toISOString().slice(0, 10);

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function openReportsPdf({ from, to, summary, byMethod, daily, hotelName }) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=720');
  if (!win) return;
  const methodRows = Object.entries(byMethod || {}).map(([method, row]) => (
    `<tr><td>${method}</td><td>${row.count || 0}</td><td>${Number(row.amount || 0).toLocaleString('fr-FR')} BIF</td></tr>`
  )).join('');
  const dailyRows = (daily || []).map((row) => (
    `<tr><td>${row.date}</td><td>${row.rooms_sold}</td><td>${row.rooms_total}</td><td>${row.occupancy_rate}%</td></tr>`
  )).join('');
  win.document.write(`<!DOCTYPE html><html><head><title>Rapport hôtel ${from}–${to}</title>
    <style>
      body { font-family: Georgia, 'Times New Roman', serif; color: #1B4F9C; padding: 28px; background: #F5F5F3; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      h2 { font-size: 15px; margin: 24px 0 8px; color: #1E8B4A; }
      p { margin: 0 0 12px; color: #3d4a66; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; }
      th, td { padding: 8px 10px; border-bottom: 1px solid #d5e0df; text-align: left; }
      th { background: #e8eef7; }
      .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
      .kpi { background: #fff; border: 1px solid #d5e0df; padding: 12px; border-radius: 8px; }
      .kpi strong { display: block; font-size: 18px; margin-top: 4px; }
      button { margin-top: 20px; background: #1B4F9C; color: #F5F5F3; border: 0; padding: 10px 16px; border-radius: 8px; }
      @media print { button { display: none; } body { background: #fff; } }
    </style></head><body>
    <h1>${hotelName || 'Rapport hôtel'}</h1>
    <p>Période ${from} → ${to} · Occupancy / ADR / RevPAR</p>
    <div class="kpis">
      <div class="kpi">Occupation moy.<strong>${summary.avg_occupancy_rate ?? '—'}%</strong></div>
      <div class="kpi">Revenu<strong>${Number(summary.revenue_total || 0).toLocaleString('fr-FR')} BIF</strong></div>
      <div class="kpi">ADR<strong>${Number(summary.adr || 0).toLocaleString('fr-FR')} BIF</strong></div>
      <div class="kpi">RevPAR<strong>${Number(summary.revpar || 0).toLocaleString('fr-FR')} BIF</strong></div>
    </div>
    <h2>Revenus par moyen</h2>
    <table><thead><tr><th>Moyen</th><th>Nb</th><th>Montant</th></tr></thead>
    <tbody>${methodRows || '<tr><td colspan="3">Aucun paiement</td></tr>'}</tbody></table>
    <h2>Occupation journalière</h2>
    <table><thead><tr><th>Date</th><th>Vendues</th><th>Total</th><th>Occ. %</th></tr></thead>
    <tbody>${dailyRows || '<tr><td colspan="4">Pas de données</td></tr>'}</tbody></table>
    <button onclick="window.print()">Imprimer / Enregistrer en PDF</button>
    </body></html>`);
  win.document.close();
}

export default function ManageHotelInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [folios, setFolios] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [cashClosed, setCashClosed] = useState(false);
  const [cashTotal, setCashTotal] = useState(null);
  const [closingBusy, setClosingBusy] = useState(false);

  const load = async () => {
    const [i, f, dash] = await Promise.all([
      hotelService.invoices(),
      hotelService.folios(),
      hotelService.cashierDashboard().catch(() => null),
    ]);
    setInvoices(listOf(i));
    setFolios(listOf(f));
    if (dash) {
      setCashClosed(Boolean(dash.cash_closed_today));
      setCashTotal(
        dash.cash_closing?.total_collected != null
          ? dash.cash_closing.total_collected
          : dash.revenue_today,
      );
    }
  };

  useEffect(() => { load().catch((e) => setErr(e.message || 'Chargement impossible')); }, []);

  const closeCash = async () => {
    setErr('');
    setMsg('');
    if (cashClosed) {
      setMsg(`Caisse déjà clôturée pour le ${todayIso()}.`);
      return;
    }
    if (!window.confirm(`Clôturer la caisse du ${todayIso()} ? Aucun nouvel encaissement ne sera possible aujourd’hui.`)) {
      return;
    }
    setClosingBusy(true);
    try {
      const c = await hotelService.closeCash({ period_date: todayIso() });
      setCashClosed(true);
      setCashTotal(c.total_collected);
      setMsg(`Clôture ${c.period_date} — ${Number(c.total_collected).toLocaleString()} BIF`);
      await load();
    } catch (e) {
      const text = e.message || 'Clôture impossible';
      if (/déjà clôtur/i.test(text)) {
        setCashClosed(true);
        setMsg(`Caisse déjà clôturée pour le ${todayIso()}.`);
        await load().catch(() => {});
      } else {
        setErr(text);
      }
    } finally {
      setClosingBusy(false);
    }
  };

  return (
    <HotelPage
      title="Facturation"
      subtitle="Factures émises et folios ouverts"
      actions={(
        <div className="flex flex-wrap gap-2">
          <Link to="/hotel/cashier" className={`${btnGhost} text-sm`}>
            Dashboard caisse
          </Link>
          <button
            type="button"
            className={btnPrimary}
            disabled={closingBusy || cashClosed}
            onClick={closeCash}
            title={cashClosed ? 'Journée déjà clôturée' : undefined}
          >
            {closingBusy
              ? 'Clôture…'
              : cashClosed
                ? 'Caisse déjà clôturée'
                : 'Clôturer la caisse du jour'}
          </button>
        </div>
      )}
    >
      {err && (
        <Panel className="border-alert mb-3">
          <p className="font-bold text-alert text-sm">{err}</p>
        </Panel>
      )}
      {msg && (
        <Panel className="mb-3">
          <p className="font-bold text-primary text-sm">{msg}</p>
        </Panel>
      )}
      {cashClosed && (
        <div className="mb-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-700">
          <p className="font-extrabold">Caisse clôturée pour aujourd’hui</p>
          <p className="mt-0.5">
            Total verrouillé : {Number(cashTotal || 0).toLocaleString()} BIF.
            {' '}
            Pour encaisser à nouveau, attendez le lendemain ou utilisez le dashboard caisse.
          </p>
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <h2 className="font-extrabold text-ink mb-3">Factures</h2>
          {!invoices.length ? <Empty>Aucune facture</Empty> : invoices.map((inv) => (
            <div key={inv.id} className="py-2 border-b border-accent/15 text-sm text-ink font-medium">
              <p className="font-bold text-primary">{inv.number}</p>
              <p>{inv.guest_name} · {Number(inv.total).toLocaleString()} BIF · {inv.status}</p>
            </div>
          ))}
        </Panel>
        <Panel>
          <h2 className="font-extrabold text-ink mb-3">Folios ouverts</h2>
          {!folios.filter((f) => f.status === 'OPEN').length ? <Empty>Aucun folio ouvert</Empty> : folios.filter((f) => f.status === 'OPEN').map((f) => (
            <div key={f.id} className="py-2 border-b border-accent/15 text-sm font-medium text-ink">
              <p className="font-bold">
                {[f.guest_name, f.room_number && `Ch. ${f.room_number}`, f.reservation_ref]
                  .filter(Boolean)
                  .join(' · ') || 'Folio'}
              </p>
              <p>
                Solde {Number(f.balance).toLocaleString()} / Total {Number(f.total).toLocaleString()} BIF
              </p>
            </div>
          ))}
        </Panel>
      </div>
    </HotelPage>
  );
}

export function HotelReports() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 29);
  const toIso = (d) => d.toISOString().slice(0, 10);

  const [from, setFrom] = useState(toIso(monthAgo));
  const [to, setTo] = useState(toIso(today));
  const [stats, setStats] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      hotelService.dashboard(),
      hotelService.reports({ from, to }),
    ])
      .then(([dash, rep]) => {
        setStats(dash);
        setReport(rep);
      })
      .catch((e) => setError(e.message || 'Erreur rapports'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const summary = report?.summary || {};
  const byMethod = report?.revenue_by_method || {};
  const daily = report?.daily || [];

  const exportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const token = getToken();
      const res = await fetch(hotelService.reportsCsvUrl({ from, to }), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.to || 'Export CSV impossible');
      }
      const blob = await res.blob();
      downloadBlob(blob, `rapport-hotel-${from}_${to}.csv`);
    } catch (e) {
      setError(e.message || 'Export CSV impossible');
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = () => {
    if (!report) {
      setError('Chargez d’abord les rapports.');
      return;
    }
    openReportsPdf({
      from,
      to,
      summary,
      byMethod,
      daily,
      hotelName: report.hotel_name || 'Rapport hôtel',
    });
  };

  return (
    <HotelPage
      title="Rapports"
      subtitle="Occupation & revenus"
      actions={(
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-ink-muted">
            Du
            <input type="date" className={`${fieldClass} mt-1`} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-xs font-bold text-ink-muted">
            Au
            <input type="date" className={`${fieldClass} mt-1`} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className={btnPrimary} onClick={load} disabled={loading}>
            Actualiser
          </button>
          <button
            type="button"
            className={`${btnGhost} text-sm inline-flex items-center gap-1`}
            onClick={exportCsv}
            disabled={exporting || loading}
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            className={`${btnGhost} text-sm inline-flex items-center gap-1`}
            onClick={exportPdf}
            disabled={loading || !report}
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      )}
    >
      {error && <div className="p-3 rounded-xl bg-alert/10 text-alert text-sm border border-alert/30">{error}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Occupation moy." value={`${summary.avg_occupancy_rate ?? stats?.occupancy_rate ?? '—'}%`} hint={`${from} → ${to}`} />
        <StatCard label="Revenu période" value={`${Number(summary.revenue_total || 0).toLocaleString()} BIF`} />
        <StatCard label="ADR" value={`${Number(summary.adr || 0).toLocaleString()} BIF`} hint="Revenu / nuit vendue" />
        <StatCard label="RevPAR" value={`${Number(summary.revpar || 0).toLocaleString()} BIF`} hint="Revenu / chambre disponible" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <h3 className="font-bold text-ink mb-3">Aujourd’hui</h3>
          {!stats ? <Empty>Chargement…</Empty> : (
            <ul className="space-y-2 text-sm font-medium text-ink">
              <li>Occupation instantanée : <strong>{stats.occupancy_rate}%</strong></li>
              <li>Revenu du jour : <strong>{Number(stats.revenue_today).toLocaleString()} BIF</strong></li>
              <li>Arrivées / départs : <strong>{stats.arrivals_today}</strong> / <strong>{stats.departures_today}</strong></li>
              <li>Chambres hors service : <strong>{stats.rooms_oos}</strong></li>
              <li>Tâches HK ouvertes : <strong>{stats.hk_pending}</strong></li>
            </ul>
          )}
        </Panel>
        <Panel>
          <h3 className="font-bold text-ink mb-3">Revenus par moyen</h3>
          {!Object.keys(byMethod).length ? (
            <Empty>Aucun paiement sur la période</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {Object.entries(byMethod).map(([method, row]) => (
                <li key={method} className="flex justify-between font-medium text-ink border-b border-accent/10 pb-1">
                  <span>{method} · {row.count}×</span>
                  <strong>{Number(row.amount || 0).toLocaleString()} BIF</strong>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="overflow-x-auto">
        <h3 className="font-bold text-ink mb-3">Occupation journalière</h3>
        {loading ? <Empty>Chargement…</Empty> : !daily.length ? (
          <Empty>Pas de données</Empty>
        ) : (
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-muted border-b border-accent/20">
                <th className="py-2">Date</th>
                <th className="py-2">Vendues</th>
                <th className="py-2">Total</th>
                <th className="py-2">Occ. %</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((row) => (
                <tr key={row.date} className="border-b border-accent/10">
                  <td className="py-1.5 font-medium">{row.date}</td>
                  <td className="py-1.5">{row.rooms_sold}</td>
                  <td className="py-1.5">{row.rooms_total}</td>
                  <td className="py-1.5 font-bold text-primary">{row.occupancy_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </HotelPage>
  );
}

export function HotelAudit() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { hotelService.audit().then((d) => setLogs(listOf(d))); }, []);
  return (
    <HotelPage title="Historique / Audit">
      <Panel>
        {!logs.length ? <Empty>Aucun événement</Empty> : logs.map((l) => (
          <div key={l.id} className="py-2 border-b border-accent/10 text-sm text-ink">
            <span className="font-bold">{l.action}</span> · {l.entity_type} {l.entity_id}
            <span className="text-ink-muted text-xs block">{l.actor_email} · {new Date(l.created_at).toLocaleString()}</span>
          </div>
        ))}
      </Panel>
    </HotelPage>
  );
}
