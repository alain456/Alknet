import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, DollarSign, Users, FileSpreadsheet,
  Download, Filter, Award, Activity, AlertCircle,
} from 'lucide-react';
import hospitalService from '../hospitalService';

const formatBIF = (amount) => `${Math.round(Number(amount) || 0).toLocaleString('fr-FR')} BIF`;

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

export default function ManageReports() {
  const [period, setPeriod] = useState('MONTH');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [hospitalId, setHospitalId] = useState(null);

  const loadReports = useCallback(async (hid, p) => {
    setLoading(true);
    setError('');
    try {
      const data = await hospitalService.getReports(hid, p);
      setReportData(data);
    } catch (err) {
      setError(err.message || 'Impossible de charger les rapports.');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const businesses = await hospitalService.getMyHospital();
        const list = Array.isArray(businesses) ? businesses : [];
        if (list.length > 0) {
          setHospitalId(list[0].id);
          await loadReports(list[0].id, period);
        } else {
          setError('Aucun hôpital associé.');
          setLoading(false);
        }
      } catch (err) {
        setError(err.message || 'Erreur de chargement');
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (hospitalId) loadReports(hospitalId, period);
  }, [period, hospitalId, loadReports]);

  const handleExportCSV = () => {
    if (!reportData) return;
    const headers = ['Service / Métrique', 'Montant (BIF)', 'Part (%)'];
    const rows = normalizeList(reportData.revenue_by_service).map((s) => [
      `"${s.name}"`,
      String(Math.round(s.amount)),
      `${s.percentage || 0}%`,
    ]);
    const csvContent = `data:text/csv;charset=utf-8,${[headers.join(','), ...rows.map((e) => e.join(','))].join('\n')}`;
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `rapport_hospitalier_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const revenueByService = normalizeList(reportData?.revenue_by_service);
  const revenueByPayment = normalizeList(reportData?.revenue_by_payment_mode);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2">
            <BarChart3 className="w-3.5 h-3.5" /> Données en direct — base PostgreSQL
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="text-blue-400" />
            Rapports Financiers, Cliniques & Opérationnels
          </h1>
          <p className="text-blue-100 text-sm mt-1">Agrégation en temps réel des factures, consultations et analyses.</p>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={!reportData || revenueByService.length === 0}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-2 disabled:opacity-40"
        >
          <Download className="w-4 h-4" /> Exporter CSV
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Période :</span>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {['TODAY', 'WEEK', 'MONTH'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${period === p ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}
            >
              {p === 'TODAY' ? "Aujourd'hui" : p === 'WEEK' ? 'Semaine' : 'Mois'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500">Chargement des rapports...</div>
      ) : reportData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border p-5">
              <p className="text-xs font-semibold text-gray-500">Recettes encaissées</p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">{formatBIF(reportData.total_revenue)}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border p-5">
              <p className="text-xs font-semibold text-gray-500">Consultations terminées</p>
              <p className="text-2xl font-extrabold text-blue-600 mt-1">{reportData.consultations_count ?? 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border p-5">
              <p className="text-xs font-semibold text-gray-500">Analyses laboratoire</p>
              <p className="text-2xl font-extrabold text-indigo-600 mt-1">{reportData.lab_tests_count ?? 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border p-5">
              <p className="text-xs font-semibold text-gray-500">Factures impayées</p>
              <p className="text-2xl font-extrabold text-amber-600 mt-1">{formatBIF(reportData.unpaid_bills_amount)}</p>
              <p className="text-[11px] text-gray-400">{reportData.unpaid_bills_count ?? 0} facture(s)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border p-6 space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" /> Recettes par service
              </h3>
              {revenueByService.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">Aucune recette sur cette période.</p>
              ) : (
                revenueByService.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span>{item.name}</span>
                      <span>{formatBIF(item.amount)} ({item.percentage || 0}%)</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${item.percentage || 0}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border p-6 space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" /> Encaissements
              </h3>
              {revenueByPayment.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">Aucun paiement enregistré sur cette période.</p>
              ) : (
                revenueByPayment.map((pay) => (
                  <div key={pay.mode} className="py-3 flex justify-between text-xs border-b last:border-0">
                    <div>
                      <p className="font-bold">{pay.mode}</p>
                      <p className="text-gray-400">{pay.count} transaction(s)</p>
                    </div>
                    <p className="font-extrabold text-emerald-600">{formatBIF(pay.amount)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
