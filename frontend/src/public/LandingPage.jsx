import React, { useState, useEffect } from 'react';
import { Search, Briefcase, MapPin, Star, Building2, Store, Stethoscope, Laptop, HardHat, Sprout, Car, GraduationCap, Heart, Gavel, ShoppingBag, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  const [businesses, setBusinesses] = useState([]);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [businessesRes, servicesRes, categoriesRes] = await Promise.all([
          fetch('http://localhost:8000/api/v1/businesses/'),
          fetch('http://localhost:8000/api/v1/services/'),
          fetch('http://localhost:8000/api/v1/business-categories/')
        ]);
        
        if (businessesRes.ok) {
          const bData = await businessesRes.json();
          setBusinesses(bData.slice(0, 3)); // Top 3
        }
        
        if (servicesRes.ok) {
          const sData = await servicesRes.json();
          setServices(sData.slice(0, 4)); // Popular 4
        }

        if (categoriesRes.ok) {
          const cData = await categoriesRes.json();
          setCategories(cData.slice(0, 12)); // Top 12 categories
        }
      } catch (error) {
        console.error('Error fetching landing data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  return (
    <div className="w-full">
      {/* 1. Hero Section & 2. Smart Search */}
      <section className="bg-gradient-to-br from-primary to-secondary py-20 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Everything you need,<br />in one platform.
          </h1>
          <p className="text-lg md:text-xl text-teal-50 mb-10 max-w-2xl mx-auto">
            Find trusted professionals, book services, order from the best businesses, and discover new opportunities in Burundi.
          </p>
          
          <div className="flex justify-center gap-4 mb-12">
            <button className="bg-accent hover:bg-yellow-400 text-gray-900 font-semibold py-3 px-8 rounded-lg shadow-lg transition transform hover:-translate-y-1">
              Get Started
            </button>
            <button className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-semibold py-3 px-8 rounded-lg transition backdrop-blur-sm">
              Explore Services
            </button>
          </div>

          <div className="bg-white p-2 rounded-full shadow-2xl flex max-w-3xl mx-auto items-center">
            <div className="flex-1 flex items-center px-4 border-r border-gray-200">
              <Search className="text-gray-400 w-5 h-5 mr-2" />
              <input type="text" placeholder="Profession, Business, Restaurant, Product..." className="w-full py-3 outline-none text-gray-700" />
            </div>
            <div className="w-1/3 flex items-center px-4">
              <MapPin className="text-gray-400 w-5 h-5 mr-2" />
              <input type="text" placeholder="Location" className="w-full py-3 outline-none text-gray-700" />
            </div>
            <button className="bg-primary hover:bg-secondary text-white font-semibold py-3 px-8 rounded-full transition">
              Search
            </button>
          </div>
        </div>
      </section>

      {/* 3. Categories */}
      <section className="py-20 px-4 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Explore Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {categories.length > 0 ? (
            categories.map((cat) => {
              // Map common category names to icons, fallback to Briefcase
              const iconMap = {
                'IT': Laptop, 'Technology': Laptop, 'Informatique': Laptop,
                'Health': Stethoscope, 'Santé': Stethoscope,
                'Construction': HardHat, 'Bâtiment': HardHat,
                'Agriculture': Sprout, 'Agroalimentaire': Sprout,
                'Restaurants': Store, 'Restauration': Store,
                'Hotels': Building2, 'Hôtellerie': Building2,
                'Transport': Car, 'Logistique': Car,
                'Education': GraduationCap, 'Enseignement': GraduationCap,
                'Beauty': Heart, 'Beauté': Heart,
                'Legal': Gavel, 'Droit': Gavel,
                'Shopping': ShoppingBag, 'Commerce': ShoppingBag
              };
              // Match by partial name or use default
              const IconComp = Object.entries(iconMap).find(([key]) => cat.name.toLowerCase().includes(key.toLowerCase()))?.[1] || Briefcase;
              
              return (
                <div key={cat.id} className="flex flex-col items-center p-6 border border-gray-100 rounded-2xl hover:shadow-lg hover:border-primary/20 transition cursor-pointer bg-white group">
                  <IconComp className="w-8 h-8 text-gray-400 group-hover:text-primary mb-3 transition" />
                  <span className="font-medium text-gray-700 group-hover:text-primary text-center leading-tight">{cat.name}</span>
                </div>
              );
            })
          ) : (
            // Skeleton loader if categories not loaded yet
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col items-center p-6 border border-gray-100 rounded-2xl bg-white animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 4. Featured Professionals */}
      <section className="py-20 px-4 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-10">
            <h2 className="text-3xl font-bold text-gray-900">Featured Professionals</h2>
            <button className="text-primary font-semibold hover:underline">View All</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition">
                <div className="h-32 bg-gradient-to-r from-gray-200 to-gray-300"></div>
                <div className="px-6 pb-6 relative">
                  <div className="w-16 h-16 rounded-full bg-primary border-4 border-white absolute -top-8 flex items-center justify-center text-white font-bold text-xl shadow-sm">
                    {String.fromCharCode(64 + i)}
                  </div>
                  <div className="pt-10">
                    <h3 className="font-bold text-lg text-gray-900">Professional Name</h3>
                    <p className="text-sm text-gray-500 mb-2">Software Engineer</p>
                    <div className="flex items-center text-sm text-gray-600 mb-4">
                      <Star className="w-4 h-4 text-accent fill-accent mr-1" />
                      4.9 (120 reviews) • Bujumbura
                    </div>
                    <button className="w-full border border-gray-200 hover:border-primary text-gray-700 hover:text-primary font-medium py-2 rounded-lg transition">
                      View Profile
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Featured Businesses */}
      <section className="py-20 px-4 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-10">
          <h2 className="text-3xl font-bold text-gray-900">Top Businesses</h2>
          <button className="text-primary font-semibold hover:underline">View All</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="flex p-4 border border-gray-100 rounded-2xl animate-pulse">
                <div className="w-20 h-20 bg-gray-200 rounded-xl mr-4"></div>
                <div className="flex-1 space-y-2 py-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))
          ) : businesses.length > 0 ? (
            businesses.map((business) => (
              <div key={business.id} className="flex p-4 border border-gray-100 rounded-2xl hover:shadow-lg transition cursor-pointer">
                <div className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0 mr-4 flex items-center justify-center">
                  <Building2 className="text-gray-400 w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">{business.name}</h3>
                  <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full mb-2 inline-block">Business</span>
                  <div className="flex items-center text-sm text-gray-500">
                    <Star className="w-4 h-4 text-accent fill-accent mr-1" /> 4.8 • {business.address || 'Burundi'}
                  </div>
                </div>
              </div>
            ))
          ) : (
            [1, 2, 3].map((i) => (
              <div key={i} className="flex p-4 border border-gray-100 rounded-2xl hover:shadow-lg transition cursor-pointer">
                <div className="w-20 h-20 bg-gray-100 rounded-xl shrink-0 mr-4 flex items-center justify-center">
                  <Building2 className="text-gray-400 w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">Demo Business {i}</h3>
                  <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full mb-2 inline-block">Demo</span>
                  <div className="flex items-center text-sm text-gray-500">
                    <Star className="w-4 h-4 text-accent fill-accent mr-1" /> 5.0 • Bujumbura
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 6. Popular Services */}
      <section className="py-20 px-4 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-10">
            <h2 className="text-3xl font-bold text-gray-900">Popular Services</h2>
            <button className="text-primary font-semibold hover:underline">View All</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
                  <div className="h-40 bg-gray-200 rounded-xl mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>
              ))
            ) : services.length > 0 ? (
              services.map((service) => (
                <div key={service.id} className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition border border-gray-50">
                  <div className="h-40 bg-gray-100 rounded-xl mb-4 flex items-center justify-center">
                    <Briefcase className="w-10 h-10 text-gray-300" />
                  </div>
                  <div className="text-xs font-bold text-primary tracking-wider uppercase mb-1">Service</div>
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{service.name}</h3>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                    <span className="text-sm text-gray-500 flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">{service.name.charAt(0)}</div> Provider</span>
                    <span className="font-bold text-gray-900">${service.price}</span>
                  </div>
                </div>
              ))
            ) : (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition border border-gray-50">
                  <div className="h-40 bg-gray-100 rounded-xl mb-4 flex items-center justify-center">
                    <Briefcase className="w-10 h-10 text-gray-300" />
                  </div>
                  <div className="text-xs font-bold text-primary tracking-wider uppercase mb-1">Demo Service</div>
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">Example Service {i}</h3>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                    <span className="text-sm text-gray-500 flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">D</div> Demo Provider</span>
                    <span className="font-bold text-gray-900">From $100</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 7. Why Isoko Hub? */}
      <section className="py-24 px-4 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-16">Why choose Isoko Hub?</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg mb-2">Verified Professionals</h3>
            <p className="text-gray-500">Every service provider is vetted for quality and reliability.</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg mb-2">Secure Payments</h3>
            <p className="text-gray-500">Your funds are protected until the service is delivered.</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
              <Briefcase className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg mb-2">Trusted Businesses</h3>
            <p className="text-gray-500">Find the best local businesses rated by the community.</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
              <Laptop className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg mb-2">AI Recommendations</h3>
            <p className="text-gray-500">Our smart algorithm finds exactly what you're looking for.</p>
          </div>
        </div>
      </section>

      {/* 9. Mobile App */}
      <section className="py-20 px-4 bg-primary text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold mb-6">Take Isoko Hub everywhere</h2>
          <p className="text-teal-100 text-lg mb-8">The official Isoko Hub mobile app is currently under development.</p>
          <div className="inline-block border-2 border-white/20 rounded-full px-8 py-3 font-semibold tracking-wide text-white bg-white/5 backdrop-blur-md">
            COMING SOON
          </div>
        </div>
      </section>

    </div>
  );
}
