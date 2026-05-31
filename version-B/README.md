# FinTrack - Gestion Financière Personnelle

> **FinTrack** est une application complète de gestion financière personnelle avec suivi des revenus, dépenses, budgets, objectifs d'épargne et transactions récurrentes. Entièrement **offline-first** avec synchronisation possible via une API backend.

## 🌟 Fonctionnalités

### ✅ Frontend (React + Vite + Tailwind)
- **Tableau de bord** avec KPIs, graphiques (camembert, courbes, barres)
- **Gestion multi-comptes** (courant, épargne, espèces, cartes)
- **Transactions** avec catégorisation, recherche, filtrage
- **Import/Export CSV** des transactions
- **Catégories personnalisables** avec icônes et couleurs
- **Budgets mensuels** par catégorie avec alertes de dépassement
- **Objectifs d'épargne** avec suivi de progression
- **Transactions récurrentes** (quotidiennes, hebdomadaires, mensuelles, annuelles)
- **Multi-devises** avec taux de change en temps réel (API externe)
- **Rapports** avec export PDF (bilan) et CSV
- **Mode hors-ligne** complet via IndexedDB
- **Authentification locale** sécurisée (bcrypt + JWT-like)
- **Conformité RGPD** : export complet des données, suppression du compte
- **Design moderne** responsive, accessible, thème clair/sombre

### ✅ Backend (Node.js + Express + Prisma + PostgreSQL)
- **API REST** versionnée (`/api/v1/...`)
- **Authentification** : JWT + OAuth2 (Google)
- **Validation** des requêtes avec Zod
- **Logging** structuré avec Winston
- **Rate limiting** pour la sécurité
- **Gestion des fichiers** (upload CSV)
- **Génération de PDF** (pdfmake)
- **Docker** prêt pour le déploiement

## 🚀 Installation

### Prérequis
- Node.js 20+ 
- npm 10+
- Docker (optionnel, pour PostgreSQL)

### Installation complète

```bash
# Cloner le dépôt
git clone <repository-url>
cd fintrack

# Installer toutes les dépendances (frontend + backend)
npm install

# Installer les dépendances du backend
cd backend
npm install
cd ..

# Créer le fichier .env pour le backend
cp backend/.env.example backend/.env
# Éditer backend/.env avec vos configurations

# Générer le client Prisma
npm run prisma:generate

# Lancer les conteneurs Docker (PostgreSQL + API + Frontend)
npm run docker:up

# Accéder à l'application
# Frontend: http://localhost:3000
# API: http://localhost:4000/api/v1/health
```

### Développement local (sans Docker)

```bash
# Terminal 1: Lancer le frontend
npm run dev

# Terminal 2: Lancer le backend
npm run dev:backend

# Accéder à:
# Frontend: http://localhost:5173
# API: http://localhost:4000/api/v1
```

### Développement full-stack

```bash
# Lancer frontend + backend simultanément
npm run dev:full
```

## 📁 Structure du projet

```
fintrack/
├── backend/                          # Backend API
│   ├── src/
│   │   ├── controllers/             # Contrôleurs des routes
│   │   ├── middleware/              # Middlewares (auth, validation, etc.)
│   │   ├── routes/                 # Définition des routes API
│   │   ├── utils/                  # Utilitaires (logger, FX, PDF)
│   │   └── index.ts                # Point d'entrée
│   ├── prisma/
│   │   ├── schema.prisma           # Schéma de la base de données
│   │   └── seed.ts                 # Données de seed
│   ├── uploads/                    # Fichiers uploadés (CSV)
│   └── package.json
│
├── src/                             # Frontend React
│   ├── components/                  # Composants réutilisables
│   ├── db/                         # Base de données IndexedDB (Dexie)
│   ├── hooks/                      # Hooks React personnalisés
│   ├── pages/                      # Pages de l'application
│   ├── services/                   # Services (auth, FX, import/export)
│   ├── store/                      # Store Zustand
│   ├── utils/                      # Utilitaires
│   ├── App.tsx                     # Application principale
│   └── main.tsx                    # Point d'entrée
│
├── docker-compose.yml              # Configuration Docker
├── Dockerfile                      # Dockerfile pour le backend
├── Dockerfile.frontend             # Dockerfile pour le frontend
├── nginx.conf                      # Configuration Nginx
├── package.json                    # Dépendances et scripts
├── tsconfig.json                   # Configuration TypeScript
└── README.md
```

## 🔧 Configuration

### Backend (.env)

```env
# Server
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173,http://localhost:4173

# Database
DATABASE_URL=postgresql://fintrack:fintrack2026@localhost:5432/fintrack?schema=public

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=30d

# OAuth2 (Google - optionnel)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/v1/auth/google/callback

# Uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Exchange Rate API
FX_API_KEY=your-api-key
FX_PROVIDER=exchangerate-api

# Logging
LOG_LEVEL=info
```

### Base de données

