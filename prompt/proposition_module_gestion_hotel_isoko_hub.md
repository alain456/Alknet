# PROPOSITION — MODULE DE GESTION D’HÔTEL
# Isoko Hub

## 1. Recommandation générale

Pour l’hôtel, je recommande de construire d’abord un **PMS — Property Management System**, c’est-à-dire un système de gestion interne de l’établissement.

Le MVP doit couvrir :

```text
Configuration de l’hôtel
→ Types de chambres et chambres
→ Tarifs et disponibilités
→ Réservations
→ Arrivée du client
→ Séjour
→ Services consommés
→ Facturation
→ Paiement
→ Départ du client
→ Rapports et audit
```

Il vaut mieux commencer par la gestion opérationnelle d’un hôtel que par une marketplace touristique. Une fois ce socle stable, il sera possible d’ajouter les réservations en ligne, les agences de voyage, les plateformes externes et les paiements numériques.

---

## 2. Modèle général dans Isoko Hub

Comme pour l’hôpital et les pharmacies, il faut distinguer trois niveaux :

### Le rôle

Le rôle définit les permissions de l’utilisateur.

Exemple :

```text
Réceptionniste → gérer les réservations et les check-in
Caissier → gérer les factures et paiements
Gouvernante → gérer l’état des chambres
```

### L’hôtel

L’hôtel définit l’établissement auquel l’utilisateur est rattaché.

```text
Entreprise : Hôtel de la Source
Catégorie : Hôtel
```

### Le département

Le département définit le contexte de travail :

- Réception ;
- Réservations ;
- Hébergement ;
- Ménage/Housekeeping ;
- Comptabilité ;
- Maintenance ;
- Direction.

Un utilisateur peut donc être :

```text
Rôle : Réceptionniste
Hôtel : Hôtel de la Source
Département : Réception
```

Cette séparation doit rester la même que dans le module hospitalier :

```text
Rôle = permissions
Hôtel = établissement
Département = contexte de travail
```

---

## 3. Acteurs recommandés

### 3.1 Administrateur de la plateforme

Il supervise les entreprises de catégorie `Hôtel`, mais ne gère pas les opérations quotidiennes de chaque établissement.

Il peut :

- gérer les hôtels enregistrés ;
- vérifier ou suspendre un hôtel ;
- consulter les statistiques globales ;
- gérer les catégories et paramètres communs ;
- consulter l’audit global.

### 3.2 Administrateur / Manager de l’hôtel

Il gère la configuration et l’activité générale de son hôtel.

Il peut :

- gérer le profil de l’hôtel ;
- gérer les utilisateurs et permissions ;
- créer les types de chambres ;
- créer les chambres ;
- définir les tarifs ;
- gérer les réservations ;
- consulter les séjours ;
- gérer les services ;
- consulter la facturation ;
- consulter les rapports ;
- consulter l’audit de son hôtel.

### 3.3 Réceptionniste

Il gère les opérations de réception :

- créer une réservation ;
- modifier une réservation ;
- confirmer ou annuler une réservation ;
- enregistrer l’arrivée ;
- attribuer une chambre ;
- enregistrer le départ ;
- consulter les disponibilités ;
- ajouter des services au séjour ;
- imprimer ou envoyer un récapitulatif.

Il ne peut pas modifier les paramètres sensibles de l’hôtel ni supprimer l’historique financier.

### 3.4 Agent des réservations

Il gère principalement les réservations avant l’arrivée :

- consulter le calendrier ;
- créer une réservation ;
- enregistrer les informations du client ;
- appliquer un tarif autorisé ;
- confirmer ou annuler une réservation ;
- gérer les demandes spéciales ;
- consulter les disponibilités.

### 3.5 Gouvernante / Responsable housekeeping

Elle gère l’état opérationnel des chambres :

