import { it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { loadState } from "../src/lib/storage";
it("cadastra uma renda mensal, projeta os dois meses e persiste após reabrir", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<App today="2026-11-06" />);
  await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await user.click(screen.getByRole("button", { name: "Receita" }));
  await user.type(screen.getByLabelText("Descrição"), "Pagamento do sistema");
  await user.type(screen.getByLabelText("Valor (R$)"), "1200,00");
  await user.selectOptions(screen.getByLabelText("Repetição"), "monthly");
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(
    within(screen.getByRole("region", { name: "Sobra prevista" })).getByText(
      "R$ 1.200,00",
    ),
  ).toBeInTheDocument();
  expect(
    within(
      screen.getByRole("region", { name: "Previsão do próximo mês" }),
    ).getByText("R$ 2.400,00"),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Próximo mês" }));
  expect(
    within(screen.getByRole("table")).getByText("Pagamento do sistema"),
  ).toBeInTheDocument();
  unmount();
  render(<App today="2026-11-06" />);
  expect(
    within(screen.getByRole("table")).getByText("Pagamento do sistema"),
  ).toBeInTheDocument();
});
it("atribui compra à mãe e registra o Pix sem quitar a fatura automaticamente", async () => {
  const user = userEvent.setup();
  render(<App today="2026-11-06" />);
  await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await user.type(screen.getByLabelText("Descrição"), "Farmácia da mãe");
  await user.type(screen.getByLabelText("Valor (R$)"), "250");
  await user.selectOptions(screen.getByLabelText("Forma de pagamento"), "card");
  await user.selectOptions(screen.getByLabelText("Responsável"), "mother");
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  await user.click(
    screen.getByRole("button", { name: "Cartão compartilhado" }),
  );
  await user.click(screen.getByRole("button", { name: "Registrar repasse" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar recebimento" }),
  );
  const saved = loadState("2026-11").state;
  expect(saved.reimbursements[0].amount).toBe(25000);
  expect(saved.payments).toHaveLength(0);
  expect(
    within(
      screen.getByRole("region", { name: "Repasse da sua mãe" }),
    ).getByText("R$ 0,00"),
  ).toBeInTheDocument();
});
it("mantém a demonstração separada dos dados reais", async () => {
  const user = userEvent.setup();
  render(<App today="2026-11-06" />);
  await user.click(screen.getByRole("button", { name: "Explorar exemplo" }));
  expect(screen.getByText("Modo de exemplo")).toBeInTheDocument();
  expect(screen.getByText("Salário")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sair do exemplo" }));
  expect(loadState("2026-11").state.entries).toHaveLength(0);
  expect(screen.queryByText("Pagamento do sistema")).not.toBeInTheDocument();
});
it("libera a recorrência ao trocar uma compra parcelada por receita", async () => {
  const user = userEvent.setup();
  render(<App today="2026-11-06" />);
  await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await user.selectOptions(screen.getByLabelText("Forma de pagamento"), "card");
  await user.selectOptions(screen.getByLabelText("Parcelas"), "3");
  await user.click(screen.getByRole("button", { name: "Receita" }));
  expect(screen.getByLabelText("Repetição")).toBeEnabled();
  await user.selectOptions(screen.getByLabelText("Repetição"), "monthly");
  await user.type(screen.getByLabelText("Descrição"), "Ajuste mensal");
  await user.type(screen.getByLabelText("Valor (R$)"), "0,02");
  await user.click(screen.getByRole("button", { name: "Salvar lançamento" }));
  expect(loadState("2026-11").state.entries[0]).toMatchObject({
    amount: 2,
    kind: "income",
    repeat: "monthly",
  });
});