```bash
# Créer et appliquer les migrations
npx prisma migrate dev --name init

# Ou pour appliquer les migrations existantes
npx prisma migrate deploy

# Lancer Prisma Studio (interface graphique)
npx prisma studio

# Seed la base de données
npx prisma db seed
```

## 📡 API Documentation

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Inscription |
| POST | `/api/v1/auth/login` | Connexion |
| POST | `/api/v1/auth/refresh` | Rafraîchir le token |
| POST | `/api/v1/auth/logout` | Déconnexion |
| GET | `/api/v1/auth/google` | Login OAuth2 Google |
| GET | `/api/v1/auth/google/callback` | Callback Google |
| GET | `/api/v1/auth/profile` | Profil utilisateur |
| PUT | `/api/v1/auth/profile` | Mettre à jour le profil |
| PUT | `/api/v1/auth/change-password` | Changer le mot de passe |
| DELETE | `/api/v1/auth/account` | Supprimer le compte |

### Comptes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/accounts` | Liste des comptes |
| GET | `/api/v1/accounts/:id` | Détails d'un compte |
| POST | `/api/v1/accounts` | Créer un compte |
| PUT | `/api/v1/accounts/:id` | Mettre à jour un compte |
| DELETE | `/api/v1/accounts/:id` | Supprimer un compte |
| GET | `/api/v1/accounts/:id/balance` | Solde du compte |

### Catégories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/categories` | Liste des catégories |
| GET | `/api/v1/categories/:id` | Détails d'une catégorie |
| POST | `/api/v1/categories` | Créer une catégorie |
| PUT | `/api/v1/categories/:id` | Mettre à jour une catégorie |
| DELETE | `/api/v1/categories/:id` | Supprimer une catégorie |
| GET | `/api/v1/categories/tree` | Arbre des catégories |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/transactions` | Liste des transactions |
| GET | `/api/v1/transactions/:id` | Détails d'une transaction |
| POST | `/api/v1/transactions` | Créer une transaction |
| PUT | `/api/v1/transactions/:id` | Mettre à jour une transaction |
| DELETE | `/api/v1/transactions/:id` | Supprimer une transaction |
| POST | `/api/v1/transactions/import` | Importer depuis CSV |
| GET | `/api/v1/transactions/export` | Exporter en CSV |

### Budgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/budgets` | Liste des budgets |
| GET | `/api/v1/budgets/:id` | Détails d'un budget |
| POST | `/api/v1/budgets` | Créer un budget |
| PUT | `/api/v1/budgets/:id` | Mettre à jour un budget |
| DELETE | `/api/v1/budgets/:id` | Supprimer un budget |
| GET | `/api/v1/budgets/report` | Rapport budgétaire |
| GET | `/api/v1/budgets/current/status` | Statut des budgets du mois |

### Objectifs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/goals` | Liste des objectifs |
| GET | `/api/v1/goals/:id` | Détails d'un objectif |
| POST | `/api/v1/goals` | Créer un objectif |
| PUT | `/api/v1/goals/:id` | Mettre à jour un objectif |
| DELETE | `/api/v1/goals/:id` | Supprimer un objectif |
| POST | `/api/v1/goals/:id/contribute` | Ajouter une contribution |
| GET | `/api/v1/goals/report` | Rapport des objectifs |
| PATCH | `/api/v1/goals/:id/complete` | Marquer comme complété |

### Transactions Récurrentes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/recurring` | Liste des récurrentes |
| GET | `/api/v1/recurring/:id` | Détails d'une récurrence |
| POST | `/api/v1/recurring` | Créer une récurrence |
| PUT | `/api/v1/recurring/:id` | Mettre à jour une récurrence |
| DELETE | `/api/v1/recurring/:id` | Supprimer une récurrence |
| POST | `/api/v1/recurring/generate` | Générer les transactions |
| POST | `/api/v1/recurring/:id/skip` | Sauter la prochaine occurrence |

### Rapports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/reports/summary` | Résumé financier |
| GET | `/api/v1/reports/bilan/pdf` | Télécharger bilan PDF |
| GET | `/api/v1/reports/budget/pdf` | Télécharger rapport budget PDF |
| GET | `/api/v1/reports/goals/pdf` | Télécharger rapport objectifs PDF |
| GET | `/api/v1/reports/trend` | Tendances mensuelles |
| GET | `/api/v1/reports/category-breakdown` | Répartition par catégorie |

