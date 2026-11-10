import { expect, it } from "vitest";
import { fireEvent, render, screen, within } from "./render";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";
import { occurrences, summarize } from "../src/lib/finance";
import type { BudgetPersistence } from "../src/lib/persistence";
it("informa saldo de hoje e inicia renda apenas no próximo mês, inclusive após reabrir", async () => {
  let state = createEmptyState("2026-11");
  state.entries = [
    {
      id: "old",
      description: "Receita já recebida",
      amount: 90000,
      kind: "income",
      method: "account",
      owner: "me",
      category: "Outros",
      date: "2026-11-01",
      repeat: "none",
    },
  ];
  state.settled["old:2026-11"] = { date: "2026-11-01" };
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
  const user = userEvent.setup();
  const { unmount } = render(
    <App today="2026-11-09" persistence={persistence} />,
  );
  await user.click(
    screen.getByRole("button", { name: "Informar saldo de hoje" }),
  );
  const balance = screen.getByLabelText("Saldo na conta hoje (R$)");
  await user.clear(balance);
  await user.type(balance, "380,03");
  await user.click(screen.getByRole("button", { name: "Salvar saldo atual" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    within(
      screen.getByRole("region", { name: "Saldo disponível hoje" }),
    ).getByText("R$ 380,03"),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await user.click(screen.getByRole("button", { name: "Receita" }));
  await user.type(screen.getByLabelText("Descrição"), "Bolsa mensal");
  await user.type(screen.getByLabelText("Valor (R$)"), "2221");
  await user.selectOptions(screen.getByLabelText("Repetição"), "monthly");
  fireEvent.change(screen.getByLabelText("Data prevista"), {
    target: { value: "2026-11-05" },
  });
  await user.click(
    screen.getByLabelText("Já recebi este valor", { exact: false }),
  );
  await user.click(
    screen.getByRole("button", { name: "A partir do próximo mês" }),
  );
  expect(screen.getByLabelText("Data prevista")).toHaveValue("2026-12-05");
  expect(
    screen.getByLabelText("Já recebi este valor", { exact: false }),
  ).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(occurrences(state, "2026-11").map((e) => e.id)).toEqual(["old"]);
  expect(
    occurrences(state, "2026-12").filter(
      (e) => e.description === "Bolsa mensal",
    ),
  ).toHaveLength(1);
  expect(summarize(state, "2026-11", "2026-11-09").available).toBe(38003);
  expect(
    within(
      screen.getByRole("region", { name: "Previsão do próximo mês" }),
    ).getByText("R$ 2.601,03"),
  ).toBeInTheDocument();
  unmount();
  render(
    <App
      today="2026-11-09"
      persistence={{
        ...persistence,
        initial: { state, snapshot: revision, error: null },
      }}
    />,
  );
  expect(
    within(
      screen.getByRole("region", { name: "Saldo disponível hoje" }),
    ).getByText("R$ 380,03"),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  expect(
    within(screen.getByRole("table")).getByText("Bolsa mensal"),
  ).toBeInTheDocument();
});
it("mantém saldo anterior e formulário aberto quando o servidor recusa o ajuste", async () => {
  const state = createEmptyState("2026-11");
  state.settings.openingBalance = 50000;
  const persistence: BudgetPersistence = {
    initial: { state, snapshot: "0", error: null },
    load: async () => ({ state, snapshot: "0", error: null }),
    save: async () => {
      throw new Error("Servidor indisponível.");
    },
  };
  const user = userEvent.setup();
  render(<App today="2026-11-09" persistence={persistence} />);
  await user.click(
    screen.getByRole("button", { name: "Informar saldo de hoje" }),
  );
  await user.clear(screen.getByLabelText("Saldo na conta hoje (R$)"));
  await user.type(screen.getByLabelText("Saldo na conta hoje (R$)"), "380,03");
  await user.click(screen.getByRole("button", { name: "Salvar saldo atual" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Servidor indisponível.",
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(state.settings.openingBalance).toBe(50000);
});
it("refaz o ajuste a partir dos dados atuais após conflito sem perder uma entrada de outra aba", async () => {
  const { BudgetConflictError } = await import("../src/lib/persistence");
  const initial = createEmptyState("2026-11");
  let state = structuredClone(initial);
  state.entries = [
    {
      id: "other",
      description: "Pix confirmado em outra aba",
      amount: 90000,
      date: "2026-11-09",
      kind: "income",
      method: "account",
      owner: "me",
      category: "Outros",
      repeat: "none",
    },
  ];
  state.settled["other:2026-11"] = { date: "2026-11-09" };
  const persistence: BudgetPersistence = {
    initial: { state: initial, snapshot: "0", error: null },
    load: async () => ({ state, snapshot: "1", error: null }),
    save: async (next, expected) => {
      if (expected === "0") throw new BudgetConflictError("Conflito");
      state = next;
      return { state, snapshot: "2", error: null };
    },
  };
  const user = userEvent.setup();
  render(<App today="2026-11-09" persistence={persistence} />);
  await user.click(
    screen.getByRole("button", { name: "Informar saldo de hoje" }),
  );
  await user.clear(screen.getByLabelText("Saldo na conta hoje (R$)"));
  await user.type(screen.getByLabelText("Saldo na conta hoje (R$)"), "380,03");
  await user.click(screen.getByRole("button", { name: "Salvar saldo atual" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Sua alteração não foi gravada",
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Salvar saldo atual" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(summarize(state, "2026-11", "2026-11-09").available).toBe(38003);
  expect(state.entries[0].id).toBe("other");
  expect(state.settled["other:2026-11"].date).toBe("2026-11-09");
});
it("permite informar saldo negativo pelo controle de sinal e voltar a positivo sem digitar menos", async () => {
  let state = createEmptyState("2026-11");
  const persistence: BudgetPersistence = {
    initial: { state, snapshot: "0", error: null },
    load: async () => ({ state, snapshot: "0", error: null }),
    save: async (next) => {
      state = next;
      return { state, snapshot: "1", error: null };
    },
  };
  const user = userEvent.setup();
  render(<App today="2026-11-09" persistence={persistence} />);
  await user.click(
    screen.getByRole("button", { name: "Informar saldo de hoje" }),
  );
  const amount = screen.getByLabelText("Saldo na conta hoje (R$)");
  await user.clear(amount);
  await user.type(amount, "150,00");
  await user.click(screen.getByRole("checkbox", { name: "Saldo negativo" }));
  await user.click(screen.getByRole("button", { name: "Salvar saldo atual" }));
  expect(summarize(state, "2026-11", "2026-11-09").available).toBe(-15000);
  await user.click(
    screen.getByRole("button", { name: "Informar saldo de hoje" }),
  );
  expect(
    screen.getByRole("checkbox", { name: "Saldo negativo" }),
  ).toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "Saldo negativo" }));
  await user.click(screen.getByRole("button", { name: "Salvar saldo atual" }));
  expect(summarize(state, "2026-11", "2026-11-09").available).toBe(15000);
});