- voir les chambres à nettoyer ;
- affecter une tâche à un agent ;
- changer l’état d’une chambre ;
- signaler une anomalie ;
- déclarer une chambre prête ;
- consulter l’historique du nettoyage.

### 3.6 Agent de ménage

Il voit uniquement les tâches qui lui sont affectées.

Il peut :

- voir les chambres à nettoyer ;
- commencer une tâche ;
- terminer une tâche ;
- signaler un objet manquant ou une anomalie ;
- signaler une chambre nécessitant une intervention technique.

### 3.7 Caissier / Comptable

Il gère :

- les folios clients ;
- les factures ;
- les paiements ;
- les acomptes ;
- les remboursements autorisés ;
- les clôtures de caisse ;
- les rapports financiers.

Il ne peut pas modifier les réservations sans permission spécifique.

### 3.8 Agent de maintenance

Il gère :

- les incidents techniques ;
- les demandes d’intervention ;
- les chambres bloquées pour maintenance ;
- les équipements ;
- le statut des interventions ;
- l’historique des réparations.

### 3.9 Client / Voyageur

Le client peut être :

- une personne physique ;
- une entreprise qui réserve pour un employé ;
- une agence ou un partenaire, dans une phase ultérieure.

Pour le MVP, commencer par le client individuel et permettre à la réception de créer la réservation pour lui.

---

## 4. Structure de l’hôtel

### Profil de l’établissement

Prévoir :

- identifiant de l’hôtel ;
- nom officiel ;
- nom commercial ;
- catégorie ;
- nombre d’étoiles, si applicable ;
- numéro d’autorisation ;
- statut : `Actif`, `Suspendu`, `Fermé` ;
- adresse ;
- ville/commune ;
- téléphone ;
- email professionnel ;
- site web ;
- description ;
- équipements généraux ;
- heures de check-in ;
- heures de check-out ;
- devise principale ;
- politique d’annulation.

### Types de chambres

Exemples :

```text
Chambre simple
Chambre double
Chambre twin
Chambre familiale
Suite
```

Pour chaque type :

- nom ;
- description ;
- capacité adulte ;
- capacité enfant ;
- nombre de lits ;
- équipements ;
- prix de base ;
- photos ;
- statut actif/inactif.

### Chambres physiques

Chaque chambre possède :

- numéro ou code ;
- étage ;
- type de chambre ;
- capacité ;
- statut opérationnel ;
- état housekeeping ;
- état maintenance ;
- tarif applicable ;
- équipements ;
- date de mise en service.

Statuts opérationnels :

```text
Disponible
Occupée
Réservée
Nettoyage requis
Prête
Hors service
En maintenance
Bloquée
```

---

## 5. Tarifs et disponibilité

Le prix ne doit pas être un simple champ texte.

Prévoir :

- tarif par type de chambre ;
- prix par nuit ;
- devise ;
- date de début ;
- date de fin ;
- tarif standard ;
- tarif week-end ;
- tarif saisonnier ;
- tarif promotionnel ;
- tarif entreprise ;
- nombre maximal d’occupants ;
- conditions d’annulation ;
- statut actif/inactif.

Pour le MVP, commencer par :

```text
Tarif standard
Tarif par nuit
Prix par type de chambre
Disponibilité par date
```

Le système doit empêcher :

- deux réservations confirmées sur la même chambre aux mêmes dates ;
- la réservation d’une chambre en maintenance ;
- la réservation d’une chambre bloquée ;
- l’affichage d’une chambre comme disponible lorsqu’elle est déjà attribuée.

---

## 6. Client et réservation

### Informations du client

Prévoir :

- nom ;
- prénom ;
- téléphone ;
- email ;
- nationalité, si nécessaire ;
- type de client ;
- document d’identité, selon les exigences métier et réglementaires ;
- personne ou entreprise qui effectue la réservation ;
- remarques ;
- consentements nécessaires.

Les données sensibles doivent être limitées à ce qui est nécessaire au séjour et protégées par les permissions.

