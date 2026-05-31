// ===========================================
// FinTrack Backend - Prisma Seed
// Initializes the database with default data
// ===========================================

import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Default categories for expenses
const expenseCategories = [
  { label: "Alimentation", color: "#22c55e", icon: "🛒" },
  { label: "Logement", color: "#3b82f6", icon: "🏠" },
  { label: "Transport", color: "#f59e0b", icon: "🚗" },
  { label: "Loisirs", color: "#a855f7", icon: "🎬" },
  { label: "Santé", color: "#ef4444", icon: "💊" },
  { label: "Abonnements", color: "#06b6d4", icon: "📺" },
  { label: "Restaurants", color: "#ec4899", icon: "🍽️" },
  { label: "Shopping", color: "#8b5cf6", icon: "🛍️" },
  { label: "Voyages", color: "#eab308", icon: "✈️" },
  { label: "Éducation", color: "#1e40af", icon: "📚" },
];

// Default categories for income
const incomeCategories = [
  { label: "Salaire", color: "#10b981", icon: "💼" },
  { label: "Freelance", color: "#0ea5e9", icon: "💻" },
  { label: "Cadeaux", color: "#f43f5e", icon: "🎁" },
  { label: "Investissements", color: "#eab308", icon: "📈" },
  { label: "Loyers", color: "#7c3aed", icon: "🏢" },
  { label: "Autres revenus", color: "#64748b", icon: "💰" },
];

async function main() {
  console.log("Start seeding...");

  // Create default user if not exists
  const email = "demo@fintrack.com";
  const password = "demo123";
  const passwordHash = await bcrypt.hash(password, 10);

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: "Demo User",
        baseCurrency: "EUR",
        isVerified: true,
      },
    });
    console.log(`Created user: ${user.email}`);
  } else {
    console.log(`User ${user.email} already exists`);
  }

  // Create default accounts for the user
  const checkingAccount = await prisma.account.findFirst({
    where: { userId: user.id, type: "checking" },
  });

  if (!checkingAccount) {
    await prisma.account.create({
      data: {
        userId: user.id,
        name: "Compte courant",
        type: "checking",
        currency: "EUR",
        initialBalance: 1000,
        currentBalance: 1000,
        color: "#0ea5e9",
        icon: "💳",
      },
    });
    console.log("Created checking account");
  }

  const savingAccount = await prisma.account.findFirst({
    where: { userId: user.id, type: "saving" },
  });

  if (!savingAccount) {
    await prisma.account.create({
      data: {
        userId: user.id,
        name: "Livret A",
        type: "saving",
        currency: "EUR",
        initialBalance: 500,
        currentBalance: 500,
        color: "#10b981",
        icon: "🏦",
      },
    });
    console.log("Created saving account");
  }

  // Create default categories for the user
  for (const cat of expenseCategories) {
    const existing = await prisma.category.findFirst({
      where: { userId: user.id, label: cat.label },
    });

    if (!existing) {
      await prisma.category.create({
        data: {
          userId: user.id,
          label: cat.label,
          kind: "expense",
          color: cat.color,
          icon: cat.icon,
        },
      });
    }
  }

  for (const cat of incomeCategories) {
    const existing = await prisma.category.findFirst({
      where: { userId: user.id, label: cat.label },
    });

    if (!existing) {
      await prisma.category.create({
        data: {
          userId: user.id,
          label: cat.label,
          kind: "income",
          color: cat.color,
          icon: cat.icon,
        },
      });
    }
  }

  console.log("Created default categories");

  // Create some sample transactions
  const alimentationCat = await prisma.category.findFirst({
    where: { userId: user.id, label: "Alimentation" },
  });

  const transportCat = await prisma.category.findFirst({
    where: { userId: user.id, label: "Transport" },
  });

  const salaireCat = await prisma.category.findFirst({
    where: { userId: user.id, label: "Salaire" },
  });

  if (alimentationCat && transportCat && salaireCat && checkingAccount) {
    const sampleTransactions = [
      {
        userId: user.id,
        accountId: checkingAccount.id,
        categoryId: alimentationCat.id,
        amount: 150.5,
        type: "expense" as const,
        currency: "EUR",
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        description: "Courses Carrefour",
      },
      {
        userId: user.id,
        accountId: checkingAccount.id,
        categoryId: transportCat.id,
        amount: 45.0,
        type: "expense" as const,
        currency: "EUR",
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        description: "Essence Total",
      },
      {
        userId: user.id,
        accountId: checkingAccount.id,
        categoryId: salaireCat.id,
        amount: 2500.0,
        type: "income" as const,
        currency: "EUR",
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        description: "Salaire mensuel",
      },
    ];

    for (const tx of sampleTransactions) {
      const existing = await prisma.transaction.findFirst({
        where: {
          userId: tx.userId,
          description: tx.description,
          date: tx.date,
        },
      });

      if (!existing) {
        await prisma.transaction.create({
          data: tx,
        });
      }
    }

    console.log("Created sample transactions");
  }

  // Create a sample goal
  const sampleGoal = await prisma.goal.findFirst({
    where: { userId: user.id, label: "Voyage été" },
  });

  if (!sampleGoal) {
    await prisma.goal.create({
      data: {
        userId: user.id,
        label: "Voyage été",
        description: "Voyage en Grèce pour l'été 2026",
        targetAmount: 3000,
        currentAmount: 500,
        targetDate: new Date(2026, 6, 15), // July 15, 2026
        color: "#f59e0b",
        icon: "✈️",
      },
    });
    console.log("Created sample goal");
  }

  // Create a sample budget
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const sampleBudget = await prisma.budget.findFirst({
    where: {
      userId: user.id,
      categoryId: alimentationCat?.id,
      month: currentMonth,
    },
  });

  if (!sampleBudget && alimentationCat) {
    await prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: alimentationCat.id,
        month: currentMonth,
        year: now.getFullYear(),
        limit: 400,
        alertThreshold: 80,
      },
    });
    console.log("Created sample budget");
  }

  console.log("Seeding finished.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
