import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, Users, Calendar, DollarSign, TrendingUp, 
  Stethoscope, Clock, CheckCircle, AlertCircle, Activity 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function HospitalDashboard() {
  const { token , authFetch} = useAuth();
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDoctors: 0,
    totalServices: 0,
    todayAppointments: 0,
    pendingAppointments: 0,
    completedAppointments: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
    totalPatients: 0,
    activeMedicalRecords: 0
  });
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        const busRes = await authFetch('http://localhost:8000/api/v1/businesses/me/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (busRes.ok) {
          const businesses = await busRes.json();
          if (businesses.length > 0) {
            const hid = businesses[0].id;
            setHospitalId(hid);
            fetchDashboardData(hid);
          } else {
            const allBusRes = await authFetch('http://localhost:8000/api/v1/businesses/');
            if (allBusRes.ok) {
              const allBus = await allBusRes.json();
              const list = Array.isArray(allBus) ? allBus : (allBus.results || []);
              if (list.length > 0) {
                const hid = list[0].id;
                setHospitalId(hid);
                fetchDashboardData(hid);
                return;
              }
            }
            setLoading(false);
          }
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    if (token) init();
  }, [token]);

  const fetchDashboardData = async (hid) => {
    try {
      // Récupérer les médecins
      const docsRes = await authFetch(`http://localhost:8000/api/v1/hospital/doctors/?hospital=${hid}`);
      const doctors = docsRes.ok ? await docsRes.json() : [];

      // Récupérer les services
      const svcRes = await authFetch(`http://localhost:8000/api/v1/hospital/services/?hospital=${hid}`);
      const services = svcRes.ok ? await svcRes.json() : [];

      // Récupérer les rendez-vous
      const aptRes = await authFetch(`http://localhost:8000/api/v1/hospital/appointments/?hospital=${hid}`);
      const appointments = aptRes.ok ? await aptRes.json() : [];

      // Récupérer les factures
      const invRes = await authFetch(`http://localhost:8000/api/v1/hospital/invoices/?hospital=${hid}`);
      const invoices = invRes.ok ? await invRes.json() : [];

      // Récupérer les dossiers médicaux
      const recRes = await authFetch(`http://localhost:8000/api/v1/hospital/medical-records/?hospital=${hid}`);
      const records = recRes.ok ? await recRes.json() : [];

      // Calculer les statistiques
      const today = new Date().toDateString();
      const todayApts = appointments.filter(apt => 
        new Date(apt.appointment_date).toDateString() === today
      );

      const totalRevenue = invoices
        .filter(inv => inv.status === 'PAID')
        .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

      const pendingRevenue = invoices
        .filter(inv => inv.status === 'PENDING')
        .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

      setStats({
        totalDoctors: doctors.length,
        totalServices: services.length,
        todayAppointments: todayApts.length,
        pendingAppointments: appointments.filter(apt => apt.status === 'PENDING').length,
        completedAppointments: appointments.filter(apt => apt.status === 'COMPLETED').length,
        totalRevenue,
        pendingRevenue,
        totalPatients: [...new Set(appointments.map(apt => apt.patient))].length,
        activeMedicalRecords: records.length
      });

      setRecentAppointments(appointments.slice(0, 5));
      setRecentInvoices(invoices.slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('fr-FR') + ' BIF';
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color }) => (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (loading) return <div className="p-8">Chargement du dashboard...</div>;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HeartPulse className="text-teal-600" />
          Dashboard Hôpital
        </h1>
        <p className="text-gray-500 text-sm mt-1">Vue d'ensemble de l'activité de votre établissement.</p>
      </div>

      {!hospitalId && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas encore configuré votre hôpital.
        </div>
      )}

      {hospitalId && (
        <>
          {/* Statistiques principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Stethoscope}
              title="Médecins Actifs"
              value={stats.totalDoctors}
              subtitle="Professionnels enregistrés"
              color="bg-blue-100 text-blue-600"
            />
            <StatCard
              icon={Calendar}
              title="Rendez-vous Aujourd'hui"
              value={stats.todayAppointments}
              subtitle={`${stats.pendingAppointments} en attente`}
              color="bg-purple-100 text-purple-600"
            />
            <StatCard
              icon={DollarSign}
              title="Revenu du Mois"
              value={formatCurrency(stats.totalRevenue)}
              subtitle={`${formatCurrency(stats.pendingRevenue)} en attente`}
              color="bg-green-100 text-green-600"
            />
            <StatCard
              icon={Users}
              title="Patients Uniques"
              value={stats.totalPatients}
              subtitle={`${stats.activeMedicalRecords} dossiers médicaux`}
              color="bg-orange-100 text-orange-600"
            />
          </div>

          {/* Statistiques détaillées */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              icon={Activity}
              title="Services Actifs"
              value={stats.totalServices}
              subtitle="Départements opérationnels"
              color="bg-teal-100 text-teal-600"
            />
            <StatCard
              icon={CheckCircle}
              title="Rendez-vous Terminés"
              value={stats.completedAppointments}
              subtitle="Ce mois"
              color="bg-emerald-100 text-emerald-600"
            />
            <StatCard
              icon={Clock}
              title="Taux de Complétion"
              value={stats.totalAppointments > 0 
                ? Math.round((stats.completedAppointments / stats.totalAppointments) * 100) + '%'
                : '0%'}
              subtitle="Des rendez-vous"
              color="bg-indigo-100 text-indigo-600"
            />
          </div>

          {/* Activité récente */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rendez-vous récents */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-600" />
                  Rendez-vous Récents
                </h3>
                <span className="text-xs text-gray-500">5 derniers</span>
              </div>
              <div className="space-y-3">
                {recentAppointments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Aucun rendez-vous récent</p>
                ) : (
                  recentAppointments.map(apt => (
                    <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                          {apt.patient_name?.[0] || 'P'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{apt.patient_name}</p>
                          <p className="text-xs text-gray-500">
                            Dr. {apt.doctor_details?.user_details?.first_name} {apt.doctor_details?.user_details?.last_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          apt.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                          apt.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                          apt.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {apt.status === 'PENDING' ? <Clock className="w-3 h-3" /> :
                           apt.status === 'COMPLETED' ? <CheckCircle className="w-3 h-3" /> :
                           <AlertCircle className="w-3 h-3" />}
                          {apt.status === 'PENDING' ? 'En attente' :
                           apt.status === 'CONFIRMED' ? 'Confirmé' :
                           apt.status === 'COMPLETED' ? 'Terminé' : 'Annulé'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Factures récentes */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-teal-600" />
                  Factures Récentes
                </h3>
                <span className="text-xs text-gray-500">5 dernières</span>
              </div>
              <div className="space-y-3">
                {recentInvoices.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Aucune facture récente</p>
                ) : (
                  recentInvoices.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{inv.patient_name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(inv.issued_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(inv.amount)}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {inv.status === 'PAID' ? <CheckCircle className="w-3 h-3" /> :
                           inv.status === 'PENDING' ? <Clock className="w-3 h-3" /> :
                           <AlertCircle className="w-3 h-3" />}
                          {inv.status === 'PAID' ? 'Payée' :
                           inv.status === 'PENDING' ? 'En attente' : 'Annulée'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="bg-gradient-to-r from-teal-900 to-slate-900 rounded-2xl p-6 text-white">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Actions Rapides
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button className="flex items-center gap-2 bg-white/10 hover:bg white/20 p-3 rounded-xl transition">
                <Calendar className="w-5 h-5" />
                <span className="text-sm font-medium">Nouveau RDV</span>
              </button>
              <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition">
                <Users className="w-5 h-5" />
                <span className="text-sm font-medium">Ajouter Patient</span>
              </button>
              <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-medium">Créer Facture</span>
              </button>
              <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition">
                <Stethoscope className="w-5 h-5" />
                <span className="text-sm font-medium">Gérer Médecins</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
