import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, ArrowRight, ShieldCheck, Star, Building2, User, Lock, Mail, ChevronRight } from 'lucide-react';
import SectorSpecificFields from '../shared/components/SectorSpecificFields';
import LocationSelector from '../shared/components/LocationSelector';
import PasswordInput from '../shared/components/PasswordInput';

export default function BusinessRegistrationPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    // Propriétaire
    first_name: '',
    last_name: '',
    password: '',
    // Entreprise
    name: '',
    owner_email_input: '',
    phone: '',
    address: '',
    province: 'Bujumbura Mairie',
    commune: 'Mukaza',
    zone: '',
    quartier: 'Rohero',
    avenue: '',
    latitude: '',
    longitude: '',
    description: '',
    primary_category: '',
    category_ids: [],
    extra_attributes: {}
  });

  useEffect(() => {
    fetch('/api/v1/business-categories/')
      .then(res => res.json())
      .then(data => {
        setCategories(data);
        if (data.length > 0) {
           setFormData(prev => ({ ...prev, primary_category: data[0].id }));
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleCategoryToggle = (catId) => {
    setFormData(prev => {
      const exists = prev.category_ids.includes(catId);
      if (exists) return { ...prev, category_ids: prev.category_ids.filter(id => id !== catId) };
      return { ...prev, category_ids: [...prev.category_ids, catId] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (!formData.latitude || !formData.longitude) {
        throw new Error('Veuillez renseigner les coordonnées GPS (latitude et longitude), via « Capturer GPS » ou un lien Google Maps.');
      }
      const selectedCat = categories.find((c) => c.id === formData.primary_category);
      const catName = `${selectedCat?.name || ''} ${selectedCat?.parent_name || ''}`.toLowerCase();
      const isCommerce = ['commerce', 'boutique', 'mode', 'quincaillerie', 'supermarché', 'supermarche', 'électronique', 'electronique']
        .some((k) => catName.includes(k));
      if (isCommerce) {
        const a = formData.extra_attributes || {};
        if (!a.nif_number?.trim()) {
          throw new Error('Commerce : renseignez le numéro NIF (OBR).');
        }
        if (!a.nif_document) {
          throw new Error('Commerce : joignez le scan du NIF (PDF ou image).');
        }
      }
      const payload = {
        ...formData,
        email: formData.owner_email_input,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        nif_number: formData.extra_attributes?.nif_number,
        nif_document: formData.extra_attributes?.nif_document,
      };
      const response = await fetch('/api/v1/businesses/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur lors de la soumission.');
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Demande envoyée !</h2>
          <p className="text-gray-600 mb-6">
            Votre demande d'inscription pour l'entreprise <strong>{formData.name}</strong> a été soumise avec succès. 
            Elle est actuellement <strong>en attente de validation</strong> par nos administrateurs.
          </p>
          <Link to="/" className="inline-flex items-center justify-center w-full px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  const parentCategories = categories.filter(c => !c.parent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A2E25] to-[#12221A] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-600 text-white mb-6 shadow-xl hover:scale-105 transition-transform border border-teal-500/30">
            <Store className="w-7 h-7" />
          </Link>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Inscrivez votre Établissement</h1>
          <p className="mt-3 text-lg text-teal-100/70 max-w-xl mx-auto">Rejoignez le plus grand réseau de professionnels sur Isoko Hub et développez votre activité.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1B3026] rounded-2xl shadow-2xl border border-teal-800/40 overflow-hidden">
          {error && (
            <div className="bg-red-900/30 p-4 border-b border-red-800/50 text-red-200 font-medium">
              {error}
            </div>
          )}

          {/* Section 1 : Propriétaire */}
          <div className="p-6 sm:p-8 border-b border-teal-800/30">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gold-500" /> Vos Informations de Connexion
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-teal-100/70 mb-1">Prénom</label>
                <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full px-4 py-2 bg-[#12221A] border border-teal-800/50 rounded-lg focus:ring-1 focus:ring-gold-500 focus:border-gold-500 text-white outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-teal-100/70 mb-1">Nom</label>
                <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full px-4 py-2 bg-[#12221A] border border-teal-800/50 rounded-lg focus:ring-1 focus:ring-gold-500 focus:border-gold-500 text-white outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-teal-100/70 mb-1 flex items-center gap-1"><Mail className="w-4 h-4"/> Email de connexion</label>
                <input type="email" required value={formData.owner_email_input} onChange={e => setFormData({...formData, owner_email_input: e.target.value})} className="w-full px-4 py-2 bg-[#12221A] border border-teal-800/50 rounded-lg focus:ring-1 focus:ring-gold-500 focus:border-gold-500 text-white outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-teal-100/70 mb-1 flex items-center gap-1"><Lock className="w-4 h-4"/> Mot de passe</label>
                <PasswordInput
                  required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  autoComplete="new-password"
                  className="px-4 py-2 bg-[#12221A] border border-teal-800/50 rounded-lg focus:ring-1 focus:ring-gold-500 focus:border-gold-500 text-white outline-none"
                  toggleClassName="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-teal-200/70 hover:text-white transition cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Section 2 : Entreprise */}
          <div className="p-6 sm:p-8 border-b border-teal-800/30 bg-[#172A21]">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gold-500" /> Profil de l'Établissement
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-teal-100/70 mb-1">Nom de l'entreprise *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-[#12221A] border border-teal-800/50 rounded-lg focus:ring-1 focus:ring-gold-500 focus:border-gold-500 text-white outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-teal-100/70 mb-1 flex items-center gap-1">Téléphone Contact</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 bg-[#12221A] border border-teal-800/50 rounded-lg focus:ring-1 focus:ring-gold-500 focus:border-gold-500 text-white outline-none" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-teal-100/70 mb-1 flex items-center gap-1">
                <Star className="w-4 h-4 text-gold-500 fill-gold-500" /> Catégorie Principale *
              </label>
              <select required value={formData.primary_category} onChange={e => setFormData({...formData, primary_category: e.target.value})} className="w-full px-4 py-2 bg-[#12221A] border border-teal-800/50 rounded-lg focus:ring-1 focus:ring-gold-500 focus:border-gold-500 text-white font-semibold outline-none">
                <option value="" disabled>-- Choisir votre secteur --</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.parent_name ? `${cat.parent_name} > ${cat.name}` : cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4 bg-[#12221A]/50 p-4 rounded-xl border border-teal-800/30">
              <SectorSpecificFields 
                primaryCategory={formData.primary_category}
                categories={categories}
                attributes={formData.extra_attributes}
                onChange={(attrs) => setFormData({...formData, extra_attributes: attrs})}
              />
            </div>

            <div className="mb-4">
              {/* Note: If LocationSelector uses white internally, we might need to style it later, but let's assume it inherits or uses defaults */}
              <div className="bg-[#12221A]/50 p-4 rounded-xl border border-teal-800/30">
                <LocationSelector 
                  province={formData.province}
                  commune={formData.commune}
                  zone={formData.zone}
                  quartier={formData.quartier}
                  avenue={formData.avenue}
                  address={formData.address}
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onChange={(loc) => setFormData({...formData, ...loc})}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-teal-100/70 mb-1">Catégories & Services Secondaires (Optionnel)</label>
              <div className="bg-[#12221A]/50 border border-teal-800/30 rounded-xl p-4 max-h-48 overflow-y-auto space-y-4 custom-scrollbar">
                {parentCategories.map((parent) => {
                  const children = categories.filter(c => c.parent === parent.id || (c.parent_name && c.parent_name === parent.name));
                  if (children.length === 0) return null;
                  
                  return (
                    <div key={parent.id} className="space-y-2">
                      <div className="font-bold text-xs text-gold-500 uppercase tracking-wider flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5" /> {parent.name}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                        {children.map((child) => (
                          <label key={child.id} className="flex items-center gap-2 text-sm text-teal-100/80 cursor-pointer select-none hover:text-white transition">
                            <input 
                              type="checkbox"
                              checked={formData.category_ids.includes(child.id)}
                              onChange={() => handleCategoryToggle(child.id)}
                              className="rounded border-teal-800 bg-[#12221A] text-gold-500 focus:ring-gold-500"
                            />
                            <span>{child.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-teal-100/70 mb-1">Description Courte</label>
              <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 bg-[#12221A] border border-teal-800/50 rounded-lg focus:ring-1 focus:ring-gold-500 focus:border-gold-500 text-white outline-none resize-none"></textarea>
            </div>

          </div>

          <div className="p-6 sm:p-8 bg-[#12221A] flex items-center justify-between border-t border-teal-800/30">
            <Link to="/" className="text-teal-100/50 hover:text-white font-medium transition-colors">Annuler</Link>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-6 py-3 bg-gold-600 hover:bg-gold-500 text-gray-900 font-bold rounded-xl transition shadow-lg shadow-gold-500/20 disabled:opacity-50">
              {submitting ? 'Enregistrement...' : 'Soumettre ma demande'} <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
