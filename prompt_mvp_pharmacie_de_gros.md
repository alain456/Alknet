# PROMPT FINAL — MVP PHARMACIE DE GROS
# Isoko Hub

## Contexte et décision de cadrage

Construis le module **Pharmacie de gros** de la plateforme Isoko Hub.

Le document de référence fourni contient principalement des fonctionnalités de pharmacie de détail : patients, ordonnances, délivrance au patient, pharmacien, recherche de pharmacie à proximité et réseau de pharmacies partenaires.

Pour ce projet, ces fonctionnalités ne doivent pas être implémentées. Le produit demandé est une plateforme B2B de vente et d’approvisionnement en médicaments en gros.

Le module doit permettre à une entreprise de créer une activité avec la catégorie exacte :

```text
Pharmacie de gros
```

Réutilise le flux général de création d’entreprise déjà présent dans la plateforme. Lorsque l’utilisateur crée cette entreprise, il devient l’administrateur de cette entreprise. Ne crée pas un nouveau système indépendant de création d’entreprise.

Une pharmacie de détail doit pouvoir être enregistrée comme entreprise cliente selon le même flux général, avec la catégorie `Pharmacie de détail`. Son utilisateur habilité reçoit ensuite le rôle `Client` dans le module de pharmacie de gros. Ne transforme jamais ce Client professionnel en compte individuel d’achat.

## Exclusion absolue du MVP

N’implémente aucune fonctionnalité de livraison, transport, retrait, expédition, adresse de livraison ou suivi logistique. La commande s’arrête à la décision de la pharmacie de gros : `Acceptée` ou `Refusée`.

## Objectif du MVP

Créer un espace professionnel simple permettant :

1. à l’administrateur de la pharmacie de gros de gérer son catalogue et son stock ;
2. à l’administrateur de consulter les commandes reçues ;
3. à l’administrateur d’accepter ou de refuser une commande ;
4. au client acheteur de visualiser le catalogue ;
5. au client de créer et envoyer une commande ;
6. au client de suivre le statut de ses commandes ;
7. au client de recevoir un email lorsque sa commande est acceptée.

Il s’agit d’un système B2B de commande en gros entre une pharmacie de gros et des pharmacies de détail. Le Client n’est pas une personne physique : il représente toujours une pharmacie de détail enregistrée comme entreprise sur la plateforme. Ce module ne concerne pas les patients ni les achats personnels.

## Acteurs — deux uniquement

### 1. Admin de la pharmacie de gros

L’Admin est le propriétaire ou le gestionnaire de l’entreprise de pharmacie de gros.

Il peut :

- consulter le tableau de bord de son entreprise ;
- gérer les informations de l’entreprise ;
- créer et modifier les produits du catalogue ;
- activer ou désactiver un produit ;
- gérer les prix de gros ;
- gérer les conditionnements ;
- gérer les quantités en stock ;
- consulter les stocks faibles ou épuisés ;
- consulter les commandes reçues ;
- consulter le détail d’une commande ;
- accepter une commande ;
- refuser une commande avec un motif obligatoire ;
- consulter l’historique des commandes ;
- consulter la liste des pharmacies de détail ayant commandé.

L’Admin ne doit pas gérer :

- les patients ;
- les ordonnances ;
- les consultations ;
- les médecins ;
- la délivrance au détail ;
- les téléconsultations ;
- les tickets de support ;
- les spécialistes distants.

### 2. Client — pharmacie de détail

Le Client est obligatoirement une pharmacie de détail qui s’approvisionne auprès d’une pharmacie de gros. L’utilisateur connecté agit au nom de cette entreprise, mais la commande appartient toujours à la pharmacie de détail cliente et jamais à une personne à titre individuel.

Dans le MVP, ne pas accepter comme client un patient, un particulier, un hôpital, un centre de santé ou une autre structure générique. Le compte Client doit être rattaché à une entreprise de catégorie `Pharmacie de détail`, en réutilisant le flux général de création et de gestion d’entreprise de la plateforme.

Il peut :

- consulter les informations de la pharmacie de gros ;
- visualiser le catalogue ;
- rechercher un médicament ;
- filtrer les produits ;
- consulter le prix de gros ;
- consulter le conditionnement ;
- consulter la disponibilité ;
- ajouter des produits au panier ;
- modifier les quantités ;
- créer une commande ;
- envoyer une commande ;
- consulter ses commandes ;
- voir le statut de ses commandes ;
- consulter le motif d’un refus ;
- recevoir un email lorsqu’une commande est acceptée ;
- gérer les informations de sa pharmacie de détail et son profil d’utilisateur habilité.

