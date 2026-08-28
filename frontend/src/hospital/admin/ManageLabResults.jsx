import React, { useState, useEffect } from 'react';
import { FlaskConical, User, Stethoscope, Calendar, Search, Plus, CheckCircle, Clock, AlertCircle, Shield, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const STATUS_CHOICES = [
  { value: 'REQUESTED', label: 'Demandé', color: 'bg-gray-100 text-gray-700' },
  { value: 'SAMPLE_COLLECTED', label: 'Prélèvement effectué', color: 'bg-blue-100 text-blue-700' },
  { value: 'IN_ANALYSIS', label: 'En analyse', color: 'bg-purple-100 text-purple-700' },
  { value: 'RESULT_AVAILABLE', label: 'Résultat disponible', color: 'bg-orange-100 text-orange-700' },
  { value: 'VALIDATED', label: 'Validé', color: 'bg-green-100 text-green-700' },
  { value: 'COMMUNICATED', label: 'Communiqué', color: 'bg-teal-100 text-teal-700' },
];

export default function ManageLabResults() {
  const { token } = useAuth();
  const [labResults, setLabResults] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'

  const [formData, setFormData] = useState({
    patient: '',
    ordered_by: '',
    test_name: '',
    test_date: new Date().toISOString().split('T')[0],
    result_value: '',
    unit: '',
    reference_values: '',
    result_notes: ''
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
            fetchLabResults(hid);
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

  const fetchLabResults = async (hid) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/lab-results/?hospital=${hid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setLabResults(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/accounts/users/', {
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
      const res = await fetch(`http://localhost:8000/api/v1/hospital/doctors/?hospital=${hid}`);
      if (res.ok) {
        setDoctors(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateResult = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/v1/hospital/lab-results/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          hospital: hospitalId,
          uploaded_by: token // Will be handled by backend
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          patient: '',
          ordered_by: '',
          test_name: '',
          test_date: new Date().toISOString().split('T')[0],
          result_value: '',
          unit: '',
          reference_values: '',
          result_notes: ''
        });
        fetchLabResults(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusUpdate = async (resultId, newStatus) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/lab-results/${resultId}/update_status/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchLabResults(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewResult = (result) => {
    setSelectedResult(result);
    setViewMode('detail');
  };

  const getStatusBadge = (status) => {
    const statusInfo = STATUS_CHOICES.find(s => s.value === status);
    if (!statusInfo) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${statusInfo.color}`}>
        {status === 'VALIDATED' && <CheckCircle className="w-3 h-3" />}
        {status === 'IN_ANALYSIS' && <Clock className="w-3 h-3" />}
        {status === 'REQUESTED' && <AlertCircle className="w-3 h-3" />}
        {statusInfo.label}
      </span>
    );
  };

  const filteredResults = labResults.filter(result => {
    const matchesStatus = filterStatus === 'ALL' || result.status === filterStatus;
    const patientName = result.patient_name?.toLowerCase() || '';
    const testName = result.test_name?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();
    const matchesSearch = patientName.includes(search) || testName.includes(search);
    return matchesStatus && matchesSearch;
  });

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
            <FlaskConical className="text-teal-600" />
            Gestion des Résultats de Laboratoire
          </h1>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-500" />
            Module à sécurité élevée - Workflow complet des résultats
          </p>
        </div>
        {viewMode === 'list' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            disabled={!hospitalId}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Nouveau Résultat
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
          {/* Workflow Info */}
          <div className="bg-gradient-to-r from-teal-900 to-slate-900 rounded-2xl p-6 text-white">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Workflow de Sécurité
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {STATUS_CHOICES.map((status, index) => (
                <React.Fragment key={status.value}>
                  <span className={`px-3 py-1 rounded-lg ${status.color.replace('text-', 'text-white bg-').replace('100', '600')}`}>
                    {status.label}
                  </span>
                  {index < STATUS_CHOICES.length - 1 && <span className="text-teal-300">→</span>}
                </React.Fragment>
              ))}
            </div>
            <p className="text-xs text-teal-200 mt-3">
              Les patients ne peuvent voir que les résultats VALIDÉS ou COMMUNIQUÉS
            </p>
          </div>

          {/* Filtres */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                <span className="text-sm font-medium text-gray-600">Statut:</span>
                {['ALL', ...STATUS_CHOICES.map(s => s.value)].map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                      filterStatus === status
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'ALL' ? 'Tous' : STATUS_CHOICES.find(s => s.value === status)?.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher patient ou examen..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>
          </div>

          {/* Tableau des résultats */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Patient</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Examen</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Médecin</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Statut</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">
                        Aucun résultat de laboratoire trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map(result => (
                      <tr key={result.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{result.patient_name}</p>
                              <p className="text-xs text-gray-500">{result.patient_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="w-4 h-4 text-teal-600" />
                            <span className="text-sm text-gray-900 font-medium">{result.test_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDate(result.test_date)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{result.ordered_by_name || 'Non assigné'}</span>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(result.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewResult(result)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Voir le résultat"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <select
                              value={result.status}
                              onChange={(e) => handleStatusUpdate(result.id, e.target.value)}
                              className="text-xs border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-teal-600"
                            >
                              {STATUS_CHOICES.map(status => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
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

      {viewMode === 'detail' && selectedResult && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FlaskConical className="text-teal-600" />
              Détail du Résultat de Laboratoire
            </h2>
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
              <p className="text-gray-700">{selectedResult.patient_name}</p>
              <p className="text-sm text-gray-500">{selectedResult.patient_email}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-600" /> Médecin Prescripteur
              </h3>
              <p className="text-gray-700">{selectedResult.ordered_by_name || 'Non assigné'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Examen</h3>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{selectedResult.test_name}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Date de l'examen</h3>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{formatDate(selectedResult.test_date)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Résultat</h3>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3 font-bold text-lg">{selectedResult.result_value}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Unité</h3>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{selectedResult.unit || 'Non spécifié'}</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Valeurs de Référence</h3>
              <p className="text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedResult.reference_values || 'Non spécifiées'}</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Commentaires</h3>
              <p className="text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedResult.result_notes || 'Aucun commentaire'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Statut Actuel</h3>
                {getStatusBadge(selectedResult.status)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Validé par</h3>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{selectedResult.validated_by_name || 'Non validé'}</p>
              </div>
            </div>

            {selectedResult.validation_date && (
              <div className="text-sm text-gray-500">
                <p>Date de validation: {formatDate(selectedResult.validation_date)}</p>
              </div>
            )}

            {selectedResult.communication_date && (
              <div className="text-sm text-gray-500">
                <p>Date de communication: {formatDate(selectedResult.communication_date)}</p>
              </div>
            )}

            {selectedResult.document_url && (
              <div>
                <a 
                  href={selectedResult.document_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium"
                >
                  <FileText className="w-4 h-4" />
                  Voir le document PDF
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FlaskConical className="text-teal-600" />
                Nouveau Résultat de Laboratoire
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900">&times;</button>
            </div>
            <form onSubmit={handleCreateResult} className="p-6 space-y-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Médecin Prescripteur</label>
                  <select 
                    value={formData.ordered_by}
                    onChange={e => setFormData({...formData, ordered_by: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="">Non assigné</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.user_details?.first_name} {d.user_details?.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'examen</label>
                  <input 
                    type="text"
                    required
                    value={formData.test_name}
                    onChange={e => setFormData({...formData, test_name: e.target.value})}
                    placeholder="ex: Bilan sanguin complet"
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de l'examen</label>
                  <input 
                    type="date"
                    required
                    value={formData.test_date}
                    onChange={e => setFormData({...formData, test_date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Résultat</label>
                  <input 
                    type="text"
                    required
                    value={formData.result_value}
                    onChange={e => setFormData({...formData, result_value: e.target.value})}
                    placeholder="ex: 12.5 g/dL"
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
                  <input 
                    type="text"
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                    placeholder="ex: g/dL"
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valeurs de Référence</label>
                <textarea 
                  rows={2}
                  value={formData.reference_values}
                  onChange={e => setFormData({...formData, reference_values: e.target.value})}
                  placeholder="Valeurs normales pour cet examen..."
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commentaires</label>
                <textarea 
                  rows={3}
                  value={formData.result_notes}
                  onChange={e => setFormData({...formData, result_notes: e.target.value})}
                  placeholder="Observations, notes techniques..."
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
                  Créer le résultat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
