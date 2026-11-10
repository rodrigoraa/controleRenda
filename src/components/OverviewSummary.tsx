import type { CSSProperties } from "react";
import { Badge, Button, Paper, ThemeIcon } from "@mantine/core";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Wallet,
  CircleHelp,
} from "lucide-react";
import type { Summary } from "../lib/types";
import { addMonths, money, monthLabel } from "../lib/finance";
export function OverviewSummary({
  summary,
  month,
  onBalance,
  onEntries,
}: {
  summary: Summary;
  month: string;
  onBalance: () => void;
  onEntries: () => void;
}) {
  const monthName = monthLabel(month).split(" de ")[0];
  return (
    <>
      <div className="metrics-grid">
        <Paper
          component="section"
          className="metric metric-current"
          aria-label="Saldo disponível hoje"
          data-long={money(summary.available).length > 13 || undefined}
        >
          <div className="metric-top">
            <span>Saldo na conta hoje</span>
            <ThemeIcon variant="light" size={38} radius="md">
              <Wallet size={20} />
            </ThemeIcon>
          </div>
          <strong
            className={`metric-value ${summary.available < 0 ? "negative" : ""}`}
            style={
              {
                "--cr-amount-length": money(summary.available).length,
              } as CSSProperties
            }
          >
            {money(summary.available)}
          </strong>
          <Badge variant="light" color="finance" className="metric-badge">
            Confirmado
          </Badge>
          <p className="metric-caption">O dinheiro que já está na sua conta.</p>
          <Button
            variant="light"
            leftSection={<Wallet size={16} />}
            onClick={onBalance}
          >
            Informar saldo de hoje
          </Button>
        </Paper>
        <Paper
          component="section"
          className="metric"
          aria-label="Saldo previsto no fim do mês"
          data-long={money(summary.closing).length > 13 || undefined}
        >
          <div className="metric-top">
            <span>No fim de {monthName}</span>
            <Badge variant="outline" color="gray">
              Previsão
            </Badge>
          </div>
          <strong
            className={`metric-value ${summary.closing < 0 ? "negative" : ""}`}
            style={
              {
                "--cr-amount-length": money(summary.closing).length,
              } as CSSProperties
            }
          >
            {money(summary.closing)}
          </strong>
          <p className="metric-caption">
            Resultado de {monthName}
            <strong
              className={summary.monthlyChange < 0 ? "negative" : "positive"}
            >
              {summary.monthlyChange >= 0 ? "+" : ""}
              {money(summary.monthlyChange)}
            </strong>
          </p>
          <span className="metric-footnote">
            Inclui o saldo trazido dos meses anteriores.
          </span>
        </Paper>
        <Paper
          component="section"
          className="metric"
          aria-label="Previsão do próximo mês"
          data-long={money(summary.nextClosing).length > 13 || undefined}
        >
          <div className="metric-top">
            <span>
              No fim de {monthLabel(addMonths(month, 1)).split(" de ")[0]}
            </span>
            <Badge variant="outline" color="gray">
              Previsão
            </Badge>
          </div>
          <strong
            className={`metric-value ${summary.nextClosing < 0 ? "negative" : ""}`}
            style={
              {
                "--cr-amount-length": money(summary.nextClosing).length,
              } as CSSProperties
            }
          >
            {money(summary.nextClosing)}
          </strong>
          <p className="metric-caption">
            Resultado só desse mês
            <strong
              className={
                summary.nextMonthlyChange < 0 ? "negative" : "positive"
              }
            >
              {summary.nextMonthlyChange >= 0 ? "+" : ""}
              {money(summary.nextMonthlyChange)}
            </strong>
          </p>
          <span className="metric-footnote">
            Já inclui o saldo final de {monthName}.
          </span>
        </Paper>
      </div>
      <Paper
        component="section"
        className="month-ledger"
        data-long={
          Math.max(
            ...[
              summary.starting,
              summary.inflows,
              summary.outflows,
              summary.closing,
            ].map((value) => money(value).length),
          ) > 13 || undefined
        }
        aria-label="Composição da previsão"
      >
        <div className="panel-heading">
          <div>
            <h2>O caminho do seu dinheiro</h2>
            <p>Como chegamos ao saldo no fim de {monthName}.</p>
          </div>
          <Badge variant="light" color="gray">
            {monthLabel(month)}
          </Badge>
        </div>
        <dl className="ledger-values">
          <div>
            <dt>Saldo trazido</dt>
            <dd>{money(summary.starting)}</dd>
            <dd className="ledger-note">Dos meses anteriores</dd>
          </div>
          <div>
            <dt>
              <ArrowDownLeft size={16} /> Entradas no mês
            </dt>
            <dd className="positive">+ {money(summary.inflows)}</dd>
            <dd className="ledger-note">Receitas e repasses</dd>
          </div>
          <div>
            <dt>
              <ArrowUpRight size={16} /> Saídas no mês
            </dt>
            <dd>− {money(summary.outflows)}</dd>
            <dd className="ledger-note">Contas e pagamentos da fatura</dd>
          </div>
          <div className="ledger-result">
            <dt>Saldo final previsto</dt>
            <dd className={summary.closing < 0 ? "negative" : ""}>
              {money(summary.closing)}
            </dd>
            <dd className="ledger-note">Saldo trazido + entradas − saídas</dd>
          </div>
        </dl>
        <div className="ledger-footer">
          <p>
            <CircleHelp size={16} />
            <span>
              Ainda há <strong>{money(summary.pendingIncome)}</strong> a receber
              e <strong>{money(summary.pendingExpenses)}</strong> a pagar neste
              mês. As previsões incluem valores pendentes.
            </span>
          </p>
          <Button
            variant="subtle"
            rightSection={<ChevronRight size={16} />}
            onClick={onEntries}
          >
            Conferir lançamentos
          </Button>
        </div>
      </Paper>
    </>
  );
}
