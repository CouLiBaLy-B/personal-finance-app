# 🔍 Audit de Production-Readiness — FinTrack Consolidé

> **Date** : 1er juin 2026  
> **Verdict** : ❌ **NON, pas prête pour la production en l'état.**  
> **Niveau estimé** : ~65% production-ready. Bon prototype fonctionnel, base solide, mais plusieurs chantiers bloquants.

---

## Résumé exécutif

| Dimension | Score | Verdict |
|-----------|:-----:|---------|
| Compilation & Build | ✅ 10/10 | Zéro erreur TS, builds OK |
| Architecture | ✅ 8/10 | MVC propre, bonne séparation |
| Fonctionnel métier | ✅ 8/10 | Couverture complète finance perso |
| **Tests** | ❌ **0/10** | **AUCUN test. Zéro.** |
| **Sécurité** | ⚠️ **5/10** | Fondations OK mais trous critiques |
| **Résilience données** | ⚠️ **4/10** | Race conditions, pas de backup |
| **Sync engine** | ⚠️ **3/10** | Naïf, pas de vrai conflit handling |
| Observabilité | ⚠️ 5/10 | Logger OK, pas de metrics/alerting |
| DevOps | ⚠️ 6/10 | Docker OK, manque healthcheck backend |
| Documentation API | ⚠️ 6/10 | README OK, pas de Swagger/OpenAPI |

---

## 🔴 BLOQUANTS — à corriger AVANT toute mise en prod

### 1. Zéro test (Critique)

Aucun fichier de test dans tout le projet. Ni unitaire, ni intégration, ni E2E.

**Risque** : Toute modification peut casser le système sans qu'on le sache. Impossible de déployer sereinement.

**Action requise** :
- Tests unitaires critiques : auth (register/login/refresh), validation Zod, helpers (toNumber, hashToken)
- Tests d'intégration : CRUD complet sur chaque entité (avec base de test)
- Tests frontend : composants critiques (Toast, Login, Transfer)
- Cible minimum : **70% coverage backend**, 50% frontend

### 2. Token JWT stocké en clair dans IndexedDB (Critique)

```typescript
// frontend/src/services/auth.ts — le "JWT" local est un simple base64
function makeToken(userId: string): string {
  return btoa(JSON.stringify({ sub: userId, ... }));
}
```

Le token local n'a **aucune signature**. N'importe quel script dans la page peut le forger. IndexedDB est accessible à tout JavaScript sur le même domaine.

**Risque** : Si une XSS passe (même via une dépendance npm compromise), l'attaquant peut usurper n'importe quel compte local.

**Action requise** :
- En mode online : stocker le JWT backend dans un **cookie HttpOnly SameSite=Strict** (pas IndexedDB)
- En mode offline : le token local est un confort, mais le passwordHash bcrypt reste la vraie protection — acceptable si on documente le threat model

### 3. Pas de validation sur `/auth/profile`, `/auth/change-password`, `/sync/push` (Élevé)

```
PUT  /auth/profile         → pas de validate() middleware
PUT  /auth/change-password → pas de validate() middleware  
POST /sync/push            → pas de validate() middleware → accepte n'importe quel JSON
```

**Risque** : Injection de champs arbitraires, crash serveur sur données malformées.

**Action requise** : Ajouter des schémas Zod pour chaque route sans validation.

### 4. Race conditions sur les soldes et objectifs (Élevé)

```typescript
// goalController.ts — read-then-write non atomique
const newAmount = toNumber(goal.currentAmount) + amount;  // READ
await prisma.goal.update({ data: { currentAmount: newAmount } });  // WRITE
```

Deux requêtes concurrentes peuvent lire le même `currentAmount` et écraser l'une l'autre.

**Action requise** : Utiliser `prisma.goal.update({ data: { currentAmount: { increment: amount } } })` — la version atomique qui existe déjà dans le code pour certains cas mais pas tous.

### 5. Sync engine naïf — risque de perte de données (Élevé)

Problèmes identifiés :
- **Push envoie TOUT** à chaque sync, pas seulement les deltas → O(n) réseau inutile
- **Pas de timestamp `updatedAt` côté Dexie** → impossible de savoir ce qui a changé
- **Pas de résolution de conflits** → le `conflicts: 0` dans le résultat est un compteur jamais incrémenté
- **Last-write-wins implicite** → l'upsert écrase silencieusement les modifications serveur
- **Pas de file d'attente offline** → si push échoue à mi-chemin, état incohérent

**Risque** : Perte de données silencieuse si deux appareils modifient les mêmes entités.

**Action requise** :
- Ajouter `updatedAt` au schéma Dexie
- Implémenter un delta sync (seulement les entités modifiées depuis lastSync)
- Ajouter une `syncQueue` locale pour les opérations en attente
- Implémenter une détection de conflits basique (comparer updatedAt local vs serveur)

---

## 🟡 IMPORTANTS — à corriger pour un usage réel

### 6. Pas de pagination sur la majorité des endpoints

Seul `/transactions` a une pagination. Les autres (`/accounts`, `/categories`, `/budgets`, `/goals`, `/recurring`, `/reports`) retournent TOUT.

**Risque** : Avec des centaines de catégories ou des milliers de transactions récurrentes, les réponses deviennent lourdes.

