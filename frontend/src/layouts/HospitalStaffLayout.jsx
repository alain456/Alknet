import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, FileText, Users,
  Settings, Menu, X, LogOut, Stethoscope, Bell, HeartPulse, UserCheck, Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccessZone, ZONE_ACCESS, getStaffNavItems, getStaffHomePath, isReceptionist } from '../auth/roleAccess';
import hospitalService from '../hospital/hospitalService';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

export default function HospitalStaffLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [staffNotifications, setStaffNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, getRedirectPath, authFetch } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Détection du rôle/espace actuel à partir de l'URL
  const isReception = location.pathname.includes('/receptionist');
  const isDoctor = location.pathname.includes('/doctor');
  const isNurse = location.pathname.includes('/nurse');
  const isLab = location.pathname.includes('/lab-technician');
  const isCashier = location.pathname.includes('/cashier');

  let spaceTitle = "Espace Médecin";
  if (isReception) spaceTitle = "Accueil & Admissions";
  if (isNurse) spaceTitle = "Espace Infirmier";
  if (isLab) spaceTitle = "Espace Laboratoire";
  if (isCashier) spaceTitle = "Espace Caisse";

  const navItems = getStaffNavItems(user).map((item) => ({
    name: item.name,
    icon: item.key === 'receptionist' ? UserCheck : item.key === 'doctor' ? Stethoscope : item.key === 'nurse' ? HeartPulse : item.key === 'lab' ? FileText : Calendar,
    path: item.path,
  }));

  useEffect(() => {
    const loadNotifications = async () => {
      if (!user) return;
      setNotificationsLoading(true);
      try {
        const data = await hospitalService.getNotifications();
        const list = normalizeList(data).slice(0, 20).map((n) => ({
          id: n.id,
          title: n.title,
          desc: n.message,
          time: n.created_at
            ? new Date(n.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : '',
          isRead: n.is_read,
        }));
        setStaffNotifications(list);
      } catch {
        setStaffNotifications([]);
      } finally {
        setNotificationsLoading(false);
      }
    };
    loadNotifications();
  }, [user]);

  useEffect(() => {
    if (!user || !authFetch) return;
    authFetch('/api/v1/businesses/me/')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const biz = Array.isArray(data) && data[0] ? data[0] : null;
        setSubscriptionBlocked(Boolean(biz?.subscription?.is_blocked));
      })
      .catch(() => setSubscriptionBlocked(false));
  }, [user, authFetch]);

  const closeSidebar = () => setIsSidebarOpen(false);

  if (user && isReceptionist(user) && !isReception) {
    return <Navigate to={getStaffHomePath(user)} replace />;
  }

  if (user && !canAccessZone(user, ZONE_ACCESS.hospitalStaff)) {
    return <Navigate to={getRedirectPath(user)} replace />;
  }

  if (subscriptionBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
        <div className="max-w-md text-center space-y-4 border border-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-xl p-6">
          <p className="font-semibold text-amber-950 dark:text-amber-100">
            Abonnement Isoko Hub inactif
          </p>
          <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
            Les opérations de cet établissement sont suspendues. Contactez l&apos;administrateur
            de l&apos;hôpital pour renouveler l&apos;abonnement plateforme.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold"
          >
            Déconnexion
          </button>
        </div>
      </div>
    );
  }

  const isAdminOrOwner = user?.role === 'BUSINESS_OWNER';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-200">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          {/* Logo / Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <Link to={location.pathname} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-teal-600/20">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-bold text-gray-900 dark:text-white text-sm truncate">{spaceTitle}</h1>
                <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">Portail Hôpital Isoko</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="px-3 mb-2 text-[10.5px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Postes Hospitaliers
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeSidebar}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-xs font-semibold ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom Navigation */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
            {isAdminOrOwner && (
              <Link
                to="/hospital/dashboard"
                onClick={closeSidebar}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="truncate">Admin Hôpital</span>
              </Link>
            )}

            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                showNotifications 
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>Notifications</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
            </button>
          </div>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-teal-100 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 rounded-full flex items-center justify-center shrink-0">
                <span className="font-bold text-teal-700 dark:text-teal-300 text-xs">
                  {(user?.first_name?.[0] || 'U').toUpperCase()}{(user?.last_name?.[0] || '').toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs text-gray-900 dark:text-white truncate">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'Agent Hospitalier'}
                </p>
                <p className="text-[10px] text-gray-400 truncate">
                  {user?.email || 'personnel@isoko.bi'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors text-xs font-bold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile & Desktop Top Bar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse"></span>
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                {spaceTitle} — Portails Médicaux Isoko
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white transition cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Modal / Drawer des Notifications Hospitalières */}
        {showNotifications && (
          <div className="absolute top-16 right-4 sm:right-8 z-50 w-80 sm:w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-4 bg-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <h3 className="font-bold text-xs uppercase tracking-wider">Alertes Hospitalières</h3>
              </div>
              <button 
                onClick={() => setShowNotifications(false)}
                className="text-teal-200 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {notificationsLoading ? (
                <div className="p-6 text-center text-xs text-gray-500">Chargement...</div>
              ) : staffNotifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">Aucune notification pour le moment.</div>
              ) : (
                staffNotifications.map((n) => (
                  <div key={n.id} className={`p-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition ${n.isRead ? 'opacity-70' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-gray-900 dark:text-white">{n.title}</span>
                      <span className="text-[10px] text-gray-400 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {n.time}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{n.desc}</p>
                  </div>
                ))
              )}
            </div>
            <div className="p-2.5 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 text-center">
              <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                Notifications depuis la base de données
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
