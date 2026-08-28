import React, { useState, useEffect } from 'react';
import { Stethoscope, Users, Calendar, FileText, Clock, CheckCircle, AlertCircle, Search, Plus, Video, MapPin, Pill, User as UserIcon, Globe, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function DoctorDashboard() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('appointments');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingAppointments: 0,
    totalPatients: 0,
    completedAppointments: 0,
    activePrescriptions: 0
  });

  const [prescriptionForm, setPrescriptionForm] = useState({
    prescription_type: 'MEDICATION',
    medication_name: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
    exam_name: '',
    exam_reason: '',
    patient_id: ''
  });

  useEffect(() => {
    const init = async () => {
      try {
        const busRes = await fetch('http://localhost:8000/api/v1/businesses/me/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (busRes.ok) {
          const businesses = await busRes.json();
          if (businesses.length > 0) {
            const hid = businesses[0].id;
            setHospitalId(hid);
            fetchAppointments(hid);
            fetchMedicalRecords(hid);
            fetchPrescriptions(hid);
          } else {
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

  const fetchAppointments = async (hid) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/appointments/?hospital=${hid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
        
        const today = new Date().toISOString().split('T')[0];
        setStats(prev => ({
          ...prev,
          todayAppointments: data.filter(a => a.appointment_date === today).length,
          pendingAppointments: data.filter(a => a.status === 'PENDING').length,
          completedAppointments: data.filter(a => a.status === 'COMPLETED').length
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicalRecords = async (hid) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/medical-records/?hospital=${hid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMedicalRecords(data);
        setStats(prev => ({
          ...prev,
          totalPatients: new Set(data.map(r => r.patient)).size
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPrescriptions = async (hid) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/prescriptions/?hospital=${hid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPrescriptions(data);
        setStats(prev => ({
          ...prev,
          activePrescriptions: data.filter(p => p.is_active).length
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePrescription = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/v1/hospital/prescriptions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...prescriptionForm,
          hospital: hospitalId
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setPrescriptionForm({
          prescription_type: 'MEDICATION',
          medication_name: '',
          dosage: '',
          frequency: '',
          duration: '',
          instructions: '',
          exam_name: '',
          exam_reason: '',
          patient_id: ''
        });
        fetchPrescriptions(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePrescription = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette prescription ?')) return;
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/prescriptions/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchPrescriptions(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAppointmentStatusUpdate = async (appointmentId, newStatus) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/appointments/${appointmentId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchAppointments(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'PENDING': { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
      'CONFIRMED': { label: 'Confirmé', color: 'bg-blue-100 text-blue-700' },
      'COMPLETED': { label: 'Complété', color: 'bg-green-100 text-green-700' },
      'CANCELLED': { label: 'Annulé', color: 'bg-red-100 text-red-700' },
    };
    const config = statusConfig[status] || statusConfig['PENDING'];
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${config.color}`}>
        {status === 'COMPLETED' && <CheckCircle className="w-3 h-3" />}
        {status === 'PENDING' && <Clock className="w-3 h-3" />}
        {status === 'CANCELLED' && <AlertCircle className="w-3 h-3" />}
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Non défini';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  };

  if (loading) return <div className="p-8">Chargement...</div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Stethoscope className="text-blue-600" />
            Espace Médecin
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestion des patients et rendez-vous
          </p>
        </div>
      </div>

      {!hospitalId && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas accès à un hôpital.
        </div>
      )}

      {hospitalId && (
        <>
          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Rendez-vous Aujourd'hui</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.todayAppointments}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">En Attente</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.pendingAppointments}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Patients</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalPatients}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Complétés</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.completedAppointments}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('appointments')}
                className={`flex-1 px-6 py-4 font-medium transition ${
                  activeTab === 'appointments'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Rendez-vous
              </button>
              <button
                onClick={() => setActiveTab('records')}
                className={`flex-1 px-6 py-4 font-medium transition ${
                  activeTab === 'records'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Dossiers Médicaux
              </button>
              <button
                onClick={() => setActiveTab('prescriptions')}
                className={`flex-1 px-6 py-4 font-medium transition ${
                  activeTab === 'prescriptions'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Pill className="w-4 h-4 inline mr-2" />
                Prescriptions
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'appointments' && (
                <div className="space-y-3">
                  {appointments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucun rendez-vous trouvé.
                    </div>
                  ) : (
                    appointments.map(appointment => (
                      <div key={appointment.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900">{appointment.patient_name || 'Patient'}</h3>
                              {getStatusBadge(appointment.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(appointment.appointment_date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {appointment.appointment_time}
                              </span>
                              {appointment.appointment_type === 'TELECONSULTATION' && (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <Video className="w-4 h-4" />
                                  Téléconsultation
                                </span>
                              )}
                              {appointment.appointment_type === 'IN_PERSON' && (
                                <span className="flex items-center gap-1 text-green-600">
                                  <MapPin className="w-4 h-4" />
                                  Présentiel
                                </span>
                              )}
                            </div>
                          </div>
                          <select
                            value={appointment.status}
                            onChange={(e) => handleAppointmentStatusUpdate(appointment.id, e.target.value)}
                            className="text-xs border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            <option value="PENDING">En attente</option>
                            <option value="CONFIRMED">Confirmé</option>
                            <option value="COMPLETED">Complété</option>
                            <option value="CANCELLED">Annulé</option>
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'records' && (
                <div className="space-y-3">
                  {medicalRecords.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucun dossier médical trouvé.
                    </div>
                  ) : (
                    medicalRecords.map(record => (
                      <div key={record.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900">{record.patient_name || 'Patient'}</h3>
                              <span className="text-xs text-gray-500">
                                {formatDate(record.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">Diagnostic:</span> {record.diagnosis}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Notes:</span> {record.clinical_notes?.substring(0, 100)}...
                            </p>
                          </div>
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'prescriptions' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900">Prescriptions Médicales</h3>
                    <button
                      onClick={() => {
                        setModalType('prescription');
                        setIsModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Nouvelle Prescription
                    </button>
                  </div>
                  {prescriptions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucune prescription trouvée.
                    </div>
                  ) : (
                    prescriptions.map(prescription => (
                      <div key={prescription.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                prescription.prescription_type === 'MEDICATION' 
                                  ? 'bg-purple-100 text-purple-700' 
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {prescription.prescription_type === 'MEDICATION' && <Pill className="w-3 h-3" />}
                                {prescription.prescription_type === 'EXAM' && <FileText className="w-3 h-3" />}
                                {prescription.prescription_type_display}
                              </span>
                              <h3 className="font-semibold text-gray-900">{prescription.patient_name}</h3>
                              <span className="text-xs text-gray-500">{formatDate(prescription.prescribed_at)}</span>
                            </div>
                            {prescription.prescription_type === 'MEDICATION' && (
                              <div className="space-y-1">
                                <p className="text-sm text-gray-900 font-medium">{prescription.medication_name}</p>
                                <p className="text-xs text-gray-600">{prescription.dosage} - {prescription.frequency} - {prescription.duration}</p>
                              </div>
                            )}
                            {prescription.prescription_type === 'EXAM' && (
                              <div className="space-y-1">
                                <p className="text-sm text-gray-900 font-medium">{prescription.exam_name}</p>
                                <p className="text-xs text-gray-600">{prescription.exam_reason}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeletePrescription(prescription.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Modal Prescription */}
          {isModalOpen && modalType === 'prescription' && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    <Pill className="w-5 h-5 text-blue-600" />
                    Nouvelle Prescription
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 text-xl">&times;</button>
                </div>
                <form onSubmit={handleCreatePrescription} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type de Prescription</label>
                    <select
                      value={prescriptionForm.prescription_type}
                      onChange={e => setPrescriptionForm({...prescriptionForm, prescription_type: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="MEDICATION">Médicament</option>
                      <option value="EXAM">Examen</option>
                      <option value="PROCEDURE">Procédure</option>
                    </select>
                  </div>

                  {prescriptionForm.prescription_type === 'MEDICATION' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom du médicament</label>
                        <input
                          type="text"
                          required
                          value={prescriptionForm.medication_name}
                          onChange={e => setPrescriptionForm({...prescriptionForm, medication_name: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                          placeholder="ex: Paracétamol"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        < div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                          <input
                            type="text"
                            value={prescriptionForm.dosage}
                            onChange={e => setPrescriptionForm({...prescriptionForm, dosage: e.target.value})}
                            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="500mg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence</label>
                          <input
                            type="text"
                            value={prescriptionForm.frequency}
                            onChange={e => setPrescriptionForm({...prescriptionForm, frequency: e.target.value})}
                            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="3x/jour"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Durée</label>
                          <input
                            type="text"
                            value={prescriptionForm.duration}
                            onChange={e => setPrescriptionForm({...prescriptionForm, duration: e.target.value})}
                            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="7 jours"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {prescriptionForm.prescription_type === 'EXAM' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'examen</label>
                        <input
                          type="text"
                          required
                          value={prescriptionForm.exam_name}
                          onChange={e => setPrescriptionForm({...prescriptionForm, exam_name: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                          placeholder="ex: Analyse sanguine"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Raison de l'examen</label>
                        <textarea
                          value={prescriptionForm.exam_reason}
                          onChange={e => setPrescriptionForm({...prescriptionForm, exam_reason: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                          rows="2"
                          placeholder="Raison..."
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                    <textarea
                      value={prescriptionForm.instructions}
                      onChange={e => setPrescriptionForm({...prescriptionForm, instructions: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      rows="2"
                      placeholder="Instructions spéciales..."
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Prescrire</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
