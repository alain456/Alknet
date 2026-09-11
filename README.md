# Isoko Hub

Plateforme multiservices pour le Burundi — module hôpital, entreprises, services et produits.

## Stack

- **Backend** : Django 5 + Django REST Framework + PostgreSQL + JWT
- **Frontend** : React 19 + Vite + Tailwind CSS 4
- **Infra** : Docker Compose

## Démarrage rapide (Docker)

```bash
# 1. Copier les variables d'environnement
cp .env.sample .env

# 2. Lancer backend + base de données + frontend
docker compose up --build

# 3. Appliquer les migrations (premier lancement)
docker compose exec web python manage.py migrate

# 4. Créer un super admin (optionnel)
docker compose exec web python manage.py createsuperuser
```

Accès :
- Frontend : http://localhost:5173
- API : http://localhost:8000/api/v1/
- Admin Django : http://localhost:8000/admin/

## Développement local (sans Docker frontend)

### Backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.sample .env
# Configurer POSTGRES_HOST=localhost et POSTGRES_PORT=5434 si DB Docker
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Le proxy Vite redirige `/api` vers `http://localhost:8000`.

## Rôles et permissions

| Rôle | Accès |
|------|-------|
| **SUPER_ADMIN** | Contrôle total de la plateforme (`/admin`) |
| **BUSINESS_OWNER** | Gestion de son entreprise / hôpital (`/hospital/admin`, `/business`) |
| **PROFESSIONAL** | Dashboard staff hôpital selon `system_access_level` |
| **CUSTOMER** | Espace patient — prise de RDV, mes rendez-vous (`/dashboard`) |

Le frontend utilise `PermissionGuard` (permissions métier) en complément de `ProtectedRoute` (rôles plateforme). **Les contrôles backend restent la source de vérité.**

## Module Hôpital — Routes admin (MVP)

| Route | Page |
|-------|------|
| `/hospital/dashboard` | Tableau de bord |
| `/hospital/profile` | Profil établissement (→ `/business/profile`) |
| `/hospital/patients` | Registre patients |
| `/hospital/admissions` | Arrivées du jour |
| `/hospital/appointments` | Rendez-vous & créneaux |
| `/hospital/settings` | Paramètres (références, emails) |

Les anciennes URLs `/hospital/admin/*` redirigent automatiquement vers les routes MVP.

`PermissionGuard` protège les pages sensibles (dossiers médicaux, labo, facturation, audit). Les contrôles backend restent la source de vérité.

## Module Hôpital — Prise de rendez-vous patient

Parcours public :
1. `/hospitals` — annuaire
2. `/hospitals/:id` — profil + RDV par médecin
3. `/hospital/book-appointment` — assistant complet en 6 étapes

Après connexion : `/dashboard/bookings` — liste et annulation des RDV.

API : `POST /api/v1/hospital/appointments/` (accessible sans auth — crée un compte guest si besoin).

## API centralisée (frontend)

Tous les nouveaux appels doivent utiliser `frontend/src/shared/api.ts` :

```javascript
import api from '../shared/api';

// GET public
const businesses = await api.get('businesses/');

// GET/POST authentifié
const profile = await api.get('accounts/profile/', { auth: true });
```

Clés localStorage : `isoko_hub_token`, `isoko_hub_refresh_token`, `isoko_hub_user`.

## Bookings & Orders

- `GET/POST /api/v1/bookings/` — réservations de services génériques
- `GET/POST /api/v1/orders/` — commandes produits

Les rendez-vous médicaux restent dans `/api/v1/hospital/appointments/`.

## Tests

```bash
python manage.py test accounts hospital bookings orders
```

## Fonctionnalités reportées (post-MVP)

- Spécialiste diaspora / télémédecine avancée
- Coordinateur télémédecine
- Support client / tickets
- Module IA (voir `ai.txt`)

## Structure

```
Isoko_Hub/
├── accounts/          # Auth JWT, utilisateurs, audit
├── businesses/        # Entreprises, employés, rôles
├── hospital/          # Module santé (RDV, labo, facturation)
├── bookings/          # Réservations services
├── orders/            # Commandes produits
├── frontend/          # React SPA
└── config/            # Settings Django
```
