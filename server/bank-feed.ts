import { createHash } from "node:crypto";
import { z } from "zod";
import { addDays } from "../src/lib/finance";
import type {
  BankAccount,
  BankOverview,
  BankResult,
  Institution,
} from "../src/lib/bank-feed";

const provider = "https://api.pluggy.ai";
const refreshMs = 15 * 60_000;
const maxAgeMs = 2 * refreshMs;
const uuid = z.uuid();
const targets = [
  { institution: "nubank", kind: "ALL", variable: "PLUGGY_NUBANK_ITEM_ID" },
  { institution: "bb", kind: "ALL", variable: "PLUGGY_BB_ITEM_ID" },
  {
    institution: "mercado-pago",
    kind: "CREDIT",
    variable: "PLUGGY_MERCADO_PAGO_ITEM_ID",
  },
] as const;

type Target = { institution: Institution; kind: "ALL" | "CREDIT"; id: string };
type BankConfig = {
  ownerEmail: string;
  clientId: string;
  clientSecret: string;
  items: readonly Target[];
};

export function readBankConfig(env: NodeJS.ProcessEnv): BankConfig | null {
  if (env.BANK_SYNC_ENABLED !== "true") return null;
  const ownerEmail = env.PLUGGY_OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const clientId = env.PLUGGY_CLIENT_ID?.trim();
  const clientSecret = env.PLUGGY_CLIENT_SECRET?.trim();
  const items = targets.flatMap(({ institution, kind, variable }) => {
    const id = env[variable]?.trim().toLowerCase();
    return id ? [{ institution, kind, id }] : [];
  });
  if (
    !z.email().safeParse(ownerEmail).success ||
    !clientId ||
    !clientSecret ||
    !items.length ||
    items.some(({ id }) => !uuid.safeParse(id).success) ||
    new Set(items.map(({ id }) => id.toLowerCase())).size !== items.length
  ) {
    throw new Error(
      "Configuração bancária incompleta ou inválida. Confira o titular, as chaves da aplicação e os Item IDs.",
    );
  }
  return { ownerEmail, clientId, clientSecret, items };
}

const itemSchema = z.object({
  id: uuid,
  status: z.string(),
  connector: z.object({ name: z.string(), isSandbox: z.boolean().optional() }),
  lastUpdatedAt: z.string().nullish(),
  consentExpiresAt: z.string().nullish(),
});
const accountSchema = z.object({
  id: uuid,
  itemId: uuid,
  type: z.enum(["BANK", "CREDIT"]),
  subtype: z.string().nullish(),
  balance: z.number().nullish(),
  currencyCode: z.string(),
});
const transactionSchema = z.object({
  id: z.string().min(1),
  accountId: uuid.optional(),
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  amountInAccountCurrency: z.number().nullish(),
  type: z.enum(["CREDIT", "DEBIT"]),
  status: z.enum(["POSTED", "PENDING"]).nullish(),
  currencyCode: z.string(),
  creditCardMetadata: z
    .object({
      feeType: z.string().nullish(),
      otherCreditsType: z.string().nullish(),
    })
    .nullish(),
});
const billSchema = z.object({
  dueDate: z.string(),
  totalAmount: z.number(),
  totalAmountCurrencyCode: z.string(),
});
const pageSchema = z.object({
  results: z.array(z.unknown()),
  next: z.string().nullish(),
  total: z.number().optional(),
});

function isoTimestamp(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}

function amountInCents(value: number | null | undefined) {
  if (value == null) return null;
  const cents = Math.sign(value) * Math.round(Math.abs(value) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

async function request(
  path: string,
  signal: AbortSignal,
  apiKey?: string,
  credentials?: Pick<BankConfig, "clientId" | "clientSecret">,
): Promise<unknown> {
  const response = await fetch(`${provider}${path}`, {
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    ...(credentials
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...credentials, nonExpiring: false }),
        }
      : { headers: { "X-API-KEY": apiKey! } }),
  });
  if (!response.ok) throw new Error("Consulta bancária indisponível.");
  return response.json();
}

