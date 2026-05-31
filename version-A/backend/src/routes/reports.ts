import { Router, Request, Response } from "express";
import { PrismaClient, User } from "@prisma/client";
import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { startOfMonth, endOfMonth, format, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";

/**
 * Génération de bilans financiers PDF côté serveur (pdfmake).
 * Garde l'interface légère et permet des rapports complexes sans
 * dépendre du navigateur client (meilleure qualité et déterministe).
 */

// pdfmake intègre les polices Roboto par défaut.
// On utilise un dossier de polices typiques disponibles sur le système
// ou l'image Docker pour produire des PDF de qualité.
const fonts = {
  Roboto: {
    normal: "Helvetica", // fallback sur les fontes système
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const periodSchema = z.object({
  type: z.enum(["month", "year", "custom"]),
  month: z.string().optional(),
  year: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export default function reportsRoutes(prisma: PrismaClient): Router {
  const router = Router();
  router.use(requireAuth(prisma));

  function userId(req: Request): string {
    return (req.user as User).id;
  }

  async function buildPeriodData(req: Request) {
    const parsed = periodSchema.safeParse(req.body);
    if (!parsed.success) throw new Error("Période invalide");
    const { type, month, year, from, to } = parsed.data;
    let start: Date, end: Date, label: string;

    if (type === "month" && month) {
      const d = new Date(month + "-01");
      start = startOfMonth(d);
      end = endOfMonth(d);
      label = format(d, "MMMM yyyy", { locale: fr });
    } else if (type === "year" && year) {
      const d = new Date(parseInt(year), 0, 1);
      start = startOfYear(d);
      end = endOfYear(d);
      label = `Année ${year}`;
    } else if (type === "custom" && from && to) {
      start = from;
      end = to;
      label = `${format(start, "dd/MM/yyyy")} → ${format(end, "dd/MM/yyyy")}`;
    } else {
      start = startOfMonth(new Date());
      end = endOfMonth(new Date());
      label = "Mois en cours";
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId: userId(req), date: { gte: start, lte: end } },
      include: { category: true, account: true },
    });
    const user = (req.user as User)!;
    return { start, end, label, transactions, user };
  }

  // ============= POST /summary =============
  // Renvoie JSON : revenus/dépenses/par-catégorie
  router.post("/summary", async (req, res) => {
    try {
      const { start, end, label, transactions, user } = await buildPeriodData(req);
      let income = 0;
      let expense = 0;
      const byCategory = new Map<string, { label: string; amount: number; color: string }>();
      for (const t of transactions) {
        const amt = t.amount.toNumber();
        if (t.type === "income") income += amt;
        else if (t.type === "expense") {
          expense += amt;
          const prev = byCategory.get(t.categoryId);
          if (prev) prev.amount += amt;
          else byCategory.set(t.categoryId, { label: t.category.label, amount: amt, color: t.category.color });
        }
      }
      res.json({
        period: label,
        start: start.toISOString(),
        end: end.toISOString(),
        income: Math.round(income * 100) / 100,
        expense: Math.round(expense * 100) / 100,
        savings: Math.round((income - expense) * 100) / 100,
        currency: user.baseCurrency,
        byCategory: Array.from(byCategory.values()).sort((a, b) => b.amount - a.amount),
        transactionCount: transactions.length,
      });
    } catch (err) {
      logger.error("[REPORTS][summary]", err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Erreur" });
    }
  });

  // ============= POST /pdf =============
  // Génère un PDF complet (bilan) et le renvoie en fichier
  router.post("/pdf", async (req, res) => {
    try {
      const { label, transactions, user } = await buildPeriodData(req);
      const byCategory = new Map<string, { label: string; amount: number; color: string }>();
      let income = 0;
      let expense = 0;
      for (const t of transactions) {
        const amt = t.amount.toNumber();
        if (t.type === "income") income += amt;
        else if (t.type === "expense") {
          expense += amt;
          const prev = byCategory.get(t.categoryId);
          if (prev) prev.amount += amt;
          else byCategory.set(t.categoryId, { label: t.category.label, amount: amt, color: t.category.color });
        }
      }

      const docDefinition: TDocumentDefinitions = {
        defaultStyle: { font: "Helvetica", fontSize: 10 },
        content: [
          {
            columns: [
              { text: "FinTrack — Bilan financier", style: "header" },
              { text: label, style: "subheader", alignment: "right" },
            ],
          },
          {
            text: `Utilisateur : ${user.fullName} · Devise : ${user.baseCurrency}`,
            style: "meta",
            margin: [0, 4, 0, 12],
          },
          {
            columns: [
              { text: `Revenus : ${income.toFixed(2)} ${user.baseCurrency}`, style: "kpi-green" },
              { text: `Dépenses : ${expense.toFixed(2)} ${user.baseCurrency}`, style: "kpi-red" },
              { text: `Épargne : ${(income - expense).toFixed(2)} ${user.baseCurrency}`, style: "kpi-blue" },
            ],
          },
          { text: "Par catégorie", style: "sectionTitle", margin: [0, 16, 0, 4] },
          {
            table: {
              widths: ["*", "auto"],
              body: [
                [{ text: "Catégorie", style: "tableHeader" }, { text: "Montant", style: "tableHeader" }],
                ...Array.from(byCategory.values()).map((c) => [
                  c.label,
                  `${c.amount.toFixed(2)} ${user.baseCurrency}`,
                ]),
              ],
            },
            layout: "lightHorizontalLines",
          },
          { text: `Transactions (${transactions.length})`, style: "sectionTitle", margin: [0, 16, 0, 4] },
          {
            table: {
              widths: [60, "*", 80, 60],
              body: [
                [
                  { text: "Date", style: "tableHeader" },
                  { text: "Description", style: "tableHeader" },
                  { text: "Catégorie", style: "tableHeader" },
                  { text: "Montant", style: "tableHeader" },
                ],
                ...transactions.slice(0, 200).map((t) => [
                  format(new Date(t.date), "dd/MM/yyyy"),
                  t.description,
                  t.category.label,
                  {
                    text: `${t.type === "income" ? "+" : "-"}${t.amount.toNumber().toFixed(2)} ${t.currency}`,
                    color: t.type === "income" ? "#10b981" : "#ef4444",
                  },
                ]),
              ],
            },
            layout: "lightHorizontalLines",
            fontSize: 8,
          },
        ],
        styles: {
          header: { fontSize: 18, bold: true, color: "#0ea5e9" },
          subheader: { fontSize: 12, color: "#475569" },
          meta: { fontSize: 10, color: "#64748b" },
          sectionTitle: { fontSize: 12, bold: true, color: "#0f172a" },
          tableHeader: { bold: true, color: "white", fillColor: "#0ea5e9", alignment: "left" },
          "kpi-green": { bold: true, color: "#10b981", fontSize: 12 },
          "kpi-red": { bold: true, color: "#ef4444", fontSize: 12 },
          "kpi-blue": { bold: true, color: "#2563eb", fontSize: 12 },
        },
      };

      const printer = new PdfPrinter(fonts);
      const pdfDoc = printer.createPdfKitDocument(docDefinition);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="fintrack-bilan-${Date.now()}.pdf"`);

      pdfDoc.pipe(res);
      pdfDoc.end();
      logger.info(`[REPORTS][PDF] Génération bilan — ${transactions.length} lignes`);
    } catch (err) {
      logger.error("[REPORTS][pdf]", err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Erreur" });
    }
  });

  return router;
}
