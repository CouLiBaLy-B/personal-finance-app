/**
 * Prisma seed — creates a demo user with 6 months of realistic data.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { addDays, startOfMonth, subMonths } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const email = "demo@fintrack.app";
  const password = "demo1234";
  const passwordHash = await bcrypt.hash(password, 10);

  // Upsert demo user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      fullName: "Camille Martin",
      baseCurrency: "EUR",
    },
  });

  // Categories
  const catData = [
    { label: "Alimentation", color: "#22c55e", icon: "🛒", kind: "expense" },
    { label: "Logement", color: "#3b82f6", icon: "🏠", kind: "expense" },
    { label: "Transport", color: "#f59e0b", icon: "🚗", kind: "expense" },
    { label: "Loisirs", color: "#a855f7", icon: "🎬", kind: "expense" },
    { label: "Santé", color: "#ef4444", icon: "💊", kind: "expense" },
    { label: "Abonnements", color: "#06b6d4", icon: "📺", kind: "expense" },
    { label: "Restaurants", color: "#ec4899", icon: "🍽️", kind: "expense" },
    { label: "Shopping", color: "#8b5cf6", icon: "🛍️", kind: "expense" },
    { label: "Voyages", color: "#0ea5e9", icon: "✈️", kind: "expense" },
    { label: "Salaire", color: "#10b981", icon: "💼", kind: "income" },
    { label: "Freelance", color: "#0ea5e9", icon: "💻", kind: "income" },
    { label: "Cadeaux", color: "#f43f5e", icon: "🎁", kind: "income" },
    { label: "Investissements", color: "#eab308", icon: "📈", kind: "income" },
  ];

  for (const c of catData) {
    await prisma.category.upsert({
      where: { userId_label: { userId: user.id, label: c.label } },
      update: {},
      create: { userId: user.id, ...c },
    });
  }

  const cats = await prisma.category.findMany({ where: { userId: user.id } });
  const cat = (label: string) => cats.find((c) => c.label === label)!.id;

  // Accounts
  const accData = [
    { name: "Compte courant", type: "checking", currency: "EUR", initialBalance: 1850 },
    { name: "Livret A", type: "saving", currency: "EUR", initialBalance: 8500 },
    { name: "Espèces", type: "cash", currency: "EUR", initialBalance: 120 },
    { name: "Carte Voyage", type: "card", currency: "USD", initialBalance: 320 },
  ];

  for (const a of accData) {
    await prisma.account.upsert({
      where: { userId_name: { userId: user.id, name: a.name } },
      update: {},
      create: { userId: user.id, ...a, currentBalance: a.initialBalance },
    });
  }

  const accounts = await prisma.account.findMany({ where: { userId: user.id } });
  const acc = (name: string) => accounts.find((a) => a.name === name)!.id;
  const checking = acc("Compte courant");

  // Generate 6 months of transactions
  const today = new Date();

  for (let m = 5; m >= 0; m--) {
    const ms = startOfMonth(subMonths(today, m));

    // Salary
    await createTx(user.id, checking, cat("Salaire"), 2850, "income", "EUR", addDays(ms, 0), "Salaire mensuel");

    // Rent
    await createTx(user.id, checking, cat("Logement"), 950, "expense", "EUR", addDays(ms, 2), "Loyer + charges");

    // Subscriptions
    const subs = [
      { name: "Netflix", amount: 13.49, day: 5 },
      { name: "Spotify", amount: 9.99, day: 7 },
      { name: "Forfait mobile", amount: 19.99, day: 10 },
      { name: "Internet Free", amount: 29.99, day: 12 },
    ];
    for (const s of subs) {
      await createTx(user.id, checking, cat("Abonnements"), s.amount, "expense", "EUR", addDays(ms, s.day), s.name);
    }

    // Groceries
    for (let i = 0; i < 4; i++) {
      const groceries = ["Carrefour", "Monoprix", "Lidl", "Marché"];
      await createTx(user.id, checking, cat("Alimentation"), 55 + Math.floor(Math.random() * 70), "expense", "EUR", addDays(ms, 4 + i * 7), groceries[i]);
    }

    // Restaurants
    for (let i = 0; i < 3; i++) {
      const restos = ["Sushi shop", "Burger King", "Brasserie du coin"];
      await createTx(user.id, checking, cat("Restaurants"), 18 + Math.floor(Math.random() * 35), "expense", "EUR", addDays(ms, 8 + i * 9), restos[i]);
    }

    // Transport
    await createTx(user.id, checking, cat("Transport"), 75, "expense", "EUR", addDays(ms, 6), "Abonnement Navigo");
    await createTx(user.id, checking, cat("Transport"), 45, "expense", "EUR", addDays(ms, 18), "Essence");

    // Savings transfer
    await createTx(user.id, acc("Livret A"), cat("Investissements"), 300, "income", "EUR", addDays(ms, 25), "Virement vers épargne");
  }

  // Goals
  await prisma.goal.upsert({
    where: { id: "goal-vacation" },
    update: {},
    create: { id: "goal-vacation", userId: user.id, label: "Vacances été 2026", targetAmount: 2000, currentAmount: 850, targetDate: addDays(today, 180), color: "#0ea5e9", icon: "🏖️" },
  });

  await prisma.goal.upsert({
    where: { id: "goal-laptop" },
    update: {},
    create: { id: "goal-laptop", userId: user.id, label: "MacBook Pro", targetAmount: 2500, currentAmount: 1200, targetDate: addDays(today, 120), color: "#8b5cf6", icon: "💻" },
  });

  // Current month budgets
  const currentMonth = today.toISOString().slice(0, 7);
  const year = today.getFullYear();
  const budgetData = [
    { catLabel: "Alimentation", limit: 400 },
    { catLabel: "Restaurants", limit: 150 },
    { catLabel: "Loisirs", limit: 100 },
    { catLabel: "Transport", limit: 130 },
    { catLabel: "Shopping", limit: 200 },
  ];

  for (const b of budgetData) {
    const catId = cat(b.catLabel);
    await prisma.budget.upsert({
      where: { userId_categoryId_month: { userId: user.id, categoryId: catId, month: currentMonth } },
      update: {},
      create: { userId: user.id, categoryId: catId, month: currentMonth, year, limit: b.limit, alertThreshold: 80 },
    });
  }

  console.log("✅ Seed complete!");
  console.log(`   📧 Email: ${email}`);
  console.log(`   🔑 Password: ${password}`);
}

async function createTx(
  userId: string, accountId: string, categoryId: string,
  amount: number, type: string, currency: string,
  date: Date, description: string
) {
  await prisma.transaction.create({
    data: { userId, accountId, categoryId, amount, type, currency, date, description },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