### Création d’une réservation

Le parcours de réservation interne :

```text
Choisir les dates
→ Vérifier les chambres disponibles
→ Choisir un type de chambre
→ Choisir une chambre ou laisser l’hôtel l’attribuer
→ Ajouter les informations du client
→ Choisir le tarif
→ Ajouter les demandes spéciales
→ Calculer le total
→ Enregistrer la réservation
→ Envoyer la confirmation
```

### Statuts de réservation

```text
Brouillon
En attente
Confirmée
Arrivée prévue
Client arrivé
Client parti
Annulée
No-show
Expirée
```

Référence recommandée :

```text
RES-HOT-2026-000001
```

### Informations d’une réservation

- référence ;
- client ;
- chambre ou type de chambre ;
- date d’arrivée ;
- date de départ ;
- nombre de nuits ;
- nombre d’adultes ;
- nombre d’enfants ;
- tarif ;
- montant par nuit ;
- montant total ;
- statut ;
- canal de réservation ;
- demandes spéciales ;
- commentaire interne ;
- historique des modifications.

---

## 7. Arrivée du client — Check-in

Le check-in doit permettre à la réception de :

1. rechercher la réservation ;
2. vérifier les informations du client ;
3. confirmer la chambre ;
4. enregistrer l’heure d’arrivée ;
5. enregistrer les informations nécessaires ;
6. créer le séjour ;
7. passer la réservation à `Client arrivé` ;
8. passer la chambre à `Occupée` ;
9. créer ou ouvrir le folio client ;
10. imprimer ou envoyer la confirmation du séjour.

Prévoir aussi un check-in sans réservation, si une chambre est disponible :

```text
Arrivée sans réservation
→ Sélection d’une chambre disponible
→ Création du profil client
→ Création du séjour
→ Ouverture du folio
```

Cette fonction doit être contrôlée par une permission spécifique.

---

## 8. Gestion du séjour

Le séjour regroupe toutes les opérations liées au client pendant sa présence :

- chambre ;
- dates ;
- occupants ;
- prolongation ;
- changement de chambre ;
- services consommés ;
- réductions autorisées ;
- paiements ;
- solde ;
- remarques ;
- historique.

La réception peut :

- prolonger un séjour si la chambre est disponible ;
- changer la chambre ;
- ajouter ou retirer des occupants selon les règles de l’hôtel ;
- ajouter une note interne ;
- consulter le solde du client.

Toute modification importante doit être historisée.

---

## 9. Services et consommations

Prévoir un catalogue de services :

```text
Petit-déjeuner
Restaurant
Boisson
Blanchisserie
Parking
Salle de conférence
Spa
Service de chambre
Autre
```

Pour le MVP, l’Admin peut créer :

- nom du service ;
- description ;
- prix ;
- unité ;
- devise ;
- statut actif/inactif.

Un service ajouté au séjour crée une ligne dans le folio :

```text
Service
Quantité
Prix unitaire
Total
Date
Utilisateur ayant ajouté la ligne
```

---

## 10. Facturation et paiement

Le folio est le compte financier du séjour.

Il contient :

- nuitées ;
- services ;
- taxes configurées ;
- remises autorisées ;
- acomptes ;
- paiements ;
- solde restant.

### Statuts du paiement

```text
En attente
Partiel
Payé
Échoué
Remboursé
Annulé
```

### Moyens de paiement

Prévoir une configuration extensible :

- espèces ;
- virement bancaire ;
- carte ;
- mobile money ;
- autre.

Pour le MVP, ces moyens peuvent être enregistrés manuellement si aucune intégration de paiement n’est encore disponible.

### Facture

La facture doit afficher :

- nom de l’hôtel ;
- adresse ;
- numéro de facture ;
- référence du séjour ;
- client ;
- période ;
- nuitées ;
- services ;
- taxes ;
- remises ;
- total ;
- montant payé ;
- solde ;
- devise ;
- statut ;
- date d’émission.

