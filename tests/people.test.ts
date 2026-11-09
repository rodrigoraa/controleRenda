import { expect, it } from "vitest";
import { addPersonToBudget, personName } from "../src/lib/people";
import {
  createEmptyState,
  parseBackup,
  serializeBackup,
} from "../src/lib/validation";
import { invoice, splitPurchase, summarize } from "../src/lib/finance";
it("cadastra uma pessoa por ID estável e mantém suas parcelas ao exportar e importar", () => {
  const state = createEmptyState("2026-11");
  const original = structuredClone(state);
  const added = addPersonToBudget(state, "  Alex  ");
  expect(state).toEqual(original);
  expect(added.person.name).toBe("Alex");
  expect(added.person.id).toMatch(/^person_/);
  added.state.entries = splitPurchase(
    {
      id: "purchase",
      description: "Compra",
      amount: 100000,
      date: "2026-12-10",
      kind: "expense",
      method: "card",
      owner: added.person.id,
      category: "Compras",
      repeat: "none",
    },
    10,
  );
  const restored = parseBackup(serializeBackup(added.state));
  expect(restored.people).toEqual([added.person]);
  expect(restored.entries.every((e) => e.owner === added.person.id)).toBe(true);
  expect(personName(restored.people, added.person.id)).toBe("Alex");
});
it.each(["", "  ", "Eu", "Minha mãe", "A identificar"])(
  "recusa nome vazio ou reservado %j",
  (name) => {
    expect(() =>
      addPersonToBudget(createEmptyState("2026-11"), name),
    ).toThrow();
  },
);
it("recusa duplicação de nomes e referências para pessoa inexistente", () => {
  const { state } = addPersonToBudget(createEmptyState("2026-11"), "Alex");
  expect(() => addPersonToBudget(state, " alex ")).toThrow(/cadastrada/i);
  const invalid = {
    ...state,
    entries: [
      {
        id: "bad",
        description: "Compra",
        amount: 10000,
        date: "2026-12-10",
        kind: "expense",
        method: "card",
        owner: "person_missing",
        category: "Compras",
        repeat: "none",
      },
    ],
  };
  expect(() => parseBackup(JSON.stringify(invalid))).toThrow();
});
it("preserva backups antigos sem pessoas e separa gastos alheios sem inventar repasses", () => {
  const legacy = createEmptyState("2026-11");
  expect(parseBackup(JSON.stringify(legacy))).toEqual(legacy);
  const { state, person } = addPersonToBudget(legacy, "Alex");
  state.settings.openingBalance = 50000;
  state.entries = [
    {
      id: "other",
      description: "Compra Alex",
      amount: 10000,
      date: "2026-12-10",
      kind: "expense",
      method: "card",
      owner: person.id,
      category: "Compras",
      repeat: "none",
    },
  ];
  expect(invoice(state, "2026-12")).toMatchObject({
    total: 10000,
    me: 0,
    mother: 0,
    toReceive: 0,
    otherParts: [{ owner: person.id, name: "Alex", amount: 10000 }],
  });
  expect(summarize(state, "2026-12", "2026-11-09")).toMatchObject({
    personalExpenses: 0,
    closing: 40000,
    available: 50000,
  });
});
