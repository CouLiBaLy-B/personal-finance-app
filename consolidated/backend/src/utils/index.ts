/**
 * Shared helpers for controllers.
 */
import type { Decimal } from "@prisma/client/runtime/library.js";

/** Safely convert Prisma Decimal to number. */
export function toNumber(val: Decimal | number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

/** Parse an ISO date or return undefined. */
export function parseDate(val: string | undefined | null): Date | undefined {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

/** Build a pagination object from query params. */
export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}
