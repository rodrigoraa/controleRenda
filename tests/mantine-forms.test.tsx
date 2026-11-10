import { useState } from "react";
import { Button, TextInput } from "@mantine/core";
import { expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "./render";
import { ValidatedForm } from "../src/ui/ValidatedForm";
import { Modal } from "../src/components/Modal";
import { UIProvider } from "../src/ui/theme";

it("associa a validação em português ao campo, mantém o rascunho e só envia dados válidos", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn((event) => event.preventDefault());
  render(
    <ValidatedForm onSubmit={onSubmit}>
      <TextInput
        label="Descrição"
        required
        withAsterisk={false}
        defaultValue="Mercado"
      />
      <TextInput label="E-mail" type="email" required withAsterisk={false} />
      <Button type="submit">Salvar</Button>
    </ValidatedForm>,
  );
  const email = screen.getByLabelText("E-mail");
  let descriptionAtFocus: string | null = null;
  email.addEventListener("focus", () => {
    const errorId = email.getAttribute("aria-describedby");
    descriptionAtFocus = errorId
      ? (document.getElementById(errorId)?.textContent ?? null)
      : null;
  });
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(email).toHaveFocus();
  expect(email).toHaveAttribute("aria-invalid", "true");
  expect(email).toHaveAccessibleDescription(/Preencha este campo/);
  expect(descriptionAtFocus).toContain("Preencha este campo");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "E-mail: Preencha este campo.",
  );
  expect(screen.getByLabelText("Descrição")).toHaveValue("Mercado");
  await user.type(email, "alex@example.com");
  expect(email).not.toHaveAttribute("aria-invalid");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  expect(onSubmit).toHaveBeenCalledOnce();
});

it("mantém as restrições de data e número sem abrir validação do navegador", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn((event) => event.preventDefault());
  render(
    <ValidatedForm onSubmit={onSubmit}>
      <TextInput
        label="Data"
        type="date"
        min="2026-11-01"
        max="2026-11-10"
        defaultValue="2026-11-11"
      />
      <TextInput
        label="Vencimento"
        type="number"
        min="1"
        max="31"
        defaultValue="32"
      />
      <Button type="submit">Salvar</Button>
    </ValidatedForm>,
  );
  const date = screen.getByLabelText("Data");
  expect(date.closest("form")).toHaveAttribute("novalidate");
  const reportValidity = vi.spyOn(HTMLFormElement.prototype, "reportValidity");
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(date).toHaveFocus();
  expect(date).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("Vencimento")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(reportValidity).not.toHaveBeenCalled();
  reportValidity.mockRestore();
});

it("torna o fundo inerte e devolve o foco ao fechar a janela", async () => {
  function Example() {
    const [opened, setOpened] = useState(false);
    return (
      <>
        <button onClick={() => setOpened(true)}>Abrir edição</button>
        {opened && (
          <Modal title="Editar" onClose={() => setOpened(false)}>
            <button>Salvar</button>
          </Modal>
        )}
      </>
    );
  }
  const user = userEvent.setup();
  const { container } = render(<Example />, {
    wrapper: ({ children }) => <UIProvider>{children}</UIProvider>,
  });
  const trigger = screen.getByRole("button", { name: "Abrir edição" });
  await user.click(trigger);
  expect(container.inert).toBe(true);
  expect(screen.getByRole("button", { name: "Fechar janela" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(container.inert).not.toBe(true);
  expect(trigger).toHaveFocus();
});
