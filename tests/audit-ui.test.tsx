import { expect, it } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { createEmptyState } from "../src/lib/validation";
import {
  BudgetConflictError,
  type BudgetPersistence,
  type LoadedBudget,
} from "../src/lib/persistence";
import type { State } from "../src/lib/types";

function budget(method: "account" | "card" = "account") {
  const state = createEmptyState("2026-11");
  state.entries.push({
    id: "expense",
    description: "Conta de teste",
    date: "2026-11-09",
    kind: "expense",
    amount: 10000,
    method,
    owner: method === "card" ? "mother" : "me",
    repeat: "none",
    category: "Outros",
  });
  return state;
}

it("fecha a confirmação antiga após conflito e mostra o valor atualizado ao reabrir", async () => {
  const first = budget(),
    latest = structuredClone(first);
  latest.entries[0].amount = 20000;
  let saved: State | undefined;
  const persistence: BudgetPersistence = {
    initial: { state: first, snapshot: "0", error: null },
    load: async () => ({ state: latest, snapshot: "1", error: null }),
    save: async (state, expected) => {
      if (expected === "0") throw new BudgetConflictError();
      saved = state;
      return { state, snapshot: "2", error: null };
    },
  };
  render(<App today="2026-11-09" persistence={persistence} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.click(screen.getByRole("button", { name: "Pendente" }));
  expect(screen.getByLabelText("Valor recebido ou pago (R$)")).toHaveValue(
    "100,00",
  );
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Confirmar movimentação",
    }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Outro aparelho");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(saved).toBeUndefined();
  await user.click(screen.getByRole("button", { name: "Pendente" }));
  expect(screen.getByLabelText("Valor recebido ou pago (R$)")).toHaveValue(
    "200,00",
  );
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Confirmar movimentação",
    }),
  );
  expect(saved?.entries[0].amount).toBe(20000);
  expect(saved?.settled["expense:2026-11"]).toEqual({ date: "2026-11-09" });
});

it("descarta também a confirmação aberta durante a atualização lenta após conflito", async () => {
  const first = budget(),
    latest = structuredClone(first);
  latest.entries[0].amount = 20000;
  let finish!: () => void;
  const persistence: BudgetPersistence = {
    initial: { state: first, snapshot: "0", error: null },
    load: () =>
      new Promise<LoadedBudget>((resolve) => {
        finish = () => resolve({ state: latest, snapshot: "1", error: null });
      }),
    save: async () => {
      throw new BudgetConflictError();
    },
  };
  render(<App today="2026-11-09" persistence={persistence} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.click(screen.getByRole("button", { name: "Pendente" }));
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Confirmar movimentação",
    }),
  );
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Pendente" }));
  expect(screen.getByLabelText("Valor recebido ou pago (R$)")).toHaveValue(
    "100,00",
  );
  await act(async () => finish());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Pendente" }));
  expect(screen.getByLabelText("Valor recebido ou pago (R$)")).toHaveValue(
    "200,00",
  );
});

it.each(["payment", "reimbursement", "settings", "person"] as const)(
  "fecha o diálogo %s baseado na revisão anterior após um conflito",
  async (mode) => {
    const first = budget("card"),
      latest = structuredClone(first);
    latest.settings.cardName = "Cartão atualizado";
    const persistence: BudgetPersistence = {
      initial: { state: first, snapshot: "0", error: null },
      load: async () => ({ state: latest, snapshot: "1", error: null }),
      save: async () => {
        throw new BudgetConflictError();
      },
    };
    render(<App today="2026-11-09" persistence={persistence} />);
    const user = userEvent.setup();
    if (mode === "settings") {
      await user.click(
        screen.getByRole("button", { name: "Configurações e dados" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Editar configurações" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Salvar configurações" }),
      );
    } else {
      await user.click(
        screen.getByRole("button", { name: "Cartão compartilhado" }),
      );
      if (mode === "person") {
        await user.selectOptions(
          screen.getByRole("combobox", {
            name: "Responsável por Conta de teste",
          }),
          "__add_person__",
        );
        await user.type(screen.getByLabelText("Nome da pessoa"), "Ana");
        await user.click(
          screen.getByRole("button", { name: "Cadastrar pessoa" }),
        );
      } else {
        await user.click(
          screen.getByRole("button", {
            name:
              mode === "payment" ? "Registrar pagamento" : "Registrar repasse",
          }),
        );
        await user.click(
          screen.getByRole("button", {
            name:
              mode === "payment"
                ? "Confirmar pagamento"
                : "Confirmar recebimento",
          }),
        );
      }
    }
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Outro aparelho",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
);

it("preserva o novo rascunho quando o salvamento de um formulário anterior termina", async () => {
  const state = createEmptyState("2026-11");
  let finish!: () => void;
  const persistence: BudgetPersistence = {
    initial: { state, snapshot: "0", error: null },
    load: async () => ({ state, snapshot: "0", error: null }),
    save: (next) =>
      new Promise<LoadedBudget>((resolve) => {
        finish = () => resolve({ state: next, snapshot: "1", error: null });
      }),
  };
  render(<App today="2026-11-09" persistence={persistence} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await user.type(screen.getByLabelText("Descrição"), "Primeiro");
  await user.type(screen.getByLabelText("Valor (R$)"), "100");
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await user.type(screen.getByLabelText("Descrição"), "Rascunho novo");
  await act(async () => finish());
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByLabelText("Descrição")).toHaveValue("Rascunho novo");
});

it("descarta a confirmação aberta com o valor anterior durante um salvamento bem-sucedido", async () => {
  const state = budget();
  let finish!: () => void;
  const persistence: BudgetPersistence = {
    initial: { state, snapshot: "0", error: null },
    load: async () => ({ state, snapshot: "0", error: null }),
    save: (next) =>
      new Promise<LoadedBudget>((resolve) => {
        finish = () => resolve({ state: next, snapshot: "1", error: null });
      }),
  };
  render(<App today="2026-11-09" persistence={persistence} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Lançamentos" }));
  await user.click(
    screen.getByRole("button", { name: "Editar Conta de teste" }),
  );
  await user.clear(screen.getByLabelText("Valor (R$)"));
  await user.type(screen.getByLabelText("Valor (R$)"), "200,00");
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  await user.click(screen.getByRole("button", { name: "Pendente" }));
  expect(screen.getByLabelText("Valor recebido ou pago (R$)")).toHaveValue(
    "100,00",
  );
  await act(async () => finish());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Pendente" }));
  expect(screen.getByLabelText("Valor recebido ou pago (R$)")).toHaveValue(
    "200,00",
  );
});

it("descarta configurações reabertas antes de o salvamento anterior terminar", async () => {
  const state = budget();
  let finish!: () => void;
  const persistence: BudgetPersistence = {
    initial: { state, snapshot: "0", error: null },
    load: async () => ({ state, snapshot: "0", error: null }),
    save: (next) =>
      new Promise<LoadedBudget>((resolve) => {
        finish = () => resolve({ state: next, snapshot: "1", error: null });
      }),
  };
  render(<App today="2026-11-09" persistence={persistence} />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Configurações e dados" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Editar configurações" }),
  );
  await user.clear(screen.getByLabelText("Nome do cartão"));
  await user.type(screen.getByLabelText("Nome do cartão"), "Cartão atualizado");
  await user.click(
    screen.getByRole("button", { name: "Salvar configurações" }),
  );
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  await user.click(
    screen.getByRole("button", { name: "Editar configurações" }),
  );
  expect(screen.getByLabelText("Nome do cartão")).toHaveValue(
    state.settings.cardName,
  );
  await act(async () => finish());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Editar configurações" }),
  );
  expect(screen.getByLabelText("Nome do cartão")).toHaveValue(
    "Cartão atualizado",
  );
});

