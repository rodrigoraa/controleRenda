import { afterEach, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "./render";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";
import type { BankOverview, BankPurchaseOwner } from "../src/lib/bank-feed";

const initial = {
  state: createEmptyState("2026-11"),
  snapshot: "0",
  error: null,
};
const account = {
  user: { id: "account-id", name: "Rodrigo", email: "rodrigo@example.test" },
  onLogout: async () => {},
};
const key = "a".repeat(64);

function bankView(owner: BankPurchaseOwner): BankOverview {
  return {
    enabled: true,
    status: "ready",
    checkedAt: "2026-11-10T15:00:00Z",
    banks: [
      {
        institution: "nubank",
        status: "ready",
        providerUpdatedAt: "2026-11-10T12:00:00Z",
        accounts: [
          {
            kind: "credit",
            balance: null,
            limited: false,
            bills: [],
            transactions: [
              {
                date: "2026-11-08",
                description: "Mercado",
                amount: 8000,
                direction: "DEBIT",
                status: "POSTED",
                purchaseKey: key,
                owner,
              },
            ],
          },
        ],
      },
    ],
  };
}

function renderBudget(strict = false) {
  const save = vi.fn(async () => initial);
  const app = (
    <App
      account={account}
      today="2026-11-10"
      persistence={{ initial, load: async () => initial, save }}
    />
  );
  render(strict ? <StrictMode>{app}</StrictMode> : app);
  return { save, user: userEvent.setup() };
}

afterEach(() => vi.unstubAllGlobals());

it("reúne compras conectadas sem responsável e atualiza a contagem depois de salvar", async () => {
  let owner: BankPurchaseOwner = "unknown";
  const mockFetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === "PUT") {
      expect(url).toBe(`/api/banks/purchases/${key}/owner`);
      expect(options.headers).toMatchObject({
        "X-Controle-Account": account.user.id,
      });
      owner = JSON.parse(String(options.body)).owner;
      return Response.json({ owner });
    }
    expect(url).toBe("/api/banks");
    return Response.json(bankView(owner));
  });
  vi.stubGlobal("fetch", mockFetch);
  const { user, save } = renderBudget();
  const preview = screen.getByRole("region", { name: "Pendências" });
  expect(
    await within(preview).findByText("1 item para conferir"),
  ).toBeInTheDocument();
  await user.click(
    within(preview).getByRole("button", { name: "Identificar compras" }),
  );
  const bank = screen.getByRole("region", {
    name: "Compras dos bancos sem responsável",
  });
  expect(
    within(bank).getByText("Nubank", { exact: false }),
  ).toBeInTheDocument();
  await user.selectOptions(
    within(bank).getByRole("combobox", { name: "Responsável por Mercado" }),
    "mother",
  );
  expect(await screen.findByText("Tudo em dia por aqui.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Visão Geral" }));
  expect(screen.getByText("Nenhuma pendência agora")).toBeInTheDocument();
  expect(
    mockFetch.mock.calls.filter(([, options]) => options?.method === "GET"),
  ).toHaveLength(1);
  expect(save).not.toHaveBeenCalled();
});

it("sinaliza consulta bancária indisponível em Pendências", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({}, { status: 503 })),
  );
  const { user } = renderBudget();
  await user.click(screen.getByRole("button", { name: "Pendências" }));
  expect(
    await screen.findByText(
      "Não foi possível verificar as compras dos bancos.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText("Tudo em dia por aqui.")).not.toBeInTheDocument();
});

it("reaproveita uma consulta em andamento ao navegar para fora e voltar às telas bancárias", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetchBanks = vi.fn(async () => {
    await pending;
    return Response.json(bankView("unknown"));
  });
  vi.stubGlobal("fetch", fetchBanks);
  const { user } = renderBudget(true);
  try {
    await user.click(screen.getByRole("button", { name: "Planejar" }));
    await user.click(screen.getByRole("button", { name: "Pendências" }));
  } finally {
    release();
  }
  expect(
    await screen.findByRole("region", {
      name: "Compras dos bancos sem responsável",
    }),
  ).toBeInTheDocument();
  expect(fetchBanks).toHaveBeenCalledTimes(1);
});
