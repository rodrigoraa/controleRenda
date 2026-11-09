import { personOptions } from "../lib/people";
import type { Person } from "../lib/types";
import {
  filterError,
  type TransactionFilters as Filters,
} from "../lib/transaction-filters";
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
  return (
    <div className="transaction-filters">
      <label>
        Situação
        <select
          value={value.status}
          onChange={(event) =>
            update({ status: event.target.value as Filters["status"] })
          }
        >
          <option value="all">Todas as situações</option>
          <option value="pending">Pendente</option>
          <option value="confirmed">Pago ou recebido</option>
        </select>
      </label>
      <label>
        Responsável dos lançamentos
        <select
          value={value.owner}
          onChange={(event) => update({ owner: event.target.value })}
        >
          <option value="all">Todas as pessoas</option>
          {personOptions(people).map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ordenar por
        <select
          value={value.order}
          onChange={(event) =>
            update({ order: event.target.value as Filters["order"] })
          }
        >
          <option value="date-asc">Data: mais antiga</option>
          <option value="date-desc">Data: mais recente</option>
          <option value="amount-desc">Maior valor</option>
          <option value="amount-asc">Menor valor</option>
        </select>
      </label>
      <label>
        Valor mínimo (R$)
        <input
          inputMode="decimal"
          value={value.minimum}
          placeholder="Sem mínimo"
          onChange={(event) => update({ minimum: event.target.value })}
        />
      </label>
      <label>
        Valor máximo (R$)
        <input
          inputMode="decimal"
          value={value.maximum}
          placeholder="Sem máximo"
          onChange={(event) => update({ maximum: event.target.value })}
        />
      </label>
      <div className="filter-actions">
        <button type="button" className="text-button" onClick={onReset}>
          Limpar filtros
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error filter-message">
          {error}
        </p>
      )}
      <p className="field-note filter-message">
        No crédito, a situação acompanha a fatura: enquanto houver valor a
        pagar, as compras ficam pendentes.
      </p>
    </div>
  );
}
