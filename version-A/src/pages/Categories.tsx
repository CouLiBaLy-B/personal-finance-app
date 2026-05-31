import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { db, uid } from "../db/database";
import { useSession } from "../store/useSession";
import { Button, Card, EmptyState, Input, Label, Modal, Select } from "../components/ui";

const ICONS = ["🛒", "🏠", "🚗", "🎬", "💊", "📺", "🍽️", "🛍️", "💼", "💻", "🎁", "📈", "✈️", "📚", "🎮", "💡", "🐶", "👶", "👕", "💄"];
const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899", "#8b5cf6", "#10b981", "#0ea5e9", "#f43f5e", "#eab308"];

export default function Categories() {
  const { user } = useSession();
  const userId = user!.id;
  const categories = useLiveQuery(() => db.categories.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const transactions = useLiveQuery(() => db.transactions.where("userId").equals(userId).toArray(), [userId]) ?? [];
  const [open, setOpen] = useState(false);

  async function handleDelete(id: string) {
    const used = transactions.some((t) => t.categoryId === id);
    if (used && !confirm("Cette catégorie est utilisée. Voulez-vous vraiment la supprimer (les transactions ne seront pas supprimées) ?")) return;
    await db.categories.delete(id);
  }

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const incomeCats = categories.filter((c) => c.kind === "income");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catégories</h1>
          <p className="text-sm text-slate-500">{categories.length} catégorie{categories.length > 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Nouvelle
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState icon="🏷️" title="Aucune catégorie" description="Créez votre première catégorie." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CategorySection title="Dépenses" color="rose" cats={expenseCats} onDelete={handleDelete} />
          <CategorySection title="Revenus" color="emerald" cats={incomeCats} onDelete={handleDelete} />
        </div>
      )}

      <NewCategoryModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function CategorySection({
  title,
  color,
  cats,
  onDelete,
}: {
  title: string;
  color: "rose" | "emerald";
  cats: Array<{ id: string; label: string; icon: string; color: string }>;
  onDelete: (id: string) => void;
}) {
  const ring = color === "rose" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700";
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ring}`}>{cats.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cats.map((c) => (
          <div
            key={c.id}
            className="group flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            style={{ borderLeftColor: c.color, borderLeftWidth: 3 }}
          >
            <span className="text-lg">{c.icon}</span>
            <span className="flex-1 truncate text-sm text-slate-700">{c.label}</span>
            <button
              onClick={() => onDelete(c.id)}
              className="rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NewCategoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSession();
  const userId = user!.id;
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await db.categories.add({
      id: uid(),
      userId,
      label: label.trim(),
      kind,
      icon,
      color,
      parentId: null,
      createdAt: Date.now(),
    });
    setLabel("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle catégorie">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Nom</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="Ex : Cinéma" />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={kind} onChange={(e) => setKind(e.target.value as "expense" | "income")}>
            <option value="expense">Dépense</option>
            <option value="income">Revenu</option>
          </Select>
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
              >
                {i}
              </button>
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
