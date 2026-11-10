import { useState } from "react";
import { Button, TextInput } from "@mantine/core";
import type { Person } from "../lib/types";
import { Modal } from "./Modal";
export type AddPerson = (name: string) => Promise<Person | undefined>;
export function PersonCreator({
  onAdd,
  onCreated,
  onCancel,
}: {
  onAdd: AddPerson;
  onCreated: (person: Person) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function register() {
    if (busy) return;
    setBusy(true);
    try {
      const person = await onAdd(name);
      if (person) onCreated(person);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="cr-person-creator" aria-busy={busy}>
      <TextInput
        className="cr-field"
        label="Nome da pessoa"
        maxLength={60}
        value={name}
        autoComplete="off"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            register();
          }
        }}
      />
      <div className="cr-person-actions">
        <Button
          type="button"
          variant="default"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar cadastro
        </Button>
        <Button type="button" loading={busy} onClick={register}>
          Cadastrar pessoa
        </Button>
      </div>
    </div>
  );
}
export function PersonDialog({
  onAdd,
  onClose,
}: {
  onAdd: AddPerson;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Adicionar pessoa"
      subtitle="Cadastre quem será responsável pela compra."
      onClose={onClose}
    >
      <div className="cr-form">
        <PersonCreator onAdd={onAdd} onCreated={onClose} onCancel={onClose} />
      </div>
    </Modal>
  );
}
