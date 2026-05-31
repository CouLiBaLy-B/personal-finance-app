import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Trash2, Shield, Globe, RefreshCw, Server } from "lucide-react";
import { useSession } from "../store/useSession";
import { useRates } from "../hooks/useRates";
import { db } from "../db/database";
import { deleteAccount } from "../services/auth";
import { exportAllUserData } from "../services/importExport";
import { processRecurring } from "../services/recurring";
import { Button, Card, Label, Select } from "../components/ui";
import { SUPPORTED_CURRENCIES } from "../services/fx";
import { checkApiHealth, getApiBaseUrl, type ApiHealth } from "../services/api";

export default function Settings() {
  const { user, setUser, logout } = useSession();
  const { rates, loading } = useRates(user!.baseCurrency);
  const navigate = useNavigate();
  const [currency, setCurrency] = useState(user!.baseCurrency);
  const [saving, setSaving] = useState(false);
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  async function refreshApiHealth() {
    setApiError(null);
    try {
      setApiHealth(await checkApiHealth());
    } catch (err) {
      setApiHealth(null);
      setApiError(err instanceof Error ? err.message : "API indisponible");
    }
  }

  useEffect(() => {
    refreshApiHealth();
  }, []);

  async function handleCurrencyChange() {
    setSaving(true);
    await db.users.update(user!.id, { baseCurrency: currency });
    const updated = await db.users.get(user!.id);
    if (updated) setUser(updated);
    setSaving(false);
  }

  async function handleExport() {
    await exportAllUserData(user!.id);
  }

  async function handleProcessRecurring() {
    const n = await processRecurring(user!.id);
    alert(`${n} transaction(s) générée(s).`);
  }

  async function handleDelete() {
    const confirm1 = confirm("⚠️ Supprimer définitivement votre compte et TOUTES vos données ?");
    if (!confirm1) return;
    const confirm2 = prompt('Tapez "SUPPRIMER" pour confirmer.');
    if (confirm2 !== "SUPPRIMER") return;
    await deleteAccount(user!.id);
    await logout();
    navigate("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-sm text-slate-500">Gérez votre compte et vos préférences</p>
      </div>

      {/* Profil */}
      <Card className="p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          👤 Mon profil
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Nom</Label>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{user!.fullName}</div>
          </div>
          <div>
            <Label>Email</Label>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{user!.email}</div>
          </div>
        </div>
      </Card>

      {/* Devise & taux */}
      <Card className="p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Globe size={16} /> Devise principale
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48">
            <Label>Devise</Label>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <Button onClick={handleCurrencyChange} disabled={currency === user!.baseCurrency || saving}>
            Enregistrer
          </Button>
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <div className="font-medium text-slate-700">
            Taux de change actuels (base : {user!.baseCurrency}) {loading && <span className="text-slate-400">— chargement...</span>}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-5">
            {SUPPORTED_CURRENCIES.filter((c) => c !== user!.baseCurrency).map((c) => (
              <div key={c} className="rounded bg-white px-2 py-1">
                <span className="text-slate-500">{c}</span>{" "}
                <span className="font-mono text-slate-900">{rates[c]?.toFixed(3) ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Maintenance */}
      <Card className="p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <RefreshCw size={16} /> Maintenance
        </h3>
        <p className="mb-3 text-sm text-slate-600">
          Génère manuellement les transactions récurrentes dues à ce jour.
        </p>
        <Button variant="outline" onClick={handleProcessRecurring}>
          <RefreshCw size={14} /> Générer les récurrences
        </Button>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Server size={16} /> Intégration backend
        </h3>
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-slate-900">{getApiBaseUrl()}</div>
              <div className={apiHealth ? "text-emerald-600" : "text-amber-600"}>
                {apiHealth ? `API disponible (${apiHealth.version ?? "version inconnue"})` : apiError ?? "Vérification..."}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={refreshApiHealth}>
              <RefreshCw size={14} /> Tester
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          L'application reste local-first. Ce test valide la passerelle HTTP vers l'API Docker / Express pour une synchronisation future.
        </p>
      </Card>

      {/* RGPD */}
      <Card className="border-amber-200 p-6">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Shield size={16} /> Confidentialité & RGPD
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          Conformément au RGPD, vous pouvez à tout moment exporter ou supprimer toutes vos données.
          Toutes vos informations sont stockées localement sur cet appareil, chiffrées par le
          navigateur (IndexedDB).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download size={14} /> Exporter toutes mes données (JSON)
          </Button>
        </div>
      </Card>

      {/* Zone dangereuse */}
      <Card className="border-rose-200 p-6">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-700">
          <Trash2 size={16} /> Zone dangereuse
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          La suppression de votre compte est <strong>irréversible</strong>. Toutes vos transactions,
          budgets, objectifs et catégories seront définitivement effacés.
        </p>
        <Button variant="danger" onClick={handleDelete}>
          <Trash2 size={14} /> Supprimer mon compte et mes données
        </Button>
      </Card>
    </div>
  );
}
