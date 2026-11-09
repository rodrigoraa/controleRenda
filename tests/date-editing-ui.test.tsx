import { it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";
import type { BudgetPersistence } from "../src/lib/persistence";
it("permite editar a data e abre o mês correto depois de salvar", async () => {
  let state = createEmptyState("2026-11");
  state.entries = [
    {
      id: "expense",
      description: "Mercado",
      amount: 10000,
      date: "2026-11-05",
      kind: "expense",
      method: "account",
      owner: "me",
      category: "Alimentação",
      repeat: "none",
    },
  ];
  const persistence: BudgetPersistence = {
    initial: { state, snapshot: "0", error: null },
    load: async () => ({ state, snapshot: "1", error: null }),
    save: async (next) => {
      state = next;
      return { state, snapshot: "1", error: null };
    },
  };
  render(<App today="2026-11-09" persistence={persistence} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Editar Mercado" }));
  const date = screen.getByLabelText("Data prevista");
  expect(date).toBeEnabled();
  fireEvent.change(date, { target: { value: "2026-12-08" } });
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(state.entries[0].date).toBe("2026-12-08");
  expect(
    within(screen.getByRole("table")).getByText("08/12", { exact: false }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Voltar para hoje" }),
  ).toBeInTheDocument();
});
it("permite corrigir a data de recebimento de uma receita já confirmada", async () => {
  let state = createEmptyState("2026-11");
  state.entries = [
    {
      id: "salary",
      description: "Salário",
      amount: 300000,
      date: "2026-11-05",
      kind: "income",
      method: "account",
      owner: "me",
      category: "Salário",
      repeat: "monthly",
    },
  ];
  state.settled["salary:2026-11"] = { date: "2026-11-06" };
  const persistence: BudgetPersistence = {
    initial: { state, snapshot: "0", error: null },
    load: async () => ({ state, snapshot: "1", error: null }),
    save: async (next) => {
      state = next;
      return { state, snapshot: "1", error: null };
    },
  };
  render(<App today="2026-11-09" persistence={persistence} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Editar Salário" }));
  expect(screen.getByLabelText("Data do recebimento")).toHaveValue(
    "2026-11-06",
  );
  fireEvent.change(screen.getByLabelText("Data do recebimento"), {
    target: { value: "2026-11-03" },
  });
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(state.settled["salary:2026-11"].date).toBe("2026-11-03");
});
it("preserva a data corrigida em outra aba quando um formulário antigo tenta salvar novamente", async () => {
  const { BudgetConflictError } = await import("../src/lib/persistence");
  const initial = createEmptyState("2026-11");
  initial.entries = [
    {
      id: "salary",
      description: "Salário",
      amount: 300000,
      date: "2026-11-05",
      kind: "income",
      method: "account",
      owner: "me",
      category: "Salário",
      repeat: "none",
    },
  ];
  initial.settled["salary:2026-11"] = { date: "2026-11-06" };
  let latest = structuredClone(initial);
  latest.settled["salary:2026-11"] = { date: "2026-11-03" };
  let writes = 0;
  const persistence: BudgetPersistence = {
    initial: { state: initial, snapshot: "0", error: null },
    load: async () => ({ state: latest, snapshot: "1", error: null }),
    save: async (state, revision) => {
      writes++;
      if (revision === "0") throw new BudgetConflictError("Conflito");
      latest = state;
      return { state, snapshot: "2", error: null };
    },
  };
  render(<App today="2026-11-09" persistence={persistence} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Editar Salário" }));
  await user.clear(screen.getByLabelText("Descrição"));
  await user.type(screen.getByLabelText("Descrição"), "Salário ajustado");
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(latest.settled["salary:2026-11"].date).toBe("2026-11-03");
  expect(writes).toBe(1);
  expect(screen.getByRole("alert")).toHaveTextContent(/Feche a edição/);
});
