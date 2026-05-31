/**
 * Tests for error handler middleware.
 */
import { jest } from "@jest/globals";
import { AppError, errorHandler } from "../middleware/errorHandler.js";

// Mock Express objects
const mockReq = {} as any;
const mockNext = jest.fn() as any;
function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res) as any;
  res.json = jest.fn().mockReturnValue(res) as any;
  return res;
}

describe("errorHandler", () => {
  it("should handle AppError with correct status", () => {
    const res = mockRes();
    const err = new AppError("Not found", 404);

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Not found" })
    );
  });

  it("should handle Prisma P2025 as 404", () => {
    const res = mockRes();
    const err: any = new Error("Record not found");
    err.code = "P2025";

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should handle Prisma P2002 as 409 (duplicate)", () => {
    const res = mockRes();
    const err: any = new Error("Unique constraint");
    err.code = "P2002";

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("should handle ZodError as 400", () => {
    const res = mockRes();
    const err: any = new Error("Validation failed");
    err.name = "ZodError";
    err.issues = [{ path: ["email"], message: "Invalid email" }];

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Données invalides.",
        details: expect.any(Array),
      })
    );
  });

  it("should return 500 for unknown errors", () => {
    const res = mockRes();
    const err = new Error("Something broke");

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
