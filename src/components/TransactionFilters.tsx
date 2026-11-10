import { useId, useState } from "react";
import {
  Badge,
  Button,
  Collapse,
  NativeSelect,
  TextInput,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { personOptions } from "../lib/people";
import type { Person } from "../lib/types";
import {
  filterError,
  type TransactionFilters as Filters,
} from "../lib/transaction-filters";
import "../ui/lists.css";
export function TransactionFilters({
  value,
  people,
  onChange,
  onReset,
}: {
  value: Filters;
  people?: Person[];
  onChange: (value: Filters) => void;
  onReset: () => void;
}) {
  const update = (change: Partial<Filters>) =>
    onChange({ ...value, ...change });
  const error = filterError(value);
  const errorId = useId();
  const filtersId = useId();
  const compact = useMediaQuery("(max-width: 650px)", undefined, {
    getInitialValueInEffect: false,
  });
  const [expanded, setExpanded] = useState(false);
  const visible = !compact || expanded;
  const activeCount =
    Number(value.status !== "all") +
    Number(value.owner !== "all") +
    Number(value.order !== "date-asc") +
    Number(!!value.minimum) +
    Number(!!value.maximum);
  return (
    <div className="cr-filter-region">
      <Button
        className="cr-filter-toggle"
        variant="default"
        aria-expanded={visible}
        aria-controls={filtersId}
        onClick={() => setExpanded((current) => !current)}
        leftSection={<SlidersHorizontal size={17} />}
        rightSection={
          <ChevronDown
            size={17}
            style={{ transform: visible ? "rotate(180deg)" : undefined }}
          />
        }
      >
        Filtros e ordenação{" "}
        {activeCount > 0 && (
          <Badge color={error ? "red" : "finance"} variant="light">
            {error
              ? "Rever valores"
              : `${activeCount} ${activeCount === 1 ? "ativo" : "ativos"}`}
          </Badge>
        )}
      </Button>
      <Collapse expanded={visible} transitionDuration={0} id={filtersId}>
        <div className="cr-transaction-filters">
          <NativeSelect
            label="Situação"
            value={value.status}
            onChange={(event) =>
              update({ status: event.target.value as Filters["status"] })
            }
          >
            <option value="all">Todas as situações</option>
            <option value="pending">Pendente</option>
            <option value="confirmed">Pago ou recebido</option>
          </NativeSelect>
          <NativeSelect
            label="Responsável dos lançamentos"
            value={value.owner}
            onChange={(event) => update({ owner: event.target.value })}
          >
            <option value="all">Todas as pessoas</option>
            {personOptions(people).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            label="Ordenar por"
            value={value.order}
            onChange={(event) =>
              update({ order: event.target.value as Filters["order"] })
            }
          >
            <option value="date-asc">Data: mais antiga</option>
            <option value="date-desc">Data: mais recente</option>
            <option value="amount-desc">Maior valor</option>
            <option value="amount-asc">Menor valor</option>
          </NativeSelect>
          <TextInput
            label="Valor mínimo (R$)"
            inputMode="decimal"
            value={value.minimum}
            placeholder="Sem mínimo"
            error={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => update({ minimum: event.target.value })}
          />
          <TextInput
            label="Valor máximo (R$)"
            inputMode="decimal"
            value={value.maximum}
            placeholder="Sem máximo"
            error={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => update({ maximum: event.target.value })}
          />
          <div className="cr-filter-actions">
            <Button type="button" variant="default" onClick={onReset}>
              Limpar filtros
            </Button>
          </div>
          {error && (
            <p
              role="alert"
              id={errorId}
              className="cr-filter-error cr-filter-message"
            >
              {error}
            </p>
          )}
          <p className="cr-filter-note cr-filter-message">
            No crédito, a situação acompanha a fatura: enquanto houver valor a
            pagar, as compras ficam pendentes.
          </p>
        </div>
      </Collapse>
    </div>
  );
}
