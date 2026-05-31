/**
 * Tests for JWT helpers — sign, verify, hash.
 */
import { signAccessToken, signRefreshToken, verifyToken, hashToken } from "../lib/jwt.js";

// Set a test secret
process.env.JWT_SECRET = "test-secret-for-unit-tests-that-is-long-enough";

describe("JWT helpers", () => {
  const userId = "user-123";
  const email = "test@fintrack.app";

  describe("signAccessToken / verifyToken", () => {
    it("should sign and verify a valid token", () => {
      const token = signAccessToken(userId, email);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts

      const payload = verifyToken(token);
      expect(payload.sub).toBe(userId);
      expect(payload.email).toBe(email);
    });

    it("should reject a tampered token", () => {
      const token = signAccessToken(userId, email);
      const tampered = token.slice(0, -5) + "xxxxx";
      expect(() => verifyToken(tampered)).toThrow();
    });

    it("should reject a random string", () => {
      expect(() => verifyToken("not-a-jwt")).toThrow();
    });
  });

  describe("signRefreshToken", () => {
    it("should produce a different token from access token", () => {
      const access = signAccessToken(userId, email);
      const refresh = signRefreshToken(userId);
      expect(access).not.toBe(refresh);
    });
  });

  describe("hashToken", () => {
    it("should produce a consistent hex hash", () => {
      const token = "my-refresh-token";
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 = 64 hex chars
    });

    it("should produce different hashes for different tokens", () => {
      const h1 = hashToken("token-a");
      const h2 = hashToken("token-b");
      expect(h1).not.toBe(h2);
    });
  });
});
