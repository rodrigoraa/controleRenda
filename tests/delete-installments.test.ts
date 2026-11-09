import { expect, it } from "vitest";
import { deleteOccurrence } from "../src/lib/entry-editing";
import {
  addMonths,
  invoice,
  occurrences,
  splitPurchase,
  summarize,
} from "../src/lib/finance";
import { createEmptyState, parseBackup } from "../src/lib/validation";
import type { Entry } from "../src/lib/types";
const purchase: Entry = {
  id: "purchase",
  description: "Compra cadastrada errada",
  amount: 100000,
  date: "2026-12-10",
  kind: "expense",
  method: "card",
  owner: "mother",
  category: "Compras",
  repeat: "none",
};
function setup() {
  const state = createEmptyState("2026-11");
  state.entries = splitPurchase(purchase, 10);
  return state;
}
it("exclui as dez parcelas da compra em todos os meses sem atingir outra compra com o mesmo nome", () => {
  const state = setup();
  state.entries.push(
    ...splitPurchase({ ...purchase, id: "purchase-other" }, 2),
  );
  const original = structuredClone(state);
  const changed = deleteOccurrence(
    state,
    occurrences(state, "2027-01").find((e) => e.id === "purchase-2")!,
    "purchase",
  );
  expect(state).toEqual(original);
  expect(changed.entries.map((e) => e.id)).toEqual([
    "purchase-other-1",
    "purchase-other-2",
  ]);
  for (let n = 0; n < 10; n++)
    expect(
      occurrences(changed, addMonths("2026-12", n)).some(
        (e) => e.installment?.group === "purchase",
      ),
    ).toBe(false);
  expect(parseBackup(JSON.stringify(changed))).toEqual(changed);
});
it("limpa ajustes e exclusões antigos, inclusive de parcela movida para outro mês", () => {
  const state = setup();
  state.entries[2].date = "2027-05-12";
  state.overrides["purchase-3:2027-05"] = {
    description: "Parcela corrigida",
    amount: 9000,
    owner: "mother",
    category: "Saúde",
  };
  state.skipped = ["purchase-1:2026-12"];
  const changed = deleteOccurrence(
    state,
    occurrences(state, "2027-01")[0],
    "purchase",
  );
  expect(changed.entries).toEqual([]);
  expect(changed.overrides).toEqual({});
  expect(changed.skipped).toEqual([]);
  expect(parseBackup(JSON.stringify(changed))).toEqual(changed);
});
it("mantém pagamentos e repasses já realizados e não devolve dinheiro ao saldo real", () => {
  const state = setup();
  state.settings.openingBalance = 100000;
  state.payments = [
    { id: "p", month: "2026-12", amount: 5000, date: "2026-11-08" },
  ];
  state.reimbursements = [
    { id: "r", month: "2026-12", amount: 3000, date: "2026-11-09" },
  ];
  const changed = deleteOccurrence(
    state,
    occurrences(state, "2026-12")[0],
    "purchase",
  );
  expect(changed.payments).toEqual(state.payments);
  expect(changed.reimbursements).toEqual(state.reimbursements);
  expect(changed.settings).toEqual(state.settings);
  expect(summarize(state, "2026-12", "2026-11-09").available).toBe(98000);
  expect(summarize(changed, "2026-12", "2026-11-09").available).toBe(98000);
  expect(invoice(changed, "2026-12")).toMatchObject({
    total: 0,
    paid: 5000,
    received: 3000,
    credit: 5000,
    toReceive: 0,
  });
});
it("preserva ajustes, confirmações e exclusões de outros lançamentos", () => {
  const state = setup();
  state.entries.push({
    ...purchase,
    id: "other",
    method: "account",
    owner: "me",
    repeat: "monthly",
  });
  state.overrides["other:2026-12"] = {
    description: "Outro ajuste",
    amount: 9000,
    owner: "me",
    category: "Contas",
  };
  state.settled["other:2026-12"] = { date: "2026-11-09" };
  state.skipped = ["other:2027-01"];
  const changed = deleteOccurrence(
    state,
    occurrences(state, "2026-12").find((e) => e.id === "purchase-1")!,
    "purchase",
  );
  expect(changed.overrides).toEqual(state.overrides);
  expect(changed.settled).toEqual(state.settled);
  expect(changed.skipped).toEqual(state.skipped);
  expect(changed.entries).toEqual([state.entries[10]]);
});
it("permite excluir somente uma parcela e mantém as nove restantes", () => {
  const state = setup();
  const changed = deleteOccurrence(
    state,
    occurrences(state, "2027-01")[0],
    "single",
  );
  expect(occurrences(changed, "2027-01")).toEqual([]);
  expect(occurrences(changed, "2026-12")).toHaveLength(1);
  expect(occurrences(changed, "2027-02")).toHaveLength(1);
  expect(changed.skipped).toEqual(["purchase-2:2027-01"]);
  expect(changed.entries).toHaveLength(10);
});
it("mantém a exclusão mensal para recorrências sem parcelas e limpa sua confirmação", () => {
  const state = setup();
  state.entries = [
    { ...purchase, method: "account", owner: "me", repeat: "monthly" },
  ];
  state.settled["purchase:2026-12"] = { date: "2026-11-09" };
  const changed = deleteOccurrence(
    state,
    occurrences(state, "2026-12")[0],
    "single",
  );
  expect(changed.settled).toEqual({});
  expect(occurrences(changed, "2026-12")).toEqual([]);
  expect(occurrences(changed, "2027-01")).toHaveLength(1);
});
it("recusa exclusão de grupo em lançamento sem parcelas ou de ocorrência removida", () => {
  const state = setup();
  const row = occurrences(state, "2026-12")[0];
  state.skipped = [row.key];
  expect(() => deleteOccurrence(state, row, "purchase")).toThrow(
    /alterado|removido/,
  );
  state.entries = [{ ...purchase }];
  state.skipped = [];
  expect(() =>
    deleteOccurrence(state, occurrences(state, "2026-12")[0], "purchase"),
  ).toThrow(/parcelada/);
});
