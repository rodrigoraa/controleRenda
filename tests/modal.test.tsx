import { it, expect } from "vitest";
import { render, screen } from "./render";
import userEvent from "@testing-library/user-event";
import { Modal } from "../src/components/Modal";
it("coloca o foco dentro da confirmação e mantém a navegação por teclado nela", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button>Fora da janela</button>
      <Modal title="Confirmação" onClose={() => {}}>
        <button>Cancelar</button>
        <button>Confirmar</button>
      </Modal>
    </>,
  );
  expect(screen.getByRole("button", { name: "Fechar janela" })).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByRole("button", { name: "Confirmar" })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Fechar janela" })).toHaveFocus();
});