Référence recommandée :

```text
INV-HOT-2026-000001
```

---

## 11. Départ du client — Check-out

Le check-out doit suivre ce parcours :

```text
Réception ouvre le séjour
→ Vérifie les consommations
→ Vérifie les paiements
→ Calcule le solde
→ Encaisse ou confirme le règlement
→ Génère la facture
→ Enregistre le départ
→ Ferme le folio
→ Passe la chambre à Nettoyage requis
```

Empêcher le départ si :

- un montant obligatoire reste impayé ;
- une information essentielle est manquante ;
- une opération financière est encore en cours.

Prévoir une permission permettant au manager d’autoriser exceptionnellement un départ avec solde restant.

---

## 12. Housekeeping

Le module housekeeping doit être simple et opérationnel.

### États d’une chambre

```text
Sale
Propre
Prête
Occupée
Nettoyage requis
Inspection requise
Hors service
```

### Tâches

Chaque tâche contient :

- chambre ;
- type de tâche ;
- priorité ;
- agent assigné ;
- date ;
- heure de début ;
- heure de fin ;
- commentaire ;
- photos ou pièces jointes si le backend le permet.

Parcours :

```text
Client quitte
→ Chambre à nettoyer
→ Tâche assignée
→ Nettoyage en cours
→ Inspection
→ Chambre prête
```

Une chambre ne doit pas redevenir disponible avant d’être marquée `Prête`.

---

## 13. Maintenance

Créer des tickets de maintenance :

- numéro ;
- chambre ou équipement ;
- catégorie ;
- description ;
- priorité ;
- créé par ;
- assigné à ;
- statut ;
- date d’ouverture ;
- date de résolution ;
- commentaire ;
- coût éventuel.

Statuts :

```text
Nouveau
Assigné
En cours
En attente
Résolu
Fermé
```

Une chambre avec un problème bloquant doit automatiquement passer à :

```text
En maintenance
```

Elle ne doit plus être proposée dans les disponibilités.

---

## 14. Tableaux de bord par rôle

### Dashboard Admin/Manager

```text
Occupation actuelle
Arrivées du jour
Départs du jour
Réservations à venir
Revenu du jour
Factures impayées
Chambres hors service
Tâches housekeeping en attente
Tickets de maintenance ouverts
```

### Dashboard Réception

```text
Arrivées aujourd’hui
Départs aujourd’hui
Réservations en attente
Chambres disponibles
Clients actuellement présents
Demandes spéciales
```

### Dashboard Housekeeping

```text
Chambres à nettoyer
Chambres en inspection
Chambres prêtes
Tâches urgentes
Anomalies signalées
```

### Dashboard Caissier

```text
Foli os ouverts
Paiements du jour
Soldes impayés
Factures à émettre
Clôture de caisse
```

### Dashboard Maintenance

```text
Tickets nouveaux
Tickets urgents
Chambres bloquées
Interventions en cours
Interventions terminées
```

---

## 15. Menus MVP

### Admin / Manager

```text
Tableau de bord
Mon hôtel
Types de chambres
Chambres
Tarifs
Réservations
Séjours
Clients
Services
Housekeeping
Maintenance
Facturation
Rapports
Utilisateurs et rôles
Historique
Paramètres
```

### Réceptionniste

```text
Tableau de bord
Calendrier
Réservations
Arrivées
Départs
Séjours en cours
Clients
Facturation
```

### Agent Housekeeping

```text
Tableau de bord
Mes tâches
État des chambres
Signaler une anomalie
```

### Caissier

```text
Tableau de bord
Foli os
Paiements
Factures
Clôture de caisse
Rapports financiers
```

### Maintenance

```text
Tableau de bord
Tickets
Chambres bloquées
Équipements
Historique des interventions
```

---

## 16. Routes MVP

### Administration

