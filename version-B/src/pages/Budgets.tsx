import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { db, uid } from "../db/database";
import { useSession } from "../store/useSession";
import { useRates } from "../hooks/useRates";
import { convert, formatMoney } from "../services/fx";
import { Button, Card, EmptyState, Input, Label, Modal, Select } from "../components/ui";

export default function Budgets() {
  const { user } = useSession();
  const userId = user!.id;
  const base = user!.baseCurrency;
  const { rates } = useRates(base);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [open, setOpen] = useState(false);

  const categories = useLiveQuery(() => db.categories.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const transactions = useLiveQuery(() => db.transactions.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const budgets = useLiveQuery(
    () => db.budgets.where("userId").equals(userId).and((b) => b.month === month).toArray(),
    [userId, month]
  ) ?? [];

  const monthStart = startOfMonth(new Date(month + "-01")).getTime();
  const monthEnd = endOfMonth(new Date(month + "-01")).getTime();

  const rows = useMemo(() => {
    return budgets.map((b) => {
      const cat = categories.find((c) => c.id === b.categoryId);
      const spent = transactions
        .filter((t) => t.categoryId === b.categoryId && t.type === "expense" && t.date >= monthStart && t.date <= monthEnd)
        .reduce((sum, t) => sum + convert(t.amount, t.currency, base, rates), 0);
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      return { b, cat, spent, pct };
    });
  }, [budgets, transactions, categories, rates, base, monthStart, monthEnd]);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce budget ?")) return;
    await db.budgets.delete(id);
  }

  const alerts = rows.filter((r) => r.pct >= r.b.alertThreshold);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Budgets mensuels</h1>
          <p className="text-sm text-slate-500">Définissez et suivez vos limites de dépenses</p>
        </div>
        <div className="flex gap-2">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />
          <Button onClick={() => setOpen(true)}><Plus size={16} /> Nouveau</Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-amber-600" size={20} />
            <div>
              <div className="text-sm font-semibold text-amber-900">
                {alerts.length} alerte{alerts.length > 1 ? "s" : ""} budgétaire{alerts.length > 1 ? "s" : ""}
              </div>
              <div className="mt-1 text-xs text-amber-800">
                {alerts.map((a) => `${a.cat?.label} (${Math.round(a.pct)}%)`).join(" · ")}
              </div>
            </div>
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="Aucun budget pour ce mois"
          description="Créez votre premier budget par catégorie pour mieux contrôler vos dépenses."
          action={<Button onClick={() => setOpen(true)}><Plus size={16} /> Créer un budget</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ b, cat, spent, pct }) => {
            const over = pct >= 100;
            const alert = pct >= b.alertThreshold;
            const remaining = b.limit - spent;
            return (
              <Card key={b.id} className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                      style={{ background: (cat?.color ?? "#94a3b8") + "20" }}
                    >
                      {cat?.icon ?? "🎯"}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{cat?.label}</div>
                      <div className="text-xs text-slate-500">Alerte à {b.alertThreshold}%</div>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(b.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xl font-bold text-slate-900">{formatMoney(spent, base)}</span>
                  <span className="text-xs text-slate-500">/ {formatMoney(b.limit, base)}</span>
                </div>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${over ? "bg-rose-500" : alert ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className={`text-xs font-medium ${over ? "text-rose-600" : alert ? "text-amber-600" : "text-emerald-600"}`}>
                  {over
                    ? `⚠️ Dépassé de ${formatMoney(Math.abs(remaining), base)}`
                    : `${formatMoney(remaining, base)} restant`}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <NewBudgetModal open={open} onClose={() => setOpen(false)} month={month} />
    </div>
  );
}

function NewBudgetModal({ open, onClose, month }: { open: boolean; onClose: () => void; month: string }) {
  const { user } = useSession();
  const userId = user!.id;
  const categories = useLiveQuery(
    () => db.categories.where("userId").equals(userId).and((c) => c.kind === "expense").toArray(),
    [userId]
  ) ?? [];

  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");
  const [threshold, setThreshold] = useState("80");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Vérifier qu'il n'existe pas déjà
    const existing = await db.budgets
      .where("userId")
      .equals(userId)
      .and((b) => b.month === month && b.categoryId === categoryId)
      .first();
    if (existing) {
      alert("Un budget existe déjà pour cette catégorie ce mois-ci.");
      return;
    }
    await db.budgets.add({
      id: uid(),
      userId,
      categoryId,
      month,
      limit: parseFloat(limit),
      alertThreshold: parseFloat(threshold),
      createdAt: Date.now(),
    });
    setLimit("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouveau budget">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Catégorie</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">— Sélectionner —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Limite mensuelle</Label>
            <Input type="number" step="0.01" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} required />
          </div>
          <div>
            <Label>Seuil d'alerte (%)</Label>
            <Input type="number" min="0" max="100" value={threshold} onChange={(e) => setThreshold(e.target.value)} required />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit">Créer</Button>
        </div>
      </form>
    </Modal>
  );
}
