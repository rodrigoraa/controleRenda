import { useId, useMemo, useState, type ReactNode } from "react";
import { Badge, Button } from "@mantine/core";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ListTodo,
  TriangleAlert,
} from "lucide-react";
import {
  dateLabel,
  forecastNext30Days,
  money,
  monthLabel,
} from "../lib/finance";
import type { collectAttention } from "../lib/attention";
import type { Entry, Occurrence, State } from "../lib/types";
import { OwnerSelect } from "./PersonControls";
import "../ui/planning.css";

const batch = 6;

export function DailyBalance({
  state,
  today,
  onSimulate,
}: {
  state: State;
  today: string;
  onSimulate: () => void;
}) {
  const plan = useMemo(() => forecastNext30Days(state, today), [state, today]);
  const { start, through } = plan;
  const [limit, setLimit] = useState(batch);
  return (
    <section
      className="panel cash-timeline"
      aria-labelledby="cash-timeline-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="cash-timeline-title">Saldo ao longo dos próximos 30 dias</h2>
          <p>
            {dateLabel(start)} a {dateLabel(through)}
          </p>
        </div>
        <CalendarDays size={20} aria-hidden="true" />
      </div>
      <div className="cash-metrics">
        <div>
          <span>Menor saldo previsto</span>
          <strong className={plan.lowest.balance < 0 ? "negative" : undefined}>
            {money(plan.lowest.balance)}
          </strong>
          <small>{dateLabel(plan.lowest.date)}</small>
        </div>
      </div>
      {plan.lowest.balance < 0 && (
        <p className="cash-warning">
          <TriangleAlert size={17} aria-hidden="true" /> Há risco de faltar
          dinheiro em {dateLabel(plan.lowest.date)}.
        </p>
      )}
      {plan.days.length > 0 ? (
        <ol
          className="plan-list"
          aria-label="Linha do tempo de recebimentos e vencimentos"
        >
          {plan.days
            .slice(0, limit)
            .map(({ date, events, closing, minimum }) => (
              <li className="cash-day" key={date}>
                <time dateTime={date}>{dateLabel(date)}</time>
                <ul className="plan-list cash-day-events">
                  {events.map((event, index) => (
                    <li key={`${event.source}-${index}`}>
                      <span>
                        {event.label}
                        {event.date < date && (
                          <small>Vencimento em {dateLabel(event.date)}</small>
                        )}
                      </span>
                      <strong
                        className={event.amount > 0 ? "positive" : undefined}
                      >
                        {event.amount > 0 ? "+ " : ""}
                        {money(event.amount)}
                      </strong>
                    </li>
                  ))}
                </ul>
                <div className="cash-day-balance">
                  <small>Saldo no fim do dia</small>
                  <strong className={closing < 0 ? "negative" : undefined}>
                    {money(closing)}
                  </strong>
                  {minimum < 0 && closing >= 0 && (
                    <small className="negative">
                      Pode cair a {money(minimum)} antes das entradas
                    </small>
                  )}
                </div>
              </li>
            ))}
        </ol>
      ) : (
        <p className="planning-empty">
          Nenhuma entrada ou saída prevista para o período.
        </p>
      )}
      <p className="planning-note">
        Contas vencidas entram no primeiro dia. Receitas atrasadas aguardam
        confirmação. Quando caem no mesmo dia, as saídas são consideradas antes
        das entradas.
      </p>
      <div className="planning-actions">
        {plan.days.length > limit && (
          <Button
            variant="default"
            onClick={() => setLimit((value) => value + batch)}
          >
            Mostrar mais dias
          </Button>
        )}
        <Button
          variant="default"
          rightSection={<ArrowRight size={16} />}
          onClick={onSimulate}
        >
          Simular compra
        </Button>
      </div>
    </section>
  );
}

export function AttentionPreview({
  total,
  onOpen,
}: {
  total: number;
  onOpen: () => void;
}) {
  return (
    <section
      className="panel attention-preview"
      aria-labelledby="attention-preview-title"
    >
      <ListTodo size={22} aria-hidden="true" />
      <div>
        <h2 id="attention-preview-title">Pendências</h2>
        <p>
          {total
            ? `${total} ${total === 1 ? "item para conferir" : "itens para conferir"}`
            : "Nenhuma pendência agora"}
        </p>
      </div>
      <Button
        variant="default"
        rightSection={<ArrowRight size={16} />}
        onClick={onOpen}
      >
        Ver pendências
      </Button>
    </section>
  );
}

