import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Plus, Trash2, Wallet, CreditCard, PiggyBank, Banknote } from "lucide-react";
import { db, uid, type AccountType } from "../db/database";
import { useSession } from "../store/useSession";
import { useRates } from "../hooks/useRates";
import { convert, formatMoney, SUPPORTED_CURRENCIES } from "../services/fx";
import { Button, Card, EmptyState, Input, Label, Modal, Select } from "../components/ui";

const ACCOUNT_TYPES: { value: AccountType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "checking", label: "Compte courant", icon: <Wallet size={18} />, color: "from-sky-500 to-blue-600" },
  { value: "saving", label: "Épargne", icon: <PiggyBank size={18} />, color: "from-emerald-500 to-green-600" },
  { value: "cash", label: "Espèces", icon: <Banknote size={18} />, color: "from-amber-500 to-orange-600" },
  { value: "card", label: "Carte", icon: <CreditCard size={18} />, color: "from-violet-500 to-purple-600" },
];

export default function Accounts() {
  const { user } = useSession();
  const userId = user!.id;
  const base = user!.baseCurrency;
  const { rates } = useRates(base);
  const accounts = useLiveQuery(() => db.accounts.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const transactions =
    useLiveQuery(() => db.transactions.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const [open, setOpen] = useState(false);

  // Calcul solde réel par compte
  function balanceOf(accountId: string, currency: string) {
    const account = accounts.find((a) => a.id === accountId);
    let bal = account?.initialBalance ?? 0;
    for (const t of transactions) {
      if (t.accountId !== accountId) continue;
      const amt = convert(t.amount, t.currency, currency, rates);
      bal += t.type === "income" ? amt : -amt;
    }
    return bal;
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce compte et toutes ses transactions ?")) return;
    await db.transaction("rw", [db.accounts, db.transactions], async () => {
      await db.transactions.where("accountId").equals(id).delete();
      await db.accounts.delete(id);
    });
  }

  const totalBalance = accounts.reduce((sum, a) => sum + convert(balanceOf(a.id, a.currency), a.currency, base, rates), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mes comptes</h1>
          <p className="text-sm text-slate-500">
            Patrimoine total : <span className="font-semibold text-slate-900">{formatMoney(totalBalance, base)}</span>
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Nouveau compte
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon="🏦"
          title="Aucun compte"
          description="Créez votre premier compte pour commencer à suivre vos finances."
          action={<Button onClick={() => setOpen(true)}><Plus size={16} /> Ajouter un compte</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => {
            const meta = ACCOUNT_TYPES.find((t) => t.value === a.type) ?? ACCOUNT_TYPES[0];
            const bal = balanceOf(a.id, a.currency);
            return (
              <Card key={a.id} className="overflow-hidden">
                <div className={`bg-gradient-to-br ${meta.color} p-5 text-white`}>
                  <div className="flex items-start justify-between">
                    <div className="rounded-lg bg-white/20 p-2 backdrop-blur">{meta.icon}</div>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="rounded-lg p-1.5 text-white/70 hover:bg-white/20 hover:text-white"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-4 text-xs uppercase tracking-wide opacity-80">{meta.label}</div>
                  <div className="text-lg font-semibold">{a.name}</div>
                  <div className="mt-3 text-2xl font-bold">{formatMoney(bal, a.currency)}</div>
                  {a.currency !== base && (
                    <div className="mt-1 text-xs opacity-80">
                      ≈ {formatMoney(convert(bal, a.currency, base, rates), base)}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <NewAccountModal open={open} onClose={() => setOpen(false)} userId={userId} defaultCurrency={base} />
    </div>
  );
}

function NewAccountModal({
  open,
  onClose,
  userId,
  defaultCurrency,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  defaultCurrency: string;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [initialBalance, setInitialBalance] = useState("0");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await db.accounts.add({
      id: uid(),
      userId,
      name: name.trim(),
      type,
      currency,
      initialBalance: parseFloat(initialBalance) || 0,
      createdAt: Date.now(),
    });
    setName("");
    setInitialBalance("0");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouveau compte">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Nom du compte</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex : Livret A" />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Devise</Label>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Solde initial</Label>
            <Input type="number" step="0.01" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} />
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
