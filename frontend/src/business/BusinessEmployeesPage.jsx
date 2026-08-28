import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Mail, Shield, UserX, Stethoscope, HeartPulse, 
  FlaskConical, Receipt, UserCheck, Search, Filter, CheckCircle, 
  XCircle, Edit3, Sparkles, Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataGrid from '../admin/components/DataGrid';
import { useAuth } from '../context/AuthContext';

export default function BusinessEmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [submitError, setSubmitError] = useState(null);
  
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { token, logout, authFetch } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      fetchEmployees();
      fetchRoles();
    }
  }, [token]);

  const fetchRoles = async () => {
    try {
      const response = await authFetch('http://localhost:8000/api/v1/businesses/my-business/roles/');
      if (response.status === 401) {
        setError('Votre session a expiré. Veuillez vous déconnecter et vous reconnecter.');
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await authFetch('http://localhost:8000/api/v1/businesses/my-business/employees/');
      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) throw new Error('Échec du chargement des membres du personnel');
      const data = await response.json();
      setEmployees(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (employee = null) => {
    setSubmitError(null);
    if (employee) {
      setEditingEmployeeId(employee.id);
      setNewEmail(employee.user_email || '');
      setNewRoleId(employee.role || '');
      setNewPosition(employee.position || '');
    } else {
      setEditingEmployeeId(null);
      setNewEmail('');
      setNewRoleId('');
      setNewPosition('Staff Médical');
    }
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      const url = editingEmployeeId 
        ? `http://localhost:8000/api/v1/businesses/my-business/employees/${editingEmployeeId}/`
        : 'http://localhost:8000/api/v1/businesses/my-business/employees/';
      
      const method = editingEmployeeId ? 'PATCH' : 'POST';
      const payload = editingEmployeeId 
        ? { role_id: newRoleId, position: newPosition }
        : { email: newEmail, role_id: newRoleId, position: newPosition };

      const response = await authFetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.email || errorData.detail || 'Impossible d\'enregistrer le membre du personnel');
      }
      setIsModalOpen(false);
      setNewEmail('');
      setNewRoleId('');
      setNewPosition('');
      fetchEmployees();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir retirer cet employé de l'établissement ?")) return;
    try {
      const response = await authFetch(`http://localhost:8000/api/v1/businesses/my-business/employees/${id}/`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Impossible de supprimer cet employé');
      fetchEmployees();
    } catch (err) {
      alert(err.message);
    }
  };

  // Statistiques de l'équipe
  const totalEmployees = employees.length;
  const doctorCount = employees.filter(e => (e.position || '').toLowerCase().includes('méd') || (e.position || '').toLowerCase().includes('doc')).length;
  const nurseCount = employees.filter(e => (e.position || '').toLowerCase().includes('infirm')).length;
  const labCount = employees.filter(e => (e.position || '').toLowerCase().includes('lab')).length;
  const cashierCount = employees.filter(e => (e.position || '').toLowerCase().includes('caiss') || (e.position || '').toLowerCase().includes('acc')).length;

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.user_first_name || ''} ${emp.user_last_name || ''}`.toLowerCase();
    const email = (emp.user_email || '').toLowerCase();
    const pos = (emp.position || '').toLowerCase();
    const search = searchQuery.toLowerCase();
    
    const matchesSearch = fullName.includes(search) || email.includes(search) || pos.includes(search);
    
    if (!matchesSearch) return false;
    if (selectedCategoryFilter === 'ALL') return true;
    return pos.includes(selectedCategoryFilter.toLowerCase());
  });

  const columns = [
    { 
      key: 'user_first_name', 
      label: 'Agent / Employé', 
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center text-xs border border-teal-200 dark:border-teal-800">
            {val ? val.charAt(0).toUpperCase() : (row.user_email ? row.user_email.charAt(0).toUpperCase() : 'A')}
          </div>
          <div>
            <div className="font-bold text-gray-900 dark:text-white text-xs">
              {val} {row.user_last_name}
            </div>
            <div className="text-[11px] text-gray-400">{row.user_email}</div>
          </div>
        </div>
      )
    },
    { 
      key: 'position', 
      label: 'Fonction / Post',
      render: (val) => (
        <span className="font-semibold text-xs text-gray-800 dark:text-gray-200">
          {val || 'Staff Médical'}
        </span>
      )
    },
    { 
      key: 'role_name', 
      label: 'Rôle Système RBAC',
      render: (val, row) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
          <Shield className="w-3.5 h-3.5 text-teal-600" />
          {val || 'Personnel Standard'}
        </span>
      )
    },
    { 
      key: 'is_active', 
      label: 'Statut Compte',
      render: (val) => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
          val 
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
        }`}>
          {val ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {val ? 'Actif' : 'Suspendu'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleOpenModal(row)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition cursor-pointer" 
            title="Modifier le rôle / fonction"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDeleteEmployee(row.id)}
            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer" 
            title="Retirer l'employé"
          >
            <UserX className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* En-tête de la page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Module 01.3 — Annuaire & Affectation RH
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="text-teal-400" />
            Gestion du Personnel & Équipe Hospitalière
          </h1>
          <p className="text-teal-100 text-sm mt-1">Gérez le personnel de votre hôpital, assignez les rôles de sécurité (RBAC) et contrôlez les accès système.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/30 transition cursor-pointer shrink-0"
        >
          <Plus className="w-5 h-5" /> Ajouter un Agent / Employé
        </button>
      </div>

      {/* Cartes de Statistiques RH */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Effectif Total</p>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{totalEmployees}</p>
            </div>
            <div className="w-10 h-10 bg-teal-50 dark:bg-teal-950 text-teal-600 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Médecins</p>
              <p className="text-2xl font-extrabold text-blue-600 mt-1">{doctorCount}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Infirmiers</p>
              <p className="text-2xl font-extrabold text-indigo-600 mt-1">{nurseCount}</p>
            </div>
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl flex items-center justify-center">
              <HeartPulse className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Laborantins</p>
              <p className="text-2xl font-extrabold text-purple-600 mt-1">{labCount}</p>
            </div>
            <div className="w-10 h-10 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded-xl flex items-center justify-center">
              <FlaskConical className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Caisse & Accueil</p>
              <p className="text-2xl font-extrabold text-amber-600 mt-1">{cashierCount}</p>
            </div>
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-xl flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche et Filtres par Catégorie */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {[
            { key: 'ALL', label: 'Tous les Agents' },
            { key: 'MÉD', label: 'Médecins' },
            { key: 'INFIRM', label: 'Infirmiers' },
            { key: 'LAB', label: 'Laboratoire' },
            { key: 'CAISS', label: 'Caisse & Reçus' },
            { key: 'ACC', label: 'Accueil / Admissions' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedCategoryFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedCategoryFilter === tab.key
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, e-mail..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* DataGrid du personnel */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <DataGrid 
          columns={columns}
          data={filteredEmployees}
          loading={loading}
          error={error}
          searchPlaceholder="Rechercher un membre du personnel..."
          searchableKeys={['user_first_name', 'user_last_name', 'user_email', 'position']}
        />
      </div>

      {/* Modal d'Ajout ou de Modification d'un Employé */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="text-teal-600" />
                {editingEmployeeId ? 'Modifier les Accès de l\'Agent' : 'Ajouter un Agent dans l\'Hôpital'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 text-xl font-bold">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSaveEmployee} className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100">
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Adresse E-mail du Compte User *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="email" 
                    required
                    disabled={!!editingEmployeeId}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
                    placeholder="agent@isoko.bi"
                  />
                </div>
                {!editingEmployeeId && (
                  <p className="text-[11px] text-gray-400 mt-1">L'utilisateur doit déjà posséder un compte sur Isoko Hub.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Fonction / Intitulé du Poste</label>
                <input 
                  type="text"
                  required
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  placeholder="ex: Médecin Généraliste, Infirmier Major, Caissier"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Rôle Système RBAC (Droits d'Accès)</label>
                <select 
                  required
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="" disabled>-- Sélectionner un Rôle Système --</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                {roles.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5">
                    Aucun rôle système créé. Allez dans "Rôles & Permissions" pour en définir un.
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/30 transition cursor-pointer"
                >
                  {editingEmployeeId ? 'Mettre à jour' : 'Ajouter le membre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
