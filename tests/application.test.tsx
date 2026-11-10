import { afterEach, it, expect, vi } from "vitest";
import { render, screen } from "./render";
import userEvent from "@testing-library/user-event";
import Application from "../src/Application";
import { createEmptyState } from "../src/lib/validation";
afterEach(() => vi.restoreAllMocks());
const user = { id: "u1", email: "rodrigo@example.test", name: "Rodrigo" };
it("mostra login antes de carregar dados financeiros e abre o orçamento após autenticar", async () => {
  const requests: string[] = [];
  let loggedIn = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input);
    requests.push(path);
    if (path.endsWith("/auth/me"))
      return new Response(
        JSON.stringify(loggedIn ? { user } : { message: "Entre novamente." }),
        { status: loggedIn ? 200 : 401 },
      );
    if (path.endsWith("/auth/login")) {
      loggedIn = true;
      return new Response(JSON.stringify({ user }));
    }
    if (path.endsWith("/budget"))
      return new Response(
        JSON.stringify({ state: createEmptyState("2026-11"), revision: 0 }),
      );
    throw new Error("Unexpected request");
  });
  render(<Application />);
  expect(
    await screen.findByRole("button", { name: "Entrar" }),
  ).toBeInTheDocument();
  expect(requests).not.toContain("/api/budget");
  const person = userEvent.setup();
  await person.type(screen.getByLabelText("E-mail"), "rodrigo@example.test");
  await person.type(screen.getByLabelText("Senha"), "senha longa de teste");
  await person.click(screen.getByRole("button", { name: "Entrar" }));
  expect(
    await screen.findByRole("button", { name: "Novo lançamento" }),
  ).toBeInTheDocument();
  expect(requests).toContain("/api/budget");
});
it("mostra falha de conexão sem fingir que o orçamento está vazio", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
  render(<Application />);
  expect(
    await screen.findByRole("button", { name: "Tentar novamente" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Novo lançamento" }),
  ).not.toBeInTheDocument();
});
