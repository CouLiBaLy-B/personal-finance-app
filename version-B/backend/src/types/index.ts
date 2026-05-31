// ===========================================
// FinTrack Backend - Type Definitions
// ===========================================

import { Request } from "express";

// ===========================================
// User Types
// ===========================================

export interface JwtPayload {
  sub: string; // userId
  email?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    fullName?: string;
    baseCurrency: string;
  };
}

// ===========================================
// API Response Types
// ===========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
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

// ===========================================
// DTO Types
// ===========================================

export interface RegisterDto {
  email: string;
  password: string;
  fullName?: string;
  baseCurrency?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface UpdateProfileDto {
  fullName?: string;
  baseCurrency?: string;
  avatarUrl?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Account DTOs
export interface CreateAccountDto {
  name: string;
  type: "checking" | "saving" | "cash" | "card";
  currency?: string;
  initialBalance?: number;
  color?: string;
  icon?: string;
}

export interface UpdateAccountDto extends Partial<CreateAccountDto> {
  isActive?: boolean;
}

// Category DTOs
export interface CreateCategoryDto {
  label: string;
  kind: "expense" | "income";
  color?: string;
  icon?: string;
  parentId?: string | null;
}

export interface UpdateCategoryDto extends Partial<CreateCategoryDto> {
  isActive?: boolean;
}

// Transaction DTOs
export interface CreateTransactionDto {
  accountId: string;
  categoryId: string;
  amount: number;
  type: "expense" | "income" | "transfer";
  currency?: string;
  date: string | Date;
  description?: string;
  recurringId?: string | null;
  goalId?: string | null;
  notes?: string;
  attachments?: string[];
}

export interface UpdateTransactionDto extends Partial<CreateTransactionDto> {}

export interface TransactionQueryDto {
  accountId?: string;
  categoryId?: string;
  type?: "expense" | "income" | "transfer";
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "date" | "amount" | "description";
  sortOrder?: "asc" | "desc";
}

// Budget DTOs
export interface CreateBudgetDto {
  categoryId: string;
  month: string; // YYYY-MM
  year: number;
  limit: number;
  alertThreshold?: number;
}

export interface UpdateBudgetDto extends Partial<CreateBudgetDto> {
  isActive?: boolean;
}

// Goal DTOs
export interface CreateGoalDto {
  label: string;
  description?: string;
  targetAmount: number;
  targetDate: string | Date;
  color?: string;
  icon?: string;
}

export interface UpdateGoalDto extends Partial<CreateGoalDto> {
  currentAmount?: number;
  isCompleted?: boolean;
}

export interface GoalContributionDto {
  amount: number;
  date?: string | Date;
  notes?: string;
}

// Recurring Transaction DTOs
export interface CreateRecurringTransactionDto {
  accountId: string;
  categoryId: string;
  amount: number;
  type: "expense" | "income";
  currency?: string;
  description: string;
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  interval?: number;
  startDate: string | Date;
  endDate?: string | Date | null;
  isActive?: boolean;
}

export interface UpdateRecurringTransactionDto extends Partial<CreateRecurringTransactionDto> {
  nextDate?: string | Date;
  occurrences?: number;
}

// ===========================================
// Filter Types
// ===========================================

export interface DateRange {
  start: Date | string;
  end: Date | string;
}

export interface CategoryFilter {
  kind?: "expense" | "income";
  parentId?: string | null;
  isActive?: boolean;
}

export interface AccountFilter {
  type?: "checking" | "saving" | "cash" | "card";
  currency?: string;
  isActive?: boolean;
}

// ===========================================
// Report Types
// ===========================================

export interface IncomeExpenseReport {
  period: string;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  byCategory: Array<{
    categoryId: string;
    categoryLabel: string;
    amount: number;
    percentage: number;
  }>;
  byAccount: Array<{
    accountId: string;
    accountName: string;
    amount: number;
  }>;
}

export interface BudgetReport {
  month: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  budgets: Array<{
    categoryId: string;
    categoryLabel: string;
    limit: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: "under" | "warning" | "over";
  }>;
}

export interface GoalReport {
  totalGoals: number;
  completedGoals: number;
  inProgressGoals: number;
  totalSaved: number;
  totalTarget: number;
  goals: Array<{
    id: string;
    label: string;
    targetAmount: number;
    currentAmount: number;
    targetDate: string;
    progressPercentage: number;
    daysRemaining: number;
    status: "on_track" | "behind" | "completed";
  }>;
}

// ===========================================
// Notification Types
// ===========================================

export interface Notification {
  id: string;
  userId: string;
  type: "budget_alert" | "goal_achieved" | "recurring_due" | "system";
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

// ===========================================
// File Upload Types
// ===========================================

export interface UploadedFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
}
