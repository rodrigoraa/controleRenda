import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "./render";
import userEvent from "@testing-library/user-event";
import Application from "../src/Application";
import { createEmptyState } from "../src/lib/validation";

const accountA = { id: "account-A", email: "a@example.test", name: "Conta A" };
const accountB = { id: "account-B", email: "b@example.test", name: "Conta B" };
const ok = (data: unknown) => new Response(JSON.stringify(data));
const budget = () => ok({ state: createEmptyState("2026-11"), revision: 0 });
const unauthorized = () =>
  new Response(JSON.stringify({ message: "Sua sessão expirou." }), {
    status: 401,
  });
const deferredResponse = () => {
  let resolve!: (response: Response) => void;
  return {
    promise: new Promise<Response>((done) => {
      resolve = done;
    }),
    resolve: (response: Response) => resolve(response),
  };
};
async function login(email = accountA.email) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), "long test password");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  await screen.findByRole("button", { name: "Novo lançamento" });
}
async function logout() {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Configurações e dados" }),
  );
  await user.click(screen.getByRole("button", { name: "Sair da conta" }));
  await screen.findByRole("button", { name: "Entrar" });
}
async function focusRefresh(requests: () => number) {
  await waitFor(() => {
    fireEvent(window, new Event("focus"));
    expect(requests()).toBe(2);
  });
}
afterEach(() => vi.restoreAllMocks());

it("an obsolete StrictMode bootstrap budget 401 must not close a newer successful login", async () => {
  const oldBudget = deferredResponse();
  let meRequests = 0;
  let loggedIn = false;
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input);
    calls.push(path);
    if (path.endsWith("/auth/me"))
      return ++meRequests === 1 ? ok({ user: accountA }) : unauthorized();
    if (path.endsWith("/auth/login")) {
      loggedIn = true;
      return ok({ user: accountA });
    }
    if (path.endsWith("/budget"))
      return loggedIn ? budget() : oldBudget.promise;
    throw new Error(`Unexpected request ${path}`);
  });
  render(
    <StrictMode>
      <Application />
    </StrictMode>,
  );
  await screen.findByRole("button", { name: "Entrar" });
  await login();
  expect(calls.filter((path) => path.endsWith("/auth/me"))).toHaveLength(2);
  await act(async () => {
    oldBudget.resolve(unauthorized());
  });
  expect(
    screen.queryByRole("button", { name: "Entrar" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Novo lançamento" }),
  ).toBeInTheDocument();
  expect(calls.filter((path) => path.endsWith("/budget"))).toHaveLength(1);
});

it.each([accountA, accountB])(
  "an old refresh 401 must not close newer login as $id",
  async (nextAccount) => {
    const oldRefresh = deferredResponse();
    let currentUser = accountA;
    let budgetRequests = 0;
    const bindings: (string | null)[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = String(input);
      if (path.endsWith("/auth/me")) return ok({ user: currentUser });
      if (path.endsWith("/auth/logout"))
        return new Response(null, { status: 204 });
      if (path.endsWith("/auth/login")) {
        currentUser = nextAccount;
        return ok({ user: nextAccount });
      }
      if (path.endsWith("/budget")) {
        bindings.push(new Headers(init?.headers).get("x-controle-account"));
        return ++budgetRequests === 2 ? oldRefresh.promise : budget();
      }
      throw new Error(`Unexpected request ${path}`);
    });
    render(<Application />);
    await screen.findByRole("button", { name: "Novo lançamento" });
    await focusRefresh(() => budgetRequests);
    await logout();
    await login(nextAccount.email);
    expect(bindings).toEqual([accountA.id, accountA.id, nextAccount.id]);
    await act(async () => {
      oldRefresh.resolve(unauthorized());
    });
    expect(
      screen.queryByRole("button", { name: "Entrar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Novo lançamento" }),
    ).toBeInTheDocument();
  },
);

it("an active account A refresh rejects a cookie changed to account B and keeps B budget hidden", async () => {
  let meRequests = 0;
  let budgetRequests = 0;
  const bindings: (string | null)[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input);
    if (path.endsWith("/auth/me"))
      return ok({ user: ++meRequests === 1 ? accountA : accountB });
    if (path.endsWith("/budget")) {
      bindings.push(new Headers(init?.headers).get("x-controle-account"));
      return ++budgetRequests === 1 ? budget() : unauthorized();
    }
    throw new Error(`Unexpected request ${path}`);
  });
  render(<Application />);
  await screen.findByRole("button", { name: "Novo lançamento" });
  await focusRefresh(() => budgetRequests);
  await screen.findByRole("button", { name: "Entrar" });
  expect(bindings).toEqual([accountA.id, accountA.id]);
  expect(
    screen.queryByRole("button", { name: "Novo lançamento" }),
  ).not.toBeInTheDocument();
});

it("renewing the cookie for the same account allows its account-bound refresh", async () => {
  let budgetRequests = 0;
  const bindings: (string | null)[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input);
    if (path.endsWith("/auth/me")) return ok({ user: accountA });
    if (path.endsWith("/budget")) {
      budgetRequests++;
      bindings.push(new Headers(init?.headers).get("x-controle-account"));
      return budget();
    }
    throw new Error(`Unexpected request ${path}`);
  });
  render(<Application />);
  await screen.findByRole("button", { name: "Novo lançamento" });
  // Another tab has logged into A again. Backend still resolves the cookie to A.
  await focusRefresh(() => budgetRequests);
  expect(bindings).toEqual([accountA.id, accountA.id]);
  expect(
    screen.getByRole("button", { name: "Novo lançamento" }),
  ).toBeInTheDocument();
});

