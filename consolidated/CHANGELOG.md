# Changelog — FinTrack Consolidated

Toutes les modifications notables de ce projet sont documentées ici.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [1.0.0] — 2026-05-31

### ✨ Version initiale consolidée

Fusion des versions A, B et C en une version unifiée production-ready.

### Ajouté — Frontend
- **11 pages** : Dashboard, Accounts, Transactions, Transfer, Categories, Budgets, Goals, Recurring, Reports, Settings, Login
- **Toast system** (de C) : notifications success/error/info/warning sans `alert()`
- **Confirm dialog** (de C) : modal custom remplaçant `window.confirm()`
- **Page Transfer** (de C) : transfert inter-comptes avec conversion automatique multi-devises
- **Compte démo** (de C) : `demoSeed.ts` avec 6 mois de données réalistes (bouton sur Login)
- **Auth hybride** (de A) : détection auto online/offline, fallback local IndexedDB
- **API client** (de A) : client HTTP complet pour tous les endpoints backend
- **Sync bidirectionnelle** (de A, amélioré) : push local → backend + pull backend → local
- **Hook `useOnlineStatus`** (nouveau) : détection temps réel navigateur + backend
- **Indicateur de connectivité** (nouveau) : badge 🟢/🟡/🔴 dans Layout + sidebar
- **Settings consolidé** (nouveau) : sync (A) + health check (B) + toasts (C) en une page

### Ajouté — Backend
- **Architecture MVC** (de B) : 10 controllers, 11 routes, 5 middlewares
- **Sync endpoints** (nouveau) : `GET /sync/pull?since=` + `POST /sync/push`
- **User endpoints** (nouveau) : `GET /users/me` + `GET /users/export` (RGPD)
- **Singleton Prisma** (nouveau) : `lib/prisma.ts` évite les connexions multiples
- **JWT helpers** (nouveau) : `lib/jwt.ts` avec `ensureJwtSecret()` refusant le démarrage sans secret
- **Refresh tokens hashés** (nouveau) : SHA-256 avant stockage en base
- **Error handler global** (de B) : gestion Prisma, Zod, AppError
- **Rate limiting** (de B) : 200/15min global, 20/15min auth, 5/15min critique
- **Validation Zod** (de B) : schémas complets pour toutes les entrées
- **Upload Multer** (de B) : CSV import avec filtre types MIME

### Ajouté — Schéma Prisma (10 modèles)
- User (+ avatarUrl, googleId, isVerified)
- Account (+ currentBalance, color, icon, isActive, deletedAt)
- Category (+ self-relation hiérarchique, isActive, deletedAt)
- Transaction (+ notes, attachmentIds, goalId relation, deletedAt)
- Budget (+ year, currentAmount, isActive, deletedAt)
- Goal (+ description, isCompleted, deletedAt)
- GoalTransaction (table de liaison contributions)
- RecurringTransaction (+ interval, startDate, occurrences, isActive, deletedAt)
- Session (+ refreshTokenHash, ipAddress, userAgent)
- Attachment (fichiers joints)

### Ajouté — Infrastructure
- Docker Compose 3 services (PostgreSQL 16, backend, frontend Nginx)
- Network isolation `fintrack` (de A)
- Multi-stage Dockerfiles (backend + frontend)
- Nginx avec proxy `/api/` → backend, SPA fallback, gzip, security headers
- GitHub Actions CI (TypeScript check, build, Docker build)

### Corrigé (bugs des versions sources)
- `Decimal` → `Number()` : toutes les conversions Prisma corrigées (bug B)
- PrismaClient singleton : plus de connexions multiples (bug B)
- Routes statiques avant `/:id` : `/export`, `/tree`, `/generate` ne sont plus interceptés (bug B)
- JWT_SECRET fallback : refusé en production (risque A+B)
- Refresh tokens : stockés hashés, pas en clair (risque B)
- CORS : origines restreintes, pas de `*` (risque B)
- `alert()` / `window.confirm()` : remplacés partout par Toast/Confirm (UX A+B)

### Supprimé
- `version-A/src/services/auth-v2.ts` inline → refactorisé en `auth-hybrid.ts`
- `version-A/backend/src/routes/crud.ts` monolithique → éclaté en 6 route files
- `version-B/prisma/schema.prisma` dupliqué à la racine → un seul dans `backend/prisma/`
