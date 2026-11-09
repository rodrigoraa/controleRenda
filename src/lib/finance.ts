import type { State, Occurrence, Invoice, Summary, Entry } from "./types";
export function monthOf(date: string): string {
  return date.slice(0, 7);
}
export function addMonths(month: string, count: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1 + count, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function dateInMonth(month: string, day: number): string {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(Math.max(1, day), last)).padStart(2, "0")}`;
}
export function parseMoney(input: string): number | null {
  let value = input.trim().replace(/^R\$\s*/, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value))
    value = value.replaceAll(".", "");
  if (!/^\d+([.,]\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= 100_000_000_000
    ? amount
    : null;
}
export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const moneyInput = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");
export const monthLabel = (month: string, short = false) =>
  new Intl.DateTimeFormat("pt-BR", {
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-15T12:00:00Z`));
export const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const shortDate = (date: string) =>
  `${date.slice(8, 10)}/${date.slice(5, 7)}`;
export function occurrences(state: State, month: string): Occurrence[] {
  if (month < state.settings.initialMonth) return [];
  return state.entries
    .flatMap((entry) => {
      const first = monthOf(entry.date);
      if (
        month < first ||
        (entry.repeat === "none" && month !== first) ||
        (entry.endMonth && month > entry.endMonth)
      )
        return [];
      const key = `${entry.id}:${month}`;
      if (state.skipped.includes(key)) return [];
      return [
        {
          ...entry,
          ...state.overrides[key],
          date: dateInMonth(month, Number(entry.date.slice(8))),
          key,
          month,
          settledOn: state.settled[key]?.date,
        },
      ];
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.description.localeCompare(b.description),
    );
}
export function invoice(state: State, month: string): Invoice {
  const purchases = occurrences(state, month).filter(
    (e) => e.method === "card",
  );
  const total = purchases.reduce((s, e) => s + e.amount, 0);
  const byOwner = (owner: Entry["owner"]) =>
    purchases
      .filter((e) => e.owner === owner)
      .reduce((s, e) => s + e.amount, 0);
  const paid = state.payments
    .filter((p) => p.month === month)
    .reduce((s, p) => s + p.amount, 0);
  const received = state.reimbursements
    .filter((p) => p.month === month)
    .reduce((s, p) => s + p.amount, 0);
  const mother = byOwner("mother");
  return {
    otherParts: (state.people ?? [])
      .map((person) => ({
        owner: person.id,
        name: person.name,
        amount: byOwner(person.id),
      }))
      .filter((part) => part.amount > 0),
    total,
    me: byOwner("me"),
    mother,
    unknown: byOwner("unknown"),
    paid,
    outstanding: Math.max(0, total - paid),
    received,
    toReceive: Math.max(0, mother - received),
    credit: Math.max(0, paid - total),
  };
}
type Event = { date: string; amount: number; actual: boolean };
function cashEvents(state: State, horizon: string): Event[] {
  const events: Event[] = [];
  const initialDate = `${state.settings.initialMonth}-01`;
  // Include future invoice/entry references already paid early.
  const referenced = [
    ...state.payments.map((p) => p.month),
    ...state.reimbursements.map((p) => p.month),
    ...Object.keys(state.settled).map((k) => k.slice(-7)),
  ];
  const through = referenced.reduce(
    (latest, m) => (m > latest ? m : latest),
    horizon,
  );
  for (let m = state.settings.initialMonth; m <= through; m = addMonths(m, 1)) {
    for (const entry of occurrences(state, m).filter(
      (e) => e.method === "account",
    )) {
      events.push({
        date: entry.settledOn ?? entry.date,
        amount: entry.amount * (entry.kind === "income" ? 1 : -1),
        actual: !!entry.settledOn,
      });
    }
    const bill = invoice(state, m);
    const date = dateInMonth(m, state.settings.invoiceDay);
    if (bill.outstanding)
      events.push({ date, amount: -bill.outstanding, actual: false });
    if (bill.toReceive)
      events.push({ date, amount: bill.toReceive, actual: false });
  }
  state.payments.forEach((p) =>
    events.push({ date: p.date, amount: -p.amount, actual: true }),
  );
  state.reimbursements.forEach((p) =>
    events.push({ date: p.date, amount: p.amount, actual: true }),
  );
  return events.filter((e) => e.date >= initialDate);
}
export function summarize(state: State, month: string, today: string): Summary {
  const events = cashEvents(
    state,
    [addMonths(month, 1), monthOf(today)].sort().at(-1)!,
  );
  const at = (m: string) =>
    state.settings.openingBalance +
    events
      .filter((e) => monthOf(e.date) <= m)
      .reduce((s, e) => s + e.amount, 0);
  const rows = occurrences(state, month);
  const sum = (filter: (entry: Occurrence) => boolean) =>
    rows.filter(filter).reduce((s, e) => s + e.amount, 0);
  const bill = invoice(state, month);
  const monthEvents = events.filter((event) => monthOf(event.date) === month);
  const inflows = monthEvents
    .filter((event) => event.amount > 0)
    .reduce((sum, event) => sum + event.amount, 0);
  const outflows = monthEvents
    .filter((event) => event.amount < 0)
    .reduce((sum, event) => sum - event.amount, 0);
  return {
    starting: at(addMonths(month, -1)),
    inflows,
    outflows,
    monthlyChange: inflows - outflows,
    nextMonthlyChange: at(addMonths(month, 1)) - at(month),
    available:
      state.settings.openingBalance +
      events
        .filter((e) => e.actual && e.date <= today)
        .reduce((s, e) => s + e.amount, 0),
    closing: at(month),
    nextClosing: at(addMonths(month, 1)),
    income: sum((e) => e.kind === "income"),
    expenses: sum((e) => e.kind === "expense"),
    personalExpenses: sum(
      (e) =>
        e.kind === "expense" && (e.owner === "me" || e.owner === "unknown"),
    ),
    pendingIncome:
      sum((e) => e.kind === "income" && !e.settledOn) + bill.toReceive,
    pendingExpenses:
      sum(
        (e) => e.kind === "expense" && e.method === "account" && !e.settledOn,
      ) + bill.outstanding,
    invoice: bill,
  };
}
/** Reconcile with the bank without inventing income or counting confirmed movements twice. */
export function withCurrentBalance(
  state: State,
  amount: number,
  today: string,
): State {
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 100_000_000_000)
    throw new Error("Informe um saldo válido de até R$ 1 bilhão.");
  const current = summarize(state, monthOf(today), today).available;
  const openingBalance = state.settings.openingBalance + amount - current;
  if (
    !Number.isSafeInteger(openingBalance) ||
    Math.abs(openingBalance) > 100_000_000_000
  )
    throw new Error(
      "O ajuste ultrapassa o limite do saldo inicial. Confira as movimentações confirmadas.",
    );
  return { ...state, settings: { ...state.settings, openingBalance } };
}
export function splitPurchase(entry: Entry, count: number): Entry[] {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 120 ||
    entry.amount < count
  )
    throw new Error("Quantidade de parcelas inválida.");
  const base = Math.floor(entry.amount / count),
    rest = entry.amount % count;
  return Array.from({ length: count }, (_, index) => ({
    ...entry,
    id: count === 1 ? entry.id : `${entry.id}-${index + 1}`,
    repeat: "none",
    amount: base + (index < rest ? 1 : 0),
    date: dateInMonth(
      addMonths(monthOf(entry.date), index),
      Number(entry.date.slice(8)),
    ),
    ...(count > 1
      ? { installment: { index: index + 1, total: count, group: entry.id } }
      : {}),
  }));
}
