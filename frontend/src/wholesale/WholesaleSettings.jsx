import React, { useEffect, useState } from 'react';
import wholesaleService from './wholesaleService';

export default function WholesaleSettings() {
  const [profile, setProfile] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    wholesaleService.getProfile().then(setProfile).catch((e) => setError(e.message));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const updated = await wholesaleService.updateProfile({
        commercial_name: profile.commercial_name,
        license_number: profile.license_number,
        status: profile.status,
        order_reference_prefix: profile.order_reference_prefix,
        acceptance_email_message: profile.acceptance_email_message,
        phone: profile.phone,
        email: profile.email,
        address: profile.address,
        description: profile.description,
      });
      setProfile({ ...profile, ...updated });
      setMsg('Paramètres enregistrés');
    } catch (err) {
      setError(err.message || 'Échec');
    }
  };

  if (!profile) return <div className="p-6 text-slate-500">{error || 'Chargement...'}</div>;

  return (
    <form onSubmit={save} className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Paramètres — {profile.business_name}</h1>
      {msg && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm">{msg}</div>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
      <div className="grid sm:grid-cols-2 gap-3 bg-white border rounded-2xl p-5">
        {[
          ['commercial_name', 'Nom commercial'],
          ['license_number', 'N° autorisation / licence'],
          ['order_reference_prefix', 'Préfixe références'],
          ['phone', 'Téléphone'],
          ['email', 'Email'],
          ['address', 'Adresse'],
        ].map(([k, label]) => (
          <label key={k} className="text-sm space-y-1">
            <span className="font-medium">{label}</span>
            <input className="w-full border rounded-lg px-3 py-2" value={profile[k] || ''} onChange={(e) => setProfile({ ...profile, [k]: e.target.value })} />
          </label>
        ))}
        <label className="text-sm space-y-1">
          <span className="font-medium">Statut</span>
          <select className="w-full border rounded-lg px-3 py-2" value={profile.status} onChange={(e) => setProfile({ ...profile, status: e.target.value })}>
            <option value="DRAFT">Brouillon</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspendue</option>
            <option value="CLOSED">Fermée</option>
          </select>
        </label>
      </div>
      <label className="text-sm space-y-1 block bg-white border rounded-2xl p-5">
        <span className="font-medium">Modèle email d&apos;acceptation</span>
        <textarea rows={6} className="w-full border rounded-lg px-3 py-2 mt-1" value={profile.acceptance_email_message || ''} onChange={(e) => setProfile({ ...profile, acceptance_email_message: e.target.value })} />
      </label>
      <button type="submit" className="px-5 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl font-semibold">Enregistrer</button>
    </form>
  );
}
