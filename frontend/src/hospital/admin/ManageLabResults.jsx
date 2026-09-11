import React, { useState, useEffect } from 'react';
import { FlaskConical, User, Stethoscope, Calendar, Search, CheckCircle, Clock, AlertCircle, Shield, FileText, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import hospitalService from '../hospitalService';

const STATUS_CHOICES = [
  { value: 'REQUESTED', label: 'Demandé', color: 'bg-gray-100 text-gray-700' },
  { value: 'SAMPLE_COLLECTED', label: 'Prélèvement effectué', color: 'bg-blue-100 text-blue-700' },
  { value: 'IN_ANALYSIS', label: 'En analyse', color: 'bg-purple-100 text-purple-700' },
  { value: 'RESULT_AVAILABLE', label: 'Résultat disponible', color: 'bg-orange-100 text-orange-700' },
  { value: 'VALIDATED', label: 'Validé', color: 'bg-green-100 text-green-700' },
  { value: 'COMMUNICATED', label: 'Communiqué', color: 'bg-teal-100 text-teal-700' },
];

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

export default function ManageLabResults() {
  const { isAuthenticated } = useAuth();
  const [labResults, setLabResults] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [viewMode, setViewMode] = useState('list');

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      try {
        const businesses = await hospitalService.getMyHospital();
        const list = Array.isArray(businesses) ? businesses : [];
        if (list.length > 0) {
          const hid = list[0].id;
          setHospitalId(hid);
          await fetchLabResults(hid);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    init();
  }, [isAuthenticated]);

  const fetchLabResults = async (hid) => {
    try {
      const data = await hospitalService.getLabResults(hid);
      setLabResults(normalizeList(data));
    } catch (err) {
      console.error(err);
      setLabResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusInfo = STATUS_CHOICES.find((s) => s.value === status);
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

  const filteredResults = labResults.filter((result) => {
    const matchesStatus = filterStatus === 'ALL' || result.status === filterStatus;
    const patientName = result.patient_name?.toLowerCase() || '';
    const testName = result.test_name?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();
    return matchesStatus && (patientName.includes(search) || testName.includes(search));
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'Non défini';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  if (loading) return <div className="p-8">Chargement...</div>;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FlaskConical className="text-teal-600" />
          Résultats de Laboratoire
        </h1>
        <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
          <Eye className="w-4 h-4 text-slate-500" />
          Consultation seule — la saisie et le workflow sont gérés par le laborantin
        </p>
      </div>

      {!hospitalId && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n&apos;avez pas encore configuré votre hôpital.
        </div>
      )}

      {hospitalId && viewMode === 'list' && (
        <>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-700">
            <p className="font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              Rôle admin : visualisation
            </p>
            <p className="mt-1 text-slate-600">
              Le laborantin crée le résultat, suit les étapes (prélèvement → analyse → validation)
              et notifie le patient. Vous consultez ici l&apos;état d&apos;avancement.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                <span className="text-sm font-medium text-gray-600">Statut:</span>
                {['ALL', ...STATUS_CHOICES.map((s) => s.value)].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                      filterStatus === status
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'ALL' ? 'Tous' : STATUS_CHOICES.find((s) => s.value === status)?.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher patient ou examen..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>
          </div>

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
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Détail</th>
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
                    filteredResults.map((result) => (
                      <tr key={result.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{result.patient_name}</p>
                          <p className="text-xs text-gray-500">{result.patient_email}</p>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{result.test_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(result.test_date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{result.ordered_by_name || '—'}</td>
                        <td className="px-6 py-4">{getStatusBadge(result.status)}</td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => { setSelectedResult(result); setViewMode('detail'); }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Voir le détail"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FlaskConical className="text-teal-600" />
              Détail du résultat
            </h2>
            <button type="button" onClick={() => setViewMode('list')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              Retour
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><User className="w-4 h-4 text-teal-600" /> Patient</h3>
              <p>{selectedResult.patient_name}</p>
              <p className="text-sm text-gray-500">{selectedResult.patient_email}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><Stethoscope className="w-4 h-4 text-teal-600" /> Prescripteur</h3>
              <p>{selectedResult.ordered_by_name || 'Non assigné'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Examen</h3>
              <p className="bg-gray-50 rounded-lg p-3">{selectedResult.test_name}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Date</h3>
              <p className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                {formatDate(selectedResult.test_date)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Résultat</h3>
              <p className="bg-gray-50 rounded-lg p-3 font-bold text-lg">{selectedResult.result_value}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Statut</h3>
              {getStatusBadge(selectedResult.status)}
            </div>
          </div>

          {selectedResult.reference_values && (
            <div>
              <h3 className="font-semibold mb-2">Valeurs de référence</h3>
              <p className="bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedResult.reference_values}</p>
            </div>
          )}
          {selectedResult.result_notes && (
            <div>
              <h3 className="font-semibold mb-2">Commentaires</h3>
              <p className="bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedResult.result_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
