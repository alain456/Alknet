import React, { useState } from 'react';
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import DataGrid from '../admin/components/DataGrid';

export default function BusinessBookingsPage() {
  const [bookings, setBookings] = useState([
    { id: 'BK-105', customer: 'Alice Johnson', service: 'Consultation', date: '2026-10-15', time: '10:00 AM', status: 'Pending' },
    { id: 'BK-104', customer: 'Marc Dupont', service: 'VIP Suite', date: '2026-10-14', time: '14:00 PM', status: 'Confirmed' },
    { id: 'BK-103', customer: 'Sarah Connor', service: 'Standard Room', date: '2026-10-14', time: '09:00 AM', status: 'Completed' },
    { id: 'BK-102', customer: 'Emma Davis', service: 'Consultation', date: '2026-10-11', time: '11:00 AM', status: 'Cancelled' },
  ]);

  const columns = [
    { 
      key: 'service', 
      label: 'Service / Booking',
      render: (val, row) => (
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">{val}</div>
          <div className="text-xs text-gray-500">ID: {row.id}</div>
        </div>
      )
    },
    { 
      key: 'customer', 
      label: 'Client',
      render: (val) => <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">{val}</span>
    },
    { 
      key: 'date', 
      label: 'Date & Time',
      render: (val, row) => (
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">{val}</div>
          <div className="text-xs text-gray-500">{row.time}</div>
        </div>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (val) => {
        let styles = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
        if (val === 'Confirmed' || val === 'Completed') styles = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        if (val === 'Pending') styles = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
        if (val === 'Cancelled') styles = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${styles}`}>
            {val === 'Confirmed' || val === 'Completed' ? <CheckCircle className="w-3 h-3" /> : val === 'Cancelled' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {val}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Quick Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          {row.status === 'Pending' && (
            <>
              <button className="px-3 py-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium rounded transition">
                Confirm
              </button>
              <button className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded transition">
                Decline
              </button>
            </>
          )}
          {row.status === 'Confirmed' && (
            <button className="px-3 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-medium rounded transition">
              Reschedule
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Bookings & Reservations
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage your schedule and customer appointments.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <DataGrid 
          columns={columns}
          data={bookings}
          searchPlaceholder="Search bookings by client or service..."
          searchableKeys={['customer', 'service', 'id']}
        />
      </div>
    </div>
  );
}
