import { create } from "zustand";
import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

// Helpers
export const toast = {
  success: (title: string, description?: string) =>
    useToast.getState().push({ type: "success", title, description }),
  error: (title: string, description?: string) =>
    useToast.getState().push({ type: "error", title, description }),
  info: (title: string, description?: string) =>
    useToast.getState().push({ type: "info", title, description }),
  warning: (title: string, description?: string) =>
    useToast.getState().push({ type: "warning", title, description }),
};

const styles: Record<ToastType, { bg: string; ring: string; icon: React.ReactNode; iconColor: string }> = {
  success: {
    bg: "bg-white",
    ring: "ring-emerald-200",
    icon: <CheckCircle2 size={20} />,
    iconColor: "text-emerald-600",
  },
  error: {
    bg: "bg-white",
    ring: "ring-rose-200",
    icon: <AlertCircle size={20} />,
    iconColor: "text-rose-600",
  },
  info: {
    bg: "bg-white",
    ring: "ring-sky-200",
    icon: <Info size={20} />,
    iconColor: "text-sky-600",
  },
  warning: {
    bg: "bg-white",
    ring: "ring-amber-200",
    icon: <AlertTriangle size={20} />,
    iconColor: "text-amber-600",
  },
};

export function ToastViewport() {
  const { toasts, remove } = useToast();
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const s = styles[toast.type];
  useEffect(() => {
    // animation: nothing needed, just mount
  }, []);
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl ${s.bg} p-4 shadow-lg ring-1 ${s.ring} animate-slide-in`}
      role="alert"
    >
      <div className={s.iconColor}>{s.icon}</div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-slate-900">{toast.title}</div>
        {toast.description && <div className="mt-0.5 text-xs text-slate-600">{toast.description}</div>}
      </div>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
        <X size={14} />
      </button>
    </div>
  );
}

// Confirm modal (replaces window.confirm)
interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmStore {
  current: (ConfirmOptions & { resolve: (v: boolean) => void }) | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  resolve: (v: boolean) => void;
}

export const useConfirm = create<ConfirmStore>((set, get) => ({
  current: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ current: { ...opts, resolve } });
    }),
  resolve: (v) => {
    const cur = get().current;
    if (cur) {
      cur.resolve(v);
      set({ current: null });
    }
  },
}));

export const confirmDialog = (opts: ConfirmOptions) => useConfirm.getState().ask(opts);

export function ConfirmViewport() {
  const { current, resolve } = useConfirm();
  if (!current) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => resolve(false)} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${current.danger ? "bg-rose-100 text-rose-600" : "bg-sky-100 text-sky-600"}`}>
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900">{current.title}</h3>
            {current.description && (
              <p className="mt-1 text-sm text-slate-600">{current.description}</p>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => resolve(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {current.cancelLabel ?? "Annuler"}
          </button>
          <button
            onClick={() => resolve(true)}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${current.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-sky-600 hover:bg-sky-700"}`}
          >
            {current.confirmLabel ?? "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
