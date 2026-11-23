import { expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "./render";
import App from "../src/App";
import type { State } from "../src/lib/types";
import { createEmptyState } from "../src/lib/validation";

it("registra na conta o repasse recebido de uma pessoa pela fatura", async () => {
  const state = createEmptyState("2026-11");
  state.people = [{ id: "person_ana", name: "Ana" }];
  state.entries.push({
    id: "mercado",
    kind: "expense",
    method: "card",
    owner: "person_ana",
    description: "Mercado",
    date: "2026-11-05",
    amount: 12000,
    repeat: "none",
    category: "Outros",
  });
  const initial = { state, snapshot: "0", error: null };
  const save = vi.fn(async (next: State) => ({
    ...initial,
    state: next,
    snapshot: "1",
  }));
  render(
    <App
      today="2026-11-10"
      persistence={{ initial, load: async () => initial, save }}
    />,
  );
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Cartão compartilhado" }),
  );
  await user.click(
    screen.getByText("Registrar repasse de outra pessoa", { exact: true }),
  );
  await user.click(screen.getByRole("button", { name: "Ana" }));
  const dialog = screen.getByRole("dialog", {
    name: "Registrar repasse de Ana",
  });
  await user.type(within(dialog).getByLabelText(/valor recebido/i), "40,00");
  await user.click(
    within(dialog).getByRole("button", { name: "Confirmar recebimento" }),
  );
  const saved = save.mock.calls[0][0];
  const income = saved.entries.find(({ kind }) => kind === "income");
  expect(income).toMatchObject({
    description: "Repasse de Ana",
    amount: 4000,
    method: "account",
    date: "2026-11-10",
  });
  expect(saved.settled[`${income!.id}:2026-11`]).toEqual({
    date: "2026-11-10",
  });
  expect(saved.reimbursements).toEqual([]);
  expect(saved.payments).toEqual([]);
});
