import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Application from "../src/Application";
import { AccountPanel } from "../src/components/AccountPanel";
import { fetchBudget, serverPersistence } from "../src/lib/api";
import { createEmptyState } from "../src/lib/validation";

const user = { id: "account-A", email: "a@example.test", name: "Conta A" };
const initial = { state: createEmptyState("2026-11"), revision: 0 };
afterEach(() => vi.restoreAllMocks());
it("mantém cada leitura e gravação ligada à conta que abriu o orçamento", async () => {
  const expectedAccounts: (string | null)[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    expectedAccounts.push(new Headers(init?.headers).get("x-controle-account"));
    return new Response(JSON.stringify(initial));
  });
  const loaded = await fetchBudget(user.id);
  const persistence = serverPersistence(loaded, user.id);
  await persistence.load();
  await persistence.save(loaded.state, loaded.snapshot);
  expect(expectedAccounts).toEqual(["account-A", "account-A", "account-A"]);
});
it("não abre dados de outra conta quando o cookie muda entre a sessão e o orçamento", async () => {
  let budgetAccount: string | null = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input).endsWith("/auth/me"))
      return new Response(JSON.stringify({ user }));
    budgetAccount = new Headers(init?.headers).get("x-controle-account");
    return new Response(
      JSON.stringify({ message: "Sua conta mudou em outra aba." }),
      { status: 401 },
    );
  });
  render(<Application />);
  expect(
    await screen.findByRole("button", { name: "Entrar" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Novo lançamento" }),
  ).not.toBeInTheDocument();
  expect(budgetAccount).toBe("account-A");
});
it("volta ao login se a conta mudar enquanto o login carrega o orçamento", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input).endsWith("/auth/login"))
      return new Response(JSON.stringify({ user }));
    return new Response(
      JSON.stringify({ message: "Sua conta mudou em outra aba." }),
      { status: 401 },
    );
  });
  render(<Application />);
  const person = userEvent.setup();
  await screen.findByRole("button", { name: "Entrar" });
  await person.type(screen.getByLabelText("E-mail"), user.email);
  await person.type(screen.getByLabelText("Senha"), "senha longa de teste");
  await person.click(screen.getByRole("button", { name: "Entrar" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled(),
  );
  expect(
    screen.queryByRole("button", { name: "Tentar novamente" }),
  ).not.toBeInTheDocument();
});
it("liga a troca de senha à conta exibida", async () => {
  let passwordAccount: string | null = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    passwordAccount = new Headers(init?.headers).get("x-controle-account");
    return new Response(JSON.stringify({ message: "Senha alterada." }));
  });
  render(<AccountPanel user={user} onLogout={async () => {}} />);
  const person = userEvent.setup();
  await person.click(screen.getByRole("button", { name: "Alterar senha" }));
  await person.type(
    screen.getByLabelText("Senha atual"),
    "senha atual bastante longa",
  );
  await person.type(
    screen.getByLabelText("Nova senha"),
    "nova senha bastante longa",
  );
  await person.type(
    screen.getByLabelText("Confirme a nova senha"),
    "nova senha bastante longa",
  );
  await person.click(
    screen.getByRole("button", { name: "Confirmar nova senha" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent("Senha alterada");
  expect(passwordAccount).toBe("account-A");
});
it("liga o logout à conta exibida", async () => {
  let logoutAccount: string | null = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input);
    if (path.endsWith("/auth/me"))
      return new Response(JSON.stringify({ user }));
    if (path.endsWith("/budget")) return new Response(JSON.stringify(initial));
    logoutAccount = new Headers(init?.headers).get("x-controle-account");
    return new Response(null, { status: 204 });
  });
  render(<Application />);
  const person = userEvent.setup();
  await person.click(
    await screen.findByRole("button", { name: "Configurações e dados" }),
  );
  await person.click(screen.getByRole("button", { name: "Sair da conta" }));
  expect(
    await screen.findByRole("button", { name: "Entrar" }),
  ).toBeInTheDocument();
  expect(logoutAccount).toBe("account-A");
});
