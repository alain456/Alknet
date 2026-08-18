import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataGrid from '../admin/components/DataGrid';
import { useAuth } from '../context/AuthContext';

export default function ManageRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentRoleId, setCurrentRoleId] = useState(null);
  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [submitError, setSubmitError] = useState(null);
  
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const availablePermissions = [
    { key: 'can_manage_hospital', label: 'Administration Globale', desc: 'Gestion des médecins, des services, des tarifs et des rôles' },
    { key: 'can_view_medical_records', label: 'Consulter les Dossiers Médicaux', desc: 'Accès en lecture aux antécédents et consultations (Secret Médical)' },
    { key: 'can_edit_medical_records', label: 'Créer & Éditer Dossiers / Ordonnances', desc: 'Saisie de notes cliniques, prescriptions et demandes d\'expertise' },
    { key: 'can_access_remote_teleconsultation', label: 'Spécialiste Distant / Diaspora (Téléconsultation)', desc: 'Accès temporaire et restreint aux dossiers partagés pour avis médical ou téléconsultation' },
    { key: 'can_manage_lab_results', label: 'Gestion Laboratoire', desc: 'Saisie et validation des résultats d\'examens biologiques / imagerie' },
    { key: 'can_manage_invoices', label: 'Facturation & Caisse', desc: 'Gestion des factures et paiements des patients (sans accès clinique)' },
  ];

  useEffect(() => {
    if (token) {
      fetchRoles();
    }
  }, [token]);

  const fetchRoles = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/businesses/my-business/roles/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      setRoles(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (role = null) => {
    setSubmitError(null);
    if (role) {
      setIsEditMode(true);
      setCurrentRoleId(role.id);
      setName(role.name);
      setSelectedPermissions(role.permissions || []);
    } else {
      setIsEditMode(false);
      setCurrentRoleId(null);
      setName('');
      setSelectedPermissions([]);
    }
    setIsModalOpen(true);
  };

  const togglePermission = (key) => {
    if (selectedPermissions.includes(key)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== key));
    } else {
      setSelectedPermissions([...selectedPermissions, key]);
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Êtes-vous sûr de vouloir supprimer ce rôle ?")) return;
    try {
      const response = await fetch(`http://localhost:8000/api/v1/businesses/my-business/roles/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete role');
      fetchRoles();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      const url = isEditMode 
        ? `http://localhost:8000/api/v1/businesses/my-business/roles/${currentRoleId}/`
        : 'http://localhost:8000/api/v1/businesses/my-business/roles/';
      
      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, permissions: selectedPermissions })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.name || errorData.detail || 'Failed to save role');
      }
      setIsModalOpen(false);
      fetchRoles();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const columns = [
    { 
      key: 'name', 
      label: 'Nom du Rôle',
      render: (val) => (
        <span className="font-bold text-white bg-slate-800 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 shadow-sm inline-block">
          {val}
        </span>
      )
    },
    { 
      key: 'permissions', 
      label: 'Permissions Accordées',
      render: (perms) => {
        const permList = Array.isArray(perms) ? perms : [];
        if (permList.length === 0) {
          return <span className="text-xs text-gray-400 italic">Aucune permission spécifique</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {permList.map(pKey => {
              const pObj = availablePermissions.find(item => item.key === pKey);
              return (
                <span key={pKey} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                  <Shield className="w-3 h-3" />
                  {pObj ? pObj.label : pKey}
                </span>
              );
            })}
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <button onClick={() => handleOpenModal(row)} className="text-gray-500 hover:text-primary transition cursor-pointer">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700 transition cursor-pointer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Gestion des Rôles & Permissions
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Créez des rôles sur-mesure et cochez exactement les droits d'accès système autorisés.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg font-medium shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nouveau Rôle
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <DataGrid 
          columns={columns}
          data={roles}
          loading={loading}
          error={error}
          searchPlaceholder="Rechercher un rôle..."
          searchableKeys={['name']}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {isEditMode ? 'Modifier le Rôle' : 'Créer un Rôle sur-mesure'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 cursor-pointer">
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {submitError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
                  {submitError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom du Rôle (Intitulé)</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="ex: Infirmier Major, Caissier de Nuit, Laborantin"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Permissions Granulaires (Cochez les accès système autorisés) :
                </label>
                
                <div className="space-y-3">
                  {availablePermissions.map((perm) => {
                    const isChecked = selectedPermissions.includes(perm.key);
                    return (
                      <div 
                        key={perm.key} 
                        onClick={() => togglePermission(perm.key)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                          isChecked 
                            ? 'border-primary bg-primary/5 dark:bg-primary/10' 
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                        }`}
                      >
                        <div className="mt-0.5 text-primary">
                          {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-400" />}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">{perm.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{perm.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-primary hover:bg-secondary text-white font-medium rounded-lg transition shadow-sm cursor-pointer"
                >
                  {isEditMode ? 'Mettre à jour' : 'Enregistrer le Rôle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
