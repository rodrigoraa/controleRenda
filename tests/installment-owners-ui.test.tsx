import { expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";
import { occurrences, splitPurchase } from "../src/lib/finance";
import type { BudgetPersistence } from "../src/lib/persistence";
import type { State } from "../src/lib/types";
function persisted(initial: State) {
  let state = initial;
  let revision = "0";
  const persistence: BudgetPersistence = {
    initial: { state, snapshot: revision, error: null },
    load: async () => ({ state, snapshot: revision, error: null }),
    save: async (next, expected) => {
      expect(expected).toBe(revision);
      state = next;
      revision = String(Number(revision) + 1);
      return { state, snapshot: revision, error: null };
    },
  };
  return { persistence, read: () => state };
}
function existing() {
  const state = createEmptyState("2026-11");
  state.entries = splitPurchase(
    {
      id: "purchase",
      description: "Compra parcelada",
      amount: 100000,
      date: "2026-12-10",
      kind: "expense",
      method: "card",
      owner: "me",
      category: "Compras",
      repeat: "none",
    },
    10,
  );
  return state;
}
it("cadastra dez parcelas da mãe começando em dezembro e mostra janeiro com o mesmo responsável", async () => {
  const { persistence, read } = persisted(createEmptyState("2026-11"));
  const user = userEvent.setup();
  render(<App today="2026-11-09" persistence={persistence} />);
  await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await user.type(screen.getByLabelText("Descrição"), "Compra parcelada");
  await user.type(screen.getByLabelText("Valor (R$)"), "1000");
  await user.selectOptions(screen.getByLabelText("Forma de pagamento"), "card");
  await user.selectOptions(screen.getByLabelText("Responsável"), "mother");
  await user.selectOptions(screen.getByLabelText("Parcelas"), "10");
  fireEvent.change(screen.getByLabelText("Data na primeira fatura"), {
    target: { value: "2026-12-10" },
  });
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(read().entries).toHaveLength(10);
  expect(read().entries.every((e) => e.owner === "mother")).toBe(true);
  await user.click(
    screen.getByRole("button", { name: "Lançamentos" }),
  );
  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  expect(
    screen.getByRole("combobox", { name: "Responsável por Compra parcelada" }),
  ).toHaveValue("mother");
  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  expect(
    screen.getByRole("combobox", { name: "Responsável por Compra parcelada" }),
  ).toHaveValue("mother");
});
it("corrige janeiro e as demais parcelas de uma compra antiga ao selecionar Minha mãe", async () => {
  const state = existing();
  state.overrides["purchase-1:2026-12"] = {
    description: "Compra parcelada",
    amount: 10000,
    category: "Compras",
    owner: "mother",
  };
  const { persistence, read } = persisted(state);
  const user = userEvent.setup();
  const { unmount } = render(
    <App today="2026-12-09" persistence={persistence} />,
  );
  await user.click(
    screen.getByRole("button", { name: "Lançamentos" }),
  );
  expect(
    screen.getByRole("combobox", { name: "Responsável por Compra parcelada" }),
  ).toHaveValue("mother");
  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Responsável por Compra parcelada" }),
    "mother",
  );
  expect(read().entries.every((e) => e.owner === "mother")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  expect(
    screen.getByRole("combobox", { name: "Responsável por Compra parcelada" }),
  ).toHaveValue("mother");
  unmount();
  render(
    <App
      today="2027-01-09"
      persistence={{
        ...persistence,
        initial: { state: read(), snapshot: "1", error: null },
      }}
    />,
  );
  expect(
    screen.getByRole("combobox", { name: "Responsável por Compra parcelada" }),
  ).toHaveValue("mother");
});
it("trocar responsável no lápis propaga às parcelas sem propagar o valor editado", async () => {
  const { persistence, read } = persisted(existing());
  const user = userEvent.setup();
  render(<App today="2026-12-09" persistence={persistence} />);
  await user.click(
    screen.getByRole("button", { name: "Editar Compra parcelada" }),
  );
  await user.selectOptions(screen.getByLabelText("Responsável"), "mother");
  await user.clear(screen.getByLabelText("Valor (R$)"));
  await user.type(screen.getByLabelText("Valor (R$)"), "120");
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(occurrences(read(), "2026-12")[0]).toMatchObject({
    owner: "mother",
    amount: 12000,
  });
  expect(occurrences(read(), "2027-01")[0]).toMatchObject({
    owner: "mother",
    amount: 10000,
    date: "2027-01-10",
  });
});
