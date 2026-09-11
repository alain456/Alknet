import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, CheckSquare, Square, UserCheck, Sparkles } from 'lucide-react';
import DataGrid from '../admin/components/DataGrid';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';
import { RECEPTIONIST_PERMISSIONS } from '../auth/roleAccess';
import hospitalService from '../hospital/hospitalService';

const ACCESS_LEVEL_OPTIONS = [
  { value: 'ADMIN_ACCESS', label: 'Administrateur hôpital' },
  { value: 'RECEPTIONIST_ACCESS', label: 'Agent d\'accueil / Réception' },
  { value: 'MEDICAL_ACCESS', label: 'Médical (médecins)' },
  { value: 'LAB_ACCESS', label: 'Laboratoire' },
  { value: 'CASHIER_ACCESS', label: 'Caisse & facturation' },
  { value: 'STAFF_ACCESS', label: 'Staff standard' },
];

const availablePermissions = [
  { key: 'can_manage_hospital', label: 'Administration globale', desc: 'Gestion médecins, services, tarifs et rôles' },
  { key: 'can_view_medical_records', label: 'Consulter dossiers médicaux', desc: 'Lecture des antécédents (secret médical)' },
  { key: 'can_edit_medical_records', label: 'Créer & éditer dossiers', desc: 'Notes cliniques et prescriptions' },
  { key: 'can_manage_lab_results', label: 'Laborantin — résultats', desc: 'Création et workflow labo jusqu’à notification patient (pas l’admin)' },
  { key: 'can_manage_invoices', label: 'Facturation & caisse', desc: 'Factures et paiements (sans accès clinique)' },
  ...RECEPTIONIST_PERMISSIONS.map((p) => ({ key: p.key, label: p.label, desc: 'Permission rendez-vous — agent d\'accueil' })),
];

