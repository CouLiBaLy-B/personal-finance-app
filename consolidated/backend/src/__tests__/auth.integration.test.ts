/**
 * Integration tests for auth routes — testing validation + HTTP layer.
 * These tests verify the Express routing and Zod validation WITHOUT a real DB.
 * They use direct HTTP calls to the running app.
 */
import { jest } from "@jest/globals";

process.env.JWT_SECRET = "test-secret-for-integration-tests-at-least-32-characters-long";
process.env.NODE_ENV = "test";

// We test validation layer only (no DB), so we expect 400 for bad input
// and specific shapes for validation errors
const { default: request } = await import("supertest");
const { signAccessToken } = await import("../lib/jwt.js");

// Create a minimal Express app with just the auth routes for testing
const { default: express } = await import("express");
const { default: cookieParser } = await import("cookie-parser");
const { errorHandler } = await import("../middleware/errorHandler.js");
const authRoutes = await import("../routes/auth.js");

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use("/api/v1/auth", authRoutes.default);
app.use(errorHandler);

describe("Auth Validation", () => {
  describe("POST /api/v1/auth/register", () => {
    it("should reject short password (400)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ email: "test@example.com", password: "12345" });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Données invalides.");
    });

    it("should reject invalid email (400)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ email: "not-an-email", password: "password123" });
      expect(res.status).toBe(400);
    });

    it("should reject empty body (400)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should reject empty password (400)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "test@example.com", password: "" });
      expect(res.status).toBe(400);
    });

    it("should reject missing email (400)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ password: "password123" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("should reject request without token (401)", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject invalid token (401)", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer invalid-jwt-token");
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/v1/auth/profile", () => {
    it("should reject empty update body (400)", async () => {
      const token = signAccessToken("user-123", "test@example.com");
      const res = await request(app)
        .put("/api/v1/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/v1/auth/change-password", () => {
    it("should reject short new password (400)", async () => {
      const token = signAccessToken("user-123", "test@example.com");
      const res = await request(app)
        .put("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "oldpass", newPassword: "12345" });
      expect(res.status).toBe(400);
    });

    it("should reject missing current password (400)", async () => {
      const token = signAccessToken("user-123", "test@example.com");
      const res = await request(app)
        .put("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ newPassword: "newpassword123" });
      expect(res.status).toBe(400);
    });
  });
});

describe("Cookie Auth", () => {
  it("should accept JWT from cookie", async () => {
    const token = signAccessToken("user-123", "test@example.com");
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", `fintrack_access=${token}`);
    // Will get 404 or 500 (no DB), but NOT 401 — proving cookie auth works
    expect(res.status).not.toBe(401);
  });
});
