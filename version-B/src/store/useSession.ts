import { create } from "zustand";
import type { User } from "../db/database";
import { getCurrentUser, logout as doLogout } from "../services/auth";

interface SessionState {
  user: User | null;
  loading: boolean;
  online: boolean;
  init: () => Promise<void>;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  loading: true,
  online: navigator.onLine,
  init: async () => {
    set({ loading: true });
    const u = await getCurrentUser();
    set({ user: u, loading: false });
  },
  setUser: (u) => set({ user: u }),
  logout: async () => {
    await doLogout();
    set({ user: null });
  },
}));

// Synchronise l'état online/offline
window.addEventListener("online", () => useSession.setState({ online: true }));
window.addEventListener("offline", () => useSession.setState({ online: false }));
