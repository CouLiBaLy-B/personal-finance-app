import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Plus, Trash2, Repeat } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { db, uid, type RecurringTransaction } from "../db/database";
import { useSession } from "../store/useSession";
import { formatMoney } from "../services/fx";
import { processRecurring } from "../services/recurring";
import { Badge, Button, Card, EmptyState, Input, Label, Modal, Select } from "../components/ui";
import { toast, confirmDialog } from "../components/Toast";

const FREQ_LABEL: Record<RecurringTransaction["frequency"], string> = {
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  yearly: "Annuel",
};

export default function Recurring() {
  const { user } = useSession();
  const userId = user!.id;
  const recurring = useLiveQuery(() => db.recurring.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const accounts = useLiveQuery(() => db.accounts.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const categories = useLiveQuery(() => db.categories.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const [open, setOpen] = useState(false);

  async function handleDelete(id: string) {
    const ok = await confirmDialog({
      title: "Supprimer cette récurrence ?",
      description: "Les transactions déjà générées seront conservées.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    await db.recurring.delete(id);
    toast.success("Récurrence supprimée");
  }

  async function handleSync() {
    const n = await processRecurring(userId);
    if (n > 0) toast.success(`${n} transaction${n > 1 ? "s" : ""} générée${n > 1 ? "s" : ""}`);
    else toast.info("Tout est à jour", "Aucune nouvelle transaction à générer.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions récurrentes</h1>
          <p className="text-sm text-slate-500">Abonnements, salaires, loyers...</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync}><Repeat size={16} /> Générer maintenant</Button>
          <Button onClick={() => setOpen(true)}><Plus size={16} /> Nouvelle</Button>
        </div>
      </div>

      {recurring.length === 0 ? (
        <EmptyState
          icon="🔁"
          title="Aucune récurrence"
          description="Automatisez vos transactions récurrentes (Netflix, salaire, loyer...)."
          action={<Button onClick={() => setOpen(true)}><Plus size={16} /> Créer une récurrence</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {recurring.map((r) => {
            const cat = categories.find((c) => c.id === r.categoryId);
            const acc = accounts.find((a) => a.id === r.accountId);
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-lg text-2xl"
                    style={{ background: (cat?.color ?? "#94a3b8") + "20" }}
                  >
                    {cat?.icon ?? "🔁"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{r.description}</div>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-500">
                      <Badge color="blue">{FREQ_LABEL[r.frequency]}</Badge>
                      <span>{acc?.name}</span>
                      <span>· Prochain : {format(new Date(r.nextDate), "dd MMM yyyy", { locale: fr })}</span>
                    </div>
                  </div>
                  <div className={`text-right font-semibold ${r.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                    {r.type === "income" ? "+" : "-"}{formatMoney(r.amount, r.currency)}
                  </div>
                  <button onClick={() => handleDelete(r.id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <NewRecurringModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewRecurringModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSession();
  const userId = user!.id;
  const accounts = useLiveQuery(() => db.accounts.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const categories = useLiveQuery(() => db.categories.where("userId").equals(userId).toArray(), [userId]) ?? [];

  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<RecurringTransaction["frequency"]>("monthly");
  const [nextDate, setNextDate] = useState(format(new Date(), "yyyy-MM-dd"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return;
    await db.recurring.add({
      id: uid(),
      userId,
      accountId,
      categoryId,
      amount: parseFloat(amount),
      type,
      currency: acc.currency,
      description: description.trim() || "Récurrent",
      frequency,
      nextDate: new Date(nextDate).getTime(),
      createdAt: Date.now(),
    });
    setAmount("");
    setDescription("");
    toast.success("Récurrence créée");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle récurrence">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {(["expense", "income"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`rounded-md py-2 text-sm font-medium transition ${type === t ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
              {t === "expense" ? "💸 Dépense" : "💰 Revenu"}
            </button>
          ))}
        </div>
        <div>
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex : Netflix" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Montant</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <Label>Fréquence</Label>
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringTransaction["frequency"])}>
              <option value="daily">Quotidien</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuel</option>
              <option value="yearly">Annuel</option>
            </Select>
          </div>
        </div>
        <div>
          <Label>Prochaine occurrence</Label>
          <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} required />
        </div>
        <div>
          <Label>Compte</Label>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            <option value="">— Sélectionner —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        <div>
          <Label>Catégorie</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">— Sélectionner —</option>
            {categories.filter((c) => c.kind === type).map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit">Créer</Button>
        </div>
      </form>
    </Modal>
  );
}
