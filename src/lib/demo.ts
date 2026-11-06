import { createEmptyState } from "./storage";
import { dateInMonth } from "./finance";
import type { Entry, State } from "./types";
export function createDemo(month: string): State {
  const s = createEmptyState(month);
  s.settings.openingBalance = 85000;
  s.settings.cardName = "Cartão da família";
  const item = (
    id: string,
    description: string,
    amount: number,
    day: number,
    category: string,
    extra: Partial<Entry> = {},
  ): Entry => ({
    id,
    description,
    amount,
    date: dateInMonth(month, day),
    category,
    kind: "expense",
    method: "account",
    owner: "me",
    repeat: "none",
    ...extra,
  });
  s.entries = [
    item("salario", "Salário", 480000, 5, "Salário", {
      kind: "income",
      repeat: "monthly",
    }),
    item("bolsa", "Bolsa da faculdade", 85000, 10, "Bolsa", {
      kind: "income",
      repeat: "monthly",
    }),
    item("sistema", "Pagamento do sistema", 120000, 15, "Sistema vendido", {
      kind: "income",
      repeat: "monthly",
    }),
    item("aluguel", "Aluguel", 145000, 8, "Moradia", { repeat: "monthly" }),
    item("internet", "Internet", 9990, 12, "Contas", { repeat: "monthly" }),
    item("mercado", "Supermercado", 28640, 4, "Alimentação", {
      method: "card",
    }),
    item("farmacia", "Farmácia", 12490, 3, "Saúde", {
      method: "card",
      owner: "mother",
    }),
    item("roupas", "Loja de roupas", 18990, 5, "Compras", {
      method: "card",
      owner: "mother",
    }),
    item("cafe", "Café com amigos", 4650, 2, "Lazer", { method: "card" }),
    item("identificar", "Compra no cartão", 7990, 5, "Outros", {
      method: "card",
      owner: "unknown",
    }),
    item("transporte", "Transporte", 18000, 20, "Transporte", {
      repeat: "monthly",
    }),
  ];
  return s;
}
