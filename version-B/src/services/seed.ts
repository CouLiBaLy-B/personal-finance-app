import { db, uid } from "../db/database";

/**
 * Création d'un set de catégories par défaut et d'un compte courant
 * lors de l'inscription, pour que l'utilisateur ait une expérience
 * immédiatement utilisable.
 */
export async function seedDefaultCategories(userId: string, currency: string) {
  const now = Date.now();

  // Compte courant par défaut
  await db.accounts.add({
    id: uid(),
    userId,
    name: "Compte courant",
    type: "checking",
    currency,
    initialBalance: 0,
    createdAt: now,
  });

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

  await db.categories.bulkAdd([
    ...expenseCats.map((c) => ({
      id: uid(),
      userId,
      label: c.label,
      color: c.color,
      icon: c.icon,
      kind: "expense" as const,
      parentId: null,
      createdAt: now,
    })),
    ...incomeCats.map((c) => ({
      id: uid(),
      userId,
      label: c.label,
      color: c.color,
      icon: c.icon,
      kind: "income" as const,
      parentId: null,
      createdAt: now,
    })),
  ]);
}
