import React from 'react';
import DataSummaryCard from './components/DataSummaryCard';
import AdminChartCard from './components/AdminChartCard';

export default function AdminDashboardPage() {
  const recentActivity = [
    { id: 1, action: "New Business Registered", target: "TechNova Solutions", user: "system", time: "2 mins ago", status: "success" },
    { id: 2, action: "Subscription Upgraded", target: "Pro Plan (Monthly)", user: "j.doe@example.com", time: "15 mins ago", status: "success" },
    { id: 3, action: "Failed Payment", target: "Invoice #INV-2026-009", user: "billing_system", time: "1 hour ago", status: "error" },
    { id: 4, action: "User Account Locked", target: "Suspicious Activity", user: "security_bot", time: "3 hours ago", status: "warning" },
    { id: 5, action: "Platform Update Deployed", target: "v2.4.1", user: "admin", time: "5 hours ago", status: "info" },
  ];

  const activeSubscriptions = [
    { id: "SUB-001", business: "Global Logistics", plan: "Enterprise", amount: "$499.00", status: "Active", renewed: "Today" },
    { id: "SUB-002", business: "Creative Studio", plan: "Pro", amount: "$99.00", status: "Active", renewed: "Yesterday" },
    { id: "SUB-003", business: "Local Cafe", plan: "Starter", amount: "$29.00", status: "Past Due", renewed: "3 days ago" },
    { id: "SUB-004", business: "Tech Innovators", plan: "Pro", amount: "$99.00", status: "Active", renewed: "Last week" },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">Platform Overview</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Real-time metrics and system health.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
            Download Report
          </button>
          <button className="px-3 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
            View Analytics
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DataSummaryCard 
          title="Total Active Users" 
          value="124,592" 
          trend="up" 
          trendValue="+12.5%" 
        />
        <DataSummaryCard 
          title="Registered Businesses" 
          value="8,405" 
          trend="up" 
          trendValue="+4.1%" 
        />
        <DataSummaryCard 
          title="Monthly Recurring Revenue" 
          value="$842,500" 
          trend="up" 
          trendValue="+8.2%" 
        />
        <DataSummaryCard 
          title="System Error Rate" 
          value="0.012%" 
          trend="down" 
          trendValue="-2.4%" 
          trendLabel="vs last week"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AdminChartCard 
            title="Revenue Growth" 
            subtitle="Monthly recurring revenue over the last 12 months"
          >
            {/* Minimalist fake chart (CSS only) */}
            <div className="absolute inset-x-0 bottom-0 h-32 flex items-end gap-2 p-2">
              {[40, 45, 55, 50, 60, 75, 70, 85, 90, 85, 95, 100].map((h, i) => (
                <div key={i} className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-t-sm hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors relative group" style={{ height: `${h}%` }}>
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black dark:bg-white text-white dark:text-black text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap transition-opacity">
                    ${(h * 8).toFixed(1)}k
                  </div>
                </div>
              ))}
            </div>
          </AdminChartCard>
        </div>
        <div>
          <AdminChartCard 
            title="User Acquisition" 
            subtitle="Traffic sources distribution"
          >
             <div className="absolute inset-0 flex flex-col justify-center gap-3 p-4">
                <div className="w-full">
                  <div className="flex justify-between text-xs mb-1 text-gray-500 dark:text-gray-400"><span>Organic Search</span> <span>55%</span></div>
                  <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-black dark:bg-white w-[55%]"></div>
                  </div>
                </div>
                <div className="w-full">
                  <div className="flex justify-between text-xs mb-1 text-gray-500 dark:text-gray-400"><span>Direct</span> <span>30%</span></div>
                  <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-400 dark:bg-gray-500 w-[30%]"></div>
                  </div>
                </div>
                <div className="w-full">
                  <div className="flex justify-between text-xs mb-1 text-gray-500 dark:text-gray-400"><span>Referral</span> <span>15%</span></div>
                  <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-300 dark:bg-gray-700 w-[15%]"></div>
                  </div>
                </div>
             </div>
          </AdminChartCard>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Activity */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#0a0a0a] overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Recent System Activity</h3>
            <button className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">View All</button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {recentActivity.map((log) => (
              <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  log.status === 'success' ? 'bg-emerald-500' : 
                  log.status === 'error' ? 'bg-red-500' : 
                  log.status === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{log.action}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{log.target} • {log.user}</p>
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap">{log.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Subscriptions */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#0a0a0a] overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Active Subscriptions</h3>
            <button className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">View All</button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800/50 text-xs text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {activeSubscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm">
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{sub.business}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{sub.plan}</td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{sub.amount}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                        sub.status === 'Active' 
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' 
                          : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
                      }`}>
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
