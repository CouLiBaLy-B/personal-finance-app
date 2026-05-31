import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { db, uid, type RecurringTransaction } from "../db/database";

/**
 * Vérifie toutes les récurrentes de l'utilisateur et génère
 * les transactions dues (jusqu'à aujourd'hui).
 * Appelée au login et à chaque ouverture de l'app.
 */
export async function processRecurring(userId: string): Promise<number> {
  const now = Date.now();
  const all = await db.recurring.where("userId").equals(userId).toArray();
  let generated = 0;

  for (const r of all) {
    if (r.endDate && r.endDate < now) continue;
    let next = r.nextDate;
    while (next <= now && (!r.endDate || next <= r.endDate)) {
      await db.transactions.add({
        id: uid(),
        userId,
        accountId: r.accountId,
        categoryId: r.categoryId,
        amount: r.amount,
        type: r.type,
        currency: r.currency,
        date: next,
        description: `${r.description} (récurrent)`,
        recurringId: r.id,
        createdAt: Date.now(),
      });
      generated++;
      next = bumpDate(next, r.frequency);
    }
    if (next !== r.nextDate) {
      await db.recurring.update(r.id, { nextDate: next });
    }
  }
  return generated;
}

function bumpDate(ts: number, freq: RecurringTransaction["frequency"]): number {
  const d = new Date(ts);
  switch (freq) {
    case "daily":
      return addDays(d, 1).getTime();
    case "weekly":
      return addWeeks(d, 1).getTime();
    case "monthly":
      return addMonths(d, 1).getTime();
    case "yearly":
      return addYears(d, 1).getTime();
  }
}
