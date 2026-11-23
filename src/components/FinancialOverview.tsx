import { useMemo } from "react";
import { Badge, Button, UnstyledButton } from "@mantine/core";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  Landmark,
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
  monthToolbar,
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
  monthToolbar?: React.ReactNode;
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
  const nextMonth = addMonths(month, 1);

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

  // Next month calculation
  const nextSummary = useMemo(() => {
    if (!state) return null;
    return summarize(state, nextMonth, today);
  }, [state, nextMonth, today]);

  const nextInflows = nextSummary ? nextSummary.inflows : summary.nextMonthlyChange;
  const nextOutflows = nextSummary ? nextSummary.outflows : 0;
  const nextClosing = summary.nextClosing;
  const nextChange = nextSummary
    ? nextSummary.monthlyChange
    : summary.nextClosing - summary.closing;

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

  // Additional connected cards list for multi-card support
  const connectedCards = banks.flatMap(({ accounts, institution }) =>
    accounts.flatMap((account, accountIndex) => {
      const name = bankNames[institution];
      if (account.kind === "credit") {
        return account.bills
          .filter(({ due }) => monthOf(due) === month)
          .map((bill, index) => ({
            id: `${institution}-${accountIndex}-${index}`,
            name,
            subtext: `Vencimento: dia ${bill.due.slice(8, 10)} (${dateLabel(bill.due)})`,
            amount: bill.amount,
            isCredit: true,
            amountLabel: `Fatura de ${monthLabel(month)}`,
          }));
      }
      return [
        {
          id: `${institution}-${accountIndex}`,
          name: `${name} (${account.kind === "checking" ? "Conta Corrente" : "Poupança"})`,
          subtext: "Saldo em conta bancária conectada",
          amount: account.balance ?? 0,
          isCredit: false,
          amountLabel: "Saldo disponível",
        },
      ];
    }),
  );

  return (
    <div className="financial-overview">
      {/* =========================================================================
          1. TOPO: CARDS DE TODOS OS CARTÕES E CONTAS CADASTRADOS
          Mostra todos os cartões (débito ou crédito, saldo ou despesas)
          ========================================================================= */}
      <section
        className="panel fo-cards-collection"
        aria-label="Meus cartões e contas"
      >
        <div className="fo-cards-collection-header">
          <div>
            <h2 className="fo-collection-title">
              <CreditCard size={22} aria-hidden="true" />
              Meus Cartões e Contas
            </h2>
            <p>
              Todos os seus cartões e contas cadastrados com indicação de débito/crédito e saldo/despesas.
            </p>
          </div>
        </div>

        <div className="fo-all-cards-grid">
          {/* Card Débito: Saldo Disponível Hoje */}
          <section
            className="fo-card-box debit fo-balance"
            aria-labelledby="fo-balance"
          >
            <div className="fo-card-box-header">
              <Badge variant="filled" color="teal" size="sm" className="fo-type-pill">
                <Wallet size={13} aria-hidden="true" /> DÉBITO
              </Badge>
              <span className="fo-nature-label">SALDO DISPONÍVEL</span>
            </div>
            <div className="fo-card-box-body">
              <h2 id="fo-balance" className="fo-card-heading">
                Saldo disponível hoje
              </h2>
              <p className="fo-card-desc">
                {bankBalance === null
                  ? "Saldo confirmado no orçamento"
                  : "Saldo informado pelos bancos"}
              </p>
            </div>
            <div className="fo-card-box-amount">
              <strong
                className={`fo-amount ${balance < 0 ? "negative" : ""}`}
              >
                {money(balance)}
              </strong>
            </div>
            {bankError && bankBalance !== null && (
              <p className="fo-card-meta">Exibindo o último saldo recebido.</p>
            )}
            {bankBalance !== null && (
              <>
                {oldestProviderTime ? (
                  <p className="fo-card-meta">
                    Dados dos bancos até{" "}
                    <time dateTime={oldestProviderTime}>
                      {bankDate.format(new Date(oldestProviderTime))}
                    </time>
                  </p>
                ) : (
                  <p className="fo-card-meta">Horário da atualização bancária indisponível.</p>
                )}
                {partialBalance && (
                  <p className="fo-card-meta">Saldo parcial. Algumas contas podem estar indisponíveis.</p>
                )}
              </>
            )}
            {bankRead?.enabled &&
              bankRead.status === "ready" &&
              bankBalance === null &&
              !bankError && (
                <p className="fo-card-meta">Nenhum saldo bancário disponível nesta consulta.</p>
              )}
            <div className="fo-card-box-action">
              <UnstyledButton className="text-button" onClick={onBalance}>
                {bankBalance === null
                  ? "Informar saldo de hoje"
                  : "Ajustar saldo do orçamento"}
              </UnstyledButton>
            </div>
          </section>

          {/* Card Crédito: Cartão do orçamento */}
          {showBudgetCard ? (
            <section
              aria-labelledby="fo-card"
              className="fo-card-box credit"
            >
              <div className="fo-card-box-header">
                <Badge variant="filled" color="indigo" size="sm" className="fo-type-pill credit">
                  <CreditCard size={13} aria-hidden="true" /> CRÉDITO
                </Badge>
                <span className="fo-nature-label">DESPESAS DA FATURA</span>
              </div>
              <div className="fo-card-box-body">
                <h2 id="fo-card" className="fo-card-heading">
                  Cartão do orçamento
                </h2>
                <small className="fo-card-meta">
                  {state?.settings.cardName ? `${state.settings.cardName} · ` : ""}
                  Vencimento: dia {state?.settings.invoiceDay ?? 10}
                </small>
              </div>
              <div className="fo-card-box-amount">
                <span className="fo-amount-tag">
                  Fatura de {monthLabel(month)}
                </span>
                <strong className="fo-card-value expense">
                  {money(invoice.total)}
                </strong>
                <div className="fo-card-status">
                  {invoice.total === 0 ? (
                    <Badge variant="light" color="gray" size="xs">
                      Sem gastos
                    </Badge>
                  ) : invoice.outstanding === 0 ? (
                    <Badge variant="light" color="green" size="xs">
                      ✓ Fatura paga
                    </Badge>
                  ) : invoice.paid > 0 ? (
                    <Badge variant="light" color="yellow" size="xs">
                      Falta {money(invoice.outstanding)}
                    </Badge>
                  ) : (
                    <Badge variant="light" color="red" size="xs">
                      Aberta para pagamento
                    </Badge>
                  )}
                </div>
              </div>

              {/* Divisão dos responsáveis visível */}
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

              <div className="fo-card-box-action">
                <UnstyledButton className="text-button" onClick={onCard}>
                  Ver compras e pagamentos do orçamento <ArrowRight size={16} />
                </UnstyledButton>
              </div>
            </section>
          ) : (
            <UnstyledButton className="text-button fo-card-link" onClick={onCard}>
              Abrir cartão do orçamento <ArrowRight size={16} />
            </UnstyledButton>
          )}

          {/* Cards adicionais se houver bancos conectados (Nubank, BB, etc) */}
          {connectedCards.map((c) => (
            <div
              key={c.id}
              className={`fo-card-box ${c.isCredit ? "credit" : "debit"}`}
            >
              <div className="fo-card-box-header">
                <Badge
                  variant="filled"
                  color={c.isCredit ? "indigo" : "teal"}
                  size="sm"
                  className="fo-type-pill"
                >
                  {c.isCredit ? (
                    <CreditCard size={13} aria-hidden="true" />
                  ) : (
                    <Wallet size={13} aria-hidden="true" />
                  )}
                  {c.isCredit ? " CRÉDITO" : " DÉBITO"}
                </Badge>
                <span className="fo-nature-label">
                  {c.isCredit ? "DESPESAS DA FATURA" : "SALDO EM CONTA"}
                </span>
              </div>
              <div className="fo-card-box-body">
                <div className="fo-card-title-row">
                  {c.isCredit ? <CreditCard size={18} /> : <Landmark size={18} />}
                  <h3 className="fo-card-subheading">{c.name}</h3>
                </div>
                <small className="fo-card-meta">{c.subtext}</small>
              </div>
              <div className="fo-card-box-amount">
                <span className="fo-amount-tag">{c.amountLabel}</span>
                <strong
                  className={`fo-card-value ${c.isCredit ? "expense" : "positive"}`}
                >
                  {money(c.amount)}
                </strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          2. FILTRO DE MÊS E PREVISÃO MÊS A MÊS
          Opções de meses para ver despesas e receitas de cada mês
          ========================================================================= */}
      <section
        className="panel fo-month-strip-container"
        aria-labelledby="fo-month-strip-title"
      >
        <div className="fo-month-strip-header">
          <div>
            <h2 id="fo-month-strip-title" className="fo-strip-heading">
              <CalendarDays size={20} aria-hidden="true" />
              Filtro de mês e previsão mês a mês
            </h2>
            <p>
              Navegue entre os meses e confira a projeção de receitas, despesas e sobra.
            </p>
          </div>
        </div>

        {monthToolbar && (
          <div className="fo-month-toolbar-slot">
            {monthToolbar}
          </div>
        )}

        {monthPreviews.length > 0 && (
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
        )}
      </section>

      {/* =========================================================================
          3. PREVISÃO PARA O MÊS ATUAL
          Mostra o que tenho na conta hoje, o que já entrou e o que já saiu
          ========================================================================= */}
      <section
        className="panel fo-forecast-current-month"
        aria-labelledby="fo-current-month-heading"
      >
        <div className="fo-current-month-header">
          <div>
            <h2 id="fo-current-month-heading">
              Previsão para o mês atual ({monthLabel(currentMonth)})
            </h2>
            <p>
              O que você tem na conta hoje e as movimentações deste mês.
            </p>
          </div>
          {month === currentMonth && (
            <Badge variant="light" color="teal" size="md">
              Mês atual
            </Badge>
          )}
        </div>

        {/* 3 blocos do mês atual: na conta hoje, o que já entrou, o que já saiu */}
        <div className="fo-current-month-metrics-grid">
          <div className="fo-current-tile balance">
            <span className="fo-current-label">
              <Wallet size={16} aria-hidden="true" /> Na conta hoje
            </span>
            <strong className={`fo-current-amount ${balance < 0 ? "negative" : "positive"}`}>
              {money(balance)}
            </strong>
            <small>
              {bankBalance === null ? "Saldo no orçamento" : "Saldo nos bancos"}
            </small>
          </div>

          <div className="fo-current-tile income">
            <span className="fo-current-label">
              <ArrowDownLeft size={16} aria-hidden="true" /> Já entrou
            </span>
            <strong className="fo-current-amount positive">
              {money(movements.inflows)}
            </strong>
            <small>Entradas confirmadas no mês</small>
          </div>

          <div className="fo-current-tile expense">
            <span className="fo-current-label">
              <ArrowUpRight size={16} aria-hidden="true" /> Já saiu
            </span>
            <strong className="fo-current-amount negative">
              {money(movements.outflows)}
            </strong>
            <small>Saídas confirmadas no mês</small>
          </div>
        </div>

        {/* Entradas e saídas confirmadas (O que já entrou e o que já saiu) */}
        <div
          className="fo-flow-panel"
          role="region"
          aria-labelledby="fo-flow"
        >
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
            <div className="fo-flow-item inflows">
              <dt>
                <ArrowDownLeft size={17} aria-hidden="true" /> Entrou
              </dt>
              <dd>{money(movements.inflows)}</dd>
            </div>
            <div className="fo-flow-item outflows">
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
        </div>
      </section>

      {/* =========================================================================
          4. PREVISÃO PARA O PRÓXIMO MÊS
          O que vai entrar, o que vai sair e o que vai sobrar na conta após tudo isso
          ========================================================================= */}
      <section
        className="panel fo-panel fo-forecast-next-month"
        aria-labelledby="fo-forecast"
      >
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

      {/* Detalhamento do próximo mês com o que vai entrar, o que vai sair e o que vai sobrar */}
      <section
        className="panel fo-next-month-breakdown"
        aria-label="Detalhamento do próximo mês"
      >
        <div className="fo-next-month-header">
          <div>
            <h2 className="fo-breakdown-heading">
              Detalhamento de {monthLabel(addMonths(month, 1))}
            </h2>
            <p>
              Previsão do que vai entrar, do que vai sair e do que vai sobrar na conta.
            </p>
          </div>
        </div>

        <div className="fo-next-month-metrics-grid">
          {/* O que vai entrar */}
          <div className="fo-next-tile income">
            <span className="fo-next-label">
              <ArrowDownLeft size={16} aria-hidden="true" /> O que vai entrar
            </span>
            <strong className="fo-next-amount positive">
              {money(nextInflows)}
            </strong>
            <small>Receitas previstas para o próximo mês</small>
          </div>

          {/* O que vai sair */}
          <div className="fo-next-tile expense">
            <span className="fo-next-label">
              <ArrowUpRight size={16} aria-hidden="true" /> O que vai sair
            </span>
            <strong className="fo-next-amount negative">
              {money(nextOutflows)}
            </strong>
            <small>Contas e cartão previstos</small>
          </div>

          {/* O que vai sobrar no mês */}
          <div
            className={`fo-next-tile total ${nextChange < 0 ? "negative" : "positive"}`}
          >
            <span className="fo-next-label">
              <Wallet size={16} aria-hidden="true" /> Sobra prevista no mês
            </span>
            <strong
              className={`fo-next-amount ${nextChange < 0 ? "negative" : "positive"}`}
            >
              {nextChange >= 0 ? "+" : ""}{money(nextChange)}
            </strong>
            <small>
              Saldo acumulado no fim: {money(nextClosing)}
            </small>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. PENDÊNCIAS
          ========================================================================= */}
      <AttentionPreview
        total={attentionCount}
        status={attentionStatus}
        action={onlyBankPurchases ? "Identificar compras" : "Ver pendências"}
        onOpen={onAttention}
      />

      {/* Se houver faturas conectadas extras de bancos */}
      {showBankCards && linkedBills.length > 0 && (
        <section
          className="panel fo-panel fo-connected-bills"
          aria-labelledby="fo-connected"
        >
          <h2 id="fo-connected">Faturas dos bancos</h2>
          <dl className="fo-parts">
            {linkedBills.length > 1 && (
              <div className="fo-total">
                <dt>Total no mês</dt>
                <dd>
                  {money(
                    linkedBills.reduce((sum, bill) => sum + bill.amount, 0),
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
          {connectedOwners.length > 0 && (
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
          )}
        </section>
      )}

      {onDemo && (
        <Button className="fo-demo" variant="subtle" onClick={onDemo}>
          Explorar exemplo
        </Button>
      )}
    </div>
  );
}
