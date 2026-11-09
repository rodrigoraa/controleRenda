import { useId } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Repeat2,
  Check,
  Clock3,
  Pencil,
  Trash2,
  Leaf,
  ArrowRight,
} from "lucide-react";
import type { Entry, Occurrence, Person } from "../lib/types";
import { personOptions } from "../lib/people";
import { money, shortDate } from "../lib/finance";
type Props = {
  items: Occurrence[];
  compact?: boolean;
  page: string;
  search: string;
  filter: string;
  onAssign: (row: Occurrence, owner: Entry["owner"]) => void;
  onTogglePaid: (row: Occurrence) => void;
  onEdit: (row: Occurrence) => void;
  onDelete: (row: Occurrence) => void;
  onStop: (row: Occurrence) => void;
  onCreate: () => void;
  people?: Person[];
  onAddPerson?: (row: Occurrence) => void;
};
export function TransactionsTable({
  items,
  compact = false,
  page,
  search,
  filter,
  onAssign,
  onTogglePaid,
  onEdit,
  onDelete,
  onStop,
  onCreate,
  people,
  onAddPerson,
}: Props) {
  const ownerHintId = useId();
  return (
    <div
      className={`table-wrap ${compact ? "compact-list" : ""}`}
      data-recurring={page === "recurring" || undefined}
    >
      <table role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader">Lançamento</th>
            <th role="columnheader">
              {page === "card" ? "Responsável" : "Situação"}
            </th>
            <th role="columnheader">Valor</th>
            <th role="columnheader">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {items.map((row) => (
            <tr key={row.key} role="row">
              <td role="cell">
                <div className="entry-name">
                  <span
                    className={`entry-icon ${row.kind === "income" ? "entry-income" : row.method === "card" ? "entry-card" : ""}`}
                  >
                    {row.kind === "income" ? (
                      <ArrowDownLeft size={18} />
                    ) : row.method === "card" ? (
                      <CreditCard size={17} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </span>
                  <div>
                    <strong>{row.description}</strong>
                    <small>
                      {row.category}
                      <span className="dot">·</span>
                      {shortDate(row.date)}
                      {row.installment && (
                        <>
                          {" "}
                          · {row.installment.index}/{row.installment.total}
                        </>
                      )}
                      {row.repeat === "monthly" && (
                        <Repeat2 size={11} aria-label="Todo mês" />
                      )}
                    </small>
                  </div>
                </div>
              </td>
              <td role="cell">
                {row.method === "card" ? (
                  <select
                    className={`owner-select ${row.owner}`}
                    aria-label={`Responsável por ${row.description}`}
                    aria-describedby={row.installment ? ownerHintId : undefined}
                    value={row.owner}
                    onChange={(e) => {
                      if (e.target.value === "__add_person__")
                        onAddPerson?.(row);
                      else onAssign(row, e.target.value as Entry["owner"]);
                    }}
                  >
                    {personOptions(people).map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                    {onAddPerson && (
                      <option value="__add_person__">Adicionar pessoa…</option>
                    )}
                  </select>
                ) : (
                  <button
                    className={`status-pill ${row.settledOn ? "settled" : "pending"}`}
                    onClick={() => onTogglePaid(row)}
                    title={
                      row.settledOn
                        ? `Confirmado em ${shortDate(row.settledOn)}. Clique para desfazer.`
                        : "Clique para confirmar a movimentação"
                    }
                  >
                    {row.settledOn ? <Check size={12} /> : <Clock3 size={12} />}
                    <span>
                      {row.settledOn
                        ? row.kind === "income"
                          ? "Recebido"
                          : "Pago"
                        : "Pendente"}
                    </span>
                  </button>
                )}
              </td>
              <td
                role="cell"
                className={`amount ${row.kind === "income" ? "positive" : ""}`}
              >
                {row.kind === "income" ? "+ " : ""}
                {money(row.amount)}
              </td>
              <td role="cell">
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={`Editar ${row.description}`}
                    onClick={() => onEdit(row)}
                  >
                    <Pencil size={15} />
                  </button>
                  {!compact && (
                    <button
                      className="icon-button"
                      aria-label={`Excluir ${row.description}`}
                      onClick={() => onDelete(row)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  {page === "recurring" && (
                    <button
                      className="text-button small"
                      onClick={() => onStop(row)}
                    >
                      Encerrar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.some((row) => row.installment) && (
        <p className="field-note" id={ownerHintId}>
          Em compras parceladas, trocar o responsável aplica a mudança a todas
          as parcelas da mesma compra.
        </p>
      )}
      {items.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">
            {page === "card" ? <CreditCard size={26} /> : <Leaf size={26} />}
          </span>
          <h3>
            {search || filter !== "all"
              ? "Nenhum resultado por aqui"
              : "Tudo começa com um lançamento"}
          </h3>
          <p>
            {search || filter !== "all"
              ? "Tente outro termo ou altere o filtro."
              : "Adicione receitas e despesas para acompanhar seu dinheiro."}
          </p>
          {!search && filter === "all" && (
            <button className="text-button" onClick={onCreate}>
              Adicionar lançamento <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
