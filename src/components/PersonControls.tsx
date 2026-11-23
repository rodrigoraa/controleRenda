import { useState } from "react";
import { Button, NativeSelect, TextInput } from "@mantine/core";
import type { Entry, Occurrence, Person } from "../lib/types";
import { personOptions } from "../lib/people";
import { Modal } from "./Modal";
export type AddPerson = (name: string) => Promise<Person | undefined>;
export function OwnerSelect({
  row,
  people,
  disabled,
  label,
  describedBy,
  onAssign,
  onAddPerson,
}: {
  row: Occurrence;
  people?: Person[];
  disabled?: boolean;
  label?: string;
  describedBy?: string;
  onAssign: (row: Occurrence, owner: Entry["owner"]) => void;
  onAddPerson?: (row: Occurrence) => void;
}) {
  return (
    <NativeSelect
      className="cr-owner-select"
      label={label}
      aria-label={
        label
          ? `${label}: ${row.description}`
          : `Responsável por ${row.description}`
      }
      aria-describedby={describedBy}
      value={row.owner}
      disabled={disabled}
      onChange={(event) => {
        if (event.currentTarget.value === "__add_person__") onAddPerson?.(row);
        else onAssign(row, event.currentTarget.value as Entry["owner"]);
      }}
    >
      {personOptions(people).map((person) => (
        <option key={person.id} value={person.id}>
          {person.name}
        </option>
      ))}
      {onAddPerson && <option value="__add_person__">Adicionar pessoa…</option>}
    </NativeSelect>
  );
}
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
