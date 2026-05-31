# FinTrack — Gestion financière personnelle

**FinTrack** est une application de gestion financière personnelle **web** pour **offline-first** avec :
- 📈 Suivi des revenus/dépenses, budgets mensuels, objectifs d'épargne, transactions récurrentes, multi-devises, rapports PDF, import CSV.

## 🏗️ Stack
- **Frontend** : React 19, Vite, Tailwind CSS, Recharts, Zustand, Lucide icons
- **Backend** : Node.js, Express, Prisma (PostgreSQL), JWT + OAuth2 Google/Apple, Zod validation, Winston logs
- **Base de données** : PostgreSQL (via Prisma ORM)
- **Infrastructure** : Docker Compose (3 services : postgres / backend / frontend-nginx)

## 🏗️ Lancer l'application (deux manières)

### A) **Docker Compose** (recommandé) — le plus rapide :

```bash
# 1. Créez un fichier .env (voir backend/.env.example
cp backend/.env.example .env

# 2. Démarrez tout le stack
docker compose up --build
```

Services accessibles :

| Service     | URL                      |
| ------------| ----------------------- |
| Frontend web | http://localhost:5173    |
| API backend  | http://localhost:4000/api/v1 |
| Base URL API  | http://localhost:4000   |

### B) Manuellement (sans Docker)

```bash
# ---------- Backend
cd backend
cp .env.example .env
# éditez .env (DATABASE_URL, JWT_SECRET, etc.)

# Démarrez PostgreSQL sur localhost:5432 (Docker / postgresql

# Installer les dépendances
npm install

# Générez le client Prisma et appliquez les migrations
npm run prisma:migrate

# Démarrez le backend
npm run dev

# ---------- Frontend (depuis la racine
npm install
npm run dev
# http://localhost:5173
```

## 🔐 Authentification

- **JWT** : `POST /api/v1/auth/register` et `POST /api/v1/auth/login`
- **OAuth2 Google** : configurez `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` dans `.env`
- Toutes les routes `/api/v1/*` (hors auth nécessitent un header `Authorization: Bearer <token>`

## 📊 Routes publiques
| Route                                         | Description             |
| -------------------------------------------- | ------------------- |
| `POST /api/v1/auth/register`              | Inscription        |
| `POST /api/v1/auth/login`                  | Connexion          |
| `POST /api/v1/auth/oauth/google`          | OAuth Google (idToken) |
| `GET /api/v1/accounts` (CRUD)          | Comptes             |
| `POST /api/v1/categories                    | Catégories          |
| `GET /api/v1/transactions                    | Transactions       |
| `POST /api/v1/import/preview` (CSV preview) |
| `POST /api/v1/reports/summary`              | Résumé JSON          |
| `POST /api/v1/reports/pdf`                  | Téléchargement PDF |
| `GET /health`                                  | Santé du serveur      |

## 🛠️ Scripts disponibles (package.json racine)

| Script        | Rôle                  |
| ------------- | --------------------- |
| `npm run dev`   | Lancement frontend Vite |
| `npm run build` | Build production      |
| `npm run preview` | Prévisualisation build |

## 🛠️ Scripts (package.json backend)

| Script             | Rôle                                  |
| ------------------ | ------------------------------------- |
| `npm run dev`     | TSX watch (redémarrage auto)         |
| `npm run build`   | Build TypeScript                     |
| `npm start`       | Lance la version buildée              |
| `npm run seed`      | Seed d'utilisateur de démonstration   |

## 🗂️ Structure

```
├── docker-compose.yml    # Stack complet (postgres + backend + frontend
├── Dockerfile.frontend # Build Vite + Nginx
├── backend/
│   ├── index.ts         # Entry point Express
│   ├── package.json   # Dépendances backend
│   ├── tsconfig.json  # Config TypeScript
│   ├── .env.example  # Variables d'environnement (exemple)
│   ├── prisma/
│   │   ├── schema.prisma  # Modèle Prisma
│   │   └── seed.ts      # Seed (développement)
│   └── src/
│       ├── middleware/
│       │   ├── auth.ts    # bcrypt + JWT + OAuth2 + validation
│       └── utils/
│       │   ├── logger.ts  # Winston + express-winston
│       │   ├── seed.ts    # Catégories/compte par défaut
│       │   └── recurring.ts  # Génération des récurrences
│       └── routes/
│           ├── auth.ts    # Auth
│           ├── crud.ts   # Comptes/catégories/transactions/budgets/goals/recurring
│           ├── import.ts  # CSV upload & bulk insert
│           ├── reports.ts # PDF + JSON summary
│           └── index.ts    # Assemble les routes
└── src/                  # Frontend React
    ├── App.tsx              # Routes React Router
    ├── pages/              # Pages (10 pages)
    ├── components/         # Composants UI + Layout
    ├── db/database.ts   # Dexie IndexedDB (front)
    ├── services/         # services front
    ├── store/             # Zustand
    └── utils/            # helpers
```

## 🛡️ Sécurité & conformité RGPD

- Chiffrement côté serveur (PostgreSQL)
- Helmet pour les headers de sécurité
- Rate limiting global et sur `/auth/*`
- Cookies sécurisés (HttpOnly, SameSite=Strict, Secure en production)
- Export de vos données : `POST /api/v1/users/me/export`
- Suppression totale : `DELETE /api/v1/users/me`
- Toutes les routes privées nécessitent JWT (middleware `requireAuth`)

## 🐛 Dépannage

**Impossible de se connecter à la base de données
→ Vérifiez `DATABASE_URL` et le fichier `.env` et redémarrez le conteneur Postgres.

**Build docker-compose up — `ERROR: duplicate key value violates unique constraint**
→ Relancez `docker compose down -v` (supprime les volumes)

**CORS bloqué**
→ Vérifiez que `CLIENT_ORIGIN` correspond à l'URL du frontend.

## 📝 Prochaines étapes suggérées
- Notifications push (service worker) pour alertes budget
- Synchronisation hors-ligne (service worker)
- PWA : `vite-plugin-pwa)
- Tests unitaires Jest + Vitest sur les routes backend
- Intégration continue GitHub Actions (build + test + déploiement Docker
