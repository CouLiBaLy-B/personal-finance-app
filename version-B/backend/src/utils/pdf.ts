// ===========================================
// FinTrack Backend - PDF Generation Utilities
// Uses pdfmake for server-side PDF generation
// ===========================================

import { TDocumentDefinitions, Content, Style, TableCell } from "pdfmake/interfaces";
import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency } from "./index";

// Setup pdfmake fonts
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

// ===========================================
// Type Definitions
// ===========================================

export interface BilanData {
  periodLabel: string;
  baseCurrency: string;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  byCategory: Array<{ label: string; amount: number; color: string }>;
  transactions: Array<{
    id: string;
    date: Date | number;
    description: string;
    categoryLabel: string;
    accountName: string;
    amount: number;
    currency: string;
    type: "expense" | "income" | "transfer";
  }>;
  userName: string;
  userEmail: string;
}

export interface BudgetReportData {
  month: string;
  baseCurrency: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  budgets: Array<{
    categoryLabel: string;
    limit: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: "under" | "warning" | "over";
  }>;
}

export interface GoalReportData {
  period: string;
  baseCurrency: string;
  goals: Array<{
    label: string;
    targetAmount: number;
    currentAmount: number;
    targetDate: Date | string;
    progressPercentage: number;
    daysRemaining: number;
    status: "on_track" | "behind" | "completed";
  }>;
}

// ===========================================
// PDF Generation Functions
// ===========================================

/**
 * Generate a financial balance PDF report
 */
