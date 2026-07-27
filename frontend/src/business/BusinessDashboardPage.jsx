import React from 'react';
import MetricCard from './components/MetricCard';
import ReviewCard from './components/ReviewCard';
import StatCard from '../dashboard/components/StatCard';
import { 
  ShoppingBag, CalendarCheck, FileText, 
  ArrowUpRight, Download, Users, Plus
} from 'lucide-react';

export default function BusinessDashboardPage() {
  return (
    <div className="space-y-8 pb-10">
      
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Business Overview</h1>
          <p className="text-gray-500 dark:text-gray-400">Track your performance and manage your business operations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">
            <Download className="w-4 h-4" /> Export Report
          </button>
          <button className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg font-medium shadow-sm transition cursor-pointer">
            <Plus className="w-4 h-4" /> New Offer
          </button>
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <MetricCard 
          title="Total Revenue" 
          prefix="$"
          value="24,500" 
          trend="15%" 
          trendUp={true} 
          data={[30, 40, 35, 50, 45, 60, 70]}
        />
        <MetricCard 
          title="Store Visitors" 
          value="12.5" 
          suffix="k"
          trend="8%" 
          trendUp={true} 
          data={[60, 55, 65, 75, 70, 85, 90]}
        />
        <MetricCard 
          title="Customer Growth" 
          value="+450" 
          trend="2%" 
          trendUp={false} 
          data={[80, 70, 60, 50, 45, 40, 35]}
        />
      </div>

      {/* Operations Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <StatCard 
          title="Total Orders" 
          value="854" 
          icon={ShoppingBag} 
          trend="24" 
          trendUp={true} 
        />
        <StatCard 
          title="Active Bookings" 
          value="42" 
          icon={CalendarCheck} 
        />
        <StatCard 
          title="Pending Applications" 
          value="15" 
          icon={FileText} 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Main Column */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Latest Reviews */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Latest Reviews</h2>
              <button className="text-sm font-medium text-primary hover:text-secondary dark:text-teal-400 cursor-pointer">
                View all reviews
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReviewCard 
                name="Alice Johnson"
                avatar="https://ui-avatars.com/api/?name=Alice+J&background=f3f4f6&color=374151"
                rating={5}
                date="2 hours ago"
                content="Absolutely amazing service! The team was very professional and delivered exactly what we needed."
                service="Corporate Event Catering"
              />
              <ReviewCard 
                name="Marc Dupont"
                avatar="https://ui-avatars.com/api/?name=Marc+D&background=f3f4f6&color=374151"
                rating={4}
                date="1 day ago"
                content="Very good experience overall. The booking process was smooth, just a minor delay on arrival."
                service="Conference Room Rental"
              />
            </div>
          </div>

          {/* Top Services Table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Top Performing Services</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500 dark:text-gray-400">
                    <th className="px-6 py-3 font-semibold">Service Name</th>
                    <th className="px-6 py-3 font-semibold">Bookings</th>
                    <th className="px-6 py-3 font-semibold">Revenue</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm">VIP Suite Reservation</div>
                      <div className="text-xs text-gray-500">Hospitality</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">145</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">$12,400</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm">Standard Double Room</div>
                      <div className="text-xs text-gray-500">Hospitality</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">320</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">$9,600</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8">
          
          {/* Recent Operations */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Operations</h2>
            <div className="space-y-4">
              {[
                { title: 'New Booking', desc: 'VIP Suite - 2 Nights', time: '10 mins ago', status: 'Pending' },
                { title: 'Order #4092', desc: 'Room Service', time: '1 hour ago', status: 'Completed' },
                { title: 'Application Received', desc: 'For Receptionist role', time: '3 hours ago', status: 'New' },
              ].map((act, i) => (
                <div key={i} className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-4 last:border-0 last:pb-0">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">{act.title}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{act.desc}</p>
                    <span className="text-xs text-gray-400 mt-1 block">{act.time}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                    act.status === 'Completed' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' : 'bg-primary/10 text-primary dark:bg-teal-900/30 dark:text-teal-400'
                  }`}>
                    {act.status}
                  </span>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2 text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 dark:bg-teal-900/10 dark:hover:bg-teal-900/30 rounded-lg transition cursor-pointer">
              View All Operations
            </button>
          </div>

        </div>
      </div>
      
    </div>
  );
}
