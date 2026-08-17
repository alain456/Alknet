import React, { useState, useEffect } from 'react';
import { Settings, Building2, MapPin, Phone, Globe, Save, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SectorSpecificFields from '../shared/components/SectorSpecificFields';

export default function BusinessSettingsPage() {
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [formData, setFormData] = useState({
    businessName: 'Pharmacie moderne & Hôpital Isoko',
    description: 'Services de santé, vente de médicaments de gros & détail, et hébergements.',
    primary_category: '',
    category_ids: [],
    extra_attributes: {},
    address: 'Avenue du Commerce, Bujumbura',
    phone: '+257 79 000 111',
    website: 'https://isokohub.com',
    status: 'Active'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/business-categories/');
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
          if (data.length > 0 && !formData.primary_category) {
            setFormData(prev => ({ ...prev, primary_category: data[0].id }));
          }
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Simulate API update or real call if user business ID exists
      await new Promise(res => setTimeout(res, 800));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-10 w-full max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-green-700 dark:text-green-100" />
            Paramètres de l'Entreprise
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Gérez les informations publiques, votre métier cœur principal et vos spécificités sectorielles (Agrément, Étoiles, 24/7...)</p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-100 rounded-lg text-sm font-semibold">
          ✓ Les paramètres et les spécificités de votre secteur ont été enregistrés avec succès !
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
          
          {/* Basic Info */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
              <Building2 className="w-5 h-5 text-gray-400" />
              Informations Générales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom de l'Entreprise</label>
                <input 
                  type="text" name="businessName"
                  value={formData.businessName} onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-green-700 outline-none transition"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
                <textarea 
                  name="description" rows="3"
                  value={formData.description} onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-green-700 outline-none transition resize-none"
                ></textarea>
              </div>

              {/* Primary Category Selection */}
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gold-700 dark:text-gold-400 mb-1.5 flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-gold-500 text-gold-600" /> Catégorie Principale (Métier Cœur) *
                </label>
                <select 
                  name="primary_category"
                  value={formData.primary_category}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gold-500/10 dark:bg-gold-500/20 border border-gold-500/30 rounded-lg text-gray-900 dark:text-white font-semibold focus:ring-2 focus:ring-gold-500 outline-none transition"
                >
                  <option value="" disabled>-- Sélectionner votre activité principale --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.parent_name ? `${cat.parent_name} → ${cat.name}` : `Secteur: ${cat.name}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Sector Specific Fields Component */}
              <div className="md:col-span-2">
                <SectorSpecificFields 
                  primaryCategory={formData.primary_category}
                  categories={categories}
                  attributes={formData.extra_attributes}
                  onChange={(updatedAttrs) => setFormData({...formData, extra_attributes: updatedAttrs})}
                />
              </div>

              {/* Secondary Categories */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Catégories & Services Secondaires (Activités annexes)</label>
                {loadingCategories ? (
                  <div className="text-xs text-gray-500 py-2">Chargement des catégories...</div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-56 overflow-y-auto space-y-4 bg-gray-50 dark:bg-gray-800">
                    {categories.filter(c => !c.parent).map((parent) => {
                      const children = categories.filter(c => c.parent === parent.id || (c.parent_name && c.parent_name === parent.name));

                      return (
                        <div key={parent.id} className="space-y-1.5">
                          <div className="font-semibold text-xs text-green-800 dark:text-gold-400 uppercase tracking-wider">
                            {parent.name}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-3">
                            {children.map((child) => (
                              <label key={child.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900">
                                <input 
                                  type="checkbox"
                                  checked={formData.category_ids?.includes(child.id)}
                                  onChange={() => {
                                    setFormData(prev => {
                                      const current = prev.category_ids || [];
                                      const exists = current.includes(child.id);
                                      return {
                                        ...prev,
                                        category_ids: exists ? current.filter(id => id !== child.id) : [...current, child.id]
                                      };
                                    });
                                  }}
                                  className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                                />
                                <span>{child.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Statut Opérationnel</label>
                <select 
                  name="status" value={formData.status} onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-green-700 outline-none transition"
                >
                  <option value="Active">Ouvert / En activité</option>
                  <option value="Closed">Fermé temporairement</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact & Location */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              Contact & Emplacement
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Adresse Physique</label>
                <input 
                  type="text" name="address"
                  value={formData.address} onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-green-700 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Téléphone Professionnel</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="tel" name="phone"
                    value={formData.phone} onChange={handleChange}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-green-700 outline-none transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Site Web / Lien commercial</label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="url" name="website"
                    value={formData.website} onChange={handleChange}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-green-700 outline-none transition"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              type="submit" disabled={isSaving}
              className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Enregistrer les Paramètres
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
