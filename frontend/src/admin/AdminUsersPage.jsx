import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, UserCheck, UserX, Mail, Shield, Plus, Edit2, Trash2, Power, 
  Building2, Users, Briefcase, Key, RefreshCw, AlertCircle, LayoutGrid, List, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState('ALL'); // 'ALL', 'INDEPENDENT', or business_id
  const [viewMode, setViewMode] = useState('LIST'); // 'LIST' or 'GROUPED'

  // User Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone_number: '',
    role: 'PROFESSIONAL',
    is_active: true,
    business_id: '',
    business_relationship: 'EMPLOYEE'
  });

  // Password Reset Modal (Quick Action)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [targetPasswordUser, setTargetPasswordUser] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState(null);

  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { token, logout } = useAuth();

  useEffect(() => {
    if (token) {
      fetchUsersAndBusinesses();
    }
  }, [token]);

  const fetchUsersAndBusinesses = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Users (dynamic real-time data)
      const usersRes = await fetch('http://localhost:8000/api/v1/accounts/admin/users/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (usersRes.status === 401) {
        logout();
        return;
      }
      if (!usersRes.ok) throw new Error('Erreur lors du chargement des utilisateurs');
      const usersData = await usersRes.json();

      // 2. Fetch Businesses
      let bizData = [];
      try {
        const bizRes = await fetch('http://localhost:8000/api/v1/businesses/admin/list/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (bizRes.ok) {
          bizData = await bizRes.json();
        } else {
          const pubRes = await fetch('http://localhost:8000/api/v1/businesses/');
          if (pubRes.ok) bizData = await pubRes.json();
        }
      } catch (e) {
        console.warn('Impossible de charger la liste des entreprises', e);
      }

      setUsers(usersData);
      setBusinesses(Array.isArray(bizData) ? bizData : (bizData.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const url = editingUser 
        ? `http://localhost:8000/api/v1/accounts/admin/users/${editingUser.id}/`
        : 'http://localhost:8000/api/v1/accounts/admin/users/create/';
      const method = editingUser ? 'PATCH' : 'POST';

      const payload = { ...formData };
      if (editingUser && !payload.password) {
        delete payload.password;
      }

      if (!payload.business_id) {
        payload.business_id = null;
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(typeof errData === 'object' ? JSON.stringify(errData) : 'Erreur lors de la sauvegarde');
      }

      setIsModalOpen(false);
      setEditingUser(null);
      resetForm();
      fetchUsersAndBusinesses();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickPasswordReset = async (e) => {
    e.preventDefault();
    if (!targetPasswordUser || !newPasswordValue) return;
    setSubmitError(null);
    setIsSubmitting(true);
    setPasswordSuccessMsg(null);

    try {
      const response = await fetch(`http://localhost:8000/api/v1/accounts/admin/users/${targetPasswordUser.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPasswordValue })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(typeof errData === 'object' ? JSON.stringify(errData) : 'Erreur lors de la réinitialisation');
      }

      setPasswordSuccessMsg(`Mot de passe mis à jour avec succès pour ${targetPasswordUser.email} !`);
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setTargetPasswordUser(null);
        setNewPasswordValue('');
        setPasswordSuccessMsg(null);
      }, 1500);
      fetchUsersAndBusinesses();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      phone_number: '',
      role: 'PROFESSIONAL',
      is_active: true,
      business_id: '',
      business_relationship: 'EMPLOYEE'
    });
  };

  const openCreateModal = () => {
    setEditingUser(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      password: '',
      phone_number: user.phone_number || '',
      role: user.role || 'PROFESSIONAL',
      is_active: user.is_active !== undefined ? user.is_active : true,
      business_id: user.business_info ? user.business_info.id : '',
      business_relationship: user.business_info ? (user.business_info.relationship || 'EMPLOYEE') : 'EMPLOYEE'
    });
    setIsModalOpen(true);
  };

  const openPasswordModal = (user) => {
    setTargetPasswordUser(user);
    setNewPasswordValue('');
    setSubmitError(null);
    setPasswordSuccessMsg(null);
    setIsPasswordModalOpen(true);
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.")) return;
    try {
      const response = await fetch(`http://localhost:8000/api/v1/accounts/admin/users/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Erreur lors de la suppression");
      fetchUsersAndBusinesses();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (user) => {
    const actionName = user.is_active ? 'suspendre' : 'activer';
    if (!window.confirm(`Êtes-vous sûr de vouloir ${actionName} cet utilisateur ?`)) return;
    try {
      const response = await fetch(`http://localhost:8000/api/v1/accounts/admin/users/${user.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !user.is_active })
      });
      if (!response.ok) throw new Error("Erreur lors du changement de statut");
      fetchUsersAndBusinesses();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExportCSV = () => {
    if (!users || users.length === 0) return;
    const headers = ["ID", "Nom Complet", "Email", "Téléphone", "Rôle Système", "Entreprise", "Fonction Entreprise", "Statut Actif", "Inscrit Le"];
    const rows = users.map(u => [
      u.id,
      `"${u.first_name || ''} ${u.last_name || ''}"`,
      `"${u.email}"`,
      `"${u.phone_number || ''}"`,
      u.role,
      `"${u.business_info ? u.business_info.name : 'Indépendant / Aucun'}"`,
      `"${u.business_info ? u.business_info.role_name : '-'}"`,
      u.is_active ? "Actif" : "Suspendu",
      new Date(u.created_at).toLocaleDateString('fr-FR')
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `isoko_utilisateurs_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtering users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.business_info && user.business_info.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedBusinessFilter === 'ALL') return true;
    if (selectedBusinessFilter === 'INDEPENDENT') return !user.business_info;
    return user.business_info && user.business_info.id === selectedBusinessFilter;
  });

  // Grouping users by Business
  const groupedUsers = {};
  filteredUsers.forEach(u => {
    const bizKey = u.business_info ? u.business_info.name : 'Sans Entreprise / Indépendants';
    if (!groupedUsers[bizKey]) {
      groupedUsers[bizKey] = {
        name: bizKey,
        businessId: u.business_info ? u.business_info.id : null,
        members: []
      };
    }
    groupedUsers[bizKey].members.push(u);
  });

  const getRoleBadgeStyle = (role) => {
    switch(role) {
      case 'SUPER_ADMIN':
      case 'MODERATOR':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200 border border-purple-200 dark:border-purple-800';
      case 'BUSINESS_OWNER':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800';
      case 'PROFESSIONAL':
      case 'MERCHANT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border border-blue-200 dark:border-blue-800';
      default:
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800';
    }
  };

  // Stats calculation
  const totalUsers = users.length;
  const usersWithBusiness = users.filter(u => u.business_info).length;
  const independentUsers = totalUsers - usersWithBusiness;
  const activeCount = users.filter(u => u.is_active).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-4">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 via-green-900 to-teal-900 p-6 rounded-2xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-gold-400" />
            <h1 className="text-2xl font-bold tracking-tight">Gestion Dynamique des Utilisateurs & Entreprises</h1>
          </div>
          <p className="text-green-100/80 text-sm mt-1">
            Super Administrateur — Contrôle centralisé, modification instantanée et gestion des accès/mots de passe.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchUsersAndBusinesses}
            className="px-3 py-2 flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white rounded-xl transition cursor-pointer"
            title="Rafraîchir les données en direct"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </button>
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 flex items-center gap-2 text-xs font-semibold bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white rounded-xl transition shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" /> Exporter CSV
          </button>
          <button 
            onClick={openCreateModal}
            className="px-4 py-2 flex items-center gap-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-xl transition shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nouveau Compte
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-[#1A2E25] border border-gray-200 dark:border-white/10 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-800/40 text-green-700 dark:text-green-300 flex items-center justify-center font-bold text-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</div>
            <div className="text-xs text-gray-500 dark:text-green-100/70 font-medium">Total Comptes Plateforme</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#1A2E25] border border-gray-200 dark:border-white/10 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{usersWithBusiness}</div>
            <div className="text-xs text-gray-500 dark:text-green-100/70 font-medium">Rattachés à une Entreprise</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#1A2E25] border border-gray-200 dark:border-white/10 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-lg">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{independentUsers}</div>
            <div className="text-xs text-gray-500 dark:text-green-100/70 font-medium">Indépendants / Clients</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#1A2E25] border border-gray-200 dark:border-white/10 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-lg">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{activeCount}</div>
            <div className="text-xs text-gray-500 dark:text-green-100/70 font-medium">Comptes Actifs & Connectés</div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="border border-gray-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#1A2E25] overflow-hidden shadow-sm flex flex-col">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-black/10">
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Rechercher par nom, email ou entreprise..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-green-900/50 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-green-600 transition"
              />
            </div>

            {/* Enterprise Filter */}
            <div className="relative w-full sm:w-60">
              <select
                value={selectedBusinessFilter}
                onChange={(e) => setSelectedBusinessFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-green-900/50 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white font-medium outline-none focus:border-green-600 transition"
              >
                <option value="ALL">🏢 Toutes les Entreprises</option>
                <option value="INDEPENDENT">👤 Indépendants / Sans Entreprise</option>
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>📍 {b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-200 dark:bg-white/10 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${viewMode === 'LIST' ? 'bg-white dark:bg-green-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-green-100/70 hover:text-gray-900'}`}
            >
              <List className="w-3.5 h-3.5" /> Liste Globale
            </button>
            <button
              onClick={() => setViewMode('GROUPED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${viewMode === 'GROUPED' ? 'bg-white dark:bg-green-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-green-100/70 hover:text-gray-900'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Par Entreprise
            </button>
          </div>

        </div>

        {/* Content View */}
        {loading ? (
          <div className="p-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
            <p className="mt-2 text-xs text-gray-500 dark:text-green-100/70 font-medium">Synchronisation dynamique des données...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600 font-medium text-sm flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-500" />
            Erreur lors du chargement : {error}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-gray-500 dark:text-green-100/60 text-sm">
            Aucun utilisateur ne correspond à vos critères.
          </div>
        ) : viewMode === 'LIST' ? (
          /* ================= DATAGRID VIEW ================= */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10 text-[11px] text-gray-500 dark:text-green-100/50 uppercase tracking-wider bg-gray-50/50 dark:bg-black/5 font-semibold">
                  <th className="px-6 py-4">Utilisateur</th>
                  <th className="px-6 py-4">Entreprise & Fonction</th>
                  <th className="px-6 py-4">Rôle Système</th>
                  <th className="px-6 py-4">Mot de Passe</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Inscrit le</th>
                  <th className="px-6 py-4 text-right">Actions Super Admin</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-gray-200 dark:divide-white/10 text-xs">
                {filteredUsers.map((user) => {
                  const date = new Date(user.created_at);
                  const formattedDate = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

                  return (
                    <tr key={user.id} className="hover:bg-green-50/40 dark:hover:bg-white/5 transition group">
                      {/* User Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-green-800/60 text-emerald-800 dark:text-green-100 font-bold flex items-center justify-center shrink-0">
                            {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white text-sm">
                              {user.first_name || user.last_name ? `${user.first_name} ${user.last_name}` : 'Utilisateur'}
                            </div>
                            <div className="text-gray-500 dark:text-green-100/60 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3" /> {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Business Attachment */}
                      <td className="px-6 py-4">
                        {user.business_info ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              {user.business_info.name}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-green-100/70 font-medium">
                              {user.business_info.role_name} ({user.business_info.relationship === 'OWNER' ? 'Propriétaire' : 'Staff'})
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400 dark:text-green-100/40 italic">
                            Indépendant / Aucun
                          </span>
                        )}
                      </td>

                      {/* System Role */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${getRoleBadgeStyle(user.role)}`}>
                          {user.role}
                        </span>
                      </td>

                      {/* Password Security Status */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => openPasswordModal(user)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-800 dark:bg-white/10 dark:hover:bg-amber-900/40 dark:text-green-100 transition border border-gray-200 dark:border-white/10 cursor-pointer"
                          title="Cliquez pour changer le mot de passe immédiatement"
                        >
                          <Lock className="w-3 h-3 text-amber-600" />
                          <span>Haché (PBKDF2)</span>
                          <Key className="w-3 h-3 text-amber-600 ml-0.5" />
                        </button>
                      </td>

                      {/* Active Status */}
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full text-[11px]">
                            <UserCheck className="w-3.5 h-3.5" /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-full text-[11px]">
                            <UserX className="w-3.5 h-3.5" /> Suspendu
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="px-6 py-4 text-gray-500 dark:text-green-100/80 font-mono">
                        {formattedDate}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button 
                            onClick={() => openPasswordModal(user)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition"
                            title="Modifier le mot de passe"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => openEditModal(user)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                            title="Modifier tout le profil"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(user)}
                            className={`p-1.5 rounded-lg transition ${user.is_active ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}
                            title={user.is_active ? 'Suspendre' : 'Activer'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                            title="Supprimer le compte"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ================= GROUPED BY ENTERPRISE VIEW ================= */
          <div className="p-6 space-y-6">
            {Object.keys(groupedUsers).map((bizName) => {
              const group = groupedUsers[bizName];
              return (
                <div key={bizName} className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-black/20">
                  {/* Group Header */}
                  <div className="px-5 py-4 bg-white dark:bg-[#1A2E25] border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                          {bizName}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-green-100/70 font-medium">
                          {group.members.length} membre(s) rattaché(s)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Members Grid inside Group */}
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.members.map((user) => (
                      <div key={user.id} className="p-4 bg-white dark:bg-[#1A2E25] border border-gray-200 dark:border-white/10 rounded-xl shadow-sm hover:border-green-600 transition flex flex-col justify-between space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-green-800/60 text-emerald-800 dark:text-green-100 font-bold flex items-center justify-center shrink-0">
                              {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white text-sm">
                                {user.first_name || user.last_name ? `${user.first_name} ${user.last_name}` : 'Utilisateur'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-green-100/60 flex items-center gap-1 mt-0.5">
                                <Mail className="w-3 h-3" /> {user.email}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => openPasswordModal(user)}
                              className="p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded transition"
                              title="Modifier le mot de passe"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => openEditModal(user)}
                              className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition"
                              title="Modifier tout le profil"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleToggleStatus(user)}
                              className={`p-1 rounded transition ${user.is_active ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}
                              title={user.is_active ? 'Suspendre' : 'Activer'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100 dark:border-white/5">
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${getRoleBadgeStyle(user.role)}`}>
                            {user.role}
                          </span>
                          <span className="text-gray-500 font-medium">
                            {user.business_info ? user.business_info.role_name : 'Indépendant'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ================= CREATE / EDIT MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1A2E25] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-white/10 animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-gold-400" />
                {editingUser ? `Modifier ${editingUser.email}` : 'Créer un Nouveau Compte'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-white/70 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {submitError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs border border-red-100 font-medium">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-green-100/90 mb-1">Prénom</label>
                  <input 
                    type="text" required
                    value={formData.first_name} 
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-green-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-green-100/90 mb-1">Nom</label>
                  <input 
                    type="text" required
                    value={formData.last_name} 
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-green-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-green-100/90 mb-1">Adresse Email</label>
                <input 
                  type="email" required
                  disabled={!!editingUser}
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-green-600 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-green-100/90 mb-1">
                  Mot de passe (Réinitialisation Directe Super Admin)
                </label>
                <input 
                  type="text" required={!editingUser}
                  value={formData.password} 
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-green-600"
                  placeholder={editingUser ? "Saisir un nouveau mot de passe pour le remplacer..." : "Minimum 8 caractères"}
                />
                <p className="text-[11px] text-gray-500 dark:text-green-100/60 mt-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                  Saisir une valeur ici remplacera immédiatement le mot de passe de l'utilisateur.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-green-100/90 mb-1">Numéro de Téléphone</label>
                  <input 
                    type="text"
                    value={formData.phone_number} 
                    onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-green-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-green-100/90 mb-1">Rôle Système</label>
                  <select 
                    value={formData.role} 
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-green-600"
                  >
                    <option value="PROFESSIONAL">Professionnel / Staff</option>
                    <option value="BUSINESS_OWNER">Propriétaire d'Entreprise</option>
                    <option value="MERCHANT">Commerçant</option>
                    <option value="CUSTOMER">Client / Patient</option>
                    <option value="SUPER_ADMIN">Super Administrateur</option>
                    <option value="MODERATOR">Modérateur</option>
                  </select>
                </div>
              </div>

              {/* ENTERPRISE ASSIGNMENT */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-3">
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  Rattachement à une Entreprise
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-amber-900/80 dark:text-amber-200/80 mb-1">Entreprise</label>
                  <select
                    value={formData.business_id}
                    onChange={(e) => setFormData({...formData, business_id: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-amber-200 dark:border-amber-800/40 rounded-lg text-gray-900 dark:text-white outline-none focus:border-amber-600"
                  >
                    <option value="">Aucune (Indépendant / Client)</option>
                    {businesses.map(b => (
                      <option key={b.id} value={b.id}>🏢 {b.name}</option>
                    ))}
                  </select>
                </div>

                {formData.business_id && (
                  <div>
                    <label className="block text-[11px] font-medium text-amber-900/80 dark:text-amber-200/80 mb-1">Rôle au sein de l'Entreprise</label>
                    <select
                      value={formData.business_relationship}
                      onChange={(e) => setFormData({...formData, business_relationship: e.target.value})}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-amber-200 dark:border-amber-800/40 rounded-lg text-gray-900 dark:text-white outline-none focus:border-amber-600"
                    >
                      <option value="EMPLOYEE">Employé / Professionnel Rattaché</option>
                      <option value="OWNER">Propriétaire Principal (Business Owner)</option>
                    </select>
                  </div>
                )}
              </div>

              {editingUser && (
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      className="w-4 h-4 text-green-700 rounded focus:ring-green-700"
                    />
                    <span className="text-xs font-semibold text-gray-800 dark:text-green-100/90">
                      Compte Actif (Autoriser la connexion à la plateforme)
                    </span>
                  </label>
                </div>
              )}

              {/* Form Footer */}
              <div className="pt-3 flex items-center gap-3 justify-end border-t border-gray-100 dark:border-white/10">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-green-100/70 dark:hover:text-white transition"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold bg-green-700 hover:bg-green-800 text-white rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : (editingUser ? 'Sauvegarder' : 'Créer le Compte')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= QUICK PASSWORD RESET MODAL ================= */}
      {isPasswordModalOpen && targetPasswordUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1A2E25] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-white/10 animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-yellow-600 text-gray-950 flex items-center justify-between font-bold">
              <h3 className="text-sm flex items-center gap-2">
                <Key className="w-5 h-5" /> Réinitialiser le mot de passe
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-950/70 hover:text-gray-950 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleQuickPasswordReset} className="p-6 space-y-4">
              <div className="text-xs text-gray-600 dark:text-green-100/80">
                Modification directe du mot de passe pour l'utilisateur :<br/>
                <strong className="text-gray-900 dark:text-white text-sm">{targetPasswordUser.email}</strong>
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs border border-red-100 font-medium">
                  {submitError}
                </div>
              )}

              {passwordSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs border border-emerald-100 font-semibold flex items-center gap-2">
                  <UserCheck className="w-4 h-4" /> {passwordSuccessMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-green-100/90 mb-1">
                  Nouveau Mot de Passe
                </label>
                <input 
                  type="text" 
                  required
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-600 font-mono"
                  placeholder="ex: NouveauPass2026!"
                />
              </div>

              <div className="pt-2 flex items-center gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-green-100/70 dark:hover:text-white transition"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Mise à jour...' : 'Appliquer le mot de passe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
