import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { ArrowRight, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { db, uid } from "../db/database";
import { useSession } from "../store/useSession";
import { useRates } from "../hooks/useRates";
import { convert, formatMoney } from "../services/fx";
import { Button, Card, EmptyState, Input, Label, Select } from "../components/ui";
import { toast } from "../components/Toast";

/**
 * Transfert entre 2 comptes : crée une paire de transactions
 * (sortie + entrée) liées par un même `recurringId` symbolique
 * pour pouvoir filtrer/retrouver le transfert.
 */
export default function Transfer() {
  const { user } = useSession();
  const userId = user!.id;
  const base = user!.baseCurrency;
  const { rates } = useRates(base);

  const accounts = useLiveQuery(() => db.accounts.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const categories = useLiveQuery(() => db.categories.where("userId").equals(userId).toArray(), [userId]) ?? [];

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const fromAcc = accounts.find((a) => a.id === from);
  const toAcc = accounts.find((a) => a.id === to);

  const convertedAmount =
    fromAcc && toAcc && amount
      ? convert(parseFloat(amount), fromAcc.currency, toAcc.currency, rates)
      : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromAcc || !toAcc || from === to) {
      toast.error("Veuillez sélectionner deux comptes différents");
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setLoading(true);
    try {
      // Catégorie "transfert" virtuelle : on crée à la volée si absente
      let transferCat = categories.find((c) => c.label === "Transfert");
      if (!transferCat) {
        const id = uid();
        await db.categories.add({
          id, userId, label: "Transfert", color: "#64748b", icon: "🔄",
          kind: "expense", parentId: null, createdAt: Date.now(),
        });
        transferCat = (await db.categories.get(id))!;
      }

      const linkId = uid();
      const ts = new Date(date).getTime();
      const desc = description.trim() || `Transfert ${fromAcc.name} → ${toAcc.name}`;

      await db.transactions.bulkAdd([
        {
          id: uid(), userId, accountId: from, categoryId: transferCat.id,
          amount: amt, type: "expense", currency: fromAcc.currency,
          date: ts, description: desc, recurringId: linkId, createdAt: Date.now(),
        },
        {
          id: uid(), userId, accountId: to, categoryId: transferCat.id,
          amount: convertedAmount, type: "income", currency: toAcc.currency,
          date: ts, description: desc, recurringId: linkId, createdAt: Date.now(),
        },
      ]);

      toast.success("Transfert enregistré",
        `${formatMoney(amt, fromAcc.currency)} de ${fromAcc.name} vers ${toAcc.name}`);
      setAmount("");
      setDescription("");
    } catch (err) {
      toast.error("Erreur", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (accounts.length < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transfert entre comptes</h1>
          <p className="text-sm text-slate-500">Déplacez de l'argent entre vos comptes</p>
        </div>
        <EmptyState
          icon="🏦"
          title="Au moins 2 comptes requis"
          description="Créez au moins deux comptes pour effectuer un transfert."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transfert entre comptes</h1>
        <p className="text-sm text-slate-500">Convertit automatiquement si les devises diffèrent</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
            <div>
              <Label>Depuis</Label>
              <Select value={from} onChange={(e) => setFrom(e.target.value)} required>
                <option value="">— Sélectionner —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === to}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </Select>
            </div>
            <div className="hidden sm:flex justify-center pb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                <ArrowRight size={18} />
              </div>
            </div>
            <div>
              <Label>Vers</Label>
              <Select value={to} onChange={(e) => setTo(e.target.value)} required>
                <option value="">— Sélectionner —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === from}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Montant ({fromAcc?.currency ?? "—"})</Label>
              <Input
                type="number" step="0.01" min="0"
                value={amount} onChange={(e) => setAmount(e.target.value)} required
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label>Description (optionnel)</Label>
            <Input
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex : Virement vers épargne"
            />
          </div>

          {fromAcc && toAcc && amount && fromAcc.currency !== toAcc.currency && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              <div className="font-medium">Conversion automatique</div>
              <div className="mt-1 text-xs">
                {formatMoney(parseFloat(amount) || 0, fromAcc.currency)} ≈{" "}
                <strong>{formatMoney(convertedAmount, toAcc.currency)}</strong>{" "}
                (taux actuel)
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading || !from || !to || from === to}>
              <ArrowRightLeft size={16} /> Effectuer le transfert
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div className="text-sm text-slate-600">
            <strong className="text-slate-900">Comment ça marche ?</strong> Le transfert crée
            deux transactions liées : une dépense sur le compte source et un revenu sur le compte
            de destination, dans la devise respective de chaque compte. La conversion est faite
            avec les taux de change en temps réel.
          </div>
        </div>
      </Card>
    </div>
  );
}