it("aguarda o salvamento real antes de abrir o exemplo", async () => {
  const state = createEmptyState("2026-11");
  let finish!: () => void;
  const persistence: BudgetPersistence = {
    initial: { state, snapshot: "0", error: null },
    load: async () => ({ state, snapshot: "0", error: null }),
    save: (next) =>
      new Promise<LoadedBudget>((resolve) => {
        finish = () => resolve({ state: next, snapshot: "1", error: null });
      }),
  };
  render(<App today="2026-11-09" persistence={persistence} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await user.type(screen.getByLabelText("Descrição"), "Real");
  await user.type(screen.getByLabelText("Valor (R$)"), "100");
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  await user.click(
    screen.getByRole("button", { name: "Configurações e dados" }),
  );
  await user.click(screen.getByRole("button", { name: "Abrir exemplo" }));
  expect(screen.queryByText("Modo de exemplo")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Aguarde o salvamento");
  await act(async () => finish());
  await user.click(screen.getByRole("button", { name: "Abrir exemplo" }));
  expect(screen.getByText("Modo de exemplo")).toBeInTheDocument();
});

it.each(["valid", "invalid", "unreadable"] as const)(
  "descarta a leitura de backup %s iniciada antes de entrar no exemplo",
  async (result) => {
    const state = createEmptyState("2026-11");
    let finish!: () => void;
    let saved = false;
    const persistence: BudgetPersistence = {
      initial: { state, snapshot: "0", error: null },
      load: async () => ({ state, snapshot: "0", error: null }),
      save: async (next) => {
        saved = true;
        return { state: next, snapshot: "1", error: null };
      },
    };
    const file = new File(["backup"], "backup.json", {
      type: "application/json",
    });
    file.text = () =>
      new Promise((resolve, reject) => {
        finish = () =>
          result === "unreadable"
            ? reject(new Error("Falha na leitura antiga."))
            : resolve(
                result === "valid" ? JSON.stringify(budget()) : "invalid",
              );
      });
    render(<App today="2026-11-09" persistence={persistence} />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Configurações e dados" }),
    );
    fireEvent.change(screen.getByLabelText("Selecionar backup"), {
      target: { files: [file] },
    });
    await user.click(screen.getByRole("button", { name: "Abrir exemplo" }));
    await act(async () => finish());
    expect(screen.getByText("Modo de exemplo")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(saved).toBe(false);
  },
);

it("restaura o backup após confirmação enquanto continua nos dados reais", async () => {
  const state = createEmptyState("2026-11"),
    imported = budget();
  let saved: State | undefined;
  const persistence: BudgetPersistence = {
    initial: { state, snapshot: "0", error: null },
    load: async () => ({ state, snapshot: "0", error: null }),
    save: async (next) => {
      saved = next;
      return { state: next, snapshot: "1", error: null };
    },
  };
  const file = new File(["backup"], "backup.json", {
    type: "application/json",
  });
  file.text = async () => JSON.stringify(imported);
  render(<App today="2026-11-09" persistence={persistence} />);
  const user = userEvent.setup();
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Selecionar backup"), {
      target: { files: [file] },
    });
  });
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Restaurar este backup?",
  );
  expect(saved).toBeUndefined();
  await user.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(saved).toEqual(imported);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
