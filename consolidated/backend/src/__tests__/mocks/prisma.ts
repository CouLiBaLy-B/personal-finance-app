/**
 * Mock Prisma client for unit/integration tests.
 */
import { jest } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";

type MockPrismaClient = {
  [K in keyof PrismaClient]: K extends `$${string}`
    ? jest.Mock
    : {
        findMany: jest.Mock;
        findFirst: jest.Mock;
        findUnique: jest.Mock;
        create: jest.Mock;
        createMany: jest.Mock;
        update: jest.Mock;
        upsert: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
        count: jest.Mock;
        aggregate: jest.Mock;
      };
};

export function createMockPrisma(): MockPrismaClient {
  const mockModel = () => ({
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  });

  return {
    user: mockModel(),
    account: mockModel(),
    category: mockModel(),
    transaction: mockModel(),
    budget: mockModel(),
    goal: mockModel(),
    goalTransaction: mockModel(),
    recurringTransaction: mockModel(),
    session: mockModel(),
    attachment: mockModel(),
    $transaction: jest.fn((fns: any[]) => Promise.all(fns)),
    $queryRaw: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  } as unknown as MockPrismaClient;
}
