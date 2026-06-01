/**
 * Transaction controller — CRUD + import CSV + export.
 */
import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { toNumber, parsePagination } from "../utils/index.js";
import { AppError } from "../middleware/errorHandler.js";
import Papa from "papaparse";
import fs from "fs";

/** GET /transactions */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { skip, take } = parsePagination(req.query as Record<string, unknown>);
    const accountId = req.query.accountId as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const type = req.query.type as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = { userId: req.userId!, deletedAt: null };
    if (accountId) where.accountId = accountId;
    if (categoryId) where.categoryId = categoryId;
    if (type) where.type = type;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    if (search) {
      where.description = { contains: search, mode: "insensitive" };
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { account: { select: { name: true, currency: true } }, category: { select: { label: true, color: true, icon: true } } },
        orderBy: { date: "desc" },
        skip,
        take,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      data: transactions.map((t) => ({ ...t, amount: toNumber(t.amount) })),
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    });
  } catch (err) { next(err); }
}

/** GET /transactions/:id */
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const tx = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
      include: { account: true, category: true },
    });
    if (!tx) throw new AppError("Transaction introuvable.", 404);
    res.json({ ...tx, amount: toNumber(tx.amount) });
  } catch (err) { next(err); }
}

/** POST /transactions */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { accountId, categoryId, amount, type, currency, date, description, notes, recurringId, goalId } = req.body;

    const tx = await prisma.transaction.create({
      data: {
        userId: req.userId!,
        accountId,
        categoryId,
        amount,
        type,
        currency,
        date: new Date(date),
        description,
        notes,
        recurringId,
        goalId,
      },
    });

    // Atomic increment goal currentAmount if linked
    if (goalId && (type === "income" || type === "transfer")) {
      await prisma.goal.update({
        where: { id: goalId },
        data: { currentAmount: { increment: amount } },
      }).catch(() => {}); // Goal may not exist — non-blocking
    }

    res.status(201).json({ ...tx, amount: toNumber(tx.amount) });
  } catch (err) { next(err); }
}

/** PUT /transactions/:id */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Transaction introuvable.", 404);

    const data: any = { ...req.body };
    if (data.date) data.date = new Date(data.date);

    const tx = await prisma.transaction.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ ...tx, amount: toNumber(tx.amount) });
  } catch (err) { next(err); }
}

/** DELETE /transactions/:id */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Transaction introuvable.", 404);

    await prisma.transaction.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ message: "Transaction supprimée." });
  } catch (err) { next(err); }
}

/** POST /transactions/import — CSV import */
export async function importCsv(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError("Fichier CSV requis.", 400);

    const content = fs.readFileSync(req.file.path, "utf-8");
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });

    if (parsed.errors.length > 0) {
      throw new AppError(`Erreur CSV: ${parsed.errors[0].message}`, 400);
    }

    const rows = parsed.data as Record<string, string>[];
    let inserted = 0;

    for (const row of rows) {
      try {
        await prisma.transaction.create({
          data: {
            userId: req.userId!,
            accountId: row.accountId || "",
            categoryId: row.categoryId || null,
            amount: parseFloat(row.amount) || 0,
            type: (row.type as "expense" | "income" | "transfer") || "expense",
            currency: row.currency || "EUR",
            date: new Date(row.date),
            description: row.description || "",
          },
        });
        inserted++;
      } catch { /* skip invalid rows */ }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ inserted, total: rows.length, skipped: rows.length - inserted });
  } catch (err) { next(err); }
}

/** GET /transactions/export — CSV export */
export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const txs = await prisma.transaction.findMany({
      where: { userId: req.userId!, deletedAt: null },
      include: { account: { select: { name: true } }, category: { select: { label: true } } },
      orderBy: { date: "desc" },
    });

    const rows = txs.map((t) => ({
      date: t.date.toISOString().slice(0, 10),
      type: t.type,
      amount: toNumber(t.amount),
      currency: t.currency,
      account: t.account?.name ?? "",
      category: t.category?.label ?? "",
      description: t.description ?? "",
    }));

    const csv = Papa.unparse(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=fintrack-export-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) { next(err); }
}
