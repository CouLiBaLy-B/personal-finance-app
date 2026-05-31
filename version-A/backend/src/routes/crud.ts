import { Router, Request, Response } from "express";
import { PrismaClient, User } from "@prisma/client";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";

// ============================================================
// Routes génériques CRUD pour les entités métier.
// Toutes les routes nécessitent un token Bearer JWT valide.
// ============================================================

const uid = () => uuidv4();

// ---------- Schemas Zod ----------
const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["checking", "saving", "cash", "card"]),
  currency: z.string().length(3),
  initialBalance: z.number().default(0),
});

const categorySchema = z.object({
  label: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string(),
  kind: z.enum(["expense", "income"]),
  parentId: z.string().optional().nullable(),
});

const transactionSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["expense", "income", "transfer"]),
  currency: z.string().length(3),
  date: z.coerce.date(),
  description: z.string().min(1),
  recurringId: z.string().optional().nullable(),
  goalId: z.string().optional().nullable(),
});

const budgetSchema = z.object({
  categoryId: z.string().min(1),
  limit: z.number().positive(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  alertThreshold: z.number().min(0).max(100).default(80),
});

const goalSchema = z.object({
  label: z.string().min(1),
  targetAmount: z.number().positive(),
  currentAmount: z.number().default(0),
  targetDate: z.coerce.date(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string(),
});

const recurringSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["expense", "income"]),
  currency: z.string().length(3),
  description: z.string().min(1),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  nextDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
});

// ---------- Helper : réponse uniforme ----------
function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json(data);
}
function safeLimit(val: unknown): number {
  const n = parseInt(String(val ?? "500"), 10);
  return isNaN(n) || n <= 0 ? 500 : Math.min(500, n);
}

function fail(res: Response, status: number, message: string, err?: unknown): void {
  logger.warn(`[CRUD][${res.statusCode ?? status}] ${message}`, err);
  res.status(status).json({ error: message, details: err instanceof Error ? err.message : undefined });
}

