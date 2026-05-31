import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Label, Select } from "../components/ui";
import { login, register } from "../services/auth";
import { useSession } from "../store/useSession";
import { SUPPORTED_CURRENCIES } from "../services/fx";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setUser = useSession((s) => s.setUser);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user =
        mode === "login"
          ? await login(email, password)
          : await register(email, password, fullName, currency);
      setUser(user);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-blue-100 p-4">
      <div className="grid w-full max-w-5xl gap-8 overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-2">
        {/* Visual side */}
        <div className="relative hidden bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl backdrop-blur">
                💰
              </div>
              <span className="text-xl font-bold">FinTrack</span>
            </div>
            <h2 className="mt-12 text-3xl font-bold leading-tight">
              Reprenez le contrôle de vos finances.
            </h2>
            <p className="mt-3 text-sky-100">
              Suivez vos revenus, dépenses, budgets et objectifs d'épargne dans une interface
              moderne et entièrement privée.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              "💼 Gestion multi-comptes & multi-devises",
              "📊 Graphiques et bilans PDF détaillés",
              "🔁 Transactions récurrentes automatisées",
              "🔒 100% local, conforme RGPD",
              "📴 Fonctionne hors-ligne",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sky-50">
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Form side */}
        <div className="p-8 lg:p-12">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-xl">
              💰
            </div>
            <span className="text-xl font-bold text-slate-900">FinTrack</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            {mode === "login" ? "Bon retour !" : "Créez votre compte"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "login"
              ? "Connectez-vous pour accéder à vos finances."
              : "Quelques secondes suffisent. Vos données restent sur cet appareil."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "register" && (
              <div>
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jean Dupont"
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
              />
            </div>
            {mode === "register" && (
              <div>
                <Label htmlFor="currency">Devise principale</Label>
                <Select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Patientez..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            {mode === "login" ? (
              <>
                Pas encore de compte ?{" "}
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="font-semibold text-sky-600 hover:underline"
                >
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                Déjà inscrit ?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-semibold text-sky-600 hover:underline"
                >
                  Se connecter
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
