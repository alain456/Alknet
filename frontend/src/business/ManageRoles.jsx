import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Plus, Edit2, Trash2, CheckSquare, Square, UserCheck, Sparkles } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import DataGrid from '../admin/components/DataGrid';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';
import { RECEPTIONIST_PERMISSIONS, getBusinessCategoryKey, ROLES } from '../auth/roleAccess';
import hospitalService from '../hospital/hospitalService';
import hotelService from '../hotel/hotelService';
import { userHasPermission } from '../lib/permissions';
import {
  HOTEL_PERM_GROUPS,
  expandHotelPermissions,
  hotelPermLabel,
  HOTEL_FRONT_DESK_PERMS,
  HOTEL_PREDEFINED_ROLES,
  HOTEL_UI_PERM_KEYS,
  HOTEL_LEGACY_MASTERS,
} from '../hotel/hotelPermissions';
import { useHotelPerm } from '../hotel/useHotelPerm';
import {
  HOSPITAL_PERM_GROUPS,
  HOSPITAL_UI_PERM_KEYS,
  HOSPITAL_LEGACY_MASTERS,
  expandHospitalPermissions,
  buildHospitalPermissionsPayload,
  hospitalPermLabel,
  HOSPITAL_RECEPTION_PERMS,
  HOSPITAL_ACCOUNTING_PERMS,
} from '../hospital/hospitalPermissions';

const HOSPITAL_ACCESS_LEVELS = [
  { value: 'ADMIN_ACCESS', label: 'Administrateur hôpital' },
  { value: 'RECEPTIONIST_ACCESS', label: 'Agent d\'accueil / Réception' },
  { value: 'MEDICAL_ACCESS', label: 'Médical (médecins)' },
  { value: 'LAB_ACCESS', label: 'Laboratoire' },
  { value: 'CASHIER_ACCESS', label: 'Caisse & facturation' },
  { value: 'STAFF_ACCESS', label: 'Staff standard' },
];

const HOTEL_ACCESS_LEVELS = [
  { value: 'OWNER_ACCESS', label: 'Propriétaire' },
  { value: 'ADMIN_ACCESS', label: 'Manager / Admin hôtel' },
  { value: 'RECEPTIONIST_ACCESS', label: 'Réceptionniste' },
  { value: 'CASHIER_ACCESS', label: 'Caissier' },
  { value: 'STAFF_ACCESS', label: 'Staff hôtelier' },
];

const GENERIC_ACCESS_LEVELS = [
  { value: 'ADMIN_ACCESS', label: 'Administrateur' },
  { value: 'CASHIER_ACCESS', label: 'Caisse' },
  { value: 'STAFF_ACCESS', label: 'Staff standard' },
];

const HOSPITAL_PERMISSIONS = [
  { key: 'can_manage_hospital', label: 'Administration globale', desc: 'Gestion médecins, services, tarifs et rôles' },
  { key: 'can_view_medical_records', label: 'Consulter dossiers médicaux', desc: 'Lecture des antécédents (secret médical)' },
  { key: 'can_edit_medical_records', label: 'Créer & éditer dossiers', desc: 'Notes cliniques et prescriptions' },
  { key: 'can_manage_lab_results', label: 'Laborantin — résultats', desc: 'Création et workflow labo jusqu’à notification patient (pas l’admin)' },
  { key: 'can_manage_invoices', label: 'Facturation & caisse', desc: 'Factures et paiements (sans accès clinique)' },
  ...RECEPTIONIST_PERMISSIONS.map((p) => ({ key: p.key, label: p.label, desc: 'Permission rendez-vous — agent d\'accueil' })),
];

const GENERIC_PERMISSIONS = [
  { key: 'can_manage_staff', label: 'Gérer le personnel', desc: 'Créer et modifier les collaborateurs' },
  { key: 'can_manage_roles', label: 'Gérer les rôles', desc: 'Créer et modifier les rôles & permissions' },
  { key: 'can_view_reports', label: 'Voir les rapports', desc: 'Accès aux statistiques' },
];

const HOTEL_PERMISSIONS_FLAT = [
  { key: 'hotel.manage', label: 'Administration PMS (tout)', desc: 'Accès complet Manager' },
  { key: 'hotel.owner', label: 'Marqueur Propriétaire', desc: 'Identifie le rôle du compte propriétaire' },
  ...HOTEL_PERM_GROUPS.flatMap((g) => g.actions.map((a) => ({
    key: a.key,
    label: `${g.label} · ${a.label}`,
    desc: g.label,
  }))),
];