Le Client ne doit pas pouvoir :

- modifier le catalogue ;
- modifier les prix ;
- modifier le stock ;
- accepter ou refuser une commande ;
- voir les commandes des autres pharmacies de détail ;
- accéder aux données internes de la pharmacie de gros.

## Création d’une entreprise

Réutilise le composant ou le parcours commun de création d’entreprise de la plateforme.

Lors de la création :

1. l’utilisateur renseigne les informations habituelles de l’entreprise ;
2. il sélectionne la catégorie `Pharmacie de gros` ;
3. il renseigne les coordonnées professionnelles ;
4. l’entreprise est créée ;
5. le créateur reçoit le rôle `Admin` pour cette entreprise ;
6. il est redirigé vers le dashboard de la pharmacie de gros.

Informations minimales de l’entreprise :

```text
Nom officiel
Nom commercial
Logo
Numéro d’autorisation ou licence si le champ existe déjà
Adresse
Ville / commune
Téléphone
Email professionnel
Description
Statut
```

Statuts de l’entreprise :

```text
Brouillon
Active
Suspendue
Fermée
```

Ne crée pas de rôle supplémentaire comme pharmacien, préparateur, livreur ou responsable logistique dans le MVP.

## Menus de l’Admin

La navigation de l’Admin doit être limitée à :

```text
Tableau de bord
Mon entreprise
Catalogue
Stock
Commandes reçues
Pharmacies clientes
Historique
Paramètres
```

### Tableau de bord Admin

Afficher :

- nombre de produits actifs ;
- valeur totale estimée du stock ;
- produits en stock faible ;
- produits en rupture ;
- commandes reçues ;
- commandes en attente de traitement ;
- commandes acceptées ;
- commandes refusées ;
- chiffre d’affaires estimé des commandes acceptées ;
- dernières commandes ;
- produits les plus commandés.

Ajouter des actions rapides :

```text
Ajouter un médicament
Mettre à jour le stock
Voir les commandes en attente
Consulter les produits en rupture
```

### Catalogue Admin

L’Admin doit pouvoir :

- ajouter un produit ;
- modifier un produit ;
- désactiver un produit ;
- réactiver un produit ;
- rechercher un produit ;
- filtrer par statut et catégorie ;
- consulter le stock directement depuis le catalogue.

Champs minimaux d’un produit :

```text
Nom du médicament
DCI / principe actif
Dosage
Forme pharmaceutique
Voie d’administration
Fabricant
Conditionnement
Unité de vente en gros
Prix de gros
Devise
Quantité disponible
Seuil de stock faible
Numéro de lot
Date d’expiration
Statut
Description
```

Exemples d’unité de vente :

```text
Boîte de 20 comprimés
Carton de 100 boîtes
Flacon
Lot
Paire
Unité
```

Le prix doit toujours être associé à l’unité de vente :

```text
2 500 BIF / boîte de 20 comprimés
```

Ne pas afficher un prix sans préciser son conditionnement.

### Stock Admin

Séparer clairement :

```text
Stock réel
Stock réservé
Stock disponible
```

Formule :

```text
Stock disponible = Stock réel - Stock réservé
```

Afficher les statuts :

```text
Disponible
Stock faible
Rupture
Réservé
Bloqué
Expiré
```

Pour le MVP, l’Admin doit pouvoir :

- augmenter le stock ;
- diminuer le stock ;
- corriger une quantité ;
- réserver le stock lié à une commande acceptée ;
- débloquer ou libérer un stock réservé ;
- voir les lots proches de l’expiration ;
- voir les produits expirés.

Chaque mouvement de stock doit afficher :

```text
Produit
Ancienne quantité
Nouvelle quantité
Différence
Motif
Utilisateur
Date et heure
```

Ne pas supprimer silencieusement un mouvement de stock.

### Commandes reçues Admin

Afficher un tableau avec :

```text
Référence
Client
Date
Nombre de produits
Montant total
Statut
Dernière mise à jour
Actions
```

Le détail de la commande doit afficher :

```text
Informations du client
Produits commandés
Quantités
Conditionnements
Prix unitaires
Total par ligne
Montant total
Date de création
Historique
```

Actions disponibles :

```text
Accepter la commande
Refuser la commande
Voir l’historique
```

Lors d’un refus, le motif est obligatoire.

Exemples de motifs :

```text
Stock insuffisant
Produit temporairement indisponible
Informations client incomplètes
Commande non conforme au conditionnement minimum
Vérification nécessaire
Autre
```

Lors d’une acceptation :

