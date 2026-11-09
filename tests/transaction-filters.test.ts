import { expect, it } from "vitest";
import {
  defaultTransactionFilters,
  filterError,
  selectTransactions,
} from "../src/lib/transaction-filters";
import type { Occurrence } from "../src/lib/types";
const row = (
  id: string,
  amount: number,
  changes: Partial<Occurrence> = {},
): Occurrence => ({
  id,
  key: `${id}:2026-12`,
  description: id,
  amount,
  date: "2026-12-10",
  month: "2026-12",
  kind: "expense",
  method: "card",
  owner: "mother",
  category: "Compras",
  repeat: "none",
  ...changes,
});
const rows = [
  row("large", 30000),
  row("cash", 5000, { method: "account", owner: "me" }),
  row("salary", 300000, {
    kind: "income",
    method: "account",
    owner: "me",
    settledOn: "2026-12-05",
  }),
  row("small", 20000),
  row("other", 10000, { owner: "person_alex" as Occurrence["owner"] }),
];
it("combina pendente, responsável, faixa de valor e maior valor sem alterar a lista original", () => {
  const original = structuredClone(rows);
  expect(
    selectTransactions(
      rows,
      {
        ...defaultTransactionFilters,
        status: "pending",
        owner: "mother",
        minimum: "150,00",
        maximum: "350,00",
        order: "amount-desc",
      },
      false,
    ).map((r) => r.id),
  ).toEqual(["large", "small"]);
  expect(rows).toEqual(original);
});
it("ordena numericamente por menor valor e mantém nomes de outros responsáveis filtráveis", () => {
  expect(
    selectTransactions(
      rows,
      { ...defaultTransactionFilters, order: "amount-asc" },
      false,
    ).map((r) => r.id),
  ).toEqual(["cash", "other", "small", "large", "salary"]);
  expect(
    selectTransactions(
      rows,
      {
        ...defaultTransactionFilters,
        owner: "person_alex",
        order: "amount-desc",
      },
      false,
    ).map((r) => r.id),
  ).toEqual(["other"]);
});
it("a situação das compras acompanha o pagamento integral da fatura", () => {
  expect(
    selectTransactions(
      rows,
      { ...defaultTransactionFilters, status: "confirmed" },
      false,
    ).map((r) => r.id),
  ).toEqual(["salary"]);
  expect(
    selectTransactions(
      rows,
      { ...defaultTransactionFilters, status: "pending", owner: "mother" },
      true,
    ),
  ).toEqual([]);
  expect(
    selectTransactions(
      rows,
      { ...defaultTransactionFilters, status: "confirmed", owner: "mother" },
      true,
    ).map((r) => r.id),
  ).toEqual(["large", "small"]);
});
it.each([
  { minimum: "abc", maximum: "" },
  { minimum: "100", maximum: "50" },
  { minimum: "-1", maximum: "" },
])(
  "recusa faixa inválida %j em vez de mostrar resultados sem o filtro",
  (criteria) => {
    const filters = { ...defaultTransactionFilters, ...criteria };
    expect(filterError(filters)).toMatch(/valor|mínimo/i);
    expect(selectTransactions(rows, filters, false)).toEqual([]);
  },
);
it("combina busca e tipo e aceita intervalos inclusivos com centavos", () => {
  expect(
    selectTransactions(
      rows,
      {
        ...defaultTransactionFilters,
        query: "lar",
        quick: "expense",
        minimum: "300,00",
        maximum: "300,00",
      },
      false,
    ).map((r) => r.id),
  ).toEqual(["large"]);
  expect(
    selectTransactions(
      rows,
      { ...defaultTransactionFilters, quick: "income", owner: "me" },
      false,
    ).map((r) => r.id),
  ).toEqual(["salary"]);
});
