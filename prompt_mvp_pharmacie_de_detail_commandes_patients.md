# PROMPT — MODULE PHARMACIE DE DÉTAIL
# Gestion du catalogue, panier, ordonnance, facture proforma et commandes patients
# Isoko Hub

## Rôle

Tu es un lead frontend engineer et product designer senior. Construis et intègre le MVP du module **Pharmacie de détail** dans la plateforme Isoko Hub.

Ce module doit permettre à une pharmacie de détail de présenter son catalogue de médicaments et de recevoir des commandes de ses clients, qui sont des patients ou des détenteurs d’ordonnance.

Le fonctionnement est proche du module Pharmacie de gros, mais la relation métier est différente :

```text
Pharmacie de gros → Pharmacie de détail cliente
Pharmacie de détail → Patient client
```

Dans ce module :

1. `Admin` est l’administrateur ou le pharmacien habilité de la pharmacie de détail ;
2. `Client` est un patient ou un détenteur d’ordonnance qui commande pour lui-même ou pour un bénéficiaire autorisé.

Le Client n’est pas une pharmacie, une entreprise ou un établissement de santé.

---

## Technologies obligatoires

- React ;
- TypeScript ;
- Vite ;
- Tailwind CSS ;
- React Router ;
- composants réutilisables ;
- formulaires avec validation ;
- architecture compatible avec le backend Django existant ;
- données mockées isolées uniquement lorsqu’une API n’est pas encore disponible.

Avant toute modification :

1. inspecte la structure du projet existant ;
2. identifie les routes, layouts, composants, services API et modèles déjà présents ;
3. réutilise le système d’entreprise existant ;
4. réutilise les composants de tableau de bord déjà disponibles ;
5. ne recrée pas un système indépendant ;
6. respecte les conventions visuelles et techniques du projet.

---

## Objectif fonctionnel du MVP

Construire le parcours suivant :

```text
Patient consulte le catalogue
        ↓
Recherche un médicament
        ↓
Consulte le prix, le conditionnement et la disponibilité
        ↓
Ajoute le produit au panier
        ↓
Une facture proforma/brouillon est générée
        ↓
Le système vérifie si une ordonnance est requise
        ↓
Le Patient joint une ordonnance si nécessaire
        ↓
Le Patient vérifie et envoie la commande
        ↓
L’Admin/pharmacien examine la demande
        ↓
Acceptée, clarification demandée ou refusée
        ↓
Le stock est réservé si la commande est acceptée
        ↓
La proforma devient confirmée
        ↓
Un email est envoyé au Patient
```

La commande numérique ne doit jamais être considérée automatiquement comme une délivrance pharmaceutique. Lorsqu’un médicament nécessite une ordonnance, la validation finale doit être réalisée par l’Admin/pharmacien selon les règles configurées.

---

## Exclusions strictes du MVP

Ne pas implémenter dans ce prompt :

- pharmacies de gros comme clients directs ;
- hôpitaux, centres de santé, laboratoires ou autres clients institutionnels ;
- gestion de plusieurs pharmacies clientes ;
- réapprovisionnement auprès des grossistes ;
- réseau de pharmacies partenaires ;
- marketplace multi-pharmacies ;
- téléconsultation ;
- consultation médicale ;
- diagnostic ;
- validation automatique d’une ordonnance par une IA ;
- substitution automatique d’un médicament ;
- livraison et transport ;
- adresse de livraison ;
- suivi de livraison ;
- paiement en ligne ;
- carte bancaire ;
- mobile money ;
- assurance ;
- crédit client ;
- programme de fidélité ;
- service clientèle séparé ;
- support 24/7 ;
- commandes groupées institutionnelles ;
- gestion des filiales et succursales ;
- tout rôle fonctionnel autre que `Admin` et `Client`.

Le MVP se limite à :

```text
Catalogue
→ Panier
→ Ordonnance si nécessaire
→ Facture proforma
→ Commande patient
→ Validation par l’Admin/pharmacien
→ Réservation du stock
→ Email de notification
```

Le paiement, le retrait physique et la délivrance réelle peuvent être ajoutés dans une phase ultérieure. Préparer toutefois les statuts de manière extensible sans construire ces modules maintenant.

---

## Acteurs et permissions

