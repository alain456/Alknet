import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, Users, Activity, Clock, CheckCircle, Search, 
  Thermometer, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import hospitalService from '../hospitalService';

const EMPTY_VITALS = {
  blood_pressure: '',
  heart_rate: '',
  temperature: '',
  weight: '',
  height: '',
  oxygen_saturation: '',
  triage_priority: 'NORMAL',
  nurse_notes: '',
};

const QUEUE_STATUSES = new Set(['CONFIRMED', 'PATIENT_ARRIVED', 'WAITING_ROOM', 'PRESENT', 'IN_PROGRESS']);

export default function NurseDashboard() {
  const { authFetch } = useAuth();
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queuePatients, setQueuePatients] = useState([]);
  const [activeTab, setActiveTab] = useState('triage');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal de saisie des constantes vitales (Tension, Pouls, Température, Poids)
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [vitalsForm, setVitalsForm] = useState(EMPTY_VITALS);

  const [stats, setStats] = useState({
    waitingQueue: 0,
    vitalsRecordedToday: 0,
    emergencyCases: 0,
    completedCare: 0
  });

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    try {
      const businesses = await hospitalService.getMyHospital();
      if (Array.isArray(businesses) && businesses.length > 0) {
        const hid = businesses[0].id;
        setHospitalId(hid);
        fetchQueue(hid);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchQueue = async (hid) => {
    try {
      const [queueData, allAppointments] = await Promise.all([
        hospitalService.getQueue(hid).catch(() => []),
        hospitalService.getAppointments({ hospital: hid }).catch(() => []),
      ]);
      const queueList = Array.isArray(queueData) ? queueData : (queueData?.results || []);
      const appointments = Array.isArray(allAppointments) ? allAppointments : (allAppointments?.results || []);
      const triageQueue = queueList.length > 0
        ? queueList
        : appointments.filter((a) => QUEUE_STATUSES.has(a.status));

      setQueuePatients(triageQueue);

      setStats({
        waitingQueue: triageQueue.filter((a) => !a.location_notes?.includes('CONSTANTES')).length,
        vitalsRecordedToday: appointments.filter((a) => a.location_notes?.includes('CONSTANTES')).length,
        emergencyCases: triageQueue.filter((a) => a.reason && a.reason.toLowerCase().includes('urgence')).length,
        completedCare: appointments.filter((a) => a.status === 'COMPLETED').length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVitalsModal = (patient) => {
    setSelectedPatient(patient);
    setVitalsForm({ ...EMPTY_VITALS });
    setIsVitalsModalOpen(true);
  };

  const handleSaveVitals = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;

    try {
      const formattedNotes = `[SOINS INFIRMIERS / CONSTANTES VITALES]
Tension: ${vitalsForm.blood_pressure} mmHg | Pouls: ${vitalsForm.heart_rate} bpm
Température: ${vitalsForm.temperature} °C | SpO2: ${vitalsForm.oxygen_saturation}%
Poids: ${vitalsForm.weight} kg | Taille: ${vitalsForm.height} cm
Priorité: ${vitalsForm.triage_priority}
Notes: ${vitalsForm.nurse_notes}`;

      const res = await authFetch(`/api/v1/hospital/appointments/${selectedPatient.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_notes: formattedNotes,
          status: 'CONFIRMED'
        })
      });

      if (res.ok) {
        setIsVitalsModalOpen(false);
        fetchQueue(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredPatients = queuePatients.filter(p => {
    const pName = (p.patient_name || '').toLowerCase();
    const docName = (p.doctor_name || p.doctor_details?.full_name || '').toLowerCase();
    return pName.includes(searchQuery.toLowerCase()) || docName.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-12">
      {/* En-tête Espace Infirmier */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 to-indigo-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2">
            <HeartPulse className="w-3.5 h-3.5" /> Postes de Soins & Triage Infirmiers
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="text-blue-400" />
            Espace Infirmier & Prise des Constantes
          </h1>
          <p className="text-blue-100 text-sm mt-1">Accueil des patients, enregistrement des paramètres vitaux et suivi gratuit des soins de service.</p>
        </div>
      </div>

      {!hospitalId && !loading && (
        <div className="p-4 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
          Aucun hôpital attribué à ce compte infirmier.
        </div>
      )}

      {hospitalId && (
        <>
          {/* Cartes Statistiques */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">File d'Attente Triage</p>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{stats.waitingQueue}</p>
                </div>
                <div className="w-11 h-11 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Constantes Prises</p>
                  <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{stats.vitalsRecordedToday}</p>
                </div>
                <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Thermometer className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Cas Prioritaires / Urgences</p>
                  <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{stats.emergencyCases}</p>
                </div>
                <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Soins Réalisés</p>
                  <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{stats.completedCare}</p>
                </div>
                <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Recherche & Filtres */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher un patient, médecin traitant..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                Soins de service : Gratuits
              </span>
            </div>
          </div>

          {/* Tableau de la File des Patients */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                File d'Attente & Prise de Paramètres Vitaux
              </h3>
              <span className="text-xs text-gray-400">{filteredPatients.length} patient(s) en attente</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold text-gray-400 uppercase bg-gray-50/50 dark:bg-gray-800/50">
                    <th className="py-3 px-6">Patient</th>
                    <th className="py-3 px-6">Médecin Attribué</th>
                    <th className="py-3 px-6">Motif / Consultation</th>
                    <th className="py-3 px-6">Statut Triage</th>
                    <th className="py-3 px-6 text-right">Action Infirmière</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-400">Chargement des patients...</td>
                    </tr>
                  ) : filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-400">Aucun patient dans la file de triage.</td>
                    </tr>
                  ) : (
                    filteredPatients.map(item => {
                      const hasVitals = item.location_notes && item.location_notes.includes('CONSTANTES');
                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition">
                          <td className="py-3.5 px-6 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-extrabold text-xs">
                              {item.patient_name?.[0] || 'P'}
                            </div>
                            {item.patient_name || 'Patient Inconnu'}
                          </td>
                          <td className="py-3.5 px-6 font-medium text-gray-600 dark:text-gray-300">
                            {item.doctor_name || item.doctor_details?.full_name || 'Médecin Généraliste'}
                          </td>
                          <td className="py-3.5 px-6 text-gray-500 max-w-xs truncate">
                            {item.reason || 'Consultation standard'}
                          </td>
                          <td className="py-3.5 px-6">
                            {hasVitals ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle className="w-3 h-3" /> Constantes Prises
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                <Clock className="w-3 h-3" /> En attente triage
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <button
                              onClick={() => handleOpenVitalsModal(item)}
                              className="px-3 py-1.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition cursor-pointer text-xs inline-flex items-center gap-1"
                            >
                              <Thermometer className="w-3.5 h-3.5" /> 
                              {hasVitals ? 'Modifier constantes' : 'Saisir constantes'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Saisie des Constantes Vitales */}
      {isVitalsModalOpen && selectedPatient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Thermometer className="text-blue-600" />
                Constantes Vitales — {selectedPatient.patient_name}
              </h3>
              <button onClick={() => setIsVitalsModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSaveVitals} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Tension Artérielle (mmHg)</label>
                  <input 
                    type="text" 
                    required 
                    value={vitalsForm.blood_pressure}
                    onChange={e => setVitalsForm({ ...vitalsForm, blood_pressure: e.target.value })}
                    placeholder="ex: 120/80"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Fréquence Cardiaque (bpm)</label>
                  <input 
                    type="number" 
                    required 
                    value={vitalsForm.heart_rate}
                    onChange={e => setVitalsForm({ ...vitalsForm, heart_rate: e.target.value })}
                    placeholder="ex: 75"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Température (°C)</label>
                  <input 
                    type="text" 
                    required 
                    value={vitalsForm.temperature}
                    onChange={e => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                    placeholder="ex: 37.2"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Saturation O2 (%)</label>
                  <input 
                    type="text" 
                    value={vitalsForm.oxygen_saturation}
                    onChange={e => setVitalsForm({ ...vitalsForm, oxygen_saturation: e.target.value })}
                    placeholder="ex: 98"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Poids (Kg)</label>
                  <input 
                    type="text" 
                    value={vitalsForm.weight}
                    onChange={e => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
                    placeholder="ex: 70"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Taille (cm)</label>
                  <input 
                    type="text" 
                    value={vitalsForm.height}
                    onChange={e => setVitalsForm({ ...vitalsForm, height: e.target.value })}
                    placeholder="ex: 175"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Niveau de Priorité Triage</label>
                <select 
                  value={vitalsForm.triage_priority}
                  onChange={e => setVitalsForm({ ...vitalsForm, triage_priority: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="NORMAL">Vert — Normal / Consultation standard</option>
                  <option value="URGENT">Jaune — Urgent / Prioritaire</option>
                  <option value="CRITICAL">Rouge — Urgence Absolue / Réanimation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes Infirmières / Soins effectués</label>
                <textarea 
                  rows={2} 
                  value={vitalsForm.nurse_notes}
                  onChange={e => setVitalsForm({ ...vitalsForm, nurse_notes: e.target.value })}
                  placeholder="Injections, pansements, remarques particulières..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button 
                  type="button" 
                  onClick={() => setIsVitalsModalOpen(false)} 
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer"
                >
                  Enregistrer & Transmettre au Médecin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
