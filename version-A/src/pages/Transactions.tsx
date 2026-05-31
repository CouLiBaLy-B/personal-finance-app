import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Plus, Trash2, Search, Upload, Download } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { db, uid } from "../db/database";
import { useSession } from "../store/useSession";
import { formatMoney } from "../services/fx";
import { Badge, Button, Card, EmptyState, Input, Label, Modal, Select } from "../components/ui";
import { exportTransactionsCsv, importCsv, parseCsv, type ImportPreview } from "../services/importExport";

export default function Transactions() {
  const { user } = useSession();
  const userId = user!.id;

  const accounts = useLiveQuery(() => db.accounts.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const categories = useLiveQuery(() => db.categories.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const transactions = useLiveQuery(
    () => db.transactions.where("userId").equals(userId).reverse().sortBy("date"),
    [userId]
  ) ?? [];

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [accountFilter, setAccountFilter] = useState("all");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (accountFilter !== "all" && t.accountId !== accountFilter) return false;
      if (filter && !t.description.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filter, typeFilter, accountFilter]);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette transaction ?")) return;
    await db.transactions.delete(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500">{filtered.length} transaction{filtered.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportTransactionsCsv(filtered, categories, accounts)}>
            <Download size={16} /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={16} /> Import CSV
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Nouvelle
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | "income" | "expense")}>
            <option value="all">Tous les types</option>
            <option value="income">Revenus</option>
            <option value="expense">Dépenses</option>
          </Select>
          <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            <option value="all">Tous les comptes</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon="💸"
          title="Aucune transaction"
          description="Ajoutez votre première transaction ou importez un relevé CSV."
          action={<Button onClick={() => setOpen(true)}><Plus size={16} /> Nouvelle transaction</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Compte</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => {
                  const cat = categories.find((c) => c.id === t.categoryId);
                  const acc = accounts.find((a) => a.id === t.accountId);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {format(new Date(t.date), "dd MMM yyyy", { locale: fr })}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{t.description}</td>
                      <td className="px-4 py-3">
                        {cat ? (
                          <Badge color="slate">
                            <span className="mr-1">{cat.icon}</span>{cat.label}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{acc?.name ?? "—"}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                        {t.type === "income" ? "+" : "-"}{formatMoney(t.amount, t.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(t.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <TransactionModal open={open} onClose={() => setOpen(false)} />
      <ImportCsvModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function TransactionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSession();
  const userId = user!.id;
  const accounts = useLiveQuery(() => db.accounts.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const categories = useLiveQuery(() => db.categories.where("userId").equals(userId).toArray(), [userId]) ?? [];

  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const filteredCats = categories.filter((c) => c.kind === type);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return;
    await db.transactions.add({
      id: uid(),
      userId,
      accountId,
      categoryId,
      amount: Math.abs(parseFloat(amount)),
      type,
      currency: acc.currency,
      date: new Date(date).getTime(),
      description: description.trim() || "Sans description",
      createdAt: Date.now(),
    });
    setAmount("");
    setDescription("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle transaction">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-md py-2 text-sm font-medium transition ${
                type === t ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
              }`}
            >
              {t === "expense" ? "💸 Dépense" : "💰 Revenu"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Montant</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex : Courses Carrefour" />
        </div>
        <div>
          <Label>Compte</Label>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            <option value="">— Sélectionner —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Catégorie</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">— Sélectionner —</option>
            {filteredCats.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

function ImportCsvModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSession();
  const userId = user!.id;
  const accounts = useLiveQuery(() => db.accounts.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const categories = useLiveQuery(() => db.categories.where("userId").equals(userId).toArray(), [userId]) ?? [];

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [dateCol, setDateCol] = useState("");
  const [descCol, setDescCol] = useState("");
  const [amountCol, setAmountCol] = useState("");
  const [catCol, setCatCol] = useState("");
  const [accountId, setAccountId] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function handleFile(f: File) {
    setFile(f);
    setResult(null);
    const p = await parseCsv(f);
    setPreview(p);
    // Auto-détection
    for (const c of p.columns) {
      const lc = c.toLowerCase();
      if (!dateCol && /date/.test(lc)) setDateCol(c);
      if (!descCol && /(desc|libell|label|memo)/.test(lc)) setDescCol(c);
      if (!amountCol && /(amount|montant|debit|credit)/.test(lc)) setAmountCol(c);
      if (!catCol && /(categ|category)/.test(lc)) setCatCol(c);
    }
  }

  async function handleImport() {
    if (!file || !accountId || !defaultCategoryId) return;
    const acc = accounts.find((a) => a.id === accountId)!;
    const n = await importCsv(
      file,
      { date: dateCol, description: descCol, amount: amountCol, category: catCol || undefined },
      userId,
      accountId,
      defaultCategoryId,
      acc.currency
    );
    setResult(`✓ ${n} transactions importées avec succès`);
    setTimeout(() => {
      setResult(null);
      setFile(null);
      setPreview(null);
      onClose();
    }, 1800);
  }

  return (
    <Modal open={open} onClose={onClose} title="Importer un relevé CSV" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {!preview && (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:bg-slate-100">
            <Upload size={32} className="mb-2 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Cliquez pour sélectionner un fichier CSV</span>
            <span className="mt-1 text-xs text-slate-500">Formats : Date, Description, Montant (négatif=dépense)</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        )}

        {preview && (
          <>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <strong>{preview.total}</strong> lignes détectées dans <strong>{file?.name}</strong>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Colonne Date *</Label>
                <Select value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
                  <option value="">—</option>
                  {preview.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Colonne Montant *</Label>
                <Select value={amountCol} onChange={(e) => setAmountCol(e.target.value)}>
                  <option value="">—</option>
                  {preview.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Colonne Description *</Label>
                <Select value={descCol} onChange={(e) => setDescCol(e.target.value)}>
                  <option value="">—</option>
                  {preview.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Colonne Catégorie (optionnel)</Label>
                <Select value={catCol} onChange={(e) => setCatCol(e.target.value)}>
                  <option value="">—</option>
                  {preview.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Compte de destination *</Label>
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">—</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>Catégorie par défaut *</Label>
                <Select value={defaultCategoryId} onChange={(e) => setDefaultCategoryId(e.target.value)}>
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </Select>
              </div>
            </div>
            {result && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{result}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Annuler</Button>
              <Button onClick={handleImport} disabled={!dateCol || !amountCol || !descCol || !accountId || !defaultCategoryId}>
                Importer
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