### 1. Admin / pharmacien de la pharmacie de détail

L’Admin peut :

- consulter le tableau de bord ;
- gérer le profil de la pharmacie ;
- gérer les produits du catalogue ;
- gérer les prix et conditionnements ;
- gérer la disponibilité des produits ;
- gérer le stock ;
- gérer les lots et dates d’expiration ;
- classer les produits selon l’exigence d’ordonnance ;
- consulter les commandes des Patients ;
- consulter les ordonnances jointes ;
- valider une demande ;
- demander une clarification ;
- refuser une demande avec motif obligatoire ;
- réserver le stock après acceptation ;
- consulter les factures proforma ;
- consulter l’historique des actions ;
- consulter le journal des emails.

L’Admin ne peut pas :

- consulter les commandes d’une autre pharmacie ;
- modifier une commande déjà envoyée sans laisser de trace ;
- accepter une commande sans vérifier la disponibilité ;
- valider automatiquement une ordonnance sans intervention professionnelle ;
- accepter une commande nécessitant une ordonnance lorsque celle-ci est absente ou non validée ;
- refuser une commande sans motif.

### 2. Client / Patient

Le Client peut :

- créer ou utiliser son compte personnel ;
- compléter son identité et ses coordonnées ;
- consulter le catalogue actif de la pharmacie ;
- rechercher un produit ;
- consulter le prix, l’unité de vente et le conditionnement ;
- voir la disponibilité publique ;
- ajouter des produits au panier ;
- modifier les quantités ;
- supprimer une ligne ;
- vider le panier après confirmation ;
- consulter la facture proforma ;
- joindre une ordonnance lorsque nécessaire ;
- consulter ses propres commandes ;
- voir le statut de chaque commande ;
- voir le motif d’un refus ;
- recevoir une notification de décision.

Le Client ne peut pas :

- voir le stock interne détaillé ;
- voir les stocks réservés par d’autres clients ;
- voir le coût d’achat ou la marge ;
- modifier le prix ;
- modifier le statut d’une commande ;
- voir les ordonnances ou commandes d’un autre Patient ;
- commander un produit soumis à ordonnance sans fournir les informations demandées.

---

## Création du compte pharmacie

Le module doit fonctionner avec le système d’entreprise existant.

Une entreprise peut être créée avec la catégorie :

```text
Pharmacie de détail
```

Le profil de la pharmacie contient au minimum :

- identifiant généré automatiquement ;
- nom officiel ;
- nom commercial facultatif ;
- catégorie d’entreprise ;
- numéro d’autorisation ;
- statut : `Active`, `Suspendue`, `Fermée` ;
- pharmacien titulaire ou responsable ;
- adresse physique ;
- ville/commune ;
- téléphone professionnel ;
- email professionnel ;
- horaires d’ouverture ;
- date de création ;
- date de dernière mise à jour.

Une pharmacie suspendue ou fermée ne peut pas recevoir de nouvelles commandes.

Afficher un badge :

```text
Pharmacie vérifiée
```

uniquement si le statut de vérification existe réellement dans le backend. Ne pas afficher ce badge simplement parce qu’un compte a été créé.

---

## Profil du Patient

Le Client est une personne physique.

Prévoir les informations suivantes :

- nom ;
- prénom ;
- téléphone ;
- email ;
- adresse ou commune, si déjà prévue par le système ;
- date de naissance, uniquement si le modèle existant le requiert ;
- personne bénéficiaire éventuelle, si le projet la prend déjà en charge.

Le profil doit rester minimal et ne doit pas collecter des données médicales inutiles.

Le Client doit être rattaché à son propre compte personnel. Il ne doit pas être modélisé comme une entreprise de pharmacie.

---

## Catalogue de la pharmacie de détail

L’Admin peut créer ou sélectionner des produits à partir d’un référentiel centralisé.

Éviter que chaque utilisateur crée librement des noms différents pour le même médicament.

Pour chaque produit, prévoir :

- nom commercial ;
- DCI / principe actif ;
- dosage ;
- forme pharmaceutique ;
- voie d’administration ;
- fabricant ;
- présentation ;
- conditionnement ;
- unité de vente ;
- catégorie réglementaire ;
- statut actif/inactif ;
- indication `Ordonnance obligatoire` ou `Sans ordonnance`, configurable selon les données réglementaires disponibles ;
- prix public ;
- devise ;
- quantité disponible publiquement ;
- date de mise à jour.

