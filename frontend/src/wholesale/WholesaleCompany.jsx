import React, { useEffect, useState } from 'react';
import wholesaleService from './wholesaleService';

/** Mon entreprise — admin pharmacie de gros (profil métier + coords Business). */
export default function WholesaleCompany() {
  const [profile, setProfile] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    wholesaleService.getProfile().then(setProfile).catch((e) => setError(e.message));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const updated = await wholesaleService.updateProfile({
        commercial_name: profile.commercial_name,
        license_number: profile.license_number,
        status: profile.status,
        phone: profile.phone,
        email: profile.email,
        address: profile.address,
        description: profile.description,
      });
      setProfile({ ...profile, ...updated });
      setMsg('Entreprise mise à jour');
    } catch (err) {
      setError(err.message || 'Échec enregistrement');
    }
  };

  if (!profile) return <div className="p-6 text-slate-500">{error || 'Chargement...'}</div>;

  return (
    <form onSubmit={save} className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Mon entreprise</h1>
      <p className="text-sm text-slate-500">{profile.business_name}</p>
      {msg && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm">{msg}</div>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
      <div className="grid sm:grid-cols-2 gap-3 bg-white border rounded-2xl p-5">
        {[
          ['commercial_name', 'Nom commercial'],
          ['license_number', "N° d'autorisation / licence"],
          ['phone', 'Téléphone'],
          ['email', 'Email professionnel'],
          ['address', 'Adresse'],
        ].map(([k, label]) => (
          <label key={k} className="text-sm space-y-1">
            <span className="font-medium">{label}</span>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={profile[k] || ''}
              onChange={(e) => setProfile({ ...profile, [k]: e.target.value })}
            />
          </label>
        ))}
        <label className="text-sm space-y-1">
          <span className="font-medium">Statut</span>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={profile.status || 'DRAFT'}
            onChange={(e) => setProfile({ ...profile, status: e.target.value })}
          >
            <option value="DRAFT">Brouillon</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspendue</option>
            <option value="CLOSED">Fermée</option>
          </select>
        </label>
      </div>
      <label className="text-sm space-y-1 block bg-white border rounded-2xl p-5">
        <span className="font-medium">Description</span>
        <textarea
          rows={4}
          className="w-full border rounded-lg px-3 py-2 mt-1"
          value={profile.description || ''}
          onChange={(e) => setProfile({ ...profile, description: e.target.value })}
        />
      </label>
      <button type="submit" className="px-5 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl font-semibold">
        Enregistrer
      </button>
    </form>
  );
}
