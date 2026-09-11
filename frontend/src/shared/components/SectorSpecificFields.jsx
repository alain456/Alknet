import React from 'react';
import { Stethoscope, Hotel, Utensils, Store, ShieldCheck, Star, Bed, Coffee, Wifi, Car, FileText, Truck, Smartphone } from 'lucide-react';
import { readDocumentAsDataUrl } from '../imageUpload';

export default function SectorSpecificFields({ primaryCategory, categories = [], attributes = {}, onChange }) {
  if (!primaryCategory) return null;

  // Find primary category object if ID passed
  let catObj = primaryCategory;
  if (typeof primaryCategory === 'string') {
    catObj = categories.find(c => c.id === primaryCategory) || { name: '', slug: '' };
  }

  const categoryName = (catObj.name || '').toLowerCase();
  const categorySlug = (catObj.slug || '').toLowerCase();
  const parentName = (catObj.parent_name || '').toLowerCase();

  const isHealth = categoryName.includes('santé') || categoryName.includes('pharmacie') || categoryName.includes('hopital') || categoryName.includes('hôpital') || categoryName.includes('clinique') || categorySlug.includes('sante') || categorySlug.includes('pharmacie') || parentName.includes('santé');
  
  const isHotel = categoryName.includes('hôtel') || categoryName.includes('hotel') || categoryName.includes('hôtellerie') || categorySlug.includes('hotel') || parentName.includes('hôtellerie');
  
  const isRestaurant = categoryName.includes('restaurant') || categoryName.includes('restauration') || categoryName.includes('bar') || categoryName.includes('café') || categoryName.includes('traiteur') || categorySlug.includes('restaurant') || parentName.includes('restauration');

  const isCommerce = categoryName.includes('commerce')
    || categoryName.includes('boutique')
    || categoryName.includes('supermarché')
    || categoryName.includes('supermarche')
    || categoryName.includes('mode')
    || categoryName.includes('quincaillerie')
    || categoryName.includes('électronique')
    || categoryName.includes('electronique')
    || categorySlug.includes('boutique')
    || categorySlug.includes('commerce')
    || categorySlug.includes('mode')
    || categorySlug.includes('quincaillerie')
    || categorySlug.includes('electronique')
    || parentName.includes('commerce');

  const handleFieldChange = (key, value) => {
    onChange({
      ...attributes,
      [key]: value
    });
  };

  if (!isHealth && !isHotel && !isRestaurant && !isCommerce) {
    return null;
  }

  return (
    <div className="p-4 rounded-xl border border-gold-500/30 bg-gold-500/5 dark:bg-gold-500/10 space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-700 dark:text-gold-300 border-b border-gold-500/20 pb-2">
        {isHealth && <Stethoscope className="w-4 h-4 text-green-700 dark:text-green-300" />}
        {isHotel && <Hotel className="w-4 h-4 text-gold-600" />}
        {isRestaurant && <Utensils className="w-4 h-4 text-gold-600" />}
        {isCommerce && <Store className="w-4 h-4 text-gold-600" />}
        Spécificités Métier ({catObj.name})
      </div>

      {/* HEALTH & PHARMACY FIELDS */}
      {isHealth && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-ink-muted dark:text-green-100/80 mb-1">
              Numéro d'Agrément du Ministère de la Santé *
            </label>
            <div className="relative">
              <ShieldCheck className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-green-700" />
              <input 
                type="text"
                placeholder="Ex: MSP/AGR/2026/0482"
                value={attributes.license_number || ''}
                onChange={(e) => handleFieldChange('license_number', e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-paper dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 font-medium text-ink dark:text-white cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={!!attributes.is_24_7}
              onChange={(e) => handleFieldChange('is_24_7', e.target.checked)}
              className="rounded border-border text-green-700 focus:ring-green-700"
            />
            <span>Service de Garde 24/7 & Urgences</span>
          </label>

          <label className="flex items-center gap-2 font-medium text-ink dark:text-white cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={!!attributes.delivers_medicine}
              onChange={(e) => handleFieldChange('delivers_medicine', e.target.checked)}
              className="rounded border-border text-green-700 focus:ring-green-700"
            />
            <span>Vente sur Ordonnance & Garde</span>
          </label>
        </div>
      )}

      {/* HOTEL & HOSPITALITY FIELDS */}
      {isHotel && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-ink-muted dark:text-green-100/80 mb-1">
              Classement en Étoiles
            </label>
            <select 
              value={attributes.stars_rating || '3'}
              onChange={(e) => handleFieldChange('stars_rating', e.target.value)}
              className="w-full px-3 py-2 bg-paper dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-gold-600"
            >
              <option value="1">1 Étoile ★</option>
              <option value="2">2 Étoiles ★★</option>
              <option value="3">3 Étoiles ★★★</option>
              <option value="4">4 Étoiles ★★★★</option>
              <option value="5">5 Étoiles Luxury ★★★★★</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-ink-muted dark:text-green-100/80 mb-1">
              Nombre de Chambres
            </label>
            <input 
              type="number"
              min="1"
              placeholder="Ex: 45"
              value={attributes.rooms_count || ''}
              onChange={(e) => handleFieldChange('rooms_count', e.target.value)}
              className="w-full px-3 py-2 bg-paper dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-gold-600"
            />
          </div>

          <label className="flex items-center gap-2 font-medium text-ink dark:text-white cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={!!attributes.has_swimming_pool}
              onChange={(e) => handleFieldChange('has_swimming_pool', e.target.checked)}
              className="rounded border-border text-gold-600 focus:ring-gold-600"
            />
            <span>Piscine disponible</span>
          </label>

          <label className="flex items-center gap-2 font-medium text-ink dark:text-white cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={!!attributes.breakfast_included}
              onChange={(e) => handleFieldChange('breakfast_included', e.target.checked)}
              className="rounded border-border text-gold-600 focus:ring-gold-600"
            />
            <span>Petit-déjeuner inclus</span>
          </label>
        </div>
      )}

      {/* RESTAURANT & CUISINE FIELDS */}
      {isRestaurant && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-ink-muted dark:text-green-100/80 mb-1">
              Type de Cuisine / Spécialité
            </label>
            <input 
              type="text"
              placeholder="Ex: Burundaise, Italienne, Grillades..."
              value={attributes.cuisine_type || ''}
              onChange={(e) => handleFieldChange('cuisine_type', e.target.value)}
              className="w-full px-3 py-2 bg-paper dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-gold-600"
            />
          </div>

          <div className="flex flex-col justify-center gap-2">
            <label className="flex items-center gap-2 font-medium text-ink dark:text-white cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={!!attributes.has_online_menu}
                onChange={(e) => handleFieldChange('has_online_menu', e.target.checked)}
                className="rounded border-border text-gold-600 focus:ring-gold-600"
              />
              <span>Menu numérique / PDF disponible</span>
            </label>

            <label className="flex items-center gap-2 font-medium text-ink dark:text-white cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={!!attributes.offers_delivery}
                onChange={(e) => handleFieldChange('offers_delivery', e.target.checked)}
                className="rounded border-border text-gold-600 focus:ring-gold-600"
              />
              <span>Livraison de repas à domicile</span>
            </label>
          </div>
        </div>
      )}

      {/* RETAIL / COMMERCE FIELDS */}
      {isCommerce && (
        <div className="space-y-4 text-xs">
          <p className="text-[11px] text-ink-muted dark:text-green-100/70 leading-relaxed">
            Pour le secteur Commerce, joignez votre
            <strong className="text-ink dark:text-white"> NIF (OBR)</strong> :
            numéro + scan. Un NIF déjà enregistré sur Isoko Hub sera refusé.
          </p>

          <CommerceDocField
            label="NIF — Numéro d'Identification Fiscale (OBR) *"
            numberKey="nif_number"
            fileKey="nif_document"
            numberPlaceholder="Ex: 4001234567"
            attributes={attributes}
            onChange={handleFieldChange}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gold-500/20">
            <label className="flex items-center gap-2 font-medium text-ink dark:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!attributes.accepts_mobile_money}
                onChange={(e) => handleFieldChange('accepts_mobile_money', e.target.checked)}
                className="rounded border-border text-green-700 focus:ring-green-700"
              />
              <span>Paiement Mobile (Lumicash, Ecocash...)</span>
            </label>

            <label className="flex items-center gap-2 font-medium text-ink dark:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!attributes.express_delivery}
                onChange={(e) => handleFieldChange('express_delivery', e.target.checked)}
                className="rounded border-border text-green-700 focus:ring-green-700"
              />
              <span>Service de livraison rapide</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function CommerceDocField({ label, numberKey, fileKey, numberPlaceholder, attributes, onChange }) {
  const [fileError, setFileError] = React.useState('');
  const [fileName, setFileName] = React.useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    setFileError('');
    if (!file) return;
    try {
      const dataUrl = await readDocumentAsDataUrl(file);
      setFileName(file.name);
      onChange(fileKey, dataUrl);
    } catch (err) {
      setFileError(err.message || 'Fichier invalide');
      onChange(fileKey, '');
      setFileName('');
    }
  };

  return (
    <div className="rounded-lg border border-gold-500/20 bg-black/10 p-3 space-y-2">
      <label className="block font-semibold text-ink-muted dark:text-green-100/80">
        <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {label}</span>
      </label>
      <input
        type="text"
        required
        placeholder={numberPlaceholder}
        value={attributes[numberKey] || ''}
        onChange={(e) => onChange(numberKey, e.target.value)}
        className="w-full px-3 py-2 text-xs bg-paper dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-gold-600"
      />
      <input
        type="file"
        required={!attributes[fileKey]}
        accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
        onChange={onFile}
        className="w-full text-[11px] text-ink-muted dark:text-green-100/70 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-gold-500/20 file:text-gold-800 dark:file:text-gold-200 file:font-semibold"
      />
      {fileName && (
        <p className="text-[11px] text-green-700 dark:text-green-300">Fichier : {fileName}</p>
      )}
      {attributes[fileKey] && !fileName && (
        <p className="text-[11px] text-green-700 dark:text-green-300">Document chargé</p>
      )}
      {fileError && <p className="text-[11px] text-red-500">{fileError}</p>}
    </div>
  );
}