Exemple :

```text
Paracétamol 500 mg
Comprimé — boîte de 20
2 500 BIF / boîte
Sans ordonnance
Disponible
[Ajouter au panier]
```

Le Client doit pouvoir :

- rechercher par nom ;
- rechercher par DCI/principe actif ;
- filtrer par forme ;
- filtrer par fabricant ;
- filtrer par catégorie ;
- filtrer par exigence d’ordonnance ;
- filtrer par disponibilité ;
- consulter le détail du produit ;
- ajouter une quantité au panier.

Ne pas afficher au Client :

```text
Stock réel détaillé
Stock réservé par d’autres clients
Stock bloqué
Coût d’achat
Marge
Historique des mouvements
Numéros de lots internes
```

Afficher uniquement des indicateurs publics :

```text
Disponible
Stock faible
Rupture
Ordonnance requise
```

---

## Conditionnement et unité de vente

Les produits doivent être vendus selon leur unité de vente réelle :

- boîte ;
- flacon ;
- blister ;
- tube ;
- sachet ;
- ampoule ;
- unité autorisée par le produit.

Exemple :

```text
Amoxicilline 500 mg
Boîte de 20 gélules
Prix : 4 000 BIF / boîte
```

Ne pas afficher un produit comme vendu à l’unité si le conditionnement est une boîte entière.

Chaque ligne du panier doit conserver :

- le nom du produit ;
- le dosage ;
- la forme ;
- le conditionnement ;
- l’unité de vente ;
- le prix unitaire ;
- la quantité ;
- le total de la ligne.

---

## Gestion du stock par l’Admin

L’Admin doit pouvoir :

- consulter les produits en stock ;
- modifier les quantités disponibles ;
- définir une quantité minimale d’alerte ;
- activer ou désactiver la disponibilité ;
- consulter les produits en rupture ;
- consulter les produits à stock faible ;
- bloquer un produit ;
- afficher les produits proches de la péremption ;
- gérer les lots lorsque le modèle backend existe.

Modèle de calcul recommandé :

```text
Stock disponible à la vente
= stock réel
− stock réservé
− stock bloqué
```

Le système doit empêcher :

- l’ajout d’une quantité nulle ou négative ;
- l’envoi d’une commande supérieure au stock disponible ;
- l’acceptation d’une commande dont le stock est devenu insuffisant ;
- la délivrance future d’un lot expiré ou bloqué.

La vérification du stock doit être refaite au moment de l’envoi puis au moment de l’acceptation.

---

## Classification des produits et ordonnance

Chaque produit doit posséder un attribut configurable :

```text
Ordonnance obligatoire
Ordonnance non obligatoire
Catégorie réglementée particulière
Non disponible à la vente
```

### Produit sans ordonnance

Le Client peut :

```text
Consulter
→ Ajouter au panier
→ Envoyer la commande
→ Attendre la validation de l’Admin
```

### Produit avec ordonnance obligatoire

Le Client doit :

```text
Consulter le produit
→ Ajouter au panier
→ Joindre une ordonnance
→ Vérifier les informations
→ Envoyer la demande
→ Attendre la validation du pharmacien
```

Si le panier contient au moins un produit nécessitant une ordonnance :

```text
Ordonnance requise pour cette commande
```

Le bouton d’envoi doit rester désactivé tant que les informations minimales demandées ne sont pas fournies.

Ne jamais laisser l’interface présenter une ordonnance comme validée simplement parce qu’un fichier a été téléversé.

---

## Gestion de l’ordonnance

Le Client peut joindre une ordonnance sous forme de fichier ou d’image si le backend le permet.

Prévoir :

- sélection du fichier ;
- aperçu du fichier ;
- nom du fichier ;
- date d’ajout ;
- suppression avant envoi ;
- remplacement du fichier ;
- statut de l’ordonnance ;
- message d’erreur si le format est invalide.

Statuts recommandés :

```text
Non requise
À vérifier
En cours de vérification
Validée
Clarification demandée
Refusée
Expirée
```

L’Admin/pharmacien voit :

