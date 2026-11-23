import { expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "./render";
import { PurchaseSimulator } from "../src/components/PurchaseSimulator";
import { createEmptyState } from "../src/lib/validation";

it("simula à vista com poucos campos e abre a comparação com cartão sob escolha", async () => {
  const state = createEmptyState("2026-11");
  state.settings.openingBalance = 50000;
  render(<PurchaseSimulator state={state} today="2026-11-10" />);
  const user = userEvent.setup();
  const calculate = screen.getByRole("button", { name: "Calcular impacto" });
  expect(screen.queryByLabelText(/primeira fatura/i)).not.toBeInTheDocument();
  await user.type(screen.getByLabelText(/Valor total \(R\$\)/), "120,00");
  await user.click(calculate);
  expect(
    screen.getByText("R$ 380,00", { selector: ".purchase-summary strong" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Qual opção preserva a reserva?" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("checkbox", { name: "Comparar com cartão" }),
  );
  expect(screen.getByLabelText(/primeira fatura/i)).toBeInTheDocument();
  await user.clear(screen.getByLabelText(/parcelas/i));
  await user.type(screen.getByLabelText(/parcelas/i), "3");
  await user.click(calculate);
  expect(
    screen.getByRole("heading", { name: "Qual opção preserva a reserva?" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/3 parcelas ·/)).toBeInTheDocument();
});
