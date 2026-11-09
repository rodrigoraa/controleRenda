import type { State } from "./types";
import { parseBackup } from "./validation";
import {
  BudgetConflictError,
  type BudgetPersistence,
  type LoadedBudget,
} from "./persistence";
export type AuthUser = { id: string; email: string; name: string };
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function apiRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  accountId?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(accountId ? { "X-Controle-Account": accountId } : {}),
      },
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body),
          }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError(
      0,
      "Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.",
    );
  }
  const data =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 409)
      throw new BudgetConflictError(
        data?.message ?? "Dados alterados em outro aparelho.",
      );
    if (response.status === 401 && !["/auth/login", "/auth/me"].includes(path))
      window.dispatchEvent(new Event("controle-renda:session-expired"));
    throw new ApiError(
      response.status,
      data?.message ??
        "Não foi possível concluir a solicitação. Tente novamente.",
    );
  }
  return data as T;
}
function decodeBudget(value: { state: State; revision: number }): LoadedBudget {
  if (!value || !Number.isInteger(value.revision) || value.revision < 0)
    throw new Error("O servidor retornou dados inválidos.");
  return {
    state: parseBackup(JSON.stringify(value.state)),
    snapshot: String(value.revision),
    error: null,
  };
}
export async function fetchBudget(accountId: string): Promise<LoadedBudget> {
  return decodeBudget(await apiRequest("/budget", "GET", undefined, accountId));
}
export function serverPersistence(
  initial: LoadedBudget,
  accountId: string,
): BudgetPersistence {
  return {
    initial,
    load: () => fetchBudget(accountId),
    save: async (state, expected) =>
      decodeBudget(
        await apiRequest(
          "/budget",
          "PUT",
          { state, revision: Number(expected) },
          accountId,
        ),
      ),
  };
}
