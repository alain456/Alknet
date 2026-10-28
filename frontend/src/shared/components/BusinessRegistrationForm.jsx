import React, { useEffect, useState } from 'react';
import {
  Building2, User, Lock, Mail, ChevronRight, ImagePlus, Star, ArrowRight,
} from 'lucide-react';
import { categoryKeyFromLabels } from '../../auth/roleAccess';
import { loadEducationEnums } from '../../education/educationEnums';
import SchoolSectionsEditor from '../../education/SchoolSectionsEditor';
import SchoolEcofoClassesEditor from '../../education/SchoolEcofoClassesEditor';
import SectorSpecificFields from './SectorSpecificFields';
import LocationSelector from './LocationSelector';
import PasswordInput from './PasswordInput';
import { readImageAsDataUrl } from '../imageUpload';
import AvatarPicker from './AvatarPicker';

const fieldClass =
  'w-full px-4 py-3 bg-surface border-2 border-accent rounded-xl focus:border-alert text-ink text-base font-medium outline-none';

function categoryModule(cat, all = []) {
  if (!cat) return '';
  if (cat.module) return String(cat.module).toLowerCase();
  const parent = all.find((row) => String(row.id) === String(cat.parent)) || null;
  return String(parent?.module || '').toLowerCase();
}

function isServicesCategory(cat, all = []) {
  if (!cat) return false;
  if (categoryModule(cat, all) === 'services') return true;
  const blob = `${cat.name || ''} ${cat.slug || ''} ${cat.parent_name || ''}`.toLowerCase();
  return blob.includes('service');
}

function isServicesRootCategory(cat, all = []) {
  return isServicesCategory(cat, all) && !cat.parent;
}

function isHotelTourismRootCategory(cat) {
  if (!cat || cat.parent) return false;
  const blob = `${cat.name || ''} ${cat.slug || ''}`.toLowerCase();
  return /tourisme/.test(blob) && /h[oô]tellerie|hotellerie/.test(blob);
}

function isHotelTourismChild(cat, all = []) {
  if (!cat?.parent) return false;
  const parent = all.find((row) => String(row.id) === String(cat.parent));
  if (parent) return isHotelTourismRootCategory(parent);
  const blob = `${cat.parent_name || ''}`.toLowerCase();
  return /tourisme/.test(blob) && /h[oô]tellerie|hotellerie/.test(blob);
}

function needsActivityChild(cat, all = []) {
  return isServicesRootCategory(cat, all) || isHotelTourismRootCategory(cat);
}

export { readImageAsDataUrl } from '../imageUpload';

export function emptyBusinessRegistrationForm(overrides = {}) {
  return {
    first_name: '',
    last_name: '',
    password: '',
    owner_avatar: '',
    name: '',
    logo: '',
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
    website: '',
    description: '',
    primary_category: '',
    service_category_id: '',
    category_ids: [],
    extra_attributes: {},
    school_tracks: {
      offers_prescolaire: false,
      offers_ecofo: false,
      offers_post_fondamental: false,
      ecofo_cycles: [],
      ecofo_classes: [],
      post_fondamental_sections: [],
    },
    ...overrides,
  };
}

