import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, Target } from "lucide-react";
import { db } from "../db/database";
import { useSession } from "../store/useSession";
import { useRates } from "../hooks/useRates";
import { convert, formatMoney } from "../services/fx";
import { Card, EmptyState } from "../components/ui";
import { format, startOfMonth, subMonths, eachMonthOfInterval, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

export default function Dashboard() {
  const { user } = useSession();
  const userId = user!.id;
  const base = user!.baseCurrency;
  const { rates } = useRates(base);

  const accounts = useLiveQuery(() => db.accounts.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const transactions =
    useLiveQuery(() => db.transactions.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const categories =
    useLiveQuery(() => db.categories.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const goals = useLiveQuery(() => db.goals.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const budgets = useLiveQuery(() => db.budgets.where("userId").equals(userId).toArray(), [userId]) ?? [];

  // KPIs convertis dans la devise principale
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now).getTime();
    let totalBalance = 0;
    for (const a of accounts) {
      totalBalance += convert(a.initialBalance, a.currency, base, rates);
    }
    let monthIncome = 0;
    let monthExpense = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    for (const t of transactions) {
      const amt = convert(t.amount, t.currency, base, rates);
      if (t.type === "income") {
        totalIncome += amt;
        totalBalance += amt;
        if (t.date >= monthStart) monthIncome += amt;
      } else if (t.type === "expense") {
        totalExpense += amt;
        totalBalance -= amt;
        if (t.date >= monthStart) monthExpense += amt;
      }
    }
    return { totalBalance, monthIncome, monthExpense, totalIncome, totalExpense };
  }, [accounts, transactions, rates, base]);

  // Camembert dépenses du mois par catégorie
  const expenseByCategory = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now).getTime();
    const monthEnd = endOfMonth(now).getTime();
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "expense" || t.date < monthStart || t.date > monthEnd) continue;
      const amt = convert(t.amount, t.currency, base, rates);
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + amt);
    }
    return Array.from(map.entries())
      .map(([catId, amount]) => {
        const cat = categories.find((c) => c.id === catId);
        return {
          name: cat?.label ?? "Inconnu",
          value: Math.round(amount * 100) / 100,
          color: cat?.color ?? "#94a3b8",
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, rates, base]);

  // Évolution sur 6 mois
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months = eachMonthOfInterval({ start: subMonths(now, 5), end: now });
    return months.map((m) => {
      const start = startOfMonth(m).getTime();
      const end = endOfMonth(m).getTime();
      let inc = 0;
      let exp = 0;
      for (const t of transactions) {
        if (t.date < start || t.date > end) continue;
        const amt = convert(t.amount, t.currency, base, rates);
        if (t.type === "income") inc += amt;
        else if (t.type === "expense") exp += amt;
      }
      return {
        month: format(m, "MMM", { locale: fr }),
        Revenus: Math.round(inc),
        Dépenses: Math.round(exp),
        Épargne: Math.round(inc - exp),
      };
    });
  }, [transactions, rates, base]);

  // Top 5 transactions récentes
  const recent = useMemo(
    () => [...transactions].sort((a, b) => b.date - a.date).slice(0, 5),
    [transactions]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-sm text-slate-500">Vue d'ensemble de votre situation financière</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Wallet size={20} />}
          label="Solde total"
          value={formatMoney(stats.totalBalance, base)}
          accent="from-sky-500 to-blue-600"
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Revenus du mois"
          value={formatMoney(stats.monthIncome, base)}
          accent="from-emerald-500 to-green-600"
        />
        <KpiCard
          icon={<TrendingDown size={20} />}
          label="Dépenses du mois"
          value={formatMoney(stats.monthExpense, base)}
          accent="from-rose-500 to-red-600"
        />
        <KpiCard
          icon={<Target size={20} />}
          label="Épargne du mois"
          value={formatMoney(stats.monthIncome - stats.monthExpense, base)}
          accent="from-violet-500 to-purple-600"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Évolution sur 6 mois</h3>
          {monthlyTrend.every((m) => m.Revenus === 0 && m.Dépenses === 0) ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              Pas encore de données
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                  formatter={(v) => formatMoney(Number(v), base)}
                />
                <Legend />
                <Line type="monotone" dataKey="Revenus" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Dépenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Épargne" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Dépenses du mois</h3>
          {expenseByCategory.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              Aucune dépense ce mois-ci
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {expenseByCategory.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(Number(v), base)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
                {expenseByCategory.slice(0, 5).map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      <span className="text-slate-700">{c.name}</span>
                    </div>
                    <span className="font-medium text-slate-900">{formatMoney(c.value, base)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Budgets + objectifs + récents */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Objectifs d'épargne</h3>
          {goals.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="Aucun objectif"
              description="Créez votre premier objectif pour suivre votre progression."
            />
          ) : (
            <div className="space-y-4">
              {goals.slice(0, 3).map((g) => {
                const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
                return (
                  <div key={g.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {g.icon} {g.label}
                      </span>
                      <span className="text-xs text-slate-500">{Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: g.color }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatMoney(g.currentAmount, base)} / {formatMoney(g.targetAmount, base)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Comptes</h3>
          {accounts.length === 0 ? (
            <EmptyState icon="🏦" title="Aucun compte" description="Ajoutez un compte pour commencer." />
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{a.name}</div>
                    <div className="text-xs text-slate-500 capitalize">{a.type}</div>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatMoney(a.initialBalance, a.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Transactions récentes</h3>
          {recent.length === 0 ? (
            <EmptyState icon="📝" title="Vide" description="Vos transactions récentes apparaîtront ici." />
          ) : (
            <div className="space-y-2">
              {recent.map((t) => {
                const cat = categories.find((c) => c.id === t.categoryId);
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
                      style={{ background: (cat?.color ?? "#94a3b8") + "20" }}
                    >
                      {cat?.icon ?? "💸"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{t.description}</div>
                      <div className="text-xs text-slate-500">
                        {format(new Date(t.date), "dd MMM", { locale: fr })}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        t.type === "income" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {t.type === "income" ? "+" : "-"}
                      {formatMoney(t.amount, t.currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Budgets en alerte */}
      {budgets.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Suivi des budgets du mois</h3>
          <BudgetsProgress />
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white ${accent}`}>
            {icon}
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      </div>
    </Card>
  );
}

function BudgetsProgress() {
  const { user } = useSession();
  const userId = user!.id;
  const base = user!.baseCurrency;
  const { rates } = useRates(base);
  const currentMonth = format(new Date(), "yyyy-MM");

  const budgets =
    useLiveQuery(
      () => db.budgets.where("userId").equals(userId).and((b) => b.month === currentMonth).toArray(),
      [userId, currentMonth]
    ) ?? [];
  const transactions =
    useLiveQuery(() => db.transactions.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const categories =
    useLiveQuery(() => db.categories.where("userId").equals(userId).toArray(), [userId]) ?? [];

  const monthStart = startOfMonth(new Date()).getTime();
  const monthEnd = endOfMonth(new Date()).getTime();

  const rows = budgets.map((b) => {
    const cat = categories.find((c) => c.id === b.categoryId);
    const spent = transactions
      .filter(
        (t) => t.categoryId === b.categoryId && t.type === "expense" && t.date >= monthStart && t.date <= monthEnd
      )
      .reduce((sum, t) => sum + convert(t.amount, t.currency, base, rates), 0);
    const pct = (spent / b.limit) * 100;
    return { b, cat, spent, pct };
  });

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Aucun budget défini pour ce mois.</p>;
  }

  return (
    <div className="space-y-4">
      {rows.map(({ b, cat, spent, pct }) => {
        const over = pct >= 100;
        const alert = pct >= b.alertThreshold;
        return (
          <div key={b.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                {cat?.icon} {cat?.label}
              </span>
              <span className={`text-xs font-medium ${over ? "text-rose-600" : alert ? "text-amber-600" : "text-slate-500"}`}>
                {formatMoney(spent, base)} / {formatMoney(b.limit, base)} ({Math.round(pct)}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  over ? "bg-rose-500" : alert ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
