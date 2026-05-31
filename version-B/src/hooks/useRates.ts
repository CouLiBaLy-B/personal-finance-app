import { useEffect, useState } from "react";
import { getRates } from "../services/fx";

export function useRates(base: string) {
  const [rates, setRates] = useState<Record<string, number>>({ [base]: 1 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getRates(base).then((r) => {
      if (alive) {
        setRates(r);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [base]);
  return { rates, loading };
}
