import React, { useState, useEffect } from 'react';
import DataSummaryCard from './components/DataSummaryCard';
import AdminChartCard from './components/AdminChartCard';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/analytics/dashboard-stats/', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-error rounded-md border border-error/20">
        <h3 className="font-semibold">Erreur de chargement</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Fallbacks if data is somehow missing
  const metrics = data?.metrics || {};
  const recentActivity = data?.recent_activity || [];
  const activeSubscriptions = data?.active_subscriptions || [];

  return (
    <div className="space-y-8 max-w-350 mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-green-900 dark:text-white tracking-tight">Vue d'ensemble</h1>
          <p className="text-[15px] text-ink-muted dark:text-green-100/70 mt-1">Métriques vitales et activité en temps réel.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-[14px] font-semibold bg-surface dark:bg-transparent border-[1.5px] border-border dark:border-white/20 text-green-700 dark:text-green-100 rounded-md hover:bg-green-50 dark:hover:bg-white/5 transition-colors shadow-sm">
            Exporter
          </button>
          <button className="px-4 py-2 text-[14px] font-semibold bg-green-700 text-white rounded-md hover:bg-green-900 transition-colors shadow-sm">
            Voir Analytics
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <DataSummaryCard 
          title="Utilisateurs Actifs" 
          value={metrics.total_active_users?.toLocaleString() || "0"} 
          trend="up" 
          trendValue="+12.5%" 
        />
        <DataSummaryCard 
          title="Entreprises" 
          value={metrics.registered_businesses?.toLocaleString() || "0"} 
          trend="up" 
          trendValue="+4.1%" 
        />
        <DataSummaryCard 
          title="Revenu Mensuel (BIF)" 
          value={metrics.monthly_revenue ? `${(metrics.monthly_revenue / 1000000).toFixed(1)}M` : "0"} 
          trend="up" 
          trendValue="+8.2%" 
        />
        <DataSummaryCard 
          title="Taux d'erreur API" 
          value={metrics.error_rate ? `${metrics.error_rate}%` : "0%"} 
          trend="down" 
          trendValue="-2.4%" 
          trendLabel="vs semaine dernière"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AdminChartCard 
            title="Croissance des Revenus" 
            subtitle="Revenus récurrents sur les 12 derniers mois"
          >
            {/* Minimalist fake chart */}
            <div className="absolute inset-x-0 bottom-0 h-40 flex items-end gap-2 p-2">
              {[40, 45, 55, 50, 60, 75, 70, 85, 90, 85, 95, 100].map((h, i) => (
                <div key={i} className="flex-1 bg-green-100 dark:bg-green-700/50 rounded-t-[4px] hover:bg-gold-600 dark:hover:bg-gold-600 transition-colors relative group" style={{ height: `${h}%` }}>
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-green-900 dark:bg-white text-white dark:text-green-900 text-[11px] font-mono py-1.5 px-2.5 rounded shadow-sm pointer-events-none whitespace-nowrap transition-opacity">
                    {(h * 0.8).toFixed(1)}M
                  </div>
                </div>
              ))}
            </div>
          </AdminChartCard>
        </div>
        <div>
          <AdminChartCard 
            title="Acquisition" 
            subtitle="Distribution des sources de trafic"
          >
             <div className="absolute inset-0 flex flex-col justify-center gap-4 p-4">
                <div className="w-full">
                  <div className="flex justify-between text-[13px] mb-1.5 text-ink-muted dark:text-green-100/70"><span>Recherche Organique</span> <span className="font-mono text-green-900 dark:text-white">55%</span></div>
                  <div className="h-2 w-full bg-paper dark:bg-black/30 rounded-full overflow-hidden">
                    <div className="h-full bg-green-700 dark:bg-green-500 w-[55%]"></div>
                  </div>
                </div>
                <div className="w-full">
                  <div className="flex justify-between text-[13px] mb-1.5 text-ink-muted dark:text-green-100/70"><span>Direct</span> <span className="font-mono text-green-900 dark:text-white">30%</span></div>
                  <div className="h-2 w-full bg-paper dark:bg-black/30 rounded-full overflow-hidden">
                    <div className="h-full bg-gold-600 w-[30%]"></div>
                  </div>
                </div>
                <div className="w-full">
                  <div className="flex justify-between text-[13px] mb-1.5 text-ink-muted dark:text-green-100/70"><span>Référence</span> <span className="font-mono text-green-900 dark:text-white">15%</span></div>
                  <div className="h-2 w-full bg-paper dark:bg-black/30 rounded-full overflow-hidden">
                    <div className="h-full bg-clay-600 w-[15%]"></div>
                  </div>
                </div>
             </div>
          </AdminChartCard>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Activity */}
        <div className="border border-border dark:border-white/10 rounded-lg bg-surface dark:bg-[#1A2E25] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border dark:border-white/10 flex justify-between items-center">
            <h3 className="text-[15px] font-semibold text-green-900 dark:text-white">Activité Récente</h3>
            <button className="text-[13px] font-medium text-green-700 hover:text-green-900 dark:text-green-100/70 dark:hover:text-white transition-colors">Tout voir</button>
          </div>
          <div className="divide-y divide-border dark:divide-white/10">
            {recentActivity.map((log) => (
              <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-green-50 dark:hover:bg-white/5 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  log.status === 'success' ? 'bg-success' : 
                  log.status === 'error' ? 'bg-error' : 
                  log.status === 'warning' ? 'bg-gold-600' : 'bg-green-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink dark:text-white truncate">{log.action}</p>
                  <p className="text-[13px] text-ink-muted dark:text-green-100/60 truncate mt-0.5">{log.target} • {log.user}</p>
                </div>
                <div className="text-[12px] text-ink-faint dark:text-green-100/40 whitespace-nowrap">{log.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Subscriptions */}
        <div className="border border-border dark:border-white/10 rounded-lg bg-surface dark:bg-[#1A2E25] overflow-hidden flex flex-col shadow-sm">
          <div className="px-5 py-4 border-b border-border dark:border-white/10 flex justify-between items-center">
            <h3 className="text-[15px] font-semibold text-green-900 dark:text-white">Derniers Abonnements</h3>
            <button className="text-[13px] font-medium text-green-700 hover:text-green-900 dark:text-green-100/70 dark:hover:text-white transition-colors">Tout voir</button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border dark:border-white/10 text-[11px] text-ink-faint dark:text-green-100/50 uppercase tracking-[0.05em] bg-paper dark:bg-black/10">
                  <th className="px-5 py-3 font-semibold">Entreprise</th>
                  <th className="px-5 py-3 font-semibold">Plan</th>
                  <th className="px-5 py-3 font-semibold text-right">Montant</th>
                  <th className="px-5 py-3 font-semibold text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-white/10">
                {activeSubscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-green-50 dark:hover:bg-white/5 transition-colors text-[13.5px]">
                    <td className="px-5 py-3.5 text-ink dark:text-white font-medium">{sub.business}</td>
                    <td className="px-5 py-3.5 text-ink-muted dark:text-green-100/70">{sub.plan}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-green-900 dark:text-white">{sub.amount}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${
                        sub.status === 'Active' 
                          ? 'bg-green-100 text-green-700 dark:bg-success/20 dark:text-green-100' 
                          : 'bg-clay-100 text-clay-600 dark:bg-error/20 dark:text-red-200'
                      }`}>
                        {sub.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-success"></span>}
                        {sub.status === 'Past Due' && <span className="w-1.5 h-1.5 rounded-full bg-error"></span>}
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
