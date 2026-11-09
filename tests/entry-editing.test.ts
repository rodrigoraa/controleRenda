import { it, expect } from "vitest";
import { editOccurrence } from "../src/lib/entry-editing";
import { createEmptyState, parseBackup } from "../src/lib/validation";
import {
  occurrences,
  splitPurchase,
  summarize,
  invoice,
} from "../src/lib/finance";
import type { Entry } from "../src/lib/types";
const entry = (changes: Partial<Entry> = {}): Entry => ({
  id: "expense",
  description: "Mercado",
  amount: 10000,
  date: "2026-11-05",
  kind: "expense",
  method: "account",
  owner: "me",
  category: "Alimentação",
  repeat: "none",
  ...changes,
});
function setup(e: Entry) {
  const s = createEmptyState("2026-11");
  s.settings.openingBalance = 50000;
  s.entries = [e];
  return s;
}
it("corrige o dia de um lançamento avulso e preserva os outros dados", () => {
  const s = setup(entry());
  const row = occurrences(s, "2026-11")[0];
  const changed = editOccurrence(s, row, {
    ...row,
    date: "2026-11-08",
    description: "Mercado corrigido",
  });
  expect(occurrences(changed, "2026-11")[0]).toMatchObject({
    id: "expense",
    date: "2026-11-08",
    description: "Mercado corrigido",
    amount: 10000,
  });
  expect(s.entries[0].date).toBe("2026-11-05");
});
it("move entre meses sem duplicar a despesa e conserva a previsão acumulada", () => {
  const s = setup(entry());
  const row = occurrences(s, "2026-11")[0];
  const changed = editOccurrence(s, row, { ...row, date: "2026-12-08" });
  expect(occurrences(changed, "2026-11")).toHaveLength(0);
  expect(occurrences(changed, "2026-12")).toHaveLength(1);
  expect(summarize(changed, "2026-11", "2026-11-09")).toMatchObject({
    closing: 50000,
    nextClosing: 40000,
  });
  expect(parseBackup(JSON.stringify(changed))).toEqual(changed);
});
it("mantém a data efetiva e a confirmação ao mudar o mês previsto de uma receita recebida", () => {
  const s = setup(entry({ kind: "income", repeat: "none" }));
  s.settled["expense:2026-11"] = { date: "2026-11-06" };
  const row = occurrences(s, "2026-11")[0];
  const changed = editOccurrence(s, row, { ...row, date: "2026-12-05" });
  expect(changed.settled).toEqual({
    "expense:2026-12": { date: "2026-11-06" },
  });
  expect(summarize(changed, "2026-11", "2026-11-09")).toMatchObject({
    available: 60000,
    closing: 60000,
    nextClosing: 60000,
  });
});
it("permite corrigir a data real de uma movimentação confirmada", () => {
  const s = setup(entry({ kind: "income" }));
  s.settled["expense:2026-11"] = { date: "2026-11-08" };
  const row = occurrences(s, "2026-11")[0];
  const changed = editOccurrence(s, row, row, "2026-11-03");
  expect(changed.settled["expense:2026-11"].date).toBe("2026-11-03");
  expect(summarize(changed, "2026-11", "2026-11-04").available).toBe(60000);
});
it("muda somente a data da parcela escolhida e preserva pagamentos e repasses registrados", () => {
  const s = createEmptyState("2026-11");
  s.entries = splitPurchase(
    entry({ method: "card", owner: "mother", amount: 30000 }),
    3,
  );
  s.payments = [
    { id: "p", month: "2026-11", amount: 10000, date: "2026-11-08" },
  ];
  s.reimbursements = [
    { id: "r", month: "2026-11", amount: 10000, date: "2026-11-07" },
  ];
  const row = occurrences(s, "2026-11")[0];
  const changed = editOccurrence(s, row, { ...row, date: "2026-12-05" });
  expect(occurrences(changed, "2026-11")).toHaveLength(0);
  expect(occurrences(changed, "2026-12")).toHaveLength(2);
  expect(occurrences(changed, "2027-01")[0]).toMatchObject({
    date: "2027-01-05",
    amount: 10000,
    installment: { index: 3, total: 3 },
  });
  expect(changed.payments).toEqual(s.payments);
  expect(changed.reimbursements).toEqual(s.reimbursements);
  expect(invoice(changed, "2026-11")).toMatchObject({
    paid: 10000,
    received: 10000,
    credit: 10000,
  });
});
it("corrige a data de uma ocorrência mensal sem alterar os meses seguintes", () => {
  const s = setup(entry({ repeat: "monthly" }));
  const row = occurrences(s, "2026-11")[0];
  const changed = editOccurrence(s, row, { ...row, date: "2026-11-12" });
  expect(occurrences(changed, "2026-11")).toHaveLength(1);
  expect(occurrences(changed, "2026-11")[0]).toMatchObject({
    date: "2026-11-12",
    amount: 10000,
  });
  expect(occurrences(changed, "2026-12")).toHaveLength(1);
  expect(occurrences(changed, "2026-12")[0]).toMatchObject({
    id: "expense",
    date: "2026-12-05",
    repeat: "monthly",
  });
  expect(parseBackup(JSON.stringify(changed))).toEqual(changed);
});
it("move uma ocorrência além do fim da recorrência e preserva os ajustes e a confirmação", () => {
  const s = setup(entry({ repeat: "monthly", endMonth: "2026-12" }));
  s.overrides["expense:2026-11"] = {
    amount: 12000,
    description: "Conta ajustada",
    owner: "me",
    category: "Contas",
  };
  s.settled["expense:2026-11"] = { date: "2026-11-06" };
  const row = occurrences(s, "2026-11")[0];
  const changed = editOccurrence(s, row, { ...row, date: "2027-01-07" });
  expect(occurrences(changed, "2026-11")).toHaveLength(0);
  expect(occurrences(changed, "2026-12")[0]).toMatchObject({
    date: "2026-12-05",
    amount: 10000,
  });
  expect(occurrences(changed, "2027-01")).toHaveLength(1);
  expect(occurrences(changed, "2027-01")[0]).toMatchObject({
    date: "2027-01-07",
    amount: 12000,
    description: "Conta ajustada",
    settledOn: "2026-11-06",
  });
  expect(parseBackup(JSON.stringify(changed))).toEqual(changed);
});
it("recusa datas fora do controle e ocorrências que já foram removidas", () => {
  const s = setup(entry());
  const row = occurrences(s, "2026-11")[0];
  expect(() =>
    editOccurrence(s, row, { ...row, date: "2026-10-31" }),
  ).toThrow();
  s.skipped = [row.key];
  expect(() =>
    editOccurrence(s, row, { ...row, date: "2026-11-12" }),
  ).toThrow();
});
it("não perde a confirmação se uma data real vazia for enviada", () => {
  const s = setup(entry());
  s.settled["expense:2026-11"] = { date: "2026-11-05" };
  const row = occurrences(s, "2026-11")[0];
  expect(() =>
    editOccurrence(s, row, { ...row, date: "2026-12-08" }, ""),
  ).toThrow();
  expect(s.settled["expense:2026-11"].date).toBe("2026-11-05");
});
it("mantém a ocorrência normal do mês que recebe um ajuste recorrente", () => {
  const s = setup(entry({ repeat: "monthly" }));
  const row = occurrences(s, "2026-11")[0];
  const changed = editOccurrence(s, row, { ...row, date: "2026-12-09" });
  expect(occurrences(changed, "2026-12").map((e) => e.date)).toEqual([
    "2026-12-05",
    "2026-12-09",
  ]);
  expect(occurrences(changed, "2027-01")).toHaveLength(1);
});
it.each(["prevista", "real"] as const)(
  "recusa formulário antigo quando a data %s mudou em outra aba",
  (kind) => {
    const initial = setup(entry());
    initial.settled["expense:2026-11"] = { date: "2026-11-06" };
    const row = occurrences(initial, "2026-11")[0];
    const latest = structuredClone(initial);
    if (kind === "prevista") latest.entries[0].date = "2026-11-04";
    else latest.settled["expense:2026-11"].date = "2026-11-03";
    expect(() =>
      editOccurrence(
        latest,
        row,
        { ...row, description: "Minha edição" },
        row.settledOn,
      ),
    ).toThrow(/alterado/);
  },
);
it.each([
  ["valor", { amount: 20000 }],
  ["descrição", { description: "Mercado corrigido em outra aba" }],
  ["categoria", { category: "Compras" }],
] as const)(
  "recusa formulário antigo quando o campo %s mudou em outra aba",
  (_field, changed) => {
    const initial = setup(entry());
    const row = occurrences(initial, "2026-11")[0];
    const latest = structuredClone(initial);
    latest.overrides[row.key] = {
      amount: 10000,
      description: "Mercado",
      category: "Alimentação",
      owner: "me",
      ...changed,
    };
    const before = structuredClone(latest);
    expect(() =>
      editOccurrence(latest, row, { ...row, description: "Minha edição" }),
    ).toThrow(/alterado/);
    expect(latest).toEqual(before);
  },
);
