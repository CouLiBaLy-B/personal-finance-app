# FinTrack — Gestion Financière Personnelle (Version Consolidée)

> Application complète de gestion financière personnelle fusionnant le meilleur des trois implémentations :
> - **Version A** : synchronisation hybride online/offline
> - **Version B** : architecture backend MVC professionnelle
> - **Version C** : UX soignée (toasts, transferts, démo)

## 🌟 Fonctionnalités

### Frontend (React 19 + Vite + Tailwind CSS)
- 📊 **Tableau de bord** avec KPIs, graphiques (camembert, courbes, barres)
- 🏦 **Gestion multi-comptes** (courant, épargne, espèces, cartes)
- 💸 **Transfert inter-comptes** avec conversion automatique multi-devises
- 📝 **Transactions** avec catégorisation, recherche, filtrage
- 📂 **Import/Export CSV** des transactions
- 🏷️ **Catégories personnalisables** avec icônes, couleurs et hiérarchie
- 📋 **Budgets mensuels** par catégorie avec alertes de dépassement
- 🎯 **Objectifs d'épargne** avec suivi de progression
- 🔁 **Transactions récurrentes** automatisées
- 💱 **Multi-devises** avec taux de change en temps réel
- 📄 **Rapports PDF** détaillés
- 📴 **Mode hors-ligne** complet via IndexedDB
- 🔔 **Toasts & confirmations** modales (pas de alert/confirm natifs)
- 🎪 **Compte démo** avec 6 mois de données réalistes
- 🔄 **Synchronisation bidirectionnelle** avec le backend
- 🟢 **Indicateur de connectivité** en temps réel
- 🔒 **Conformité RGPD** : export complet, suppression du compte

### Backend (Node.js + Express + Prisma + PostgreSQL)
- 🏗️ **Architecture MVC** (10 controllers, 11 routes, 5 middlewares)
- 🔐 **JWT** + refresh tokens hashés (SHA-256)
- ✅ **Validation Zod** sur toutes les entrées
- 🛡️ **Sécurité** : Helmet, CORS strict, rate limiting
- 📊 **Rapports** : summary JSON, trend, category breakdown
- 📁 **Upload CSV** avec import de transactions
- 🔄 **Endpoints de synchronisation** (push/pull)
- 🐳 **Docker** prêt pour le déploiement

## 🚀 Démarrage rapide

### Option 1 : Docker Compose (recommandé)

```bash
# Configurer
cp backend/.env.example .env

# Lancer tout le stack
docker compose up --build

# Seed des données de démo
docker compose exec backend npx prisma db seed
```

| Service     | URL                              |
|-------------|----------------------------------|
| Frontend    | http://localhost:5173             |
| API Backend | http://localhost:4000/api/v1      |
| Health      | http://localhost:4000/health      |

### Option 2 : Développement local

```bash
# Terminal 1 — Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173

# Terminal 2 — Backend (nécessite PostgreSQL)
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
# → http://localhost:4000

# Seed (optionnel)
npm run seed
# → demo@fintrack.app / demo1234
```

### Option 3 : Frontend seul (offline)

```bash
cd frontend
npm install
npm run dev
# Tout fonctionne en local via IndexedDB !
```

## 📁 Structure du projet

```
fintrack/
├── frontend/                    # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/          # ui.tsx, Toast.tsx, Layout.tsx
│   │   ├── db/database.ts       # Dexie IndexedDB
│   │   ├── hooks/               # useRates, useOnlineStatus
│   │   ├── pages/               # 11 pages (Dashboard → Transfer)
│   │   ├── services/            # auth, auth-hybrid, api, sync, fx...
│   │   ├── store/               # Zustand (useSession)
│   │   └── utils/
│   └── package.json
├── backend/                     # Express + Prisma
│   ├── src/
│   │   ├── controllers/         # 7 controllers + sync
│   │   ├── middleware/          # auth, validation, error, rate, upload
│   │   ├── routes/              # 10 routes
│   │   ├── lib/                 # prisma singleton, jwt helpers
│   │   └── utils/               # logger, fx, pdf
│   ├── prisma/schema.prisma     # 10 modèles
│   └── package.json
├── docker-compose.yml           # 3 services (postgres, backend, frontend)
├── Dockerfile.frontend          # Nginx
├── nginx.conf
└── README.md
```

## 📡 API

### Auth
| Méthode | Endpoint                | Description                 |
|---------|-------------------------|-----------------------------|
| POST    | `/api/v1/auth/register` | Inscription                 |
| POST    | `/api/v1/auth/login`    | Connexion                   |
| POST    | `/api/v1/auth/refresh`  | Rafraîchir le token         |
| POST    | `/api/v1/auth/logout`   | Déconnexion                 |
| GET     | `/api/v1/auth/me`       | Profil utilisateur          |
| PUT     | `/api/v1/auth/profile`  | Modifier le profil          |
| DELETE  | `/api/v1/auth/account`  | Supprimer le compte (RGPD)  |

### CRUD (Accounts, Categories, Transactions, Budgets, Goals, Recurring)
| Méthode | Pattern                 | Description       |
|---------|-------------------------|-------------------|
| GET     | `/api/v1/{entity}`      | Liste              |
| GET     | `/api/v1/{entity}/:id`  | Détail             |
| POST    | `/api/v1/{entity}`      | Créer              |
| PUT     | `/api/v1/{entity}/:id`  | Modifier           |
| DELETE  | `/api/v1/{entity}/:id`  | Supprimer          |

### Sync
| Méthode | Endpoint              | Description                    |
|---------|-----------------------|--------------------------------|
| GET     | `/api/v1/sync/pull`   | Pull des modifications serveur |
| POST    | `/api/v1/sync/push`   | Push des données locales       |

### Reports & FX
| Méthode | Endpoint                           |
|---------|------------------------------------|
| GET     | `/api/v1/reports/summary`          |
| GET     | `/api/v1/reports/trend`            |
| GET     | `/api/v1/reports/category-breakdown`|
| GET     | `/api/v1/fx/rates?base=EUR`        |
| GET     | `/api/v1/fx/convert?from=EUR&to=USD&amount=100` |

## 🔒 Sécurité

- Mots de passe hashés avec **bcrypt** (cost 10)
- **JWT** avec rotation des refresh tokens
- Refresh tokens stockés **hashés** (SHA-256) en base
- **Rate limiting** : 200 req/15min global, 20 req/15min auth
- **Helmet** pour les headers de sécurité
- **CORS** restreint aux origines autorisées
- **Validation Zod** sur toutes les entrées
- Refus de démarrage sans `JWT_SECRET` en production
- Conformité RGPD : export + suppression totale

## 📊 Technologies

| Layer     | Technologies                                                    |
|-----------|-----------------------------------------------------------------|
| Frontend  | React 19, Vite, Tailwind CSS 4, Zustand, Dexie, Recharts, jsPDF |
| Backend   | Node.js 20+, Express, Prisma, PostgreSQL, Zod, Winston          |
| Infra     | Docker Compose, Nginx, GitHub Actions (CI/CD)                    |

## 📝 Licence

MIT © FinTrack