1. vérifier que les produits sont encore disponibles ;
2. réserver les quantités ;
3. changer le statut de la commande ;
4. enregistrer l’utilisateur et la date ;
5. afficher une confirmation ;
6. déclencher l’envoi de l’email au client.

## Menus du Client — pharmacie de détail

La navigation du Client doit être limitée à :

```text
Tableau de bord
Catalogue
Panier
Mes commandes
Mon entreprise
Notifications
Mon profil
```

### Tableau de bord Client — pharmacie de détail

Afficher :

- commandes en cours de sa pharmacie ;
- commandes acceptées ;
- commandes refusées ;
- dernières commandes ;
- montant total des commandes ;
- raccourci vers le catalogue ;
- notification si une commande vient d’être acceptée ou refusée.

### Catalogue Client — pharmacie de détail

Le Client doit pouvoir :

- rechercher par nom ou principe actif ;
- filtrer par forme ;
- filtrer par disponibilité ;
- filtrer par fabricant ;
- consulter le prix ;
- consulter l’unité de vente ;
- consulter le stock disponible ou une indication `Disponible` / `Rupture` ;
- voir les détails du produit ;
- ajouter une quantité au panier.

Ne pas afficher des données internes comme :

```text
Stock réel détaillé
Stock réservé par d’autres pharmacies de détail
Historique des mouvements
Coût d’achat
Marge
```

### Panier

Le panier doit afficher :

```text
Produit
Conditionnement
Prix unitaire
Quantité
Total de la ligne
Montant total
```

Ajouter des contrôles :

- quantité entière positive ;
- quantité maximale selon le stock disponible ;
- conditionnement minimum si configuré ;
- produit actif uniquement ;
- recalcul automatique du total ;
- suppression d’une ligne ;
- panier vide.

Le panier n’est pas encore une commande tant que le Client n’a pas cliqué sur `Envoyer la commande`.

### Envoi de la commande

Créer un récapitulatif avant envoi :

```text
Pharmacie de détail cliente
Produits
Quantités
Conditionnements
Total
Email de notification
```

Après validation :

1. créer une référence unique ;
2. enregistrer la commande ;
3. conserver le prix au moment de la commande ;
4. vider le panier ;
5. afficher le statut `Envoyée` ;
6. afficher une confirmation au Client.

Exemple de référence :

```text
CMD-PG-2026-000001
```

## Statuts des commandes

Utiliser une machine d’état simple :

```text
Brouillon
   ↓
Envoyée
   ↓
En cours de traitement
   ├── Acceptée
   └── Refusée
```

Statut complémentaire possible :

```text
Annulée
```

Pour le MVP :

- le Client peut créer une commande en brouillon ;
- le Client peut envoyer la commande ;
- l’Admin peut accepter ou refuser ;
- l’Admin doit fournir un motif en cas de refus ;
- le Client peut consulter le motif du refus ;
- une commande acceptée réserve le stock ;
- aucun workflow de livraison, transport, retrait ou paiement n’est nécessaire dans cette première version.

## Email de confirmation

Lorsqu’une commande est acceptée, envoyer un email à l’adresse professionnelle de la pharmacie de détail cliente.

Objet recommandé :

```text
Votre commande CMD-PG-2026-000001 a été acceptée
```

Contenu minimal :

```text
Nom de la pharmacie de gros
Nom de la pharmacie de détail cliente
Référence de la commande
Date d’acceptation
Liste des produits
Quantités
Montant total
Statut : Acceptée
Prochaine étape ou instruction de contact
```

Prévoir un composant ou service :

```text
NotificationService
```

avec un journal d’envoi :

```text
NotificationLog
- id
- order_id
- recipient_email
- type
- status
- sent_at
- error_message
```

Statuts d’envoi :

```text
En attente
Envoyé
Échec
```

Si l’envoi réel n’est pas encore connecté au backend, simuler l’appel avec un service mocké et afficher clairement son état.

Lorsqu’une commande est refusée, afficher le motif dans l’espace de la pharmacie de détail cliente. Prévoir également un service email réutilisable pour pouvoir activer plus tard l’email de refus.

## Relation entre les entités

Utiliser les relations suivantes :

```text
Business
   ↓
BusinessCategory = Pharmacie de gros
   ↓
Admin
   ↓
Catalogue
   ↓
Produits
   ↓
Stock
   ↓
Commandes des Clients
```

Modèle recommandé :

```text
Business
- id
- name
- category
- status
- contact_information
```

```text
BusinessMembership
- business_id
- user_id
- role
- status
```

