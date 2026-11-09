export type Owner = "me" | "mother" | "unknown";
export type Entry = {
  id: string;
  description: string;
  amount: number;
  date: string;
  kind: "income" | "expense";
  method: "account" | "card";
  owner: Owner;
  category: string;
  repeat: "none" | "monthly";
  endMonth?: string;
  installment?: { index: number; total: number; group: string };
};
export type Override = Pick<
  Entry,
  "description" | "amount" | "owner" | "category"
>;
export type Transfer = {
  id: string;
  month: string;
  amount: number;
  date: string;
};
export type State = {
  version: 1;
  settings: {
    initialMonth: string;
    openingBalance: number;
    invoiceDay: number;
    cardName: string;
  };
  entries: Entry[];
  overrides: Record<string, Override>;
  skipped: string[];
  settled: Record<string, { date: string }>;
  payments: Transfer[];
  reimbursements: Transfer[];
};
export type Occurrence = Entry & {
  key: string;
  month: string;
  settledOn?: string;
};
export type Invoice = {
  total: number;
  me: number;
  mother: number;
  unknown: number;
  paid: number;
  outstanding: number;
  received: number;
  toReceive: number;
  credit: number;
};
export type Summary = {
  available: number;
  starting: number;
  inflows: number;
  outflows: number;
  monthlyChange: number;
  nextMonthlyChange: number;
  closing: number;
  nextClosing: number;
  income: number;
  expenses: number;
  personalExpenses: number;
  pendingIncome: number;
  pendingExpenses: number;
  invoice: Invoice;
};
