import type { State } from "./types";
export type LoadedBudget = {
  state: State;
  snapshot: string | null;
  error: string | null;
};
export interface BudgetPersistence {
  initial: LoadedBudget;
  load(): Promise<LoadedBudget>;
  save(state: State, expected: string | null): Promise<LoadedBudget>;
}
export class BudgetConflictError extends Error {}
