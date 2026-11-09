import { it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";
import type { BudgetPersistence } from "../src/lib/persistence";
function setup() {
  let saved = createEmptyState("2026-11");
  let revision = 0;
  const persistence: BudgetPersistence = {
    initial: { state: saved, snapshot: "0", error: null },
    load: async () => ({
      state: saved,
      snapshot: String(revision),
      error: null,
    }),
    save: async (state) => {
      saved = state;
      return { state, snapshot: String(++revision), error: null };
    },
  };
  render(<App today="2026-11-09" persistence={persistence} />);
  return { user: userEvent.setup(), saved: () => saved };
}
it("abre o cartão pela navegação inferior e mantém a indicação da página atual", async () => {
  const { user } = setup();
  const nav = screen.getByRole("navigation", { name: "Navegação do celular" });
  await user.click(
    within(nav).getByRole("button", { name: "Ver cartão compartilhado" }),
  );
  expect(
    screen.getByRole("heading", { name: "Um cartão. Tudo separado." }),
  ).toBeInTheDocument();
  expect(
    within(nav).getByRole("button", { name: "Ver cartão compartilhado" }),
  ).toHaveAttribute("aria-current", "page");
  await user.click(
    within(nav).getByRole("button", { name: "Adicionar lançamento" }),
  );
  expect(screen.getByLabelText("Forma de pagamento")).toHaveValue("card");
});
it("inclui uma compra da mãe pelo botão central de inclusão rápida", async () => {
  const { user, saved } = setup();
  const nav = screen.getByRole("navigation", { name: "Navegação do celular" });
  await user.click(
    within(nav).getByRole("button", { name: "Adicionar lançamento" }),
  );
  await user.type(screen.getByLabelText("Descrição"), "Mercado de hoje");
  await user.type(screen.getByLabelText("Valor (R$)"), "38,90");
  await user.selectOptions(screen.getByLabelText("Forma de pagamento"), "card");
  await user.selectOptions(screen.getByLabelText("Responsável"), "mother");
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(saved().entries[0]).toMatchObject({
    description: "Mercado de hoje",
    amount: 3890,
    method: "card",
    owner: "mother",
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText("Lançamento salvo.")).toBeInTheDocument();
  await user.click(
    within(nav).getByRole("button", { name: "Adicionar lançamento" }),
  );
  expect(screen.queryByText("Lançamento salvo.")).not.toBeInTheDocument();
});
it("alcança as recorrências pelo menu Mais do celular", async () => {
  const { user } = setup();
  await user.click(
    within(
      screen.getByRole("navigation", { name: "Navegação do celular" }),
    ).getByRole("button", { name: "Abrir mais opções" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Gerenciar recorrências" }),
  );
  expect(
    screen.getByRole("heading", {
      name: "Cadastre uma vez. Acompanhe sempre.",
    }),
  ).toBeInTheDocument();
});
