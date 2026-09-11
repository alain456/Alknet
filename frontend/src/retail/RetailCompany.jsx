import React, { useEffect, useState } from 'react';
import retailService from './retailService';

const FIELD_LABELS = {
  commercial_name: 'Nom commercial',
  license_number: 'N° licence / autorisation',
  phone: 'Téléphone',
  email: 'Email',
  address: 'Adresse',
  commune: 'Commune',
  description: 'Description',
};

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-ink outline-none focus:ring-2 focus:ring-primary';

export default function RetailCompany() {
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    retailService.getProfile()
      .then(setProfile)
      .catch((err) => setError(err.message || 'Impossible de charger le profil'));
  }, []);

  if (!profile && !error) {
    return <p className="text-sm text-ink-muted">Chargement…</p>;
  }

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      setProfile(await retailService.updateProfile(profile));
      setMessage('Informations enregistrées.');
    } catch (err) {
      setError(err.message || 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">Ma pharmacie</h1>
        <p className="text-sm text-ink-muted">{profile?.business_name}</p>
      </div>
      {message && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{message}</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 text-error text-sm">{error}</div>}
      {profile && (
        <form onSubmit={save} className="bg-white border border-border rounded-2xl p-6 grid md:grid-cols-2 gap-4">
          {Object.keys(FIELD_LABELS).map((key) => (
            <label key={key} className={`block space-y-1.5 ${key === 'description' ? 'md:col-span-2' : ''}`}>
              <span className="text-sm font-medium text-gray-700">{FIELD_LABELS[key]}</span>
              {key === 'description' ? (
                <textarea
                  rows={4}
                  value={profile[key] || ''}
                  onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                  className={inputClass}
                />
              ) : (
                <input
                  value={profile[key] || ''}
                  onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                  className={inputClass}
                />
              )}
            </label>
          ))}
          <div className="md:col-span-2 flex items-center gap-3 pt-2 border-t border-border">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl font-semibold disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
