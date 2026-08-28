import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Users, Clock, Search, Plus, Calendar, Building2, UserPlus, 
  CheckCircle, ArrowRight, ShieldAlert, Phone, Filter, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ReceptionistDashboard() {
  const { token, authFetch } = useAuth();
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal Enregistrement Patient d'Accueil
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [patientForm, setPatientForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    doctor_name: '',
    service_name: 'Consultation Générale',
    reason: 'Consultation sur place'
  });
  const [registerSuccess, setRegisterSuccess] = useState(false);

  useEffect(() => {
    if (token) initData();
  }, [token]);

  const initData = async () => {
    try {
      const busRes = await authFetch('http://localhost:8000/api/v1/businesses/me/');
      if (busRes.ok) {
        const businesses = await busRes.json();
        if (businesses.length > 0) {
          const hid = businesses[0].id;
          setHospitalId(hid);
          fetchAppointments(hid);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchAppointments = async (hid) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/appointments/?hospital=${hid}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (appointmentId) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/appointments/${appointmentId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' })
      });
      if (res.ok) {
        fetchAppointments(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegisterPatient = (e) => {
    e.preventDefault();
    const newAppointment = {
      id: `walkin-${Date.now()}`,
      patient_name: `${patientForm.first_name} ${patientForm.last_name}`,
      doctor_details: { full_name: patientForm.doctor_name || 'Médecin de garde' },
      appointment_date: new Date().toISOString(),
      status: 'CONFIRMED',
      reason: patientForm.reason
    };
    setAppointments([newAppointment, ...appointments]);
    setRegisterSuccess(true);
    setTimeout(() => {
      setIsRegisterModalOpen(false);
      setRegisterSuccess(false);
      setPatientForm({ first_name: '', last_name: '', phone: '', doctor_name: '', service_name: 'Consultation Générale', reason: 'Consultation sur place' });
    }, 1200);
  };

  const filteredAppointments = appointments.filter(a => {
    const nameMatch = (a.patient_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (a.doctor_details?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!nameMatch) return false;
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  const totalExpected = appointments.length;
  const checkedInCount = appointments.filter(a => a.status === 'CONFIRMED').length;
  const pendingCount = appointments.filter(a => a.status === 'PENDING').length;
  const completedCount = appointments.filter(a => a.status === 'COMPLETED').length;

  return (
    <div className="space-y-6 pb-12">
      {/* En-tête Espace Accueil & Admissions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-900 via-emerald-900 to-green-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-200 text-xs font-semibold mb-2">
            <UserCheck className="w-3.5 h-3.5" /> Poste d'Accueil, Recommandations & Admissions
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="text-teal-400" />
            Accueil & File d'Attente de l'Hôpital
          </h1>
          <p className="text-teal-100 text-sm mt-1">Enregistrement des arrivées, orientation des patients et vérification administrative des rendez-vous.</p>
        </div>
        <button 
          onClick={() => setIsRegisterModalOpen(true)}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" /> Nouveau Patient Arrivant
        </button>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Patients Attendus Jour</p>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{totalExpected}</p>
            </div>
            <div className="w-11 h-11 bg-teal-50 dark:bg-teal-950/50 text-teal-600 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Patients Enregistrés / Présents</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{checkedInCount}</p>
            </div>
            <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">En Attente de Validation</p>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</p>
            </div>
            <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Consultations Terminées</p>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{completedCount}</p>
            </div>
            <div className="w-11 h-11 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom de patient ou médecin..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="PENDING">En attente d'arrivée</option>
            <option value="CONFIRMED">Enregistré / Présent</option>
            <option value="COMPLETED">Terminé</option>
          </select>
        </div>
      </div>

      {/* Tableau de la file des admissions */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-600" />
            File d'Attente & Admissions du Jour
          </h3>
          <span className="text-xs text-gray-400">{filteredAppointments.length} résultat(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold text-gray-400 uppercase bg-gray-50/50 dark:bg-gray-800/50">
                <th className="py-3 px-6">Patient</th>
                <th className="py-3 px-6">Médecin / Service</th>
                <th className="py-3 px-6">Motif Administratif</th>
                <th className="py-3 px-6">Statut Présence</th>
                <th className="py-3 px-6 text-right">Orientation & Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {loading ? (
                <tr><td colSpan="5" className="py-8 text-center text-gray-400">Chargement de la file...</td></tr>
              ) : filteredAppointments.length === 0 ? (
                <tr><td colSpan="5" className="py-8 text-center text-gray-400">Aucun patient trouvé.</td></tr>
              ) : (
                filteredAppointments.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition">
                    <td className="py-3.5 px-6 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-extrabold text-xs">
                        {(item.patient_name || 'P')[0]}
                      </div>
                      {item.patient_name || 'Patient sur place'}
                    </td>
                    <td className="py-3.5 px-6 font-medium text-gray-600 dark:text-gray-300">
                      {item.doctor_details?.full_name || 'Médecin Généraliste'}
                    </td>
                    <td className="py-3.5 px-6 text-gray-500 max-w-xs truncate">
                      {item.reason || 'Consultation standard'}
                    </td>
                    <td className="py-3.5 px-6">
                      {item.status === 'CONFIRMED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <UserCheck className="w-3 h-3" /> Présent sur place
                        </span>
                      ) : item.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          <CheckCircle className="w-3 h-3" /> Consultation terminée
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          <Clock className="w-3 h-3" /> Attendu à l'accueil
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {item.status === 'PENDING' ? (
                        <button
                          onClick={() => handleCheckIn(item.id)}
                          className="px-3 py-1.5 rounded-xl font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition cursor-pointer text-xs inline-flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Marquer Présent
                        </button>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">Orienter vers Infirmerie / Cabinet</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'enregistrement rapide patient d'accueil */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-teal-900 text-white">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <UserPlus className="text-teal-300" />
                Enregistrement Rapide d'un Patient Arrivant
              </h3>
              <button onClick={() => setIsRegisterModalOpen(false)} className="text-white/70 hover:text-white text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleRegisterPatient} className="p-6 space-y-4">
              {registerSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> Patient enregistré avec succès et placé dans la file !
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Prénom</label>
                  <input 
                    type="text" required
                    value={patientForm.first_name}
                    onChange={e => setPatientForm({...patientForm, first_name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nom</label>
                  <input 
                    type="text" required
                    value={patientForm.last_name}
                    onChange={e => setPatientForm({...patientForm, last_name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Téléphone de contact</label>
                <input 
                  type="text"
                  value={patientForm.phone}
                  onChange={e => setPatientForm({...patientForm, phone: e.target.value})}
                  placeholder="ex: +257 79 000 000"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Service Demandé</label>
                  <select
                    value={patientForm.service_name}
                    onChange={e => setPatientForm({...patientForm, service_name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Consultation Générale">Consultation Générale</option>
                    <option value="Pédiatrie">Pédiatrie</option>
                    <option value="Cardiologie">Cardiologie</option>
                    <option value="Gynécologie">Gynécologie</option>
                    <option value="Laboratoire / Analyses">Laboratoire / Analyses</option>
                    <option value="Urgences">Urgences 24/7</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Médecin Demandé</label>
                  <input 
                    type="text"
                    value={patientForm.doctor_name}
                    onChange={e => setPatientForm({...patientForm, doctor_name: e.target.value})}
                    placeholder="ex: Brigitte Nahayo (ou Médecin de garde)"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Motif d'Arrivée</label>
                <input 
                  type="text"
                  value={patientForm.reason}
                  onChange={e => setPatientForm({...patientForm, reason: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button 
                  type="button" 
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 rounded-xl"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/30 transition cursor-pointer"
                >
                  Valider l'Arrivée
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
