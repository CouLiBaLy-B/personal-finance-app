# Audit backend et intégration frontend

Date: 2026-05-31

## Résumé exécutif

Le frontend FinTrack est fonctionnel en mode local-first, mais l'intégration backend était essentiellement documentaire: aucune page ne testait l'API, et les services métier continuent d'utiliser IndexedDB directement. Le backend Express/Prisma contenait aussi plusieurs bloqueurs empêchant une mise en production directe.

## Corrections appliquées

- Ajout d'un client API frontend minimal dans `src/services/api.ts`.
- Ajout d'un panneau `Intégration backend` dans `src/pages/Settings.tsx` pour tester `/api/v1/health` via `VITE_API_URL`.
- Ajout de `src/vite-env.d.ts` pour typer `import.meta.env`.
- Correction du schéma Prisma pour permettre l'OAuth sans mot de passe local (`passwordHash` optionnel).
- Correction du schéma Prisma pour rendre `Transaction.categoryId` nullable, cohérent avec `onDelete: SetNull` et les contrôleurs.
- Correction de `GoalTransaction.transactionId` nullable pour supporter les contributions manuelles non liées à une transaction.
- Ajout des relations `Attachment` manquantes côté Prisma.
- Correction de `requireAuth` pour valider un JWT Bearer si `req.user` n'est pas déjà renseigné.
- Ajout de `categoryQuerySchema`, importé par les routes et contrôleurs catégories.
- Compatibilité Zod v3/v4 sur les erreurs de validation (`issues` ou `errors`).
- Correction d'ordonnancement des routes statiques avant `/:id` (`/export`, `/tree`, `/report`, `/generate`, etc.).
- Installation des dépendances backend manquantes dans le package racine: `@prisma/client`, `csv-parser`, `winston`, `express-winston`, `helmet`, types Passport/Multer.

## Bloqueurs restants

- Le backend n'est pas encore entièrement compilable sans une passe de typage complète: plusieurs contrôleurs manipulent des `Decimal` Prisma comme des `number` (`+`, `-`, `/`). Il faut convertir explicitement via `Number(decimal)` ou utiliser `Decimal`.
- Les contrôleurs instancient plusieurs `new PrismaClient()` au lieu d'un singleton partagé. Cela peut créer trop de connexions PostgreSQL.
- Le seed Prisma utilise des montants numériques sans vérifier le type généré par Prisma après migration.
- Les scripts Docker ne lancent pas encore `prisma migrate deploy` avant `node dist/index.js`.
- Le Dockerfile backend mélange le package racine et `backend/package.json`. Il faut choisir une seule stratégie d'installation.
- Les routes protégées fonctionnent maintenant avec Bearer JWT, mais le frontend n'envoie pas encore de JWT backend: l'app reste local-first.
- OAuth Google redirige vers `/auth/callback`, mais le frontend n'a pas encore de page de callback pour stocker les tokens backend.

## Risques sécurité

- Le fallback `JWT_SECRET` en clair doit être refusé en production.
- Les refresh tokens sont stockés en clair en base. Recommandation: stocker un hash du refresh token.
- Le retour OAuth par query string expose les tokens dans l'historique URL. Recommandation: cookie HttpOnly SameSite=Lax/Strict ou code exchange.
- `CLIENT_ORIGIN="*"` avec `credentials: true` est invalide et dangereux. Restreindre explicitement les origines.
- Les exports RGPD devraient masquer les IP/user-agent selon la politique de conservation.

## Plan d'intégration recommandé

1. Stabiliser le backend: Prisma schema valide, singleton Prisma, conversions `Decimal`, build TypeScript vert.
2. Ajouter une couche repository côté frontend: Dexie reste source offline, API devient source de synchronisation.
3. Ajouter table locale `syncQueue` et champs `updatedAt`, `deletedAt`, `syncStatus`.
4. Implémenter login backend + stockage sécurisé des tokens côté client, idéalement via cookie HttpOnly.
5. Ajouter endpoints batch: `GET /sync/pull?since=...`, `POST /sync/push`.
6. Ajouter résolution de conflit: last-write-wins au départ, puis merge assisté pour les transactions.

## Verdict

Le frontend est utilisable en production locale/offline. Le backend est une base d'API réaliste mais nécessite une passe de stabilisation TypeScript/Prisma avant déploiement. L'intégration frontend est maintenant vérifiable via le health check, mais la synchronisation applicative complète reste à développer.