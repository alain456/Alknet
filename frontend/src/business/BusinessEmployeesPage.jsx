import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Mail, Shield, UserX, Stethoscope, HeartPulse,
  FlaskConical, UserCheck, Search, CheckCircle,
  XCircle, Edit3, Sparkles, Package, Warehouse, ShoppingCart,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataGrid from '../admin/components/DataGrid';
import { useAuth } from '../context/AuthContext';
import { getBusinessCategoryKey } from '../auth/roleAccess';

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

  const { token, logout, authFetch, user } = useAuth();
  const navigate = useNavigate();
  const categoryKey = getBusinessCategoryKey(user);
  const isCommerce = categoryKey === 'commerce';

  useEffect(() => {
    if (token) {
      fetchEmployees();
      fetchRoles();
    }
  }, [token]);

  const fetchRoles = async () => {
    try {
      const response = await authFetch('/api/v1/businesses/my-business/roles/');
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
      const response = await authFetch('/api/v1/businesses/my-business/employees/');
      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      if (!response.ok) throw new Error('Échec du chargement des employés');
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
      setNewPosition('');
    }
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      const url = editingEmployeeId
        ? `/api/v1/businesses/my-business/employees/${editingEmployeeId}/`
        : '/api/v1/businesses/my-business/employees/';
      const method = editingEmployeeId ? 'PATCH' : 'POST';
      const body = editingEmployeeId
        ? { role_id: newRoleId, position: newPosition }
        : { email: newEmail, role_id: newRoleId, position: newPosition };

      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.email || errorData.detail || 'Impossible d\'enregistrer l\'employé');
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
    if (!confirm('Retirer cet employé de l\'équipe ?')) return;
    try {
      const response = await authFetch(`/api/v1/businesses/my-business/employees/${id}/`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Suppression impossible');
      fetchEmployees();
    } catch (err) {
      alert(err.message);
    }
  };

  const totalEmployees = employees.length;
  const pos = (e) => (e.position || '').toLowerCase();

  const doctorCount = employees.filter((e) => pos(e).includes('méd') || pos(e).includes('doc')).length;
  const nurseCount = employees.filter((e) => pos(e).includes('infirm')).length;
  const labCount = employees.filter((e) => pos(e).includes('lab')).length;
  const cashierCount = employees.filter((e) => pos(e).includes('caiss') || pos(e).includes('acc')).length;

  const sellerCount = employees.filter((e) => pos(e).includes('vend') || pos(e).includes('conseil')).length;
  const stockCount = employees.filter((e) => pos(e).includes('stock') || pos(e).includes('magasin')).length;
  const shopCashierCount = employees.filter((e) => pos(e).includes('caiss')).length;
  const managerCount = employees.filter((e) => pos(e).includes('manager') || pos(e).includes('gérant') || pos(e).includes('gerant')).length;

  const hospitalFilters = [
    { key: 'ALL', label: 'Tous les Agents' },
    { key: 'MÉD', label: 'Médecins' },
    { key: 'INFIRM', label: 'Infirmiers' },
    { key: 'LAB', label: 'Laboratoire' },
    { key: 'CAISS', label: 'Caisse & Reçus' },
    { key: 'ACC', label: 'Accueil / Admissions' },
  ];

  const commerceFilters = [
    { key: 'ALL', label: 'Toute l\'équipe' },
    { key: 'VEND', label: 'Vente' },
    { key: 'STOCK', label: 'Stock / Magasin' },
    { key: 'CAISS', label: 'Caisse' },
    { key: 'GÉRANT', label: 'Responsables' },
  ];

  const filterTabs = isCommerce ? commerceFilters : hospitalFilters;

  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.user_first_name || ''} ${emp.user_last_name || ''}`.toLowerCase();
    const email = (emp.user_email || '').toLowerCase();
    const position = (emp.position || '').toLowerCase();
    const search = searchQuery.toLowerCase();

    const matchesSearch = fullName.includes(search) || email.includes(search) || position.includes(search);
    if (!matchesSearch) return false;
    if (selectedCategoryFilter === 'ALL') return true;

    if (isCommerce) {
      if (selectedCategoryFilter === 'VEND') return position.includes('vend') || position.includes('conseil');
      if (selectedCategoryFilter === 'STOCK') return position.includes('stock') || position.includes('magasin');
      if (selectedCategoryFilter === 'CAISS') return position.includes('caiss');
      if (selectedCategoryFilter === 'GÉRANT') {
        return position.includes('manager') || position.includes('gérant') || position.includes('gerant') || position.includes('responsable');
      }
    }
    return position.includes(selectedCategoryFilter.toLowerCase());
  });

  const columns = [
    {
      key: 'user_first_name',
      label: isCommerce ? 'Employé' : 'Agent / Employé',
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
      ),
    },
    {
      key: 'position',
      label: 'Fonction / Poste',
      render: (val) => (
        <span className="font-semibold text-xs text-gray-800 dark:text-gray-200">
          {val || (isCommerce ? 'Employé boutique' : 'Staff médical')}
        </span>
      ),
    },
    {
      key: 'role_name',
      label: isCommerce ? 'Rôle d\'accès' : 'Rôle Système RBAC',
      render: (val) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
          <Shield className="w-3.5 h-3.5 text-teal-600" />
          {val || (isCommerce ? 'Employé' : 'Personnel standard')}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Statut',
      render: (val) => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
          val
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
        }`}
        >
          {val ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {val ? 'Actif' : 'Suspendu'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenModal(row)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition cursor-pointer"
            title="Modifier"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteEmployee(row.id)}
            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
            title="Retirer"
          >
            <UserX className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl text-white shadow-xl ${
        isCommerce
          ? 'bg-gradient-to-r from-slate-800 to-emerald-900'
          : 'bg-gradient-to-r from-teal-900 to-slate-900'
      }`}
      >
        <div>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2 ${
            isCommerce ? 'bg-emerald-500/20 text-emerald-300' : 'bg-teal-500/20 text-teal-300'
          }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isCommerce ? 'Équipe boutique' : 'Annuaire & Affectation RH'}
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className={isCommerce ? 'text-emerald-400' : 'text-teal-400'} />
            {isCommerce ? 'Gestion des employés' : 'Gestion du Personnel & Équipe Hospitalière'}
          </h1>
          <p className={`text-sm mt-1 ${isCommerce ? 'text-emerald-100' : 'text-teal-100'}`}>
            {isCommerce
              ? 'Ajoutez vos vendeurs, caissiers et magasinier, et contrôlez leurs accès à la boutique.'
              : 'Gérez le personnel de votre hôpital, assignez les rôles de sécurité (RBAC) et contrôlez les accès système.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenModal()}
          className={`flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition cursor-pointer shrink-0 ${
            isCommerce ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-teal-500 hover:bg-teal-600'
          }`}
        >
          <Plus className="w-5 h-5" />
          {isCommerce ? 'Ajouter un employé' : 'Ajouter un Agent / Employé'}
        </button>
      </div>

      {isCommerce ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Effectif" value={totalEmployees} icon={Users} tone="teal" />
          <StatCard label="Vente" value={sellerCount} icon={ShoppingCart} tone="blue" />
          <StatCard label="Stock" value={stockCount} icon={Warehouse} tone="indigo" />
          <StatCard label="Caisse" value={shopCashierCount} icon={Package} tone="amber" />
          <StatCard label="Responsables" value={managerCount} icon={UserCheck} tone="purple" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Effectif Total" value={totalEmployees} icon={Users} tone="teal" />
          <StatCard label="Médecins" value={doctorCount} icon={Stethoscope} tone="blue" />
          <StatCard label="Infirmiers" value={nurseCount} icon={HeartPulse} tone="indigo" />
          <StatCard label="Laborantins" value={labCount} icon={FlaskConical} tone="purple" />
          <StatCard label="Caisse & Accueil" value={cashierCount} icon={UserCheck} tone="amber" />
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, e-mail..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <DataGrid
          columns={columns}
          data={filteredEmployees}
          loading={loading}
          error={error}
          searchPlaceholder={isCommerce ? 'Rechercher un employé...' : 'Rechercher un membre du personnel...'}
          searchableKeys={['user_first_name', 'user_last_name', 'user_email', 'position']}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="text-teal-600" />
                {editingEmployeeId
                  ? (isCommerce ? 'Modifier l\'employé' : 'Modifier les accès de l\'agent')
                  : (isCommerce ? 'Ajouter un employé à la boutique' : 'Ajouter un agent dans l\'hôpital')}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 text-xl font-bold">
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
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Adresse e-mail du compte *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    disabled={!!editingEmployeeId}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
                    placeholder="employe@isoko.bi"
                  />
                </div>
                {!editingEmployeeId && (
                  <p className="text-[11px] text-gray-400 mt-1">L&apos;utilisateur doit déjà posséder un compte sur Isoko Hub.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Fonction / intitulé du poste</label>
                <input
                  type="text"
                  required
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  placeholder={isCommerce
                    ? 'ex: Vendeur, Caissier, Magasinier, Gérant'
                    : 'ex: Médecin Généraliste, Infirmier Major, Caissier'}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {isCommerce ? 'Rôle d\'accès' : 'Rôle système RBAC (droits d\'accès)'}
                </label>
                <select
                  required
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="" disabled>-- Sélectionner un rôle --</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                {roles.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5">
                    Aucun rôle créé pour le moment. Contactez l&apos;administrateur si besoin.
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
                  {editingEmployeeId ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  const tones = {
    teal: 'text-teal-600 bg-teal-50 dark:bg-teal-950',
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-950',
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-950',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-950',
  };
  const color = tones[tone] || tones.teal;
  const [text, bg] = [color.split(' ')[0], color.split(' ').slice(1).join(' ')];
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500">{label}</p>
          <p className={`text-2xl font-extrabold mt-1 ${text}`}>{value}</p>
        </div>
        <div className={`w-10 h-10 ${bg} ${text} rounded-xl flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
