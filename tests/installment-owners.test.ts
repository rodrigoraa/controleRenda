import { expect, it } from "vitest";
import {
  assignOccurrenceOwner,
  editOccurrence,
} from "../src/lib/entry-editing";
import {
  addMonths,
  invoice,
  occurrences,
  splitPurchase,
} from "../src/lib/finance";
import { createEmptyState, parseBackup } from "../src/lib/validation";
import type { Entry } from "../src/lib/types";
const purchase: Entry = {
  id: "purchase",
  description: "Compra da mãe",
  amount: 100000,
  date: "2026-12-10",
  kind: "expense",
  method: "card",
  owner: "me",
  category: "Compras",
  repeat: "none",
};
function setup() {
  const state = createEmptyState("2026-11");
  state.entries = splitPurchase(purchase, 10);
  return state;
}
it("cria as dez parcelas já com o responsável escolhido, inclusive na virada do ano", () => {
  const state = setup();
  state.entries = splitPurchase({ ...purchase, owner: "mother" }, 10);
  for (let n = 0; n < 10; n++) {
    expect(occurrences(state, addMonths("2026-12", n))[0]).toMatchObject({
      owner: "mother",
      amount: 10000,
      installment: { index: n + 1, total: 10 },
    });
  }
});
it("atribui toda a compra parcelada à mãe ao mudar a primeira parcela na lista", () => {
  const state = setup();
  const original = structuredClone(state);
  const changed = assignOccurrenceOwner(
    state,
    occurrences(state, "2026-12")[0],
    "mother",
  );
  expect(state).toEqual(original);
  expect(changed.entries.every((e) => e.owner === "mother")).toBe(true);
  expect(invoice(changed, "2026-12")).toMatchObject({
    me: 0,
    mother: 10000,
    toReceive: 10000,
  });
  expect(invoice(changed, "2027-01")).toMatchObject({
    me: 0,
    mother: 10000,
    toReceive: 10000,
  });
  expect(parseBackup(JSON.stringify(changed))).toEqual(changed);
});
it("corrige compras antigas inconsistentes e preserva valores, datas, exclusões e repasses", () => {
  const state = setup();
  state.overrides["purchase-1:2026-12"] = {
    description: "Compra identificada",
    amount: 10001,
    owner: "mother",
    category: "Saúde",
  };
  state.overrides["purchase-2:2027-01"] = {
    description: "Valor corrigido",
    amount: 9999,
    owner: "me",
    category: "Estudos",
  };
  state.skipped = ["purchase-3:2027-02"];
  state.payments = [
    { id: "pay", month: "2026-12", amount: 5000, date: "2026-11-09" },
  ];
  state.reimbursements = [
    { id: "pix", month: "2026-12", amount: 3000, date: "2026-11-09" },
  ];
  const changed = assignOccurrenceOwner(
    state,
    occurrences(state, "2027-01")[0],
    "mother",
  );
  expect(changed.overrides["purchase-2:2027-01"]).toEqual({
    ...state.overrides["purchase-2:2027-01"],
    owner: "mother",
  });
  expect(changed.entries.map((e) => ({ ...e, owner: "me" }))).toEqual(
    state.entries,
  );
  expect(changed.skipped).toEqual(state.skipped);
  expect(changed.payments).toEqual(state.payments);
  expect(changed.reimbursements).toEqual(state.reimbursements);
  expect(invoice(changed, "2027-01")).toMatchObject({ me: 0, mother: 9999 });
  expect(invoice(changed, "2026-12")).toMatchObject({
    paid: 5000,
    received: 3000,
    mother: 10001,
    toReceive: 7001,
  });
});
it.each(["2026-12-10", "2027-01-12"])(
  "corrige o responsável pelo formulário, inclusive ao mudar a data para %s",
  (date) => {
    const state = setup();
    const row = occurrences(state, "2026-12")[0];
    state.overrides["purchase-2:2027-01"] = {
      description: "Ajuste individual",
      amount: 9000,
      owner: "me",
      category: "Saúde",
    };
    const changed = editOccurrence(state, row, {
      ...row,
      date,
      owner: "mother",
      description: "Primeira corrigida",
    });
    expect(changed.entries.every((e) => e.owner === "mother")).toBe(true);
    expect(
      occurrences(changed, "2027-01").every((e) => e.owner === "mother"),
    ).toBe(true);
    expect(changed.overrides["purchase-2:2027-01"]).toEqual({
      ...state.overrides["purchase-2:2027-01"],
      owner: "mother",
    });
    expect(occurrences(changed, "2027-02")[0]).toMatchObject({
      date: "2027-02-10",
      amount: 10000,
      description: "Compra da mãe",
    });
  },
);
it("editar apenas data ou valor não muda responsáveis de outras parcelas", () => {
  const state = setup();
  state.entries[1].owner = "mother";
  const row = occurrences(state, "2026-12")[0];
  const changed = editOccurrence(state, row, {
    ...row,
    date: "2026-12-12",
    amount: 11000,
  });
  expect(occurrences(changed, "2027-01")[0].owner).toBe("mother");
  expect(occurrences(changed, "2027-02")[0].owner).toBe("me");
});
it("não agrupa compras diferentes pelo nome e aceita A identificar em toda a compra", () => {
  const state = setup();
  state.entries.push(
    ...splitPurchase({ ...purchase, id: "another", owner: "mother" }, 2),
  );
  const changed = assignOccurrenceOwner(
    state,
    occurrences(state, "2026-12").find((e) => e.id === "purchase-1")!,
    "unknown",
  );
  expect(
    changed.entries
      .filter((e) => e.installment?.group === "purchase")
      .every((e) => e.owner === "unknown"),
  ).toBe(true);
  expect(
    changed.entries
      .filter((e) => e.installment?.group === "another")
      .every((e) => e.owner === "mother"),
  ).toBe(true);
});
it("mantém a atribuição individual em compras avulsas e recorrências sem parcelas", () => {
  const state = setup();
  state.entries = [{ ...purchase, repeat: "monthly" }];
  const changed = assignOccurrenceOwner(
    state,
    occurrences(state, "2026-12")[0],
    "mother",
  );
  expect(occurrences(changed, "2026-12")[0].owner).toBe("mother");
  expect(occurrences(changed, "2027-01")[0].owner).toBe("me");
});
it("recusa edição antiga se outra aba corrigiu o responsável da compra", () => {
  const state = setup();
  const row = occurrences(state, "2026-12")[0];
  const latest = structuredClone(state);
  latest.entries = latest.entries.map((e) => ({
    ...e,
    owner: "mother" as const,
  }));
  expect(() =>
    editOccurrence(latest, row, { ...row, description: "Ajuste antigo" }),
  ).toThrow(/alterado/);
});