- la référence de la commande ;
- l’identité minimale du Patient ;
- l’ordonnance jointe ;
- la date du document ;
- les produits demandés ;
- les quantités ;
- un espace de commentaire professionnel ;
- les actions `Valider`, `Demander une clarification`, `Refuser`.

Règles :

- une ordonnance jointe n’est pas automatiquement validée ;
- une commande avec ordonnance absente ne peut pas être acceptée ;
- une ordonnance illisible doit permettre une demande de clarification ;
- une ordonnance refusée doit afficher une raison ;
- les fichiers et décisions doivent être protégés par les permissions ;
- les actions de validation doivent être journalisées.

L’IA, si elle est ajoutée plus tard, peut assister la lecture ou l’extraction de texte, mais ne doit jamais autoriser seule la délivrance.

---

## Panier

Le panier est lié :

- au compte du Patient ;
- à la pharmacie de détail sélectionnée ;
- à la session de commande active.

### Informations à afficher

```text
Pharmacie de détail
Produit
DCI / principe actif
Dosage
Forme
Conditionnement
Prix unitaire
Quantité
Total de la ligne
Sous-total
Total général
Devise
Statut de disponibilité
Exigence d’ordonnance
```

### Contrôles du panier

Le système doit :

- empêcher une quantité inférieure à 1 ;
- empêcher une quantité supérieure au stock disponible ;
- recalculer immédiatement les totaux ;
- vérifier que le produit est toujours actif ;
- afficher les produits devenus indisponibles ;
- signaler les produits nécessitant une ordonnance ;
- bloquer l’envoi d’un panier invalide ;
- demander une confirmation avant de vider le panier ;
- conserver la pharmacie liée au panier.

Si le Client change de pharmacie de détail, demander une confirmation et vider le panier actuel ou créer un panier séparé. Pour le MVP, privilégier un seul panier par pharmacie.

---

## Fonction « Vider le panier »

Ajouter une action clairement visible :

```text
Vider le panier
```

Au clic :

1. afficher une modale de confirmation ;
2. expliquer que tous les produits seront supprimés ;
3. proposer `Annuler` et `Vider le panier` ;
4. supprimer les lignes uniquement après confirmation ;
5. remettre le total à `0 BIF` ;
6. retirer les éventuels fichiers d’ordonnance associés au panier ;
7. afficher l’état vide ;
8. afficher `Retourner au catalogue`.

Prévoir également :

- modification de quantité ;
- suppression d’une seule ligne ;
- bouton `Continuer les achats` ;
- bouton `Voir la facture proforma` ;
- bouton `Joindre une ordonnance` ;
- bouton `Envoyer la commande`.

---

## Facture proforma / brouillon

Dès qu’un produit est ajouté au panier, générer automatiquement un récapitulatif financier provisoire :

```text
FACTURE PROFORMA
Statut : Brouillon
```

Cette proforma n’est pas une facture définitive et ne constitue pas une preuve de paiement.

Elle contient :

- référence provisoire ;
- pharmacie de détail ;
- nom du Patient ou référence du compte ;
- date de génération ;
- lignes de produits ;
- dosages ;
- conditionnements ;
- quantités ;
- prix unitaires ;
- totaux par ligne ;
- sous-total ;
- total général ;
- devise ;
- indication d’ordonnance si nécessaire ;
- statut.

Exemple :

```text
FACTURE PROFORMA
Statut : Brouillon

Pharmacie : Pharmacie Sainte-Marie
Client : Jean N.
Date : 04 septembre 2026

Produit                    Qté    Prix       Total
Paracétamol 500 mg          2     2 500 BIF   5 000 BIF
Amoxicilline 500 mg         1     4 000 BIF   4 000 BIF

Total :                                  9 000 BIF

Ordonnance requise pour : Amoxicilline 500 mg
```

À chaque modification du panier :

- recalculer le montant ;
- mettre à jour les lignes ;
- mettre à jour le statut ;
- conserver la date de modification ;
- signaler les produits devenus indisponibles.

### Statuts de la proforma

```text
Brouillon
En attente de validation
Confirmée
Refusée
Annulée
```

Règles :

- panier modifié : `Brouillon` ;
- commande envoyée : `En attente de validation` ;
- commande acceptée : `Confirmée` ;
- commande refusée : `Refusée` ;
- panier vidé avant envoi : supprimer ou archiver comme brouillon abandonné ;
- une proforma refusée ne doit jamais être présentée comme confirmée.

