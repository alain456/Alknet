import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userHasAnyPermission, userHasPermission, ACCESS_DENIED_MESSAGE } from '../lib/permissions';

interface PermissionGuardProps {
  children: React.ReactNode;
  /** Rôles plateforme autorisés (SUPER_ADMIN, BUSINESS_OWNER, etc.) */
  allowedRoles?: string[];
  /** Permissions métier requises (clés BusinessRole.permissions) */
  requiredPermissions?: string[];
  /** Au moins une de ces permissions suffit */
  anyPermissions?: string[];
  /** Niveaux d'accès système autorisés (ADMIN_ACCESS, MEDICAL_ACCESS, etc.) */
  allowedAccessLevels?: string[];
  fallback?: React.ReactNode;
}

/**
 * Contrôle d'accès frontend — complète ProtectedRoute avec permissions métier.
 * Ne remplace PAS les contrôles backend.
 */
export default function PermissionGuard({
  children,
  allowedRoles,
  requiredPermissions = [],
  anyPermissions = [],
  allowedAccessLevels = [],
  fallback = null,
}: PermissionGuardProps) {
  const { user, isAuthenticated, getRedirectPath } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return fallback ?? <Navigate to={getRedirectPath(user)} replace />;
  }

  if (user.business_info?.permissions?.includes('*')) {
    return <>{children}</>;
  }

  if (allowedAccessLevels.length > 0) {
    const level = (user.system_access_level || '').toUpperCase();
    const hasLevel = allowedAccessLevels.some((a) => level.includes(a.toUpperCase()));
    if (!hasLevel && user.role !== 'BUSINESS_OWNER') {
      return (
        fallback ?? (
          <div className="p-8 text-center text-gray-500">
            Accès non autorisé pour votre rôle.
          </div>
        )
      );
    }
  }

  if (requiredPermissions.length > 0) {
    const userPerms: string[] = user.business_info?.permissions || [];
    const hasAll = requiredPermissions.every((p) => userPerms.includes(p));
    if (!hasAll && user.role !== 'BUSINESS_OWNER') {
      return (
        fallback ?? (
          <div className="p-8 text-center text-gray-500">
            Vous n'avez pas les permissions nécessaires pour cette action.
          </div>
        )
      );
    }
  }

  if (anyPermissions.length > 0) {
    if (!userHasAnyPermission(user, anyPermissions)) {
      return (
        fallback ?? (
          <div className="p-8 text-center text-gray-500">
            {ACCESS_DENIED_MESSAGE}
          </div>
        )
      );
    }
  }

  return <>{children}</>;
}

/** Hook utilitaire pour vérifier une permission dans un composant */
export function usePermission() {
  const { user } = useAuth();

  const hasRole = (...roles: string[]) => roles.includes(user?.role || '');

  const hasPermission = (perm: string) => userHasPermission(user, perm);

  const hasAnyPermission = (perms: string[]) => userHasAnyPermission(user, perms);

  const hasAccessLevel = (...levels: string[]) => {
    const level = (user?.system_access_level || user?.business_info?.system_access_level || '').toUpperCase();
    return levels.some((l) => level.includes(l.toUpperCase()));
  };

  return { hasRole, hasPermission, hasAnyPermission, hasAccessLevel, user };
}
