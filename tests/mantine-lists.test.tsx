import { useState } from "react";
import { TransactionFilters } from "../src/components/TransactionFilters";
import { defaultTransactionFilters } from "../src/lib/transaction-filters";
import { expect, it, vi } from "vitest";
import { render, screen, within } from "./render";
import userEvent from "@testing-library/user-event";
import { TransactionsTable } from "../src/components/TransactionsTable";
import type { Occurrence } from "../src/lib/types";

const rows: Occurrence[] = Array.from({ length: 41 }, (_, index) => ({
  id: `entry-${index}`,
  key: `entry-${index}:2026-11`,
  month: "2026-11",
  description: `Lançamento ${index + 1}`,
  amount: 10000 + index,
  date: "2026-11-10",
  kind: "expense",
  method: "account",
  owner: "me",
  category: "Casa",
  repeat: "none",
}));

function table(items: Occurrence[], search = "") {
  return (
    <TransactionsTable
      items={items}
      page="entries"
      search={search}
      filter="all"
      onAssign={vi.fn()}
      onTogglePaid={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onStop={vi.fn()}
      onCreate={vi.fn()}
    />
  );
}

it("mostra vinte lançamentos por página em uma única tabela e informa o intervalo", async () => {
  const user = userEvent.setup();
  render(table(rows));
  expect(screen.getAllByRole("table")).toHaveLength(1);
  expect(
    within(screen.getByRole("table")).getAllByRole("button", {
      name: /^Editar /,
    }),
  ).toHaveLength(20);
  expect(screen.getByText("1–20 de 41 lançamentos")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Próxima página" }));
  expect(screen.getByText("21–40 de 41 lançamentos")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Editar Lançamento 21" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Editar Lançamento 1" }),
  ).not.toBeInTheDocument();
});

it("volta à primeira página quando a busca muda e mantém resultados após excluir a última página", async () => {
  const user = userEvent.setup();
  const view = render(table(rows));
  await user.click(screen.getByRole("button", { name: "Próxima página" }));
  await user.click(screen.getByRole("button", { name: "Próxima página" }));
  expect(screen.getByText("41–41 de 41 lançamentos")).toBeInTheDocument();
  view.rerender(table(rows.slice(0, 40)));
  expect(
    screen.getByRole("button", { name: "Editar Lançamento 1" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Próxima página" }));
  view.rerender(table(rows.slice(0, 40), "Casa"));
  expect(screen.getByText("1–20 de 40 lançamentos")).toBeInTheDocument();
  view.rerender(table(rows.slice(0, 40)));
  expect(screen.getByText("1–20 de 40 lançamentos")).toBeInTheDocument();
});

it("recolhe filtros no celular, informa os ativos e mantém a seleção ao reabrir", async () => {
  const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: query === "(max-width: 650px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as MediaQueryList,
  );
  function Example() {
    const [value, setValue] = useState(defaultTransactionFilters);
    return (
      <TransactionFilters
        value={value}
        onChange={setValue}
        onReset={() => setValue(defaultTransactionFilters)}
      />
    );
  }
  try {
    const user = userEvent.setup();
    render(<Example />);
    const toggle = screen.getByRole("button", { name: "Filtros e ordenação" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("combobox", { name: "Situação" }),
    ).not.toBeInTheDocument();
    await user.click(toggle);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Situação" }),
      "pending",
    );
    expect(toggle).toHaveTextContent("1 ativo");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("combobox", { name: "Situação" })).toHaveValue(
      "pending",
    );
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByRole("combobox", { name: "Situação" })).toHaveValue(
      "all",
    );
    expect(toggle).not.toHaveTextContent("ativo");
  } finally {
    matchMedia.mockRestore();
  }
});