```text
/hotel/dashboard
/hotel/company
/hotel/room-types
/hotel/rooms
/hotel/rates
/hotel/reservations
/hotel/reservations/:id
/hotel/stays
/hotel/stays/:id
/hotel/guests
/hotel/services
/hotel/housekeeping
/hotel/maintenance
/hotel/invoices
/hotel/reports
/hotel/users
/hotel/audit
/hotel/settings
```

### Réception

```text
/hotel/front-desk
/hotel/front-desk/calendar
/hotel/front-desk/arrivals
/hotel/front-desk/departures
/hotel/front-desk/stays
```

### Housekeeping

```text
/hotel/housekeeping/dashboard
/hotel/housekeeping/tasks
/hotel/housekeeping/rooms
```

### Caissier

```text
/hotel/cashier/dashboard
/hotel/cashier/folios
/hotel/cashier/payments
/hotel/cashier/invoices
/hotel/cashier/closing
```

### Maintenance

```text
/hotel/maintenance/dashboard
/hotel/maintenance/tickets
/hotel/maintenance/rooms
```

---

## 17. Modèle de données recommandé

```text
Hotel
- id
- business_id
- name
- category
- license_number
- status
- address
- city
- phone
- professional_email
- check_in_time
- check_out_time
- currency
```

```text
HotelDepartment
- id
- hotel_id
- name
- status
```

```text
RoomType
- id
- hotel_id
- name
- description
- capacity
- bed_configuration
- base_price
- status
```

```text
Room
- id
- hotel_id
- room_type_id
- number
- floor
- operational_status
- housekeeping_status
- maintenance_status
```

```text
RatePlan
- id
- hotel_id
- room_type_id
- name
- price_per_night
- currency
- valid_from
- valid_to
- cancellation_policy
- status
```

```text
Guest
- id
- user_id nullable
- first_name
- last_name
- phone
- email
- identity_reference nullable
- notes
```

```text
Reservation
- id
- reference
- hotel_id
- guest_id
- room_type_id
- room_id nullable
- rate_plan_id
- check_in_date
- check_out_date
- adults
- children
- status
- source
- special_requests
- total_amount
- created_by
- created_at
- updated_at
```

```text
Stay
- id
- reservation_id
- hotel_id
- guest_id
- room_id
- actual_check_in
- actual_check_out nullable
- status
- folio_id
```

```text
HotelService
- id
- hotel_id
- name
- description
- unit_price
- currency
- status
```

```text
Folio
- id
- stay_id
- guest_id
- status
- subtotal
- taxes
- discounts
- total
- paid_amount
- balance
- currency
```

```text
FolioItem
- id
- folio_id
- item_type
- description
- quantity
- unit_price
- total
- added_by
- created_at
```

```text
Payment
- id
- folio_id
- amount
- method
- status
- reference
- received_by
- paid_at
```

```text
HousekeepingTask
- id
- hotel_id
- room_id
- assigned_to
- task_type
- priority
- status
- started_at
- completed_at
- comment
```

```text
MaintenanceTicket
- id
- hotel_id
- room_id nullable
- equipment_id nullable
- priority
- description
- status
- assigned_to
- opened_by
- resolved_at nullable
```

```text
AuditLog
- id
- hotel_id
- actor_id
- action
- entity_type
- entity_id
- old_value
- new_value
- created_at
```

---

## 18. Règles métier essentielles