### Taux de change

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/fx/currencies` | Liste des devises supportées |
| GET | `/api/v1/fx/rates` | Taux de change pour une devise |
| GET | `/api/v1/fx/convert` | Convertir un montant |
| GET | `/api/v1/fx/all` | Tous les taux (base EUR) |

### Utilisateurs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | Liste des utilisateurs |
| GET | `/api/v1/users/:id` | Détails d'un utilisateur |
| GET | `/api/v1/users/export` | Exporter toutes les données (RGPD) |

## 🎯 Utilisation

### Frontend seul (mode offline)
L'application frontend fonctionne **complètement hors-ligne** grâce à IndexedDB. Toutes vos données sont stockées localement dans votre navigateur.

1. Lancez le frontend : `npm run dev`
2. Créez un compte (les données sont stockées localement)
3. Ajoutez des comptes, catégories, transactions, etc.
4. Toutes vos données persistent même après fermeture du navigateur

### Avec Backend (mode synchronisé)
Pour synchroniser vos données entre plusieurs appareils :

1. Configurez le backend avec une base PostgreSQL
2. Configurez `VITE_API_URL` dans votre frontend pour pointer vers l'API
3. Le frontend synchronisera automatiquement les données avec le backend

## 📊 Technologies

### Frontend
- **React 19** + TypeScript
- **Vite** (bundler ultra-rapide)
- **Tailwind CSS** (styling utility-first)
- **Zustand** (state management)
- **Dexie** (IndexedDB wrapper)
- **Recharts** (graphiques)
- **jsPDF + autoTable** (génération PDF)
- **Papa Parse** (parsing CSV)
- **bcryptjs** (hashage des mots de passe)
- **date-fns** (manipulation des dates)
- **Lucide React** (icônes)

### Backend
- **Node.js 20+**
- **Express** (framework web)
- **Prisma** (ORM)
- **PostgreSQL** (base de données)
- **Passport.js** (authentification)
- **JWT** (tokens)
- **Zod** (validation)
- **Winston** (logging)
- **Multer** (upload de fichiers)
- **pdfmake** (génération PDF serveur)
- **Docker** (conteneurisation)

## 🔒 Sécurité

- **Hashage des mots de passe** avec bcrypt (cost factor 10)
- **Tokens JWT** avec expiration et refresh tokens
- **Rate limiting** sur toutes les routes API
- **CORS** configuré pour autoriser uniquement les origines autorisées
- **Helmet** pour les headers de sécurité HTTP
- **Validation** de toutes les entrées avec Zod
- **Conformité RGPD** : export et suppression complète des données

## 📱 Responsive Design

L'application est **100% responsive** et fonctionne sur :
- Desktop (large écran)
- Tablette
- Mobile (téléphone)

## 🌐 Multi-devises

L'application supporte les devises suivantes :
- EUR, USD, GBP, CHF, CAD, JPY, AUD, CNY, MAD, XOF
- Et plus... (configurable)

Les taux de change sont récupérés depuis :
- [exchangerate.host](https://exchangerate.host) (gratuit, sans clé API)
- Cache local de 6 heures pour le mode hors-ligne

## 🎨 Personnalisation

### Thème
- Thème clair par défaut
- Couleurs personnalisables pour les catégories, comptes et objectifs
- Icônes personnalisables (emojis)

### Catégories
- Création de catégories et sous-catégories
- Classification par type (dépense/revenu)
- Couleurs et icônes personnalisées

### Budgets
- Budgets mensuels par catégorie
- Seuils d'alerte personnalisables
- Suivi visuel du dépassement

### Objectifs
- Objectifs d'épargne avec date cible
- Suivi de progression en pourcentage
- Contributions manuelles ou automatiques

## 🚀 Déploiement

### Option 1: Docker Compose (recommandé)

```bash
# Construire et lancer
npm run docker:build
npm run docker:up

# Arrêter
npm run docker:down

# Voir les logs
npm run docker:logs
```

### Option 2: Déploiement manuel

#### Frontend (Vercel, Netlify, etc.)
```bash
npm run build
# Déployer le dossier dist/
```

#### Backend (Render, Fly.io, etc.)
```bash
cd backend
npm run build
node dist/index.js
```

### Option 3: Serveur unique (Nginx)

```bash
# Construire le frontend
npm run build

# Construire le backend
cd backend
npm run build

# Utiliser Dockerfile.frontend avec Nginx
npm run docker:build
npm run docker:up
```

## 🤝 Contribution

1. Forker le dépôt
2. Créer une branche (`git checkout -b feature/ma-fonctionnalité`)
3. Commiter vos changements (`git commit -m "Ajout de ma fonctionnalité"`)
4. Pousser vers la branche (`git push origin feature/ma-fonctionnalité`)
5. Ouvrir une Pull Request

## 📄 Licence

MIT © FinTrack

## 🙏 Remerciements

- [Vite](https://vitejs.dev) - pour le bundling ultra-rapide
- [Tailwind CSS](https://tailwindcss.com) - pour le styling moderne
- [Prisma](https://prisma.io) - pour l'ORM TypeScript
- [Recharts](https://recharts.org) - pour les graphiques
- [jsPDF](https://parall.ax/products/jspdf) - pour la génération PDF
- [Papa Parse](https://www.papaparse.com) - pour le parsing CSV

---

**FinTrack** - Reprenez le contrôle de vos finances ! 💰
