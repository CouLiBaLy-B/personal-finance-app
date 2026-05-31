import { PrismaClient, RecurringTransaction } from "@prisma/client";
import { addDays, addWeeks, addMonths, addYears } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { logger } from "./logger";

/**
 * Génère les transactions récurrentes en retard (jusqu'à aujourd'hui).
 * Appelé par le cron intégré toutes les 6h, mais peut aussi être appelé
 * manuellement via /api/v1/recurring/sync.
 */
export async function processRecurringTransactions(prisma: PrismaClient): Promise<number> {
  const now = new Date();
  const recurring = await prisma.recurringTransaction.findMany({
    where: { OR: [{ endDate: null }, { endDate: { gte: now } }] },
  });

  let generated = 0;

  for (const r of recurring) {
    let nextDate = new Date(r.nextDate);
    const limitDate = r.endDate ? new Date(r.endDate) : new Date(now);

    while (nextDate.getTime() <= Math.min(limitDate.getTime(), now.getTime())) {
      await prisma.transaction.create({
        data: {
          id: uuidv4(),
          userId: r.userId,
          accountId: r.accountId,
          categoryId: r.categoryId,
          amount: r.amount,
          type: r.type,
          currency: r.currency,
          date: new Date(nextDate),
          description: `${r.description} (récurrent)`,
          recurringId: r.id,
        },
      });
      nextDate = nextDateForFrequency(nextDate, r.frequency);
      generated++;
    }

    if (nextDate.getTime() !== r.nextDate.getTime()) {
      await prisma.recurringTransaction.update({
        where: { id: r.id },
        data: { nextDate },
      });
    }
  }

  if (generated > 0) logger.info(`[RECURRING] ${generated} transaction(s) générée(s)`);
  return generated;
}

function nextDateForFrequency(
  d: Date,
  frequency: RecurringTransaction["frequency"]
): Date {
  switch (frequency) {
    case "daily":
      return addDays(d, 1);
    case "weekly":
      return addWeeks(d, 1);
    case "monthly":
      return addMonths(d, 1);
    case "yearly":
      return addYears(d, 1);
  }
}
