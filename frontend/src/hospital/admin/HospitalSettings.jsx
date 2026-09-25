import React, { useEffect, useState } from 'react';
import { Settings, Globe } from 'lucide-react';
import HospitalReferenceSettings from './HospitalReferenceSettings';
import HospitalEmailSettings from './HospitalEmailSettings';
import PermissionGuard from '../../auth/PermissionGuard';
import { PERMISSIONS } from '../../lib/permissions';
import { useAuth } from '../../context/AuthContext';
import { normalizeWebsiteUrl } from '../../shared/websiteUrl';

export default function HospitalSettings() {
  const { token, authFetch } = useAuth();
  const [website, setWebsite] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    authFetch('/api/v1/businesses/me/')
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const b = Array.isArray(data) ? data[0] : data;
        setWebsite(b?.website || '');
      })
      .catch(() => {});
  }, [token]);

  const saveWebsite = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      const res = await authFetch('/api/v1/businesses/me/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: normalizeWebsiteUrl(website) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || 'Enregistrement impossible');
      }
      const data = await res.json();
      const b = Array.isArray(data) ? data[0] : data;
      setWebsite(b?.website || normalizeWebsiteUrl(website));
      setMsg('Site web enregistré.');
    } catch (ex) {
      setErr(ex.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PermissionGuard
      anyPermissions={[PERMISSIONS.HOSPITAL_UPDATE, PERMISSIONS.HOSPITAL_VIEW]}
    >
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="text-teal-600" />
            Paramètres hôpital
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Coordonnées publiques, numéros de suivi et emails patients.
          </p>
        </div>

        <form onSubmit={saveWebsite} className="bg-white border rounded-2xl p-5 space-y-3 max-w-2xl">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-teal-600" /> Site web officiel
          </h2>
          <p className="text-xs text-gray-500">Affiché aux clients dans les informations de l&apos;établissement.</p>
          {msg && <p className="text-sm text-emerald-700 font-medium">{msg}</p>}
          {err && <p className="text-sm text-red-600 font-medium">{err}</p>}
          <input
            type="url"
            placeholder="https://www.exemple.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer le site web'}
          </button>
        </form>

        <HospitalReferenceSettings />
        <HospitalEmailSettings />
      </div>
    </PermissionGuard>
  );
}
