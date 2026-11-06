import { describe, it, expect } from "vitest";
import {
  addMonths,
  dateInMonth,
  parseMoney,
  occurrences,
  invoice,
  summarize,
  splitPurchase,
} from "../src/lib/finance";
import type { State, Entry } from "../src/lib/types";
const makeState = (): State => ({
  version: 1,
  settings: {
    initialMonth: "2026-11",
    openingBalance: 100000,
    invoiceDay: 10,
    cardName: "Meu cartão",
  },
  entries: [],
  overrides: {},
  skipped: [],
  settled: {},
  payments: [],
  reimbursements: [],
});
const makeEntry = (changes: Partial<Entry> = {}): Entry => ({
  id: "salary",
  description: "Salário",
  amount: 300000,
  date: "2026-11-05",
  kind: "income",
  method: "account",
  owner: "me",
  category: "Salário",
  repeat: "monthly",
  ...changes,
});
describe("calendário e valores", () => {
  it("avança do dezembro para janeiro sem depender do fuso", () =>
    expect(addMonths("2026-12", 1)).toBe("2027-01"));
  it("ajusta o dia 31 ao fim de fevereiro e respeita ano bissexto", () => {
    expect(dateInMonth("2027-02", 31)).toBe("2027-02-28");
    expect(dateInMonth("2028-02", 31)).toBe("2028-02-29");
  });
  it("interpreta reais brasileiros e rejeita precisão extra ou valor negativo", () => {
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("12,5")).toBe(1250);
    expect(parseMoney("12.50")).toBe(1250);
    expect(parseMoney("-20")).toBeNull();
    expect(parseMoney("1,999")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
  it("distribui centavos sem perder o valor total nas parcelas", () => {
    const parts = splitPurchase(
      makeEntry({
        amount: 10000,
        method: "card",
        kind: "expense",
        date: "2026-12-31",
      }),
      3,
    );
    expect(parts.map((p) => p.amount)).toEqual([3334, 3333, 3333]);
    expect(parts.map((p) => p.date)).toEqual([
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
    ]);
    expect(parts[2].installment?.index).toBe(3);
  });
});
describe("ocorrências recorrentes", () => {
  it("não cria receitas antes do início nem depois do encerramento", () => {
    const s = makeState();
    s.entries = [makeEntry({ endMonth: "2026-12" })];
    expect(occurrences(s, "2026-10")).toHaveLength(0);
    expect(occurrences(s, "2026-12")).toHaveLength(1);
    expect(occurrences(s, "2027-01")).toHaveLength(0);
  });
  it("edita e exclui apenas a ocorrência escolhida", () => {
    const s = makeState();
    s.entries = [makeEntry()];
    s.overrides["salary:2026-11"] = {
      description: "Ajuste",
      amount: 250000,
      owner: "me",
      category: "Salário",
    };
    s.skipped = ["salary:2026-12"];
    expect(occurrences(s, "2026-11")[0].amount).toBe(250000);
    expect(occurrences(s, "2026-12")).toHaveLength(0);
    expect(occurrences(s, "2027-01")[0].amount).toBe(300000);
  });
});
describe("cartão e repasses", () => {
  it("separa compras desconhecidas sem inventar um repasse da mãe", () => {
    const s = makeState();
    s.entries = [
      makeEntry({
        id: "mine",
        amount: 120000,
        kind: "expense",
        method: "card",
        repeat: "none",
      }),
      makeEntry({
        id: "mom",
        amount: 80000,
        kind: "expense",
        method: "card",
        owner: "mother",
        repeat: "none",
      }),
      makeEntry({
        id: "unknown",
        amount: 20000,
        kind: "expense",
        method: "card",
        owner: "unknown",
        repeat: "none",
      }),
    ];
    expect(invoice(s, "2026-11")).toMatchObject({
      total: 220000,
      me: 120000,
      mother: 80000,
      unknown: 20000,
      toReceive: 80000,
    });
  });
  it("contabiliza repasse e pagamento parciais sem duplicar a fatura", () => {
    const s = makeState();
    s.entries = [
      makeEntry({
        id: "mom",
        amount: 80000,
        kind: "expense",
        method: "card",
        owner: "mother",
        repeat: "none",
      }),
      makeEntry({
        id: "mine",
        amount: 120000,
        kind: "expense",
        method: "card",
        repeat: "none",
      }),
    ];
    s.reimbursements = [
      { id: "r", month: "2026-11", amount: 30000, date: "2026-11-06" },
    ];
    s.payments = [
      { id: "p", month: "2026-11", amount: 50000, date: "2026-11-06" },
    ];
    expect(invoice(s, "2026-11")).toMatchObject({
      outstanding: 150000,
      toReceive: 50000,
    });
    expect(summarize(s, "2026-11", "2026-11-06")).toMatchObject({
      available: 80000,
      closing: -20000,
      nextClosing: -20000,
      personalExpenses: 120000,
    });
  });
  it("conta o repasse recebido no mês correto mesmo para uma fatura anterior", () => {
    const s = makeState();
    s.entries = [
      makeEntry({
        id: "mom",
        amount: 80000,
        kind: "expense",
        method: "card",
        owner: "mother",
        repeat: "none",
      }),
    ];
    s.reimbursements = [
      { id: "r", month: "2026-11", amount: 80000, date: "2026-12-01" },
    ];
    expect(summarize(s, "2026-11", "2026-11-06").closing).toBe(20000);
    expect(summarize(s, "2026-11", "2026-11-06").nextClosing).toBe(100000);
  });
});
describe("previsão financeira", () => {
  it("acumula três rendas mensais e leva a sobra para o próximo mês", () => {
    const s = makeState();
    s.entries = [
      makeEntry(),
      makeEntry({ id: "bolsa", amount: 100000 }),
      makeEntry({ id: "sistema", amount: 50000 }),
      makeEntry({ id: "rent", amount: 150000, kind: "expense" }),
    ];
    expect(summarize(s, "2026-11", "2026-11-06")).toMatchObject({
      available: 100000,
      closing: 400000,
      nextClosing: 700000,
      income: 450000,
      expenses: 150000,
    });
  });
  it("mantém pendências vencidas na previsão, sem fingir recebimento", () => {
    const s = makeState();
    s.entries = [makeEntry({ repeat: "none" })];
    expect(summarize(s, "2026-12", "2026-12-06")).toMatchObject({
      available: 100000,
      closing: 400000,
    });
  });
  it("usa a data efetiva de um recebimento atrasado", () => {
    const s = makeState();
    s.entries = [makeEntry({ repeat: "none" })];
    s.settled["salary:2026-11"] = { date: "2026-12-01" };
    expect(summarize(s, "2026-11", "2026-11-06")).toMatchObject({
      available: 100000,
      closing: 100000,
      nextClosing: 400000,
    });
    expect(summarize(s, "2026-12", "2026-12-06").available).toBe(400000);
  });
  it("não debita compras do cartão novamente quando a fatura é paga", () => {
    const s = makeState();
    s.entries = [
      makeEntry({
        id: "purchase",
        amount: 80000,
        kind: "expense",
        method: "card",
        repeat: "none",
      }),
    ];
    s.payments = [
      { id: "p", month: "2026-11", amount: 80000, date: "2026-11-06" },
    ];
    expect(summarize(s, "2026-11", "2026-11-06")).toMatchObject({
      available: 20000,
      closing: 20000,
      nextClosing: 20000,
    });
  });
});
