// ===========================================
// FinTrack Backend - Utility Functions
// ===========================================

import { Prisma } from "@prisma/client";
import { Request } from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===========================================
// Path Utilities
// ===========================================

/**
 * Get the absolute path to the uploads directory
 */
export function getUploadsDir(): string {
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "uploads");
  return path.resolve(uploadDir);
}

/**
 * Ensure a directory exists
 */
export async function ensureDir(dir: string): Promise<void> {
  const fs = await import("fs");
  await fs.promises.mkdir(dir, { recursive: true });
}

// ===========================================
// Date Utilities
// ===========================================

/**
 * Get the start of the current month
 */
export function startOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get the end of the current month
 */
export function endOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Get the start of the current year
 */
export function startOfYear(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), 0, 1);
}

/**
 * Get the end of the current year
 */
export function endOfYear(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Get month in YYYY-MM format
 */
export function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// ===========================================
// String Utilities
// ===========================================

/**
 * Generate a random string
 */
export function randomString(length: number = 32): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate a filename with timestamp
 */
export function generateFilename(originalName: string): string {
  const timestamp = Date.now();
  const ext = path.extname(originalName);
  const basename = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, "_");
  return `${timestamp}_${basename}${ext}`;
}

// ===========================================
// Prisma Utilities
// ===========================================

/**
 * Handle Prisma errors and convert to user-friendly messages
 */
export function handlePrismaError(error: unknown): { message: string; code?: string } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return { message: "A record with this value already exists", code: "DUPLICATE" };
      case "P2025":
        return { message: "Record not found", code: "NOT_FOUND" };
      case "P2014":
        return { message: "Invalid relation", code: "INVALID_RELATION" };
      case "P2003":
        return { message: "Foreign key constraint failed", code: "FOREIGN_KEY" };
      default:
        return { message: error.message, code: error.code };
    }
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return { message: error.message, code: "VALIDATION_ERROR" };
  }
  return { message: "An unexpected error occurred" };
}

// ===========================================
// Pagination Utilities
// ===========================================

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Paginate results
 */
export function paginate<T>(
  data: T[],
  total: number,
  options: PaginationOptions
): PaginatedResult<T> {
  const { page, limit } = options;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Get pagination options from request
 */
export function getPaginationOptions(req: Request): PaginationOptions {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  
  return {
    page: Math.max(page, 1),
    limit,
  };
}

// ===========================================
// Number Utilities
// ===========================================

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = "EUR"): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Round to 2 decimal places
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ===========================================
// IP Address Utilities
// ===========================================

/**
 * Get client IP address from request
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  const ip = forwarded ? forwarded.split(/, /)[0] : req.socket.remoteAddress || "unknown";
  return ip;
}

// ===========================================
// User Agent Utilities
// ===========================================

/**
 * Get user agent from request
 */
export function getUserAgent(req: Request): string {
  return req.headers["user-agent"] as string || "unknown";
}