/** Validation commune client / admin (création). */
export function validateBusinessRegistrationForm(formData, categories, {
  requirePassword = true,
  requireOwnerAvatar = true,
  requireCommerceDocs = true,
} = {}) {
  const email = (formData.owner_email_input || '').trim();
  const password = formData.password || '';
  const name = (formData.name || '').trim();
  if (!name) return 'Indiquez le nom de l’entreprise.';
  if (!email) return 'Indiquez l’email de connexion.';
  if (requirePassword && (!password || password.length < 6)) {
    return 'Mot de passe requis (au moins 6 caractères).';
  }
  if (requireOwnerAvatar && !formData.owner_avatar) {
    return 'Ajoutez votre photo de profil (informations de connexion).';
  }
  if (!formData.logo) {
    return 'Ajoutez le logo de l’établissement.';
  }
  if (!formData.latitude || !formData.longitude) {
    return 'Veuillez renseigner les coordonnées GPS (latitude et longitude), via « Capturer GPS » ou un lien Google Maps.';
  }
  if (requireCommerceDocs) {
    const selectedCat = categories.find((c) => String(c.id) === String(formData.primary_category));
    const isCommerce = categoryKeyFromLabels(
      `${selectedCat?.name || ''} ${selectedCat?.parent_name || ''}`,
      selectedCat?.slug || '',
    ) === 'commerce';
    if (isCommerce) {
      const a = formData.extra_attributes || {};
      if (!a.nif_number?.trim()) {
        return 'Commerce : renseignez le numéro NIF (OBR).';
      }
      if (!a.nif_document) {
        return 'Commerce : joignez le scan du NIF (PDF ou image).';
      }
    }
  }
  const selectedSchool = categories.find((c) => String(c.id) === String(formData.primary_category));
  if (isServicesRootCategory(selectedSchool, categories) && !formData.service_category_id) {
    return 'Services : choisissez la catégorie de votre activité parmi celles proposées.';
  }
  if (isHotelTourismRootCategory(selectedSchool) && !formData.service_category_id) {
    return 'Hôtellerie et tourisme : précisez Hôtel, restaurant, bar, café ou traiteur.';
  }
  if ((selectedSchool?.slug || '') === 'ecole') {
    const tracks = formData.school_tracks || {};
    if (!tracks.offers_prescolaire && !tracks.offers_ecofo && !tracks.offers_post_fondamental) {
      return 'École : précisez le préscolaire, l’ECOFO, le post-fondamental, ou une combinaison.';
    }
    const ecofoClasses = (tracks.ecofo_classes || []).filter((row) => (row?.value || '').trim());
    if (tracks.offers_ecofo && !ecofoClasses.length && !(tracks.ecofo_cycles || []).length) {
      return 'ECOFO : ajoutez au moins une classe.';
    }
    const sections = (tracks.post_fondamental_sections || []).filter((section) => (section.name || '').trim());
    if (tracks.offers_post_fondamental && !sections.length) {
      return 'Post-fondamental : ajoutez au moins une section.';
    }
    const sectionWithoutClass = sections.find((section) => !(section.classes || []).some((row) => (row?.value || '').trim()));
    if (sectionWithoutClass) {
      return `Section « ${sectionWithoutClass.name} » : ajoutez au moins une classe.`;
    }
  }
  return null;
}

export function buildBusinessRegistrationPayload(formData) {
  const email = (formData.owner_email_input || '').trim();
  const name = (formData.name || '').trim();
  const tracks = formData.school_tracks || {};
  const sections = (tracks.post_fondamental_sections || [])
    .map((section) => ({ ...section, name: (section.name || '').trim() }))
    .filter((section) => section.name);
  return {
    ...formData,
    name,
    email,
    owner_email_input: email,
    password: formData.password || '',
    latitude: formData.latitude === '' || formData.latitude == null ? null : Number(formData.latitude),
    longitude: formData.longitude === '' || formData.longitude == null ? null : Number(formData.longitude),
    primary_category: formData.service_category_id || formData.primary_category,
    category_ids: formData.service_category_id ? [] : (formData.category_ids || []),
    extra_attributes: {
      ...(formData.extra_attributes || {}),
      school_tracks: {
        offers_prescolaire: !!tracks.offers_prescolaire,
        offers_ecofo: !!tracks.offers_ecofo,
        offers_post_fondamental: !!tracks.offers_post_fondamental,
        ecofo_cycles: tracks.ecofo_cycles || [],
        ecofo_classes: (tracks.ecofo_classes || []).filter((row) => (row?.value || '').trim()),
        post_fondamental_sections: sections,
      },
    },
    nif_number: formData.extra_attributes?.nif_number,
    nif_document: formData.extra_attributes?.nif_document,
  };
}

/**
 * Formulaire d'inscription / création d'entreprise (identique client & super admin).
 */
