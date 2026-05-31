import { Router, Request, Response } from "express";
import { PrismaClient, User } from "@prisma/client";
import multer from "multer";
import Papa from "papaparse";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";
import { z } from "zod";

/**
 * Import de relevés CSV :
 *   1. Multer réceptionne le fichier dans UPLOAD_DIR (volume Docker ou ./uploads).
 *   2. Parsing avec papaparse (header: true, types flexible).
 *   3. Mapping des colonnes fournies par le client (date, description, amount, [category]).
 *   4. Création en bulk dans PostgreSQL via Prisma.
 *   5. Nettoyage automatique du fichier temporaire.
 *
 * NOTE : les fichiers CSV peuvent contenir des montants négatifs (dépenses)
 * ou positifs (revenus) selon la convention du relevé bancaire.
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info(`[IMPORT] Dossier uploads créé : ${UPLOAD_DIR}`);
  } catch (err) {
    logger.error("[IMPORT] Impossible de créer le dossier d'upload", err);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 Mo
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Seuls les fichiers CSV sont autorisés"));
    }
  },
});

const parseMappingSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.string(),
  category: z.string().optional(),
  accountId: z.string(),
  defaultCategoryId: z.string(),
});

function parseFlexibleDate(s: string): number | null {
  if (!s) return null;
  const iso = Date.parse(s);
  if (!isNaN(iso)) return iso;
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    return new Date(year, parseInt(mo) - 1, parseInt(d)).getTime();
  }
  return null;
}

export default function importRoutes(prisma: PrismaClient): Router {
  const router = Router();
  router.use(requireAuth(prisma));

  function userId(req: Request): string {
    return (req.user as User).id;
  }

  // ============= POST /preview =============
  // Upload + analyse des colonnes (sans insertion)
  router.post("/preview", upload.single("file"), (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier fourni" });
    const filePath = req.file.path;

    const fileStream = fs.createReadStream(filePath);
    const rows: Record<string, string>[] = [];
    let columns: string[] = [];

    Papa.parse(fileStream, {
      header: true,
      skipEmptyLines: true,
      step: (result) => {
        if (!columns.length && result.meta.fields) columns = result.meta.fields;
        if (rows.length < 5) rows.push(result.data as Record<string, string>);
      },
      complete: () => {
        // Nettoyage du fichier (preview ne sauvegarde pas)
        fs.promises.unlink(filePath).catch(() => {});
        return res.json({ columns, preview: rows, filename: req.file?.originalname });
      },
      error: (err) => {
        fs.promises.unlink(filePath).catch(() => {});
        logger.error("[IMPORT][preview]", err);
        return res.status(400).json({ error: "Parsing CSV échoué" });
      },
    });
  });

  // ============= POST /import =============
  // Upload + mapping des colonnes + bulk insert
  router.post("/import", upload.single("file"), async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier fourni" });
    const filePath = req.file.path;

    const mapping = parseMappingSchema.safeParse(req.body);
    if (!mapping.success) {
      fs.promises.unlink(filePath).catch(() => {});
      return res.status(400).json({ error: "Mapping invalide", details: mapping.error.errors });
    }

    try {
      // Vérifier que le compte existe pour cet utilisateur
      const account = await prisma.account.findUnique({
        where: { id: mapping.data.accountId, userId: userId(req) },
      });
      if (!account) {
        fs.promises.unlink(filePath).catch(() => {});
        return res.status(404).json({ error: "Compte introuvable" });
      }

      const categories = await prisma.category.findMany({ where: { userId: userId(req) } });
      const byLabel = new Map(categories.map((c) => [c.label.toLowerCase(), c.id]));

      const rows: Record<string, string>[] = await new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath);
        const acc: Record<string, string>[] = [];
        Papa.parse(fileStream, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            resolve(results.data as Record<string, string>[]);
          },
          error: reject,
        });
      });

      const toInsert: Array<{
        id: string;
        userId: string;
        accountId: string;
        categoryId: string;
        amount: number;
        type: string;
        currency: string;
        date: Date;
        description: string;
      }> = [];

      for (const row of rows) {
        const rawAmount = (row[mapping.data.amount] ?? "")
          .replace(",", ".")
          .replace(/[^\d.-]/g, "");
        const amount = parseFloat(rawAmount);
        if (isNaN(amount) || amount === 0) continue;

        const ts = parseFlexibleDate(row[mapping.data.date]);
        if (!ts) continue;

        const catName = mapping.data.category ? row[mapping.data.category] : "";
        const catId = (catName && byLabel.get(catName.toLowerCase())) || mapping.data.defaultCategoryId;

        toInsert.push({
          id: uuidv4(),
          userId: userId(req),
          accountId: mapping.data.accountId,
          categoryId: catId,
          amount: Math.abs(amount),
          type: amount < 0 ? "expense" : "income",
          currency: account.currency,
          date: new Date(ts),
          description: (row[mapping.data.description] || "Import CSV").slice(0, 255),
        });
      }

      await prisma.transaction.createMany({ data: toInsert });
      logger.info(`[IMPORT] ${toInsert.length} transactions importées pour ${userId(req)}`);

      fs.promises.unlink(filePath).catch(() => {});
      return res.json({ inserted: toInsert.length });
    } catch (err) {
      logger.error("[IMPORT][import]", err);
      fs.promises.unlink(filePath).catch(() => {});
      return res.status(500).json({ error: "Erreur lors de l'importation" });
    }
  });

  return router;
}
