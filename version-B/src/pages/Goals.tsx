import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { db, uid } from "../db/database";
import { useSession } from "../store/useSession";
import { formatMoney } from "../services/fx";
import { Button, Card, EmptyState, Input, Label, Modal } from "../components/ui";

const ICONS = ["🏖️", "🏠", "🚗", "💍", "🎓", "💻", "✈️", "👶", "🎸", "📷", "🏍️", "💰"];
const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899"];

export default function Goals() {
  const { user } = useSession();
  const userId = user!.id;
  const base = user!.baseCurrency;
  const goals = useLiveQuery(() => db.goals.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const [open, setOpen] = useState(false);
  const [contributeId, setContributeId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet objectif ?")) return;
    await db.goals.delete(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Objectifs d'épargne</h1>
          <p className="text-sm text-slate-500">Suivez l'avancement de vos projets</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Nouvel objectif</Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="Aucun objectif"
          description="Créez votre premier objectif d'épargne (voyage, achat immobilier...)."
          action={<Button onClick={() => setOpen(true)}><Plus size={16} /> Créer un objectif</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => {
            const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
            const remaining = g.targetAmount - g.currentAmount;
            const daysLeft = Math.max(0, Math.ceil((g.targetDate - Date.now()) / 86400000));
            return (
              <Card key={g.id} className="overflow-hidden">
                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                      style={{ background: g.color + "20" }}
                    >
                      {g.icon}
                    </div>
                    <button onClick={() => handleDelete(g.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{g.label}</h3>
                  <div className="mt-1 text-xs text-slate-500">
                    🗓️ {format(new Date(g.targetDate), "dd MMM yyyy", { locale: fr })} · {daysLeft} jours restants
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-lg font-bold text-slate-900">{formatMoney(g.currentAmount, base)}</span>
                      <span className="text-xs text-slate-500">/ {formatMoney(g.targetAmount, base)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                    </div>
                    <div className="mt-1 flex justify-between text-xs">
                      <span className="font-medium" style={{ color: g.color }}>{Math.round(pct)}% atteint</span>
                      <span className="text-slate-500">Reste {formatMoney(remaining, base)}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setContributeId(g.id)}>
                    <TrendingUp size={14} /> Ajouter un versement
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <NewGoalModal open={open} onClose={() => setOpen(false)} />
      <ContributeModal goalId={contributeId} onClose={() => setContributeId(null)} />
    </div>
  );
}

function NewGoalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSession();
  const userId = user!.id;
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState(format(new Date(Date.now() + 365 * 86400000), "yyyy-MM-dd"));
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await db.goals.add({
      id: uid(),
      userId,
      label: label.trim(),
      targetAmount: parseFloat(target),
      currentAmount: 0,
      targetDate: new Date(date).getTime(),
      icon,
      color,
      createdAt: Date.now(),
    });
    setLabel("");
    setTarget("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouvel objectif">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Nom</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="Ex : Vacances été" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Montant cible</Label>
            <Input type="number" step="0.01" min="0" value={target} onChange={(e) => setTarget(e.target.value)} required />
          </div>
          <div>
            <Label>Date cible</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>
        <div>
          <Label>Icône</Label>
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className={`h-9 w-9 rounded-lg text-lg transition ${icon === i ? "bg-sky-100 ring-2 ring-sky-500" : "bg-slate-100 hover:bg-slate-200"}`}
              >{i}</button>
            ))}
          </div>
        </div>
        <div>
          <Label>Couleur</Label>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-slate-400" : ""}`}
                style={{ background: c }}
              />
            ))}
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

function ContributeModal({ goalId, onClose }: { goalId: string | null; onClose: () => void }) {
  const [amount, setAmount] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!goalId) return;
    const g = await db.goals.get(goalId);
    if (!g) return;
    await db.goals.update(goalId, { currentAmount: g.currentAmount + parseFloat(amount) });
    setAmount("");
    onClose();
  }

  return (
    <Modal open={!!goalId} onClose={onClose} title="Ajouter un versement">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Montant à ajouter</Label>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit">Valider</Button>
        </div>
      </form>
    </Modal>
  );
}
