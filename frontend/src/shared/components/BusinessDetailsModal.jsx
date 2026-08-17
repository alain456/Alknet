import React from 'react';
import { 
  X, Building2, MapPin, Star, Phone, Mail, Globe, 
  ShieldCheck, Clock, Navigation, ExternalLink, Award, 
  FileText, CheckCircle2, AlertTriangle, Utensils, Hotel, 
  Check, Sparkles, User
} from 'lucide-react';

export default function BusinessDetailsModal({ isOpen, onClose, business, categories = [] }) {
  if (!isOpen || !business) return null;

  // Resolve category names
  const primaryCategoryName = business.primary_category_name || 
    (categories.find(c => c.id === business.primary_category)?.name) || 
    business.category_name || 
    'Non spécifiée';

  const secondaryCategories = business.categories_detail || 
    (business.category_ids ? categories.filter(c => business.category_ids.includes(c.id)) : []);

  const attrs = business.extra_attributes || {};

  // Formatted location hierarchy string
  const locationHierarchy = [
    business.avenue ? `Avenue: ${business.avenue}` : null,
    business.quartier ? `Quartier: ${business.quartier}` : null,
    business.zone ? `Zone: ${business.zone}` : null,
    business.commune ? `Commune: ${business.commune}` : null,
    business.province ? `Province: ${business.province}` : null
  ].filter(Boolean).join(' • ');

  const fullAddress = business.full_address || business.address || [
    business.address, business.avenue, business.quartier, business.zone, business.commune, business.province
  ].filter(Boolean).join(', ') || 'Non renseignée';

  // Google Maps link from GPS coordinates or address
  const googleMapsUrl = (business.latitude && business.longitude)
    ? `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress + ', Burundi')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Modal Header / Banner */}
        <div className="relative bg-gradient-to-r from-green-900 via-green-800 to-green-950 dark:from-black dark:via-gray-900 dark:to-green-950 p-6 text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gold-500/20 border border-gold-500/40 flex items-center justify-center text-gold-300 font-bold text-2xl shrink-0 overflow-hidden shadow-inner">
              {business.logo ? (
                <img src={business.logo} alt={business.name} className="w-full h-full object-cover" />
              ) : (
                business.name ? business.name[0].toUpperCase() : 'E'
              )}
            </div>

            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{business.name}</h2>
                {business.is_verified && (
                  <span className="inline-flex items-center gap-1 bg-green-500/30 text-green-300 border border-green-400/40 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Vérifié
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-green-100/80">
                <span className="inline-flex items-center gap-1 bg-gold-500/20 text-gold-300 px-2.5 py-1 rounded-md font-semibold border border-gold-500/30">
                  <Star className="w-3.5 h-3.5 fill-gold-400 text-gold-400" />
                  {primaryCategoryName}
                </span>

                <span className={`px-2.5 py-1 rounded-md font-medium text-xs ${
                  business.verification_status === 'APPROVED' ? 'bg-green-500/20 text-green-200 border border-green-500/30' :
                  business.verification_status === 'PENDING' ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30' :
                  'bg-red-500/20 text-red-200 border border-red-500/30'
                }`}>
                  Modération : {
                    business.verification_status === 'APPROVED' ? 'Approuvé' :
                    business.verification_status === 'PENDING' ? 'En attente de validation' : 'Rejeté'
                  }
                </span>

                <span className={`px-2.5 py-1 rounded-md font-medium text-xs ${
                  business.is_active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-gray-500/20 text-gray-300'
                }`}>
                  {business.is_active ? '● Ouvert / Actif' : '○ Suspendu'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-gray-800 dark:text-gray-200 text-sm">
          
          {/* Description */}
          {business.description && (
            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-green-700 dark:text-gold-400" /> Description de l'entreprise
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-normal">{business.description}</p>
            </div>
          )}

          {/* Localisation Administrative à 5 Niveaux */}
          <div className="bg-paper dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
              <h3 className="text-xs font-bold text-green-900 dark:text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-gold-600" /> Géolocalisation & Structure Administrative (5 Niveaux)
              </h3>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Navigation className="w-3.5 h-3.5" /> Ouvrir dans Google Maps <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <span className="block text-[10px] text-gray-400 font-semibold">1. Province</span>
                <span className="font-bold text-gray-900 dark:text-white">{business.province || '—'}</span>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <span className="block text-[10px] text-gray-400 font-semibold">2. Commune</span>
                <span className="font-bold text-gray-900 dark:text-white">{business.commune || '—'}</span>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <span className="block text-[10px] text-gray-400 font-semibold">3. Zone</span>
                <span className="font-bold text-gray-900 dark:text-white">{business.zone || '—'}</span>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <span className="block text-[10px] text-gray-400 font-semibold">4. Quartier</span>
                <span className="font-bold text-gray-900 dark:text-white">{business.quartier || '—'}</span>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <span className="block text-[10px] text-gray-400 font-semibold">5. Avenue</span>
                <span className="font-bold text-gray-900 dark:text-white">{business.avenue || '—'}</span>
              </div>
            </div>

            <div className="pt-2 text-xs flex flex-col sm:flex-row justify-between gap-2 border-t border-gray-100 dark:border-gray-800/80">
              <div>
                <span className="text-gray-500 font-medium">Adresse complète composée : </span>
                <span className="font-semibold text-gray-900 dark:text-white">{fullAddress}</span>
              </div>
              {(business.latitude || business.longitude) && (
                <div className="font-mono text-gray-500 text-[11px]">
                  GPS: <span className="text-gray-900 dark:text-gray-200">{business.latitude}, {business.longitude}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contacts & Propriétaire */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800/40 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800">
              <span className="block text-[11px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-gray-400" /> Propriétaire
              </span>
              <span className="font-semibold text-gray-900 dark:text-white text-xs break-all">
                {business.owner_email || business.email || 'Inconnu'}
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/40 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800">
              <span className="block text-[11px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-gray-400" /> Téléphone
              </span>
              <span className="font-semibold text-gray-900 dark:text-white text-xs">
                {business.phone || 'Non renseigné'}
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/40 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800">
              <span className="block text-[11px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-gray-400" /> Site Web
              </span>
              {business.website ? (
                <a href={business.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-xs truncate block">
                  {business.website}
                </a>
              ) : (
                <span className="text-gray-400 text-xs">Non renseigné</span>
              )}
            </div>
          </div>

          {/* Spécificités Métiers & Attributs Sectoriels */}
          <div className="bg-gold-500/5 dark:bg-gold-500/10 p-4 rounded-xl border border-gold-500/20 space-y-3">
            <h3 className="text-xs font-bold text-gold-700 dark:text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-gold-600" /> Spécificités Sectorielles & Métiers (Formulaire Dynamique)
            </h3>

            <div className="flex flex-wrap gap-2 text-xs">
              {attrs.license_number && (
                <div className="bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-green-300 dark:border-green-800 font-semibold text-green-800 dark:text-green-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-green-600" /> N° Agrément Ministériel: <span className="font-bold">{attrs.license_number}</span>
                </div>
              )}

              {attrs.stars_rating && (
                <div className="bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gold-400 dark:border-gold-700 font-semibold text-gold-700 dark:text-gold-300 flex items-center gap-1.5">
                  <Hotel className="w-4 h-4 text-gold-600" /> Classement: <span className="font-bold">{attrs.stars_rating} Étoiles</span> ({attrs.rooms_count || '?'} Chambres)
                </div>
              )}

              {attrs.cuisine_type && (
                <div className="bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-orange-300 dark:border-orange-800 font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-orange-600" /> Spécialité Cuisine: <span className="font-bold">{attrs.cuisine_type}</span>
                </div>
              )}

              {attrs.is_24_7 && (
                <div className="bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 font-semibold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-red-600" /> Ouverture 24/7 (Service continu)
                </div>
              )}

              {attrs.has_swimming_pool && (
                <div className="bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-blue-600" /> Piscine disponible
                </div>
              )}

              {!attrs.license_number && !attrs.stars_rating && !attrs.cuisine_type && !attrs.is_24_7 && !attrs.has_swimming_pool && (
                <span className="text-gray-400 italic text-xs">Aucune spécificité particulière enregistrée pour cette catégorie.</span>
              )}
            </div>
          </div>

          {/* Activités et Services Secondaires */}
          {secondaryCategories.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Services & Activités Secondaires ({secondaryCategories.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {secondaryCategories.map(cat => (
                  <span key={cat.id || cat.name} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-700">
                    {cat.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Justificatif / Agrément Document */}
          {business.proof_document && (
            <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-green-700 dark:text-gold-400 shrink-0" />
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white text-xs">Document d'Agrément Officiel</div>
                  <div className="text-[11px] text-gray-400">Justificatif juridique fourni lors de l'enregistrement</div>
                </div>
              </div>
              <a 
                href={business.proof_document} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-medium transition flex items-center gap-1"
              >
                Consulter le Document <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs text-gray-400 shrink-0">
          <span>ID: <code className="font-mono text-gray-600 dark:text-gray-300">{business.id}</code></span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
