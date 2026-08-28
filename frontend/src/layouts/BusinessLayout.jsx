import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Building2, Users, Calendar, Settings,
  LayoutDashboard, Menu, X, Bell, LogOut, FileText,
  Store, HeartPulse, Stethoscope, Clock, Shield, Sparkles, UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BusinessLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [business, setBusiness] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { token, logout, user, authFetch } = useAuth();

  useEffect(() => {
    if (token) {
      authFetch('http://localhost:8000/api/v1/businesses/me/')
        .then(res => {
          if (res.status === 401) {
            logout();
            navigate('/login');
            return null;
          }
          return res.ok ? res.json() : [];
        })
        .then(data => {
          if (data && data.length > 0) {
            setBusiness(data[0]);
          } else {
            // Fallback for Super Admin or admin without direct ownership
            authFetch('http://localhost:8000/api/v1/businesses/')
              .then(res => res.ok ? res.json() : [])
              .then(allBus => {
                const list = Array.isArray(allBus) ? allBus : (allBus.results || []);
                if (list.length > 0) setBusiness(list[0]);
              });
          }
        })
        .catch(err => console.error(err));
    } else {
      navigate('/login');
    }
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Détection si l'établissement est un Hôpital / Centre de Santé
  const categoryName = (business?.primary_category_name || '').toLowerCase();
  const businessName = (business?.name || '').toLowerCase();
  const isHospital = 
    categoryName.includes('sant') || 
    categoryName.includes('hopital') || 
    categoryName.includes('hospital') || 
    businessName.includes('hopital') || 
    businessName.includes('hospital') || 
    businessName.includes('clinique') || 
    location.pathname.startsWith('/hospital');

  // Menu Propre & Épuré Spécifique aux Hôpitaux
  const hospitalNavGroups = [
    {
      title: "Vue d'ensemble",
      items: [
        { name: 'Tableau de Bord', icon: LayoutDashboard, path: '/hospital/admin' },
      ]
    },
    {
      title: "Gestion Hospitalière",
      items: [
        { name: 'Profil & Équipements', icon: Store, path: '/business/profile' },
        { name: 'Services & Paquets de Soins', icon: HeartPulse, path: '/hospital/admin/services' },
        { name: 'Annuaire des Médecins', icon: Stethoscope, path: '/hospital/admin/doctors' },
        { name: 'Planning & Horaires', icon: Clock, path: '/hospital/admin/schedules' },
      ]
    },
    {
      title: "Activité Clinique & Patientèle",
      items: [
        { name: 'Rendez-vous Médicaux', icon: Calendar, path: '/hospital/admin/appointments' },
        { name: 'Dossiers Médicaux', icon: FileText, path: '/hospital/admin/medical-records' },
        { name: 'Laboratoire', icon: Sparkles, path: '/hospital/admin/lab-results' },
        { name: 'Facturation & Caisse', icon: Building2, path: '/hospital/admin/invoices' },
      ]
    },
    {
      title: "Pilotage & Sécurité",
      items: [
        { name: 'Rapports & Analytics', icon: LayoutDashboard, path: '/hospital/admin/reports' },
        { name: 'Journal d\'Audit & RBAC', icon: Shield, path: '/hospital/admin/audit' },
        { name: 'Gestion du Personnel', icon: Users, path: '/business/employees' },
      ]
    }
  ];

  // Menu Général pour les autres types d'entreprises (Hôtels, Commerces...)
  const genericNavGroups = [
    {
      title: "Principal",
      items: [
        { name: 'Tableau de Bord', icon: LayoutDashboard, path: '/business' },
        { name: 'Profil Entreprise', icon: Store, path: '/business/profile' },
        { name: 'Employés', icon: Users, path: '/business/employees' },
        { name: 'Rôles & Permissions', icon: Shield, path: '/business/roles' },
      ]
    },
    {
      title: "Opérations",
      items: [
        { name: 'Réservations', icon: Calendar, path: '/business/bookings' },
        { name: 'Services', icon: Building2, path: '/business/services' },
      ]
    },
    {
      title: "Système",
      items: [
        { name: 'Paramètres', icon: Settings, path: '/business/settings' },
      ]
    }
  ];

  const activeNavGroups = isHospital ? hospitalNavGroups : genericNavGroups;

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-200">
      
      {/* Overlay Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 xl:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed xl:sticky top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'
        }`}
      >
        {/* En-tête Sidebar avec Nom de l'Hôpital */}
        <div className="h-20 flex flex-col justify-center px-5 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="flex items-center justify-between">
            <Link to="/business" className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-700 to-teal-500 flex items-center justify-center text-white font-black shadow-md shadow-teal-600/20 shrink-0">
                {isHospital ? <HeartPulse className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-sm text-gray-900 dark:text-white truncate block">
                  {business?.name || 'Mon Hôpital'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                  <Sparkles className="w-2.5 h-2.5" />
                  {isHospital ? 'Espace Hôpital' : 'Espace Business'}
                </span>
              </div>
            </Link>
            <button onClick={closeSidebar} className="xl:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Groupes de Navigation */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          {activeNavGroups.map((group, idx) => (
            <div key={idx}>
              <div className="px-3 mb-2 text-[10.5px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/business' && location.pathname.startsWith(item.path));
                  return (
                    <Link 
                      key={item.name} 
                      to={item.path}
                      onClick={closeSidebar}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        isActive 
                          ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30' 
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Pied de Sidebar avec Profil & Déconnexion */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50/30 dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 border border-teal-200 dark:border-teal-800">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'Administrateur'}
              </div>
              <div className="text-[10px] text-gray-400 truncate">
                {user?.email || 'admin@isoko.bi'}
              </div>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-3 py-2 w-full rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-100 dark:border-red-900/30 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Zone de Contenu Principal */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="xl:hidden text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {business?.name || 'Système Hospitalier Isoko Hub'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white transition cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Vues Enfants */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-gray-50/50 dark:bg-gray-950">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
