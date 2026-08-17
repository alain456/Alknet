import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, MoreHorizontal, UserCheck, UserX, Mail, Shield, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone_number: '',
    role: 'PROFESSIONAL'
  });
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { token } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/accounts/admin/users/', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        setUsers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/accounts/admin/users/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:8000/api/v1/accounts/admin/users/create/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(JSON.stringify(errData));
      }
      setIsModalOpen(false);
      setFormData({ first_name: '', last_name: '', email: '', password: '', phone_number: '', role: 'PROFESSIONAL' });
      fetchUsers();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadgeStyle = (role) => {
    switch(role) {
      case 'SUPER_ADMIN':
      case 'MODERATOR':
        return 'bg-clay-100 text-clay-600 dark:bg-error/20 dark:text-red-200';
      case 'BUSINESS_OWNER':
      case 'PROFESSIONAL':
      case 'MERCHANT':
        return 'bg-gold-50 text-gold-600 dark:bg-gold-600/20 dark:text-gold-100';
      default:
        return 'bg-green-100 text-green-700 dark:bg-success/20 dark:text-green-100';
    }
  };

  const getRoleIcon = (role) => {
    if (role === 'SUPER_ADMIN' || role === 'MODERATOR') return <Shield className="w-3 h-3 mr-1" />;
    return null;
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-350 mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-green-900 dark:text-white tracking-tight">Utilisateurs</h1>
          <p className="text-[15px] text-ink-muted dark:text-green-100/70 mt-1">Gérez tous les comptes de la plateforme Isoko Hub.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 flex items-center gap-2 text-[14px] font-semibold bg-surface dark:bg-transparent border-[1.5px] border-border dark:border-white/20 text-green-700 dark:text-green-100 rounded-md hover:bg-green-50 dark:hover:bg-white/5 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Exporter CSV
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 flex items-center gap-2 text-[14px] font-semibold bg-green-700 hover:bg-green-800 text-white rounded-md transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Créer un Utilisateur
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="border border-border dark:border-white/10 rounded-[10px] bg-surface dark:bg-[#1A2E25] overflow-hidden shadow-sm flex flex-col">
        
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-border dark:border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-paper dark:bg-black/10">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input 
              type="text" 
              placeholder="Rechercher par email ou nom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-[13px] bg-surface dark:bg-green-900/50 border border-border dark:border-white/10 rounded-md text-ink dark:text-white placeholder-ink-faint focus:outline-none focus:border-green-700 dark:focus:border-gold-600 transition-colors"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-ink-muted hover:text-green-900 dark:text-green-100/70 dark:hover:text-white transition-colors border border-border dark:border-white/10 rounded-md bg-surface dark:bg-transparent">
            <Filter className="w-4 h-4" /> Filtres
          </button>
        </div>

        {/* DataGrid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border dark:border-white/10 text-[11px] text-ink-faint dark:text-green-100/50 uppercase tracking-[0.05em] bg-paper/50 dark:bg-black/5">
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Utilisateur</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Rôle</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Statut</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Inscrit le</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-border dark:divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-700"></div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-error">
                    Erreur de chargement: {error}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-ink-muted dark:text-green-100/60 text-[14px]">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const date = new Date(user.created_at);
                  const formattedDate = `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

                  return (
                    <tr key={user.id} className="hover:bg-green-50/50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-700/50 flex items-center justify-center text-green-700 dark:text-green-100 font-display font-semibold shrink-0">
                            {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-ink dark:text-white">
                              {user.first_name || user.last_name ? `${user.first_name} ${user.last_name}` : 'Utilisateur'}
                            </div>
                            <div className="text-[12.5px] text-ink-muted dark:text-green-100/60 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3" /> {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${getRoleBadgeStyle(user.role)}`}>
                          {getRoleIcon(user.role)}
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.is_email_verified ? (
                          <div className="flex items-center gap-1.5 text-[12.5px] text-success dark:text-[#3E9F6A] font-medium">
                            <UserCheck className="w-4 h-4" /> Vérifié
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[12.5px] text-ink-faint dark:text-green-100/40 font-medium">
                            <UserX className="w-4 h-4" /> En attente
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-[13px] text-green-900 dark:text-white/90">
                          {formattedDate}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 text-ink-faint hover:text-green-900 dark:text-green-100/40 dark:hover:text-white transition-colors rounded-md hover:bg-paper dark:hover:bg-white/10 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        {!loading && !error && filteredUsers.length > 0 && (
          <div className="px-6 py-4 border-t border-border dark:border-white/10 bg-surface dark:bg-transparent flex justify-between items-center text-[13px]">
            <span className="text-ink-muted dark:text-green-100/60 font-medium">
              Affichage de {filteredUsers.length} utilisateurs
            </span>
            <div className="flex gap-1">
              <button className="px-3 py-1 border border-border dark:border-white/10 rounded text-ink-muted dark:text-green-100/60 opacity-50 cursor-not-allowed">Précédent</button>
              <button className="px-3 py-1 border border-border dark:border-white/10 rounded text-ink dark:text-white hover:bg-green-50 dark:hover:bg-white/5 transition-colors">Suivant</button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface dark:bg-[#1A2E25] rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-border dark:border-white/10">
            <div className="px-6 py-4 border-b border-border dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-green-900 dark:text-white">Créer un nouveau compte Pro/Business</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-ink-muted hover:text-ink dark:hover:text-white">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
                  Erreur: {submitError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink dark:text-green-100/80 mb-1">Prénom</label>
                  <input 
                    type="text" required
                    value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    className="w-full px-3 py-2 bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white outline-none focus:border-green-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink dark:text-green-100/80 mb-1">Nom</label>
                  <input 
                    type="text" required
                    value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    className="w-full px-3 py-2 bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white outline-none focus:border-green-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink dark:text-green-100/80 mb-1">Email</label>
                <input 
                  type="email" required
                  value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white outline-none focus:border-green-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink dark:text-green-100/80 mb-1">Mot de passe provisoire</label>
                <input 
                  type="text" required
                  value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white outline-none focus:border-green-700"
                  placeholder="Minimum 8 caractères"
                />
                <p className="text-xs text-ink-faint mt-1">À communiquer manuellement à l'utilisateur.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink dark:text-green-100/80 mb-1">Téléphone</label>
                  <input 
                    type="text"
                    value={formData.phone_number} onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                    className="w-full px-3 py-2 bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white outline-none focus:border-green-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink dark:text-green-100/80 mb-1">Rôle</label>
                  <select 
                    value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-3 py-2 bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-md text-ink dark:text-white outline-none focus:border-green-700"
                  >
                    <option value="PROFESSIONAL">Professionnel / Indépendant</option>
                    <option value="BUSINESS_OWNER">Propriétaire d'Entreprise</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3 justify-end">
                <button 
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-ink hover:bg-paper dark:hover:bg-white/5 font-medium rounded-md transition"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-medium rounded-md transition shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
