// ===========================================
// FinTrack Backend - Category Controller
// Handles category management
// ===========================================

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { AuthenticationError, NotFoundError, ValidationError } from "../middleware/errorHandler";
import { createCategorySchema, updateCategorySchema, categoryQuerySchema } from "../middleware/validation";
import { getPaginationOptions, paginate } from "../utils/index";

const prisma = new PrismaClient();

/**
 * Get all categories for the authenticated user
 */
export async function getAllCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const query = categoryQuerySchema.parse(req.query);
    const pagination = getPaginationOptions(req);

    const where: any = { userId: user.id };
    if (query.kind) where.kind = query.kind;
    if (query.parentId !== undefined) where.parentId = query.parentId || null;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: { label: "asc" },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        include: {
          children: true,
          _count: { select: { transactions: true } },
        },
      }),
      prisma.category.count({ where }),
    ]);

    const result = paginate(categories, total, pagination);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific category by ID
 */
export async function getCategoryById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const category = await prisma.category.findFirst({
      where: { id, userId: user.id },
      include: {
        children: true,
        parent: true,
        _count: { select: { transactions: true } },
      },
    });

    if (!category) {
      throw new NotFoundError("Category not found or you don't have access");
    }

    res.json({
      success: true,
      data: { category },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new category
 */
export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const data = createCategorySchema.parse(req.body);

    // Check if category with same name already exists for this user
    const existing = await prisma.category.findFirst({
      where: { userId: user.id, label: data.label },
    });

    if (existing) {
      throw new ValidationError("A category with this name already exists");
    }

    // If parentId is provided, check if parent exists and belongs to user
    if (data.parentId) {
      const parent = await prisma.category.findFirst({
        where: { id: data.parentId, userId: user.id },
      });

      if (!parent) {
        throw new ValidationError("Parent category not found or doesn't belong to you");
      }
    }

    const category = await prisma.category.create({
      data: {
        userId: user.id,
        label: data.label,
        kind: data.kind,
        color: data.color || "#64748b",
        icon: data.icon || "🏷️",
        parentId: data.parentId || null,
      },
    });

    logger.info(`Category created: ${category.id} for user ${user.id}`);

    res.status(201).json({
      success: true,
      data: { category },
      message: "Category created successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing category
 */
export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if category exists and belongs to user
    const existing = await prisma.category.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      throw new NotFoundError("Category not found or you don't have access");
    }

    const data = updateCategorySchema.parse(req.body);

    // If label is being updated, check for duplicates
    if (data.label && data.label !== existing.label) {
      const duplicate = await prisma.category.findFirst({
        where: { userId: user.id, label: data.label },
      });

      if (duplicate) {
        throw new ValidationError("A category with this name already exists");
      }
    }

    // If parentId is being updated, check if parent exists
    if (data.parentId !== undefined && data.parentId !== existing.parentId) {
      if (data.parentId) {
        const parent = await prisma.category.findFirst({
          where: { id: data.parentId, userId: user.id },
        });

        if (!parent) {
          throw new ValidationError("Parent category not found or doesn't belong to you");
        }
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data,
    });

    logger.info(`Category updated: ${category.id} for user ${user.id}`);

    res.json({
      success: true,
      data: { category },
      message: "Category updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a category
 */
export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Check if category exists and belongs to user
    const category = await prisma.category.findFirst({
      where: { id, userId: user.id },
      include: { _count: { select: { transactions: true, children: true } } },
    });

    if (!category) {
      throw new NotFoundError("Category not found or you don't have access");
    }

    // If category has transactions, we need to handle them
    if (category._count.transactions > 0) {
      // Option: Move transactions to uncategorized
      // For now, we'll just set categoryId to null on transactions
      await prisma.transaction.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      });
    }

    // If category has children, move them to parent or root
    if (category._count.children > 0) {
      await prisma.category.updateMany({
        where: { parentId: id },
        data: { parentId: category.parentId },
      });
    }

    await prisma.category.delete({
      where: { id },
    });

    logger.info(`Category deleted: ${id} for user ${user.id}`);

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get category tree (hierarchical structure)
 */
export async function getCategoryTree(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const kind = req.query.kind as string | undefined;

    const where: any = { userId: user.id, parentId: null };
    if (kind) where.kind = kind;

    const rootCategories = await prisma.category.findMany({
      where,
      include: {
        children: {
          orderBy: { label: "asc" },
          include: {
            children: true,
          },
        },
      },
      orderBy: { label: "asc" },
    });

    res.json({
      success: true,
      data: { categories: rootCategories },
    });
  } catch (error) {
    next(error);
  }
}
