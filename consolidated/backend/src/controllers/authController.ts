/**
 * Auth controller — register, login, logout, refresh, profile, RGPD delete.
 */
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, hashToken, verifyToken } from "../lib/jwt.js";
import { AppError } from "../middleware/errorHandler.js";

const SALT_ROUNDS = 10;
const IS_PROD = process.env.NODE_ENV === "production";

/** Set JWT in HttpOnly cookies for browser security */
function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const cookieOpts = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax" as const,
    path: "/",
  };
  res.cookie("fintrack_access", accessToken, { ...cookieOpts, maxAge: 24 * 60 * 60 * 1000 });
  res.cookie("fintrack_refresh", refreshToken, { ...cookieOpts, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res: Response) {
  res.clearCookie("fintrack_access", { path: "/" });
  res.clearCookie("fintrack_refresh", { path: "/" });
}

/** POST /auth/register */
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, fullName, baseCurrency } = req.body;

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) throw new AppError("Un compte existe déjà avec cet email.", 409);

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName: fullName ?? email.split("@")[0],
        baseCurrency: baseCurrency ?? "EUR",
      },
    });

    // Seed default categories
    await seedDefaultCategories(user.id);

    const accessToken = signAccessToken(user.id, user.email);
    const refreshToken = signRefreshToken(user.id);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        baseCurrency: user.baseCurrency,
      },
    });
  } catch (err) { next(err); }
}

/** POST /auth/login */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.passwordHash) throw new AppError("Identifiants invalides.", 401);

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new AppError("Identifiants invalides.", 401);

    const accessToken = signAccessToken(user.id, user.email);
    const refreshToken = signRefreshToken(user.id);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        baseCurrency: user.baseCurrency,
      },
    });
  } catch (err) { next(err); }
}

/** POST /auth/refresh */
export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError("Refresh token requis.", 400);

    const hash = hashToken(refreshToken);
    const session = await prisma.session.findFirst({
      where: { refreshTokenHash: hash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!session) throw new AppError("Session invalide ou expirée.", 401);

    // Rotate refresh token
    const newAccessToken = signAccessToken(session.userId, session.user.email);
    const newRefreshToken = signRefreshToken(session.userId);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) { next(err); }
}

/** POST /auth/logout */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.body.refreshToken ?? req.cookies?.fintrack_refresh;
    if (refreshToken) {
      await prisma.session.deleteMany({
        where: { refreshTokenHash: hashToken(refreshToken) },
      });
    }
    clearAuthCookies(res);
    res.json({ message: "Déconnexion réussie." });
  } catch (err) { next(err); }
}

/** GET /auth/me */
export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, fullName: true, baseCurrency: true, avatarUrl: true, createdAt: true },
    });
    if (!user) throw new AppError("Utilisateur introuvable.", 404);
    res.json({ user });
  } catch (err) { next(err); }
}

/** PUT /auth/profile */
export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { fullName, baseCurrency } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { ...(fullName && { fullName }), ...(baseCurrency && { baseCurrency }) },
      select: { id: true, email: true, fullName: true, baseCurrency: true },
    });
    res.json({ user });
  } catch (err) { next(err); }
}

/** PUT /auth/change-password */
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) throw new AppError("Nouveau mot de passe min. 6 caractères.", 400);

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.passwordHash) throw new AppError("Impossible de changer le mot de passe.", 400);

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new AppError("Mot de passe actuel incorrect.", 401);

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });

    // Invalidate all sessions
    await prisma.session.deleteMany({ where: { userId: user.id } });

    res.json({ message: "Mot de passe mis à jour. Veuillez vous reconnecter." });
  } catch (err) { next(err); }
}

/** DELETE /auth/account — RGPD full delete */
export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;

    // Cascade delete handles most relations, but be explicit
    await prisma.$transaction([
      prisma.attachment.deleteMany({ where: { userId } }),
      prisma.session.deleteMany({ where: { userId } }),
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.budget.deleteMany({ where: { userId } }),
      prisma.recurringTransaction.deleteMany({ where: { userId } }),
      prisma.account.deleteMany({ where: { userId } }),
      prisma.category.deleteMany({ where: { userId } }),
      prisma.goal.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    res.json({ message: "Compte et données supprimés définitivement." });
  } catch (err) { next(err); }
}

// ============ Helpers ============
async function seedDefaultCategories(userId: string) {
  const defaults = [
    { label: "Alimentation", color: "#22c55e", icon: "🛒", kind: "expense" },
    { label: "Logement", color: "#3b82f6", icon: "🏠", kind: "expense" },
    { label: "Transport", color: "#f59e0b", icon: "🚗", kind: "expense" },
    { label: "Loisirs", color: "#a855f7", icon: "🎬", kind: "expense" },
    { label: "Santé", color: "#ef4444", icon: "💊", kind: "expense" },
    { label: "Abonnements", color: "#06b6d4", icon: "📺", kind: "expense" },
    { label: "Restaurants", color: "#ec4899", icon: "🍽️", kind: "expense" },
    { label: "Shopping", color: "#8b5cf6", icon: "🛍️", kind: "expense" },
    { label: "Transfert", color: "#64748b", icon: "🔄", kind: "expense" },
    { label: "Salaire", color: "#10b981", icon: "💼", kind: "income" },
    { label: "Freelance", color: "#0ea5e9", icon: "💻", kind: "income" },
    { label: "Cadeaux", color: "#f43f5e", icon: "🎁", kind: "income" },
    { label: "Investissements", color: "#eab308", icon: "📈", kind: "income" },
  ];

  await prisma.category.createMany({
    data: defaults.map((c) => ({ userId, ...c })),
    skipDuplicates: true,
  });

  // Create default checking account
  await prisma.account.create({
    data: { userId, name: "Compte courant", type: "checking", currency: "EUR" },
  }).catch(() => {}); // ignore duplicate
}
