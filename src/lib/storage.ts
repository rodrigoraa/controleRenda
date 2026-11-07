import type { State } from "./types";
import { createEmptyState, parseBackup, serializeBackup } from "./validation";
export { createEmptyState, parseBackup, serializeBackup } from "./validation";
// Legacy browser data: kept only for explicit migration and compatibility.
export const STORAGE_KEY = "controle-renda:v1";
export function saveState(state: State): void {
  const serialized = serializeBackup(state);
  localStorage.setItem(STORAGE_KEY, serialized);
}
export function loadState(month: string): {
  state: State;
  error: string | null;
  snapshot: string | null;
} {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    return {
      state: raw ? parseBackup(raw) : createEmptyState(month),
      error: null,
      snapshot: raw,
    };
  } catch {
    return {
      state: createEmptyState(month),
      error:
        "Não foi possível abrir seus dados salvos. Eles foram preservados. Exporte uma cópia de recuperação antes de importar um backup.",
      snapshot: raw,
    };
  }
}

export class StaleStateError extends Error {}
export async function saveStateIfUnchanged(
  state: State,
  expected: string | null,
): Promise<string> {
  const serialized = serializeBackup(state);
  const write = () => {
    if (localStorage.getItem(STORAGE_KEY) !== expected)
      throw new StaleStateError("Outra aba alterou os dados.");
    localStorage.setItem(STORAGE_KEY, serialized);
    return serialized;
  };
  // Web Locks serializes compare-and-write operations across tabs on HTTPS/localhost.
  return typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request("controle-renda:save", write)
    : write();
}
