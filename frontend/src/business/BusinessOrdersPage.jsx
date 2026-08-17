import React, { useState } from 'react';
import { ShoppingBag, Eye, MoreVertical } from 'lucide-react';
import DataGrid from '../admin/components/DataGrid';

export default function BusinessOrdersPage() {
  const [orders, setOrders] = useState([
    { id: 'ORD-2091', customer: 'Alice Johnson', amount: 125.00, items: 3, date: '2026-10-15', status: 'Pending' },
    { id: 'ORD-2090', customer: 'Marc Dupont', amount: 45.00, items: 1, date: '2026-10-14', status: 'Processing' },
    { id: 'ORD-2089', customer: 'Sarah Connor', amount: 210.50, items: 5, date: '2026-10-14', status: 'Completed' },
    { id: 'ORD-2088', customer: 'John Smith', amount: 89.99, items: 2, date: '2026-10-12', status: 'Completed' },
    { id: 'ORD-2087', customer: 'Emma Davis', amount: 15.00, items: 1, date: '2026-10-11', status: 'Cancelled' },
  ]);

  const columns = [
    { 
      key: 'id', 
      label: 'Order ID',
      render: (val) => <span className="font-semibold text-gray-900 dark:text-white">{val}</span>
    },
    { 
      key: 'customer', 
      label: 'Customer',
      render: (val) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
            {val.charAt(0)}
          </div>
          <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">{val}</span>
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
      label: 'Amount',
      render: (val, row) => (
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">${val.toFixed(2)}</div>
          <div className="text-xs text-gray-500">{row.items} item(s)</div>
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
        <div className="flex items-center gap-2">
          <button className="p-1.5 text-gray-500 hover:text-primary transition bg-gray-50 hover:bg-primary/10 rounded-md">
            <Eye className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-500 hover:text-gray-700 transition">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Orders Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Track, manage and fulfill customer orders.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <DataGrid 
          columns={columns}
          data={orders}
          searchPlaceholder="Search orders by ID or customer..."
          searchableKeys={['id', 'customer']}
        />
      </div>
    </div>
  );
}
