import { it, expect } from "vitest";
import { screen, render, within } from "./render";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";

it("deixa a linha do tempo em Planejar e o saldo atual na Visão Geral", async () => {
  const state = createEmptyState("2026-11");
  state.settings.openingBalance = 50000;
  state.entries = ["Aluguel", "Telefone", "Luz", "Internet"].map(
    (description, i) => ({
      id: `expense${i}`,
      description,
      date: `2026-11-${12 + i}`,
      amount: i === 3 ? 1000 : 17000,
      kind: "expense",
      method: "account",
      repeat: "none",
      category: "Contas",
      owner: "me",
    }),
  );
  const initial = { state, snapshot: "0", error: null };
  render(
    <App
      today="2026-11-10"
      persistence={{
        initial,
        load: async () => initial,
        save: async () => initial,
      }}
    />,
  );
  expect(
    screen.getByRole("region", { name: "Saldo disponível hoje" }),
  ).toHaveTextContent("R$ 500,00");
  expect(
    screen.queryByRole("heading", {
      name: "Saldo acumulado nos próximos meses",
    }),
  ).not.toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Ver próximos dias" }));
  const timeline = screen.getByRole("region", {
    name: "Saldo ao longo dos próximos 30 dias",
  });
  expect(within(timeline).getByText("Internet")).toBeInTheDocument();
  expect(timeline).toHaveTextContent("Há risco de faltar dinheiro");
  expect(
    screen.getByRole("heading", { name: "Saldo acumulado nos próximos meses" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Saldo disponível hoje" }),
  ).not.toBeInTheDocument();
});