async function readTransactions(
  accountId: string,
  kind: "BANK" | "CREDIT",
  dateFrom: string,
  apiKey: string,
  signal: AbortSignal,
) {
  const transactions = new Map<string, BankAccount["transactions"][number]>();
  const cursors = new Set<string>();
  let after: string | undefined;
  let limited = false;
  for (let page = 0; page < 3; page++) {
    const query = new URLSearchParams({ accountId, dateFrom });
    if (after) query.set("after", after);
    const result = pageSchema.parse(
      await request(`/v2/transactions?${query}`, signal, apiKey),
    );
    for (const row of result.results) {
      const parsed = transactionSchema.safeParse(row);
      if (
        !parsed.success ||
        (parsed.data.accountId && parsed.data.accountId !== accountId)
      ) {
        limited = true;
        continue;
      }
      const value = parsed.data;
      const date = value.date.slice(0, 10);
      const amount = amountInCents(
        value.currencyCode === "BRL"
          ? value.amount
          : value.amountInAccountCurrency,
      );
      if (!z.iso.date().safeParse(date).success || amount === null) {
        limited = true;
        continue;
      }
      if (date < dateFrom) continue;
      transactions.set(value.id, {
        date,
        description: value.description.trim().slice(0, 160) || "Movimentação",
        amount: Math.abs(amount),
        direction: value.type,
        status: value.status ?? null,
        ...(kind === "CREDIT" &&
          value.type === "DEBIT" &&
          !value.creditCardMetadata?.feeType &&
          !value.creditCardMetadata?.otherCreditsType &&
          amount !== 0 && {
            purchaseKey: createHash("sha256")
              .update(`${accountId}:${value.id}`)
              .digest("hex"),
          }),
      });
    }
    if (!result.next) break;
    // Read only the cursor; never request a provider-supplied URL.
    const cursor = new URL(result.next, provider).searchParams.get("after");
    if (!cursor || cursor.length > 1024 || cursors.has(cursor) || page === 2) {
      limited = true;
      break;
    }
    cursors.add(cursor);
    after = cursor;
  }
  return {
    rows: [...transactions.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 25),
    limited,
  };
}

async function readBills(
  accountId: string,
  apiKey: string,
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ accountId });
  const result = pageSchema.parse(
    await request(`/bills?${query}`, signal, apiKey),
  );
  return result.results
    .flatMap((row) => {
      const parsed = billSchema.safeParse(row);
      if (!parsed.success || parsed.data.totalAmountCurrencyCode !== "BRL")
        return [];
      const due = parsed.data.dueDate.slice(0, 10);
      const amount = amountInCents(parsed.data.totalAmount);
      return z.iso.date().safeParse(due).success && amount !== null
        ? [{ due, amount }]
        : [];
    })
    .sort((a, b) => b.due.localeCompare(a.due))
    .slice(0, 3);
}