function findHotelRole(roles, predefined) {
  const names = [predefined.name, ...(predefined.aliases || [])].map((n) => n.toLowerCase());
  return roles.find((r) => names.includes((r.name || '').toLowerCase()));
}

function isOwnerRoleRow(role) {
  if (!role) return false;
  const name = (role.name || '').trim().toLowerCase();
  return name === 'propriétaire' || name === 'proprietaire' || role.system_access_level === 'OWNER_ACCESS';
}

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

  const { isAuthenticated, user, refreshProfile } = useAuth();
  const location = useLocation();
  const categoryKey = getBusinessCategoryKey(user);
  const isHotel = categoryKey === 'hotel' || location.pathname.startsWith('/hotel');
  const isHospital = !isHotel && (categoryKey === 'hospital' || location.pathname.startsWith('/hospital'));

  // Accès via hotel.roles.* / hotel.manage — même règle pour propriétaire et employés
  const { canCreate, canUpdate, canDelete, can } = useHotelPerm();
  const canAccessHotelRoles = !isHotel || (
    can('hotel.roles.view')
    || can('hotel.roles.create')
    || can('hotel.roles.update')
    || can('hotel.manage')
  );
  const canCreateRole = !isHotel || canCreate('roles');
  const canEditRole = !isHotel || canUpdate('roles');
  const canDeleteRole = !isHotel || canDelete('roles');

  const accessLevels = isHotel
    ? HOTEL_ACCESS_LEVELS
    : isHospital
      ? HOSPITAL_ACCESS_LEVELS
      : GENERIC_ACCESS_LEVELS;

  const availablePermissions = isHotel
    ? HOTEL_PERMISSIONS_FLAT
    : isHospital
      ? HOSPITAL_PERMISSIONS
      : GENERIC_PERMISSIONS;

  useEffect(() => {
    if (isAuthenticated) fetchRoles();
  }, [isAuthenticated]);

  const fetchRoles = async () => {
    try {
      const data = await api.get('businesses/my-business/roles/', { auth: true });
      const list = Array.isArray(data) ? data : [];
      // Propriétaire en tête pour l’hôtel
      list.sort((a, b) => {
        const ao = isOwnerRoleRow(a) ? 0 : 1;
        const bo = isOwnerRoleRow(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return (a.name || '').localeCompare(b.name || '', 'fr');
      });
      setRoles(list);
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

  const handleSeedHotelFrontDesk = async () => {
    setSeeding(true);
    try {
      await api.post('businesses/my-business/roles/', {
        name: 'Réceptionniste',
        system_access_level: 'RECEPTIONIST_ACCESS',
        permissions: HOTEL_FRONT_DESK_PERMS,
      }, { auth: true });
      await fetchRoles();
      alert('Rôle « Réceptionniste » créé.');
    } catch (err) {
      alert(err.message || 'Erreur');
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedAllHotelRoles = async () => {
    setSeeding(true);
    try {
      const res = await hotelService.seedRoles();
      await fetchRoles();
      alert(res?.message || 'Rôles PMS synchronisés.');
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
      const raw = role.permissions || [];
      if (isHotel) {
        const next = new Set();
        if (raw.includes('hotel.manage') || raw.includes('*')) {
          next.add('hotel.manage');
          HOTEL_UI_PERM_KEYS.forEach((k) => next.add(k));
        } else {
          expandHotelPermissions(raw).forEach((k) => {
            if (HOTEL_UI_PERM_KEYS.includes(k)) next.add(k);
          });
        }
        setSelectedPermissions([...next]);
      } else if (isHospital) {
        const next = new Set();
        if (raw.includes('hospital.manage') || raw.includes('can_manage_hospital') || raw.includes('*')) {
          next.add('hospital.manage');
          HOSPITAL_UI_PERM_KEYS.forEach((k) => next.add(k));
        } else {
          expandHospitalPermissions(raw).forEach((k) => {
            if (HOSPITAL_UI_PERM_KEYS.includes(k)) next.add(k);
          });
        }
        setSelectedPermissions([...next]);
      } else {
        const allowed = new Set(availablePermissions.map((p) => p.key));
        setSelectedPermissions(raw.filter((k) => allowed.has(k)));
      }
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
    if (isHotel) {
      setName('Réceptionniste');
      setSystemAccessLevel('RECEPTIONIST_ACCESS');
      setSelectedPermissions(
        expandHotelPermissions(HOTEL_FRONT_DESK_PERMS).filter((k) => HOTEL_UI_PERM_KEYS.includes(k))
      );
      return;
    }
    setName('Agent d\'accueil');
    setSystemAccessLevel('RECEPTIONIST_ACCESS');
    setSelectedPermissions(HOSPITAL_RECEPTION_PERMS);
  };

  const togglePermission = (key) => {
    setSelectedPermissions((prev) => {
      if (key === 'hotel.manage') {
        const allOn = prev.includes('hotel.manage')
          || HOTEL_UI_PERM_KEYS.every((k) => prev.includes(k));
        if (allOn) return [];
        return ['hotel.manage', ...HOTEL_UI_PERM_KEYS];
      }
      if (key === 'hospital.manage') {
        const allOn = prev.includes('hospital.manage')
          || HOSPITAL_UI_PERM_KEYS.every((k) => prev.includes(k));
        if (allOn) return [];
        return ['hospital.manage', ...HOSPITAL_UI_PERM_KEYS];
      }
      if (prev.includes(key)) {
        return prev.filter(
          (p) => p !== key && p !== 'hotel.manage' && p !== 'hospital.manage' && !HOTEL_LEGACY_MASTERS.includes(p) && !HOSPITAL_LEGACY_MASTERS.includes(p)
        );
      }
      return [...prev.filter((p) => !HOTEL_LEGACY_MASTERS.includes(p) && !HOSPITAL_LEGACY_MASTERS.includes(p)), key];
    });
  };

  const toggleGroupAll = (group) => {
    const keys = (group.actions || [])
      .map((a) => a.key)
      .filter((k) => k !== 'hotel.owner');
    const allOn = keys.every((k) => selectedPermissions.includes(k));
    setSelectedPermissions((prev) => {
      const cleaned = prev.filter((p) => !HOTEL_LEGACY_MASTERS.includes(p) && !HOSPITAL_LEGACY_MASTERS.includes(p));
      if (allOn) {
        return cleaned.filter((p) => !keys.includes(p) && p !== 'hotel.manage' && p !== 'hospital.manage');
      }
      return [...new Set([...cleaned, ...keys])];
    });
  };

  const handleDelete = async (id) => {
    const row = roles.find((r) => r.id === id);
    if (isHotel && isOwnerRoleRow(row)) {
      alert('Le rôle Propriétaire ne peut pas être supprimé.');
      return;
    }
    if (!window.confirm('Supprimer ce rôle ?')) return;
    try {
      await api.delete(`businesses/my-business/roles/${id}/`, { auth: true });
      fetchRoles();
    } catch (err) {
      alert(err.message);
    }
  };

  const buildHotelPermissionsPayload = (selected) => {
    // Uniquement cases UI + manage (jamais les masters legacy qui ré-expansent)
    let permissions = selected.filter(
      (k) => k === 'hotel.manage' || HOTEL_UI_PERM_KEYS.includes(k)
    );
    const editingOwner = isOwnerRoleRow({ name, system_access_level: systemAccessLevel });
    const allDetailsOn = HOTEL_UI_PERM_KEYS.every((k) => permissions.includes(k));

    if (permissions.includes('hotel.manage') && !allDetailsOn) {
      permissions = permissions.filter((p) => p !== 'hotel.manage');
    }

    if (allDetailsOn || permissions.includes('hotel.manage')) {
      permissions = ['hotel.manage'];
    }

    if (editingOwner) {
      permissions = [...new Set([...permissions, 'hotel.owner'])];
    }

    return permissions;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      const editingOwner = isHotel && isEditMode && isOwnerRoleRow(roles.find((r) => r.id === currentRoleId));
      const permissions = isHotel
        ? buildHotelPermissionsPayload(selectedPermissions)
        : isHospital
          ? buildHospitalPermissionsPayload(selectedPermissions)
          : selectedPermissions.filter((k) => availablePermissions.some((p) => p.key === k));
      const payload = {
        name: editingOwner ? 'Propriétaire' : name,
        permissions,
        system_access_level: editingOwner ? 'OWNER_ACCESS' : systemAccessLevel,
      };
      if (isEditMode) {
        await api.patch(`businesses/my-business/roles/${currentRoleId}/`, payload, { auth: true });
      } else {
        await api.post('businesses/my-business/roles/', payload, { auth: true });
      }
      setIsModalOpen(false);
      fetchRoles();
      // Met à jour les droits du compte connecté (ex. Propriétaire / Manager) pour les menus
      try { await refreshProfile?.(); } catch { /* ignore */ }
    } catch (err) {
      setSubmitError(err.message || 'Erreur de sauvegarde');
    }
  };

  const allPermLabels = useMemo(() => {
    const map = {};
    [...HOTEL_PERMISSIONS_FLAT, ...HOSPITAL_PERMISSIONS, ...GENERIC_PERMISSIONS].forEach((p) => {
      map[p.key] = p.label;
    });
    HOSPITAL_PERM_GROUPS.forEach((g) => {
      g.actions.forEach((a) => {
        map[a.key] = hospitalPermLabel(a.key);
      });
    });
    map['hospital.manage'] = 'Administration (tout)';
    return map;
  }, []);

  const permLabel = (key) => allPermLabels[key] || key;

  const columns = [
    {
      key: 'name',
      label: 'Nom du rôle',
      render: (val, row) => (
        <div>
          <span className="font-bold text-gray-900 dark:text-white">{val}</span>
          {isOwnerRoleRow(row) && (
            <span className="ml-2 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              Propriétaire
            </span>
          )}
          {row.system_access_level === 'RECEPTIONIST_ACCESS' && (
            <span className="ml-2 text-[10px] font-bold bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
              {isHotel ? 'Réception' : 'Accueil'}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'system_access_level',
      label: 'Niveau d\'accès',
      render: (val) => {
        const opt = accessLevels.find((o) => o.value === val)
          || HOSPITAL_ACCESS_LEVELS.find((o) => o.value === val)
          || HOTEL_ACCESS_LEVELS.find((o) => o.value === val);
        return <span className="text-xs text-gray-600">{opt?.label || val}</span>;
      },
    },
    {
      key: 'permissions',
      label: 'Permissions accordées',
      render: (perms) => {
        const permList = Array.isArray(perms) ? perms : [];
        const visible = isHotel
          ? expandHotelPermissions(permList).filter((k) => k.startsWith('hotel.') && k !== 'hotel.manage' && k !== 'hotel.owner')
          : isHospital
            ? (permList.includes('hospital.manage') || permList.includes('can_manage_hospital') || permList.includes('*')
              ? ['hospital.manage']
              : expandHospitalPermissions(permList).filter((k) => k.startsWith('hospital.')))
            : permList;
        if (visible.length === 0) {
          return <span className="text-xs text-gray-400 italic">Aucune</span>;
        }
        const show = visible.slice(0, 5);
        return (
          <div className="flex flex-wrap gap-1">
            {show.map((pKey) => (
              <span key={pKey} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                <Shield className="w-3 h-3" />
                {permLabel(pKey)}
              </span>
            ))}
            {visible.length > show.length && (
              <span className="text-[10px] text-gray-400">+{visible.length - show.length}</span>
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
          {canEditRole && (
          <button type="button" onClick={() => handleOpenModal(row)} className="icon-btn" title="Modifier">
            <Edit2 className="w-4 h-4" />
          </button>
          )}
          {canDeleteRole && !isOwnerRoleRow(row) && (
            <button type="button" onClick={() => handleDelete(row.id)} className="icon-btn icon-btn--danger" title="Supprimer">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {!canEditRole && !canDeleteRole && (
            <span className="text-[11px] text-gray-400 font-bold">Lecture seule</span>
          )}
        </div>
      ),
    },
  ];

  const hasReceptionistRole = roles.some(
    (r) => r.system_access_level === 'RECEPTIONIST_ACCESS'
      || r.name === 'Agent d\'accueil'
      || r.name === 'Réceptionniste'
      || r.name === 'Réception / Front desk'
  );

  const hotelRoleStatus = useMemo(() => {
    if (!isHotel) return [];
    return HOTEL_PREDEFINED_ROLES.map((pre) => {
      const found = findHotelRole(roles, pre);
      const ok = Boolean(found);
      const foundExpanded = expandHotelPermissions(found?.permissions || []);
      const permsOk = ok && pre.perms.every((p) => foundExpanded.includes(p) || (found.permissions || []).includes(p));
      return { ...pre, found, ok, permsOk };
    });
  }, [isHotel, roles]);

  const missingHotelRoles = hotelRoleStatus.filter((r) => !r.ok).length;

  if (isHotel && user && !canAccessHotelRoles) {
    return <Navigate to="/hotel/dashboard" replace />;
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Rôles & Permissions
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {isHotel
              ? 'Droits CRUD (créer / voir / modifier / supprimer) par module — attribuables à n’importe quel rôle.'
              : isHospital
                ? 'Droits CRUD par module : rendez-vous, dossiers, laboratoire, comptabilité, personnel.'
                : 'Créez et assignez les rôles d\'accès de votre entreprise.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isHospital && !hasReceptionistRole && (
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
          {isHotel && (
            <button
              type="button"
              onClick={handleSeedAllHotelRoles}
              disabled={seeding || !canCreateRole}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {seeding
                ? 'Synchronisation...'
                : missingHotelRoles > 0
                  ? `Créer les ${missingHotelRoles} rôle(s) PMS manquant(s)`
                  : 'Resynchroniser les rôles PMS'}
            </button>
          )}
          {isHotel && !hasReceptionistRole && canCreateRole && (
            <button
              type="button"
              onClick={handleSeedHotelFrontDesk}
              disabled={seeding}
              className="flex items-center gap-2 bg-teal-600/80 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              <UserCheck className="w-4 h-4" />
              {seeding ? 'Création...' : 'Créer rôle Réceptionniste'}
            </button>
          )}
          {canCreateRole && (
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> Nouveau rôle
          </button>
          )}
        </div>
      </div>

      {isHospital && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-sm text-teal-900">
          <p className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" /> Chaque module se coche en CRUD</p>
          <p className="mt-1 text-xs">
            Voir, créer, modifier, supprimer — plus les actions propres au module (confirmer un rendez-vous, valider un résultat, clôturer la journée).
            Un ancien rôle (accueil, comptable, admin) ouvre déjà les cases correspondantes.
          </p>
        </div>
      )}

      {isHotel && (
        <div className="bg-primary/5 border-2 border-accent/40 rounded-2xl p-4 text-sm text-ink space-y-3">
          <p className="font-bold flex items-center gap-2 text-primary">
            <Sparkles className="w-4 h-4 text-accent" /> Rôles PMS pré-définis
          </p>
          <ul className="space-y-2 text-xs">
            {hotelRoleStatus.map((r) => (
              <li key={r.name} className="flex items-start gap-2">
                <span className={r.ok && r.permsOk ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                  {r.ok && r.permsOk ? '✓' : '○'}
                </span>
                <span>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-ink-muted"> — {r.description}</span>
                  {!r.ok && <span className="text-amber-700"> (manquant)</span>}
                  {r.ok && !r.permsOk && <span className="text-amber-700"> (permissions à aligner)</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-accent/30 pt-3 space-y-1 text-xs text-ink-muted">
            <p>
              <span className="font-semibold text-ink">Propriétaire</span>
              {' '}— rôle lié au compte owner de l’hôtel : éditez ses permissions PMS ici
              (nom non supprimable). L’abonnement plateforme reste réservé au compte propriétaire.
            </p>
            <p>
              <span className="font-semibold text-ink">Admin plateforme</span>
              {' '}— rôle système <code className="text-[11px]">SUPER_ADMIN</code> (pas un rôle métier hôtel) :
              supervise / suspend via Admin → Entreprises.
            </p>
            <p>
              <span className="font-semibold text-ink">Client</span>
              {' '}— fiche <code className="text-[11px]">Guest</code> créée à la réception ou en réservation publique
              (pas de compte staff PMS).
            </p>
            <p>
              Assignez les autres rôles (Manager, Réception…) dans « Personnel ».
              L’accès à ce menu se gère via les permissions <code className="text-[11px]">hotel.roles.*</code>.
            </p>
          </div>
        </div>
      )}

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

      {isModalOpen && (canCreateRole || canEditRole) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
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

              {!isEditMode && isHospital && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={applyReceptionistTemplate}
                    className="py-2 text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-xl hover:bg-teal-100"
                  >
                    Modèle accueil
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setName('Comptable');
                      setSystemAccessLevel('CASHIER_ACCESS');
                      setSelectedPermissions(HOSPITAL_ACCOUNTING_PERMS);
                    }}
                    className="py-2 text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-xl hover:bg-teal-100"
                  >
                    Modèle comptable
                  </button>
                </div>
              )}
              {!isEditMode && isHotel && (
                <button
                  type="button"
                  onClick={applyReceptionistTemplate}
                  className="w-full py-2 text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-xl hover:bg-teal-100"
                >
                  {isHotel ? 'Appliquer le modèle « Réceptionniste »' : 'Appliquer le modèle « Agent d\'accueil »'}
                </button>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom du rôle</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isHotel && isEditMode && isOwnerRoleRow({ name, system_access_level: systemAccessLevel })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm disabled:opacity-70"
                  placeholder={isHotel ? 'ex: Réceptionniste' : 'ex: Agent d\'accueil'}
                />
                {isHotel && isEditMode && isOwnerRoleRow({ name, system_access_level: systemAccessLevel }) && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Nom verrouillé. Cochez / décochez librement les droits PMS ci-dessous — ils s’appliquent au compte propriétaire.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Niveau d&apos;accès système</label>
                <select
                  value={systemAccessLevel}
                  onChange={(e) => setSystemAccessLevel(e.target.value)}
                  disabled={isHotel && isEditMode && isOwnerRoleRow({ name, system_access_level: systemAccessLevel })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg text-sm disabled:opacity-70"
                >
                  {accessLevels.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Permissions {isHotel || isHospital ? 'CRUD par module' : 'accordées'}
                </label>
                {(isHotel || isHospital) ? (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {isHotel ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => togglePermission('hotel.manage')}
                      onKeyDown={(e) => e.key === 'Enter' && togglePermission('hotel.manage')}
                      className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 ${
                        selectedPermissions.includes('hotel.manage')
                        || HOTEL_UI_PERM_KEYS.every((k) => selectedPermissions.includes(k))
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="mt-0.5 text-primary">
                        {selectedPermissions.includes('hotel.manage')
                        || HOTEL_UI_PERM_KEYS.every((k) => selectedPermissions.includes(k))
                          ? <CheckSquare className="w-5 h-5" />
                          : <Square className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Administration PMS (tout)</div>
                        <div className="text-xs text-gray-500">Active toutes les cases CRUD</div>
                      </div>
                    </div>
                    ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => togglePermission('hospital.manage')}
                      onKeyDown={(e) => e.key === 'Enter' && togglePermission('hospital.manage')}
                      className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 ${
                        selectedPermissions.includes('hospital.manage')
                        || HOSPITAL_UI_PERM_KEYS.every((k) => selectedPermissions.includes(k))
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="mt-0.5 text-primary">
                        {selectedPermissions.includes('hospital.manage')
                        || HOSPITAL_UI_PERM_KEYS.every((k) => selectedPermissions.includes(k))
                          ? <CheckSquare className="w-5 h-5" />
                          : <Square className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Administration hôpital (tout)</div>
                        <div className="text-xs text-gray-500">Active toutes les cases CRUD</div>
                      </div>
                    </div>
                    )}
                    {(isHotel ? HOTEL_PERM_GROUPS : HOSPITAL_PERM_GROUPS).map((group) => {
                      const keys = group.actions
                        .map((a) => a.key)
                        .filter((k) => k !== 'hotel.owner');
                      if (!keys.length) return null;
                      const actions = group.actions.filter((a) => a.key !== 'hotel.owner');
                      const allOn = keys.every((k) => selectedPermissions.includes(k));
                      return (
                        <div key={group.id} className="rounded-xl border border-gray-200 overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/60">
                            <span className="text-xs font-extrabold uppercase tracking-wide">{group.label}</span>
                            <button type="button" className="text-[11px] font-bold text-primary" onClick={() => toggleGroupAll({ ...group, actions })}>
                              {allOn ? 'Tout retirer' : 'Tout cocher'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-2">
                            {actions.map((action) => {
                              const isChecked = selectedPermissions.includes(action.key);
                              return (
                                <button
                                  key={action.key}
                                  type="button"
                                  onClick={() => togglePermission(action.key)}
                                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left text-xs font-semibold border ${
                                    isChecked
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-transparent text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  {isChecked
                                    ? <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                                    : <Square className="w-3.5 h-3.5 shrink-0 text-gray-400" />}
                                  <span>{action.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
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
                )}
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
