/**
 * Tests for Zod validation schemas.
 */
import {
  registerSchema,
  loginSchema,
  accountCreateSchema,
  transactionCreateSchema,
  budgetCreateSchema,
  goalCreateSchema,
  profileUpdateSchema,
  changePasswordSchema,
  syncPushSchema,
} from "../middleware/validation.js";

describe("Validation schemas", () => {
  describe("registerSchema", () => {
    it("should accept valid data", () => {
      const result = registerSchema.safeParse({
        email: "test@example.com",
        password: "123456",
        fullName: "Test User",
      });
      expect(result.success).toBe(true);
    });

    it("should reject short password", () => {
      const result = registerSchema.safeParse({
        email: "test@example.com",
        password: "12345",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid email", () => {
      const result = registerSchema.safeParse({
        email: "not-an-email",
        password: "123456",
      });
      expect(result.success).toBe(false);
    });

    it("should default baseCurrency to EUR", () => {
      const result = registerSchema.parse({
        email: "test@example.com",
        password: "123456",
      });
      expect(result.baseCurrency).toBe("EUR");
    });
  });

  describe("loginSchema", () => {
    it("should accept valid credentials", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "mypassword",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("accountCreateSchema", () => {
    it("should accept valid account", () => {
      const result = accountCreateSchema.safeParse({
        name: "Mon compte",
        type: "checking",
        currency: "EUR",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty name", () => {
      const result = accountCreateSchema.safeParse({
        name: "",
        type: "checking",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid type", () => {
      const result = accountCreateSchema.safeParse({
        name: "Test",
        type: "bitcoin",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("transactionCreateSchema", () => {
    it("should accept valid transaction", () => {
      const result = transactionCreateSchema.safeParse({
        accountId: "550e8400-e29b-41d4-a716-446655440000",
        amount: 42.5,
        type: "expense",
        date: "2026-01-15",
      });
      expect(result.success).toBe(true);
    });

    it("should reject negative amount", () => {
      const result = transactionCreateSchema.safeParse({
        accountId: "550e8400-e29b-41d4-a716-446655440000",
        amount: -10,
        date: "2026-01-15",
      });
      expect(result.success).toBe(false);
    });

    it("should reject zero amount", () => {
      const result = transactionCreateSchema.safeParse({
        accountId: "550e8400-e29b-41d4-a716-446655440000",
        amount: 0,
        date: "2026-01-15",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("budgetCreateSchema", () => {
    it("should accept valid budget", () => {
      const result = budgetCreateSchema.safeParse({
        categoryId: "550e8400-e29b-41d4-a716-446655440000",
        month: "2026-06",
        limit: 500,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid month format", () => {
      const result = budgetCreateSchema.safeParse({
        categoryId: "550e8400-e29b-41d4-a716-446655440000",
        month: "June 2026",
        limit: 500,
      });
      expect(result.success).toBe(false);
    });

    it("should default alertThreshold to 80", () => {
      const result = budgetCreateSchema.parse({
        categoryId: "550e8400-e29b-41d4-a716-446655440000",
        month: "2026-06",
        limit: 500,
      });
      expect(result.alertThreshold).toBe(80);
    });
  });

  describe("profileUpdateSchema", () => {
    it("should accept fullName update", () => {
      const result = profileUpdateSchema.safeParse({ fullName: "New Name" });
      expect(result.success).toBe(true);
    });

    it("should reject empty update", () => {
      const result = profileUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("changePasswordSchema", () => {
    it("should accept valid password change", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "oldpass",
        newPassword: "newpass123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject short new password", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "oldpass",
        newPassword: "12345",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("syncPushSchema", () => {
    it("should accept valid sync push", () => {
      const result = syncPushSchema.safeParse({
        entities: [
          { table: "accounts", id: "abc", action: "upsert", data: { name: "Test" } },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should reject unknown table", () => {
      const result = syncPushSchema.safeParse({
        entities: [
          { table: "hackertable", id: "abc", action: "upsert", data: {} },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("should reject more than 1000 entities", () => {
      const entities = Array.from({ length: 1001 }, (_, i) => ({
        table: "accounts",
        id: `id-${i}`,
        action: "upsert",
        data: {},
      }));
      const result = syncPushSchema.safeParse({ entities });
      expect(result.success).toBe(false);
    });
  });
});
