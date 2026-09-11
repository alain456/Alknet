import React from 'react';
import { Navigate } from 'react-router-dom';

/** Mon entreprise client — réutilise le profil business existant. */
export default function WholesaleClientCompany() {
  return <Navigate to="/business/profile" replace />;
}
