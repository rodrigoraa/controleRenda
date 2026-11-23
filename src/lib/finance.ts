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
export function addDays(date: string, count: number): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + count);
  return day.toISOString().slice(0, 10);
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
export const localDate = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const shortDate = (date: string) =>
  `${date.slice(8, 10)}/${date.slice(5, 7)}`;
export const dateLabel = (date: string) =>
  `${shortDate(date)}/${date.slice(0, 4)}`;
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
type CashEvent = {
  date: string;
  amount: number;
  actual: boolean;
  label: string;
  source: "account" | "invoice" | "reimbursement";
};
function cashEvents(state: State, horizon: string): CashEvent[] {
  const events: CashEvent[] = [];
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
        label: entry.description,
        source: "account",
      });
    }
    const bill = invoice(state, m);
    const date = dateInMonth(m, state.settings.invoiceDay);
    if (bill.outstanding)
      events.push({
        date,
        amount: -bill.outstanding,
        actual: false,
        label: "Pagamento da fatura",
        source: "invoice",
      });
    if (bill.toReceive)
      events.push({
        date,
        amount: bill.toReceive,
        actual: false,
        label: "Repasse da sua mãe",
        source: "reimbursement",
      });
  }
  state.payments.forEach((p) =>
    events.push({
      date: p.date,
      amount: -p.amount,
      actual: true,
      label: "Pagamento da fatura",
      source: "invoice",
    }),
  );
  state.reimbursements.forEach((p) =>
    events.push({
      date: p.date,
      amount: p.amount,
      actual: true,
      label: "Repasse da sua mãe",
      source: "reimbursement",
    }),
  );
  return events.filter((e) => e.date >= initialDate);
}

