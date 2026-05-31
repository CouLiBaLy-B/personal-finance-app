import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { logger } from "./logger";

/**
 * Crée un jeu de catégories par défaut et un compte courant
 * dès l'inscription d'un utilisateur. Sans ça, l'UI reste vide
 * et l'expérience utilisateur est moins bonne.
 */
export async function seedDefaultCategories(
  prisma: PrismaClient,
  userId: string,
  baseCurrency: string
) {
  const now = new Date();
  const uid = () => uuidv4();

  // 1 compte courant par défaut
  const existing = await prisma.account.count({ where: { userId } });
  if (existing === 0) {
    await prisma.account.create({
      data: {
        id: uid(),
        userId,
        name: "Compte courant",
        type: "checking",
        currency: baseCurrency,
        initialBalance: 0,
      },
    });
  }

  const existingCats = await prisma.category.count({ where: { userId } });
  if (existingCats > 0) return;

  const expenseCats = [
    { label: "Alimentation", color: "#22c55e", icon: "🛒" },
    { label: "Logement", color: "#3b82f6", icon: "🏠" },
    { label: "Transport", color: "#f59e0b", icon: "🚗" },
    { label: "Loisirs", color: "#a855f7", icon: "🎬" },
    { label: "Santé", color: "#ef4444", icon: "💊" },
    { label: "Abonnements", color: "#06b6d4", icon: "📺" },
    { label: "Restaurants", color: "#ec4899", icon: "🍽️" },
    { label: "Shopping", color: "#8b5cf6", icon: "🛍️" },
  ];

  const incomeCats = [
    { label: "Salaire", color: "#10b981", icon: "💼" },
    { label: "Freelance", color: "#0ea5e9", icon: "💻" },
    { label: "Cadeaux", color: "#f43f5e", icon: "🎁" },
    { label: "Investissements", color: "#eab308", icon: "📈" },
  ];

  await prisma.category.createMany({
    data: [
      ...expenseCats.map((c) => ({
        id: uid(),
        userId,
        label: c.label,
        color: c.color,
        icon: c.icon,
        kind: "expense",
        parentId: null as string | null,
      })),
      ...incomeCats.map((c) => ({
        id: uid(),
        userId,
        label: c.label,
        color: c.color,
        icon: c.icon,
        kind: "income",
        parentId: null as string | null,
      })),
    ],
  });

  logger.info(`[SEED] Catégories + compte courant créés pour userId=${userId}`);
}