Au moment de l’envoi, conserver un snapshot des produits, conditionnements, prix et quantités utilisés.

---

## Envoi de la commande Patient

Avant l’envoi, afficher un écran de récapitulatif :

```text
Pharmacie de détail
Informations du Patient
Produits
Quantités
Conditionnements
Prix unitaires
Total général
Ordonnance jointe ou non requise
Email de notification
```

Le Client doit confirmer :

```text
J’ai vérifié les produits, les quantités et le montant total.
```

Après confirmation :

1. vérifier une dernière fois la disponibilité ;
2. vérifier la présence d’une ordonnance lorsque nécessaire ;
3. créer une référence unique ;
4. créer la commande ;
5. copier les produits, conditionnements, prix et quantités ;
6. associer l’ordonnance à la commande si nécessaire ;
7. passer la proforma à `En attente de validation` ;
8. vider le panier ;
9. enregistrer un événement d’historique ;
10. afficher la page de succès ;
11. permettre l’ouverture du détail de la commande.

Référence recommandée :

```text
CMD-PD-2026-000001
```

Message de succès :

```text
Votre commande CMD-PD-2026-000001 a été envoyée à la pharmacie.
Elle est maintenant en attente de validation par le pharmacien.
```

---

## Workflow Admin/pharmacien

L’Admin dispose d’une file de commandes à traiter.

### Statuts des commandes

```text
Brouillon
Envoyée
Ordonnance à vérifier
Clarification demandée
En cours de traitement
Acceptée
Refusée
Annulée
```

### Liste des commandes

Afficher :

- référence ;
- Patient ;
- date d’envoi ;
- nombre de lignes ;
- montant total ;
- présence d’une ordonnance ;
- statut de l’ordonnance ;
- statut de la commande ;
- email du Patient ;
- date de dernière mise à jour ;
- actions.

Filtres :

- statut de la commande ;
- statut de l’ordonnance ;
- période ;
- présence d’une ordonnance ;
- montant ;
- recherche par référence ;
- recherche par nom du Patient.

Trier par défaut :

1. commandes `Envoyée` ;
2. commandes `Ordonnance à vérifier` ;
3. commandes `Clarification demandée` ;
4. commandes les plus récentes.

### Détail d’une commande

Afficher :

- référence ;
- informations minimales du Patient ;
- téléphone et email ;
- produits ;
- DCI ;
- dosage ;
- forme ;
- conditionnements ;
- quantités ;
- prix unitaires ;
- total par ligne ;
- total général ;
- ordonnance jointe ;
- statut de l’ordonnance ;
- statut de la commande ;
- historique des événements ;
- état de la proforma ;
- commentaires de validation.

Ne jamais afficher une commande comme acceptée avant la décision de l’Admin/pharmacien.

---

## Accepter une commande

Lorsque l’Admin clique sur `Accepter` :

1. ouvrir une modale de confirmation ;
2. afficher le Patient, les produits, les quantités et le total ;
3. afficher l’ordonnance et son statut lorsqu’elle est requise ;
4. vérifier que l’ordonnance est validée si nécessaire ;
5. vérifier que le stock est toujours disponible ;
6. bloquer l’acceptation si une quantité est insuffisante ;
7. afficher les produits problématiques ;
8. réserver le stock correspondant ;
9. passer la commande à `Acceptée` ;
10. passer la proforma à `Confirmée` ;
11. enregistrer l’Admin/pharmacien et la date ;
12. créer un événement d’historique ;
13. déclencher l’email au Patient ;
14. afficher le statut de l’email.

Une commande contenant un produit soumis à ordonnance ne peut être acceptée que si la validation pharmaceutique est enregistrée.

---

## Demander une clarification

L’Admin peut demander une clarification lorsque :

- l’ordonnance est illisible ;
- la quantité semble incorrecte ;
- une information est manquante ;
- le produit demandé ne correspond pas clairement au document ;
- le pharmacien doit obtenir une précision du Patient.

Le commentaire est obligatoire.

Après confirmation :

