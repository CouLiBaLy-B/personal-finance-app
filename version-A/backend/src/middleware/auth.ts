import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { PrismaClient, User } from "@prisma/client";

// ---------- Types ----------
export interface AuthPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// ---------- Schémas de validation ----------
export const RegisterSchema = z.object({
  email: z.string().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Mot de passe trop court (min. 6)" }),
  fullName: z.string().min(2, { message: "Nom invalide" }),
  baseCurrency: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, { message: "Mot de passe requis" }),
});

// ---------- Helpers JWT ----------
export function signToken(user: Pick<User, "id" | "email">): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET non configuré (variable d'environnement manquante)");
  }
  return jwt.sign(
    { userId: user.id, email: user.email },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "30d" }
  );
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const payload = jwt.verify(token, secret) as AuthPayload;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Hashing bcrypt ----------
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------- Middleware d'authentification ----------
declare module "express" {
  interface Request {
    user?: User | null;
    auth?: AuthPayload | null;
  }
}

export const requireAuth = (prisma: PrismaClient) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: "Token invalide ou expiré" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: "Utilisateur introuvable" });
      return;
    }
    req.user = user;
    req.auth = payload;
    next();
  };

// ---------- OAuth2 Google ----------
const googleClient =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
    : null;

export async function verifyGoogleIdToken(idToken: string) {
  if (!googleClient) return null;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) return null;
    return {
      email: payload.email as string,
      fullName: payload.name ?? payload.email ?? "Utilisateur",
      googleId: payload.sub,
    };
  } catch {
    return null;
  }
}

export function generateGoogleOAuthUrl(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirect = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirect) return "#";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
