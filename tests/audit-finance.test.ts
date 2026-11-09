import { describe, expect, it } from "vitest";
import {
  invoice,
  occurrences,
  splitPurchase,
  summarize,
  withCurrentBalance,
} from "../src/lib/finance";
import { createEmptyState, parseBackup } from "../src/lib/validation";
import type { Entry } from "../src/lib/types";

const entry = (changes: Partial<Entry> = {}): Entry => ({
  id: "expense",
  description: "Conta",
  amount: 10000,
  date: "2026-11-20",
  kind: "expense",
  method: "account",
  owner: "me",
  category: "Outros",
  repeat: "none",
  ...changes,
});

function state() {
  const result = createEmptyState("2026-11");
  result.settings.openingBalance = 100000;
  return result;
}

describe("cenários financeiros conferidos na auditoria", () => {
  it("inclui uma conta de fevereiro paga em novembro além do horizonte do próximo mês", () => {
    const s = state();
    s.entries = [
      entry({
        date: "2027-02-20",
        repeat: "monthly",
        endMonth: "2027-02",
      }),
    ];
    s.settled["expense:2027-02"] = { date: "2026-11-08" };

    const valid = parseBackup(JSON.stringify(s));
    expect(summarize(valid, "2026-11", "2026-11-09")).toMatchObject({
      available: 90000,
      starting: 100000,
      inflows: 0,
      outflows: 10000,
      closing: 90000,
      nextClosing: 90000,
    });
    expect(summarize(valid, "2027-02", "2026-11-09")).toMatchObject({
      available: 90000,
      starting: 90000,
      inflows: 0,
      outflows: 0,
      closing: 90000,
      nextClosing: 90000,
      pendingExpenses: 0,
    });
  });

  it("conta uma única vez o pagamento parcial e o repasse antecipados de uma fatura futura", () => {
    const s = state();
    s.entries = [
      entry({
        id: "mother",
        method: "card",
        owner: "mother",
        date: "2027-02-20",
        amount: 80000,
      }),
      entry({
        id: "mine",
        method: "card",
        date: "2027-02-20",
        amount: 20000,
      }),
    ];
    s.payments = [
      { id: "payment", month: "2027-02", amount: 50000, date: "2026-11-08" },
    ];
    s.reimbursements = [
      { id: "transfer", month: "2027-02", amount: 30000, date: "2026-11-07" },
    ];

    const valid = parseBackup(JSON.stringify(s));
    expect(summarize(valid, "2026-11", "2026-11-09")).toMatchObject({
      available: 80000,
      starting: 100000,
      inflows: 30000,
      outflows: 50000,
      closing: 80000,
      nextClosing: 80000,
    });
    expect(summarize(valid, "2027-02", "2026-11-09")).toMatchObject({
      available: 80000,
      starting: 80000,
      inflows: 50000,
      outflows: 50000,
      closing: 80000,
      nextClosing: 80000,
      personalExpenses: 20000,
      pendingIncome: 50000,
      pendingExpenses: 50000,
    });
    expect(invoice(valid, "2027-02")).toMatchObject({
      total: 100000,
      paid: 50000,
      outstanding: 50000,
      received: 30000,
      toReceive: 50000,
    });
  });

  it("leva somente as parcelas efetivamente transferidas para dezembro e mantém o restante em novembro", () => {
    const s = state();
    s.entries = [
      entry({ id: "mother", method: "card", owner: "mother", amount: 80000 }),
      entry({ id: "mine", method: "card", amount: 10000 }),
      entry({ id: "unknown", method: "card", owner: "unknown", amount: 10000 }),
    ];
    s.payments = [
      { id: "payment", month: "2026-11", amount: 50000, date: "2026-12-02" },
    ];
    s.reimbursements = [
      { id: "transfer", month: "2026-11", amount: 30000, date: "2026-12-01" },
    ];

    expect(summarize(s, "2026-11", "2026-12-09")).toMatchObject({
      available: 80000,
      starting: 100000,
      inflows: 50000,
      outflows: 50000,
      closing: 100000,
      nextClosing: 80000,
      personalExpenses: 20000,
      pendingIncome: 50000,
      pendingExpenses: 50000,
    });
    expect(summarize(s, "2026-12", "2026-12-09")).toMatchObject({
      available: 80000,
      starting: 100000,
      inflows: 30000,
      outflows: 50000,
      monthlyChange: -20000,
      closing: 80000,
      nextClosing: 80000,
      income: 0,
      personalExpenses: 0,
    });
  });

  it("prevê somente o repasse da mãe e recebe de outra pessoa apenas pela receita cadastrada", () => {
    const s = state();
    s.people = [{ id: "person_friend", name: "Amigo" }];
    s.entries = [
      entry({
        id: "friend",
        method: "card",
        owner: "person_friend",
        amount: 30000,
      }),
      entry({ id: "mother", method: "card", owner: "mother", amount: 40000 }),
      entry({ id: "unknown", method: "card", owner: "unknown", amount: 20000 }),
      entry({ id: "mine", method: "card", amount: 10000 }),
    ];

    expect(summarize(s, "2026-11", "2026-11-09")).toMatchObject({
      available: 100000,
      inflows: 40000,
      outflows: 100000,
      closing: 40000,
      income: 0,
      pendingIncome: 40000,
      personalExpenses: 30000,
      invoice: {
        otherParts: [{ owner: "person_friend", name: "Amigo", amount: 30000 }],
      },
    });

    s.entries.push(
      entry({
        id: "repayment",
        description: "Recebimento do amigo",
        kind: "income",
        amount: 30000,
        date: "2026-11-09",
      }),
    );
    s.settled["repayment:2026-11"] = { date: "2026-11-09" };
    expect(summarize(s, "2026-11", "2026-11-09")).toMatchObject({
      available: 130000,
      inflows: 70000,
      outflows: 100000,
      closing: 70000,
      nextClosing: 70000,
      income: 30000,
      pendingIncome: 40000,
      personalExpenses: 30000,
    });
  });

  it("concilia o banco com despesa antecipada, receita atrasada e conta pendente sem duplicar valores", () => {
    const s = state();
    s.entries = [
      entry({
        id: "income",
        kind: "income",
        amount: 40000,
        date: "2026-11-05",
      }),
      entry({ id: "pending", amount: 30000 }),
      entry({ id: "later", date: "2027-03-01", amount: 20000 }),
    ];
    s.settled = {
      "income:2026-11": { date: "2026-12-01" },
      "later:2027-03": { date: "2026-11-08" },
    };

    const adjusted = withCurrentBalance(s, 38003, "2026-11-09");
    expect(adjusted.settings.openingBalance).toBe(58003);
    expect(summarize(adjusted, "2026-11", "2026-11-09")).toMatchObject({
      available: 38003,
      starting: 58003,
      inflows: 0,
      outflows: 50000,
      closing: 8003,
      nextClosing: 48003,
      income: 40000,
      pendingIncome: 0,
      pendingExpenses: 30000,
    });
    expect(summarize(adjusted, "2026-12", "2026-12-02")).toMatchObject({
      available: 78003,
      starting: 8003,
      inflows: 40000,
      outflows: 0,
      closing: 48003,
      nextClosing: 48003,
    });
    expect(withCurrentBalance(adjusted, 38003, "2026-11-09")).toEqual(adjusted);
    expect(s.settings.openingBalance).toBe(100000);
  });

  it("acumula recorrências e parcelas até março sem perder centavos no fevereiro curto", () => {
    const s = state();
    s.entries = [
      entry({ date: "2026-11-30", repeat: "monthly", endMonth: "2027-03" }),
      entry({
        id: "last",
        date: "2026-12-31",
        repeat: "monthly",
        endMonth: "2027-03",
      }),
      ...splitPurchase(
        entry({
          id: "purchase",
          method: "card",
          amount: 10001,
          date: "2026-12-31",
        }),
        3,
      ),
    ];

    for (const [month, starting, outflows, closing] of [
      ["2026-11", 100000, 10000, 90000],
      ["2026-12", 90000, 23334, 66666],
      ["2027-01", 66666, 23334, 43332],
      ["2027-02", 43332, 23333, 19999],
      ["2027-03", 19999, 20000, -1],
      ["2027-04", -1, 0, -1],
    ] as const) {
      expect(summarize(s, month, "2026-11-09"), month).toMatchObject({
        available: 100000,
        starting,
        inflows: 0,
        outflows,
        closing,
      });
    }
    expect(occurrences(s, "2027-02").find((e) => e.id === "last")?.date).toBe(
      "2027-02-28",
    );
    expect(occurrences(s, "2027-03").find((e) => e.id === "last")?.date).toBe(
      "2027-03-31",
    );
    expect(occurrences(s, "2027-04")).toEqual([]);
    expect(
      s.entries.filter((e) => e.installment).map((e) => [e.date, e.amount]),
    ).toEqual([
      ["2026-12-31", 3334],
      ["2027-01-31", 3334],
      ["2027-02-28", 3333],
    ]);
  });
});
