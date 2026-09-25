import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Receipt, Download, Printer, Lock, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const formatBif = (amount) => `${Math.round(Number(amount) || 0).toLocaleString('fr-FR')} BIF`;

const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Bujumbura' }).format(new Date());

function openReceipt(invoice, hospitalName) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=420,height=640');
  if (!win) return;
  const rows = [
    ['Facture', invoice.invoice_number || invoice.id],
    ['Patient', invoice.patient_name || ''],
    ['Acte', invoice.act_label || invoice.act_type_display || invoice.description || ''],
    ['Mode', invoice.payment_method_display || invoice.payment_method_label || ''],
    ['Montant', formatBif(invoice.amount)],
    ['Statut', invoice.status === 'PAID' ? 'Payée' : invoice.status === 'CANCELLED' ? 'Annulée' : 'En attente'],
    ['Référence RDV', invoice.appointment_reference || ''],
  ].filter((row) => row[1]);
  win.document.write(`<!DOCTYPE html><html><head><title>Reçu ${invoice.invoice_number || ''}</title>
    <style>
      body { font-family: sans-serif; color: #1B4F9C; padding: 24px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      p { margin: 0 0 16px; color: #3d6b66; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 8px 0; border-bottom: 1px solid #d5e0df; vertical-align: top; }
      td:first-child { color: #3d6b66; width: 40%; }
      button { margin-top: 20px; background: #1B4F9C; color: #F5F5F3; border: 0; padding: 10px 16px; border-radius: 8px; }
    </style></head><body>
    <h1>${hospitalName || 'Hôpital'}</h1>
    <p>Reçu de comptabilité</p>
    <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`).join('')}</table>
    <button onclick="window.print()">Imprimer</button>
    </body></html>`);
  win.document.close();
}

export default function AccountingDashboard() {
  const { token, authFetch } = useAuth();
  const [date, setDate] = useState(todayKey());
  const [desk, setDesk] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [hospitalName, setHospitalName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    patient: '',
    amount: '',
    act_type: 'EXAM',
    act_label: '',
    payment_method: 'CASH',
    description: '',
  });

  const load = useCallback(async (hid, day) => {
    setLoading(true);
    setError('');
    try {
      const [deskRes, invRes] = await Promise.all([
        authFetch(`/api/v1/hospital/invoices/desk/?date=${day}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        authFetch(`/api/v1/hospital/invoices/?hospital=${hid}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!deskRes.ok) {
        const body = await deskRes.json().catch(() => ({}));
        throw new Error(body.detail || 'Impossible de charger la comptabilité.');
      }
      setDesk(await deskRes.json());
      if (invRes.ok) {
        const data = await invRes.json();
        setInvoices(Array.isArray(data) ? data : (data.results || []));
      }
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [authFetch, token]);

  useEffect(() => {
    const init = async () => {
      try {
        const busRes = await authFetch('/api/v1/businesses/me/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!busRes.ok) {
          setLoading(false);
          return;
        }
        const businesses = await busRes.json();
        if (!businesses.length) {
          setLoading(false);
          return;
        }
        setHospitalId(businesses[0].id);
        setHospitalName(businesses[0].name || '');
        await load(businesses[0].id, date);
      } catch (err) {
        setError(err.message || 'Erreur de chargement');
        setLoading(false);
      }
    };
    if (token) init();
  }, [token]);

  const refresh = () => {
    if (hospitalId) load(hospitalId, date);
  };

  const billAppointment = async (appointmentId, paymentMethod) => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch('/api/v1/hospital/invoices/from-appointment/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appointment: appointmentId, payment_method: paymentMethod || '' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Facture non créée.');
      }
      refresh();
    } catch (err) {
      setError(err.message || 'Facture non créée.');
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (invoice, method) => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(`/api/v1/hospital/invoices/${invoice.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'PAID', payment_method: method || 'CASH' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Paiement non enregistré.');
      }
      refresh();
    } catch (err) {
      setError(err.message || 'Paiement non enregistré.');
    } finally {
      setBusy(false);
    }
  };

  const closeDay = async () => {
    if (!window.confirm('Clôturer cette journée ? Le total encaissé sera figé.')) return;
    setBusy(true);
    setError('');
    try {
      const res = await authFetch('/api/v1/hospital/invoices/close-day/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Clôture impossible.');
      }
      refresh();
    } catch (err) {
      setError(err.message || 'Clôture impossible.');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async (scope) => {
    const res = await authFetch(`/api/v1/hospital/invoices/export/?date=${date}&scope=${scope}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = scope === 'month' ? `comptabilite-${date.slice(0, 7)}.csv` : `comptabilite-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const createInvoice = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await authFetch('/api/v1/hospital/invoices/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patient: form.patient,
          hospital: hospitalId,
          amount: form.amount,
          act_type: form.act_type,
          act_label: form.act_label,
          description: form.description || form.act_label,
          payment_method: form.payment_method,
          status: 'PAID',
          currency: 'BIF',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail || Object.values(body)[0];
        throw new Error(Array.isArray(detail) ? detail[0] : (detail || 'Facture non créée.'));
      }
      setShowForm(false);
      setForm({ patient: '', amount: '', act_type: 'EXAM', act_label: '', payment_method: 'CASH', description: '' });
      refresh();
    } catch (err) {
      setError(err.message || 'Facture non créée.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => invoices.filter((invoice) => {
    const statusOk = statusFilter === 'ALL' || invoice.status === statusFilter;
    const hay = `${invoice.patient_name || ''} ${invoice.invoice_number || ''} ${invoice.act_label || ''}`.toLowerCase();
    const day = (invoice.issued_at || '').slice(0, 10);
    const search = query.trim().toLowerCase();
    const searchOk = !search || hay.includes(search) || day.includes(search);
    return statusOk && searchOk;
  }), [invoices, query, statusFilter]);

  const day = desk?.day || {};
  const month = desk?.month || {};

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Receipt className="text-teal-700 dark:text-teal-400" />
            Comptabilité
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Factures, encaissements et clôture. Les dossiers médicaux restent hors de cet écran.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (hospitalId) load(hospitalId, e.target.value);
            }}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <button type="button" onClick={() => exportCsv('day')} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-teal-800 text-sm font-semibold text-teal-800 dark:text-teal-200">
            Export du jour
          </button>
          <button type="button" onClick={() => exportCsv('month')} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-teal-800 text-sm font-semibold text-teal-800 dark:text-teal-200">
            Export du mois
          </button>
          <button
            type="button"
            disabled={busy || desk?.closed}
            onClick={closeDay}
            className="px-3 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Lock className="w-4 h-4" />
            {desk?.closed ? 'Journée clôturée' : 'Clôturer la journée'}
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm dark:bg-red-950/40 dark:text-red-200">{error}</div>}
      {loading && <div className="p-8 text-gray-500 dark:text-gray-400">Chargement de la comptabilité...</div>}

      {desk && !loading && (
        <>
          {desk.closed && desk.closing && (
            <div className="p-4 rounded-2xl border border-teal-200 bg-teal-50 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100">
              Journée figée le {new Date(desk.closing.closed_at).toLocaleString('fr-FR')}
              {desk.closing.closed_by_name ? ` par ${desk.closing.closed_by_name}` : ''}.
              Encaissé : <strong>{formatBif(desk.closing.total_collected)}</strong>.
              Encore dû au moment de la clôture : <strong>{formatBif(desk.closing.total_pending)}</strong>.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Encaissé ce jour</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatBif(day.collected)}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Encore dû</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatBif(day.pending)}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Recettes du mois</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatBif(month.collected)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(day.by_method || []).map((row) => (
              <div key={row.method} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{row.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{row.count} encaissement(s)</p>
                </div>
                <p className="font-bold text-gray-900 dark:text-white">{formatBif(row.amount)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
              <h2 className="font-bold text-gray-900 dark:text-white mb-3">Rendez-vous payés sans facture</h2>
              {(day.paid_without_invoice || []).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucun paiement à rapprocher pour cette date.</p>
              ) : (day.paid_without_invoice || []).map((appt) => (
                <div key={appt.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{appt.patient_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{appt.reference_code} · {appt.payment_method_label} · {formatBif(appt.amount)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || desk.closed}
                    onClick={() => billAppointment(appt.id, appt.payment_method)}
                    className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    Créer la facture
                  </button>
                </div>
              ))}
            </section>
            <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
              <h2 className="font-bold text-gray-900 dark:text-white mb-3">À encaisser aujourd’hui</h2>
              {(day.to_collect || []).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucun rendez-vous impayé sur cette date.</p>
              ) : (day.to_collect || []).map((appt) => (
                <div key={appt.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{appt.patient_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{appt.reference_code} · {appt.service_name} · {formatBif(appt.amount)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || desk.closed}
                    onClick={() => billAppointment(appt.id, 'CASH')}
                    className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    Encaisser espèces
                  </button>
                </div>
              ))}
            </section>
          </div>

          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <h2 className="font-bold text-gray-900 dark:text-white">Factures</h2>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Patient, numéro ou date"
                    className="pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
                  />
                </div>
                {['ALL', 'PENDING', 'PAID', 'CANCELLED'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${statusFilter === status ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
                  >
                    {status === 'ALL' ? 'Toutes' : status === 'PENDING' ? 'En attente' : status === 'PAID' ? 'Payées' : 'Annulées'}
                  </button>
                ))}
                <button type="button" onClick={() => setShowForm((v) => !v)} className="px-3 py-1.5 rounded-lg border text-xs font-semibold text-teal-800 dark:text-teal-200 dark:border-teal-800">
                  Autre prestation
                </button>
              </div>
            </div>

            {showForm && (
              <form onSubmit={createInvoice} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-950">
                <select required value={form.patient} onChange={(e) => setForm({ ...form, patient: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                  <option value="">Patient</option>
                  {(desk.patients || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={form.act_type} onChange={(e) => setForm({ ...form, act_type: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                  <option value="EXAM">Examen</option>
                  <option value="CONSULTATION">Consultation</option>
                  <option value="OTHER">Autre prestation</option>
                </select>
                <input required value={form.act_label} onChange={(e) => setForm({ ...form, act_label: e.target.value })} placeholder="Libellé de l’acte" className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                <input required type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Montant BIF" className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                  <option value="CASH">Espèces</option>
                  <option value="BURUNDIPAY">BurundiPay</option>
                  <option value="FREE">Gratuit</option>
                  <option value="OTHER">Autre</option>
                </select>
                <button type="submit" disabled={busy || desk.closed} className="px-3 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold disabled:opacity-50">
                  Enregistrer
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">N°</th>
                    <th className="py-2 pr-3">Patient</th>
                    <th className="py-2 pr-3">Acte</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Montant</th>
                    <th className="py-2 pr-3">Statut</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan="7" className="py-6 text-center text-gray-500">Aucune facture.</td></tr>
                  ) : filtered.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-100">
                      <td className="py-3 pr-3 font-mono text-xs">{invoice.invoice_number || '—'}</td>
                      <td className="py-3 pr-3">{invoice.patient_name}</td>
                      <td className="py-3 pr-3">{invoice.act_label || invoice.act_type_display || invoice.description || '—'}</td>
                      <td className="py-3 pr-3">{invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="py-3 pr-3 font-semibold">{formatBif(invoice.amount)}</td>
                      <td className="py-3 pr-3">{invoice.status === 'PAID' ? 'Payée' : invoice.status === 'CANCELLED' ? 'Annulée' : 'En attente'}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          <button type="button" title="Imprimer le reçu" onClick={() => openReceipt(invoice, hospitalName)} className="p-2 rounded-lg hover:bg-gray-100">
                            <Printer className="w-4 h-4" />
                          </button>
                          <button type="button" title="Télécharger le jour" onClick={() => exportCsv('day')} className="p-2 rounded-lg hover:bg-gray-100">
                            <Download className="w-4 h-4" />
                          </button>
                          {invoice.status === 'PENDING' && (
                            <button
                              type="button"
                              disabled={busy || desk.closed}
                              onClick={() => markPaid(invoice, 'CASH')}
                              className="px-2 py-1 rounded-lg bg-teal-700 text-white text-xs font-semibold disabled:opacity-50"
                            >
                              Espèces
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-2xl border p-4">
            <h2 className="font-bold text-gray-900 mb-3">Mois en cours</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {(month.by_act || []).length === 0 ? (
                <p className="text-sm text-gray-500">Aucune recette enregistrée ce mois.</p>
              ) : (month.by_act || []).map((row) => (
                <div key={row.act} className="rounded-xl border px-4 py-3">
                  <p className="text-sm text-gray-500">{row.label}</p>
                  <p className="font-bold text-gray-900">{formatBif(row.amount)}</p>
                  <p className="text-xs text-gray-500">{row.count} facture(s)</p>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-bold text-gray-800 mb-2">Impayés</h3>
            {(month.unpaid || []).length === 0 ? (
              <p className="text-sm text-gray-500">Aucun impayé.</p>
            ) : (
              <ul className="text-sm divide-y">
                {(month.unpaid || []).map((inv) => (
                  <li key={inv.id} className="py-2 flex justify-between gap-3">
                    <span>{inv.patient_name} · {inv.invoice_number} · {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('fr-FR') : ''}</span>
                    <span className="font-semibold">{formatBif(inv.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
