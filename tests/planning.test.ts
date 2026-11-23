import { describe, expect, it } from "vitest";
import {
  comparePaymentOptions,
  projectDailyBalance,
  summarize,
} from "../src/lib/finance";
import { collectAttention } from "../src/lib/attention";
import type { Entry, State } from "../src/lib/types";

function entry(
  id: string,
  date: string,
  amount: number,
  changes: Partial<Entry> = {},
): Entry {
  return {
    id,
    date,
    amount,
    description: id,
    kind: "expense",
    method: "account",
    owner: "me",
    category: "Outros",
    repeat: "none",
    ...changes,
  };
}

function budget(entries: Entry[]): State {
  return {
    version: 1,
    settings: {
      initialMonth: "2026-11",
      openingBalance: 50000,
      invoiceDay: 10,
      cardName: "Meu cartão",
    },
    entries,
    overrides: {},
    skipped: [],
    settled: {},
    payments: [],
    reimbursements: [],
  };
}

describe("planejamento do dia a dia", () => {
  it("mostra falta de saldo antes do salário mesmo com fechamento positivo", () => {
    const state = budget([
      entry("Aluguel", "2026-11-12", 58000),
      entry("Salário", "2026-11-15", 68000, { kind: "income" }),
    ]);
    const plan = projectDailyBalance(state, "2026-11-10", "2026-11-30");
    expect(summarize(state, "2026-11", "2026-11-10").closing).toBe(60000);
    expect(plan.lowest).toEqual({ date: "2026-11-12", balance: -8000 });
    expect(plan.days.at(-1)?.closing).toBe(60000);
  });

  it("considera contas vencidas já no primeiro dia e não conta receita atrasada nem confirmações duas vezes", () => {
    const state = budget([
      entry("Já pago", "2026-11-02", 5000),
      entry("Vencida", "2026-11-03", 10000),
      entry("Atrasada", "2026-11-02", 60000, { kind: "income" }),
      entry("Conta de hoje", "2026-11-11", 40000),
      entry("Salário", "2026-11-11", 100000, { kind: "income" }),
    ]);
    state.settled["Já pago:2026-11"] = { date: "2026-11-09" };
    const plan = projectDailyBalance(state, "2026-11-10", "2026-11-30");
    expect(plan.starting).toBe(45000);
    expect(plan.days.map(({ date, closing }) => [date, closing])).toEqual([
      ["2026-11-10", 35000],
      ["2026-11-11", 95000],
    ]);
    expect(plan.lowest).toEqual({ date: "2026-11-11", balance: -5000 });
  });

  it("distingue hoje, após a próxima renda e parcelado respeitando uma reserva", () => {
    const state = budget([
      entry("Salário", "2026-11-15", 30000, {
        kind: "income",
        repeat: "monthly",
      }),
      entry("Conta", "2026-11-12", 20000, { repeat: "monthly" }),
    ]);
    const result = comparePaymentOptions(state, {
      today: "2026-11-11",
      amount: 25000,
      count: 5,
      reserve: 20000,
      firstInvoice: "2026-12",
    });
    expect(
      result.options.map(({ kind, date, firstBelow }) => [
        kind,
        date,
        firstBelow?.date,
      ]),
    ).toEqual([
      ["today", "2026-11-11", "2026-11-12"],
      ["afterIncome", "2026-11-16", "2026-12-12"],
      ["card", "2026-12-10", undefined],
    ]);
    expect(result.options[0].lowest.balance).toBe(5000);
    expect(result.through).toBe("2027-04-30");
  });

  it("encontra pendências de meses diferentes sem repetir o grupo de parcelas", () => {
    const state = budget([
      entry("Vencida", "2026-11-30", 1000),
      entry("Paga", "2026-12-01", 1000),
      entry("Em breve", "2026-12-06", 1000),
      entry("Distante", "2026-12-20", 1000),
      entry("Compra1", "2026-11-01", 4000, {
        method: "card",
        owner: "unknown",
        installment: { group: "compra", index: 1, total: 2 },
      }),
      entry("Compra2", "2026-12-01", 4000, {
        method: "card",
        owner: "unknown",
        installment: { group: "compra", index: 2, total: 2 },
      }),
      entry("Mãe", "2026-11-01", 6000, { method: "card", owner: "mother" }),
    ]);
    state.settled["Paga:2026-12"] = { date: "2026-12-01" };
    state.payments = [
      { id: "payment", month: "2026-11", amount: 3000, date: "2026-11-10" },
    ];
    state.reimbursements = [
      {
        id: "reimbursement",
        month: "2026-11",
        amount: 2000,
        date: "2026-11-10",
      },
    ];
    const pending = collectAttention(state, "2026-12-02");
    expect(pending.movements.map((row) => row.id)).toEqual([
      "Vencida",
      "Em breve",
    ]);
    expect(pending.unknown.map((row) => row.id)).toEqual(["Compra1"]);
    expect(pending.invoices).toEqual([
      { month: "2026-11", date: "2026-11-10", amount: 7000 },
    ]);
    expect(pending.reimbursements).toEqual([
      { month: "2026-11", date: "2026-11-10", amount: 4000 },
    ]);
  });
});
