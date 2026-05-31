/**
 * Import / Export :
 *  - Import CSV de transactions (colonnes flexibles)
 *  - Export CSV des transactions
 *  - Export PDF "Bilan financier" (jsPDF + autoTable)
 *  - Export RGPD complet (JSON de toutes les données utilisateur)
 */

import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { db, uid, type Transaction, type Category, type Account } from "../db/database";
import { formatMoney } from "./fx";

// ---------- CSV IMPORT ----------
export interface ImportPreview {
  total: number;
  preview: Array<Record<string, string>>;
  columns: string[];
}

export function parseCsv(file: File): Promise<ImportPreview> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        resolve({
          total: rows.length,
          preview: rows.slice(0, 5),
          columns: results.meta.fields ?? [],
        });
      },
      error: reject,
    });
  });
}

export interface ImportMapping {
  date: string;
  description: string;
  amount: string;
  category?: string;
}

export async function importCsv(
  file: File,
  mapping: ImportMapping,
  userId: string,
  accountId: string,
  defaultCategoryId: string,
  currency: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as Record<string, string>[];
          const cats = await db.categories.where("userId").equals(userId).toArray();
          const byLabel = new Map(cats.map((c) => [c.label.toLowerCase(), c.id]));

          const toInsert: Transaction[] = [];
          for (const row of rows) {
            const rawAmount = (row[mapping.amount] ?? "").replace(",", ".").replace(/[^\d.-]/g, "");
            const amount = parseFloat(rawAmount);
            if (isNaN(amount)) continue;
            const dateStr = row[mapping.date];
            const ts = parseFlexibleDate(dateStr);
            if (!ts) continue;
            const catName = mapping.category ? row[mapping.category] : "";
            const catId = (catName && byLabel.get(catName.toLowerCase())) || defaultCategoryId;
            toInsert.push({
              id: uid(),
              userId,
              accountId,
              categoryId: catId,
              amount: Math.abs(amount),
              type: amount < 0 ? "expense" : "income",
              currency,
              date: ts,
              description: row[mapping.description] || "Import CSV",
              createdAt: Date.now(),
            });
          }
          await db.transactions.bulkAdd(toInsert);
          resolve(toInsert.length);
        } catch (e) {
          reject(e);
        }
      },
      error: reject,
    });
  });
}

function parseFlexibleDate(s: string): number | null {
  if (!s) return null;
  // Essaie ISO d'abord
  const iso = Date.parse(s);
  if (!isNaN(iso)) return iso;
  // dd/mm/yyyy ou dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    const dt = new Date(year, parseInt(mo) - 1, parseInt(d));
    return dt.getTime();
  }
  return null;
}

// ---------- CSV EXPORT ----------
export function exportTransactionsCsv(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[]
) {
  const catById = new Map(categories.map((c) => [c.id, c.label]));
  const accById = new Map(accounts.map((a) => [a.id, a.name]));
  const rows = transactions.map((t) => ({
    Date: format(new Date(t.date), "yyyy-MM-dd"),
    Description: t.description,
    Montant: t.type === "expense" ? -t.amount : t.amount,
    Devise: t.currency,
    Catégorie: catById.get(t.categoryId) ?? "",
    Compte: accById.get(t.accountId) ?? "",
    Type: t.type,
  }));
  const csv = Papa.unparse(rows);
  download(csv, `fintrack-transactions-${Date.now()}.csv`, "text/csv;charset=utf-8");
}

// ---------- PDF BILAN ----------
export interface BilanData {
  periodLabel: string;
  baseCurrency: string;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  byCategory: Array<{ label: string; amount: number; color: string }>;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  userName: string;
}

export function exportBilanPdf(data: BilanData) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();

  // En-tête
  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255);
  doc.setFontSize(20);
  doc.text("FinTrack — Bilan financier", 14, 18);
  doc.setFontSize(10);
  doc.text(data.periodLabel, 14, 25);

  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.text(`Utilisateur : ${data.userName}`, 14, 40);
  doc.text(`Devise : ${data.baseCurrency}`, 14, 46);

  // KPI
  doc.setFillColor(240, 253, 244);
  doc.rect(14, 52, 55, 22, "F");
  doc.setTextColor(22, 101, 52);
  doc.setFontSize(9);
  doc.text("Revenus", 18, 58);
  doc.setFontSize(13);
  doc.text(formatMoney(data.totalIncome, data.baseCurrency), 18, 68);

  doc.setFillColor(254, 242, 242);
  doc.rect(75, 52, 55, 22, "F");
  doc.setTextColor(153, 27, 27);
  doc.setFontSize(9);
  doc.text("Dépenses", 79, 58);
  doc.setFontSize(13);
  doc.text(formatMoney(data.totalExpense, data.baseCurrency), 79, 68);

  doc.setFillColor(239, 246, 255);
  doc.rect(136, 52, 55, 22, "F");
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(9);
  doc.text("Épargne nette", 140, 58);
  doc.setFontSize(13);
  doc.text(formatMoney(data.netSavings, data.baseCurrency), 140, 68);

  // Tableau par catégorie
  doc.setTextColor(20);
  autoTable(doc, {
    startY: 82,
    head: [["Catégorie", "Montant"]],
    body: data.byCategory.map((c) => [c.label, formatMoney(c.amount, data.baseCurrency)]),
    theme: "striped",
    headStyles: { fillColor: [14, 165, 233] },
  });

  // Transactions
  const catById = new Map(data.categories.map((c) => [c.id, c.label]));
  const accById = new Map(data.accounts.map((a) => [a.id, a.name]));
  autoTable(doc, {
    head: [["Date", "Description", "Catégorie", "Compte", "Montant"]],
    body: data.transactions.slice(0, 200).map((t) => [
      format(new Date(t.date), "dd/MM/yyyy", { locale: fr }),
      t.description,
      catById.get(t.categoryId) ?? "",
      accById.get(t.accountId) ?? "",
      `${t.type === "expense" ? "-" : "+"}${formatMoney(t.amount, t.currency)}`,
    ]),
    theme: "grid",
    headStyles: { fillColor: [14, 165, 233] },
    styles: { fontSize: 8 },
  });

  doc.save(`fintrack-bilan-${Date.now()}.pdf`);
}

// ---------- RGPD : Export complet ----------
export async function exportAllUserData(userId: string) {
  const [user, accounts, categories, transactions, budgets, goals, recurring] = await Promise.all([
    db.users.get(userId),
    db.accounts.where("userId").equals(userId).toArray(),
    db.categories.where("userId").equals(userId).toArray(),
    db.transactions.where("userId").equals(userId).toArray(),
    db.budgets.where("userId").equals(userId).toArray(),
    db.goals.where("userId").equals(userId).toArray(),
    db.recurring.where("userId").equals(userId).toArray(),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    user: user && { ...user, passwordHash: "[REDACTED]" },
    accounts,
    categories,
    transactions,
    budgets,
    goals,
    recurring,
  };
  download(
    JSON.stringify(data, null, 2),
    `fintrack-export-rgpd-${Date.now()}.json`,
    "application/json"
  );
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
