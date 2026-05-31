/**
 * Zod validation schemas + middleware factory.
 */
import { z, type ZodSchema } from "zod";
import type { Request, Response, NextFunction } from "express";

// ============ Middleware factory ============
export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data; // replace with parsed/coerced values
      next();
    } catch (err) {
      next(err); // will be caught by errorHandler
    }
  };
}

// ============ Auth schemas ============
export const registerSchema = z.object({
  email: z.string().email("Email invalide."),
  password: z.string().min(6, "Mot de passe min. 6 caractères."),
  fullName: z.string().min(1, "Nom requis.").optional(),
  baseCurrency: z.string().length(3).default("EUR"),
});

export const loginSchema = z.object({
  email: z.string().email("Email invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

// ============ Account schemas ============
export const accountCreateSchema = z.object({
  name: z.string().min(1, "Nom du compte requis."),
  type: z.enum(["checking", "saving", "cash", "card"]).default("checking"),
  currency: z.string().length(3).default("EUR"),
  initialBalance: z.number().default(0),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const accountUpdateSchema = accountCreateSchema.partial();

// ============ Category schemas ============
export const categoryCreateSchema = z.object({
  label: z.string().min(1, "Libellé requis."),
  kind: z.enum(["expense", "income"]).default("expense"),
  color: z.string().default("#64748b"),
  icon: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const categoryQuerySchema = z.object({
  kind: z.enum(["expense", "income"]).optional(),
}).optional();

// ============ Transaction schemas ============
export const transactionCreateSchema = z.object({
  accountId: z.string().uuid("ID compte invalide."),
  categoryId: z.string().uuid("ID catégorie invalide.").nullable().optional(),
  amount: z.number().positive("Le montant doit être positif."),
  type: z.enum(["expense", "income", "transfer"]).default("expense"),
  currency: z.string().length(3).default("EUR"),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  description: z.string().optional(),
  notes: z.string().optional(),
  recurringId: z.string().uuid().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
});

export const transactionUpdateSchema = transactionCreateSchema.partial();

// ============ Budget schemas ============
export const budgetCreateSchema = z.object({
  categoryId: z.string().uuid("ID catégorie invalide."),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Format YYYY-MM requis."),
  limit: z.number().positive("La limite doit être positive."),
  alertThreshold: z.number().int().min(0).max(100).default(80),
});

export const budgetUpdateSchema = budgetCreateSchema.partial();

// ============ Goal schemas ============
export const goalCreateSchema = z.object({
  label: z.string().min(1, "Libellé requis."),
  description: z.string().optional(),
  targetAmount: z.number().positive("Montant cible positif requis."),
  currentAmount: z.number().min(0).default(0),
  targetDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  color: z.string().default("#0ea5e9"),
  icon: z.string().optional(),
});

export const goalUpdateSchema = goalCreateSchema.partial();

export const goalContributeSchema = z.object({
  amount: z.number().positive("Le montant doit être positif."),
  notes: z.string().optional(),
});

// ============ Recurring schemas ============
export const recurringCreateSchema = z.object({
  accountId: z.string().uuid("ID compte invalide."),
  categoryId: z.string().uuid("ID catégorie invalide."),
  amount: z.number().positive("Le montant doit être positif."),
  type: z.enum(["expense", "income"]).default("expense"),
  currency: z.string().length(3).default("EUR"),
  description: z.string().min(1, "Description requise."),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]),
  interval: z.number().int().min(1).default(1),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  nextDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
});

export const recurringUpdateSchema = recurringCreateSchema.partial();
