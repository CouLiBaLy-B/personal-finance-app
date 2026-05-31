/**
 * Hook to detect online/offline + backend availability.
 */
import { useState, useEffect, useCallback } from "react";
import { isBackendOnline, resetOnlineCache } from "../services/auth-hybrid";

export function useOnlineStatus() {
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const checkBackend = useCallback(async () => {
    resetOnlineCache();
    const online = await isBackendOnline();
    setBackendOnline(online);
  }, []);

  useEffect(() => {
    const handleOnline = () => { setBrowserOnline(true); checkBackend(); };
    const handleOffline = () => { setBrowserOnline(false); setBackendOnline(false); };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    checkBackend();

    // Periodic check every 30s
    const interval = setInterval(checkBackend, 30_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkBackend]);

  return { browserOnline, backendOnline, refresh: checkBackend };
}
