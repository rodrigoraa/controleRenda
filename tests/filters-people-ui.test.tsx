import { expect, it } from "vitest";
import { fireEvent, render, screen, within } from "./render";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";
import type { State } from "../src/lib/types";
import type { BudgetPersistence } from "../src/lib/persistence";
function persistenceFor(initial: State) {
  let state = initial,
    revision = "0";
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
it("combina situação, responsável e valor e ordena a lista sem mudar o orçamento", async () => {
  const state = createEmptyState("2026-11");
  const expense = {
    amount: 10000,
    date: "2026-12-10",
    kind: "expense" as const,
    method: "card" as const,
    owner: "mother" as const,
    category: "Compras",
    repeat: "none" as const,
  };
  state.entries = [
    { ...expense, id: "small", description: "Pequena" },
    { ...expense, id: "large", description: "Grande", amount: 50000 },
    {
      ...expense,
      id: "mine",
      description: "Minha",
      owner: "me",
      amount: 30000,
    },
  ];
  const { persistence, read } = persistenceFor(state);
  const user = userEvent.setup();
  render(<App today="2026-12-09" persistence={persistence} />);
  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.selectOptions(screen.getByLabelText("Situação"), "pending");
  await user.selectOptions(
    screen.getByLabelText("Responsável dos lançamentos"),
    "mother",
  );
  await user.selectOptions(screen.getByLabelText("Ordenar por"), "amount-desc");
  const table = screen.getByRole("table");
  expect(
    within(table)
      .getAllByRole("button", { name: /^Editar / })
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual(["Editar Grande", "Editar Pequena"]);
  await user.type(screen.getByLabelText("Valor mínimo (R$)"), "200");
  expect(within(table).queryByText("Pequena")).not.toBeInTheDocument();
  expect(within(table).getByText("Grande")).toBeInTheDocument();
  await user.type(screen.getByLabelText("Valor máximo (R$)"), "100");
  expect(screen.getByRole("alert")).toHaveTextContent(/mínimo/);
  expect(within(table).queryByText("Grande")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
  expect(within(table).getByText("Minha")).toBeInTheDocument();
  expect(read()).toEqual(state);
});
it("cadastra outra pessoa no formulário, preserva o rascunho e filtra suas dez parcelas após reabrir", async () => {
  const { persistence, read } = persistenceFor(createEmptyState("2026-11"));
  const user = userEvent.setup();
  const { unmount } = render(
    <App today="2026-11-09" persistence={persistence} />,
  );
  await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await user.type(screen.getByLabelText("Descrição"), "Compra Alex");
  await user.type(screen.getByLabelText("Valor (R$)"), "1000");
  await user.selectOptions(screen.getByLabelText("Forma de pagamento"), "card");
  await user.click(screen.getByRole("button", { name: "Adicionar pessoa" }));
  await user.type(screen.getByLabelText("Nome da pessoa"), "Alex");
  await user.click(screen.getByRole("button", { name: "Cadastrar pessoa" }));
  expect(screen.getByLabelText("Descrição")).toHaveValue("Compra Alex");
  const person = read().people![0];
  expect(person.name).toBe("Alex");
  expect(screen.getByLabelText("Responsável")).toHaveValue(person.id);
  await user.selectOptions(screen.getByLabelText("Parcelas"), "10");
  fireEvent.change(screen.getByLabelText("Data na primeira fatura"), {
    target: { value: "2026-12-10" },
  });
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(read().entries.every((entry) => entry.owner === person.id)).toBe(true);
  unmount();
  render(
    <App
      today="2027-01-09"
      persistence={{
        ...persistence,
        initial: { state: read(), snapshot: "2", error: null },
      }}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.selectOptions(
    screen.getByLabelText("Responsável dos lançamentos"),
    person.id,
  );
  expect(
    within(screen.getByRole("table")).getByText("Compra Alex"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("combobox", { name: "Responsável por Compra Alex" }),
  ).toHaveValue(person.id);
});
it("cadastra e atribui outra pessoa pela lista, preservando a compra em caso de falha", async () => {
  const state = createEmptyState("2026-11");
  state.entries = [
    {
      id: "mine",
      description: "Compra",
      amount: 10000,
      date: "2026-11-10",
      kind: "expense",
      method: "card",
      owner: "me",
      category: "Compras",
      repeat: "none",
    },
  ];
  const { persistence, read } = persistenceFor(state);
  const user = userEvent.setup();
  render(<App today="2026-11-09" persistence={persistence} />);
  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Responsável por Compra" }),
    "__add_person__",
  );
  await user.type(screen.getByLabelText("Nome da pessoa"), "Ana");
  persistence.save = async () => {
    throw new Error("Servidor indisponível.");
  };
  await user.click(screen.getByRole("button", { name: "Cadastrar pessoa" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Servidor indisponível.",
  );
  expect(read().people ?? []).toEqual([]);
  expect(read().entries[0].owner).toBe("me");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
