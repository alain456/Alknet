import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { resolveHotelStaffRedirect } from '../../auth/roleAccess';

/**
 * Ancien portail staff hôtel → redirection vers le PMS (/hotel/*)
 * dont les menus sont filtrés par les droits CRUD du rôle.
 */
export default function HotelStaffLayout() {
  const location = useLocation();
  const target = resolveHotelStaffRedirect(location.pathname) || '/hotel/dashboard';
  return <Navigate to={target} replace />;
}