export default function ManageRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentRoleId, setCurrentRoleId] = useState(null);
  const [name, setName] = useState('');
  const [systemAccessLevel, setSystemAccessLevel] = useState('STAFF_ACCESS');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [submitError, setSubmitError] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) fetchRoles();
  }, [isAuthenticated]);

  const fetchRoles = async () => {
    try {
      const data = await api.get('businesses/my-business/roles/', { auth: true });
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedReceptionist = async () => {
    setSeeding(true);
    try {
      await hospitalService.seedReceptionistRole();
      await fetchRoles();
      alert('Rôle « Agent d\'accueil » créé avec toutes les permissions de réception.');
    } catch (err) {
      alert(err.message || 'Erreur');
    } finally {
      setSeeding(false);
    }
  };

  const handleOpenModal = (role = null) => {
    setSubmitError(null);
    if (role) {
      setIsEditMode(true);
      setCurrentRoleId(role.id);
      setName(role.name);
      setSystemAccessLevel(role.system_access_level || 'STAFF_ACCESS');
      setSelectedPermissions(role.permissions || []);
    } else {
      setIsEditMode(false);
      setCurrentRoleId(null);
      setName('');
      setSystemAccessLevel('STAFF_ACCESS');
      setSelectedPermissions([]);
    }
    setIsModalOpen(true);
  };

  const applyReceptionistTemplate = () => {
    setName('Agent d\'accueil');
    setSystemAccessLevel('RECEPTIONIST_ACCESS');
    setSelectedPermissions(RECEPTIONIST_PERMISSIONS.map((p) => p.key));
  };

  const togglePermission = (key) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce rôle ?')) return;
    try {
      await api.delete(`businesses/my-business/roles/${id}/`, { auth: true });
      fetchRoles();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      const payload = { name, permissions: selectedPermissions, system_access_level: systemAccessLevel };
      if (isEditMode) {
        await api.put(`businesses/my-business/roles/${currentRoleId}/`, payload, { auth: true });
      } else {
        await api.post('businesses/my-business/roles/', payload, { auth: true });
      }
      setIsModalOpen(false);
      fetchRoles();
    } catch (err) {
      setSubmitError(err.message || 'Erreur de sauvegarde');
    }
  };

  const permLabel = (key) => availablePermissions.find((p) => p.key === key)?.label || key;

  const columns = [
    {
      key: 'name',
      label: 'Nom du rôle',
      render: (val, row) => (
        <div>
          <span className="font-bold text-gray-900 dark:text-white">{val}</span>
          {row.system_access_level === 'RECEPTIONIST_ACCESS' && (
            <span className="ml-2 text-[10px] font-bold bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">Accueil</span>
          )}
        </div>
      ),
    },
    {
      key: 'system_access_level',
      label: 'Niveau d\'accès',
      render: (val) => {
        const opt = ACCESS_LEVEL_OPTIONS.find((o) => o.value === val);
        return <span className="text-xs text-gray-600">{opt?.label || val}</span>;
      },
    },
    {
      key: 'permissions',
      label: 'Permissions accordées',
      render: (perms) => {
        const permList = Array.isArray(perms) ? perms : [];
        if (permList.length === 0) {
          return <span className="text-xs text-gray-400 italic">Aucune</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {permList.slice(0, 4).map((pKey) => (
              <span key={pKey} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                <Shield className="w-3 h-3" />
                {permLabel(pKey)}
              </span>
            ))}
            {permList.length > 4 && (
              <span className="text-[10px] text-gray-400">+{permList.length - 4}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => handleOpenModal(row)} className="text-gray-500 hover:text-primary">
            <Edit2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const hasReceptionistRole = roles.some(
    (r) => r.system_access_level === 'RECEPTIONIST_ACCESS' || r.name === 'Agent d\'accueil'
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Rôles & Permissions
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Créez le rôle Agent d'accueil et assignez-le au personnel de réception.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!hasReceptionistRole && (
            <button
              type="button"
              onClick={handleSeedReceptionist}
              disabled={seeding}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              <UserCheck className="w-4 h-4" />
              {seeding ? 'Création...' : 'Créer rôle Agent d\'accueil'}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> Nouveau rôle
          </button>
        </div>
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-sm text-teal-900">
        <p className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" /> Agent d'accueil — permissions MVP</p>
        <ul className="mt-2 grid sm:grid-cols-2 gap-1 text-xs">
          {RECEPTIONIST_PERMISSIONS.map((p) => (
            <li key={p.key}>• {p.label}</li>
          ))}
        </ul>
        <p className="text-xs text-teal-700 mt-2">
          Assignez ce rôle dans « Gestion du Personnel », puis connectez-vous avec ce compte → Dashboard réceptionniste.
        </p>
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {isEditMode ? 'Modifier le rôle' : 'Créer un rôle'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {submitError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{submitError}</div>
              )}

              {!isEditMode && (
                <button
                  type="button"
                  onClick={applyReceptionistTemplate}
                  className="w-full py-2 text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-xl hover:bg-teal-100"
                >
                  Appliquer le modèle « Agent d'accueil »
                </button>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom du rôle</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                  placeholder="ex: Agent d'accueil"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Niveau d'accès système</label>
                <select
                  value={systemAccessLevel}
                  onChange={(e) => setSystemAccessLevel(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg text-sm"
                >
                  {ACCESS_LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Permissions accordées
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availablePermissions.map((perm) => {
                    const isChecked = selectedPermissions.includes(perm.key);
                    return (
                      <div
                        key={perm.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => togglePermission(perm.key)}
                        onKeyDown={(e) => e.key === 'Enter' && togglePermission(perm.key)}
                        className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 ${
                          isChecked ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="mt-0.5 text-primary">
                          {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-400" />}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{perm.label}</div>
                          <div className="text-xs text-gray-500">{perm.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600">
                  Annuler
                </button>
                <button type="submit" className="px-4 py-2 bg-primary text-white font-medium rounded-lg text-sm">
                  {isEditMode ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
