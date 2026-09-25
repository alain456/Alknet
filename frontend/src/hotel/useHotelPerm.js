import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { expandHotelPermissions } from './hotelPermissions';

/**
 * Droits PMS effectifs (propriétaire inclus — pas de passe-droit BUSINESS_OWNER).
 */
export function useHotelPerm() {
  const { user } = useAuth();
  const raw = user?.business_info?.permissions || [];
  const expanded = useMemo(() => expandHotelPermissions(raw), [raw]);

  const can = (code) => {
    if (!code || !user) return false;
    if (raw.includes('*') || expanded.includes('*')) return true;
    if (expanded.includes('hotel.manage')) return true;
    return expanded.includes(code);
  };

  const canResource = (resource, action) => can(`hotel.${resource}.${action}`);

  return {
    user,
    can,
    canView: (resource) => canResource(resource, 'view'),
    canCreate: (resource) => canResource(resource, 'create'),
    canUpdate: (resource) => canResource(resource, 'update'),
    canDelete: (resource) => canResource(resource, 'delete'),
    canResource,
    expanded,
  };
}
