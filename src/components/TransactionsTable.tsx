import { useEffect, useId, useState, type CSSProperties } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  NativeSelect,
  Pagination,
  Table,
  Tooltip,
} from "@mantine/core";
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
import "../ui/lists.css";
type Props = {
  items: Occurrence[];
  compact?: boolean;
  page: string;
  search: string;
  filter: string;
  paginationKey?: string;
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
  paginationKey,
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
  const paginationScope = JSON.stringify([
    page,
    search,
    filter,
    paginationKey,
    items.map((row) => row.key),
  ]);
  const [pagination, setPagination] = useState({
    scope: paginationScope,
    page: 1,
  });
  useEffect(() => {
    setPagination((current) =>
      current.scope === paginationScope
        ? current
        : { scope: paginationScope, page: 1 },
    );
  }, [paginationScope]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage =
    pagination.scope === paginationScope
      ? Math.min(pagination.page, pageCount)
      : 1;
  const offset = (currentPage - 1) * pageSize;
  const visibleItems = items.slice(offset, offset + pageSize);
  return (
    <div
      className={`cr-transactions ${compact ? "cr-transactions-compact" : ""}`}
      data-recurring={page === "recurring" || undefined}
    >
      <Table
        className="cr-transactions-table"
        role="table"
        aria-label="Lançamentos"
        verticalSpacing="md"
        highlightOnHover
      >
        <Table.Thead role="rowgroup">
          <Table.Tr role="row">
            <Table.Th scope="col" role="columnheader">
              Lançamento
            </Table.Th>
            <Table.Th scope="col" role="columnheader">
              {page === "card" ? "Responsável" : "Situação"}
            </Table.Th>
            <Table.Th scope="col" role="columnheader">
              Valor
            </Table.Th>
            <Table.Th scope="col" role="columnheader">
              <span className="sr-only">Ações</span>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody role="rowgroup">
          {visibleItems.map((row) => (
            <Table.Tr key={row.key} role="row">
              <Table.Td role="cell">
                <div className="cr-entry-name">
                  <span
                    className="cr-entry-icon"
                    data-kind={row.kind}
                    data-method={row.method}
                    aria-hidden="true"
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
                    <div className="cr-entry-meta">
                      <span>{row.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{shortDate(row.date)}</span>
                      {row.installment && (
                        <Badge
                          variant="light"
                          color="gray"
                          size="sm"
                          className="cr-installment-badge"
                        >
                          {row.installment.index}/{row.installment.total}
                        </Badge>
                      )}
                      {row.repeat === "monthly" && (
                        <Repeat2 size={13} aria-label="Todo mês" role="img" />
                      )}
                    </div>
                  </div>
                </div>
              </Table.Td>
              <Table.Td role="cell">
                {row.method === "card" ? (
                  <NativeSelect
                    className="cr-owner-select"
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
                  </NativeSelect>
                ) : (
                  <Button
                    className="cr-status-button"
                    data-settled={!!row.settledOn}
                    variant="light"
                    color={row.settledOn ? "green" : "gray"}
                    size="compact-sm"
                    leftSection={
                      row.settledOn ? <Check size={14} /> : <Clock3 size={14} />
                    }
                    type="button"
                    onClick={() => onTogglePaid(row)}
                    title={
                      row.settledOn
                        ? `Confirmado em ${shortDate(row.settledOn)}. Clique para desfazer.`
                        : "Clique para confirmar a movimentação"
                    }
                  >
                    <span>
                      {row.settledOn
                        ? row.kind === "income"
                          ? "Recebido"
                          : "Pago"
                        : "Pendente"}
                    </span>
                  </Button>
                )}
              </Table.Td>
              <Table.Td
                role="cell"
                className="cr-entry-amount"
                data-income={row.kind === "income" || undefined}
              >
                {row.kind === "income" ? "+ " : ""}
                <span
                  className="cr-currency"
                  style={
                    {
                      "--cr-amount-length": money(row.amount).length,
                    } as CSSProperties
                  }
                >
                  {money(row.amount)}
                </span>
              </Table.Td>
              <Table.Td role="cell">
                <div className="cr-row-actions">
                  <Tooltip label="Editar lançamento" withArrow>
                    <ActionIcon
                      className="cr-row-action"
                      variant="subtle"
                      color="gray"
                      size={44}
                      type="button"
                      aria-label={`Editar ${row.description}`}
                      onClick={() => onEdit(row)}
                    >
                      <Pencil size={17} />
                    </ActionIcon>
                  </Tooltip>
                  {!compact && (
                    <Tooltip label="Excluir lançamento" withArrow>
                      <ActionIcon
                        className="cr-row-action cr-row-action-danger"
                        variant="subtle"
                        color="red"
                        size={44}
                        type="button"
                        aria-label={`Excluir ${row.description}`}
                        onClick={() => onDelete(row)}
                      >
                        <Trash2 size={17} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {page === "recurring" && (
                    <Button
                      className="cr-stop-button"
                      variant="subtle"
                      color="gray"
                      type="button"
                      onClick={() => onStop(row)}
                    >
                      Encerrar
                    </Button>
                  )}
                </div>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {items.length > pageSize && (
        <div className="cr-table-pagination">
          <p role="status" aria-live="polite">
            {offset + 1}–{Math.min(offset + pageSize, items.length)} de{" "}
            {items.length} lançamentos
          </p>
          <Pagination
            total={pageCount}
            value={currentPage}
            onChange={(nextPage) =>
              setPagination({ scope: paginationScope, page: nextPage })
            }
            siblings={0}
            size={44}
            gap={4}
            className="cr-pagination"
            layout="responsive"
            formatLabel={({ page: activePage, totalPages }) =>
              `Página ${activePage} de ${totalPages}`
            }
            getItemProps={(number) => ({ "aria-label": `Página ${number}` })}
            getControlProps={(control) => ({
              "aria-label":
                control === "next"
                  ? "Próxima página"
                  : control === "previous"
                    ? "Página anterior"
                    : control === "first"
                      ? "Primeira página"
                      : "Última página",
            })}
          />
        </div>
      )}
      {items.some((row) => row.installment) && (
        <p className="cr-table-note" id={ownerHintId}>
          Em compras parceladas, trocar o responsável aplica a mudança a todas
          as parcelas da mesma compra.
        </p>
      )}
      {items.length === 0 && (
        <div className="cr-table-empty">
          <span className="cr-empty-icon" aria-hidden="true">
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
            <Button
              variant="light"
              onClick={onCreate}
              rightSection={<ArrowRight size={16} />}
              type="button"
            >
              Adicionar lançamento
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