export function generateBilanPdf(data: BilanData): Buffer {
  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    
    header: {
      columns: [
        {
          text: "FinTrack",
          style: "headerTitle",
          width: "*",
        },
        {
          text: "Bilan Financier",
          style: "headerSubtitle",
          alignment: "right",
        },
      ],
      margin: [40, 20, 40, 0],
    },
    
    content: [
      // Title
      {
        text: "Bilan Financier",
        style: "title",
      },
      {
        text: `Période: ${data.periodLabel}`,
        style: "subtitle",
      },
      
      // User info
      {
        text: [
          { text: "Utilisateur: ", style: "label" },
          { text: `${data.userName} (${data.userEmail})`, style: "value" },
        ],
        margin: [0, 0, 0, 20],
      },
      
      // KPIs
      {
        table: {
          body: [
            [
              { text: "Revenus Totaux", style: "tableHeader" },
              { text: "Dépenses Totales", style: "tableHeader" },
              { text: "Épargne Nette", style: "tableHeader" },
            ],
            [
              { text: formatCurrency(data.totalIncome, data.baseCurrency), style: "kpiIncome" },
              { text: formatCurrency(data.totalExpense, data.baseCurrency), style: "kpiExpense" },
              {
                text: formatCurrency(data.netSavings, data.baseCurrency),
                style: data.netSavings >= 0 ? "kpiPositive" : "kpiNegative",
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 30],
      },
      
      // By Category
      {
        text: "Dépenses par Catégorie",
        style: "sectionTitle",
      },
      {
        table: {
          body: [
            [{ text: "Catégorie", style: "tableHeader" }, { text: "Montant", style: "tableHeader" }],
            ...data.byCategory.map((cat) => [
              { text: cat.label, style: "tableCell" },
              { text: formatCurrency(cat.amount, data.baseCurrency), style: "tableCell", alignment: "right" },
            ]),
          ],
        },
        margin: [0, 0, 0, 30],
      },
      
      // Transactions
      {
        text: "Dernières Transactions",
        style: "sectionTitle",
      },
      {
        table: {
          body: [
            [
              { text: "Date", style: "tableHeader" },
              { text: "Description", style: "tableHeader" },
              { text: "Catégorie", style: "tableHeader" },
              { text: "Compte", style: "tableHeader" },
              { text: "Montant", style: "tableHeader", alignment: "right" },
            ],
            ...data.transactions.slice(0, 20).map((t) => [
              { text: format(new Date(t.date), "dd/MM/yyyy", { locale: fr }), style: "tableCell" },
              { text: t.description, style: "tableCell" },
              { text: t.categoryLabel, style: "tableCell" },
              { text: t.accountName, style: "tableCell" },
              {
                text: `${t.type === "expense" ? "-" : "+"}${formatCurrency(t.amount, t.currency)}`,
                style: t.type === "expense" ? "amountNegative" : "amountPositive",
                alignment: "right",
              },
            ]),
          ],
        },
        margin: [0, 0, 0, 20],
      },
      
      // Footer
      {
        text: `Généré le ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr })}`,
        style: "footerText",
        alignment: "center",
        margin: [0, 20, 0, 0],
      },
    ],
    
    styles: getStyles(),
    defaultStyle: {
      fontSize: 10,
      font: "Helvetica",
    },
  };

  return generatePdf(docDefinition);
}

/**
 * Generate a budget report PDF
 */
export function generateBudgetReportPdf(data: BudgetReportData): Buffer {
  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    
    header: {
      text: "FinTrack - Rapport Budgétaire",
      style: "headerTitle",
      alignment: "center",
      margin: [0, 20, 0, 10],
    },
    
    content: [
      {
        text: `Mois: ${data.month}`,
        style: "subtitle",
        alignment: "center",
        margin: [0, 0, 0, 30],
      },
      
      // Summary
      {
        table: {
          body: [
            [
              { text: "Budget Total", style: "tableHeader" },
              { text: "Dépenses", style: "tableHeader" },
              { text: "Reste", style: "tableHeader" },
            ],
            [
              { text: formatCurrency(data.totalBudget, data.baseCurrency), style: "tableCell" },
              { text: formatCurrency(data.totalSpent, data.baseCurrency), style: "tableCell" },
              {
                text: formatCurrency(data.remaining, data.baseCurrency),
                style: data.remaining >= 0 ? "kpiPositive" : "kpiNegative",
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 30],
      },
      
      // Budget details
      {
        text: "Détail par Catégorie",
        style: "sectionTitle",
      },
      {
        table: {
          body: [
            [
              { text: "Catégorie", style: "tableHeader" },
              { text: "Budget", style: "tableHeader" },
              { text: "Dépensé", style: "tableHeader" },
              { text: "Reste", style: "tableHeader" },
              { text: "Statut", style: "tableHeader" },
            ],
            ...data.budgets.map((b) => [
              { text: b.categoryLabel, style: "tableCell" },
              { text: formatCurrency(b.limit, data.baseCurrency), style: "tableCell", alignment: "right" },
              { text: formatCurrency(b.spent, data.baseCurrency), style: "tableCell", alignment: "right" },
              {
                text: formatCurrency(b.remaining, data.baseCurrency),
                style: b.status === "over" ? "amountNegative" : b.status === "warning" ? "amountWarning" : "amountPositive",
                alignment: "right",
              },
              {
                text: b.status === "over" ? "Dépassé" : b.status === "warning" ? "Avertissement" : "OK",
                style: b.status === "over" ? "statusNegative" : b.status === "warning" ? "statusWarning" : "statusPositive",
              },
            ]),
          ],
        },
        margin: [0, 0, 0, 20],
      },
      
      {
        text: `Généré le ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr })}`,
        style: "footerText",
        alignment: "center",
      },
    ],
    
    styles: getStyles(),
    defaultStyle: {
      fontSize: 10,
      font: "Helvetica",
    },
  };

  return generatePdf(docDefinition);
}

/**
 * Generate a goal report PDF
 */
export function generateGoalReportPdf(data: GoalReportData): Buffer {
  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    
    header: {
      text: "FinTrack - Rapport des Objectifs",
      style: "headerTitle",
      alignment: "center",
      margin: [0, 20, 0, 10],
    },
    
    content: [
      {
        text: `Période: ${data.period}`,
        style: "subtitle",
        alignment: "center",
        margin: [0, 0, 0, 30],
      },
      
      // Goals table
      {
        table: {
          body: [
            [
              { text: "Objectif", style: "tableHeader" },
              { text: "Cible", style: "tableHeader" },
              { text: "Épargné", style: "tableHeader" },
              { text: "Progression", style: "tableHeader" },
              { text: "Date Cible", style: "tableHeader" },
              { text: "Jours Restants", style: "tableHeader" },
              { text: "Statut", style: "tableHeader" },
            ],
            ...data.goals.map((g) => [
              { text: g.label, style: "tableCell" },
              { text: formatCurrency(g.targetAmount, data.baseCurrency), style: "tableCell", alignment: "right" },
              { text: formatCurrency(g.currentAmount, data.baseCurrency), style: "tableCell", alignment: "right" },
              {
                text: `${g.progressPercentage.toFixed(1)}%`,
                style: "tableCell",
                alignment: "right",
              },
              { text: format(new Date(g.targetDate), "dd/MM/yyyy", { locale: fr }), style: "tableCell" },
              { text: String(g.daysRemaining), style: "tableCell", alignment: "right" },
              {
                text: g.status === "completed" ? "Atteint" : g.status === "on_track" ? "En cours" : "Retard",
                style: g.status === "completed" ? "statusPositive" : g.status === "on_track" ? "statusWarning" : "statusNegative",
              },
            ]),
          ],
        },
        margin: [0, 0, 0, 20],
      },
      
      {
        text: `Généré le ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr })}`,
        style: "footerText",
        alignment: "center",
      },
    ],
    
    styles: getStyles(),
    defaultStyle: {
      fontSize: 10,
      font: "Helvetica",
    },
  };

  return generatePdf(docDefinition);
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Generate PDF from document definition
 */
function generatePdf(docDefinition: TDocumentDefinitions): Buffer {
  const pdfDoc = pdfMake.createPdf(docDefinition);
  return Buffer.from(pdfDoc.getBuffer());
}

/**
 * Get PDF styles
 */
function getStyles(): Record<string, Style> {
  return {
    headerTitle: {
      fontSize: 18,
      bold: true,
      color: "#0ea5e9",
    },
    headerSubtitle: {
      fontSize: 14,
      bold: true,
      color: "#64748b",
    },
    title: {
      fontSize: 24,
      bold: true,
      color: "#1e293b",
      margin: [0, 0, 0, 10],
    },
    subtitle: {
      fontSize: 14,
      color: "#64748b",
      margin: [0, 0, 0, 20],
    },
    sectionTitle: {
      fontSize: 14,
      bold: true,
      color: "#1e293b",
      margin: [0, 0, 0, 10],
    },
    label: {
      bold: true,
      color: "#64748b",
    },
    value: {
      color: "#1e293b",
    },
    tableHeader: {
      bold: true,
      fontSize: 10,
      color: "#ffffff",
      fillColor: "#0ea5e9",
      alignment: "center",
      padding: [4, 4, 4, 4],
    },
    tableCell: {
      fontSize: 9,
      color: "#1e293b",
      padding: [4, 4, 4, 4],
    },
    kpiIncome: {
      fontSize: 18,
      bold: true,
      color: "#10b981",
      alignment: "center",
    },
    kpiExpense: {
      fontSize: 18,
      bold: true,
      color: "#ef4444",
      alignment: "center",
    },
    kpiPositive: {
      fontSize: 18,
      bold: true,
      color: "#10b981",
      alignment: "center",
    },
    kpiNegative: {
      fontSize: 18,
      bold: true,
      color: "#ef4444",
      alignment: "center",
    },
    amountPositive: {
      color: "#10b981",
    },
    amountNegative: {
      color: "#ef4444",
    },
    amountWarning: {
      color: "#f59e0b",
    },
    statusPositive: {
      color: "#10b981",
      bold: true,
    },
    statusNegative: {
      color: "#ef4444",
      bold: true,
    },
    statusWarning: {
      color: "#f59e0b",
      bold: true,
    },
    footerText: {
      fontSize: 8,
      color: "#94a3b8",
    },
  };
}
