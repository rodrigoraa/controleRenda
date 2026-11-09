import { it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";
import type { BudgetPersistence } from "../src/lib/persistence";
import { STORAGE_KEY } from "../src/lib/storage";
it("não grava localmente nem anuncia sucesso se o servidor recusar o salvamento", async () => {
  const initial = {
    state: createEmptyState("2026-11"),
    snapshot: "0",
    error: null,
  };
  const persistence: BudgetPersistence = {
    initial,
    load: async () => initial,
    save: async () => {
      throw new Error("Servidor indisponível.");
    },
  };
  render(<App today="2026-11-06" persistence={persistence} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await user.click(screen.getByRole("button", { name: "Receita" }));
  await user.type(screen.getByLabelText("Descrição"), "Salário");
  await user.type(screen.getByLabelText("Valor (R$)"), "5000");
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Servidor indisponível.",
  );
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Saldo previsto no fim do mês" })).getByText(
      "R$ 0,00",
    ),
  ).toBeInTheDocument();
});
it("fecha uma confirmação desatualizada e permite refazer a ação com a revisão atual", async () => {
  const { BudgetConflictError } = await import("../src/lib/persistence");
  const first = createEmptyState("2026-11");
  first.entries = [
    {
      id: "expense",
      description: "Conta de luz",
      amount: 10000,
      date: "2026-11-10",
      kind: "expense",
      method: "account",
      owner: "me",
      category: "Contas",
      repeat: "none",
    },
  ];
  const latest = structuredClone(first);
  latest.entries[0].amount = 12000;
  const revisions: (string | null)[] = [];
  const persistence: BudgetPersistence = {
    initial: { state: first, snapshot: "0", error: null },
    load: async () => ({ state: latest, snapshot: "1", error: null }),
    save: async (state, expected) => {
      revisions.push(expected);
      if (expected === "0") throw new BudgetConflictError("Conflito");
      return { state, snapshot: "2", error: null };
    },
  };
  render(<App today="2026-11-06" persistence={persistence} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.click(
    screen.getByRole("button", { name: "Excluir Conta de luz" }),
  );
  await user.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Excluir Conta de luz" }),
  );
  await user.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(revisions).toEqual(["0", "1"]);
});
