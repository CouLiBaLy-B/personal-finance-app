/**
 * Layout — sidebar navigation + connectivity indicator.
 * Consolidated from Version C (Transfer route) + online status badge.
 */
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  ArrowRightLeft,
  Tag,
  PiggyBank,
  Target,
  Repeat,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  WifiOff,
  Cloud,
  CloudOff,
} from "lucide-react";
import { useSession } from "../store/useSession";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { usePWA } from "../hooks/usePWA";

const nav = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/accounts", label: "Comptes", icon: Landmark },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/transfer", label: "Transfert", icon: ArrowRightLeft },
  { to: "/categories", label: "Catégories", icon: Tag },
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/goals", label: "Objectifs", icon: Target },
  { to: "/recurring", label: "Récurrences", icon: Repeat },
  { to: "/reports", label: "Rapports", icon: BarChart3 },
  { to: "/settings", label: "Paramètres", icon: Settings },
];

export default function Layout() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { browserOnline, backendOnline } = useOnlineStatus();
  const { canInstall, install } = usePWA();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const statusLabel = !browserOnline
    ? "Hors-ligne"
    : backendOnline
      ? "Connecté"
      : "Mode local";

  const StatusIcon = !browserOnline ? WifiOff : backendOnline ? Cloud : CloudOff;
  const statusColor = !browserOnline
    ? "text-rose-500"
    : backendOnline
      ? "text-emerald-500"
      : "text-amber-500";

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar – desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-lg">💰</div>
          <span className="text-lg font-bold text-slate-900">FinTrack</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {nav.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive
                      ? "bg-sky-50 text-sky-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`
                  }
                >
                  <n.icon size={18} />
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* PWA install + Connectivity */}
        <div className="border-t border-slate-100 px-4 py-2 space-y-1">
          {canInstall && (
            <button
              onClick={install}
              className="flex w-full items-center gap-2 rounded-lg bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 transition"
            >
              📲 Installer l'app
            </button>
          )}
          <div className={`flex items-center gap-2 text-xs ${statusColor}`}>
            <StatusIcon size={14} />
            <span>{statusLabel}</span>
          </div>
        </div>

        {/* User card */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
              {user?.fullName?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{user?.fullName}</div>
              <div className="truncate text-xs text-slate-500">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Déconnexion"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
              <Menu size={20} />
            </button>
            <span className="text-base font-bold text-slate-900">FinTrack</span>
          </div>
          <div className={`flex items-center gap-1 text-xs ${statusColor}`}>
            <StatusIcon size={12} />
            <span>{statusLabel}</span>
          </div>
        </header>

        {/* Mobile overlay nav */}
        {open && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
            <div className="relative w-72 bg-white shadow-xl">
              <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
                <span className="text-base font-bold text-slate-900">FinTrack</span>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
              <nav className="p-3">
                <ul className="space-y-0.5">
                  {nav.map((n) => (
                    <li key={n.to}>
                      <NavLink
                        to={n.to}
                        end={n.to === "/"}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive
                            ? "bg-sky-50 text-sky-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`
                        }
                      >
                        <n.icon size={18} />
                        {n.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 p-4">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  <LogOut size={18} />
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