1. passer la commande à `Clarification demandée` ;
2. conserver le commentaire ;
3. notifier le Patient ;
4. permettre au Patient de consulter la demande ;
5. permettre l’ajout ou le remplacement de l’ordonnance si le modèle le permet ;
6. enregistrer l’événement dans l’historique.

Le Patient ne doit pas pouvoir modifier silencieusement une commande déjà envoyée.

---

## Refuser une commande

Lorsque l’Admin clique sur `Refuser` :

1. ouvrir une modale ;
2. afficher la référence de la commande ;
3. proposer des motifs prédéfinis ;
4. ajouter un commentaire facultatif ou obligatoire selon le motif ;
5. rendre le motif obligatoire ;
6. passer la commande à `Refusée` ;
7. passer la proforma à `Refusée` ;
8. enregistrer l’Admin, la date et le motif ;
9. afficher le motif au Patient ;
10. libérer toute réservation éventuelle ;
11. ne pas envoyer l’email d’acceptation.

Motifs prédéfinis :

```text
Stock insuffisant
Produit indisponible
Ordonnance absente
Ordonnance illisible
Ordonnance non validée
Informations insuffisantes
Quantité non conforme
Produit non autorisé
Commande non conforme
Autre
```

---

## Email après décision

### Après acceptation

Envoyer un email à l’adresse du Client :

```text
Sujet : Commande CMD-PD-2026-000001 acceptée
```

Contenu minimal :

```text
Bonjour [Prénom],

La pharmacie [Nom] a accepté votre commande.

Référence : CMD-PD-2026-000001
Date d’acceptation : [Date]
Montant total : [Montant] BIF
Statut : Acceptée

Produits :
- [Produit] — [Quantité] — [Conditionnement]

Consultez votre espace personnel pour voir le détail de la commande.
```

### Après refus ou clarification

Prévoir une notification dans l’application. L’envoi d’un email peut être préparé mais ne doit pas être développé comme un module séparé dans le MVP.

Statuts de notification :

```text
Email en attente
Email envoyé
Échec de l’envoi
Non requis
```

Si l’API email n’est pas disponible, mocker le service dans une couche dédiée. Ne jamais placer une clé email dans le frontend.

Journal recommandé :

```text
NotificationLog
- id
- order_id
- recipient_user_id
- recipient_email
- type
- status
- sent_at
- error_message
```

---

## Modèle de données recommandé

Réutiliser les modèles existants lorsqu’ils sont disponibles.

```text
PatientProfile
- id
- user_id
- first_name
- last_name
- phone
- email
- address
- created_at
- updated_at
```

```text
RetailPharmacy
- id
- business_id
- name
- license_number
- status
- professional_email
- phone
- address
- created_at
- updated_at
```

```text
Product
- id
- name
- active_ingredient
- dosage
- pharmaceutical_form
- manufacturer
- packaging
- sales_unit
- prescription_required
- status
```

```text
RetailInventory
- id
- pharmacy_id
- product_id
- real_quantity
- reserved_quantity
- blocked_quantity
- low_stock_threshold
- availability_status
- updated_at
```

```text
RetailPrice
- id
- pharmacy_id
- product_id
- unit_price
- currency
- effective_from
- updated_at
```

```text
Cart
- id
- patient_id
- pharmacy_id
- status
- subtotal
- total
- currency
- created_at
- updated_at
```

```text
CartItem
- id
- cart_id
- product_id
- product_name_snapshot
- dosage_snapshot
- form_snapshot
- packaging_snapshot
- unit_price_snapshot
- quantity
- line_total
```

```text
Prescription
- id
- patient_id
- file_url_or_reference
- status
- uploaded_at
- reviewed_by
- reviewed_at
- review_comment
```

```text
ProformaInvoice
- id
- reference
- cart_id
- order_id nullable
- patient_id
- pharmacy_id
- status
- subtotal
- total
- currency
- generated_at
- confirmed_at nullable
```

```text
Order
- id
- reference
- patient_id
- pharmacy_id
- status
- proforma_invoice_id
- prescription_id nullable
- total_amount
- currency
- refusal_reason nullable
- clarification_comment nullable
- accepted_by nullable
- accepted_at nullable
- refused_by nullable
- refused_at nullable
- created_at
- updated_at
```

```text
OrderItem
- id
- order_id
- product_id
- product_name_snapshot
- dosage_snapshot
- form_snapshot
- packaging_snapshot
- unit_price_snapshot
- quantity
- line_total
```

