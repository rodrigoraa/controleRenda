import { expect, it } from "vitest";
import { occurrences, summarize, withCurrentBalance } from "../src/lib/finance";
import { createEmptyState, parseBackup } from "../src/lib/validation";
import type { Entry } from "../src/lib/types";
const entry = (changes: Partial<Entry> = {}): Entry => ({
  id: "salary",
  description: "Salário",
  amount: 222100,
  date: "2026-12-05",
  kind: "income",
  method: "account",
  owner: "me",
  category: "Salário",
  repeat: "monthly",
  ...changes,
});
it("separa resultado mensal e saldo acumulado com renda começando no próximo mês", () => {
  const state = createEmptyState("2026-11");
  state.settings.openingBalance = 38003;
  state.entries = [
    entry(),
    entry({
      id: "bill",
      description: "Compra",
      kind: "expense",
      method: "card",
      date: "2026-11-06",
      amount: 42556,
      repeat: "none",
    }),
  ];
  expect(occurrences(state, "2026-11").map((e) => e.id)).toEqual(["bill"]);
  expect(summarize(state, "2026-11", "2026-11-09")).toMatchObject({
    available: 38003,
    starting: 38003,
    inflows: 0,
    outflows: 42556,
    monthlyChange: -42556,
    closing: -4553,
    nextClosing: 217547,
    nextMonthlyChange: 222100,
  });
  expect(summarize(state, "2026-12", "2026-11-09")).toMatchObject({
    available: 38003,
    starting: -4553,
    inflows: 222100,
    outflows: 0,
    monthlyChange: 222100,
    closing: 217547,
    nextClosing: 439647,
  });
});
function confirmedState() {
  const state = createEmptyState("2026-11");
  state.settings.openingBalance = 100000;
  state.entries = [
    entry({ date: "2026-11-05", amount: 300000, repeat: "none" }),
    entry({
      id: "expense",
      kind: "expense",
      date: "2026-11-06",
      amount: 50000,
      repeat: "none",
    }),
    entry({
      id: "pending",
      kind: "expense",
      date: "2026-11-20",
      amount: 8000,
      repeat: "none",
    }),
    entry({
      id: "card",
      kind: "expense",
      method: "card",
      date: "2026-11-10",
      amount: 30000,
      repeat: "none",
    }),
    entry({
      id: "mother",
      kind: "expense",
      method: "card",
      owner: "mother",
      date: "2026-11-10",
      amount: 10000,
      repeat: "none",
    }),
  ];
  state.settled = {
    "salary:2026-11": { date: "2026-11-05" },
    "expense:2026-11": { date: "2026-11-06" },
  };
  state.payments = [
    { id: "payment", amount: 25000, month: "2026-11", date: "2026-11-08" },
  ];
  state.reimbursements = [
    { id: "pix", amount: 10000, month: "2026-11", date: "2026-11-07" },
  ];
  return state;
}
it("informa saldo atual sem duplicar movimentos confirmados e mantém as pendências", () => {
  const original = confirmedState();
  const snapshot = structuredClone(original);
  const adjusted = withCurrentBalance(original, 38003, "2026-11-09");
  expect(original).toEqual(snapshot);
  expect({ ...adjusted, settings: original.settings }).toEqual(original);
  expect(adjusted.settings.openingBalance).toBe(-196997);
  expect(summarize(adjusted, "2026-11", "2026-11-09")).toMatchObject({
    available: 38003,
    closing: 15003,
    inflows: 310000,
    outflows: 98000,
    monthlyChange: 212000,
  });
  expect(parseBackup(JSON.stringify(adjusted))).toEqual(adjusted);
  const paid = structuredClone(adjusted);
  paid.settled["pending:2026-11"] = { date: "2026-11-10" };
  expect(summarize(paid, "2026-11", "2026-11-10").available).toBe(30003);
});
it.each([0, -15000])(
  "aceita saldo atual %s e repetir o ajuste não soma o valor de novo",
  (balance) => {
    const adjusted = withCurrentBalance(
      confirmedState(),
      balance,
      "2026-11-09",
    );
    expect(summarize(adjusted, "2026-11", "2026-11-09").available).toBe(
      balance,
    );
    expect(withCurrentBalance(adjusted, balance, "2026-11-09")).toEqual(
      adjusted,
    );
  },
);
it.each([NaN, Infinity, 1.5, 100_000_000_001])(
  "recusa saldo atual inválido %s",
  (balance) => {
    expect(() =>
      withCurrentBalance(confirmedState(), balance, "2026-11-09"),
    ).toThrow(/saldo/i);
  },
);
it("recusa ajuste que produziria saldo inicial fora do limite sem alterar o orçamento", () => {
  const state = createEmptyState("2026-11");
  state.entries = [
    entry({ date: "2026-11-05", amount: 100_000_000_000, repeat: "none" }),
  ];
  state.settled["salary:2026-11"] = { date: "2026-11-05" };
  expect(() => withCurrentBalance(state, -1, "2026-11-09")).toThrow(/limite/);
  expect(state.settings.openingBalance).toBe(0);
});
