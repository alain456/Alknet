# PROMPT — MODULE ÉDUCATION
# Isoko Hub

## Rôle

Tu es un lead Django / React et product designer senior. Construis et intègre le module **Éducation** dans la plateforme Isoko Hub déjà existante.

Ce module n’est pas une application séparée. C’est un établissement de la catégorie parent **Éducation**, au même titre que l’hôpital est un établissement de la catégorie **Santé** et l’hôtel un établissement de la catégorie **Hôtellerie**.

Avant toute modification :

1. inspecte le code déjà présent (apps Django, routes React, `Business`, catégories, rôles, layout, `hospital/`, `hotel/`, pharmacies) ;
2. réutilise la création d’entreprise, l’abonnement SaaS, les rôles, BurundiPay, la localisation (province, commune, quartier, GPS) et l’isolation par établissement ;
3. ne recrée pas un système de comptes, de paiement ou de catégories ;
4. respecte les conventions visuelles déjà en place (Tailwind, palette Isoko).

Stack réelle du projet : Django, Django REST Framework, PostgreSQL, JWT, React, Vite, Tailwind. Ne pars pas sur une nouvelle pile.

## Décision de cadrage

Le document `MODULE ÉDUCATION` décrit un référentiel des établissements d’enseignement supérieur. Dans Isoko Hub, le parent de catégorie est **Éducation**. Les enfants déjà prévus sont :

``'text
Université
École
Centre de formation
Cours particuliers
```

Le module doit servir ces quatre enfants. L’université est le cas le plus structuré (facultés, formations, admissions). Une école, un centre de formation ou des cours particuliers utilisent la même fiche, avec une organisation plus simple : pas de faculté obligatoire.

Ce n’est pas un logiciel de notes, d’emploi du temps quotidien, ni un campus virtuel (LMS). L’étudiant consulte, compare, prépare un dossier et peut payer des frais publiés. Il ne passe pas ses examens dans Isoko Hub.

## Objectif

```text
Visiteur cherche une formation ou un établissement
        ↓
Fiche publique (lieu, offre, conditions, frais, calendrier)
        ↓
L’établissement publie et met à jour son contenu
        ↓
Un candidat dépose une demande d’information ou d’inscription
        ↓
L’établissement instruit la demande
        ↓
Les frais exigibles se paient via BurundiPay
        ↓
