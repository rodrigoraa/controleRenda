import { useState, type FormEvent } from "react";
import type { Occurrence } from "../lib/types";
import type { DeleteScope } from "../lib/entry-editing";
import { money, monthLabel, shortDate } from "../lib/finance";
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
      <form className="form-content" onSubmit={submit}>
        <fieldset className="delete-options" disabled={saving}>
          <legend>O que deseja excluir?</legend>
          <div>
            <label className="checkbox-label">
              <input
                type="radio"
                name="delete-scope"
                value="single"
                checked={scope === "single"}
                onChange={() => setScope("single")}
              />
              Somente esta parcela
            </label>
            <p className="field-note">
              Parcela {entry.installment?.index}/{entry.installment?.total}, de{" "}
              {money(entry.amount)}, em {shortDate(entry.date)} (
              {monthLabel(entry.month)}).
            </p>
          </div>
          <div>
            <label className="checkbox-label">
              <input
                type="radio"
                name="delete-scope"
                value="purchase"
                checked={scope === "purchase"}
                onChange={() => setScope("purchase")}
              />
              Todas as parcelas desta compra
            </label>
            <p className="field-note">
              Remove a compra inteira e suas {count} parcelas cadastradas, em
              todos os meses.
            </p>
          </div>
        </fieldset>
        <p className="field-note">
          Pagamentos da fatura e repasses já registrados serão mantidos. Excluir
          a compra não desfaz essas movimentações.
        </p>
        <footer className="form-footer">
          <button
            className="button secondary"
            type="button"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={saving}>
            {scope === "purchase"
              ? "Excluir todas as parcelas"
              : "Excluir esta parcela"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
