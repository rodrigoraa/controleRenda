import { afterEach, expect, it, vi } from "vitest";
import { createBankFeed, readBankConfig } from "../../server/bank-feed";

const itemId = "0945e07c-24f6-403f-8275-83d6b8782e41";
const accountId = "0945e07c-24f6-403f-8275-83d6b8782e42";
const config = {
  ownerEmail: "dono@example.test",
  clientId: "demo-id",
  clientSecret: "demo-secret",
  items: [{ id: itemId, institution: "mercado-pago", kind: "CREDIT" }],
} as const;
afterEach(() => vi.restoreAllMocks());

it("exige ativação explícita, um titular e IDs válidos sem revelar a configuração", () => {
  expect(readBankConfig({ PLUGGY_CLIENT_ID: "incompleto" })).toBeNull();
  expect(() =>
    readBankConfig({
      BANK_SYNC_ENABLED: "true",
      PLUGGY_CLIENT_SECRET: "valor-sensivel",
    }),
  ).toThrow("Configuração bancária incompleta");
  expect(
    readBankConfig({
      BANK_SYNC_ENABLED: "true",
      PLUGGY_CLIENT_ID: "demo-id",
      PLUGGY_CLIENT_SECRET: "demo-secret",
      PLUGGY_OWNER_EMAIL: "Dono@EXAMPLE.TEST",
      PLUGGY_MERCADO_PAGO_ITEM_ID: itemId,
    }),
  ).toEqual(config);
});

it("lê as faturas e movimentações do cartão, sem expor IDs ou dados extras do provedor", async () => {
  const mocked = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, options) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://api.pluggy.ai");
      expect(options?.redirect).toBe("error");
      switch (url.pathname) {
        case "/auth":
          expect(options?.method).toBe("POST");
          return Response.json({ apiKey: "chave-transitoria" });
        case `/items/${itemId}`:
          return Response.json({
            id: itemId,
            status: "UPDATED",
            connector: { name: "MeuPluggy" },
            lastUpdatedAt: "2026-11-23T12:00:00Z",
          });
        case "/accounts":
          expect(url.searchParams.get("type")).toBe("CREDIT");
          return Response.json({
            results: [
              {
                id: accountId,
                itemId,
                type: "CREDIT",
                subtype: "CREDIT_CARD",
                currencyCode: "BRL",
                number: "dado-privado",
              },
              {
                id: "0945e07c-24f6-403f-8275-83d6b8782e43",
                itemId,
                type: "BANK",
                currencyCode: "BRL",
                balance: 1000,
              },
            ],
          });
        case "/v2/transactions":
          expect(url.searchParams.get("accountId")).toBe(accountId);
          return Response.json({
            results: [
              {
                id: "mov-1",
                description: "Compra",
                date: new Date().toISOString(),
                amount: -35.5,
                type: "DEBIT",
                status: "POSTED",
                currencyCode: "BRL",
                paymentData: { private: true },
              },
              {
                id: "fee-1",
                description: "Anuidade",
                date: new Date().toISOString(),
                amount: 10,
                type: "DEBIT",
                currencyCode: "BRL",
                creditCardMetadata: { feeType: "ANNUAL_FEE" },
              },
              {
                id: "credit-1",
                description: "Crédito rotativo",
                date: new Date().toISOString(),
                amount: 16,
                type: "DEBIT",
                currencyCode: "BRL",
                creditCardMetadata: { otherCreditsType: "REVOLVING_CREDIT" },
              },
            ],
            next: null,
          });
        case "/bills":
          return Response.json({
            results: [
              {
                dueDate: "2026-12-10",
                totalAmount: 100.25,
                totalAmountCurrencyCode: "BRL",
              },
            ],
          });
        default:
          throw new Error("Rota inesperada");
      }
    });
  const feed = createBankFeed(config);
  await Promise.all([feed.refresh(), feed.refresh()]);
  expect(mocked).toHaveBeenCalledTimes(5);
  expect(feed.forUser("outra@example.test")).toEqual({ enabled: false });
  const own = feed.forUser("dono@example.test");
  expect(own).toMatchObject({
    enabled: true,
    status: "ready",
    banks: [
      {
        institution: "mercado-pago",
        status: "ready",
        accounts: [
          {
            kind: "credit",
            balance: null,
            transactions: [
              {
                amount: 3550,
                direction: "DEBIT",
                description: "Compra",
                purchaseKey: expect.stringMatching(/^[a-f0-9]{64}$/),
              },
              { description: "Anuidade" },
              { description: "Crédito rotativo" },
            ],
            bills: [{ amount: 10025, due: "2026-12-10" }],
          },
        ],
      },
    ],
  });
  if (!own.enabled) throw new Error("Consulta do titular esperada");
  expect(
    own.banks[0].accounts[0].transactions
      .slice(1)
      .map(({ purchaseKey }) => purchaseKey),
  ).toEqual([undefined, undefined]);
  expect(JSON.stringify(own)).not.toMatch(
    /dado-privado|paymentData|chave-transitoria|0945e07c/,
  );
});

it("não lê contas de um conector diferente de MeuPluggy e descarta a cópia após perder o acesso", async () => {
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ apiKey: "mock" }))
    .mockResolvedValueOnce(
      Response.json({
        id: itemId,
        status: "UPDATED",
        connector: { name: "MeuPluggy" },
      }),
    )
    .mockResolvedValueOnce(Response.json({ results: [] }))
    .mockResolvedValueOnce(Response.json({ apiKey: "mock" }))
    .mockResolvedValueOnce(
      Response.json({
        id: itemId,
        status: "UPDATED",
        connector: { name: "Conector direto" },
      }),
    );
  const feed = createBankFeed(config);
  await feed.refresh();
  expect(feed.forUser(config.ownerEmail)).toMatchObject({
    banks: [{ status: "empty" }],
  });
  await feed.refresh();
  expect(feed.forUser(config.ownerEmail)).toMatchObject({
    banks: [{ status: "unavailable", accounts: [] }],
  });
  expect(request).toHaveBeenCalledTimes(5);
});
