import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical, User, Stethoscope, Calendar, Search, CheckCircle, Clock,
  AlertCircle, Shield, FileText, Activity, Plus, Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import hospitalService from '../hospitalService';

const STATUS_CHOICES = [
  { value: 'REQUESTED', label: 'Demandé', color: 'bg-gray-100 text-gray-700' },
  { value: 'SAMPLE_COLLECTED', label: 'Prélèvement effectué', color: 'bg-blue-100 text-blue-700' },
  { value: 'IN_ANALYSIS', label: 'En analyse', color: 'bg-purple-100 text-purple-700' },
  { value: 'RESULT_AVAILABLE', label: 'Résultat disponible', color: 'bg-orange-100 text-orange-700' },
  { value: 'VALIDATED', label: 'Validé', color: 'bg-green-100 text-green-700' },
  { value: 'COMMUNICATED', label: 'Communiqué (patient notifié)', color: 'bg-teal-100 text-teal-700' },
];

const NEXT_STEP = {
  REQUESTED: { status: 'SAMPLE_COLLECTED', label: 'Enregistrer le prélèvement' },
  SAMPLE_COLLECTED: { status: 'IN_ANALYSIS', label: 'Démarrer l\'analyse' },
  IN_ANALYSIS: { status: 'RESULT_AVAILABLE', label: 'Saisir / publier le résultat', needsResult: true },
  // VALIDATED = médecin / validateur (pas le laborantin)
  VALIDATED: { status: 'COMMUNICATED', label: 'Notifier le patient' },
};

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