```text
Product
- id
- wholesale_business_id
- name
- active_ingredient
- dosage
- pharmaceutical_form
- manufacturer
- packaging
- wholesale_unit
- wholesale_price
- currency
- status
```

```text
Inventory
- id
- product_id
- batch_number
- expiration_date
- quantity_real
- quantity_reserved
- status
```

```text
Order
- id
- reference
- client_business_id
- wholesale_business_id
- status
- total_amount
- currency
- refusal_reason
- accepted_by
- accepted_at
- refused_by
- refused_at
- created_at
- updated_at
```

```text
OrderItem
- id
- order_id
- product_id
- product_name_snapshot
- packaging_snapshot
- unit_price_snapshot
- quantity
- line_total
```

Le snapshot du produit et du prix est obligatoire afin qu’une ancienne commande ne change pas si le catalogue est modifié plus tard.

## Permissions

Créer des permissions centralisées :

```text
business.view
business.update
catalog.view
catalog.create
catalog.update
catalog.archive
inventory.view
inventory.update
inventory.adjust
orders.view_received
orders.view_own
orders.create
orders.submit
orders.accept
orders.reject
clients.view
notifications.view_own
audit.view
```

### Admin

```text
business.view
business.update
catalog.view
catalog.create
catalog.update
catalog.archive
inventory.view
inventory.update
inventory.adjust
orders.view_received
orders.accept
orders.reject
clients.view
audit.view
```

### Client

```text
catalog.view
orders.view_own
orders.create
orders.submit
notifications.view_own
business.view_own
business.update_own
```

Le Client ne doit jamais recevoir les données des autres clients.

## Routes MVP

Réutiliser les routes et le système d’entreprise existants. Ajouter ou compléter :

```text
/business/create
/wholesale-pharmacy/dashboard
/wholesale-pharmacy/company
/wholesale-pharmacy/catalog
/wholesale-pharmacy/catalog/:id
/wholesale-pharmacy/inventory
/wholesale-pharmacy/orders
/wholesale-pharmacy/orders/:id
/wholesale-pharmacy/clients
/wholesale-pharmacy/history
/wholesale-pharmacy/settings
```

Routes Client :

```text
/wholesale-pharmacy/client/dashboard
/wholesale-pharmacy/client/catalog
/wholesale-pharmacy/client/catalog/:id
/wholesale-pharmacy/client/cart
/wholesale-pharmacy/client/orders
/wholesale-pharmacy/client/orders/:id
/wholesale-pharmacy/client/company
/wholesale-pharmacy/client/profile
```

Ne pas créer de routes pour :

```text
/patients
/prescriptions
/pharmacy-retail
/telemedicine
/support
/delivery
/pharmacist-validation
/diaspora-specialists
```

## Design et expérience utilisateur

Créer une interface SaaS B2B professionnelle :

- React avec TypeScript ;
- Tailwind CSS ;
- React Router ;
- interface entièrement en français ;
- devise BIF ;
- dates et montants localisés ;
- desktop prioritaire, tablette supportée ;
- sidebar adaptée au rôle ;
- topbar avec notifications ;
- tableaux filtrables ;
- recherche ;
- pagination ;
- badges de statut ;
- drawers de détails ;
- modales de confirmation ;
- toasts ;
- états loading, empty, error et success.

Utiliser une direction visuelle :

- bleu profond pour la confiance ;
- bleu vif pour les actions ;
- vert pour disponible et accepté ;
- orange pour stock faible et traitement ;
- rouge pour rupture et refus ;
- gris neutre pour les états inactifs.

Les statuts doivent toujours utiliser du texte et éventuellement une icône. Ne jamais dépendre uniquement de la couleur.

## Composants attendus

Créer ou réutiliser :

```text
BusinessCreationForm
WholesaleLayout
RoleGuard
Sidebar
Topbar
StatCard
ProductTable
ProductForm
InventoryTable
StockAdjustmentModal
OrderTable
OrderDetailsDrawer
OrderStatusBadge
OrderDecisionModal
CartSummary
QuantityInput
EmailStatusBadge
EmptyState
LoadingState
ErrorState
ConfirmDialog
Toast
```

Lors du refus d’une commande, utiliser une modale avec :

- motif prédéfini ;
- champ de commentaire ;
- validation obligatoire ;
- résumé de la commande ;
- bouton `Confirmer le refus`.

Lors de l’acceptation, afficher :

- résumé ;
- montant total ;
- vérification du stock ;
- quantité qui sera réservée ;
- bouton `Accepter la commande`.

## Données de démonstration