async function readBank(
  target: Target,
  apiKey: string,
  signal: AbortSignal,
  now: Date,
): Promise<BankResult> {
  const base = {
    institution: target.institution,
    providerUpdatedAt: null,
    accounts: [],
  };
  try {
    const item = itemSchema.parse(
      await request(`/items/${target.id}`, signal, apiKey),
    );
    const connector = item.connector.name.toLowerCase().replace(/\s/g, "");
    if (
      item.id !== target.id ||
      connector !== "meupluggy" ||
      item.connector.isSandbox
    )
      return { ...base, status: "unavailable" };
    if (
      (item.consentExpiresAt &&
        Date.parse(item.consentExpiresAt) <= now.getTime()) ||
      ["LOGIN_ERROR", "WAITING_USER_INPUT", "WAITING_USER_ACTION"].includes(
        item.status,
      )
    )
      return { ...base, status: "reconnect" };
    if (["MERGING", "UPDATING"].includes(item.status))
      return { ...base, status: "pending" };
    if (!["UPDATED", "PARTIAL_SUCCESS"].includes(item.status))
      return { ...base, status: "unavailable" };
    const query = new URLSearchParams({ itemId: target.id });
    if (target.kind !== "ALL") query.set("type", target.kind);
    const result = pageSchema.parse(
      await request(`/accounts?${query}`, signal, apiKey),
    );
    const accounts = result.results.flatMap((row) => {
      const account = accountSchema.safeParse(row);
      return account.success &&
        account.data.itemId === target.id &&
        (target.kind === "ALL" || account.data.type === target.kind) &&
        account.data.currencyCode === "BRL"
        ? [account.data]
        : [];
    });
    if (!accounts.length) return { ...base, status: "empty" };
    const from = addDays(now.toISOString().slice(0, 10), -29);
    const data = await Promise.all(
      accounts.slice(0, 6).map(async (account): Promise<BankAccount> => {
        const [tx, bills] = await Promise.allSettled([
          readTransactions(account.id, account.type, from, apiKey, signal),
          account.type === "CREDIT"
            ? readBills(account.id, apiKey, signal)
            : Promise.resolve([]),
        ]);
        return {
          kind:
            account.type === "CREDIT"
              ? "credit"
              : account.subtype === "SAVINGS_ACCOUNT"
                ? "savings"
                : "checking",
          balance:
            account.type === "BANK" ? amountInCents(account.balance) : null,
          transactions: tx.status === "fulfilled" ? tx.value.rows : [],
          bills: bills.status === "fulfilled" ? bills.value : [],
          limited:
            tx.status === "rejected" ||
            tx.value.limited ||
            bills.status === "rejected",
        };
      }),
    );
    const partial =
      item.status === "PARTIAL_SUCCESS" ||
      data.some((account) => account.limited) ||
      accounts.length > data.length ||
      (result.total ?? 0) > result.results.length;
    return {
      ...base,
      providerUpdatedAt: isoTimestamp(item.lastUpdatedAt),
      accounts: data,
      status: partial ? "partial" : "ready",
    };
  } catch {
    return { ...base, status: "unavailable" };
  }
}

export function createBankFeed(config: BankConfig) {
  let snapshot: Extract<BankOverview, { enabled: true }> = {
    enabled: true,
    status: "loading",
    checkedAt: null,
    banks: [],
  };
  let pending: Promise<void> | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  const lifetime = new AbortController();

  function refresh() {
    if (pending) return pending;
    if (lifetime.signal.aborted) return Promise.resolve();
    pending = (async () => {
      let banks: BankResult[];
      const signal = AbortSignal.any([
        lifetime.signal,
        AbortSignal.timeout(40_000),
      ]);
      try {
        const auth = z.object({ apiKey: z.string().min(1) }).parse(
          await request("/auth", signal, undefined, {
            clientId: config.clientId,
            clientSecret: config.clientSecret,
          }),
        );
        banks = await Promise.all(
          config.items.map((item) =>
            readBank(item, auth.apiKey, signal, new Date()),
          ),
        );
      } catch {
        banks = config.items.map(({ institution }) => ({
          institution,
          status: "unavailable",
          providerUpdatedAt: null,
          accounts: [],
        }));
      }
      if (!lifetime.signal.aborted)
        snapshot = {
          enabled: true,
          status: "ready",
          checkedAt: new Date().toISOString(),
          banks,
        };
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  }

  return {
    refresh,
    start() {
      if (interval || lifetime.signal.aborted) return;
      void refresh();
      interval = setInterval(() => void refresh(), refreshMs);
      interval.unref();
    },
    stop() {
      clearInterval(interval);
      lifetime.abort();
      snapshot = {
        enabled: true,
        status: "loading",
        checkedAt: null,
        banks: [],
      };
    },
    forUser(email: string): BankOverview {
      if (email !== config.ownerEmail) return { enabled: false };
      if (
        snapshot.checkedAt &&
        Date.now() - Date.parse(snapshot.checkedAt) > maxAgeMs
      )
        return { enabled: true, status: "loading", checkedAt: null, banks: [] };
      return snapshot;
    },
  };
}
