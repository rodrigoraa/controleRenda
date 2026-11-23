import { expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "./render";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";
import type { Entry } from "../src/lib/types";

it("mostra o saldo de hoje e troca o movimento, a fatura e a previsão com o mês", async () => {
  const state = createEmptyState("2026-11");
  state.settings.openingBalance = 50000;
  state.people = [{ id: "person_ana", name: "Ana" }];
  const entry = (
    value: Partial<Entry> & Pick<Entry, "id" | "amount">,
  ): Entry => ({
    description: value.id,
    category: "Outros",
    date: "2026-11-05",
    kind: "expense",
    method: "account",
    owner: "me",
    repeat: "none",
    ...value,
  });
  state.entries = [
    entry({ id: "Salário", amount: 100000, kind: "income", repeat: "monthly" }),
    entry({ id: "Luz", amount: 12000 }),
    entry({ id: "Internet prevista", amount: 6000 }),
    entry({ id: "Minha compra", amount: 10000, method: "card" }),
    entry({
      id: "Compra da minha mãe",
      amount: 20000,
      method: "card",
      owner: "mother",
    }),
    entry({
      id: "Compra da Ana",
      amount: 30000,
      method: "card",
      owner: "person_ana",
    }),
  ];
  state.settled["Salário:2026-11"] = { date: "2026-11-07" };
  state.settled["Luz:2026-11"] = { date: "2026-11-08" };
  const initial = { state, snapshot: "0", error: null };
  const user = userEvent.setup();
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
    screen.getByRole("heading", { name: "Visão Geral", level: 1 }),
  ).toBeInTheDocument();
  const balance = screen.getByRole("region", { name: "Saldo disponível hoje" });
  const flow = screen.getByRole("region", { name: "Entradas e saídas" });
  const card = screen.getByRole("region", { name: "Cartão do orçamento" });
  const forecast = screen.getByRole("region", {
    name: "Previsão do próximo mês",
  });
  expect(balance).toHaveTextContent("R$ 1.380,00");
  expect(flow).toHaveTextContent("R$ 1.000,00");
  expect(flow).toHaveTextContent("R$ 120,00");
  expect(flow).not.toHaveTextContent("R$ 180,00");
  expect(card).toHaveTextContent("R$ 600,00");
  expect(card).toHaveTextContent("Eu");
  expect(card).toHaveTextContent("Minha mãe");
  expect(card).toHaveTextContent("Ana");
  expect(forecast).toHaveTextContent("dezembro de 2026");
  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  expect(balance).toHaveTextContent("R$ 1.380,00");
  expect(within(flow).getAllByText("R$ 0,00")).toHaveLength(2);
  expect(card).toHaveTextContent("R$ 0,00");
  expect(forecast).toHaveTextContent("janeiro de 2027");

  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.click(screen.getByRole("button", { name: "Voltar ao mês atual" }));
  await user.click(screen.getByRole("button", { name: "Só recorrentes" }));
  expect(
    within(screen.getByRole("table")).getByText("Salário"),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("table")).queryByText("Luz"),
  ).not.toBeInTheDocument();
});
