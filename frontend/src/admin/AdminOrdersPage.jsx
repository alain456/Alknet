import React, { useState } from 'react';
import { ShoppingBag, Eye, Search, Filter } from 'lucide-react';
import DataGrid from './components/DataGrid';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([
    { id: 'ORD-9021', customer: 'Alice Johnson', business: 'WildQuest Kenya', amount: 1250.00, date: '2026-10-15', status: 'Pending', type: 'Service' },
    { id: 'ORD-9020', customer: 'Marc Dupont', business: 'TechStore Kigali', amount: 845.00, date: '2026-10-14', status: 'Processing', type: 'Product' },
    { id: 'ORD-9019', customer: 'Sarah Connor', business: 'Serenity Spa', amount: 210.50, date: '2026-10-14', status: 'Completed', type: 'Service' },
    { id: 'ORD-9018', customer: 'John Smith', business: 'TechStore Kigali', amount: 120.00, date: '2026-10-12', status: 'Completed', type: 'Product' },
    { id: 'ORD-9017', customer: 'Emma Davis', business: 'KPMG Advisory', amount: 500.00, date: '2026-10-11', status: 'Cancelled', type: 'Service' },
  ]);

  const columns = [
    { 
      key: 'id', 
      label: 'Order ID',
      render: (val) => <span className="font-semibold text-gray-900 dark:text-white">{val}</span>
    },
    { 
      key: 'customer', 
      label: 'Customer & Vendor',
      render: (val, row) => (
        <div>
          <div className="font-semibold text-gray-900 dark:text-white text-sm">{val}</div>
          <div className="text-xs text-gray-500">to <span className="font-medium text-primary dark:text-teal-400">{row.business}</span></div>
        </div>
      )
    },
    { 
      key: 'date', 
      label: 'Date',
      render: (val) => <span className="text-gray-500 dark:text-gray-400 text-sm">{val}</span>
    },
    { 
      key: 'amount', 
      label: 'Total Value',
      render: (val, row) => (
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">${val.toFixed(2)}</div>
          <div className="text-xs text-gray-500">{row.type}</div>
        </div>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (val) => {
        let styles = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
        if (val === 'Completed') styles = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        if (val === 'Processing') styles = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        if (val === 'Pending') styles = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
        if (val === 'Cancelled') styles = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        
        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles}`}>
            {val}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: () => (
        <button className="p-1.5 text-gray-500 hover:text-primary transition bg-gray-50 hover:bg-primary/10 rounded-md">
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Global Orders Overview
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Monitor all platform transactions across all businesses.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <DataGrid 
          columns={columns}
          data={orders}
          searchPlaceholder="Search global orders by ID, customer, or business..."
          searchableKeys={['id', 'customer', 'business']}
        />
      </div>
    </div>
  );
}
