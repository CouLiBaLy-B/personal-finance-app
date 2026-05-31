# FinTrack — Comparaison des 3 Versions & Plan de Construction d'une Version Consolidée

> **Date** : 31 mai 2026  
> **Auteur** : Expert Dev Finance Personnelle  
> **Dépôt source** : `CouLiBaLy-B/personal-finance-app`

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Comparaison détaillée](#2-comparaison-détaillée)
   - [2.1 Architecture globale](#21-architecture-globale)
   - [2.2 Frontend](#22-frontend)
   - [2.3 Backend](#23-backend)
   - [2.4 Schéma de données](#24-schéma-de-données)
   - [2.5 Authentification & Sécurité](#25-authentification--sécurité)
   - [2.6 UX / Fonctionnalités métier](#26-ux--fonctionnalités-métier)
   - [2.7 DevOps / Infrastructure](#27-devops--infrastructure)
3. [Matrice de synthèse](#3-matrice-de-synthèse)
4. [Verdict : Forces et Faiblesses](#4-verdict--forces-et-faiblesses)
5. [Plan de Construction — Version Consolidée](#5-plan-de-construction--version-consolidée)
   - [Phase 0 : Fondations](#phase-0--fondations-semaine-1)
   - [Phase 1 : Frontend consolidé](#phase-1--frontend-consolidé-semaines-2-3)
   - [Phase 2 : Backend unifié](#phase-2--backend-unifié-semaines-3-4)
   - [Phase 3 : Synchronisation](#phase-3--synchronisation-offline-first-semaines-5-6)
   - [Phase 4 : Qualité & Déploiement](#phase-4--qualité--déploiement-semaines-7-8)
6. [Architecture cible](#6-architecture-cible)
7. [Schéma de données consolidé](#7-schéma-de-données-consolidé)
8. [Risques et mitigations](#8-risques-et-mitigations)

---

## 1. Vue d'ensemble

Le dépôt contient **trois implémentations distinctes** de l'application FinTrack, chacune avec un niveau de maturité et une orientation architecturale différents :

| Critère | Version A | Version B | Version C |
|---------|-----------|-----------|-----------|
| **Philosophie** | Hybride online/offline, sync | API-first, backend riche | Offline-first, UX polish |
| **Backend** | ✅ Express (monolithique) | ✅ Express (MVC structuré) | ❌ Aucun |
| **Frontend** | React + Dexie + API client | React + Dexie + health check | React + Dexie pur |
| **Docker** | ✅ 3 services | ✅ 3 services | ❌ |
| **Fichiers total** | 54 | 100+ | 27 |
| **LOC backend** | ~1 100 | ~4 300 | 0 |
| **LOC frontend pages** | 2 291 | 2 298 | 2 570 |

---

## 2. Comparaison détaillée

### 2.1 Architecture globale

#### Version A — « Hybride pionnière »
```
Frontend (Vite/React) ←→ IndexedDB (Dexie)
         ↕
     API Client (fetch) ←→ Backend Express (monolithique)
         ↕
     PostgreSQL (Prisma)
```
- **Service `auth-v2.ts`** : détection automatique online/offline avec fallback local.
- **Service `sync.ts`** : synchronisation manuelle IndexedDB → Backend (push unidirectionnel).
- **Service `api.ts`** : client HTTP complet (CRUD tous les modèles).
- Problème : la sync est unidirectionnelle (push only), pas de pull, pas de résolution de conflits.

#### Version B — « API-first professionnelle »
```
Frontend (Vite/React) ←→ IndexedDB (Dexie)
         ↕
     Health check only ←→ Backend Express (MVC + Controllers)
         ↕
     PostgreSQL (Prisma) + Sessions + Attachments
```
- Architecture backend **MVC complète** : 10 controllers, 11 routes, 5 middlewares.
- Schéma Prisma le plus riche (9 modèles vs 7 pour A, 7 pour C).
- **Mais** : le frontend ne consomme PAS l'API ! Seul un health check est intégré.
- Un audit interne (`AUDIT_BACKEND_FRONTEND.md`) documente les bloqueurs.

#### Version C — « Offline-first UX-focused »
```
Frontend (Vite/React) ←→ IndexedDB (Dexie)
        (aucun backend)
```
- Zéro dépendance backend. Application 100% client-side.
- Focalisée sur l'expérience utilisateur : Toasts, Confirm dialogs, page Transfer.
- Inclut un **compte de démonstration complet** avec 6 mois de données réalistes.
- La plus légère en dépendances (17 deps vs 37 pour A, 48 pour B).

### 2.2 Frontend

| Fonctionnalité | Version A | Version B | Version C |
|----------------|:---------:|:---------:|:---------:|
| **Pages** | 10 | 10 | **11** (+ Transfer) |
| **Dashboard** | Identique | Identique | Identique |
| **Transactions** | 374 LOC | 374 LOC | 383 LOC (amélioré) |
| **Comptes** | 180 LOC | 180 LOC | 189 LOC (amélioré) |
| **Login** | 185 LOC | 185 LOC | **224 LOC** (+ démo) |
| **Settings** | 179 LOC (+ sync) | 186 LOC (+ health) | 159 LOC (toasts) |
| **Toast system** | ❌ (alert/confirm) | ❌ (alert/confirm) | ✅ **Toast + Confirm** |
| **Page Transfer** | ❌ | ❌ | ✅ **Transferts inter-comptes** |
| **Demo Seed** | ❌ | ❌ | ✅ **6 mois de données** |
| **Bouton sync** | ✅ | ❌ | ❌ |
| **Health check UI** | ❌ | ✅ | ❌ |
| **Composants UI** | ui.tsx (partagé) | ui.tsx (partagé) | ui.tsx + Toast.tsx |
| **Routing** | BrowserRouter/Hash | BrowserRouter/Hash | BrowserRouter/Hash |

**Constat** : Les 3 versions partagent un socle frontend quasi-identique (Layout, Dashboard, services fx/importExport/recurring/seed sont les mêmes). Les différences sont dans les **services additionnels** et l'**UX** (version C supérieure) et l'**intégration backend** (version A supérieure).

### 2.3 Backend

| Aspect | Version A | Version B | Version C |
|--------|:---------:|:---------:|:---------:|
| **Structure** | Monolithique (crud.ts) | **MVC** (controllers séparés) | N/A |
| **Routes fichiers** | 5 (auth, crud, import, reports, index) | **11** (1 par entité + fx, users) | N/A |
| **Controllers** | ❌ (inline dans routes) | **10** controllers dédiés | N/A |
| **Middlewares** | 1 (auth) | **5** (auth, error, rate, upload, validation) | N/A |
| **Validation Zod** | ✅ (basique) | ✅ **(398 LOC, schémas complets)** | N/A |
| **Error handler** | ❌ | ✅ **Global error handler** | N/A |
| **Rate limiter** | ✅ (via dep) | ✅ **(middleware dédié, 66 LOC)** | N/A |
| **Upload/CSV** | ✅ (import.ts) | ✅ **(middleware + controller)** | N/A |
| **PDF serveur** | ✅ (pdfmake) | ✅ **(pdfmake + utils/pdf.ts)** | N/A |
| **OAuth Google** | ✅ (google-auth-library) | ✅ **(Passport.js strategies)** | N/A |
| **Sessions/Refresh** | ❌ | ✅ **Model Session + refresh tokens** | N/A |
| **Seed** | ✅ (basique) | ✅ (basique) | N/A |
| **FX backend** | ❌ (API directe) | ✅ **(controller + cache)** | N/A |
| **LOC total** | ~1 100 | **~4 300** | 0 |
| **Compilable** | ⚠️ Non vérifié | ⚠️ **Bloqueurs identifiés** (cf. audit) | N/A |

**Constat** : La version B a le backend le plus riche et le mieux structuré, mais il n'est **pas prêt pour la production** (problèmes de typage Prisma Decimal, PrismaClient non singleton, Dockerfile mal configuré). La version A a un backend fonctionnel plus simple mais son CRUD est monolithique.

### 2.4 Schéma de données

| Modèle | Version A (Prisma) | Version B (Prisma) | Version C (Dexie) |
|--------|:------------------:|:------------------:|:-----------------:|
| **User** | ✅ 7 champs | ✅ **11 champs** (+avatar, googleId, isVerified) | ✅ 6 champs |
| **Account** | ✅ 8 champs | ✅ **12 champs** (+currentBalance, color, icon, isActive) | ✅ 7 champs |
| **Category** | ✅ 8 champs | ✅ **10 champs** (+self-relation hierarchy, isActive) | ✅ 8 champs |
| **Transaction** | ✅ 12 champs | ✅ **16 champs** (+notes, attachments[], relations) | ✅ 12 champs |
| **Budget** | ✅ 7 champs | ✅ **10 champs** (+year, currentAmount, isActive) | ✅ 7 champs |
| **Goal** | ✅ 9 champs | ✅ **11 champs** (+description, isCompleted) | ✅ 9 champs |
| **RecurringTransaction** | ✅ 13 champs | ✅ **16 champs** (+interval, startDate, occurrences, isActive) | ✅ 12 champs |
| **Session** | ❌ (backend) | ✅ **6 champs** (+ipAddress, userAgent, expiresAt) | ✅ (frontend Dexie) |
| **GoalTransaction** | ❌ | ✅ **Table de liaison** | ❌ |
| **Attachment** | ❌ | ✅ **Modèle dédié** | ❌ |
| **@@map** (noms SQL) | ✅ | ❌ | N/A |
| **Indexes** | ✅ Composites | ✅ **Détaillés** | ✅ Dexie indexes |

**Constat** : Le schéma B est le plus riche et production-ready (OAuth sans password, self-referencing categories, table GoalTransaction, Attachments). Le schéma A est propre avec des @@map SQL. Le schéma C est le minimum viable.

### 2.5 Authentification & Sécurité

| Aspect | Version A | Version B | Version C |
|--------|:---------:|:---------:|:---------:|
| **Auth local** (bcrypt + IndexedDB) | ✅ | ✅ | ✅ |
| **Auth hybrid** (online/offline detect) | ✅ **auth-v2.ts** | ❌ | ❌ |
| **JWT backend** | ✅ (jsonwebtoken) | ✅ **(Passport JWT strategy)** | ❌ |
| **OAuth Google** | ✅ (google-auth-library) | ✅ **(Passport + callback)** | ❌ |
| **Refresh tokens** | ❌ | ✅ **Sessions model** | ❌ |
| **Rate limiting** | ✅ (dep only) | ✅ **(middleware actif)** | ❌ |
| **Helmet** | ✅ (dep only) | ✅ **(configuré)** | ❌ |
| **CORS** | ✅ | ✅ **(multi-origin)** | N/A |
| **Validation input** | ✅ Zod (basique) | ✅ **Zod (398 LOC)** | ❌ |
| **RGPD** | ✅ deleteAccount | ✅ deleteAccount + export API | ✅ deleteAccount |
| **Risques identifiés** | JWT_SECRET fallback | **Documentés dans audit** | Aucun backend |

### 2.6 UX / Fonctionnalités métier

| Fonctionnalité | Version A | Version B | Version C |
|----------------|:---------:|:---------:|:---------:|
| **Multi-comptes** | ✅ | ✅ | ✅ |
| **Multi-devises + taux** | ✅ | ✅ | ✅ |
| **Transfert inter-comptes** | ❌ | ❌ | ✅ **(dédié, conversion auto)** |
| **Budgets mensuels** | ✅ | ✅ | ✅ |
| **Objectifs d'épargne** | ✅ | ✅ | ✅ |
| **Transactions récurrentes** | ✅ | ✅ | ✅ |
| **Import CSV** | ✅ | ✅ | ✅ |
| **Export JSON (RGPD)** | ✅ | ✅ | ✅ |
| **Export PDF (rapports)** | ✅ | ✅ | ✅ |
| **Graphiques (Recharts)** | ✅ | ✅ | ✅ |
| **Toast notifications** | ❌ (alert()) | ❌ (alert()) | ✅ **Système complet** |
| **Confirm dialog** | ❌ (window.confirm) | ❌ (window.confirm) | ✅ **Modal custom** |
| **Compte démo** | ❌ | ❌ | ✅ **(6 mois données réalistes)** |
| **Recherche transactions** | ✅ | ✅ | ✅ |
| **Sous-catégories** | ✅ (parentId) | ✅ **(self-relation)** | ✅ (parentId) |
| **Feedback utilisateur** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

### 2.7 DevOps / Infrastructure

| Aspect | Version A | Version B | Version C |
|--------|:---------:|:---------:|:---------:|
| **Docker Compose** | ✅ (3 services) | ✅ (3 services) | ❌ |
| **Dockerfile backend** | ✅ (dans backend/) | ✅ (à la racine) | ❌ |
| **Dockerfile frontend** | ✅ (Nginx) | ✅ (Nginx) | ❌ |
| **Nginx config** | ✅ | ✅ | ❌ |
| **Scripts npm** | 3 scripts | **12 scripts** (full, prisma, docker) | 3 scripts |
| **Healthcheck** | ✅ (Postgres) | ✅ (Postgres) | ❌ |
| **Network isolation** | ✅ (fintrack net) | ❌ (default) | ❌ |
| **Volumes persistants** | ✅ (postgres + uploads) | ✅ (postgres) | ❌ |
| **PostgreSQL** | 15-alpine | **16-alpine** | ❌ |
| **.gitignore** | ✅ (backend/) | ✅ (racine) | ❌ |
| **Concurrently** | ❌ | ✅ **(dev:full)** | ❌ |
| **README** | ✅ (complet) | ✅ **(très détaillé, 300+ LOC)** | ❌ |
| **Audit doc** | ❌ | ✅ **AUDIT_BACKEND_FRONTEND.md** | ❌ |

---

## 3. Matrice de synthèse

| Dimension | Version A | Version B | Version C | **Consolidée (cible)** |
|-----------|:---------:|:---------:|:---------:|:----------------------:|
| Architecture backend | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐⭐⭐⭐ |
| Schéma de données | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Frontend UX | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Sync online/offline | ⭐⭐⭐⭐ | ⭐ | ❌ | ⭐⭐⭐⭐⭐ |
| API client | ⭐⭐⭐⭐⭐ | ⭐ | ❌ | ⭐⭐⭐⭐⭐ |
| Sécurité | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| DevOps / Docker | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ | ⭐⭐⭐⭐⭐ |
| Documentation | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐⭐⭐⭐ |
| Prêt pour production | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ (offline) | ⭐⭐⭐⭐⭐ |

---

## 4. Verdict : Forces et Faiblesses

### 🏆 Meilleur de chaque version

| Source | Ce qu'on prend |
|--------|---------------|
| **Version A** | `auth-v2.ts` (détection hybrid), `sync.ts` (sync unidirectionnelle), `api.ts` (client HTTP complet), network isolation Docker |
| **Version B** | Architecture MVC backend, Schéma Prisma riche (9+ modèles), Middlewares (validation Zod, error handler, rate limiter, upload), Passport OAuth, Scripts npm complets, README détaillé, Audit documenté |
| **Version C** | `Toast.tsx` + `ConfirmViewport`, `Transfer.tsx` (transferts inter-comptes), `demoSeed.ts` (compte démo), Login amélioré, UX raffinée, Dépendances minimales |

### ⚠️ Ce qu'on corrige

| Problème | Présent dans | Solution |
|----------|:------------:|---------|
| Backend non compilable (Decimal vs number) | A, B | Convertir tous les `Decimal` → `Number()` |
| PrismaClient non singleton | B | Créer `src/lib/prisma.ts` partagé |
| Dockerfile mélangé (racine vs backend) | B | 2 Dockerfiles distincts : `backend/Dockerfile` + `Dockerfile.frontend` |
| Sync unidirectionnelle (push only) | A | Implémenter pull + timestamps `updatedAt` + résolution de conflits |
| `JWT_SECRET` fallback en clair | A, B | Refuser le démarrage sans `JWT_SECRET` en production |
| Refresh tokens en clair | B | Stocker un hash SHA-256 du refresh token |
| OAuth callback manquant côté frontend | A, B | Créer une page `/auth/callback` pour stocker les tokens |
| `alert()` / `window.confirm()` | A, B | Remplacer par Toast/Confirm de C |
| Pas de tests | A, B, C | Ajouter Vitest (frontend) + Jest/Supertest (backend) |

---

## 5. Plan de Construction — Version Consolidée

### Phase 0 : Fondations (Semaine 1)

#### 0.1 Structure du projet
```
fintrack/
├── frontend/                    # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/          # ui.tsx + Toast.tsx + Layout.tsx
│   │   ├── db/                  # database.ts (Dexie)
│   │   ├── hooks/               # useRates.ts, useOnlineStatus.ts
│   │   ├── pages/               # 11 pages (Dashboard → Transfer)
│   │   ├── services/            # auth.ts, auth-hybrid.ts, api.ts, sync.ts, fx.ts, ...
│   │   ├── store/               # useSession.ts (Zustand)
│   │   └── utils/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/                     # Node.js + Express + Prisma
│   ├── src/
│   │   ├── controllers/         # 10 controllers (de B)
│   │   ├── middleware/          # auth, validation, errorHandler, rateLimiter, upload
│   │   ├── routes/              # 11 routes (de B)
│   │   ├── lib/                 # prisma.ts (singleton), jwt.ts
│   │   ├── utils/               # logger.ts, fx.ts, pdf.ts, recurring.ts
│   │   └── types/
│   ├── prisma/
│   │   ├── schema.prisma        # Schéma consolidé (de B + @@map de A)
│   │   └── seed.ts
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml           # 3 services (de A, réseau isolé)
├── Dockerfile.frontend          # Nginx
├── nginx.conf
├── .env.example
├── .gitignore
├── README.md
└── CHANGELOG.md
```

#### 0.2 Tâches techniques
- [ ] Créer le monorepo avec la structure ci-dessus
- [ ] Copier le schéma Prisma de B, ajouter les `@@map` de A
- [ ] Créer `backend/src/lib/prisma.ts` (singleton PrismaClient)
- [ ] Fixer tous les `Decimal` → `Number()` dans les controllers
- [ ] Valider `npm run build` backend (TypeScript vert)
- [ ] Configurer `tsconfig.json` strict pour frontend et backend
- [ ] Mettre en place `.editorconfig`, `.prettierrc`, `eslint.config.js`

### Phase 1 : Frontend Consolidé (Semaines 2-3)

#### 1.1 Core UI (source : Version C)
- [ ] Copier `Toast.tsx` + `ConfirmViewport` de C
- [ ] Copier `Layout.tsx` de C (avec route Transfer)
- [ ] Copier les 11 pages de C comme base
- [ ] Remplacer tous les `alert()` / `window.confirm()` par Toast/Confirm
- [ ] Copier `demoSeed.ts` de C (compte démo)
- [ ] Copier le Login amélioré de C (bouton démo)

#### 1.2 Services (fusion A + C)
- [ ] `services/auth.ts` : garder le local-first de C (identique A/B/C)
- [ ] `services/auth-hybrid.ts` : prendre de A, adapter pour utiliser Toast
- [ ] `services/api.ts` : prendre de A (client HTTP complet), corriger types
- [ ] `services/sync.ts` : prendre de A, étendre (voir Phase 3)
- [ ] `services/fx.ts`, `importExport.ts`, `recurring.ts`, `seed.ts` : identiques (prendre de C)
- [ ] `db/database.ts` : identique (prendre de C)

#### 1.3 Améliorations nouvelles
- [ ] Ajouter `useOnlineStatus.ts` : hook React pour détecter online/offline en temps réel
- [ ] Ajouter indicateur de connexion dans le Layout (badge vert/orange)
- [ ] Ajouter `src/services/syncQueue.ts` : file d'attente locale pour les opérations offline
- [ ] Settings : fusionner le panneau sync (A) + health check (B) + toasts (C)

### Phase 2 : Backend Unifié (Semaines 3-4)

#### 2.1 Controllers (source : Version B, corrigés)
- [ ] Copier les 10 controllers de B
- [ ] Remplacer `new PrismaClient()` → import singleton `lib/prisma.ts`
- [ ] Corriger tous les types `Decimal` :
  ```typescript
  // Avant (B cassé)
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  // Après (consolidé)
  const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  ```
- [ ] Ajouter le controller `syncController.ts` (nouveau)

#### 2.2 Middlewares (source : Version B)
- [ ] `auth.ts` : Passport JWT + Bearer validation (de B, corrigé)
- [ ] `validation.ts` : Schémas Zod complets (de B)
- [ ] `errorHandler.ts` : Error handler global (de B)
- [ ] `rateLimiter.ts` : Rate limiting (de B)
- [ ] `upload.ts` : Multer config (de B)

#### 2.3 Routes (source : Version B enrichies)
- [ ] Copier les 11 routes de B
- [ ] Ajouter route `sync.ts` :
  ```
  GET  /api/v1/sync/pull?since=<ISO8601>   → Toutes les entités modifiées depuis X
  POST /api/v1/sync/push                    → Batch upsert de toutes les entités
  ```
- [ ] Corriger l'ordonnancement routes statiques vs `/:id`

#### 2.4 Schéma Prisma consolidé
- [ ] Partir du schéma B (le plus riche)
- [ ] Ajouter `@@map("nom_sql")` de A pour des noms de tables propres
- [ ] Ajouter champs de sync : `syncedAt DateTime?`, `deletedAt DateTime?`
- [ ] Refuser démarrage sans `JWT_SECRET` env :
  ```typescript
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-me')) {
    throw new Error('JWT_SECRET must be set in production');
  }
  ```

#### 2.5 Sécurité
- [ ] Hasher les refresh tokens en base (SHA-256)
- [ ] OAuth callback : cookie HttpOnly SameSite=Lax
- [ ] Restreindre CLIENT_ORIGIN (pas de `*`)
- [ ] Ajouter CSRF protection pour les cookies

### Phase 3 : Synchronisation Offline-First (Semaines 5-6)

#### 3.1 Modèle de sync
```
┌─────────────────────────────────────────────────┐
│                Frontend (Dexie)                 │
│                                                 │
│  ┌─────────────┐    ┌────────────────────────┐  │
│  │ Tables métier│───→│ syncQueue              │  │
│  │ (+ updatedAt│    │ { entity, id, action,  │  │
│  │  + syncStatus)   │   payload, timestamp } │  │
│  └─────────────┘    └────────────────────────┘  │
│         ↕                      ↕                │
│  ┌──────────────────────────────────────────┐   │
│  │ SyncEngine                               │   │
│  │ - pushPending() → POST /sync/push        │   │
│  │ - pullRemote()  → GET  /sync/pull?since  │   │
│  │ - resolveConflict() → last-write-wins    │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────────┐
│            Backend (Express + Prisma)            │
│                                                 │
│  POST /sync/push                                │
│   → Batch upsert avec updatedAt comparison      │
│   → Retourne les conflits détectés              │
│                                                 │
│  GET /sync/pull?since=ISO8601                   │
│   → Retourne toutes les entités modifiées       │
│   → Inclut deletedAt pour soft-deletes          │
└─────────────────────────────────────────────────┘
```

#### 3.2 Tâches
- [ ] Ajouter champs `updatedAt: number` et `syncStatus: 'local' | 'synced' | 'conflict'` au schéma Dexie
- [ ] Créer table Dexie `syncQueue` pour les opérations en attente
- [ ] Implémenter `SyncEngine` :
  - `pushPending()` : envoie les éléments de la queue vers le backend
  - `pullChanges(since)` : récupère les modifications du backend
  - `resolveConflicts()` : stratégie last-write-wins (Phase 1), merge assisté (Phase 2)
- [ ] Ajouter `service-worker.ts` pour sync en arrière-plan (Background Sync API)
- [ ] Ajouter endpoints backend `POST /sync/push` et `GET /sync/pull`
- [ ] Ajouter indicateur visuel de statut de sync dans le Layout

### Phase 4 : Qualité & Déploiement (Semaines 7-8)

#### 4.1 Tests
- [ ] **Frontend** : Vitest + React Testing Library
  - Tests unitaires services : auth, fx, recurring, sync
  - Tests composants : Toast, Confirm, pages principales
  - Coverage cible : 70%+
- [ ] **Backend** : Jest + Supertest
  - Tests routes : auth, CRUD, sync
  - Tests middlewares : validation, auth
  - Tests controllers avec mock Prisma
  - Coverage cible : 80%+
- [ ] **E2E** : Playwright (optionnel, Phase 2)

#### 4.2 Docker & CI/CD
- [ ] Docker Compose consolidé (de A, network isolé, PostgreSQL 16)
- [ ] Dockerfile backend : multi-stage, `prisma migrate deploy` au démarrage
- [ ] Dockerfile frontend : build Vite + Nginx
- [ ] GitHub Actions pipeline :
  ```yaml
  - Lint (ESLint + Prettier)
  - Type check (tsc --noEmit)
  - Tests (Vitest + Jest)
  - Build (frontend + backend)
  - Docker build & push
  ```
- [ ] `.env.example` complet avec documentation inline

#### 4.3 Documentation
- [ ] README consolidé (format de B, le plus détaillé)
- [ ] API documentation avec exemples curl
- [ ] Guide de contribution
- [ ] CHANGELOG.md
- [ ] Architecture Decision Records (ADR) pour les choix clés

---

## 6. Architecture cible

```
                    ┌──────────────────────────────────────────┐
                    │           UTILISATEUR                     │
                    └───────────────┬──────────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────────┐
                    │         Nginx (Dockerfile.frontend)       │
                    │    - Sert le build Vite (SPA)             │
                    │    - Proxy /api → backend:4000            │
                    │    - Headers sécurité (CSP, HSTS)         │
                    │    Port: 80/443                           │
                    └───────────────┬──────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         │
┌─────────────────────┐  ┌─────────────────────┐             │
│   Frontend React    │  │   Backend Express    │             │
│                     │  │                     │             │
│ • IndexedDB (Dexie) │  │ • Prisma ORM        │             │
│ • SyncEngine        │◄─┤ • JWT + Passport    │             │
│ • Toast/Confirm     │  │ • Zod validation    │             │
│ • Zustand store     │  │ • Winston logger    │             │
│ • Recharts          │  │ • Rate limiter      │             │
│ • jsPDF             │  │ • Multer uploads    │             │
│ • bcryptjs (local)  │  │ • pdfmake           │             │
│                     │  │ • Sync endpoints    │             │
│ MODE OFFLINE ✅     │  │ Port: 4000           │             │
└─────────────────────┘  └──────────┬──────────┘             │
                                    │                         │
                          ┌─────────▼──────────┐             │
                          │   PostgreSQL 16     │             │
                          │   (fintrack DB)     │             │
                          │   Port: 5432        │             │
                          │   Volume: persistant│             │
                          └────────────────────┘             │
                                                              │
                          ┌────────────────────┐             │
                          │   Network: fintrack │◄────────────┘
                          │   (bridge, isolé)   │
                          └────────────────────┘
```

---

## 7. Schéma de données consolidé

```prisma
// FinTrack — Schéma Prisma Consolidé
// Fusionne : Version B (riche) + Version A (@@map) + champs sync

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String?                          // Nullable pour OAuth (de B)
  fullName     String?
  baseCurrency String    @default("EUR")
  avatarUrl    String?                          // de B
  googleId     String?   @unique                // de B
  isVerified   Boolean   @default(false)        // de B
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  accounts     Account[]
  categories   Category[]
  transactions Transaction[]
  budgets      Budget[]
  goals        Goal[]
  recurring    RecurringTransaction[]
  sessions     Session[]
  attachments  Attachment[]

  @@index([email])
  @@index([googleId])
  @@map("users")                                // de A
}

model Account {
  id             String   @id @default(uuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name           String
  type           String   @default("checking")
  currency       String   @default("EUR")
  initialBalance Decimal  @default(0) @db.Decimal(12, 2)
  currentBalance Decimal  @default(0) @db.Decimal(12, 2)  // de B
  color          String?  @default("#0ea5e9")              // de B
  icon           String?  @default("💳")                   // de B
  isActive       Boolean  @default(true)                   // de B
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?                                  // NOUVEAU: soft-delete pour sync

  transactions   Transaction[]
  recurring      RecurringTransaction[]

  @@unique([userId, name])
  @@index([userId])
  @@map("accounts")
}

model Category {
  id         String     @id @default(uuid())
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  label      String
  kind       String     @default("expense")
  color      String     @default("#64748b")
  icon       String?    @default("🏷️")
  parentId   String?
  parent     Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children   Category[] @relation("CategoryHierarchy")     // de B (self-relation)
  isActive   Boolean    @default(true)                     // de B
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  deletedAt  DateTime?

  transactions Transaction[]
  budgets      Budget[]
  recurring    RecurringTransaction[]

  @@unique([userId, label])
  @@index([userId])
  @@index([parentId])
  @@map("categories")
}

model Transaction {
  id           String                @id @default(uuid())
  userId       String
  user         User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId    String
  account      Account               @relation(fields: [accountId], references: [id], onDelete: Cascade)
  categoryId   String?                                     // Nullable (de B, pour SetNull)
  category     Category?             @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  amount       Decimal               @db.Decimal(12, 2)
  type         String                @default("expense")
  currency     String                @default("EUR")
  date         DateTime
  description  String?
  notes        String?                                     // de B
  recurringId  String?
  recurring    RecurringTransaction? @relation(fields: [recurringId], references: [id])
  goalId       String?
  goal         Goal?                 @relation(fields: [goalId], references: [id])
  attachments  String[]              @default([])          // de B
  uploadedFiles Attachment[]
  createdAt    DateTime              @default(now())
  updatedAt    DateTime              @updatedAt
  deletedAt    DateTime?

  @@index([userId])
  @@index([accountId])
  @@index([categoryId])
  @@index([date])
  @@index([recurringId])
  @@index([goalId])
  @@index([userId, date])
  @@map("transactions")
}

model Budget {
  id             String   @id @default(uuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  categoryId     String
  category       Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  month          String                                    // YYYY-MM
  year           Int                                       // de B
  limit          Decimal  @db.Decimal(12, 2)
  currentAmount  Decimal  @default(0) @db.Decimal(12, 2)  // de B
  alertThreshold Int      @default(80)
  isActive       Boolean  @default(true)                   // de B
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  @@unique([userId, categoryId, month])
  @@index([userId])
  @@index([categoryId])
  @@index([month])
  @@index([userId, month])
  @@map("budgets")
}

model Goal {
  id            String            @id @default(uuid())
  userId        String
  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  label         String
  description   String?                                    // de B
  targetAmount  Decimal           @db.Decimal(12, 2)
  currentAmount Decimal           @default(0) @db.Decimal(12, 2)
  targetDate    DateTime
  color         String            @default("#0ea5e9")
  icon          String?           @default("🎯")
  isCompleted   Boolean           @default(false)          // de B
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  deletedAt     DateTime?

  transactions  Transaction[]
  contributions GoalTransaction[]                          // de B

  @@index([userId])
  @@index([targetDate])
  @@map("goals")
}

model GoalTransaction {                                    // de B
  id            String       @id @default(uuid())
  goalId        String
  goal          Goal         @relation(fields: [goalId], references: [id], onDelete: Cascade)
  transactionId String?
  amount        Decimal      @db.Decimal(12, 2)
  date          DateTime     @default(now())
  notes         String?
  createdAt     DateTime     @default(now())

  @@unique([goalId, transactionId])
  @@index([goalId])
  @@index([transactionId])
  @@map("goal_transactions")
}

model RecurringTransaction {
  id           String        @id @default(uuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId    String
  account      Account       @relation(fields: [accountId], references: [id], onDelete: Cascade)
  categoryId   String
  category     Category      @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  amount       Decimal       @db.Decimal(12, 2)
  type         String        @default("expense")
  currency     String        @default("EUR")
  description  String
  frequency    String                                      // daily, weekly, biweekly, monthly, quarterly, yearly
  interval     Int           @default(1)                   // de B
  startDate    DateTime                                    // de B
  nextDate     DateTime
  endDate      DateTime?
  occurrences  Int           @default(0)                   // de B
  isActive     Boolean       @default(true)                // de B
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  deletedAt    DateTime?

  transactions Transaction[]

  @@index([userId])
  @@index([accountId])
  @@index([nextDate])
  @@index([isActive])
  @@map("recurring_transactions")
}

model Session {                                             // de B
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshToken String                                      // Stocker un HASH, pas le token brut
  ipAddress    String?
  userAgent    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([refreshToken])
  @@index([expiresAt])
  @@map("sessions")
}

model Attachment {                                          // de B
  id            String       @id @default(uuid())
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  filename      String
  originalName  String
  mimeType      String
  size          Int
  url           String
  transactionId String?
  transaction   Transaction? @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  createdAt     DateTime     @default(now())

  @@index([userId])
  @@index([transactionId])
  @@map("attachments")
}
```

---

## 8. Risques et mitigations

| # | Risque | Impact | Probabilité | Mitigation |
|---|--------|--------|-------------|------------|
| 1 | **Conflits de sync** lors de modifications simultanées sur 2 appareils | Élevé | Moyen | Last-write-wins en V1, merge assisté en V2. `updatedAt` + versioning |
| 2 | **Migration Dexie** quand on ajoute des champs de sync | Moyen | Élevé | Incrémenter la version Dexie, migration guidée, tester sur DB existantes |
| 3 | **Performance sync** avec beaucoup de transactions (>10K) | Moyen | Moyen | Sync par batch (100 entités), pagination, delta sync (`since` timestamp) |
| 4 | **OAuth callback** UX cassée si tokens dans l'URL | Moyen | Faible | Cookie HttpOnly SameSite=Lax, code exchange flow |
| 5 | **Decimal precision** perdue entre Dexie (float) et Prisma (Decimal) | Élevé | Moyen | Stocker en centimes côté Dexie (`amount * 100`), convertir à l'affichage |
| 6 | **Breaking change** pour les utilisateurs existants (données Dexie) | Élevé | Élevé | Script de migration automatique au login, backup avant migration |
| 7 | **Scope creep** si on essaie de tout consolider en une itération | Moyen | Élevé | Livraison incrémentale : Phase 0→1 = fonctionnel offline, Phase 2→3 = online |

---

## Conclusion

La version consolidée combine :

- 🏗️ **L'architecture backend MVC** de la Version B (la plus professionnelle)
- 🔄 **La synchronisation hybride** de la Version A (la seule avec sync)
- 🎨 **L'UX soignée** de la Version C (toasts, transfers, démo)
- 🛡️ **La sécurité renforcée** : JWT sans fallback, refresh tokens hashés, CORS strict
- 📦 **Le DevOps mature** : Docker isolé (A), scripts complets (B), CI/CD
- 🧪 **Les tests** : absents des 3 versions, obligatoires dans la consolidée

**Estimation totale : 8 semaines** pour un développeur senior, ou **5 semaines** pour une équipe de 2.

**Livraison incrémentale recommandée** :
1. **Semaine 3** : Frontend consolidé offline-first fonctionnel (déployable)
2. **Semaine 5** : Backend compilable et fonctionnel (Docker up)
3. **Semaine 7** : Sync bidirectionnelle opérationnelle
4. **Semaine 8** : Tests + CI/CD + documentation + release v1.0
