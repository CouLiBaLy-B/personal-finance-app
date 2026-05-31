/**
 * Génère un compte de démonstration entièrement peuplé :
 *  - Plusieurs comptes (courant, épargne, espèces, carte)
 *  - Catégories enrichies
 *  - ~6 mois de transactions réalistes
 *  - Budgets mensuels
 *  - Objectifs d'épargne
 *  - Transactions récurrentes (salaire, abonnements, loyer)
 */

import { addDays, startOfMonth, subMonths } from "date-fns";
import bcrypt from "bcryptjs";
import { db, uid } from "../db/database";

const DEMO_EMAIL = "demo@fintrack.app";
const DEMO_PASSWORD = "demo1234";

export async function ensureDemoAccount(): Promise<{ email: string; password: string }> {
  // Si déjà créé, on retourne juste les identifiants
  const existing = await db.users.where("email").equals(DEMO_EMAIL).first();
  if (existing) return { email: DEMO_EMAIL, password: DEMO_PASSWORD };

  const userId = uid();
  const now = Date.now();

  const user = {
    id: userId,
    email: DEMO_EMAIL,
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
    fullName: "Camille Martin",
    baseCurrency: "EUR",
    createdAt: now,
  };
  await db.users.add(user);

  // --- Comptes ---
  const accChecking = uid();
  const accSaving = uid();
  const accCash = uid();
  const accCard = uid();
  await db.accounts.bulkAdd([
    { id: accChecking, userId, name: "Compte courant", type: "checking", currency: "EUR", initialBalance: 1850, createdAt: now },
    { id: accSaving, userId, name: "Livret A", type: "saving", currency: "EUR", initialBalance: 8500, createdAt: now },
    { id: accCash, userId, name: "Espèces", type: "cash", currency: "EUR", initialBalance: 120, createdAt: now },
    { id: accCard, userId, name: "Carte Voyage", type: "card", currency: "USD", initialBalance: 320, createdAt: now },
  ]);

  // --- Catégories ---
  type CatSpec = { id: string; label: string; color: string; icon: string; kind: "expense" | "income" };
  const expCats: CatSpec[] = [
    { id: uid(), label: "Alimentation", color: "#22c55e", icon: "🛒", kind: "expense" },
    { id: uid(), label: "Logement", color: "#3b82f6", icon: "🏠", kind: "expense" },
    { id: uid(), label: "Transport", color: "#f59e0b", icon: "🚗", kind: "expense" },
    { id: uid(), label: "Loisirs", color: "#a855f7", icon: "🎬", kind: "expense" },
    { id: uid(), label: "Santé", color: "#ef4444", icon: "💊", kind: "expense" },
    { id: uid(), label: "Abonnements", color: "#06b6d4", icon: "📺", kind: "expense" },
    { id: uid(), label: "Restaurants", color: "#ec4899", icon: "🍽️", kind: "expense" },
    { id: uid(), label: "Shopping", color: "#8b5cf6", icon: "🛍️", kind: "expense" },
    { id: uid(), label: "Voyages", color: "#0ea5e9", icon: "✈️", kind: "expense" },
  ];
  const incCats: CatSpec[] = [
    { id: uid(), label: "Salaire", color: "#10b981", icon: "💼", kind: "income" },
    { id: uid(), label: "Freelance", color: "#0ea5e9", icon: "💻", kind: "income" },
    { id: uid(), label: "Cadeaux", color: "#f43f5e", icon: "🎁", kind: "income" },
    { id: uid(), label: "Investissements", color: "#eab308", icon: "📈", kind: "income" },
  ];
  await db.categories.bulkAdd(
    [...expCats, ...incCats].map((c) => ({
      id: c.id, userId, label: c.label, color: c.color, icon: c.icon, kind: c.kind,
      parentId: null, createdAt: now,
    }))
  );

  const cat = (label: string) => [...expCats, ...incCats].find((c) => c.label === label)!.id;

  // --- Transactions sur 6 mois ---
  const txs: Array<{
    id: string; userId: string; accountId: string; categoryId: string;
    amount: number; type: "income" | "expense"; currency: string; date: number;
    description: string; createdAt: number;
  }> = [];

  const today = new Date();
  for (let m = 5; m >= 0; m--) {
    const monthStart = startOfMonth(subMonths(today, m));

    // Salaire le 1
    txs.push({
      id: uid(), userId, accountId: accChecking, categoryId: cat("Salaire"),
      amount: 2850, type: "income", currency: "EUR",
      date: addDays(monthStart, 0).getTime(),
      description: "Salaire mensuel", createdAt: now,
    });
    // Freelance occasionnel
    if (m % 2 === 0) {
      txs.push({
        id: uid(), userId, accountId: accChecking, categoryId: cat("Freelance"),
        amount: 450 + Math.floor(Math.random() * 300), type: "income", currency: "EUR",
        date: addDays(monthStart, 12).getTime(),
        description: "Mission freelance", createdAt: now,
      });
    }
    // Loyer le 3
    txs.push({
      id: uid(), userId, accountId: accChecking, categoryId: cat("Logement"),
      amount: 950, type: "expense", currency: "EUR",
      date: addDays(monthStart, 2).getTime(),
      description: "Loyer + charges", createdAt: now,
    });
    // Abonnements
    [
      { name: "Netflix", amount: 13.49, day: 5 },
      { name: "Spotify", amount: 9.99, day: 7 },
      { name: "Forfait mobile", amount: 19.99, day: 10 },
      { name: "Internet Free", amount: 29.99, day: 12 },
    ].forEach((s) => {
      txs.push({
        id: uid(), userId, accountId: accChecking, categoryId: cat("Abonnements"),
        amount: s.amount, type: "expense", currency: "EUR",
        date: addDays(monthStart, s.day).getTime(),
        description: s.name, createdAt: now,
      });
    });
    // Courses (4 par mois)
    for (let i = 0; i < 4; i++) {
      txs.push({
        id: uid(), userId, accountId: accChecking, categoryId: cat("Alimentation"),
        amount: 55 + Math.floor(Math.random() * 70), type: "expense", currency: "EUR",
        date: addDays(monthStart, 4 + i * 7).getTime(),
        description: ["Carrefour", "Monoprix", "Lidl", "Marché"][i], createdAt: now,
      });
    }
    // Restos (3 par mois)
    for (let i = 0; i < 3; i++) {
      txs.push({
        id: uid(), userId, accountId: accChecking, categoryId: cat("Restaurants"),
        amount: 18 + Math.floor(Math.random() * 35), type: "expense", currency: "EUR",
        date: addDays(monthStart, 8 + i * 9).getTime(),
        description: ["Sushi shop", "Burger King", "Brasserie du coin"][i], createdAt: now,
      });
    }
    // Transport
    txs.push({
      id: uid(), userId, accountId: accChecking, categoryId: cat("Transport"),
      amount: 75, type: "expense", currency: "EUR",
      date: addDays(monthStart, 6).getTime(),
      description: "Abonnement Navigo", createdAt: now,
    });
    txs.push({
      id: uid(), userId, accountId: accChecking, categoryId: cat("Transport"),
      amount: 45, type: "expense", currency: "EUR",
      date: addDays(monthStart, 18).getTime(),
      description: "Essence", createdAt: now,
    });
    // Loisirs
    if (Math.random() > 0.3) {
      txs.push({
        id: uid(), userId, accountId: accChecking, categoryId: cat("Loisirs"),
        amount: 22 + Math.floor(Math.random() * 60), type: "expense", currency: "EUR",
        date: addDays(monthStart, 14).getTime(),
        description: "Cinéma / Sortie", createdAt: now,
      });
    }
    // Shopping occasionnel
    if (m === 1 || m === 3) {
      txs.push({
        id: uid(), userId, accountId: accCard, categoryId: cat("Shopping"),
        amount: 120 + Math.floor(Math.random() * 80), type: "expense", currency: "USD",
        date: addDays(monthStart, 20).getTime(),
        description: "Achat en ligne (USD)", createdAt: now,
      });
    }
    // Santé
    if (m === 2 || m === 4) {
      txs.push({
        id: uid(), userId, accountId: accChecking, categoryId: cat("Santé"),
        amount: 35, type: "expense", currency: "EUR",
        date: addDays(monthStart, 16).getTime(),
        description: "Consultation médecin", createdAt: now,
      });
    }
    // Voyage 1 fois
    if (m === 2) {
      txs.push({
        id: uid(), userId, accountId: accChecking, categoryId: cat("Voyages"),
        amount: 380, type: "expense", currency: "EUR",
        date: addDays(monthStart, 22).getTime(),
        description: "Weekend Lisbonne", createdAt: now,
      });
    }
    // Virement mensuel vers épargne (modélisé comme dépense compte courant + revenu épargne)
    txs.push({
      id: uid(), userId, accountId: accSaving, categoryId: cat("Investissements"),
      amount: 300, type: "income", currency: "EUR",
      date: addDays(monthStart, 25).getTime(),
      description: "Virement vers épargne", createdAt: now,
    });
  }
  await db.transactions.bulkAdd(txs);

  // --- Budgets du mois courant ---
  const currentMonth = today.toISOString().slice(0, 7);
  await db.budgets.bulkAdd([
    { id: uid(), userId, categoryId: cat("Alimentation"), limit: 400, month: currentMonth, alertThreshold: 80, createdAt: now },
    { id: uid(), userId, categoryId: cat("Restaurants"), limit: 150, month: currentMonth, alertThreshold: 75, createdAt: now },
    { id: uid(), userId, categoryId: cat("Loisirs"), limit: 100, month: currentMonth, alertThreshold: 80, createdAt: now },
    { id: uid(), userId, categoryId: cat("Transport"), limit: 130, month: currentMonth, alertThreshold: 80, createdAt: now },
    { id: uid(), userId, categoryId: cat("Shopping"), limit: 200, month: currentMonth, alertThreshold: 80, createdAt: now },
  ]);

  // --- Objectifs ---
  await db.goals.bulkAdd([
    {
      id: uid(), userId, label: "Vacances été 2026", targetAmount: 2000, currentAmount: 850,
      targetDate: addDays(today, 180).getTime(), color: "#0ea5e9", icon: "🏖️", createdAt: now,
    },
    {
      id: uid(), userId, label: "MacBook Pro", targetAmount: 2500, currentAmount: 1200,
      targetDate: addDays(today, 120).getTime(), color: "#8b5cf6", icon: "💻", createdAt: now,
    },
    {
      id: uid(), userId, label: "Apport immobilier", targetAmount: 25000, currentAmount: 8500,
      targetDate: addDays(today, 720).getTime(), color: "#10b981", icon: "🏠", createdAt: now,
    },
  ]);

  // --- Récurrentes ---
  await db.recurring.bulkAdd([
    {
      id: uid(), userId, accountId: accChecking, categoryId: cat("Salaire"),
      amount: 2850, type: "income", currency: "EUR",
      description: "Salaire mensuel", frequency: "monthly",
      nextDate: addDays(startOfMonth(addDays(today, 32)), 0).getTime(),
      createdAt: now,
    },
    {
      id: uid(), userId, accountId: accChecking, categoryId: cat("Logement"),
      amount: 950, type: "expense", currency: "EUR",
      description: "Loyer", frequency: "monthly",
      nextDate: addDays(startOfMonth(addDays(today, 32)), 2).getTime(),
      createdAt: now,
    },
    {
      id: uid(), userId, accountId: accChecking, categoryId: cat("Abonnements"),
      amount: 13.49, type: "expense", currency: "EUR",
      description: "Netflix", frequency: "monthly",
      nextDate: addDays(startOfMonth(addDays(today, 32)), 5).getTime(),
      createdAt: now,
    },
    {
      id: uid(), userId, accountId: accChecking, categoryId: cat("Abonnements"),
      amount: 9.99, type: "expense", currency: "EUR",
      description: "Spotify", frequency: "monthly",
      nextDate: addDays(startOfMonth(addDays(today, 32)), 7).getTime(),
      createdAt: now,
    },
  ]);

  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
}
