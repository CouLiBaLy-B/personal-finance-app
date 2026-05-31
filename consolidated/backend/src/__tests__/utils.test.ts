/**
 * Tests for utility helpers.
 */
import { toNumber, parseDate, parsePagination } from "../utils/index.js";

describe("toNumber", () => {
  it("should convert number to number", () => {
    expect(toNumber(42)).toBe(42);
  });

  it("should convert string to number", () => {
    expect(toNumber("123.45")).toBe(123.45);
  });

  it("should return 0 for null/undefined", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  it("should handle Prisma Decimal-like objects", () => {
    const decimal = { toString: () => "99.99" } as any;
    expect(toNumber(decimal)).toBe(99.99);
  });
});

describe("parseDate", () => {
  it("should parse valid ISO date", () => {
    const d = parseDate("2026-06-01");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
  });

  it("should return undefined for null/empty", () => {
    expect(parseDate(null)).toBeUndefined();
    expect(parseDate(undefined)).toBeUndefined();
    expect(parseDate("")).toBeUndefined();
  });

  it("should return undefined for invalid date", () => {
    expect(parseDate("not-a-date")).toBeUndefined();
  });
});

describe("parsePagination", () => {
  it("should return defaults for empty query", () => {
    const p = parsePagination({});
    expect(p.page).toBe(1);
    expect(p.limit).toBe(20);
    expect(p.skip).toBe(0);
    expect(p.take).toBe(20);
  });

  it("should parse page and limit", () => {
    const p = parsePagination({ page: "3", limit: "50" });
    expect(p.page).toBe(3);
    expect(p.limit).toBe(50);
    expect(p.skip).toBe(100);
  });

  it("should cap limit at 100", () => {
    const p = parsePagination({ limit: "999" });
    expect(p.limit).toBe(100);
  });

  it("should floor page at 1", () => {
    const p = parsePagination({ page: "-5" });
    expect(p.page).toBe(1);
  });
});