```text
InventoryReservation
- id
- order_id
- inventory_id
- product_id
- quantity
- status
- reserved_at
- released_at nullable
```

```text
OrderEvent
- id
- order_id
- previous_status
- new_status
- actor_id
- comment
- created_at
```

---

## Menus MVP

### Admin / pharmacie de détail

```text
Tableau de bord
Mon entreprise
Catalogue
Stock
Ordonnances à vérifier
Commandes patients
Factures proforma
Historique
Notifications
Paramètres
```

### Client / Patient

```text
Tableau de bord
Catalogue
Panier
Facture proforma
Mes commandes
Mes ordonnances
Notifications
Mon profil
```

---

## Routes MVP

### Admin

```text
/retail-pharmacy/dashboard
/retail-pharmacy/company
/retail-pharmacy/catalog
/retail-pharmacy/catalog/:id
/retail-pharmacy/inventory
/retail-pharmacy/prescriptions
/retail-pharmacy/orders
/retail-pharmacy/orders/:id
/retail-pharmacy/proformas
/retail-pharmacy/history
/retail-pharmacy/notifications
/retail-pharmacy/settings
```

### Client / Patient

```text
/retail-pharmacy/client/dashboard
/retail-pharmacy/client/catalog
/retail-pharmacy/client/catalog/:id
/retail-pharmacy/client/cart
/retail-pharmacy/client/proforma
/retail-pharmacy/client/orders
/retail-pharmacy/client/orders/:id
/retail-pharmacy/client/prescriptions
/retail-pharmacy/client/profile
/retail-pharmacy/client/notifications
```

---

## Tableau de bord Admin

Afficher des indicateurs utiles :

```text
Commandes reçues aujourd’hui
Commandes en attente
Ordonnances à vérifier
Clarifications en attente
Commandes acceptées
Commandes refusées
Produits en rupture
Produits à stock faible
Produits proches de la péremption
Emails en échec
```

Ajouter des raccourcis :

```text
Voir les commandes à traiter
Vérifier les ordonnances
Ajouter un produit
Actualiser le stock
Voir les alertes
```

---

## Tableau de bord Patient

Afficher :

```text
Commandes en attente
Commandes acceptées
Commandes nécessitant une clarification
Commandes refusées
Ordonnances envoyées
Dernière facture proforma
```

Le Patient doit voir clairement :

- la pharmacie concernée ;
- le montant ;
- le statut ;
- la présence d’une ordonnance ;
- la date de la dernière mise à jour ;
- le motif de refus ou de clarification.

---

## Confidentialité et sécurité

Séparer strictement les données :

### Patient

Peut voir uniquement :

- son profil ;
- ses paniers ;
- ses ordonnances ;
- ses proformas ;
- ses commandes ;
- ses notifications.

### Admin/pharmacien

Peut voir uniquement les données nécessaires aux commandes de sa pharmacie :

- informations minimales du Patient ;
- ordonnance liée à une commande ;
- produits et quantités ;
- validation et historique.

### Audit

Journaliser au minimum :

- création d’une commande ;
- ajout ou remplacement d’une ordonnance ;
- consultation d’une ordonnance par l’Admin ;
- validation ;
- demande de clarification ;
- refus ;
- acceptation ;
- réservation du stock ;
- libération du stock ;
- changement de prix ;
- changement de stock ;
- envoi d’une notification.

Chaque événement doit conserver :

```text
Qui ?
Quelle action ?
Quelle ressource ?
Quand ?
Quel résultat ?
Quel commentaire ?
```

Ne pas exposer les URLs internes ou les fichiers d’ordonnance à un autre Patient.

---

## États UX obligatoires

Prévoir les états suivants :

- catalogue en chargement ;
- catalogue vide ;
- produit inactif ;
- produit en rupture ;
- stock faible ;
- quantité insuffisante ;
- ordonnance requise ;
- fichier ordonnance invalide ;
- ordonnance à vérifier ;
- panier vide ;
- panier modifié ;
- proforma brouillon ;
- envoi en cours ;
- commande envoyée ;
- commande acceptée ;
- commande refusée ;
- clarification demandée ;
- refus sans motif bloqué ;
- stock devenu insuffisant ;
- email envoyé ;
- email en échec ;
- erreur API ;
- absence de commandes ;
- absence d’ordonnances ;
- absence d’historique.