it("keeps the displayed account when a delayed 401 is disproved by the current session", async () => {
  let meRequests = 0;
  let budgetRequests = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input);
    if (path.endsWith("/auth/me")) {
      meRequests++;
      return ok({ user: accountA });
    }
    if (path.endsWith("/budget"))
      return ++budgetRequests === 1 ? budget() : unauthorized();
    throw new Error(`Unexpected request ${path}`);
  });
  render(<Application />);
  await screen.findByRole("button", { name: "Novo lançamento" });
  await focusRefresh(() => budgetRequests);
  await waitFor(() => expect(meRequests).toBe(2));
  await act(async () => {});
  expect(
    screen.getByRole("button", { name: "Novo lançamento" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Entrar" }),
  ).not.toBeInTheDocument();
});

it.each(["offline", "server unavailable"])(
  "keeps the open budget if session verification is temporarily %s",
  async (failure) => {
    let meRequests = 0;
    let budgetRequests = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path.endsWith("/auth/me")) {
        if (++meRequests === 1) return ok({ user: accountA });
        if (failure === "offline") throw new TypeError("offline");
        return new Response(
          JSON.stringify({ message: "Temporarily unavailable" }),
          {
            status: 503,
          },
        );
      }
      if (path.endsWith("/budget"))
        return ++budgetRequests === 1 ? budget() : unauthorized();
      throw new Error(`Unexpected request ${path}`);
    });
    render(<Application />);
    await screen.findByRole("button", { name: "Novo lançamento" });
    await focusRefresh(() => budgetRequests);
    await waitFor(() => expect(meRequests).toBe(2));
    await act(async () => {});
    expect(
      screen.getByRole("button", { name: "Novo lançamento" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Entrar" }),
    ).not.toBeInTheDocument();
  },
);

it.each(["expired", "different account"])(
  "returns to login only when the current session is confirmed as %s",
  async (failure) => {
    let meRequests = 0;
    let budgetRequests = 0;
    const bindings: (string | null)[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = String(input);
      if (path.endsWith("/auth/me")) {
        if (++meRequests === 1) return ok({ user: accountA });
        return failure === "expired" ? unauthorized() : ok({ user: accountB });
      }
      if (path.endsWith("/budget")) {
        bindings.push(new Headers(init?.headers).get("x-controle-account"));
        return ++budgetRequests === 1 ? budget() : unauthorized();
      }
      throw new Error(`Unexpected request ${path}`);
    });
    render(<Application />);
    await screen.findByRole("button", { name: "Novo lançamento" });
    await focusRefresh(() => budgetRequests);
    await screen.findByRole("button", { name: "Entrar" });
    expect(
      screen.queryByRole("button", { name: "Novo lançamento" }),
    ).not.toBeInTheDocument();
    expect(bindings).toEqual([accountA.id, accountA.id]);
    expect(screen.getByRole("status")).toHaveTextContent(
      failure === "expired" ? "Sua sessão expirou" : "Sua conta mudou",
    );
  },
);

it("does not apply an old session verification after logout and a newer login", async () => {
  const oldVerification = deferredResponse();
  let meRequests = 0;
  let budgetRequests = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input);
    if (path.endsWith("/auth/me"))
      return ++meRequests === 1
        ? ok({ user: accountA })
        : oldVerification.promise;
    if (path.endsWith("/auth/logout"))
      return new Response(null, { status: 204 });
    if (path.endsWith("/auth/login")) return ok({ user: accountB });
    if (path.endsWith("/budget"))
      return ++budgetRequests === 2 ? unauthorized() : budget();
    throw new Error(`Unexpected request ${path}`);
  });
  render(<Application />);
  await screen.findByRole("button", { name: "Novo lançamento" });
  await focusRefresh(() => budgetRequests);
  await logout();
  await login(accountB.email);
  await act(async () => {
    oldVerification.resolve(unauthorized());
  });
  expect(
    screen.getByRole("button", { name: "Novo lançamento" }),
  ).toBeInTheDocument();
});

it.each(["bootstrap", "login"])(
  "offers a page refresh if account binding is missing during %s",
  async (entry) => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path.endsWith("/auth/me"))
        return entry === "bootstrap" ? ok({ user: accountA }) : unauthorized();
      if (path.endsWith("/auth/login")) return ok({ user: accountA });
      if (path.endsWith("/budget"))
        return new Response(
          JSON.stringify({
            message: "Atualize a página para continuar com segurança.",
          }),
          { status: 428 },
        );
      throw new Error(`Unexpected request ${path}`);
    });
    render(<Application />);
    if (entry === "login") {
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText("E-mail"), accountA.email);
      await user.type(screen.getByLabelText("Senha"), "long test password");
      await user.click(screen.getByRole("button", { name: "Entrar" }));
    }
    expect(
      await screen.findByRole("button", { name: "Atualizar página" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Novo lançamento" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Atualize a página");
  },
);
