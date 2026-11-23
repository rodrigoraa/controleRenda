import { it, expect } from "vitest";
import { screen, render, within } from "./render";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";

it("mostra a margem, o risco e até três movimentos antes dos detalhes", async () => {
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
  const margin = screen.getByRole("region", {
    name: "Quanto posso gastar hoje?",
  });
  expect(margin).toHaveTextContent("R$ 0,00");
  expect(margin).toHaveTextContent("R$ 20,00");
  const upcoming = screen.getByRole("region", { name: "O que vem a seguir?" });
  expect(within(upcoming).getAllByRole("listitem")).toHaveLength(3);
  expect(within(upcoming).queryByText("Internet")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", {
      name: "Saldo acumulado nos próximos meses",
    }),
  ).not.toBeInTheDocument();
  await userEvent
    .setup()
    .click(within(upcoming).getByRole("button", { name: "Ver próximos dias" }));
  expect(
    screen.getByRole("heading", {
      name: "Saldo ao longo dos próximos 30 dias",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Saldo acumulado nos próximos meses" }),
  ).toBeInTheDocument();
});