---

## Critères d’acceptation

Le MVP est réussi si :

1. Une entreprise peut être identifiée comme `Pharmacie de détail`.
2. L’Admin peut gérer le catalogue de sa pharmacie.
3. Le Client est un compte personnel de Patient.
4. Le Client peut rechercher les produits actifs.
5. Le Client voit le prix, le conditionnement et la disponibilité publique.
6. Le Client peut ajouter plusieurs produits au panier.
7. Le système recalcule automatiquement les totaux.
8. Une facture proforma est générée dans le panier.
9. Le Client peut modifier une quantité.
10. Le Client peut supprimer une ligne.
11. Le Client peut vider le panier avec confirmation.
12. Le panier signale les produits soumis à ordonnance.
13. Le Client peut joindre une ordonnance lorsque nécessaire.
14. Une ordonnance jointe n’est pas considérée automatiquement comme validée.
15. Le système empêche l’envoi d’un panier invalide.
16. Le Client peut envoyer une commande.
17. Une référence unique `CMD-PD-...` est créée.
18. Les produits, prix, conditionnements et quantités sont sauvegardés au moment de l’envoi.
19. L’Admin voit uniquement les commandes de sa pharmacie.
20. L’Admin voit les ordonnances liées aux commandes autorisées.
21. L’Admin peut accepter une commande lorsque le stock est suffisant.
22. L’Admin ne peut pas accepter un produit soumis à ordonnance sans validation.
23. Une commande acceptée réserve le stock.
24. La proforma devient confirmée après acceptation.
25. L’Admin peut demander une clarification avec un commentaire.
26. L’Admin peut refuser uniquement avec un motif.
27. Une commande refusée libère toute réservation éventuelle.
28. Le Patient voit le statut et le motif éventuel.
29. Un email de décision peut être journalisé.
30. Le statut d’envoi de l’email est visible.
31. Les commandes et ordonnances d’autres Patients restent invisibles.
32. Aucun paiement en ligne n’est implémenté.
33. Aucune livraison ni aucun transport n’est implémenté.
34. Aucun client institutionnel n’est implémenté.
35. Aucun rôle supplémentaire n’est ajouté.
36. Toutes les validations importantes sont historisées.

---

## Ordre de réalisation

1. Inspecter le système d’entreprise et d’authentification existant.
2. Vérifier la catégorie `Pharmacie de détail`.
3. Vérifier les rôles `Admin` et `Client/Patient`.
4. Réutiliser le catalogue ou le référentiel produit existant.
5. Construire le profil de la pharmacie.
6. Construire le profil Patient.
7. Construire le catalogue et les détails produit.
8. Ajouter la disponibilité, les prix et les conditionnements.
9. Construire le panier.
10. Ajouter la proforma automatiquement recalculée.
11. Ajouter la gestion de l’ordonnance.
12. Construire l’envoi de commande.
13. Construire la file de commandes Admin.
14. Ajouter la validation pharmaceutique.
15. Ajouter la demande de clarification.
16. Ajouter le refus avec motif obligatoire.
17. Ajouter l’acceptation et la réservation du stock.
18. Ajouter la confirmation de la proforma.
19. Ajouter les notifications et le journal d’email.
20. Ajouter l’historique et l’audit.
21. Tester l’isolation des données entre plusieurs Patients et plusieurs pharmacies.
22. Tester les cas de rupture, ordonnance absente, ordonnance illisible et stock insuffisant.

---

## Résultat attendu

Construis un parcours de pharmacie de détail simple, professionnel et sécurisé :

```text
Patient consulte
→ recherche un médicament
→ vérifie le prix et le conditionnement
→ ajoute au panier
→ obtient une facture proforma
→ joint une ordonnance si nécessaire
→ envoie sa commande
→ le pharmacien vérifie
→ accepte, demande une clarification ou refuse
→ réserve le stock si accepté
→ confirme la proforma
→ notifie le Patient
```

La priorité du MVP est la fiabilité du flux catalogue → ordonnance → commande → validation, sans ajouter prématurément les fonctions de paiement, de livraison ou de marketplace.