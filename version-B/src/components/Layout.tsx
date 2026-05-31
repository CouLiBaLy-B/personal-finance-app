import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Tags,
  PiggyBank,
  Target,
  Repeat,
  FileBarChart2,
  Settings,
  LogOut,
  WifiOff,
  Wifi,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useSession } from "../store/useSession";
import { cn } from "../utils/cn";

const navItems = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/accounts", label: "Comptes", icon: Wallet },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/categories", label: "Catégories", icon: Tags },
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/goals", label: "Objectifs", icon: Target },
  { to: "/recurring", label: "Récurrentes", icon: Repeat },
  { to: "/reports", label: "Rapports", icon: FileBarChart2 },
  { to: "/settings", label: "Paramètres", icon: Settings },
];

export default function Layout() {
  const { user, logout, online } = useSession();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {/* Sidebar (mobile drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="lg:hidden">
              <span className="text-lg font-bold text-slate-900">FinTrack</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              )}
              title={online ? "En ligne" : "Hors-ligne — vos données sont sauvegardées localement"}
            >
              {online ? <Wifi size={12} /> : <WifiOff size={12} />}
              {online ? "En ligne" : "Hors-ligne"}
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-900">{user?.fullName}</div>
              <div className="text-xs text-slate-500">{user?.email}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 font-semibold text-white">
              {user?.fullName.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Déconnexion"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );

  function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
    return (
      <>
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-lg">
            💰
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">FinTrack</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Personal finance</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sky-50 text-sky-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-4 text-xs text-slate-400">
          <div>FinTrack v1.0 · Local-first</div>
          <div className="mt-0.5">🔒 Données chiffrées sur cet appareil</div>
        </div>
      </>
    );
  }
}
