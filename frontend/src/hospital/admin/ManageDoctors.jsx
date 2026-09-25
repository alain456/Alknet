import React, { useState, useEffect } from 'react';
import { Stethoscope, Plus, Mail, CreditCard, Video, Clock, Shield, HeartPulse, Edit2, Trash2, Upload, User, X, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import hospitalService from '../hospitalService';
import { readImageAsDataUrl } from '../../shared/imageUpload';
import PasswordInput from '../../shared/components/PasswordInput';

export default function ManageDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [roles, setRoles] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState(null);
  
  const [specialties, setSpecialties] = useState([]);
  const [services, setServices] = useState([]);
  
  const [formData, setFormData] = useState({ 
    first_name: '', last_name: '', email: '', password: '', 
    staff_category: 'DOCTOR',
    medical_license_number: '', consultation_fee: 0, 
    is_available_for_telemedicine: false, bio: '',
    photo_url: '',
    office_address: '',
    languages_spoken: 'Français, Kirundi',
    experience_years: 0,
    qualifications: '',
    specialty_ids: [], service_ids: [], role_id: ''
  });
  const [photoError, setPhotoError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  
  const [activeCategoryTab, setActiveCategoryTab] = useState('ALL');
  
  const { token } = useAuth();
  const navigate = useNavigate();

  const selectedRole = roles.find((r) => r.id === formData.role_id);
  const roleName = (selectedRole?.name || '').toLowerCase();
  const isAccountantRole = selectedRole?.system_access_level === 'CASHIER_ACCESS'
    || roleName.includes('comptable')
    || roleName.includes('comptab')
    || roleName.includes('caissier')
    || roleName.includes('caisse');
  const isReceptionistRole = selectedRole?.system_access_level === 'RECEPTIONIST_ACCESS'
    || roleName.includes('accueil');
  const noConsultationFee = ['NURSE', 'ACCOUNTANT', 'RECEPTIONIST'].includes(formData.staff_category);

  useEffect(() => {
    const init = async () => {
      try {
        const businesses = await hospitalService.getMyHospital();
        if (businesses.length > 0) {
          const hid = businesses[0].id;
          setHospitalId(hid);
          fetchDoctors(hid);
          fetchSpecialties();
          fetchServices(hid);
          fetchRoles();
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    if (token) init();
  }, [token]);

  const fetchRoles = async () => {
    try {
      const data = await hospitalService.getBusinessRoles();
      setRoles(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSpecialties = async () => {
    try {
      const data = await hospitalService.getSpecialties();
      setSpecialties(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchServices = async (hid) => {
    try {
      const data = await hospitalService.getServices(hid, true);
      setServices(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDoctors = async (hid) => {
    try {
      setLoading(true);
      const data = await hospitalService.getDoctors({ hospital: hid });
      setDoctors(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingDoctorId(null);
    setPhotoError('');
    setFormData({ 
      first_name: '', last_name: '', email: '', password: '', 
      staff_category: 'DOCTOR',
      medical_license_number: '', consultation_fee: 0, 
      is_available_for_telemedicine: false, bio: '',
      photo_url: '',
      office_address: '',
      languages_spoken: 'Français, Kirundi',
      experience_years: 0,
      qualifications: '',
      specialty_ids: [], service_ids: [], role_id: ''
    });
    setIsModalOpen(true);
  };

  // Open Modal for Editing Doctor
  const openEditModal = async (doc) => {
    setEditingDoctorId(doc.id);
    setPhotoError('');
    let source = doc;
    // Si la liste n'a pas renvoyé la photo (trop lourde), charger le détail
    if (doc.has_photo && !(doc.photo_url || doc.public_photo_url)) {
      try {
        source = await hospitalService.getDoctor(doc.id);
      } catch {
        source = doc;
      }
    }
    const existingServiceIds = source.services ? source.services.map((s) => s.id) : [];
    const existingSpecialtyIds = source.specialties ? source.specialties.map((s) => s.id) : [];

    setFormData({
      first_name: source.user_details?.first_name || '',
      last_name: source.user_details?.last_name || '',
      email: source.user_details?.email || '',
      password: '',
      staff_category: source.staff_category || 'DOCTOR',
      medical_license_number: source.medical_license_number || '',
      consultation_fee: source.consultation_fee || 0,
      is_available_for_telemedicine: source.is_available_for_telemedicine || false,
      bio: source.bio || '',
      photo_url: source.photo_url || source.public_photo_url || '',
      office_address: source.office_address || '',
      languages_spoken: source.languages_spoken || 'Français, Kirundi',
      experience_years: source.experience_years ?? 0,
      qualifications: source.qualifications || '',
      specialty_ids: existingSpecialtyIds,
      service_ids: existingServiceIds,
      role_id: source.user_details?.role_id || '',
    });
    setIsModalOpen(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    setPhotoUploading(true);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setFormData((prev) => ({ ...prev, photo_url: dataUrl }));
    } catch (err) {
      setPhotoError(err.message || 'Upload impossible');
    } finally {
      setPhotoUploading(false);
    }
  };

  // Delete Doctor Profile
  const handleDeleteDoctor = async (id, doctorName) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le profil de ${doctorName} ? cette action est irréversible.`)) {
      return;
    }
    try {
      await hospitalService.deleteDoctor(id);
      fetchDoctors(hospitalId);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression du médecin.");
    }
  };

  // Save (Create or Update) Doctor
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        hospital: hospitalId
      };

      if (editingDoctorId && !payload.password) {
        delete payload.password;
      }
      // Ne pas envoyer photo_url vide à la mise à jour (préserve la photo existante)
      if (editingDoctorId && !payload.photo_url) {
        delete payload.photo_url;
      }

      if (editingDoctorId) {
        await hospitalService.updateDoctor(editingDoctorId, payload);
      } else {
        await hospitalService.createDoctor(payload);
      }

      setIsModalOpen(false);
      fetchDoctors(hospitalId);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement : " + (err.message || String(err)));
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-2xl border-duo bg-surface p-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-accent" />
            Corps Médical & Praticiens
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Enregistrez les médecins, attribuez-leur des services hospitaliers et un rôle de sécurité (RBAC).
          </p>
        </div>
        <button 
          onClick={openCreateModal}
          disabled={!hospitalId}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-md shadow-teal-600/20 transition cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-5 h-5" /> Ajouter un Médecin
        </button>
      </div>

      {!hospitalId && !loading && (
        <div className="p-4 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
          Vous n'avez pas encore configuré votre hôpital.
        </div>
      )}

      {/* Onglets de filtrage par Catégorie de Personnel */}
      <div className="flex items-center gap-2 overflow-x-auto bg-white dark:bg-gray-900 p-3 rounded-xl border-2 border-accent">
        {[
          { key: 'ALL', label: 'Tout le Personnel' },
          { key: 'SPECIALIST', label: 'Médecins Spécialistes' },
          { key: 'DOCTOR', label: 'Docteurs / Généralistes' },
          { key: 'NURSE', label: 'Infirmiers & Soignants' },
          { key: 'ACCOUNTANT', label: 'Comptabilité' },
          { key: 'RECEPTIONIST', label: 'Agents d\'accueil' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveCategoryTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeCategoryTab === tab.key
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-500">Chargement du corps médical...</div>
        ) : doctors.filter(d => activeCategoryTab === 'ALL' || d.staff_category === activeCategoryTab).length === 0 && hospitalId ? (
          <div className="col-span-full py-12 text-center bg-white dark:bg-gray-900 rounded-2xl border-2 border-alert p-8">
            <Stethoscope className="w-12 h-12 text-teal-500 mx-auto mb-3 opacity-50" />
            <p className="text-gray-500 font-medium">Aucun personnel enregistré dans cette catégorie.</p>
            <button 
              onClick={openCreateModal}
              className="mt-4 text-teal-600 hover:underline text-sm font-semibold inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Enregistrer du personnel
            </button>
          </div>
        ) : (
          doctors
            .filter(d => activeCategoryTab === 'ALL' || d.staff_category === activeCategoryTab)
            .map((doc, idx) => {
            const docFullName = `${doc.user_details?.first_name || ''} ${doc.user_details?.last_name || ''}`;
            const isNurse = doc.staff_category === 'NURSE';
            const isAccountant = doc.staff_category === 'ACCOUNTANT'
              || (doc.user_details?.role_name || '').toLowerCase().includes('comptab');
            const isReceptionist = !isAccountant && (
              doc.staff_category === 'RECEPTIONIST'
              || (doc.user_details?.role_name || '').toLowerCase().includes('accueil')
            );
            return (
              <div key={doc.id} className={`bg-white dark:bg-gray-900 rounded-2xl border-2 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between space-y-4 ${
                idx % 2 === 0 ? 'border-accent' : 'border-alert'
              }`}>
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-extrabold text-lg border border-teal-200 dark:border-teal-800 shrink-0 overflow-hidden">
                        {(doc.photo_url || doc.public_photo_url) ? (
                          <img
                            src={doc.photo_url || doc.public_photo_url}
                            alt={docFullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{doc.user_details?.first_name?.[0] || 'D'}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base">
                          {docFullName}
                        </h3>
                        <p className="text-xs text-gray-400 font-mono">Licence: {doc.medical_license_number}</p>
                        {(doc.photo_url || doc.public_photo_url) && !isReceptionist && !isNurse && (
                          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Photo publique annuaire</p>
                        )}
                      </div>
                    </div>

                    {/* Actions CRUD (Modifier & Supprimer) */}
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openEditModal(doc)}
                        title="Modifier les informations du médecin"
                        className="icon-btn"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteDoctor(doc.id, docFullName)}
                        title="Supprimer ce médecin"
                        className="icon-btn icon-btn--danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Badge Catégorie & Rôle RBAC */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                      doc.staff_category === 'SPECIALIST' 
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200'
                        : isAccountant
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-200'
                        : isNurse
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200'
                        : isReceptionist
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                        : 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200'
                    }`}>
                      {doc.staff_category_display || (isAccountant ? 'Comptable' : isReceptionist ? 'Agent d\'accueil' : isNurse ? 'Infirmier(e)' : 'Médecin')}
                    </span>
                    {(isReceptionist || isAccountant) && (
                      <span className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                        Non publié côté client
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      <Shield className="w-3.5 h-3.5 text-gray-500" />
                      {doc.user_details?.role_name || 'Personnel'}
                    </span>
                  </div>

                  {/* Info Contact & Consultation */}
                  <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300 mb-4">
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400" /> {doc.user_details?.email}
                    </p>
                    {doc.office_address && (
                      <p className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span>Bureau: <span className="font-semibold text-gray-900 dark:text-white">{doc.office_address}</span></span>
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-gray-400" /> 
                      {isNurse ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                          Gratuit (Soins de service / Pas de tarif consultation)
                        </span>
                      ) : (
                        <span>
                          <span className="font-semibold text-gray-900 dark:text-white">{Number(doc.consultation_fee || 0).toLocaleString()} BIF</span> / consultation
                        </span>
                      )}
                    </p>
                    {doc.is_available_for_telemedicine && (
                      <p className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-medium text-xs">
                        <Video className="w-3.5 h-3.5" /> Téléconsultation — bientôt disponible
                      </p>
                    )}
                  </div>

                  {/* Services Attribués */}
                  {doc.services && doc.services.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-2">
                      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <HeartPulse className="w-3 h-3 text-teal-500" /> Services rattachés :
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {doc.services.map(svc => (
                          <span key={svc.id} className="px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-100 dark:border-teal-800">
                            {svc.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Horaires */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                  <button 
                    onClick={() => navigate('/hospital/admin/schedules')}
                    className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" /> Gérer le planning d'horaires &rarr;
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Création / Édition Médecin */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 shrink-0">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-600" />
                {editingDoctorId ? 'Modifier le Profil Médecin' : 'Nouveau Médecin'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Choix de la Catégorie du Personnel */}
              <div className="bg-teal-50/50 dark:bg-teal-950/20 p-3.5 rounded-xl border border-teal-100 dark:border-teal-900">
                <label className="block text-xs font-bold text-teal-900 dark:text-teal-300 mb-1.5">
                  Catégorie du Personnel *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'SPECIALIST', label: 'Médecin Spécialiste' },
                    { key: 'DOCTOR', label: 'Docteur / Généraliste' },
                    { key: 'NURSE', label: 'Infirmier(e) / Soignant(e)' },
                    { key: 'ACCOUNTANT', label: 'Comptable' },
                  ].map(cat => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => {
                        const hidden = cat.key === 'NURSE' || cat.key === 'ACCOUNTANT';
                        setFormData({
                          ...formData,
                          staff_category: cat.key,
                          consultation_fee: hidden ? 0 : formData.consultation_fee
                        });
                      }}
                      className={`p-2 rounded-lg text-xs font-semibold border transition cursor-pointer text-center ${
                        formData.staff_category === cat.key
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prénom</label>
                  <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600" placeholder="ex: Jean" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
                  <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600" placeholder="ex: Ndayishimiye" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email de connexion</label>
                  <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600" placeholder="medecin@hopital.bi" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {editingDoctorId ? 'Mot de passe (Laisser vide si inchangé)' : 'Mot de passe temporaire'}
                  </label>
                  <PasswordInput
                    required={!editingDoctorId}
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    autoComplete="new-password"
                    className="px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Numéro de Licence Médicale</label>
                  <input type="text" required value={formData.medical_license_number} onChange={e => setFormData({...formData, medical_license_number: e.target.value})} className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600" placeholder="ex: MED-2026-88" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frais de consultation (BIF) {noConsultationFee && '(Non applicable)'}
                  </label>
                  <input 
                    type="number" 
                    disabled={noConsultationFee}
                    required={!noConsultationFee} 
                    value={noConsultationFee ? 0 : formData.consultation_fee} 
                    onChange={e => setFormData({...formData, consultation_fee: e.target.value})} 
                    className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800/50" 
                  />
                </div>
              </div>

              {/* Attribution de Rôle RBAC */}
              <div className="pt-2">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  Rôle Système & Permissions (RBAC)
                </label>
                <select 
                  value={formData.role_id}
                  onChange={e => {
                    const role = roles.find((r) => r.id === e.target.value);
                    const name = (role?.name || '').toLowerCase();
                    const accountant = role?.system_access_level === 'CASHIER_ACCESS'
                      || name.includes('comptable')
                      || name.includes('comptab')
                      || name.includes('caissier')
                      || name.includes('caisse');
                    setFormData({
                      ...formData,
                      role_id: e.target.value,
                      ...(accountant ? { staff_category: 'ACCOUNTANT', consultation_fee: 0 } : {}),
                    });
                  }}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-600 outline-none"
                >
                  <option value="">-- Sélectionner un Rôle (Optionnel) --</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.system_access_level === 'RECEPTIONIST_ACCESS' ? ' (accueil — non publié client)' : ''}
                      {(r.name || '').toLowerCase().includes('comptab') ? ' (comptable — non publié client)' : ''}
                      {!(r.name || '').toLowerCase().includes('comptab') && (r.system_access_level === 'CASHIER_ACCESS' || (r.name || '').toLowerCase().includes('caiss')) ? ' (caisse — non publié client)' : ''}
                    </option>
                  ))}
                </select>
                {isAccountantRole && (
                  <p className="text-xs text-orange-800 dark:text-orange-300 mt-2 p-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200">
                    Ce personnel est chargé de la comptabilité uniquement. Il n&apos;apparaît pas dans l&apos;annuaire public ni dans la prise de rendez-vous, au même titre qu&apos;un infirmier.
                  </p>
                )}
                {isReceptionistRole && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200">
                    Ce personnel sera enregistré comme <strong>agent d&apos;accueil</strong> et n&apos;apparaîtra pas dans l&apos;annuaire public ni dans la réservation en ligne.
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Définit les droits du personnel (dossiers, accueil, prescriptions...)</p>
              </div>

              <div>
                <label className="flex items-center gap-2 mt-2 opacity-60 cursor-not-allowed">
                  <input type="checkbox" checked={false} disabled readOnly className="w-4 h-4 text-teal-600 border-gray-300 rounded cursor-not-allowed" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Téléconsultations (Vidéo)
                    <span className="ml-2 text-[10px] font-bold uppercase bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">Bientôt</span>
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Langues parlées</label>
                  <input
                    type="text"
                    value={formData.languages_spoken}
                    onChange={(e) => setFormData({ ...formData, languages_spoken: e.target.value })}
                    className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="ex: Français, Kirundi, Anglais"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Années d&apos;expérience</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.experience_years}
                    onChange={(e) => setFormData({ ...formData, experience_years: Number(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Photo professionnelle (publique)
                </label>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="w-24 h-24 rounded-2xl border border-teal-100 bg-teal-50 overflow-hidden flex items-center justify-center shrink-0">
                    {formData.photo_url ? (
                      <img src={formData.photo_url} alt="Aperçu" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-teal-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold cursor-pointer transition inline-flex items-center gap-1.5">
                        <Upload className="w-4 h-4" />
                        {photoUploading ? 'Traitement…' : 'Téléverser une image'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          disabled={photoUploading}
                          onChange={handlePhotoUpload}
                        />
                      </label>
                      {formData.photo_url && (
                        <button
                          type="button"
                          onClick={() => { setFormData({ ...formData, photo_url: '' }); setPhotoError(''); }}
                          className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded-lg inline-flex items-center gap-1"
                        >
                          <X className="w-4 h-4" /> Retirer
                        </button>
                      )}
                    </div>
                    <input
                      type="url"
                      value={formData.photo_url?.startsWith('data:') ? '' : (formData.photo_url || '')}
                      onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                      className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                      placeholder="Ou coller une URL d'image (https://…)"
                    />
                    {photoError && <p className="text-xs text-red-600">{photoError}</p>}
                    <p className="text-[11px] text-gray-400">
                      Visible côté client dans l&apos;annuaire des médecins spécialistes (si le praticien est publié).
                      JPG/PNG/WebP, max 5 Mo — l&apos;image est automatiquement compressée.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bureau / cabinet (adresse pour les RDV)
                </label>
                <input
                  type="text"
                  value={formData.office_address}
                  onChange={(e) => setFormData({ ...formData, office_address: e.target.value })}
                  className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="Ex: Bâtiment A, 2e étage, salle 12"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Affiché au patient lors de la prise de rendez-vous.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Biographie (visible dans l&apos;annuaire client)</label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="Présentation courte du praticien..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qualifications & diplômes</label>
                <textarea
                  rows={2}
                  value={formData.qualifications}
                  onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                  className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="ex: Doctorat en Médecine, Spécialisation en cardiologie..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Spécialités médicales</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl p-3 bg-gray-50/50 dark:bg-gray-800/40">
                  {specialties.length === 0 ? (
                    <p className="text-xs text-gray-400 col-span-full italic">Aucune spécialité disponible.</p>
                  ) : (
                    specialties.map((spec) => (
                      <label key={spec.id} className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.specialty_ids.includes(spec.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, specialty_ids: [...formData.specialty_ids, spec.id] });
                            } else {
                              setFormData({ ...formData, specialty_ids: formData.specialty_ids.filter((id) => id !== spec.id) });
                            }
                          }}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                        />
                        {spec.name}
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Sélection des Services */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-teal-600" />
                  Attribution aux Services Hospitaliers & Paquets de soins
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl p-3 bg-gray-50/50 dark:bg-gray-800/40">
                  {services.length === 0 ? (
                    <p className="text-xs text-gray-400 col-span-full italic">Aucun service créé. Créez d'abord des services dans "Services & Paquets".</p>
                  ) : (
                    services.map(svc => (
                      <label key={svc.id} className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={formData.service_ids.includes(svc.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({...formData, service_ids: [...formData.service_ids, svc.id]});
                            } else {
                              setFormData({...formData, service_ids: formData.service_ids.filter(id => id !== svc.id)});
                            }
                          }}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                        />
                        {svc.name}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-md transition cursor-pointer">
                  {editingDoctorId ? 'Mettre à jour le profil' : 'Enregistrer le médecin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
