import { useState, type FormEvent } from "react";
import { Button, Radio } from "@mantine/core";
import type { Occurrence } from "../lib/types";
import type { DeleteScope } from "../lib/entry-editing";
import { money, monthLabel, shortDate } from "../lib/finance";
import { ValidatedForm } from "../ui/ValidatedForm";
import { Modal } from "./Modal";

export function DeleteEntryDialog({
  entry,
  count,
  saving,
  onDelete,
  onClose,
}: {
  entry: Occurrence;
  count: number;
  saving: boolean;
  onDelete: (scope: DeleteScope) => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<DeleteScope>("single");
  function submit(event: FormEvent) {
    event.preventDefault();
    onDelete(scope);
  }
  return (
    <Modal
      title="Excluir compra parcelada"
      subtitle={entry.description}
      onClose={onClose}
    >
      <ValidatedForm className="cr-form" onSubmit={submit} aria-busy={saving}>
        <fieldset className="cr-delete-options" disabled={saving}>
          <legend>O que deseja excluir?</legend>
          <Radio
            name="delete-scope"
            value="single"
            checked={scope === "single"}
            disabled={saving}
            onChange={() => setScope("single")}
            label="Somente esta parcela"
            description={
              <>
                Parcela {entry.installment?.index}/{entry.installment?.total},
                de {money(entry.amount)}, em {shortDate(entry.date)} (
                {monthLabel(entry.month)}).
              </>
            }
          />
          <Radio
            name="delete-scope"
            value="purchase"
            checked={scope === "purchase"}
            disabled={saving}
            onChange={() => setScope("purchase")}
            label="Todas as parcelas desta compra"
            description={
              <>
                Remove a compra inteira e suas {count} parcelas cadastradas, em
                todos os meses.
              </>
            }
          />
        </fieldset>
        <p className="field-note">
          Pagamentos da fatura e repasses já registrados serão mantidos. Excluir
          a compra não desfaz essas movimentações.
        </p>
        <footer className="cr-form-footer">
          <Button
            variant="default"
            type="button"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button type="submit" color="red" loading={saving}>
            {scope === "purchase"
              ? "Excluir todas as parcelas"
              : "Excluir esta parcela"}
          </Button>
        </footer>
      </ValidatedForm>
    </Modal>
  );
}