export default function LabTechnicianDashboard() {
  const { isAuthenticated } = useAuth();
  const [labResults, setLabResults] = useState([]);
  const [eligibleAppointments, setEligibleAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitalExams, setHospitalExams] = useState([]);
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [stats, setStats] = useState({ total: 0, pending: 0, inAnalysis: 0, completed: 0 });

  const [formData, setFormData] = useState({
    appointment: '',
    patient: '',
    ordered_by: '',
    test_name: '',
    test_date: new Date().toISOString().split('T')[0],
    result_value: '',
    unit: '',
    reference_values: '',
    result_notes: '',
  });

  const [resultEdit, setResultEdit] = useState({
    result_value: '',
    unit: '',
    reference_values: '',
    result_notes: '',
  });
  const [parameters, setParameters] = useState([{ name: '', value: '', unit: '', reference: '', flag: '' }]);
  const [apiStats, setApiStats] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const refreshStats = (list) => {
    setStats({
      total: list.length,
      pending: list.filter((r) => r.status === 'REQUESTED').length,
      inAnalysis: list.filter((r) => ['SAMPLE_COLLECTED', 'IN_ANALYSIS'].includes(r.status)).length,
      completed: list.filter((r) => ['VALIDATED', 'COMMUNICATED'].includes(r.status)).length,
    });
  };

  const fetchLabResults = useCallback(async (hid) => {
    try {
      const [data, statsData] = await Promise.all([
        hospitalService.getLabResults(hid),
        hospitalService.getLabStats(hid).catch(() => null),
      ]);
      const list = normalizeList(data);
      setLabResults(list);
      refreshStats(list);
      if (statsData) setApiStats(statsData);
    } catch (err) {
      console.error(err);
      setLabResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
          try {
            const [eligibleData, doctorsData, examsData] = await Promise.all([
              hospitalService.getLabEligibleAppointments(hid),
              hospitalService.getDoctors({ hospital: hid }),
              hospitalService.getExams(hid, true),
            ]);
            setEligibleAppointments(normalizeList(eligibleData));
            setDoctors(normalizeList(doctorsData));
            setHospitalExams(normalizeList(examsData).filter((e) => e.is_active !== false));
          } catch {
            setEligibleAppointments([]);
            setDoctors([]);
            setHospitalExams([]);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    init();
  }, [isAuthenticated, fetchLabResults]);

  const toggleExamSelection = (examId) => {
    setSelectedExamIds((prev) => (
      prev.includes(examId) ? prev.filter((id) => id !== examId) : [...prev, examId]
    ));
  };

  const resetCreateForm = () => {
    setFormData({
      appointment: '',
      patient: '',
      ordered_by: '',
      test_name: '',
      test_date: new Date().toISOString().split('T')[0],
      result_value: '',
      unit: '',
      reference_values: '',
      result_notes: '',
    });
    setSelectedExamIds([]);
  };

  const handleCreateResult = async (e) => {
    e.preventDefault();
    if (!hospitalId) return;
    if (!formData.appointment) {
      setActionError('Sélectionnez un rendez-vous d’un patient déjà Présent.');
      return;
    }
    const freeName = (formData.test_name || '').trim();
    const selectedExams = hospitalExams.filter((ex) => selectedExamIds.includes(String(ex.id)) || selectedExamIds.includes(ex.id));
    if (selectedExams.length === 0 && !freeName) {
      setActionError('Sélectionnez au moins un examen catalogue, ou saisissez un nom libre.');
      return;
    }

    setActionLoading(true);
    setActionError('');
    try {
      const base = {
        appointment: formData.appointment,
        patient: formData.patient,
        hospital: hospitalId,
        ordered_by: formData.ordered_by || null,
        test_date: formData.test_date,
        result_value: 'En attente',
        unit: '',
        reference_values: '',
        result_notes: formData.result_notes || '',
      };

      const jobs = selectedExams.map((exam) => (
        hospitalService.createLabResult({
          ...base,
          hospital_exam: exam.id,
          test_name: exam.name,
        })
      ));
      if (freeName) {
        jobs.push(hospitalService.createLabResult({
          ...base,
          hospital_exam: null,
          test_name: freeName,
        }));
      }

      await Promise.all(jobs);
      setIsModalOpen(false);
      resetCreateForm();
      const count = jobs.length;
      setActionSuccess(
        count > 1
          ? `${count} demandes labo créées pour ce patient. Poursuivez chaque examen séparément.`
          : 'Demande / résultat créé. Poursuivez le workflow étape par étape.'
      );
      await fetchLabResults(hospitalId);
      const eligibleData = await hospitalService.getLabEligibleAppointments(hospitalId).catch(() => []);
      setEligibleAppointments(normalizeList(eligibleData));
    } catch (err) {
      setActionError(err.message || 'Création impossible');
    } finally {
      setActionLoading(false);
    }
  };

  const selectEligibleAppointment = (appointmentId) => {
    const apt = eligibleAppointments.find((a) => String(a.id) === String(appointmentId));
    setFormData((prev) => ({
      ...prev,
      appointment: appointmentId,
      patient: apt?.patient || '',
      ordered_by: apt?.doctor_id || prev.ordered_by || '',
    }));
  };

  const handleNextStep = async (result) => {
    const next = NEXT_STEP[result.status];
    if (!next) return;
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      const payload = { status: next.status };
      if (next.needsResult || next.status === 'RESULT_AVAILABLE') {
        const cleanParams = parameters.filter((p) => (p.name || '').trim() && (p.value || '').trim());
        const value = (resultEdit.result_value || result.result_value || '').trim();
        if ((!value || value === 'En attente') && cleanParams.length === 0) {
          setActionError('Saisissez la valeur du résultat ou au moins un paramètre avant de continuer.');
          setActionLoading(false);
          setSelectedResult(result);
          setViewMode('detail');
          setResultEdit({
            result_value: result.result_value === 'En attente' ? '' : (result.result_value || ''),
            unit: result.unit || '',
            reference_values: result.reference_values || '',
            result_notes: result.result_notes || '',
          });
          return;
        }
        if (value && value !== 'En attente') payload.result_value = value;
        if (cleanParams.length) payload.parameters = cleanParams;
        payload.unit = resultEdit.unit || result.unit || '';
        payload.reference_values = resultEdit.reference_values || result.reference_values || '';
        payload.result_notes = resultEdit.result_notes || result.result_notes || '';
      }
      const updated = await hospitalService.updateLabResultStatus(result.id, payload);
      setActionSuccess(
        next.status === 'COMMUNICATED'
          ? 'Patient notifié — résultat communiqué.'
          : `Étape effectuée : ${STATUS_CHOICES.find((s) => s.value === next.status)?.label || next.status}`
      );
      await fetchLabResults(hospitalId);
      if (viewMode === 'detail') {
        setSelectedResult(updated);
        setResultEdit({
          result_value: updated.result_value || '',
          unit: updated.unit || '',
          reference_values: updated.reference_values || '',
          result_notes: updated.result_notes || '',
        });
        if (Array.isArray(updated.parameters) && updated.parameters.length) {
          setParameters(updated.parameters);
        }
      }
    } catch (err) {
      setActionError(err.message || 'Étape impossible');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadDocument = async (file) => {
    if (!selectedResult || !file) return;
    setUploadingDoc(true);
    setActionError('');
    try {
      const updated = await hospitalService.uploadLabDocument(selectedResult.id, file);
      setSelectedResult(updated);
      setActionSuccess('Document joint.');
      await fetchLabResults(hospitalId);
    } catch (err) {
      setActionError(err.message || 'Upload impossible');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleViewResult = (result) => {
    setSelectedResult(result);
    setResultEdit({
      result_value: result.result_value === 'En attente' ? '' : (result.result_value || ''),
      unit: result.unit || '',
      reference_values: result.reference_values || '',
      result_notes: result.result_notes || '',
    });
    setParameters(
      Array.isArray(result.parameters) && result.parameters.length
        ? result.parameters
        : [{ name: '', value: '', unit: '', reference: '', flag: '' }]
    );
    setViewMode('detail');
    setActionError('');
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
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical className="text-teal-600" />
            Espace Laborantin
          </h1>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-500" />
            Workflow : prélèvement → analyse → résultat → (validation médecin) → notifier le patient
          </p>
        </div>
        {viewMode === 'list' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => hospitalId && fetchLabResults(hospitalId)}
              className="px-3 py-2 text-sm font-semibold border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Actualiser
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={!hospitalId}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Nouveau résultat
            </button>
          </div>
        )}
      </div>

      {actionError && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{actionError}</div>}
      {actionSuccess && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-100">{actionSuccess}</div>}

      {!hospitalId && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n&apos;avez pas accès à un hôpital.
        </div>
      )}

      {hospitalId && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total', value: apiStats?.total ?? stats.total, icon: FlaskConical, color: 'text-blue-600', bg: 'bg-blue-100' },
              { label: 'File ouverte', value: apiStats?.pending ?? stats.pending, icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
              { label: 'Validés (30j)', value: apiStats?.validated_period ?? stats.completed, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-100' },
              {
                label: 'Délai moyen',
                value: apiStats?.avg_hours_to_validate != null ? `${apiStats.avg_hours_to_validate}h` : '—',
                icon: CheckCircle,
                color: 'text-green-600',
                bg: 'bg-green-100',
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className={`text-3xl font-bold ${color}`}>{value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
              </div>
            ))}
          </div>

          {viewMode === 'list' && (
            <>
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
                          filterStatus === status ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Statut</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-8 text-gray-500">Aucun résultat.</td>
                        </tr>
                      ) : (
                        filteredResults.map((result) => {
                          const next = NEXT_STEP[result.status];
                          return (
                            <tr key={result.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <p className="font-medium text-gray-900">{result.patient_name}</p>
                                <p className="text-xs text-gray-500">{result.patient_email}</p>
                              </td>
                              <td className="px-6 py-4 text-sm font-medium">{result.test_name}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{formatDate(result.test_date)}</td>
                              <td className="px-6 py-4">{getStatusBadge(result.status)}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleViewResult(result)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                    title="Détail"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                  {next && (
                                    <button
                                      type="button"
                                      disabled={actionLoading}
                                      onClick={() => handleNextStep(result)}
                                      className="px-2.5 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                                    >
                                      {next.label}
                                    </button>
                                  )}
                                </div>
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

          {viewMode === 'detail' && selectedResult && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FlaskConical className="text-teal-600" />
                  Détail & workflow
                </h2>
                <button type="button" onClick={() => setViewMode('list')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  Retour
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><User className="w-4 h-4 text-teal-600" /> Patient</h3>
                  <p>{selectedResult.patient_name}</p>
                  <p className="text-sm text-gray-500">{selectedResult.patient_email}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Stethoscope className="w-4 h-4 text-teal-600" /> Prescripteur</h3>
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

              <div className="border border-teal-100 rounded-xl p-4 bg-teal-50/40 space-y-3">
                <h3 className="font-semibold text-teal-900">Saisie du résultat (avant publication)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={resultEdit.result_value}
                    onChange={(e) => setResultEdit({ ...resultEdit, result_value: e.target.value })}
                    placeholder="Valeur résumé"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    disabled={['VALIDATED', 'COMMUNICATED'].includes(selectedResult.status)}
                  />
                  <input
                    type="text"
                    value={resultEdit.unit}
                    onChange={(e) => setResultEdit({ ...resultEdit, unit: e.target.value })}
                    placeholder="Unité"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    disabled={['VALIDATED', 'COMMUNICATED'].includes(selectedResult.status)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-teal-900">Paramètres (multi-valeurs)</p>
                    <button
                      type="button"
                      className="text-xs text-teal-700 font-semibold"
                      disabled={['VALIDATED', 'COMMUNICATED'].includes(selectedResult.status)}
                      onClick={() => setParameters((prev) => [...prev, { name: '', value: '', unit: '', reference: '', flag: '' }])}
                    >
                      + Ligne
                    </button>
                  </div>
                  {parameters.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {['name', 'value', 'unit', 'reference', 'flag'].map((key) => (
                        <input
                          key={key}
                          type="text"
                          value={row[key] || ''}
                          placeholder={key === 'name' ? 'Nom' : key === 'value' ? 'Valeur' : key === 'unit' ? 'Unité' : key === 'reference' ? 'Réf.' : 'Flag'}
                          className="px-2 py-1.5 border rounded-lg text-xs"
                          disabled={['VALIDATED', 'COMMUNICATED'].includes(selectedResult.status)}
                          onChange={(e) => {
                            const next = [...parameters];
                            next[idx] = { ...next[idx], [key]: e.target.value };
                            setParameters(next);
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={resultEdit.reference_values}
                  onChange={(e) => setResultEdit({ ...resultEdit, reference_values: e.target.value })}
                  placeholder="Valeurs de référence"
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  disabled={['VALIDATED', 'COMMUNICATED'].includes(selectedResult.status)}
                />
                <textarea
                  rows={2}
                  value={resultEdit.result_notes}
                  onChange={(e) => setResultEdit({ ...resultEdit, result_notes: e.target.value })}
                  placeholder="Commentaires"
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  disabled={['VALIDATED', 'COMMUNICATED'].includes(selectedResult.status)}
                />
                <div>
                  <label className="block text-xs font-semibold text-teal-900 mb-1">Compte-rendu PDF / image</label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    disabled={uploadingDoc || ['COMMUNICATED'].includes(selectedResult.status)}
                    onChange={(e) => handleUploadDocument(e.target.files?.[0])}
                    className="block w-full text-xs"
                  />
                  {(selectedResult.document_display_url || selectedResult.document_url) && (
                    <a
                      href={selectedResult.document_display_url || selectedResult.document_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-2 text-xs font-semibold text-teal-700 underline"
                    >
                      Voir le document joint
                    </a>
                  )}
                </div>
              </div>

              {selectedResult.status === 'RESULT_AVAILABLE' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-900">
                  Résultat publié — en attente de validation médicale avant notification patient.
                </div>
              )}

              {Array.isArray(selectedResult.events) && selectedResult.events.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Audit</h3>
                  <ul className="space-y-1 text-xs text-slate-600 max-h-40 overflow-y-auto">
                    {selectedResult.events.map((ev) => (
                      <li key={ev.id} className="rounded-lg bg-slate-50 px-3 py-1.5">
                        {ev.action}
                        {ev.from_status ? ` ${ev.from_status}` : ''}
                        {ev.to_status ? ` → ${ev.to_status}` : ''}
                        {ev.actor_email ? ` · ${ev.actor_email}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>{getStatusBadge(selectedResult.status)}</div>
                {NEXT_STEP[selectedResult.status] && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleNextStep(selectedResult)}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {NEXT_STEP[selectedResult.status].label}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FlaskConical className="text-teal-600" />
                Nouveau résultat de laboratoire
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900">&times;</button>
            </div>
            <form onSubmit={handleCreateResult} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-900">
                Un résultat labo ne peut être créé que si le RDV a été <strong>confirmé</strong>,
                le patient est <strong>arrivé</strong>, puis marqué <strong>Présent</strong>.
                Les RDV « en attente de confirmation » n&apos;apparaissent pas ici.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rendez-vous patient (Présent)</label>
                <select
                  required
                  value={formData.appointment}
                  onChange={(e) => selectEligibleAppointment(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">Sélectionner un RDV éligible</option>
                  {eligibleAppointments.map((apt) => (
                    <option key={apt.id} value={apt.id}>
                      {(apt.patient_name || 'Patient')}
                      {apt.reference_code ? ` · ${apt.reference_code}` : ''}
                      {` · ${apt.status_display || apt.status}`}
                      {apt.doctor_name ? ` · Dr. ${apt.doctor_name}` : ''}
                    </option>
                  ))}
                </select>
                {eligibleAppointments.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    Aucun patient Présent pour le moment. Attendez la confirmation admin, l&apos;arrivée et le démarrage consultation.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Médecin prescripteur</label>
                  <select
                    value={formData.ordered_by}
                    onChange={(e) => setFormData({ ...formData, ordered_by: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="">Non assigné</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.user_details?.first_name} {d.user_details?.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de l&apos;examen</label>
                  <input
                    type="date"
                    required
                    value={formData.test_date}
                    onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">Examens catalogue (plusieurs possibles)</label>
                  {selectedExamIds.length > 0 && (
                    <span className="text-xs font-semibold text-teal-700">{selectedExamIds.length} sélectionné(s)</span>
                  )}
                </div>
                {hospitalExams.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Aucun examen catalogue. Configurez-les côté admin hôpital, ou saisissez un nom libre ci-dessous.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                    {hospitalExams.map((exam) => {
                      const id = String(exam.id);
                      const checked = selectedExamIds.includes(id);
                      return (
                        <label
                          key={id}
                          className={`flex items-start gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${
                            checked ? 'bg-teal-50 border border-teal-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleExamSelection(id)}
                          />
                          <span className="min-w-0">
                            <span className="font-medium text-slate-900">{exam.name}</span>
                            <span className="block text-xs text-slate-500">
                              {exam.category_display || exam.category || 'Examen'}
                              {exam.price != null ? ` · ${exam.price} ${exam.currency || 'BIF'}` : ''}
                              {exam.loinc_code ? ` · LOINC ${exam.loinc_code}` : ''}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Chaque examen sélectionné crée une demande labo séparée pour le même patient (workflow indépendant).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Examen libre (optionnel{selectedExamIds.length ? ' — en plus du catalogue' : ''})
                </label>
                <input
                  type="text"
                  value={formData.test_name}
                  onChange={(e) => setFormData({ ...formData, test_name: e.target.value })}
                  placeholder="ex: Analyse non listée…"
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <p className="text-xs text-gray-500">
                Vous pourrez saisir la valeur définitive plus tard, avant validation / notification patient.
              </p>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => { setIsModalOpen(false); resetCreateForm(); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || eligibleAppointments.length === 0}
                  className="px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {selectedExamIds.length + ((formData.test_name || '').trim() ? 1 : 0) > 1
                    ? `Créer ${selectedExamIds.length + ((formData.test_name || '').trim() ? 1 : 0)} demandes`
                    : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
