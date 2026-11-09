import type { Occurrence } from "./types";
import { parseMoney } from "./finance";
export type TransactionFilters = {
  query: string;
  quick: string;
  status: "all" | "pending" | "confirmed";
  owner: string;
  minimum: string;
  maximum: string;
  order: "date-asc" | "date-desc" | "amount-asc" | "amount-desc";
};
export const defaultTransactionFilters: TransactionFilters = {
  query: "",
  quick: "all",
  status: "all",
  owner: "all",
  minimum: "",
  maximum: "",
  order: "date-asc",
};
function bounds(filters: TransactionFilters) {
  return {
    min: filters.minimum.trim() ? parseMoney(filters.minimum) : undefined,
    max: filters.maximum.trim() ? parseMoney(filters.maximum) : undefined,
  };
}
export function filterError(filters: TransactionFilters): string {
  const { min, max } = bounds(filters);
  if (min === null || max === null)
    return "Informe um valor válido nos filtros de mínimo e máximo.";
  if (min !== undefined && max !== undefined && min > max)
    return "O valor mínimo não pode ser maior que o máximo.";
  return "";
}
export function selectTransactions(
  rows: Occurrence[],
  filters: TransactionFilters,
  invoicePaid: boolean,
): Occurrence[] {
  if (filterError(filters)) return [];
  const { min, max } = bounds(filters);
  const query = filters.query.trim().toLocaleLowerCase("pt-BR");
  return rows
    .filter((row) => {
      const confirmed = row.method === "card" ? invoicePaid : !!row.settledOn;
      const quick = filters.quick;
      return (
        (!query ||
          `${row.description} ${row.category}`
            .toLocaleLowerCase("pt-BR")
            .includes(query)) &&
        (quick === "all" ||
          quick === row.kind ||
          quick === row.owner ||
          (quick === "pending" && !confirmed)) &&
        (filters.status === "all" ||
          (filters.status === "confirmed" ? confirmed : !confirmed)) &&
        (filters.owner === "all" || row.owner === filters.owner) &&
        (min === undefined || row.amount >= min!) &&
        (max === undefined || row.amount <= max!)
      );
    })
    .sort((a, b) => {
      const tie = a.date.localeCompare(b.date) || a.key.localeCompare(b.key);
      if (filters.order === "amount-desc") return b.amount - a.amount || tie;
      if (filters.order === "amount-asc") return a.amount - b.amount || tie;
      if (filters.order === "date-desc")
        return b.date.localeCompare(a.date) || a.key.localeCompare(b.key);
      return tie;
    });
}
