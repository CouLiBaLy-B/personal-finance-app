/**
 * Integration tests for transactions — validation + auth layer.
 */
import { jest } from "@jest/globals";

process.env.JWT_SECRET = "test-secret-for-integration-tests-at-least-32-characters-long";
process.env.NODE_ENV = "test";

const { default: request } = await import("supertest");
const { signAccessToken } = await import("../lib/jwt.js");

const { default: express } = await import("express");
const { default: cookieParser } = await import("cookie-parser");
const { errorHandler } = await import("../middleware/errorHandler.js");
const txRoutes = await import("../routes/transactions.js");

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use("/api/v1/transactions", txRoutes.default);
app.use(errorHandler);

const TOKEN = signAccessToken("user-123", "test@example.com");

describe("Transactions Validation", () => {
  it("should reject unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/transactions");
    expect(res.status).toBe(401);
  });

  it("should reject negative amount", async () => {
    const res = await request(app)
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ accountId: "550e8400-e29b-41d4-a716-446655440000", amount: -50, date: "2026-06-01" });
    expect(res.status).toBe(400);
  });

  it("should reject zero amount", async () => {
    const res = await request(app)
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ accountId: "550e8400-e29b-41d4-a716-446655440000", amount: 0, date: "2026-06-01" });
    expect(res.status).toBe(400);
  });

  it("should reject missing accountId", async () => {
    const res = await request(app)
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ amount: 50, date: "2026-06-01" });
    expect(res.status).toBe(400);
  });

  it("should reject invalid accountId format", async () => {
    const res = await request(app)
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ accountId: "not-a-uuid", amount: 50, date: "2026-06-01" });
    expect(res.status).toBe(400);
  });

  it("should accept valid body format", async () => {
    const res = await request(app)
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        accountId: "550e8400-e29b-41d4-a716-446655440000",
        amount: 99.99,
        type: "expense",
        date: "2026-06-01",
        description: "Test",
      });
    // Validation passes, will fail at DB → not 400
    expect(res.status).not.toBe(400);
  });
});
