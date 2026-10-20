import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Save } from 'lucide-react';
import api from '../shared/api';
import AvatarPicker from '../shared/components/AvatarPicker';

export default function UserProfilePage() {
  const { user, updateUser, token, logout } = useAuth();

  const [formData, setFormData] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone_number || '',
  });
  const [avatar, setAvatar] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    api.get('profiles/me/', { auth: true })
      .then((p) => setAvatar(p.avatar || ''))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        phone: user.phone_number || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      await api.patch('profiles/me/', { avatar: avatar || '' }, { auth: true });
      const updatedUser = await api.patch('accounts/profile/', {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phone,
      }, { auth: true });
      updateUser?.(updatedUser);
      setMessage('Profil mis à jour.');
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mon profil</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Photo et informations personnelles.</p>
      </div>

      {message && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-sm">{message}</div>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-3">Photo de profil</h3>
            <AvatarPicker value={avatar} onChange={setAvatar} onError={setAvatarError} size={96} />
            {avatarError && <p className="text-sm text-red-600 mt-2">{avatarError}</p>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">Prénom</label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="pl-10 pr-4 py-2.5 w-full border rounded-lg bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Nom</label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="pl-10 pr-4 py-2.5 w-full border rounded-lg bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    disabled
                    className="pl-10 pr-4 py-2.5 w-full border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Téléphone</label>
                <div className="relative">
                  <Phone className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="pl-10 pr-4 py-2.5 w-full border rounded-lg bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary"
                    placeholder="+257 79 00 00 00"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-primary hover:bg-secondary text-white font-medium py-2.5 px-6 rounded-lg disabled:opacity-70"
              >
                <Save className="w-5 h-5" />
                {isSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-800 border rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-lg">Données et sécurité</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(user?.email_otp_enabled)}
              onChange={async (e) => {
                const enabled = e.target.checked;
                const updated = await api.patch('accounts/profile/', { email_otp_enabled: enabled }, { auth: true });
                updateUser(updated);
              }}
            />
            Exiger un code e-mail à chaque connexion
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-[#32667F] text-[#32667F] text-sm font-semibold"
              onClick={async () => {
                const data = await api.get('accounts/me/export/', { auth: true });
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'isoko-mes-donnees.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Exporter mes données
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-red-600 text-red-700 text-sm font-semibold"
              onClick={async () => {
                const password = window.prompt('Mot de passe pour supprimer le compte');
                if (!password) return;
                try {
                  await api.post('accounts/me/delete/', { password }, { auth: true });
                  logout();
                } catch (err) {
                  window.alert(err.message || 'Suppression impossible');
                }
              }}
            >
              Supprimer mon compte
            </button>
          </div>
          {user?.role === 'BUSINESS_OWNER' && (
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-[#32667F] text-white text-sm font-semibold"
              onClick={async () => {
                const data = await api.get('businesses/me/data-export/', { auth: true });
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'isoko-etablissement.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Exporter les données de l&apos;établissement
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
