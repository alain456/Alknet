import React, { useState, useEffect } from 'react';
import { Stethoscope, Plus, Mail, CreditCard, Video, Clock, Shield, HeartPulse, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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
    medical_license_number: '', consultation_fee: 0, 
    is_available_for_telemedicine: false, bio: '',
    specialty_ids: [], service_ids: [], role_id: ''
  });
  
  const { token, authFetch } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      try {
        const busRes = await authFetch('http://localhost:8000/api/v1/businesses/me/');
        if (busRes.ok) {
          const businesses = await busRes.json();
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
      const res = await fetch('http://localhost:8000/api/v1/businesses/my-business/roles/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRoles(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSpecialties = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/hospital/specialties/');
      if (res.ok) {
        setSpecialties(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchServices = async (hid) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/services/?hospital=${hid}`);
      if (res.ok) {
        setServices(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDoctors = async (hid) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:8000/api/v1/hospital/doctors/?hospital=${hid}`);
      if (res.ok) {
        setDoctors(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Open Modal for Creating Doctor
  const openCreateModal = () => {
    setEditingDoctorId(null);
    setFormData({ 
      first_name: '', last_name: '', email: '', password: '', 
      medical_license_number: '', consultation_fee: 0, 
      is_available_for_telemedicine: false, bio: '',
      specialty_ids: [], service_ids: [], role_id: ''
    });
    setIsModalOpen(true);
  };

  // Open Modal for Editing Doctor
  const openEditModal = (doc) => {
    setEditingDoctorId(doc.id);
    const existingServiceIds = doc.services ? doc.services.map(s => s.id) : [];
    const existingSpecialtyIds = doc.specialties ? doc.specialties.map(s => s.id) : [];

    setFormData({ 
      first_name: doc.user_details?.first_name || '', 
      last_name: doc.user_details?.last_name || '', 
      email: doc.user_details?.email || '', 
      password: '', // Optionnel lors de la modification
      medical_license_number: doc.medical_license_number || '', 
      consultation_fee: doc.consultation_fee || 0, 
      is_available_for_telemedicine: doc.is_available_for_telemedicine || false, 
      bio: doc.bio || '',
      specialty_ids: existingSpecialtyIds, 
      service_ids: existingServiceIds, 
      role_id: doc.user_details?.role_id || ''
    });
    setIsModalOpen(true);
  };

  // Delete Doctor Profile
  const handleDeleteDoctor = async (id, doctorName) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le profil de ${doctorName} ? cette action est irréversible.`)) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/doctors/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchDoctors(hospitalId);
      } else {
        alert("Erreur lors de la suppression du médecin.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save (Create or Update) Doctor
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const url = editingDoctorId
        ? `http://localhost:8000/api/v1/hospital/doctors/${editingDoctorId}/`
        : 'http://localhost:8000/api/v1/hospital/doctors/';
      
      const method = editingDoctorId ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        hospital: hospitalId
      };

      // Si c'est une édition et que le mot de passe est vide, on ne l'envoie pas
      if (editingDoctorId && !payload.password) {
        delete payload.password;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchDoctors(hospitalId);
      } else {
        const err = await res.json();
        alert("Erreur lors de l'enregistrement : " + JSON.stringify(err));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-teal-600 dark:text-teal-400" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-500">Chargement du corps médical...</div>
        ) : doctors.length === 0 && hospitalId ? (
          <div className="col-span-full py-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8">
            <Stethoscope className="w-12 h-12 text-teal-500 mx-auto mb-3 opacity-50" />
            <p className="text-gray-500 font-medium">Aucun médecin enregistré pour le moment.</p>
            <button 
              onClick={openCreateModal}
              className="mt-4 text-teal-600 hover:underline text-sm font-semibold inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Enregistrer le premier médecin
            </button>
          </div>
        ) : (
          doctors.map(doc => {
            const docFullName = `${doc.user_details?.first_name || ''} ${doc.user_details?.last_name || ''}`;
            return (
              <div key={doc.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-extrabold text-lg border border-teal-200 dark:border-teal-800 shrink-0">
                        {doc.user_details?.first_name?.[0] || 'D'}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base">
                          {docFullName}
                        </h3>
                        <p className="text-xs text-gray-400 font-mono">Licence: {doc.medical_license_number}</p>
                      </div>
                    </div>

                    {/* Actions CRUD (Modifier & Supprimer) */}
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openEditModal(doc)}
                        title="Modifier les informations du médecin"
                        className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg transition cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteDoctor(doc.id, docFullName)}
                        title="Supprimer ce médecin"
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Badge Rôle RBAC */}
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      Rôle : {doc.user_details?.role_name || 'Médecin'}
                    </span>
                  </div>

                  {/* Info Contact & Consultation */}
                  <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300 mb-4">
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400" /> {doc.user_details?.email}
                    </p>
                    <p className="flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-gray-400" /> 
                      <span className="font-semibold text-gray-900 dark:text-white">{Number(doc.consultation_fee).toLocaleString()} BIF</span> / consultation
                    </p>
                    {doc.is_available_for_telemedicine && (
                      <p className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-medium">
                        <Video className="w-3.5 h-3.5" /> Téléconsultation (Vidéo) active
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
                  <input 
                    type="password" 
                    required={!editingDoctorId}
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                    className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600" 
                    placeholder="••••••••" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Numéro de Licence Médicale</label>
                  <input type="text" required value={formData.medical_license_number} onChange={e => setFormData({...formData, medical_license_number: e.target.value})} className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600" placeholder="ex: MED-2026-88" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frais de consultation (BIF)</label>
                  <input type="number" required value={formData.consultation_fee} onChange={e => setFormData({...formData, consultation_fee: e.target.value})} className="w-full px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-teal-600" />
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
                  onChange={e => setFormData({...formData, role_id: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-600 outline-none"
                >
                  <option value="">-- Sélectionner un Rôle (Optionnel) --</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Définit les droits du médecin (Consulter dossiers, prescriptions, téléexpertise...)</p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={formData.is_available_for_telemedicine} onChange={e => setFormData({...formData, is_available_for_telemedicine: e.target.checked})} className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ce médecin effectue des téléconsultations (Vidéo)</span>
                </label>
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
