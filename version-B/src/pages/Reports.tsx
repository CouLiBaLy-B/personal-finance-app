import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { FileText, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { db } from "../db/database";
import { useSession } from "../store/useSession";
import { useRates } from "../hooks/useRates";
import { convert, formatMoney } from "../services/fx";
import { Button, Card, Label, Select } from "../components/ui";
import { exportBilanPdf, exportTransactionsCsv } from "../services/importExport";

type PeriodType = "month" | "year" | "custom";

export default function Reports() {
  const { user } = useSession();
  const userId = user!.id;
  const base = user!.baseCurrency;
  const { rates } = useRates(base);

  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [year, setYear] = useState(format(new Date(), "yyyy"));
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const transactions = useLiveQuery(() => db.transactions.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const categories = useLiveQuery(() => db.categories.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const accounts = useLiveQuery(() => db.accounts.where("userId").equals(userId).toArray(), [userId]) ?? [];

  const range = useMemo(() => {
    if (periodType === "month") {
      const d = new Date(month + "-01");
      return { start: startOfMonth(d).getTime(), end: endOfMonth(d).getTime(), label: format(d, "MMMM yyyy", { locale: fr }) };
    }
    if (periodType === "year") {
      const d = new Date(parseInt(year), 0, 1);
      return { start: startOfYear(d).getTime(), end: endOfYear(d).getTime(), label: `Année ${year}` };
    }
    return { start: new Date(from).getTime(), end: new Date(to).getTime(), label: `${from} → ${to}` };
  }, [periodType, month, year, from, to]);

  const filtered = useMemo(
    () => transactions.filter((t) => t.date >= range.start && t.date <= range.end),
    [transactions, range]
  );

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const byCat = new Map<string, number>();
    for (const t of filtered) {
      const amt = convert(t.amount, t.currency, base, rates);
      if (t.type === "income") income += amt;
      else if (t.type === "expense") {
        expense += amt;
        byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + amt);
      }
    }
    const byCategory = Array.from(byCat.entries())
      .map(([catId, amount]) => {
        const cat = categories.find((c) => c.id === catId);
        return { label: cat?.label ?? "Inconnu", color: cat?.color ?? "#94a3b8", amount: Math.round(amount * 100) / 100 };
      })
      .sort((a, b) => b.amount - a.amount);
    return { income, expense, savings: income - expense, byCategory };
  }, [filtered, categories, rates, base]);

  function generatePdf() {
    exportBilanPdf({
      periodLabel: range.label,
      baseCurrency: base,
      totalIncome: stats.income,
      totalExpense: stats.expense,
      netSavings: stats.savings,
      byCategory: stats.byCategory,
      transactions: filtered,
      categories,
      accounts,
      userName: user!.fullName,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rapports & bilans</h1>
        <p className="text-sm text-slate-500">Analysez vos finances sur la période souhaitée</p>
      </div>

      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div>
            <Label>Période</Label>
            <Select value={periodType} onChange={(e) => setPeriodType(e.target.value as PeriodType)}>
              <option value="month">Mensuel</option>
              <option value="year">Annuel</option>
              <option value="custom">Personnalisé</option>
            </Select>
          </div>
          {periodType === "month" && (
            <div className="sm:col-span-2">
              <Label>Mois</Label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
            </div>
          )}
          {periodType === "year" && (
            <div className="sm:col-span-2">
              <Label>Année</Label>
              <Select value={year} onChange={(e) => setYear(e.target.value)}>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </div>
          )}
          {periodType === "custom" && (
            <>
              <div>
                <Label>Du</Label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Au</Label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              </div>
            </>
          )}
          <div className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => exportTransactionsCsv(filtered, categories, accounts)}>
              <Download size={16} /> CSV
            </Button>
            <Button onClick={generatePdf}>
              <FileText size={16} /> PDF Bilan
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Revenus</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(stats.income, base)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-rose-700">Dépenses</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(stats.expense, base)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-sky-700">Épargne nette</div>
          <div className={`mt-2 text-2xl font-bold ${stats.savings >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatMoney(stats.savings, base)}
          </div>
        </Card>
      </div>

      {/* Bar chart par catégorie */}
      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Dépenses par catégorie · {range.label}</h3>
        {stats.byCategory.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-400">
            Aucune dépense sur cette période
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, stats.byCategory.length * 40)}>
            <BarChart data={stats.byCategory} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#64748b" fontSize={12} />
              <YAxis type="category" dataKey="label" stroke="#64748b" fontSize={12} width={120} />
              <Tooltip formatter={(v) => formatMoney(Number(v), base)} />
              <Legend />
              <Bar dataKey="amount" name="Montant" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
