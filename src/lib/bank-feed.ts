import type { Owner } from "./types";

export type Institution = "nubank" | "bb" | "mercado-pago";
export type BankPurchaseOwner = Owner | "other";

export const bankNames: Record<Institution, string> = {
  nubank: "Nubank",
  bb: "Banco do Brasil",
  "mercado-pago": "Cartão Mercado Pago",
};

export type BankAccount = {
  kind: "checking" | "savings" | "credit";
  balance: number | null;
  transactions: {
    date: string;
    description: string;
    amount: number;
    direction: "CREDIT" | "DEBIT";
    status: "PENDING" | "POSTED" | null;
    purchaseKey?: string;
    billKey?: string;
    owner?: BankPurchaseOwner;
  }[];
  bills: { due: string; amount: number; billKey?: string }[];
  limited: boolean;
  cashFlow?: {
    from: string;
    days: Record<string, { inflows: number; outflows: number }>;
  };
};

export type BankResult = {
  institution: Institution;
  status:
    | "ready"
    | "partial"
    | "empty"
    | "pending"
    | "reconnect"
    | "unavailable";
  providerUpdatedAt: string | null;
  accounts: BankAccount[];
};

export type BankOverview =
  | { enabled: false }
  | {
      enabled: true;
      status: "loading" | "ready";
      checkedAt: string | null;
      banks: BankResult[];
    };
