import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Save, Camera } from 'lucide-react';
import { readImageAsDataUrl } from '../shared/imageUpload';
import api from '../shared/api';

export default function UserProfilePage() {
  const { user, updateUser, token } = useAuth();

  const [formData, setFormData] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone_number || '',
  });
  const [avatar, setAvatar] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
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

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError('');
    setAvatarUploading(true);
    try {
      const dataUrl = await readImageAsDataUrl(file, { maxSize: 400, quality: 0.85 });
      setAvatar(dataUrl);
    } catch (err) {
      setAvatarError(err.message || 'Upload impossible');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      const updatedUser = await api.patch('accounts/profile/', {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phone,
      }, { auth: true });

      await api.patch('profiles/me/', { avatar: avatar || '' }, { auth: true });

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
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-3xl font-bold shadow-md border-4 border-white dark:border-gray-800 overflow-hidden">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (formData.firstName ? formData.firstName[0].toUpperCase() : 'U')
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 cursor-pointer">
                <Camera className="w-4 h-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading} />
              </label>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Photo de profil</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                JPG/PNG/WebP — compressée automatiquement.
                {avatarUploading ? ' Compression…' : ''}
              </p>
              <div className="flex gap-3">
                <label className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium rounded-lg cursor-pointer">
                  Téléverser
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading} />
                </label>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar('')}
                    className="px-4 py-2 text-gray-600 text-sm font-medium"
                  >
                    Retirer
                  </button>
                )}
              </div>
              {avatarError && <p className="text-xs text-red-600 mt-2">{avatarError}</p>}
            </div>
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
      </div>
    </div>
  );
}