function AttentionGroup<T>({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
}) {
  const [limit, setLimit] = useState(batch);
  const titleId = useId();
  if (!items.length) return null;
  return (
    <section className="panel attention-group" aria-labelledby={titleId}>
      <div className="panel-heading">
        <h2 id={titleId}>{title}</h2>
        <Badge variant="light" color="gray">
          {items.length}
        </Badge>
      </div>
      <ul className="plan-list">{items.slice(0, limit).map(renderItem)}</ul>
      {items.length > limit && (
        <Button
          variant="default"
          className="attention-more"
          onClick={() => setLimit((value) => value + batch)}
        >
          Mostrar mais
        </Button>
      )}
    </section>
  );
}

export function AttentionPage({
  attention,
  today,
  people,
  saving,
  onSettle,
  onAssign,
  onAddPerson,
  onTransfer,
}: {
  attention: ReturnType<typeof collectAttention>;
  today: string;
  people: State["people"];
  saving: boolean;
  onSettle: (row: Occurrence) => void;
  onAssign: (row: Occurrence, owner: Entry["owner"]) => void;
  onAddPerson: (row: Occurrence) => void;
  onTransfer: (mode: "payment" | "reimbursement", month: string) => void;
}) {
  const timing = (date: string) =>
    date < today
      ? `Em atraso desde ${dateLabel(date)}`
      : date === today
        ? "Previsto para hoje"
        : `Previsto para ${dateLabel(date)}`;
  if (!attention.total)
    return (
      <div className="panel quiet-state" role="status">
        <CheckCircle2 size={29} aria-hidden="true" />
        <strong>Tudo em dia por aqui.</strong>
        <p>
          Contas próximas do vencimento, compras sem responsável e repasses
          pendentes aparecem nesta área.
        </p>
      </div>
    );
  return (
    <div className="attention-grid">
      <AttentionGroup
        title="Movimentações a confirmar"
        items={attention.movements}
        renderItem={(row) => (
          <li className="attention-item" key={row.key}>
            <div>
              <strong>{row.description}</strong>
              <small>{timing(row.date)}</small>
            </div>
            <strong>{money(row.amount)}</strong>
            <Button
              variant="default"
              disabled={saving}
              onClick={() => onSettle(row)}
            >
              {row.kind === "income"
                ? "Confirmar recebimento"
                : "Confirmar pagamento"}
            </Button>
          </li>
        )}
      />
      <AttentionGroup
        title="Faturas a pagar"
        items={attention.invoices}
        renderItem={({ month, date, amount }) => (
          <li className="attention-item" key={month}>
            <div>
              <strong>Fatura de {monthLabel(month)}</strong>
              <small>{timing(date)}</small>
            </div>
            <strong>{money(amount)}</strong>
            <Button
              variant="default"
              disabled={saving}
              onClick={() => onTransfer("payment", month)}
            >
              Registrar pagamento
            </Button>
          </li>
        )}
      />
      <AttentionGroup
        title="Compras sem responsável"
        items={attention.unknown}
        renderItem={(row) => (
          <li className="attention-item" key={row.key}>
            <div>
              <strong>{row.description}</strong>
              <small>
                {row.installment ? `${row.installment.index}ª parcela · ` : ""}
                {monthLabel(row.month)}
              </small>
            </div>
            <strong>{money(row.amount)}</strong>
            <OwnerSelect
              label="Identificar compra"
              row={row}
              people={people}
              disabled={saving}
              onAssign={onAssign}
              onAddPerson={onAddPerson}
            />
          </li>
        )}
      />
      <AttentionGroup
        title="Repasses a receber"
        items={attention.reimbursements}
        renderItem={({ month, date, amount }) => (
          <li className="attention-item" key={month}>
            <div>
              <strong>Repasse da sua mãe · {monthLabel(month)}</strong>
              <small>{timing(date)}</small>
            </div>
            <strong>{money(amount)}</strong>
            <Button
              variant="default"
              disabled={saving}
              onClick={() => onTransfer("reimbursement", month)}
            >
              Registrar repasse
            </Button>
          </li>
        )}
      />
    </div>
  );
}
