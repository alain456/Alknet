import React, { useState, useEffect } from 'react';
import { FileText, User, Stethoscope, Calendar, Search, Plus, Eye, Edit3, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManageMedicalRecords() {
  const { token , authFetch} = useAuth();
  const [records, setRecords] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'

  const [formData, setFormData] = useState({
    patient: '',
    doctor: '',
    appointment: '',
    diagnosis: '',
    clinical_notes: '',
    prescription: ''
  });

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
            fetchRecords(hid);
            fetchPatients();
            fetchDoctors(hid);
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

  const fetchRecords = async (hid) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/medical-records/?hospital=${hid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRecords(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await authFetch('http://localhost:8000/api/v1/accounts/admin/users/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const users = await res.json();
        setPatients(users.filter(u => u.role === 'CUSTOMER'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDoctors = async (hid) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/doctors/?hospital=${hid}`);
      if (res.ok) {
        setDoctors(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('http://localhost:8000/api/v1/hospital/medical-records/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          hospital: hospitalId
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          patient: '',
          doctor: '',
          appointment: '',
          diagnosis: '',
          clinical_notes: '',
          prescription: ''
        });
        fetchRecords(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewRecord = (record) => {
    setSelectedRecord(record);
    setViewMode('detail');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredRecords = records.filter(record => {
    const patientName = record.patient_name?.toLowerCase() || '';
    const doctorName = record.doctor_name?.toLowerCase() || '';
    const diagnosis = record.diagnosis?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();
    
    return patientName.includes(search) || 
           doctorName.includes(search) || 
           diagnosis.includes(search);
  });

  if (loading) return <div className="p-8">Chargement...</div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="text-teal-600" />
            Gestion des Dossiers Médicaux
          </h1>
          <p className="text-gray-500 text-sm mt-1">Consultez et créez les dossiers médicaux des patients.</p>
        </div>
        {viewMode === 'list' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            disabled={!hospitalId}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Nouveau Dossier
          </button>
        )}
      </div>

      {!hospitalId && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas encore configuré votre hôpital.
        </div>
      )}

      {hospitalId && viewMode === 'list' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par patient, médecin ou diagnostic..."
                className="w-full pl-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Patient</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Médecin</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Diagnostic</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-gray-500">
                        Aucun dossier médical trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map(record => (
                      <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{record.patient_name}</p>
                              <p className="text-xs text-gray-500">ID: {record.patient?.substring(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-teal-600" />
                            <span className="text-sm text-gray-900">{record.doctor_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDate(record.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900 font-medium">
                            {record.diagnosis || 'Non spécifié'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewRecord(record)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Voir le dossier"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {viewMode === 'detail' && selectedRecord && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Dossier Médical</h2>
            <button 
              onClick={() => setViewMode('list')}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Retour à la liste
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-teal-600" /> Patient
              </h3>
              <p className="text-gray-700">{selectedRecord.patient_name}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-600" /> Médecin
              </h3>
              <p className="text-gray-700">{selectedRecord.doctor_name}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Diagnostic</h3>
              <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{selectedRecord.diagnosis || 'Non spécifié'}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Notes Cliniques</h3>
              <p className="text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedRecord.clinical_notes || 'Aucune note clinique'}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Prescription</h3>
              <p className="text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedRecord.prescription || 'Aucune prescription'}</p>
            </div>
            <div className="text-sm text-gray-500">
              <p>Créé le: {formatDate(selectedRecord.created_at)}</p>
              <p>Mis à jour le: {formatDate(selectedRecord.updated_at)}</p>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">Nouveau Dossier Médical</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900">&times;</button>
            </div>
            <form onSubmit={handleCreateRecord} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
                  <select 
                    required
                    value={formData.patient}
                    onChange={e => setFormData({...formData, patient: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="">Sélectionner un patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} ({p.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Médecin</label>
                  <select 
                    required
                    value={formData.doctor}
                    onChange={e => setFormData({...formData, doctor: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="">Sélectionner un médecin</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.user_details?.first_name} {d.user_details?.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnostic</label>
                <input 
                  type="text"
                  required
                  value={formData.diagnosis}
                  onChange={e => setFormData({...formData, diagnosis: e.target.value})}
                  placeholder="Diagnostic principal"
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes Cliniques</label>
                <textarea 
                  rows={4}
                  value={formData.clinical_notes}
                  onChange={e => setFormData({...formData, clinical_notes: e.target.value})}
                  placeholder="Observations, symptômes, examen clinique..."
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prescription</label>
                <textarea 
                  rows={3}
                  value={formData.prescription}
                  onChange={e => setFormData({...formData, prescription: e.target.value})}
                  placeholder="Médicaments, posologie, recommandations..."
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-lg"
                >
                  Créer le dossier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