1. Un utilisateur doit être rattaché à un hôtel pour accéder à ses données.
2. Un utilisateur ne voit jamais les réservations d’un autre hôtel.
3. Une chambre ne peut pas avoir deux réservations confirmées qui se chevauchent.
4. Une chambre en maintenance ou bloquée ne peut pas être attribuée.
5. Une chambre occupée ne peut pas être réservée pour une période incompatible.
6. Une chambre quittée passe d’abord à `Nettoyage requis`.
7. Une chambre n’est disponible qu’après le statut `Prête`.
8. Une réservation annulée doit libérer la disponibilité.
9. Une réservation `No-show` doit être historisée.
10. Un check-in crée ou ouvre un séjour.
11. Un séjour possède un folio.
12. Chaque service ajouté au séjour crée une ligne financière.
13. Chaque paiement doit être enregistré avec son utilisateur et sa date.
14. Une facture ne peut pas être modifiée silencieusement après émission.
15. Toute modification importante doit créer un événement d’audit.
16. La clôture de caisse doit verrouiller les opérations de la période clôturée.
17. Un changement de chambre doit conserver l’ancienne et la nouvelle chambre dans l’historique.
18. Les données personnelles du client doivent être visibles uniquement selon le rôle.

---

## 19. Critères d’acceptation du MVP

Le MVP est réussi si :

1. Une entreprise peut être créée avec la catégorie `Hôtel`.
2. L’Admin peut configurer l’hôtel.
3. L’Admin peut créer des types de chambres.
4. L’Admin peut créer les chambres physiques.
5. L’Admin peut définir un tarif par nuit.
6. Le système affiche la disponibilité par dates.
7. Le système empêche les doubles réservations.
8. Le Réceptionniste peut créer une réservation.
9. Une référence unique est générée.
10. Le Réceptionniste peut modifier ou annuler une réservation selon ses permissions.
11. Le Réceptionniste peut enregistrer un check-in.
12. Le système crée un séjour et un folio.
13. Le Réceptionniste peut ajouter un service au séjour.
14. Le Caissier peut enregistrer un paiement.
15. Le système calcule automatiquement le solde.
16. Le Réceptionniste peut effectuer le check-out.
17. Le check-out génère la facture et passe la chambre à `Nettoyage requis`.
18. Le Housekeeping peut marquer une chambre comme `Prête`.
19. La Maintenance peut bloquer une chambre.
20. Une chambre bloquée disparaît des disponibilités.
21. Les utilisateurs ne voient que les données autorisées par leur rôle et leur hôtel.
22. Toutes les actions importantes sont historisées.

---

## 20. Phasage recommandé

### Phase 1 — Référentiel hôtel

- catégorie `Hôtel` ;
- profil hôtel ;
- départements ;
- utilisateurs et rôles ;
- types de chambres ;
- chambres ;
- tarifs.

### Phase 2 — Réservations

- calendrier ;
- disponibilité ;
- création de réservation ;
- modification ;
- annulation ;
- confirmation ;
- fiche client.

### Phase 3 — Front desk

- check-in ;
- séjour ;
- changement de chambre ;
- check-out ;
- historique des opérations.

### Phase 4 — Facturation

- folio ;
- services ;
- paiements ;
- facture ;
- solde ;
- clôture de caisse.

### Phase 5 — Housekeeping et maintenance

- état des chambres ;
- tâches de nettoyage ;
- inspections ;
- tickets de maintenance ;
- chambres hors service.

### Phase 6 — Fonctions avancées

- réservation en ligne ;
- portail client ;
- paiement en ligne ;
- notifications SMS/WhatsApp ;
- agences et entreprises partenaires ;
- channel manager ;
- restaurant et spa ;
- événements et salles de conférence ;
- tarifs saisonniers avancés ;
- statistiques consolidées.

---

## Conclusion

Le meilleur point de départ pour Isoko Hub est :

```text
Hôtel
→ Chambres
→ Disponibilité
→ Réservations
→ Check-in
→ Séjour
→ Services
→ Facturation
→ Check-out
→ Housekeeping
→ Maintenance
```

Comme pour l’hôpital et la pharmacie, il faut conserver une séparation stricte :

```text
Rôle = permissions
Hôtel = établissement
Département = contexte de travail
Réservation = demande de séjour
Séjour = présence réelle du client
Folio = compte financier du séjour
```

Cette structure donne un module hôtelier cohérent, extensible et compatible avec l’architecture générale d’Isoko Hub.