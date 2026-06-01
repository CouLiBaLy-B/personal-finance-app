/**
 * Integration tests for accounts CRUD — validation + auth layer.
 */
import { jest } from "@jest/globals";

process.env.JWT_SECRET = "test-secret-for-integration-tests-at-least-32-characters-long";
process.env.NODE_ENV = "test";

const { default: request } = await import("supertest");
const { signAccessToken } = await import("../lib/jwt.js");

const { default: express } = await import("express");
const { default: cookieParser } = await import("cookie-parser");
const { errorHandler } = await import("../middleware/errorHandler.js");
const accountRoutes = await import("../routes/accounts.js");

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use("/api/v1/accounts", accountRoutes.default);
app.use(errorHandler);

const TOKEN = signAccessToken("user-123", "test@example.com");

describe("Accounts Validation", () => {
  it("should reject unauthenticated GET", async () => {
    const res = await request(app).get("/api/v1/accounts");
    expect(res.status).toBe(401);
  });

  it("should reject POST with empty name", async () => {
    const res = await request(app)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "", type: "checking" });
    expect(res.status).toBe(400);
  });

  it("should reject POST with invalid type", async () => {
    const res = await request(app)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "Test", type: "bitcoin" });
    expect(res.status).toBe(400);
  });

  it("should reject POST with invalid currency (wrong length)", async () => {
    const res = await request(app)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "Test", type: "checking", currency: "EURO" });
    expect(res.status).toBe(400);
  });

  it("should accept valid POST body format", async () => {
    const res = await request(app)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "Mon compte", type: "saving", currency: "EUR", initialBalance: 1000 });
    // Will fail at DB level (no real DB) but validation passes → not 400
    expect(res.status).not.toBe(400);
  });
});
