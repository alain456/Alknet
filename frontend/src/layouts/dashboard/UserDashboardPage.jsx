import React from 'react';
import StatCard from './components/StatCard';
import ServiceCard from './components/ServiceCard';
import { 
  TrendingUp, Users, CalendarCheck, Wallet, 
  Search, Plus, MapPin, Building2, ChevronRight, Clock, MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function UserDashboardPage() {
  return (
    <div className="space-y-8 pb-10">
      
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back, John! 👋</h1>
          <p className="text-gray-500 dark:text-gray-400">Here is what's happening with your account today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">
            <Search className="w-4 h-4" /> Find Service
          </button>
          <button className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg font-medium shadow-sm transition cursor-pointer">
            <Plus className="w-4 h-4" /> Post a Request
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
          title="Total Spending" 
          value="$1,240.50" 
          icon={Wallet} 
          trend="12%" 
          trendUp={true} 
        />
        <StatCard 
          title="Active Bookings" 
          value="3" 
          icon={CalendarCheck} 
        />
        <StatCard 
          title="Profile Views" 
          value="842" 
          icon={Users} 
          trend="4%" 
          trendUp={true} 
        />
        <StatCard 
          title="Engagement Rate" 
          value="4.8%" 
          icon={TrendingUp} 
          trend="1.2%" 
          trendUp={false} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Trending Services */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Trending Services</h2>
              <Link to="/dashboard/explore" className="text-sm font-medium text-primary hover:text-secondary dark:text-teal-400 flex items-center">
                View all <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ServiceCard 
                title="Professional Web Development"
                provider="AlkNet Tech Solutions"
                rating="4.9"
                reviews="128"
                price="$500"
                category="IT & Tech"
                imagePlaceholder="bg-gradient-to-r from-blue-500 to-cyan-400"
              />
              <ServiceCard 
                title="Graphic Design & Branding"
                provider="Creative Studio"
                rating="4.8"
                reviews="85"
                price="$150"
                category="Design"
                imagePlaceholder="bg-gradient-to-r from-purple-500 to-pink-500"
              />
            </div>
          </div>

          {/* Nearby Businesses */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nearby Businesses</h2>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              {[
                { name: 'Hotel Club du Lac', cat: 'Hospitality', loc: 'Bujumbura', dist: '2.4 km' },
                { name: 'Gitega Tech Hub', cat: 'IT Center', loc: 'Gitega', dist: '1.2 km' },
                { name: 'Organic Farm Nduwimana', cat: 'Agriculture', loc: 'Ngozi', dist: '4.8 km' }
              ].map((biz, idx) => (
                <div key={idx} className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mr-4 shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{biz.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{biz.cat}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <MapPin className="w-3 h-3 mr-1" /> {biz.loc}
                    </div>
                    <span className="text-xs font-semibold text-primary dark:text-teal-400">{biz.dist}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8">
          
          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
              <div className="space-y-6">
                {[
                  { title: 'Payment successful', desc: 'Paid $150 to Creative Studio', time: '2 hours ago', icon: Wallet, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
                  { title: 'Booking confirmed', desc: 'Consultation with AlkNet Tech', time: 'Yesterday', icon: CalendarCheck, color: 'text-primary', bg: 'bg-primary/10 dark:bg-teal-900/30' },
                  { title: 'New message', desc: 'From John (Web Developer)', time: '2 days ago', icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
                ].map((act, i) => (
                  <div key={i} className="flex relative">
                    {i !== 2 && <div className="absolute top-10 left-4 -bottom-6 w-0.5 bg-gray-200 dark:bg-gray-800"></div>}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${act.bg} ${act.color} mr-4`}>
                      <act.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">{act.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{act.desc}</p>
                      <div className="flex items-center text-xs text-gray-400 mt-1.5">
                        <Clock className="w-3 h-3 mr-1" /> {act.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition cursor-pointer">
                View all activity
              </button>
            </div>
          </div>

          {/* Upgrade Banner */}
          <div className="bg-linear-to-br from-primary to-secondary rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/3"></div>
            <h3 className="font-bold text-lg mb-2 relative z-10">Upgrade to Pro</h3>
            <p className="text-teal-100 text-sm mb-4 relative z-10">Get more visibility and priority support for your business.</p>
            <button className="bg-accent hover:bg-yellow-400 text-gray-900 text-sm font-semibold py-2 px-4 rounded-lg shadow-sm transition relative z-10 w-full cursor-pointer">
              View Plans
            </button>
          </div>

        </div>
      </div>
      
    </div>
  );
}
