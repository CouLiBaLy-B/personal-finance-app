/**
 * Category controller — CRUD + tree view.
 */
import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

/** GET /categories */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const kind = req.query.kind as string | undefined;
    const categories = await prisma.category.findMany({
      where: {
        userId: req.userId!,
        deletedAt: null,
        ...(kind && { kind }),
      },
      orderBy: { label: "asc" },
    });
    res.json(categories);
  } catch (err) { next(err); }
}

/** GET /categories/tree */
export async function tree(req: Request, res: Response, next: NextFunction) {
  try {
    const all = await prisma.category.findMany({
      where: { userId: req.userId!, deletedAt: null },
      orderBy: { label: "asc" },
    });

    const roots = all.filter((c) => !c.parentId);
    const buildTree = (parent: typeof roots[0]): any => ({
      ...parent,
      children: all.filter((c) => c.parentId === parent.id).map(buildTree),
    });

    res.json(roots.map(buildTree));
  } catch (err) { next(err); }
}

/** GET /categories/:id */
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const cat = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
      include: { children: true },
    });
    if (!cat) throw new AppError("Catégorie introuvable.", 404);
    res.json(cat);
  } catch (err) { next(err); }
}

/** POST /categories */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { label, kind, color, icon, parentId } = req.body;
    const cat = await prisma.category.create({
      data: { userId: req.userId!, label, kind, color, icon, parentId },
    });
    res.status(201).json(cat);
  } catch (err) { next(err); }
}

/** PUT /categories/:id */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Catégorie introuvable.", 404);

    const cat = await prisma.category.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(cat);
  } catch (err) { next(err); }
}

/** DELETE /categories/:id */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new AppError("Catégorie introuvable.", 404);

    // Check if category has transactions
    const txCount = await prisma.transaction.count({
      where: { categoryId: req.params.id, deletedAt: null },
    });
    if (txCount > 0) {
      throw new AppError(
        `Impossible de supprimer : ${txCount} transaction(s) utilisent cette catégorie.`,
        409
      );
    }

    await prisma.category.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    res.json({ message: "Catégorie supprimée." });
  } catch (err) { next(err); }
}
