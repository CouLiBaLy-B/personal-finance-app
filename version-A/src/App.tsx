import { useEffect } from "react";
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Budgets from "./pages/Budgets";
import Goals from "./pages/Goals";
import Recurring from "./pages/Recurring";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { useSession } from "./store/useSession";
import { processRecurring } from "./services/recurring";

// HashRouter pour fonctionner aussi bien en hébergement statique
// qu'en application packagée localement.
const Router = (typeof window !== "undefined" && window.location.protocol === "file:")
  ? HashRouter
  : BrowserRouter;

function ProtectedRoutes() {
  const { user, loading } = useSession();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">Chargement...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Layout />
  );
}

export default function App() {
  const { init, user } = useSession();

  useEffect(() => {
    init();
  }, [init]);

  // À chaque login, on traite les récurrences en retard
  useEffect(() => {
    if (user) processRecurring(user.id);
  }, [user]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginGuard />} />
        <Route element={<ProtectedRoutes />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="categories" element={<Categories />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="goals" element={<Goals />} />
          <Route path="recurring" element={<Recurring />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function LoginGuard() {
  const { user, loading } = useSession();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}
