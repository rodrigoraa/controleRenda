import { useMemo } from "react";
import { Button } from "@mantine/core";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  TriangleAlert,
} from "lucide-react";
import { dateLabel, forecastNext30Days, money } from "../lib/finance";
import type { State } from "../lib/types";
import { AttentionPreview } from "./Planning";
import "../ui/home.css";

export function Home({
  state,
  today,
  attentionCount,
  onPlan,
  onAttention,
  onSimulate,
  onBalance,
  onDemo,
}: {
  state: State;
  today: string;
  attentionCount: number;
  onPlan: () => void;
  onAttention: () => void;
  onSimulate: () => void;
  onBalance: () => void;
  onDemo?: () => void;
}) {
  const plan = useMemo(() => forecastNext30Days(state, today), [state, today]);
  const upcoming = plan.days
    .flatMap(({ events }) => events.filter((event) => event.date >= today))
    .slice(0, 3);
  const shortfall = plan.lowest.balance < 0;
  return (
    <div className="home-dashboard">
      <section
        className="panel home-margin"
        aria-labelledby="home-margin-title"
      >
        <div className="home-margin-copy">
          <h2 id="home-margin-title">
            {plan.start === today
              ? "Quanto posso gastar hoje?"
              : "Margem no início do orçamento"}
          </h2>
          <strong className="home-amount">
            {money(Math.max(0, plan.lowest.balance))}
          </strong>
          <p>
            Estimativa do orçamento com as contas cadastradas para os próximos
            30 dias.
          </p>
          {shortfall && (
            <p className="home-shortfall">
              <TriangleAlert size={18} aria-hidden="true" />{" "}
              <span>
                Podem faltar <strong>{money(-plan.lowest.balance)}</strong> em{" "}
                {dateLabel(plan.lowest.date)}.
              </span>
            </p>
          )}
        </div>
        <div className="home-margin-actions">
          <Button
            className="button primary"
            leftSection={<Calculator size={18} />}
            onClick={onSimulate}
          >
            Simular compra
          </Button>
          <Button variant="subtle" onClick={onBalance}>
            Informar saldo de hoje
          </Button>
          {onDemo && (
            <Button variant="subtle" onClick={onDemo}>
              Explorar exemplo
            </Button>
          )}
        </div>
      </section>
      <section
        className="panel home-upcoming"
        aria-labelledby="home-upcoming-title"
      >
        <h2 id="home-upcoming-title">O que vem a seguir?</h2>
        {upcoming.length ? (
          <ol className="plan-list">
            {upcoming.map(({ date, label, amount }, index) => (
              <li key={`${date}-${index}`}>
                <span className="home-event-icon" aria-hidden="true">
                  {amount > 0 ? (
                    <ArrowDownLeft size={18} />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                </span>
                <div>
                  <strong>{label}</strong>
                  <time dateTime={date}>{dateLabel(date)}</time>
                </div>
                <span className={amount > 0 ? "positive" : undefined}>
                  {amount > 0 ? "+ " : ""}
                  {money(amount)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>Nenhuma movimentação prevista para os próximos dias.</p>
        )}
        <Button
          variant="default"
          rightSection={<ArrowRight size={16} />}
          onClick={onPlan}
        >
          Ver próximos dias
        </Button>
      </section>
      <AttentionPreview total={attentionCount} onOpen={onAttention} />
    </div>
  );
}
