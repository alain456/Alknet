import React, { useState } from 'react';
import { CreditCard, ArrowUpRight, ArrowDownRight, DollarSign, Activity } from 'lucide-react';
import DataGrid from './components/DataGrid';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([
    { id: 'TXN-001', order: 'ORD-9021', vendor: 'WildQuest Kenya', total: 1250.00, fee: 125.00, net: 1125.00, date: '2026-10-15', status: 'Settled' },
    { id: 'TXN-002', order: 'ORD-9020', vendor: 'TechStore Kigali', total: 845.00, fee: 42.25, net: 802.75, date: '2026-10-14', status: 'Pending' },
    { id: 'TXN-003', order: 'ORD-9019', vendor: 'Serenity Spa', total: 210.50, fee: 21.05, net: 189.45, date: '2026-10-14', status: 'Settled' },
    { id: 'TXN-004', order: 'ORD-9018', vendor: 'TechStore Kigali', total: 120.00, fee: 6.00, net: 114.00, date: '2026-10-12', status: 'Settled' },
  ]);

  const columns = [
    { 
      key: 'id', 
      label: 'Transaction',
      render: (val, row) => (
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">{val}</div>
          <div className="text-xs text-gray-500">Ref: {row.order}</div>
        </div>
      )
    },
    { 
      key: 'vendor', 
      label: 'Vendor',
      render: (val) => <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">{val}</span>
    },
    { 
      key: 'total', 
      label: 'Gross Volume',
      render: (val) => <span className="font-medium text-gray-900 dark:text-white">${val.toFixed(2)}</span>
    },
    { 
      key: 'fee', 
      label: 'Platform Fee',
      render: (val) => <span className="font-semibold text-green-600 dark:text-green-400">+${val.toFixed(2)}</span>
    },
    { 
      key: 'net', 
      label: 'Vendor Payout',
      render: (val) => <span className="text-gray-600 dark:text-gray-400">-${val.toFixed(2)}</span>
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
          val === 'Settled' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
        }`}>
          {val}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Financial Operations
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Monitor platform revenue, commissions, and vendor payouts.</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-green-600">
              <ArrowUpRight className="w-4 h-4" /> 12%
            </span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">$45,231</h3>
          <p className="text-sm font-medium text-gray-500">Gross Processed Volume</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-10 -mt-10"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-teal-900/30 flex items-center justify-center text-primary dark:text-teal-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-green-600">
              <ArrowUpRight className="w-4 h-4" /> 8%
            </span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1 relative z-10">$3,420</h3>
          <p className="text-sm font-medium text-gray-500 relative z-10">Platform Revenue (Fees)</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-orange-600">
              <ArrowDownRight className="w-4 h-4" /> 2%
            </span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">$845.00</h3>
          <p className="text-sm font-medium text-gray-500">Pending Payouts</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <DataGrid 
          columns={columns}
          data={payments}
          searchPlaceholder="Search transactions by ID or vendor..."
          searchableKeys={['id', 'vendor', 'order']}
        />
      </div>
    </div>
  );
}
