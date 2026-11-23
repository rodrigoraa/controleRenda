import { useMemo } from "react";
import { Badge, Button, UnstyledButton } from "@mantine/core";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  Wallet,
} from "lucide-react";
import {
  bankNames,
  type BankOverview,
  type BankPurchaseOwner,
} from "../lib/bank-feed";
import {
  addMonths,
  dateLabel,
  localDate,
  money,
  monthLabel,
  monthOf,
  summarize,
} from "../lib/finance";
import { personName } from "../lib/people";
import type { Person, State, Summary } from "../lib/types";
import { AttentionPreview } from "./Planning";
import "../ui/financial-overview.css";

const bankDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function FinancialOverview({
  state,
  summary,
  month,
  today,
  bankRead,
  bankError,
  people,
  attentionCount,
  attentionStatus,
  onlyBankPurchases,
  onMonthChange,
  onBalance,
  onPlan,
  onAttention,
  onCard,
  onEntries,
  onDemo,
}: {
  state?: State;
  summary: Summary;
  month: string;
  today: string;
  bankRead: BankOverview | null;
  bankError: boolean;
  people?: Person[];
  attentionCount: number;
  attentionStatus?: string;
  onlyBankPurchases: boolean;
  onMonthChange?: (month: string) => void;
  onBalance: () => void;
  onPlan: () => void;
  onAttention: () => void;
  onCard: () => void;
  onEntries: () => void;
  onDemo?: () => void;
}) {
  const currentMonth = monthOf(today);
  const initialMonth = state?.settings.initialMonth ?? month;

  // Month previews for timeline strip (options of months)
  const monthList = useMemo(() => {
    if (!state) return [];
    const baseMin =
      currentMonth < initialMonth ? initialMonth : addMonths(currentMonth, -1);
    const startM =
      month < baseMin
        ? month
        : baseMin < initialMonth
          ? initialMonth
          : baseMin;
    const list: string[] = [];
    let cur = startM;
    for (let i = 0; i < 6; i++) {
      list.push(cur);
      cur = addMonths(cur, 1);
    }
    if (!list.includes(month)) {
      list.push(month);
      list.sort();
    }
    return list;
  }, [state, month, currentMonth, initialMonth]);

  const monthPreviews = useMemo(() => {
    if (!state) return [];
    return monthList.map((m) => {
      const s = summarize(state, m, today);
      return {
        month: m,
        label: monthLabel(m),
        shortLabel: monthLabel(m, true),
        isCurrent: m === currentMonth,
        isSelected: m === month,
        inflows: s.inflows,
        outflows: s.outflows,
        change: s.monthlyChange,
        closing: s.closing,
      };
    });
  }, [state, monthList, today, currentMonth, month]);

  const banks = bankRead?.enabled ? bankRead.banks : [];
  const cashAccounts = banks.flatMap(({ accounts }) =>
    accounts.filter(({ kind }) => kind !== "credit"),
  );
  const balances = cashAccounts.flatMap(({ balance }) =>
    balance === null ? [] : [balance],
  );
  const bankBalance = balances.length
    ? balances.reduce((sum, balance) => sum + balance, 0)
    : null;
  const balance = bankBalance ?? summary.available;
  const linkedBills = banks.flatMap(({ accounts, institution }) =>
    accounts.flatMap((account, accountIndex) =>
      account.bills
        .filter(({ due }) => monthOf(due) === month)
        .map((bill, index) => ({
          ...bill,
          id: `${institution}-${accountIndex}-${index}`,
          name: bankNames[institution],
          purchases: account.transactions.filter(
            ({ purchaseKey, billKey }) =>
              purchaseKey && bill.billKey && billKey === bill.billKey,
          ),
        })),
    ),
  );
  const connectedParts = new Map<BankPurchaseOwner, number>();
  for (const { purchases } of linkedBills) {
    for (const purchase of purchases) {
      const owner = purchase.owner ?? "unknown";
      connectedParts.set(
        owner,
        (connectedParts.get(owner) ?? 0) + purchase.amount,
      );
    }
  }
  const connectedOwners = [...connectedParts].sort(([a], [b]) => {
    const order = (owner: BankPurchaseOwner) =>
      owner === "me" ? 0 : owner === "mother" ? 1 : owner === "unknown" ? 3 : 2;
    return order(a) - order(b);
  });
  const partialBalance =
    balances.length < cashAccounts.length ||
    banks.some(
      ({ institution, status }) =>
        institution !== "mercado-pago" && status !== "ready",
    );
  const providerTimes = banks.flatMap(({ accounts, providerUpdatedAt }) =>
    accounts.some(({ kind, balance }) => kind !== "credit" && balance !== null)
      ? [providerUpdatedAt]
      : [],
  );
  const oldestProviderTime = providerTimes.every((value) => value !== null)
    ? [...providerTimes].sort()[0]
    : null;
  const oldestProviderDay = oldestProviderTime
    ? localDate(new Date(oldestProviderTime))
    : null;
  const lastCashDay =
    oldestProviderDay && oldestProviderDay < today ? oldestProviderDay : today;
  const bankCashCoverage =
    !bankError &&
    !partialBalance &&
    cashAccounts.length > 0 &&
    oldestProviderDay &&
    (month === monthOf(today)
      ? monthOf(oldestProviderDay) >= month
      : monthOf(lastCashDay) > month) &&
    cashAccounts.every(
      ({ cashFlow }) => cashFlow && cashFlow.from <= `${month}-01`,
    );
  const movements = bankCashCoverage
    ? cashAccounts.reduce(
        (totals, { cashFlow }) => {
          for (const [date, amounts] of Object.entries(cashFlow!.days)) {
            if (monthOf(date) !== month || date > lastCashDay) continue;
            totals.inflows += amounts.inflows;
            totals.outflows += amounts.outflows;
          }
          return totals;
        },
        { inflows: 0, outflows: 0 },
      )
    : {
        inflows: summary.confirmedInflows,
        outflows: summary.confirmedOutflows,
      };
  const invoice = summary.invoice;
  const showBankCards = bankRead?.enabled && bankRead.status === "ready";
  const showBudgetCard = !showBankCards || invoice.total > 0;

  const manualParts = [
    { name: "Eu", amount: invoice.me },
    { name: "Minha mãe", amount: invoice.mother },
    ...invoice.otherParts,
    ...(invoice.unknown > 0
      ? [{ name: "A identificar", amount: invoice.unknown }]
      : []),
  ];

  return (
    <div className="financial-overview">
      {/* 1. SELETOR E PREVISÃO MÊS A MÊS */}
      {monthPreviews.length > 0 && (
        <section
          className="panel fo-month-strip-container"
          aria-labelledby="fo-month-strip-title"
        >
          <div className="fo-month-strip-header">
            <div>
              <h2 id="fo-month-strip-title" className="fo-strip-heading">
                <CalendarDays size={20} aria-hidden="true" />
                Previsão mês a mês
              </h2>
              <p>
                Escolha o mês para planejar receitas, despesas e faturas.
              </p>
            </div>
          </div>
          <div
            className="fo-month-cards-scroll"
            role="region"
            aria-label="Opções de meses"
          >
            {monthPreviews.map((p) => (
              <UnstyledButton
                key={p.month}
                className={`fo-month-pill ${p.isSelected ? "selected" : ""}`}
                aria-pressed={p.isSelected}
                onClick={() => onMonthChange?.(p.month)}
              >
                <div className="fo-pill-top">
                  <strong>{p.shortLabel}</strong>
                  {p.isCurrent && (
                    <Badge variant="filled" color="teal" size="xs">
                      Atual
                    </Badge>
                  )}
                </div>
                <div className="fo-pill-data">
                  <div className="fo-pill-item inflows">
                    <span>Entradas:</span>
                    <strong>{money(p.inflows)}</strong>
                  </div>
                  <div className="fo-pill-item outflows">
                    <span>Saídas:</span>
                    <strong>{money(p.outflows)}</strong>
                  </div>
                  <div className="fo-pill-item change">
                    <span>Sobra:</span>
                    <strong className={p.change < 0 ? "negative" : "positive"}>
                      {money(p.change)}
                    </strong>
                  </div>
                </div>
              </UnstyledButton>
            ))}
          </div>
        </section>
      )}

      {/* 2. DESTAQUE DO MÊS SELECIONADO */}
      <section
        className="panel fo-selected-overview"
        aria-labelledby="fo-selected-month-title"
      >
        <div className="fo-selected-header">
          <div>
            <h2 id="fo-selected-month-title">
              Resumo de {monthLabel(month)}
            </h2>
            <p>Valores previstos para todas as movimentações e cartões deste mês.</p>
          </div>
          {month === currentMonth && (
            <Badge variant="light" color="teal" size="md">
              Mês atual em andamento
            </Badge>
          )}
        </div>
        <div className="fo-metrics-cards">
          <div className="fo-metric-card income">
            <div className="fo-metric-top">
              <span className="fo-metric-title">
                <ArrowDownLeft size={17} aria-hidden="true" /> Receitas Previstas
              </span>
            </div>
            <strong className="fo-metric-value">{money(summary.inflows)}</strong>
            <small>
              {summary.confirmedInflows > 0
                ? `${money(summary.confirmedInflows)} já confirmados`
                : "Aguardando recebimento"}
            </small>
          </div>
          <div className="fo-metric-card expense">
            <div className="fo-metric-top">
              <span className="fo-metric-title">
                <ArrowUpRight size={17} aria-hidden="true" /> Despesas Previstas
              </span>
            </div>
            <strong className="fo-metric-value">{money(summary.outflows)}</strong>
            <small>
              {summary.confirmedOutflows > 0
                ? `${money(summary.confirmedOutflows)} já pagos`
                : "Contas + fatura do cartão"}
            </small>
          </div>
          <div className={`fo-metric-card balance ${summary.monthlyChange < 0 ? "negative" : "positive"}`}>
            <div className="fo-metric-top">
              <span className="fo-metric-title">
                <Wallet size={17} aria-hidden="true" /> Sobra Prevista
              </span>
            </div>
            <strong className="fo-metric-value">
              {summary.monthlyChange > 0 ? "+" : ""}{money(summary.monthlyChange)}
            </strong>
            <small>
              Saldo final estimado: {money(summary.closing)}
            </small>
          </div>
        </div>
      </section>

      {/* 3. SALDO DISPONÍVEL HOJE */}
      <section
        className="panel fo-panel fo-balance"
        aria-labelledby="fo-balance"
      >
        <h2 id="fo-balance">Saldo disponível hoje</h2>
        <strong className={`fo-amount ${balance < 0 ? "negative" : ""}`}>
          {money(balance)}
        </strong>
        <p>
          {bankBalance === null
            ? "Saldo confirmado no orçamento"
            : "Saldo informado pelos bancos"}
        </p>
        {bankError && bankBalance !== null && (
          <p>Exibindo o último saldo recebido.</p>
        )}
        {bankBalance !== null && (
          <>
            {oldestProviderTime ? (
              <p>
                Dados dos bancos até{" "}
                <time dateTime={oldestProviderTime}>
                  {bankDate.format(new Date(oldestProviderTime))}
                </time>
              </p>
            ) : (
              <p>Horário da atualização bancária indisponível.</p>
            )}
            {partialBalance && (
              <p>Saldo parcial. Algumas contas podem estar indisponíveis.</p>
            )}
          </>
        )}
        {bankRead?.enabled &&
          bankRead.status === "ready" &&
          bankBalance === null &&
          !bankError && <p>Nenhum saldo bancário disponível nesta consulta.</p>}
        <UnstyledButton className="text-button" onClick={onBalance}>
          {bankBalance === null
            ? "Informar saldo de hoje"
            : "Ajustar saldo do orçamento"}
        </UnstyledButton>
      </section>

      {/* 4. PREVISÃO DO PRÓXIMO MÊS */}
      <section className="panel fo-panel" aria-labelledby="fo-forecast">
        <h2 id="fo-forecast">Previsão do próximo mês</h2>
        <strong
          className={`fo-amount ${summary.nextClosing < 0 ? "negative" : ""}`}
        >
          {money(summary.nextClosing)}
        </strong>
        <p>Estimativa para o fim de {monthLabel(addMonths(month, 1))}.</p>
        <p>
          A previsão parte do saldo inicial do orçamento e considera as entradas
          e saídas cadastradas.
        </p>
        <UnstyledButton className="text-button" onClick={onPlan}>
          Ver próximos dias <ArrowRight size={16} />
        </UnstyledButton>
      </section>

      {/* 5. PENDÊNCIAS */}
      <AttentionPreview
        total={attentionCount}
        status={attentionStatus}
        action={onlyBankPurchases ? "Identificar compras" : "Ver pendências"}
        onOpen={onAttention}
      />

      {/* 6. ENTRADAS E SAÍDAS */}
      <section className="panel fo-panel fo-flow" aria-labelledby="fo-flow">
        <h2 id="fo-flow">Entradas e saídas</h2>
        {bankCashCoverage ? (
          <p>
            Movimentações das contas conectadas em {monthLabel(month)}
            {month === monthOf(today) && ` até ${dateLabel(lastCashDay)}`}.
            Inclui transferências entre contas.
          </p>
        ) : (
          <p>Movimentações confirmadas no orçamento em {monthLabel(month)}.</p>
        )}
        <dl className="fo-flow-values">
          <div>
            <dt>
              <ArrowDownLeft size={17} aria-hidden="true" /> Entrou
            </dt>
            <dd>{money(movements.inflows)}</dd>
          </div>
          <div>
            <dt>
              <ArrowUpRight size={17} aria-hidden="true" /> Saiu
            </dt>
            <dd>{money(movements.outflows)}</dd>
          </div>
        </dl>
        {bankRead?.enabled && !bankCashCoverage && month <= monthOf(today) && (
          <p>O extrato conectado não cobre o período selecionado.</p>
        )}
        {!bankCashCoverage && (
          <UnstyledButton className="text-button" onClick={onEntries}>
            Ver lançamentos <ArrowRight size={16} />
          </UnstyledButton>
        )}
      </section>

      {/* 7. CARTÕES ADICIONADOS (MEUS CARTÕES) */}
      <div className="panel fo-panel fo-cards">
        {showBankCards && (
          <section aria-labelledby="fo-connected">
            <h2 id="fo-connected">Faturas dos bancos</h2>
            {linkedBills.length > 0 ? (
              <>
                <dl className="fo-parts">
                  {linkedBills.length > 1 && (
                    <div className="fo-total">
                      <dt>Total no mês</dt>
                      <dd>
                        {money(
                          linkedBills.reduce(
                            (sum, bill) => sum + bill.amount,
                            0,
                          ),
                        )}
                      </dd>
                    </div>
                  )}
                  {linkedBills.map(({ id, name, due, amount }) => (
                    <div key={id}>
                      <dt>
                        {name} <small>· Vence em {dateLabel(due)}</small>
                      </dt>
                      <dd>{money(amount)}</dd>
                    </div>
                  ))}
                </dl>
                {connectedOwners.length ? (
                  <>
                    <h3>Compras recentes vinculadas à fatura</h3>
                    <dl className="fo-parts">
                      {connectedOwners.map(([owner, value]) => (
                        <div key={owner}>
                          <dt>
                            {owner === "other"
                              ? "Outra pessoa (sem nome)"
                              : personName(people, owner)}
                          </dt>
                          <dd>{money(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <p>Nenhuma compra recente vinculada às faturas.</p>
                )}
              </>
            ) : (
              <p>
                Nenhuma fatura conectada disponível para {monthLabel(month)}.
              </p>
            )}
          </section>
        )}
        {showBudgetCard ? (
          <section aria-labelledby="fo-card" className="fo-card-section">
            <h2 id="fo-card">Cartão do orçamento</h2>

            {/* Visual Credit Card Widget */}
            <div className="fo-credit-card-widget">
              <div className="fo-card-chip-row">
                <div className="fo-card-brand">
                  <CreditCard size={20} aria-hidden="true" />
                  <span>{state?.settings.cardName || "Cartão Principal"}</span>
                </div>
                <div className="fo-card-due-tag">
                  Vence dia {state?.settings.invoiceDay ?? 10}
                </div>
              </div>
              <div className="fo-card-invoice-info">
                <span className="fo-card-invoice-label">
                  Fatura de {monthLabel(month)}
                </span>
                <strong className="fo-card-invoice-amount">
                  {money(invoice.total)}
                </strong>
                <div className="fo-card-invoice-status">
                  {invoice.total === 0 ? (
                    <span className="status-badge neutral">
                      Sem gastos neste mês
                    </span>
                  ) : invoice.outstanding === 0 ? (
                    <span className="status-badge paid">✓ Fatura paga</span>
                  ) : invoice.paid > 0 ? (
                    <span className="status-badge partial">
                      Parcialmente paga ({money(invoice.paid)} pagos)
                    </span>
                  ) : (
                    <span className="status-badge open">
                      A pagar: {money(invoice.outstanding)}
                    </span>
                  )}
                </div>
              </div>
              {invoice.total > 0 && (
                <div className="fo-card-breakdown">
                  <span className="fo-breakdown-title">Divisão por pessoa:</span>
                  <div className="fo-breakdown-tags">
                    <span className="fo-breakdown-pill">
                      Eu: <strong>{money(invoice.me)}</strong>
                    </span>
                    {invoice.mother > 0 && (
                      <span className="fo-breakdown-pill mother">
                        Mãe: <strong>{money(invoice.mother)}</strong>
                        <small>
                          {invoice.toReceive <= 0
                            ? " (Repasse ok)"
                            : ` (Falta ${money(invoice.toReceive)})`}
                        </small>
                      </span>
                    )}
                    {invoice.otherParts.map(({ owner, name, amount }) => (
                      <span key={owner} className="fo-breakdown-pill other">
                        {name}: <strong>{money(amount)}</strong>
                      </span>
                    ))}
                    {invoice.unknown > 0 && (
                      <span className="fo-breakdown-pill unknown">
                        A identificar: <strong>{money(invoice.unknown)}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Semantic DL preserves test compatibility and accessibility */}
            <dl className="fo-parts">
              <div className="fo-total">
                <dt>Total da fatura</dt>
                <dd>{money(invoice.total)}</dd>
              </div>
              {invoice.total > 0 &&
                manualParts.map(({ name, amount }) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{money(amount)}</dd>
                  </div>
                ))}
            </dl>
            <UnstyledButton className="text-button" onClick={onCard}>
              Ver compras e pagamentos do orçamento <ArrowRight size={16} />
            </UnstyledButton>
          </section>
        ) : (
          <UnstyledButton className="text-button fo-card-link" onClick={onCard}>
            Abrir cartão do orçamento <ArrowRight size={16} />
          </UnstyledButton>
        )}
      </div>

      {onDemo && (
        <Button className="fo-demo" variant="subtle" onClick={onDemo}>
          Explorar exemplo
        </Button>
      )}
    </div>
  );
}