export default function BusinessRegistrationForm({
  formData,
  onChange,
  categories = [],
  error = null,
  submitting = false,
  onSubmit,
  onCancel,
  submitLabel = 'Soumettre ma demande',
  cancelLabel = 'Annuler',
  emailDisabled = false,
  requirePassword = true,
  showWebsite = false,
  compactFooter = false,
}) {
  const patchForm = (patch) => {
    onChange({ ...formData, ...patch });
  };
  const [schoolEnums, setSchoolEnums] = useState({ ecofo_cycles: [], post_orientations: [] });
  const selectedCategory = categories.find((cat) => String(cat.id) === String(formData.primary_category));
  const isSchool = (selectedCategory?.slug || '') === 'ecole';
  const parentCategories = categories.filter((c) => !c.parent);
  const servicesRoot = parentCategories.find((row) => isServicesRootCategory(row, categories));
  const selectedServiceChild = (
    formData.service_category_id
      ? categories.find((cat) => String(cat.id) === String(formData.service_category_id))
      : null
  ) || (
    isServicesCategory(selectedCategory, categories) && selectedCategory?.parent
      ? selectedCategory
      : null
  );
  const sectorSelectValue = selectedServiceChild
    ? String(selectedServiceChild.parent || servicesRoot?.id || '')
    : formData.primary_category;
  const sectorCategory = categories.find((cat) => String(cat.id) === String(sectorSelectValue));
  const isServicesRoot = isServicesRootCategory(sectorCategory, categories);
  const isHotelTourismRoot = isHotelTourismRootCategory(sectorCategory);
  const needsChild = needsActivityChild(sectorCategory, categories);
  const primaryCategoryChoices = categories.filter((cat) => (
    !(isServicesCategory(cat, categories) && cat.parent)
    && !isHotelTourismChild(cat, categories)
  ));
  const serviceCategoryChoices = categories.filter((cat) => (
    cat.parent
    && (
      !sectorCategory
      || String(cat.parent) === String(sectorCategory.id)
      || cat.parent_name === sectorCategory.name
    )
    && (
      isServicesRoot
        ? isServicesCategory(cat, categories)
        : isHotelTourismRoot
          ? isHotelTourismChild(cat, categories)
          : false
    )
  ));
  const secondaryParents = parentCategories.filter((parent) => !isServicesRootCategory(parent, categories));
  const tracks = formData.school_tracks || {
    offers_prescolaire: false,
    offers_ecofo: false,
    offers_post_fondamental: false,
    ecofo_cycles: [],
    ecofo_classes: [],
    post_fondamental_sections: [],
  };

  useEffect(() => {
    if (isSchool) loadEducationEnums().then(setSchoolEnums);
  }, [isSchool]);

  const patchTracks = (patch) => {
    patchForm({ school_tracks: { ...tracks, ...patch } });
  };

  const handleCategoryToggle = (catId) => {
    const exists = formData.category_ids.includes(catId);
    patchForm({
      category_ids: exists
        ? formData.category_ids.filter((id) => id !== catId)
        : [...formData.category_ids, catId],
    });
  };

  const handleImagePick = async (field, file) => {
    try {
      const dataUrl = await readImageAsDataUrl(file, {
        maxSide: field === 'logo' ? 640 : 480,
        quality: 0.75,
      });
      patchForm({ [field]: dataUrl });
    } catch (err) {
      // Remonter via onChange d'un champ d'erreur n'est pas dispo : laisser le parent gérer via submit
      alert(err.message);
    }
  };

  return (
    <form onSubmit={onSubmit} className="bg-surface rounded-2xl border-2 border-accent overflow-hidden text-ink">
      {error && (
        <div className="bg-alert/10 p-4 border-b-2 border-alert text-ink font-semibold text-sm sm:text-base">
          {error}
        </div>
      )}

      <div className="p-6 sm:p-8 border-b-2 border-alert/20">
        <h3 className="text-lg sm:text-xl font-extrabold text-ink mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-accent" /> Vos informations de connexion
        </h3>

        <div className="mb-5">
          <p className="block text-sm sm:text-base font-bold text-ink mb-2">Votre photo de profil *</p>
          <AvatarPicker
            value={formData.owner_avatar}
            onChange={(dataUrl) => patchForm({ owner_avatar: dataUrl })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">Prénom</label>
            <input
              type="text"
              required
              value={formData.first_name}
              onChange={(e) => patchForm({ first_name: e.target.value })}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">Nom</label>
            <input
              type="text"
              required
              value={formData.last_name}
              onChange={(e) => patchForm({ last_name: e.target.value })}
              className={fieldClass}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm sm:text-base font-bold text-ink mb-1.5 flex items-center gap-1">
              <Mail className="w-4 h-4 text-accent" /> Email de connexion
            </label>
            <input
              type="email"
              required
              disabled={emailDisabled}
              value={formData.owner_email_input}
              onChange={(e) => patchForm({ owner_email_input: e.target.value })}
              className={`${fieldClass} disabled:opacity-60`}
            />
          </div>
          <div>
            <label className="block text-sm sm:text-base font-bold text-ink mb-1.5 flex items-center gap-1">
              <Lock className="w-4 h-4 text-accent" /> Mot de passe
              {!requirePassword && (
                <span className="font-medium text-ink-muted text-xs">(optionnel)</span>
              )}
            </label>
            <PasswordInput
              required={requirePassword}
              value={formData.password}
              onChange={(e) => patchForm({ password: e.target.value })}
              autoComplete="new-password"
              className="px-4 py-3 bg-surface border-2 border-accent rounded-xl focus:border-alert text-ink text-base font-medium"
              toggleClassName="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-ink-muted hover:text-ink transition cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 border-b-2 border-alert/20">
        <h3 className="text-lg sm:text-xl font-extrabold text-ink mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-accent" /> Profil de l&apos;établissement
        </h3>

        <div className="mb-5 flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-24 h-24 rounded-2xl border-2 border-alert overflow-hidden bg-primary/5 flex items-center justify-center shrink-0">
            {formData.logo ? (
              <img src={formData.logo} alt="Logo entreprise" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus className="w-8 h-8 text-accent" />
            )}
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">
              Logo de l&apos;entreprise *
            </label>
            <p className="text-xs sm:text-sm text-ink-muted font-medium mb-2">
              Affiché côté Super Admin et sur les pages clients (liste des entreprises, fiche, etc.).
            </p>
            <input
              type="file"
              accept="image/*"
              required={!formData.logo}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImagePick('logo', file);
              }}
              className="block w-full text-sm text-ink file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-2 file:border-accent file:bg-surface file:text-ink file:font-bold"
            />
            {formData.logo && (
              <button
                type="button"
                onClick={() => patchForm({ logo: '' })}
                className="mt-2 text-sm font-bold text-alert"
              >
                Retirer le logo
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">Nom de l&apos;entreprise *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => patchForm({ name: e.target.value })}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">Téléphone contact</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => patchForm({ phone: e.target.value })}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm sm:text-base font-bold text-ink mb-1.5 flex items-center gap-1">
            <Star className="w-4 h-4 text-accent fill-accent" /> Catégorie principale *
          </label>
          <select
            required
            value={sectorSelectValue}
            onChange={(e) => {
              const nextId = e.target.value;
              const nextCat = categories.find((cat) => String(cat.id) === String(nextId));
              patchForm({
                primary_category: nextId,
                service_category_id: '',
                category_ids: needsActivityChild(nextCat, categories) ? [] : formData.category_ids,
              });
            }}
            className={`${fieldClass} font-semibold`}
          >
            <option value="" disabled>
              -- Choisir votre secteur --
            </option>
            {primaryCategoryChoices.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.parent_name ? `${cat.parent_name} > ${cat.name}` : cat.name}
              </option>
            ))}
          </select>
        </div>

        {needsChild && (
          <div className="mb-4 space-y-2 p-4 rounded-xl border-2 border-accent bg-primary/5">
            <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">
              {isHotelTourismRoot ? 'Type d’établissement *' : 'Catégorie de votre service *'}
            </label>
            <select
              required
              value={formData.service_category_id || selectedServiceChild?.id || ''}
              onChange={(e) => patchForm({ service_category_id: e.target.value })}
              className={`${fieldClass} font-semibold`}
            >
              <option value="" disabled>
                {isHotelTourismRoot ? '-- Hôtel, restaurant, bar, café ou traiteur --' : '-- Choisir votre catégorie --'}
              </option>
              {serviceCategoryChoices.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <p className="text-sm text-ink-muted">
              {isHotelTourismRoot
                ? 'Hôtel : chambres et séjours. Restaurant, bar, café ou traiteur : menu et réservation de table.'
                : 'Ces catégories sont préparées par Isoko Hub. Vous choisissez la vôtre, puis vous gérez vos offres dans l’espace prestataire.'}
            </p>
          </div>
        )}

        {isSchool && (
          <div className="mb-4 space-y-3 p-4 rounded-xl border-2 border-accent bg-primary/5">
            <p className="text-sm font-bold text-ink">Cette école est *</p>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={!!tracks.offers_prescolaire}
                onChange={(e) => patchTracks({ offers_prescolaire: e.target.checked })}
              />
              Enseignement préscolaire
            </label>
            {tracks.offers_prescolaire && (
              <p className="pl-6 text-xs text-ink-muted">
                Premier palier, non obligatoire. Il prépare l&apos;enfant à l&apos;enseignement fondamental.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={!!tracks.offers_ecofo}
                onChange={(e) => patchTracks({ offers_ecofo: e.target.checked })}
              />
              École fondamentale (ECOFO)
            </label>
            {tracks.offers_ecofo && (
              <div className="pl-6 space-y-3">
                <SchoolEcofoClassesEditor
                  classes={tracks.ecofo_classes || []}
                  inputClass={fieldClass}
                  onChange={(ecofo_classes) => patchTracks({ ecofo_classes })}
                />
                <div className="grid sm:grid-cols-2 gap-2">
                {(schoolEnums.ecofo_cycles || []).map((cycle) => (
                  <label key={cycle.value} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={(tracks.ecofo_cycles || []).includes(cycle.value)}
                      onChange={(e) => {
                        const current = tracks.ecofo_cycles || [];
                        patchTracks({
                          ecofo_cycles: e.target.checked
                            ? [...current, cycle.value]
                            : current.filter((code) => code !== cycle.value),
                        });
                      }}
                    />
                    {cycle.label}
                  </label>
                ))}
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={!!tracks.offers_post_fondamental}
                onChange={(e) => patchTracks({ offers_post_fondamental: e.target.checked })}
              />
              Post-fondamental
            </label>
            {tracks.offers_post_fondamental && (
              <div className="pl-6">
                <SchoolSectionsEditor
                  sections={tracks.post_fondamental_sections || []}
                  catalog={schoolEnums.post_filieres}
                  inputClass={fieldClass}
                  onChange={(post_fondamental_sections) => patchTracks({ post_fondamental_sections })}
                />
              </div>
            )}
          </div>
        )}

        {(formData.service_category_id || (!needsChild && formData.primary_category)) ? (
          <div className="mb-4 bg-primary/5 p-4 rounded-xl border-2 border-accent">
            <SectorSpecificFields
              primaryCategory={formData.service_category_id || formData.primary_category}
              categories={categories}
              attributes={formData.extra_attributes}
              onChange={(attrs) => patchForm({ extra_attributes: attrs })}
            />
          </div>
        ) : null}

        <div className="mb-4">
          <div className="bg-primary/5 p-4 rounded-xl border-2 border-alert/40">
            <LocationSelector
              province={formData.province}
              commune={formData.commune}
              zone={formData.zone}
              quartier={formData.quartier}
              avenue={formData.avenue}
              address={formData.address}
              latitude={formData.latitude}
              longitude={formData.longitude}
              onChange={(loc) => patchForm(loc)}
            />
          </div>
        </div>

        {showWebsite && (
          <div className="mb-4">
            <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">Site web officiel</label>
            <input
              type="url"
              placeholder="https://www.exemple.com"
              value={formData.website || ''}
              onChange={(e) => patchForm({ website: e.target.value })}
              className={fieldClass}
            />
          </div>
        )}

        {!isServicesRoot && (
        <div className="mb-4">
          <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">
            Catégories &amp; services secondaires (optionnel)
          </label>
          <div className="bg-surface border-2 border-accent rounded-xl p-4 max-h-48 overflow-y-auto space-y-4 custom-scrollbar">
            {secondaryParents.map((parent) => {
              const children = categories.filter(
                (c) => c.parent === parent.id || (c.parent_name && c.parent_name === parent.name)
              );
              if (children.length === 0) return null;

              return (
                <div key={parent.id} className="space-y-2">
                  <div className="font-bold text-xs sm:text-sm text-accent uppercase tracking-wider flex items-center gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5" /> {parent.name}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                    {children.map((child) => (
                      <label
                        key={child.id}
                        className="flex items-center gap-2 text-sm sm:text-base text-ink font-medium cursor-pointer select-none hover:text-primary transition"
                      >
                        <input
                          type="checkbox"
                          checked={formData.category_ids.includes(child.id)}
                          onChange={() => handleCategoryToggle(child.id)}
                          className="rounded border-2 border-accent bg-surface text-primary focus:ring-accent"
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
        )}

        <div>
          <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">Description courte</label>
          <textarea
            rows="3"
            value={formData.description}
            onChange={(e) => patchForm({ description: e.target.value })}
            className={`${fieldClass} resize-none`}
          />
        </div>
      </div>

      <div
        className={`p-6 sm:p-8 bg-primary/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t-2 border-accent ${
          compactFooter ? 'sticky bottom-0' : ''
        }`}
      >
        <button
          type="button"
          onClick={onCancel}
          className="text-ink font-bold text-base hover:text-accent transition-colors text-center sm:text-left"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:opacity-95 text-surface font-bold text-base rounded-xl border-2 border-accent transition disabled:opacity-50"
        >
          {submitting ? 'Enregistrement...' : submitLabel} <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
}
