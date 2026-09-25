# Module 02 — Hôtellerie (alignement HOTELLERIE 2.docx)

Référentiel Isoko Hub mis à jour d’après `prompt/HOTELLERIE 2.docx`.  
Objectif document : plateforme touristique reliant **Voyageur**, **Hôtel**, **Administrateur**, en développement progressif.

## Phases document vs Isoko Hub

| Phase document | Statut Isoko | Notes |
|----------------|--------------|-------|
| Annuaire | **Aligné MVP** | Recherche filtres, fiche, GPS, type, étoiles déclarées/vérifiées |
| Réservation | **Aligné MVP** | Demande + disponibilité + conditions + formulaire unifié client/admin |
| Paiement en ligne réservation | **Aligné MVP** | BurundiPay à la réservation (public + réception) ; CASH / plus tard côté staff |
| Services complémentaires | **Partiel** | Catalogue + folio séjour ; pas de booking online service/salle |
| Tourisme | **Plus tard** | Attractions / activités / transports |
| Écosystème (PMS sync, groupes) | **Plus tard** | Pas de HotelGroup / channel manager |

## Couverture des 11 blocs HOTELLERIE 2

1. **Voyageur** — recherche (destination, dates, voyageurs, budget, type, étoiles), fiche détail, réservation avec conditions. Manque : comparaison multi-établissements, QR payé, avis post-séjour.
2. **Fiche établissement** — type (hôtel/guest house/lodge…), étoiles déclarées vs vérifiées, langues, horaires service clientèle, équipements, GPS, conditions de séjour.
3. **Chambres & tarifs** — inventaire RoomType + Room (statuts dont Nettoyage) ; surface m² ; tarifs variables (`rate_kind`, BIF/USD/EUR, PDJ, taxes, min nuits).
4. **Réservation & paiement** — formulaire partagé client/admin + BurundiPay (PIN) ; CASH/mark-paid staff ; folio séjour pour extras.
5. **Services** — `HotelService` + ajout au folio. Salles de réunion : non.
6. **Géo & tourisme** — GPS + lien carte ; tip locaux en texte. Module Tourisme : non.
7. **Conditions & avis** — conditions / dépôt / animaux / tabac / annulation. Reviews vérifiées : non.
8. **Dashboard hôtel** — PMS mono-établissement complet. Réseau Groupe→Branche : non.
9. **API / PMS externe** — non.
10. **Sécurité & vérification** — RBAC hôtel + vérif business + **vérification classification ★** admin plateforme.
11. **Entités** — User, Business+HotelProfile, RoomType, Room, RatePlan, Reservation, Stay, Payment, Invoice… Manquent : HotelGroup, MeetingRoom, Review, Tourist*, Promotion, Notification hôtel.

## Fichiers clés mis à jour (session)

- `hotel/models.py` — profil, surface, tarifs variables, statut CLEANING
- `hotel/migrations/0003_hotellerie2_profile_rates.py`
- `hotel/views.py` — filtres `public_hotels`, fiche enrichie, `platform_hotel_verify_classification`
- `frontend/src/hotel/public/PublicHotels.jsx` — moteur de recherche
- `frontend/src/hotel/public/PublicHotelBook.jsx` — fiche + acceptation conditions
- `frontend/src/hotel/admin/HotelCompany.jsx` — champs HOTELLERIE 2
- `frontend/src/hotel/admin/ManageRoomTypes.jsx` / `ManageRates.jsx`
- `frontend/src/admin/AdminHotelsPage.jsx` — bouton Vérifier ★

## Roadmap courte (prochaines itérations doc)

1. QR / voucher post-paiement  
2. Avis post-séjour (liés à Stay terminé)  
3. MeetingRoom + bookable services  
4. HotelGroup / multi-branches  
5. Module Tourisme (attractions / activités)
