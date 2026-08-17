import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Calendar, ShoppingBag, MessageSquare, Heart, 
  MapPin, Star, ArrowRight, CheckCircle2, Clock,
  Compass
} from 'lucide-react';

export default function UserDashboardPage() {
  const { user } = useAuth();
  const firstName = user?.first_name || user?.email?.split('@')[0] || 'Guest';

  const stats = [
    { label: 'Active Bookings', value: '2', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Pending Orders', value: '1', icon: ShoppingBag, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    { label: 'Unread Messages', value: '4', icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    { label: 'Favorites', value: '12', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  ];

  const upcomingBookings = [
    { 
      id: 1, 
      service: 'Safari Adventure Tour', 
      business: 'WildQuest Kenya', 
      date: 'Oct 12, 2026', 
      time: '08:00 AM',
      status: 'Confirmed',
      location: 'Maasai Mara, Kenya'
    },
    { 
      id: 2, 
      service: 'Executive Suite Stay', 
      business: 'Hotel Azura', 
      date: 'Oct 20, 2026', 
      time: '14:00 PM',
      status: 'Pending',
      location: 'Kigali, Rwanda'
    }
  ];

  const recommendedServices = [
    { id: 1, title: 'Luxury Spa Retreat', business: 'Serenity Spa', rating: 4.9, reviews: 124, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
    { id: 2, title: 'Culinary Masterclass', business: 'Chef Antoine', rating: 4.8, reviews: 89, image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
    { id: 3, title: 'Business Consulting', business: 'KPMG Advisory', rating: 4.7, reviews: 56, image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
    { id: 4, title: 'Interior Design Pro', business: 'Studio Elegance', rating: 4.9, reviews: 210, image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Welcome Banner */}
      <div className="relative rounded-2xl bg-primary dark:bg-gray-900 overflow-hidden shadow-lg border border-primary/20">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full mix-blend-overlay filter blur-3xl translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/20 rounded-full mix-blend-overlay filter blur-3xl -translate-x-1/3 translate-y-1/3"></div>
        
        <div className="relative z-10 px-8 py-10 md:py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-white text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
              Welcome back, {firstName}!
            </h1>
            <p className="text-teal-100 text-lg max-w-xl">
              Discover new opportunities, manage your bookings, and explore premium services on Isoko Hub.
            </p>
          </div>
          <div className="shrink-0">
            <Link 
              to="/services"
              className="inline-flex items-center gap-2 bg-accent hover:bg-yellow-400 text-gray-900 font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Compass className="w-5 h-5" />
              Explore Services
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} strokeWidth={1.5} />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</h3>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout for Bookings & Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Upcoming Bookings (Takes 2/3 space on large screens) */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upcoming Bookings</h2>
            <Link to="/dashboard/bookings" className="text-sm font-semibold text-primary hover:text-secondary dark:text-teal-400 flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingBookings.map((booking) => (
              <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm group hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1 line-clamp-1">{booking.service}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                      {booking.business}
                    </p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    booking.status === 'Confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  }`}>
                    {booking.status === 'Confirmed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {booking.status}
                  </div>
                </div>
                
                <div className="space-y-2 mb-5">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{booking.date} at {booking.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="line-clamp-1">{booking.location}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-auto">
                  <button className="flex-1 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-2 rounded-lg text-sm transition">
                    Reschedule
                  </button>
                  <button className="flex-1 bg-primary hover:bg-secondary text-white font-medium py-2 rounded-lg text-sm transition">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions / Recent Activity (Takes 1/3 space) */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quick Actions</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group cursor-pointer text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-teal-50 dark:bg-teal-900/30 text-primary dark:text-teal-400">
                  <Compass className="w-5 h-5" />
                </div>
                <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-primary transition-colors">Find a Professional</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors translate-x-0 group-hover:translate-x-1" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group cursor-pointer text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-orange-600 transition-colors">Browse Marketplace</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-orange-600 transition-colors translate-x-0 group-hover:translate-x-1" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group cursor-pointer text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-purple-600 transition-colors">Contact Support</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors translate-x-0 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Recommended Services */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recommended For You</h2>
          <Link to="/services" className="text-sm font-semibold text-primary hover:text-secondary dark:text-teal-400 flex items-center gap-1">
            Browse Catalog <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {recommendedServices.map((service) => (
            <Link key={service.id} to={`/services/${service.id}`} className="group bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 block">
              <div className="h-40 relative overflow-hidden">
                <img 
                  src={service.image} 
                  alt={service.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute top-2 right-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1 text-xs font-bold text-gray-900 dark:text-white">
                  <Star className="w-3 h-3 text-accent fill-accent" />
                  {service.rating}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-1 group-hover:text-primary transition-colors line-clamp-1">{service.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-2">{service.business}</p>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {service.reviews} reviews
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Bottom padding for scrolling */}
      <div className="h-6"></div>
    </div>
  );
}