export function projectDailyBalance(
  state: State,
  today: string,
  through: string,
) {
  const start =
    today < `${state.settings.initialMonth}-01`
      ? `${state.settings.initialMonth}-01`
      : today;
  const events = cashEvents(state, monthOf(through));
  let starting = state.settings.openingBalance;
  const byDate = new Map<string, CashEvent[]>();
  for (const event of events) {
    if (event.actual && event.date <= today) {
      starting += event.amount;
      continue;
    }
    if (event.date > through || (event.date < today && event.amount > 0))
      continue;
    const day = event.date < start ? start : event.date;
    const list = byDate.get(day) ?? [];
    list.push(event);
    byDate.set(day, list);
  }
  let balance = starting;
  let lowest = { date: start, balance };
  const days = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => {
      // With dates but no times, assume outflows can happen before inflows.
      const ordered = [...events].sort(
        (a, b) => Number(a.amount > 0) - Number(b.amount > 0),
      );
      let minimum = balance;
      for (const event of ordered) {
        balance += event.amount;
        minimum = Math.min(minimum, balance);
      }
      if (minimum < lowest.balance) lowest = { date, balance: minimum };
      return { date, events: ordered, closing: balance, minimum };
    });
  return { start, starting, lowest, days };
}
export function forecastNext30Days(state: State, today: string) {
  const start =
    today < `${state.settings.initialMonth}-01`
      ? `${state.settings.initialMonth}-01`
      : today;
  const through = addDays(start, 29);
  return { ...projectDailyBalance(state, today, through), through };
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
  const [inflows, outflows] = totals(monthEvents);
  const [confirmedInflows, confirmedOutflows] = totals(
    monthEvents.filter((event) => event.actual && event.date <= today),
  );
  function totals(movements: typeof events) {
    return [
      movements.reduce((sum, { amount }) => sum + Math.max(0, amount), 0),
      movements.reduce((sum, { amount }) => sum - Math.min(0, amount), 0),
    ];
  }
  return {
    starting: at(addMonths(month, -1)),
    inflows,
    outflows,
    confirmedInflows,
    confirmedOutflows,
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

export type PurchaseScenario = {
  amount: number;
  method: Entry["method"];
  month: string;
  count: number;
};

function purchaseEntries(
  amount: number,
  method: Entry["method"],
  date: string,
  count: number,
): Entry[] {
  return splitPurchase(
    {
      // Colons are excluded from saved entry IDs.
      id: "simulation:purchase",
      description: "Compra simulada",
      amount,
      date,
      kind: "expense",
      method,
      owner: "me",
      category: "Compras",
      repeat: "none",
    },
    method === "card" ? count : 1,
  );
}

export function comparePaymentOptions(
  state: State,
  {
    today,
    amount,
    count,
    reserve,
    firstInvoice,
  }: {
    today: string;
    amount: number;
    count: number;
    reserve: number;
    firstInvoice: string;
  },
) {
  const start =
    today < `${state.settings.initialMonth}-01`
      ? `${state.settings.initialMonth}-01`
      : today;
  const month = monthOf(start);
  const last = addMonths(month, 5);
  const lastInvoice = addMonths(firstInvoice, count - 1);
  let through = dateInMonth(lastInvoice > last ? lastInvoice : last, 31);
  const nextIncome = cashEvents(state, last)
    .filter(
      (event) =>
        event.source === "account" &&
        !event.actual &&
        event.amount > 0 &&
        event.date >= start &&
        monthOf(event.date) <= last,
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const afterIncome = nextIncome ? addDays(nextIncome.date, 1) : null;
  if (afterIncome && afterIncome > through) through = afterIncome;
  const baseline = projectDailyBalance(state, today, through);
  const candidates = [
    { kind: "today", date: start === today ? today : null, method: "account" },
    { kind: "afterIncome", date: afterIncome, method: "account" },
    {
      kind: "card",
      date: dateInMonth(firstInvoice, state.settings.invoiceDay),
      method: "card",
    },
  ] as const;

  return {
    through,
    nextIncome,
    baselineBelow: baseline.lowest.balance < reserve,
    options: candidates.flatMap(({ kind, date, method }) => {
      if (!date) return [];
      const parts = purchaseEntries(amount, method, date, count);
      const plan = projectDailyBalance(
        { ...state, entries: [...state.entries, ...parts] },
        today,
        through,
      );
      const below = plan.days.find(({ minimum }) => minimum < reserve);
      return [
        {
          kind,
          date,
          lowest: plan.lowest,
          firstBelow:
            plan.starting < reserve
              ? { date: plan.start, balance: plan.starting }
              : below && { date: below.date, balance: below.minimum },
          lastDate:
            method === "card"
              ? dateInMonth(lastInvoice, state.settings.invoiceDay)
              : date,
        },
      ];
    }),
  };
}

function closingBalances(state: State, months: string[]) {
  const totals = new Map<string, number>();
  const start = months[0];
  for (const event of cashEvents(state, months.at(-1)!)) {
    const month = monthOf(event.date);
    const key = month < start ? start : month;
    totals.set(key, (totals.get(key) ?? 0) + event.amount);
  }
  let balance = state.settings.openingBalance;
  return months.map((month) => (balance += totals.get(month) ?? 0));
}

export function simulatePurchase(
  state: State,
  purchase: PurchaseScenario,
  currentMonth: string,
) {
  const start =
    currentMonth < state.settings.initialMonth
      ? state.settings.initialMonth
      : currentMonth;
  const parts = purchaseEntries(
    purchase.amount,
    purchase.method,
    `${purchase.month}-01`,
    purchase.count,
  );
  const lastInstallment = monthOf(parts.at(-1)!.date);
  const minimumEnd = addMonths(start, 5);
  const end = lastInstallment > minimumEnd ? lastInstallment : minimumEnd;
  const months: string[] = [];
  for (let month = start; month <= end; month = addMonths(month, 1))
    months.push(month);
  const baseline = closingBalances(state, months);
  const projected = closingBalances(
    { ...state, entries: [...state.entries, ...parts] },
    months,
  );
  return {
    installments: parts.map((part) => part.amount),
    months: months.map((month, index) => ({
      month,
      baseline: baseline[index],
      projected: projected[index],
    })),
  };
}