export default function crudRoutes(prisma: PrismaClient): Router {
  const router = Router();
  router.use(requireAuth(prisma));

  function userId(req: Request): string {
    return (req.user as User).id;
  }

  // ================ COMPTES ================
  router.get("/accounts", async (req, res) => {
    const accounts = await prisma.account.findMany({ where: { userId: userId(req) } });
    ok(res, accounts);
  });

  router.post("/accounts", async (req, res) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Données invalides", parsed.error);
    const account = await prisma.account.create({
      data: { id: uid(), userId: userId(req), ...parsed.data },
    });
    ok(res, account, 201);
  });

  router.put("/accounts/:id", async (req, res) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Données invalides", parsed.error);
    try {
      const account = await prisma.account.update({
        where: { id: req.params.id, userId: userId(req) },
        data: parsed.data,
      });
      ok(res, account);
    } catch {
      fail(res, 404, "Compte introuvable");
    }
  });

  router.delete("/accounts/:id", async (req, res) => {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { accountId: req.params.id, userId: userId(req) } });
      await tx.account.delete({ where: { id: req.params.id, userId: userId(req) } });
    });
    ok(res, { success: true });
  });

  // ================ CATEGORIES ================
  router.get("/categories", async (req, res) => {
    const categories = await prisma.category.findMany({ where: { userId: userId(req) } });
    ok(res, categories);
  });
  router.post("/categories", async (req, res) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Données invalides", parsed.error);
    const category = await prisma.category.create({
      data: { id: uid(), userId: userId(req), ...parsed.data },
    });
    ok(res, category, 201);
  });
  router.delete("/categories/:id", async (req, res) => {
    try {
      await prisma.category.delete({ where: { id: req.params.id, userId: userId(req) } });
      ok(res, { success: true });
    } catch {
      fail(res, 404, "Catégorie introuvable");
    }
  });

  // ================ TRANSACTIONS ================
  router.get("/transactions", async (req, res) => {
    const transactions = await prisma.transaction.findMany({
      where: { userId: userId(req) },
      orderBy: { date: "desc" },
      take: safeLimit(req.query.limit as string),
    });
    ok(res, transactions);
  });
  router.post("/transactions", async (req, res) => {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Données invalides", parsed.error);
    const t = await prisma.transaction.create({
      data: { id: uid(), userId: userId(req), ...parsed.data },
    });
    ok(res, t, 201);
  });
  router.put("/transactions/:id", async (req, res) => {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Données invalides", parsed.error);
    try {
      const t = await prisma.transaction.update({
        where: { id: req.params.id, userId: userId(req) },
        data: parsed.data,
      });
      ok(res, t);
    } catch {
      fail(res, 404, "Transaction introuvable");
    }
  });
  router.delete("/transactions/:id", async (req, res) => {
    try {
      await prisma.transaction.delete({ where: { id: req.params.id, userId: userId(req) } });
      ok(res, { success: true });
    } catch {
      fail(res, 404, "Transaction introuvable");
    }
  });

  // ================ BUDGETS ================
  router.get("/budgets", async (req, res) => {
    ok(res, await prisma.budget.findMany({ where: { userId: userId(req) } }));
  });
  router.post("/budgets", async (req, res) => {
    const parsed = budgetSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Données invalides", parsed.error);
    const existing = await prisma.budget.findUnique({
      where: {
        userId_categoryId_month: { userId: userId(req), categoryId: parsed.data.categoryId, month: parsed.data.month },
      },
    });
    if (existing) return fail(res, 409, "Un budget existe déjà pour cette catégorie ce mois-ci");
    const budget = await prisma.budget.create({
      data: { id: uid(), userId: userId(req), ...parsed.data },
    });
    ok(res, budget, 201);
  });
  router.put("/budgets/:id", async (req, res) => {
    const parsed = budgetSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Données invalides", parsed.error);
    try {
      const budget = await prisma.budget.update({
        where: { id: req.params.id, userId: userId(req) },
        data: parsed.data,
      });
      ok(res, budget);
    } catch {
      fail(res, 404, "Budget introuvable");
    }
  });
  router.delete("/budgets/:id", async (req, res) => {
    try {
      await prisma.budget.delete({ where: { id: req.params.id, userId: userId(req) } });
      ok(res, { success: true });
    } catch {
      fail(res, 404, "Budget introuvable");
    }
  });

  // ================ GOALS ================
  router.get("/goals", async (req, res) => {
    ok(res, await prisma.goal.findMany({ where: { userId: userId(req) } }));
  });
  router.post("/goals", async (req, res) => {
    const parsed = goalSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Données invalides", parsed.error);
    const goal = await prisma.goal.create({ data: { id: uid(), userId: userId(req), ...parsed.data } });
    ok(res, goal, 201);
  });
  router.post("/goals/:id/contribute", async (req, res) => {
    const amount = Number(req.body.amount);
    if (isNaN(amount) || amount <= 0) return fail(res, 400, "Montant invalide");
    try {
      const goal = await prisma.goal.update({
        where: { id: req.params.id, userId: userId(req) },
        data: { currentAmount: { increment: amount } },
      });
      ok(res, goal);
    } catch {
      fail(res, 404, "Objectif introuvable");
    }
  });
  router.delete("/goals/:id", async (req, res) => {
    try {
      await prisma.goal.delete({ where: { id: req.params.id, userId: userId(req) } });
      ok(res, { success: true });
    } catch {
      fail(res, 404, "Objectif introuvable");
    }
  });

  // ================ RECURRING ================
  router.get("/recurring", async (req, res) => {
    ok(res, await prisma.recurringTransaction.findMany({ where: { userId: userId(req) } }));
  });
  router.post("/recurring", async (req, res) => {
    const parsed = recurringSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Données invalides", parsed.error);
    const r = await prisma.recurringTransaction.create({
      data: { id: uid(), userId: userId(req), ...parsed.data },
    });
    ok(res, r, 201);
  });
  router.delete("/recurring/:id", async (req, res) => {
    try {
      await prisma.recurringTransaction.delete({ where: { id: req.params.id, userId: userId(req) } });
      ok(res, { success: true });
    } catch {
      fail(res, 404, "Récurrence introuvable");
    }
  });

  return router;
}