L’étudiant suit le statut dans son espace
```

## Acteurs

Mappe les acteurs du cahier sur les rôles Isoko déjà présents. N’invente pas un nouveau type de compte.

| Acteur du cahier | Dans Isoko Hub |
|---|---|
| Super administrateur | `SUPER_ADMIN` — supervision plateforme, pas l’édition du contenu d’une université |
| Administrateur Éducation | rôle plateforme contenu / modération : valider qu’une fiche publique est acceptable |
| Administrateur d’université | `BUSINESS_OWNER` de l’établissement, ou employé avec droit `education.manage` |
| Responsable de faculté | employé dont le rôle ne voit que les formations qu’on lui a assignées |
| Utilisateur / étudiant | `CUSTOMER` |
| Visiteur | anonyme, pages publiques seulement |

Règle d’isolation : un administrateur d’établissement ne lit et ne modifie que son établissement. C’est la même règle que l’hôpital et l’hôtel.

Permissions à cataloguer, sur le modèle `hospital.*` / `hotel.*` :

```text
education.profile.view / update
education.structure.manage      facultés, départements
education.programs.manage       formations
education.admissions.manage     conditions, pièces, calendrier, dossiers reçus
education.fees.manage           frais et paiements
education.services.manage       bibliothèque, stages, vie étudiante
```

Le propriétaire de l’établissement a tous ces droits. Le super admin plateforme ne les a pas pour « faire le métier » à la place de l’université.

## Socle à réutiliser

- `Business` = l’établissement (nom, logo, description, téléphone, e-mail, site, province, commune, quartier, GPS).
- Catégorie parent `Éducation` + enfant (`Université`, `École`, `Centre de formation`, `Cours particuliers`).
- Abonnement SaaS : si l’abonnement est bloqué, le catalogue public de cet établissement est masqué, comme pour les autres catégories.
- BurundiPay pour les frais exigibles (inscription, scolarité publiée). Pas un second prestataire de paiement.
- E-mails via l’adresse officielle du projet (`info.isokohub@gmail.com`), avec le même envoi que les autres modules.
- Espace client existant (`/dashboard`) pour « mes demandes » et « mes paiements ».

## Modèle de données

Crée une app Django `education`, rattachée à `Business`.

### Fiche établissement (`EducationProfile`)

Une fiche pour le `Business` de catégorie Éducation :

- statut publié : en activité, inscriptions ouvertes, temporairement fermé ;
- historique court (texte) ;
- langues d’enseignement ;
- site web et e-mail institutionnel (en plus des champs déjà sur `Business`) ;
- particularités (boursiers, internat, campus, cours du soir) en champs structurés, pas un seul bloc de texte ;
- validation publique : brouillon / soumis / publié. Seul le publié est visible sans connexion.

Ne duplique pas l’adresse. La localisation reste sur `Business`.

### Organisation

Hiérarchie :

```text
Établissement → Faculté ou école (optionnelle) → Département (optionnel) → Formation → Niveau → Période (semestre ou autre)
```

- Une école ou un centre de formation peut créer des formations directement sous l’établissement.
- Une université peut créer des facultés puis des départements.
- Une formation : intitulé, domaine, diplôme délivré, durée, nombre d’années, niveau d’entrée, niveau de sortie, débouchés (texte court), active / masquée.

### Admission

Par formation et par année académique :

- diplôme requis, prérequis, note minimale éventuelle, concours ou test, conditions particulières ;
- liste de pièces (nom, obligatoire ou non), variable selon formation, niveau et année ;
- calendrier : ouverture, clôture, inscription tardive, date de concours, date de publication des résultats, période de confirmation.

### Demande d’inscription (MVP)

Un `CUSTOMER` connecté peut envoyer une demande pour une formation dont les inscriptions sont ouvertes.

Statuts :

```text
BROUILLON → ENVOYÉE → EN_INSTRUCTION → COMPLÉMENT_DEMANDÉ → ACCEPTÉE → REFUSÉE → CONFIRMÉE
```

Pièces : fichiers réels (pas une URL collée), comme les ordonnances et les comptes-rendus de labo. Taille limitée. Visible par le candidat et par le personnel habilité de cet établissement seulement.

L’établissement accepte, refuse avec motif, ou demande un complément. Un e-mail part au candidat à chaque changement de statut.

### Frais

Catalogue de frais par formation et année : libellé, montant BIF, obligatoire ou non, échéance.

Paiement BurundiPay du candidat vers le compte marchand de l’établissement, sur le même modèle que la consultation hôpital. Numéro payeur validé (8 chiffres ou 257 + 8 chiffres) avant l’appel.

Statuts de paiement : `UNPAID`, `AWAITING_PIN`, `PAID`, `FAILED`, `WAIVED`.

Pas de prélèvement automatique de l’abonnement SaaS ici : ça reste la page Abonnement de l’entreprise.

### Année académique, bibliothèque, stages, vie étudiante

À publier, pas à « gérer comme un ERP » :

- année : dates de rentrée, de pause, d’examens, de délibération ;
- bibliothèque : horaires, conditions d’accès, contact ;
- stages : obligatoires ou non, durée, période, contact du service ;
- services étudiants : internat, bourse, infirmerie, restauration — nom, description courte, contact.

## Parcours écrans

### Public (sans compte)

- liste des établissements Éducation publiés, filtre par enfant de catégorie, ville / commune, domaine, niveau ;
- fiche établissement : localisation, carte si GPS, bouton itinéraire, offre de formation ;
- fiche formation : conditions, pièces, calendrier, frais ;
- recherche du portail (`/search`) inclut ces établissements et ces formations.

### Étudiant (`CUSTOMER`)

- envoyer une demande si les inscriptions sont ouvertes ;
- déposer et remplacer ses pièces ;
- voir le statut ;
- payer un frais publié ;
- retrouver la demande dans `/dashboard`.

### Établissement

Espace sous le layout entreprise, menus filtrés par les permissions `education.*` :

- tableau de bord : demandes en attente, inscriptions ouvertes, frais impayés ;
- fiche institutionnelle ;
- facultés / départements si la catégorie est Université ;
- formations ;
- admissions : conditions, pièces, calendrier ;
- dossiers reçus : instruire, accepter, refuser, demander un complément ;
- frais et paiements ;
- année, bibliothèque, stages, services étudiants ;
- rôles du personnel (sur la page Rôles déjà existante, pas un second écran de comptes).

### Super admin

Pas un second CMS métier. Il voit l’établissement dans la modération entreprises déjà existante (approuver / suspendre). Il ne réécrit pas le programme d’une faculté.

## Découpage

Livre dans cet ordre. Ne commence pas par les frais.

**P0 — Annuaire.** Fiche établissement publiée, liste publique, fiche formation simple (intitulé, durée, diplôme), recherche.

**P1 — Organisation.** Facultés, départements, formations complètes, filtres domaine / niveau / lieu.

**P2 — Admission.** Conditions, pièces, calendrier, demande du candidat, instruction, e-mails de statut, audit des changements de statut.

**P3 — Frais et vie du campus.** Catalogue de frais, BurundiPay, année académique, bibliothèque, stages, services étudiants.

## Règles

- Isolation par `business_id` sur toutes les requêtes staff.
- Une donnée non publiée n’apparaît pas dans l’API publique.
- Pas de suppression physique d’une demande déjà envoyée : un statut final.
- Les fichiers de dossier ne sont pas des data-URI géants en base : `FileField` média, taille max explicitée.
- Le super admin plateforme ne passe pas les listes métier (même garde que le laboratoire et les rendez-vous).
- Texte de l’interface en français.
- Tests : un visiteur ne voit pas un brouillon ; un établissement A ne lit pas les dossiers de B ; un numéro BurundiPay invalide est refusé avant le paiement ; une demande hors période est refusée.

## Hors périmètre

- notes, bulletins, relevés de notes générés par la plateforme ;
- emploi du temps heure par heure et appel en classe ;
- cours en ligne, devoirs, forum de classe ;
- paie du personnel enseignant ;
- un nouveau rôle de compte « étudiant » distinct de `CUSTOMER`.
