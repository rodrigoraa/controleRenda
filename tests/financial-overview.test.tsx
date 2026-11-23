import { afterEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "./render";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";
import type { BankOverview } from "../src/lib/bank-feed";
import type { Entry } from "../src/lib/types";

afterEach(() => vi.unstubAllGlobals());

it("mantém o resumo de hoje e atualiza a previsão para o mês seguinte ao selecionado", async () => {
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
    entry({ id: "Bônus", date: "2027-01-12", kind: "income", amount: 25001 }),
    entry({ id: "Anuidade", date: "2027-01-20", amount: 4511 }),
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
  const flow = screen.getByRole("region", { name: /Previsão para o mês atual/ });
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
  const forecastBalance = within(forecast).getByRole("group", {
    name: "Saldo previsto no fim do mês",
  });
  expect(forecastBalance).toHaveTextContent("R$ 1.920,00");
  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  expect(balance).toHaveTextContent("R$ 1.380,00");
  expect(flow).toHaveTextContent("R$ 1.000,00");
  expect(flow).toHaveTextContent("R$ 120,00");
  expect(card).toHaveTextContent("R$ 0,00");
  expect(forecast).toHaveTextContent("janeiro de 2027");
  expect(forecast).toHaveTextContent("O que vai entrar");
  expect(forecast).toHaveTextContent("R$ 1.250,01");
  expect(forecast).toHaveTextContent("O que vai sair");
  expect(forecast).toHaveTextContent("R$ 45,11");
  expect(forecastBalance).toHaveTextContent("R$ 3.124,90");

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

it("mostra cada cartão conectado mesmo sem fatura e reúne faturas do mesmo cartão", async () => {
  const emptyCredit = {
    kind: "credit" as const,
    balance: null,
    transactions: [],
    bills: [],
    limited: false,
  };
  const view: BankOverview = {
    enabled: true,
    status: "ready",
    checkedAt: null,
    banks: [{
      institution: "nubank",
      status: "ready",
      providerUpdatedAt: null,
      accounts: [
        { ...emptyCredit, bills: [
          { due: "2026-11-05", amount: 10000 },
          { due: "2026-11-20", amount: 15000 },
        ] },
        emptyCredit,
        { ...emptyCredit, kind: "checking", balance: 50000 },
        { ...emptyCredit, kind: "savings" },
      ],
    }],
  };
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(view)));
  const initial = { state: createEmptyState("2026-11"), snapshot: "0", error: null };
  const user = userEvent.setup();
  render(
    <App
      today="2026-11-10"
      account={{
        user: { id: "account-id", name: "Rodrigo", email: "rodrigo@example.test" },
        onLogout: async () => {},
      }}
      persistence={{ initial, load: async () => initial, save: async () => initial }}
    />,
  );

  const first = await screen.findByRole("region", { name: "Nubank · Cartão 1" });
  const second = screen.getByRole("region", { name: "Nubank · Cartão 2" });
  expect(first).toHaveTextContent("CRÉDITO");
  expect(first).toHaveTextContent("R$ 250,00");
  expect(second).toHaveTextContent("Sem fatura no mês");
  const checking = screen.getByRole("region", { name: "Nubank (Conta corrente)" });
  expect(checking).toHaveTextContent("DÉBITO");
  expect(checking).toHaveTextContent("R$ 500,00");
  expect(screen.getByRole("region", { name: "Nubank (Poupança)" })).toHaveTextContent("Saldo indisponível");

  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  expect(first).toHaveTextContent("Sem fatura no mês");
  expect(second).toHaveTextContent("Sem fatura no mês");
});

it("mostra débito e crédito do mesmo banco juntos quando há um de cada", async () => {
  const common = { limited: false, transactions: [] };
  const view: BankOverview = {
    enabled: true,
    status: "ready",
    checkedAt: null,
    banks: [{
      institution: "nubank",
      status: "ready",
      providerUpdatedAt: null,
      accounts: [
        { ...common, kind: "checking", balance: 144, bills: [] },
        {
          ...common,
          kind: "credit",
          balance: null,
          bills: [{ due: "2026-11-13", amount: 42503 }],
        },
      ],
    }],
  };
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(view)));
  const initial = { state: createEmptyState("2026-11"), snapshot: "0", error: null };
  const user = userEvent.setup();
  render(
    <App
      today="2026-11-10"
      account={{
        user: { id: "account-id", name: "Rodrigo", email: "rodrigo@example.test" },
        onLogout: async () => {},
      }}
      persistence={{ initial, load: async () => initial, save: async () => initial }}
    />,
  );

  const nubank = await screen.findByRole("region", { name: /^Nubank$/ });
  expect(nubank).toHaveTextContent("DÉBITO");
  expect(nubank).toHaveTextContent("R$ 1,44");
  expect(nubank).toHaveTextContent("CRÉDITO");
  expect(nubank).toHaveTextContent("R$ 425,03");
  expect(screen.queryByRole("region", { name: "Nubank (Conta corrente)" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  expect(nubank).toHaveTextContent("R$ 1,44");
  expect(nubank).toHaveTextContent("Sem fatura no mês");
});