Créer des données réalistes pour une pharmacie de gros :

- Paracétamol 500 mg — boîte de 20 comprimés ;
- Amoxicilline 500 mg — boîte de 16 gélules ;
- Sérum physiologique — carton de 20 flacons ;
- Ibuprofène 400 mg — boîte de 30 comprimés ;
- Sirop antalgique — carton de 24 flacons.

Prévoir :

- produits disponibles ;
- produit en stock faible ;
- produit en rupture ;
- produit expiré ou bloqué ;
- commandes envoyées ;
- commandes acceptées ;
- commandes refusées avec motif ;
- commandes brouillon ;
- au moins deux clients professionnels.

Corriger toute donnée de démonstration incohérente avec la vente en gros. Les quantités doivent être exprimées par cartons, lots, boîtes ou conditionnements professionnels, jamais comme une vente à l’unité destinée au patient.

## Sécurité et règles métier

- vérifier le rôle avant d’afficher une action ;
- limiter les données au business courant ;
- isoler les commandes de chaque client ;
- ne jamais exposer le stock réservé par un autre client ;
- empêcher l’acceptation d’une commande si le stock disponible est insuffisant ;
- exiger un motif lors d’un refus ;
- conserver l’historique des décisions ;
- ne pas supprimer définitivement une commande acceptée ou refusée ;
- journaliser les changements importants ;
- ne pas placer de secret dans le frontend ;
- ne pas présenter le MVP comme une garantie de conformité réglementaire.

Le document de référence mentionne les lots, les dates d’expiration, les statuts de stock et la séparation entre catalogue, disponibilité et stock réel. Conserve ces éléments dans le modèle, mais ne développe pas les workflows de pharmacie de détail non demandés.

## Critères d’acceptation

Le MVP est terminé si :

1. Un utilisateur peut créer une entreprise avec la catégorie `Pharmacie de gros` en réutilisant le parcours général de création d’entreprise.
2. Le créateur devient automatiquement Admin de cette entreprise.
3. L’Admin voit uniquement les menus de gestion de sa pharmacie de gros.
4. Le Client voit uniquement les menus d’achat et ses propres commandes.
5. L’Admin peut créer, modifier, désactiver et consulter les produits.
6. L’Admin peut mettre à jour les quantités, lots et dates d’expiration.
7. Le catalogue affiche toujours le prix avec son conditionnement.
8. Le Client peut rechercher et filtrer les médicaments.
9. Le Client peut créer un panier et envoyer une commande.
10. Une commande envoyée possède une référence unique et un historique.
11. L’Admin peut accepter ou refuser une commande.
12. Un refus sans motif est impossible.
13. Une commande acceptée vérifie et réserve le stock.
14. Une commande acceptée déclenche une notification email au Client.
15. Le Client voit le statut et le motif de refus éventuel.
16. Le Client ne voit jamais les données d’un autre Client.
17. Les données de détail patient, ordonnance, livraison à domicile et téléconsultation ne sont pas présentes dans le MVP.
18. Les seuls acteurs fonctionnels de ce module sont l’Admin et le Client. Un éventuel super administrateur global déjà présent dans la plateforme reste hors périmètre et ne constitue pas un troisième rôle du module.
19. Les interfaces sont responsive et entièrement en français.
20. Les états de chargement, erreur, vide et succès sont traités.

## Ordre de réalisation

1. Inspecter le système existant de création d’entreprise.
2. Ajouter ou vérifier la catégorie `Pharmacie de gros`.
3. Réutiliser le système d’authentification et d’entreprise.
4. Mettre en place les rôles Admin et Client.
5. Construire le layout et les menus selon le rôle.
6. Construire le catalogue Admin et Client.
7. Construire la gestion du stock.
8. Construire le panier et l’envoi de commande.
9. Construire la liste et le détail des commandes Admin.
10. Ajouter la décision accepter/refuser avec motif obligatoire.
11. Ajouter la réservation du stock après acceptation.
12. Ajouter le service d’email et son journal d’envoi.
13. Ajouter les états, notifications, audit et responsive.
14. Tester les parcours avec une pharmacie de gros, deux clients professionnels et plusieurs produits.

Ne transforme pas le résultat en simple page vitrine. Construis un MVP SaaS B2B réellement navigable, avec des données cohérentes, des permissions visibles et un flux complet :

```text
Entreprise créée
→ Catalogue créé
→ Stock renseigné
→ Client consulte
→ Client crée une commande
→ Client envoie
→ Admin accepte ou refuse avec motif
→ Stock réservé si accepté
→ Client reçoit la confirmation
```