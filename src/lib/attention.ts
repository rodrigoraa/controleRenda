import {
  addDays,
  addMonths,
  dateInMonth,
  invoice,
  monthOf,
  occurrences,
} from "./finance";
import type { Occurrence, State } from "./types";

type PendingTransfer = { month: string; date: string; amount: number };

export function collectAttention(state: State, today: string) {
  const through = addDays(today, 7);
  const lastMonth = monthOf(through);
  const movements: Occurrence[] = [];
  const unknown: Occurrence[] = [];
  const invoices: PendingTransfer[] = [];
  const reimbursements: PendingTransfer[] = [];
  const seenPurchases = new Set<string>();

  for (
    let month = state.settings.initialMonth;
    month <= lastMonth;
    month = addMonths(month, 1)
  ) {
    for (const row of occurrences(state, month)) {
      if (row.method === "account" && !row.settledOn && row.date <= through)
        movements.push(row);
      if (
        row.method === "card" &&
        row.owner === "unknown" &&
        month <= monthOf(today)
      ) {
        const key = row.installment
          ? `purchase:${row.installment.group}`
          : row.key;
        if (!seenPurchases.has(key)) {
          seenPurchases.add(key);
          unknown.push(row);
        }
      }
    }
    const date = dateInMonth(month, state.settings.invoiceDay);
    if (date <= through) {
      const bill = invoice(state, month);
      if (bill.outstanding > 0)
        invoices.push({ month, date, amount: bill.outstanding });
      if (bill.toReceive > 0)
        reimbursements.push({ month, date, amount: bill.toReceive });
    }
  }
  return {
    movements,
    unknown,
    invoices,
    reimbursements,
    total:
      movements.length +
      unknown.length +
      invoices.length +
      reimbursements.length,
  };
}
