import React, { useState } from 'react';
import { Calendar, MapPin, Clock, CheckCircle2, XCircle, ChevronRight, Search, Filter } from 'lucide-react';

export default function UserBookingsPage() {
  const [activeTab, setActiveTab] = useState('upcoming');

  const bookings = [
    { 
      id: 1, 
      service: 'Safari Adventure Tour', 
      business: 'WildQuest Kenya', 
      date: 'Oct 12, 2026', 
      time: '08:00 AM',
      status: 'Confirmed',
      location: 'Maasai Mara, Kenya',
      price: '$125.00',
      image: 'https://images.unsplash.com/photo-1547471080-7cb2cb6a5a36?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
      type: 'upcoming'
    },
    { 
      id: 2, 
      service: 'Executive Suite Stay', 
      business: 'Hotel Azura', 
      date: 'Oct 20, 2026', 
      time: '14:00 PM',
      status: 'Pending',
      location: 'Kigali, Rwanda',
      price: '$350.00',
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
      type: 'upcoming'
    },
    { 
      id: 3, 
      service: 'Spa & Wellness Package', 
      business: 'Serenity Spa', 
      date: 'Sep 15, 2026', 
      time: '10:00 AM',
      status: 'Completed',
      location: 'Bujumbura, Burundi',
      price: '$85.00',
      image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
      type: 'past'
    },
    { 
      id: 4, 
      service: 'City Tour Guide', 
      business: 'Kigali Explorers', 
      date: 'Aug 05, 2026', 
      time: '09:00 AM',
      status: 'Cancelled',
      location: 'Kigali, Rwanda',
      price: '$45.00',
      image: 'https://images.unsplash.com/photo-1590422749909-5b79e76162a0?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
      type: 'past'
    }
  ];

  const filteredBookings = bookings.filter(booking => 
    activeTab === 'all' ? true : booking.type === activeTab
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Bookings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your upcoming and past reservations.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search bookings..." 
              className="pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none dark:text-white w-full md:w-64"
            />
          </div>
          <button className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800">
        <button 
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'upcoming' 
              ? 'text-primary dark:text-teal-400' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Upcoming
          {activeTab === 'upcoming' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary dark:bg-teal-400 rounded-t-full"></span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('past')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'past' 
              ? 'text-primary dark:text-teal-400' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Past Bookings
          {activeTab === 'past' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary dark:bg-teal-400 rounded-t-full"></span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('all')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'all' 
              ? 'text-primary dark:text-teal-400' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          All
          {activeTab === 'all' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary dark:bg-teal-400 rounded-t-full"></span>
          )}
        </button>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length > 0 ? (
          filteredBookings.map((booking) => (
            <div key={booking.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-6 group">
              
              {/* Image */}
              <div className="w-full md:w-48 h-48 md:h-auto rounded-lg overflow-hidden shrink-0">
                <img src={booking.image} alt={booking.service} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-primary transition-colors">{booking.service}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{booking.business}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{booking.price}</div>
                    <div className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      booking.status === 'Confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                      booking.status === 'Pending' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      booking.status === 'Completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {booking.status === 'Confirmed' || booking.status === 'Completed' ? <CheckCircle2 className="w-3 h-3" /> : 
                       booking.status === 'Cancelled' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {booking.status}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 mb-6">
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg shrink-0">
                      <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Date & Time</p>
                      <p className="font-medium">{booking.date} at {booking.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg shrink-0">
                      <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Location</p>
                      <p className="font-medium line-clamp-1">{booking.location}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-auto flex flex-wrap gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  {booking.type === 'upcoming' && (
                    <>
                      <button className="px-4 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition">
                        Reschedule
                      </button>
                      <button className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium rounded-lg transition">
                        Cancel
                      </button>
                    </>
                  )}
                  {booking.type === 'past' && booking.status === 'Completed' && (
                    <button className="px-4 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition">
                      Leave a Review
                    </button>
                  )}
                  <button className="px-4 py-2 ml-auto bg-primary hover:bg-secondary text-white text-sm font-medium rounded-lg transition flex items-center gap-2">
                    View Details <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No bookings found</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              You don't have any {activeTab === 'all' ? '' : activeTab} bookings at the moment. Explore services to make your first reservation!
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
