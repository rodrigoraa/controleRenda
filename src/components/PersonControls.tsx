import { useState } from "react";
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
    <div className="person-creator">
      <label>
        Nome da pessoa
        <input
          maxLength={60}
          value={name}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              register();
            }
          }}
        />
      </label>
      <div className="person-actions">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar cadastro
        </button>
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={register}
        >
          Cadastrar pessoa
        </button>
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
      <div className="form-content">
        <PersonCreator onAdd={onAdd} onCreated={onClose} onCancel={onClose} />
      </div>
    </Modal>
  );
}