**Impact** : Moyen pour un usage personnel (données limitées), élevé pour un SaaS multi-tenant.

### 7. Soft-delete incohérent

Certaines queries filtrent `deletedAt: null`, d'autres non. Exemple : les queries de calcul de balance dans `accountController` filtrent, mais pas toutes les sous-queries.

**Action** : Audit systématique de chaque `findMany`/`findFirst`/`count`/`aggregate` pour s'assurer que `deletedAt: null` est présent.

### 8. Pas de healthcheck backend dans Docker Compose

Le service `postgres` a un healthcheck, mais pas le service `backend`. Si le backend crash-loop, Docker le redémarre mais le frontend continue d'essayer de s'y connecter sans savoir qu'il est down.

```yaml
# Manquant :
backend:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
    interval: 10s
    timeout: 5s
    retries: 5
```

### 9. Pas de mécanisme de migration Dexie

Le schéma Dexie est en version 1. Si on ajoute des champs (ex: `updatedAt`, `syncStatus`), les utilisateurs existants verront leur base corrompue ou migrée silencieusement sans les nouveaux index.

**Action** : Implémenter `this.version(2).stores({...}).upgrade(tx => { ... })` pour les évolutions futures.

### 10. `console.warn` en production dans jwt.ts

```typescript
console.warn("⚠️  JWT_SECRET is using the default value...");
```

En dev c'est utile, mais en production le check devrait throw (ce qu'il fait) ET ne pas logger en mode non-production.

### 11. Pas de HTTPS / TLS

Le Docker Compose expose tout en HTTP. En production, il faut un reverse proxy TLS (Traefik, Caddy, ou cert sur Nginx).

### 12. Absence totale de monitoring

Pas de :
- Métriques Prometheus/Grafana
- APM (Application Performance Monitoring)
- Alerting (PagerDuty, Slack webhook)
- Error tracking (Sentry)
- Audit log des actions sensibles

---

## 🟢 CE QUI EST BIEN FAIT

1. **TypeScript strict** — compilation zéro erreur frontend ET backend
2. **Architecture MVC** — séparation propre controllers/routes/middleware
3. **Prisma ORM** — pas de raw SQL, injection impossible
4. **Singleton Prisma** — pas de connexions multiples
5. **Conversion Decimal** — toutes les conversions Prisma→Number sont faites
6. **Error handler global** — les erreurs ne crashent pas le serveur
7. **Rate limiting** — présent sur auth et operations sensibles
8. **CORS strict** — pas de wildcard `*`
9. **Helmet** — headers de sécurité HTTP
10. **Validation Zod** — présente sur la majorité des routes d'écriture
11. **Refresh tokens hashés** — SHA-256 avant stockage
12. **Soft-delete** — `deletedAt` sur toutes les entités (base pour la sync)
13. **UX soignée** — Toast/Confirm, indicateur connectivité, compte démo
14. **Offline-first** — IndexedDB fonctionne à 100% sans backend
15. **RGPD** — export complet + suppression du compte côté frontend ET backend

---

## 📋 Plan d'action pour atteindre la prod

### Sprint 1 (1 semaine) — Sécurité & Tests critiques
- [ ] Ajouter validation Zod sur `/auth/profile`, `/change-password`, `/sync/push`
- [ ] Fixer race conditions (atomic `increment` partout)
- [ ] Écrire tests auth (register, login, refresh, token expiry)
- [ ] Écrire tests CRUD (au moins transactions + accounts)
- [ ] Cookie HttpOnly pour le JWT backend
- [ ] Healthcheck backend dans Docker Compose

### Sprint 2 (1 semaine) — Data & Sync
- [ ] Ajouter `updatedAt` au schéma Dexie (migration v2)
- [ ] Delta sync (seulement les entités modifiées)
- [ ] SyncQueue locale pour les opérations offline
- [ ] Détection de conflits basique (updatedAt comparison)
- [ ] Soft-delete audit (filtrage `deletedAt: null` systématique)
- [ ] Pagination sur tous les endpoints list

### Sprint 3 (1 semaine) — Production hardening
- [ ] TLS via Traefik ou Caddy
- [ ] Sentry pour error tracking
- [ ] Health metrics endpoint (connexions DB, mémoire, latence)
- [ ] Backup PostgreSQL automatisé (pg_dump cron)
- [ ] GitHub Actions : tests dans CI
- [ ] Documentation OpenAPI / Swagger

**Estimation : 3 semaines supplémentaires pour une vraie mise en prod.**

---

## Conclusion

La version consolidée est un **excellent prototype fonctionnel** et une **base technique solide**. L'architecture est propre, le code compile, les fonctionnalités métier sont complètes, l'UX est soignée.

Mais en toute honnêteté : **déployer ça tel quel en production avec des vrais utilisateurs et des vraies données financières serait irresponsable**. Les données financières sont sensibles — un bug de sync qui perd des transactions, un token forgé qui donne accès à un autre compte, une race condition qui fausse un solde... ces choses arrivent quand on n'a pas de tests et pas de monitoring.

C'est à **~65% du chemin vers la prod**. Les 35% restants sont les moins glamour (tests, sécurité, monitoring) mais les plus critiques.
