import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { occurrences, splitPurchase } from "../src/lib/finance";
import { createEmptyState } from "../src/lib/validation";
import {
  BudgetConflictError,
  type BudgetPersistence,
} from "../src/lib/persistence";
function setup() {
  let state = createEmptyState("2026-11");
  let revision = "0";
  state.entries = splitPurchase(
    {
      id: "purchase",
      description: "Compra errada",
      amount: 100000,
      date: "2026-12-10",
      kind: "expense",
      method: "card",
      owner: "mother",
      category: "Compras",
      repeat: "none",
    },
    10,
  );
  const persistence: BudgetPersistence = {
    initial: { state, snapshot: revision, error: null },
    load: async () => ({ state, snapshot: revision, error: null }),
    save: async (next, expected) => {
      expect(expected).toBe(revision);
      state = next;
      revision = String(Number(revision) + 1);
      return { state, snapshot: revision, error: null };
    },
  };
  return { persistence, read: () => state };
}
it("exclui as dez parcelas pela lixeira e continua excluído ao reabrir", async () => {
  const { persistence, read } = setup();
  const user = userEvent.setup();
  const { unmount } = render(
    <App today="2026-12-09" persistence={persistence} />,
  );
  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.click(
    screen.getByRole("button", { name: "Excluir Compra errada" }),
  );
  await user.click(
    screen.getByRole("radio", { name: "Todas as parcelas desta compra" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Excluir todas as parcelas" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(read().entries).toEqual([]);
  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  expect(screen.queryByText("Compra errada")).not.toBeInTheDocument();
  unmount();
  render(
    <App
      today="2027-09-09"
      persistence={{
        ...persistence,
        initial: { state: read(), snapshot: "1", error: null },
      }}
    />,
  );
  expect(screen.queryByText("Compra errada")).not.toBeInTheDocument();
});
it("excluir somente esta parcela preserva os outros meses", async () => {
  const { persistence, read } = setup();
  const user = userEvent.setup();
  render(<App today="2026-12-09" persistence={persistence} />);
  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.click(
    screen.getByRole("button", { name: "Excluir Compra errada" }),
  );
  expect(
    screen.getByRole("radio", { name: "Somente esta parcela" }),
  ).toBeChecked();
  await user.click(
    screen.getByRole("button", { name: "Excluir esta parcela" }),
  );
  expect(occurrences(read(), "2026-12")).toEqual([]);
  expect(occurrences(read(), "2027-01")).toHaveLength(1);
});
it("cancelar e falhar ao salvar não excluem a compra", async () => {
  const { persistence, read } = setup();
  persistence.save = async () => {
    throw new Error("Servidor indisponível.");
  };
  const user = userEvent.setup();
  render(<App today="2026-12-09" persistence={persistence} />);
  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.click(
    screen.getByRole("button", { name: "Excluir Compra errada" }),
  );
  await user.click(
    screen.getByRole("radio", { name: "Todas as parcelas desta compra" }),
  );
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(read().entries).toHaveLength(10);
  await user.click(
    screen.getByRole("button", { name: "Excluir Compra errada" }),
  );
  await user.click(
    screen.getByRole("radio", { name: "Todas as parcelas desta compra" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Excluir todas as parcelas" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Servidor indisponível.",
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(read().entries).toHaveLength(10);
});
it("fecha a exclusão desatualizada em conflito para não apagar dados atualizados em outra aba", async () => {
  const { persistence, read } = setup();
  const latest = structuredClone(read());
  latest.entries[0].amount = 15000;
  persistence.load = async () => ({
    state: latest,
    snapshot: "1",
    error: null,
  });
  persistence.save = async () => {
    throw new BudgetConflictError("Conflito");
  };
  const user = userEvent.setup();
  render(<App today="2026-12-09" persistence={persistence} />);
  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.click(
    screen.getByRole("button", { name: "Excluir Compra errada" }),
  );
  await user.click(
    screen.getByRole("radio", { name: "Todas as parcelas desta compra" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Excluir todas as parcelas" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Sua alteração não foi gravada",
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
  expect(read().entries).toHaveLength(10);
});
