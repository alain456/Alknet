/**
 * Les valeurs doivent venir du backend, jamais d'une liste recopiée ici :
 * `EducationProfile.ESTABLISHMENT_TYPE_CHOICES`, `EducationProgram.LEVEL_CHOICES`
 * et `EducationUnit.UNIT_KIND_CHOICES`. Les listes locales avaient divergé
 * (HIGH_SCHOOL, PRIMARY_SCHOOL, TUTORING_CENTER… n'existent pas en base), donc
 * le filtre de l'annuaire renvoyait zéro résultat.
 *
 * Le repli ci-dessous copie le modèle pour que l'écran reste utilisable si
 * l'API est momentanément injoignable. Même forme que la réponse : une liste
 * d'objets `{value, label}`.
 */

const pair = (value, label) => ({ value, label });

export const EDUCATION_ENUM_FALLBACK = {
  establishment_types: [
    pair('UNIVERSITY', 'Université'),
    pair('SCHOOL', 'École'),
    pair('TRAINING_CENTER', 'Centre de formation'),
    pair('PRIVATE_LESSONS', 'Cours particuliers'),
    pair('OTHER', 'Autre'),
  ],
  operational_statuses: [
    pair('ACTIVE', 'En activité'),
    pair('ENROLLMENT_OPEN', 'Inscriptions ouvertes'),
    pair('ENROLLMENT_CLOSED', 'Inscriptions fermées'),
    pair('TEMPORARILY_CLOSED', 'Temporairement fermé'),
    pair('CLOSED', 'Fermé définitivement'),
  ],
  levels: [
    pair('PRIMARY', 'Primaire'),
    pair('LOWER_SECONDARY', 'Collège'),
    pair('UPPER_SECONDARY', 'Lycée'),
    pair('VOCATIONAL', 'Technique / professionnel'),
    pair('LICENCE', 'Licence'),
    pair('MASTER', 'Master'),
    pair('DOCTORATE', 'Doctorat'),
    pair('CERTIFICATE', 'Certificat / diplôme court'),
    pair('OTHER', 'Autre'),
  ],
  unit_kinds: [
    pair('FACULTY', 'Faculté'),
    pair('DEPARTMENT', 'Département'),
    pair('SCHOOL', 'École interne'),
  ],
  particularities: [
    pair('has_scholarships', 'Bourses d\'études'),
    pair('has_boarding', 'Internat'),
    pair('has_campus', 'Campus'),
    pair('has_evening_courses', 'Cours du soir'),
    pair('has_distance_learning', 'Cours à distance'),
  ],
  publication_statuses: [
    pair('DRAFT', 'Brouillon'),
    pair('SUBMITTED', 'Soumis à modération'),
    pair('PUBLISHED', 'Publié'),
    pair('REJECTED', 'Refusé'),
  ],
  application_statuses: [
    pair('BROUILLON', 'Brouillon'),
    pair('ENVOYEE', 'Envoyée'),
    pair('EN_INSTRUCTION', 'En instruction'),
    pair('COMPLEMENT_DEMANDE', 'Complément demandé'),
    pair('ACCEPTEE', 'Acceptée'),
    pair('REFUSEE', 'Refusée'),
    pair('CONFIRMEE', 'Confirmée'),
  ],
  ecofo_cycles: [
    pair('C1', '1er cycle — 1ère et 2ème années'),
    pair('C2', '2e cycle — 3ème et 4ème années'),
    pair('C3', '3e cycle — 5ème et 6ème années'),
    pair('C4', '4e cycle — 7ème, 8ème et 9ème années'),
  ],
  post_orientations: [
    pair('GENERAL', 'Général'),
    pair('PEDAGOGIQUE', 'Pédagogique'),
    pair('TECHNIQUE', 'Technique'),
  ],
  boarding_regimes: [
    pair('INTERNAT', 'Internat — filles et garçons logés'),
    pair('EXTERNE', 'Externe — tout le monde rentre chez soi'),
    pair('MIXTE', 'Mixte — internes et externes'),
    pair('FILLES_INTERNES', 'Internat pour les filles, garçons externes'),
    pair('GARCONS_INTERNES', 'Internat pour les garçons, filles externes'),
  ],
  enrollment_tracks: [
    pair('PRESCOLAIRE', 'Maternelle / Préscolaire'),
    pair('ECOFO', 'École fondamentale (ECOFO)'),
    pair('POST_FONDAMENTAL', 'Post-fondamental'),
  ],
  ecofo_years: [
    pair('1', '1ère année'),
    pair('OTHER', 'Autre année'),
  ],
  enrollment_documents_by_track: {
    PRESCOLAIRE: {
      label: 'Maternelle / Préscolaire',
      documents: [{ label: "Extrait d'acte de naissance", description: '', required: true }],
    },
    ECOFO: {
      label: 'École fondamentale (ECOFO)',
      years: [
        {
          value: '1',
          label: '1ère année',
          documents: [
            { label: "Extrait d'acte de naissance", description: '', required: true },
            { label: 'Bulletin', description: '', required: true },
            { label: 'Attestation de fréquentation', description: '', required: true },
            { label: 'Attestation de non-redevabilité', description: '', required: true },
          ],
        },
        {
          value: 'OTHER',
          label: 'Autre année',
          documents: [
            { label: 'Bulletin', description: '', required: true },
            { label: 'Attestation de fréquentation', description: '', required: true },
            { label: 'Attestation de non-redevabilité', description: '', required: true },
          ],
        },
      ],
    },
    POST_FONDAMENTAL: {
      label: 'Post-fondamental',
      documents: [
        { label: 'Bulletin', description: '', required: true },
        { label: 'Attestation de fréquentation', description: '', required: true },
        { label: 'Attestation de non-redevabilité', description: '', required: true },
      ],
    },
  },
  post_filieres: {
    intro: 'Il se divise en plusieurs filières après le cycle fondamental.',
    families: [
      {
        key: 'humanites',
        title: 'Général et Pédagogique',
        description: 'Axé sur les humanités (lettres, sciences, sciences économiques).',
        filieres: [
          { value: 'GENERAL', label: 'Général', sections: ['Lettres', 'Sciences', 'Sciences économiques'], allow_custom: false },
          { value: 'PEDAGOGIQUE', label: 'Pédagogique', sections: ['Lettres', 'Sciences', 'Sciences économiques'], allow_custom: false },
        ],
      },
      {
        key: 'technique',
        title: 'Technique',
        description: 'Offre de nombreuses options spécialisées (agriculture, élevage, électromécanique, informatique).',
        filieres: [
          { value: 'TECHNIQUE', label: 'Technique', sections: ['Agriculture', 'Élevage', 'Électromécanique', 'Informatique'], allow_custom: true },
        ],
      },
    ],
  },
};

let cache = null;
let inflight = null;

/** Chargé une seule fois : les choix changent au déploiement, pas à la volée. */
export function loadEducationEnums() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = import('../shared/api')
      .then(({ api }) => api.get('education/enum-choices/'))
      .then((data) => {
        // On ne remplace une clé que si le backend a bien renvoyé la liste :
        // une réponse partielle ne doit pas vider un formulaire.
        const merged = { ...EDUCATION_ENUM_FALLBACK };
        Object.keys(EDUCATION_ENUM_FALLBACK).forEach((key) => {
          const incoming = data?.[key];
          if (Array.isArray(incoming) && incoming.length) merged[key] = incoming;
          else if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) merged[key] = incoming;
        });
        return merged;
      })
      .catch(() => EDUCATION_ENUM_FALLBACK)
      .then((data) => {
        cache = data;
        inflight = null;
        return data;
      });
  }
  return inflight;
}
