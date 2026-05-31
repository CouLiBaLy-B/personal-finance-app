/**
 * Script de seed global pour FinTrack (utile pendant le développement).
 * Usage : `pnpm run seed`
 *
 * Crée un utilisateur "demo@fintrack.app" avec un jeu de catégories,
 * comptes et transactions fictives. Ne JAMAIS exécuter en production
 * (vérification via NODE_ENV).
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/middleware/auth";
import { logger } from "../src/utils/logger";
import { seedDefaultCategories } from "../src/utils/seed";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    logger.error("[SEED] Refus d'exécuter le seed en PRODUCTION.");
    process.exit(1);
  }

  const email = "demo@fintrack.app";
  const fullName = "Utilisateur Démo";
  const baseCurrency = "EUR";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.info(`[SEED] Utilisateur ${email} déjà présent — skip.`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword("demopassword"),
      fullName,
      baseCurrency,
    },
  });

  await seedDefaultCategories(prisma, user.id, baseCurrency);

  const account = await prisma.account.findFirst({ where: { userId: user.id } });
  const categories = await prisma.category.findMany({ where: { userId: user.id } });

  if (!account || categories.length === 0) {
    logger.error("[SEED] Compte/catégories introuvables après seed.");
    return;
  }

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const incomeCats = categories.filter((c) => c.kind === "income");

  // Crée 20 transactions fictives sur les 60 derniers jours
  const now = new Date();
  const transactions = [];

  // 5 revenus
  for (let i = 0; i < 5; i++) {
    const cat = incomeCats[i % incomeCats.length];
    transactions.push({
      userId: user.id,
      accountId: account.id,
      categoryId: cat.id,
      amount: Math.round(1500 + Math.random() * 2000) + i * 50,
      type: "income",
      currency: baseCurrency,
      date: new Date(now.getTime() - (30 + i * 15) * 24 * 60 * 60 * 1000),
      description: `${cat.label} — ${cat.label === "Salaire" ? "Bulletin de paie" : "Paiement"}`,
    });
  }

  // 15 dépenses
  for (let i = 0; i < 15; i++) {
    const cat = expenseCats[i % expenseCats.length];
    transactions.push({
      userId: user.id,
      accountId: account.id,
      categoryId: cat.id,
      amount: Math.round(20 + Math.random() * 280),
      type: "expense",
      currency: baseCurrency,
      date: new Date(now.getTime() - i * 2 * 24 * 60 * 60 * 1000),
      description: `${cat.label} — achat`,
    });
  }

  await prisma.transaction.createMany({ data: transactions });

  logger.info(`[SEED] ✅ Utilisateur Démo créé : ${email} / mot de passe : demopassword`);
  logger.info(`[SEED] ✅ ${transactions.length} transactions générées.`);
}

main()
  .catch((e) => {
    logger.error("[SEED]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
