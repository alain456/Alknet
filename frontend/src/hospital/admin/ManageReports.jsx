import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, DollarSign, Calendar, Users, FileSpreadsheet, 
  Download, Filter, ShieldCheck, Activity, Award
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManageReports() {
  const { token, authFetch } = useAuth();
  const [period, setPeriod] = useState('MONTH');
  const [loading, setLoading] = useState(false);

  // Mock report metrics based on active hospital data
  const reportData = {
    totalRevenue: '4 850 000 BIF',
    consultationsCount: 142,
    labTestsCount: 88,
    unpaidBillsCount: 5,
    unpaidBillsAmount: '350 000 BIF',
    revenueByService: [
      { name: 'Consultations Générales', amount: '1 420 000 BIF', percentage: 30 },
      { name: 'Laboratoire & Examens', amount: '1 850 000 BIF', percentage: 38 },
      { name: 'Pédiatrie & Maternité', amount: '980 000 BIF', percentage: 20 },
      { name: 'Urgences 24/7', amount: '600 000 BIF', percentage: 12 },
    ],
    revenueByPaymentMode: [
      { mode: 'Lumicash / EcoCash (Mobile Money)', amount: '2 910 000 BIF', count: 95 },
      { mode: 'Espèces (Caisse)', amount: '1 455 000 BIF', count: 40 },
      { mode: 'Virement / Carte bancaire', amount: '485 000 BIF', count: 7 },
    ]
  };

  const handleExportCSV = () => {
    const headers = ["Service / Metrique", "Montant / Valeur", "Part (%)"];
    const rows = reportData.revenueByService.map(s => [`"${s.name}"`, `"${s.amount}"`, `${s.percentage}%`]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rapport_hospitalier_${period}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2">
            <BarChart3 className="w-3.5 h-3.5" /> Module Reporting & Analytics Hospitalier
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="text-blue-400" />
            Rapports Financiers, Cliniques & Opérationnels
          </h1>
          <p className="text-blue-100 text-sm mt-1">Analyse détaillée de la fréquentation, des recettes et des performances de l'établissement.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4" /> Exporter le Rapport CSV
          </button>
        </div>
      </div>

      {/* Filtres de Période */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Période d'analyse :</span>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button 
            onClick={() => setPeriod('TODAY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${period === 'TODAY' ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Aujourd'hui
          </button>
          <button 
            onClick={() => setPeriod('WEEK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${period === 'WEEK' ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Cette Semaine
          </button>
          <button 
            onClick={() => setPeriod('MONTH')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${period === 'MONTH' ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Ce Mois
          </button>
        </div>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Recettes Totales</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{reportData.totalRevenue}</p>
            </div>
            <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Consultations Réalisées</p>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{reportData.consultationsCount}</p>
            </div>
            <div className="w-11 h-11 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Analyses de Laboratoire</p>
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{reportData.labTestsCount}</p>
            </div>
            <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Factures Impayées</p>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{reportData.unpaidBillsAmount}</p>
              <p className="text-[11px] text-gray-400 font-medium">{reportData.unpaidBillsCount} facture(s)</p>
            </div>
            <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Grid Répartition par service & Modes de paiement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Ventilation par Service */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-600" />
            Répartition du Chiffre d'Affaires par Service
          </h3>

          <div className="space-y-3">
            {reportData.revenueByService.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-gray-700 dark:text-gray-200">
                  <span>{item.name}</span>
                  <span>{item.amount} ({item.percentage}%)</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown Mode de Paiement */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Encaissements par Mode de Règlement
          </h3>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {reportData.revenueByPaymentMode.map((pay, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{pay.mode}</p>
                  <p className="text-[11px] text-gray-400">{pay.count} transactions enregistrées</p>
                </div>
                <div className="text-right font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                  {pay.amount}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
