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
  state: State;
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
  const initialMonth = state.settings.initialMonth;
  const nextMonth = addMonths(month, 1);

  // Month previews for timeline strip (options of months)
  const monthList = useMemo(() => {
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
  }, [month, currentMonth, initialMonth]);

  const monthPreviews = useMemo(() => {
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

  const currentSummary = useMemo(
    () =>
      month === currentMonth ? summary : summarize(state, currentMonth, today),
    [state, month, currentMonth, today, summary],
  );
  const nextSummary = useMemo(
    () => summarize(state, nextMonth, today),
    [state, nextMonth, today],
  );

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
  const balance = bankBalance ?? currentSummary.available;

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
    monthOf(oldestProviderDay) >= currentMonth &&
    cashAccounts.every(
      ({ cashFlow }) => cashFlow && cashFlow.from <= `${currentMonth}-01`,
    );
  const movements = bankCashCoverage
    ? cashAccounts.reduce(
        (totals, { cashFlow }) => {
          for (const [date, amounts] of Object.entries(cashFlow!.days)) {
            if (monthOf(date) !== currentMonth || date > lastCashDay) continue;
            totals.inflows += amounts.inflows;
            totals.outflows += amounts.outflows;
          }
          return totals;
        },
        { inflows: 0, outflows: 0 },
      )
    : {
        inflows: currentSummary.confirmedInflows,
        outflows: currentSummary.confirmedOutflows,
      };

  const invoice = summary.invoice;
  const showBankCards = bankRead?.enabled && bankRead.status === "ready";

  const manualParts = [
    { name: "Eu", amount: invoice.me },
    { name: "Minha mãe", amount: invoice.mother },
    ...invoice.otherParts,
    ...(invoice.unknown > 0
      ? [{ name: "A identificar", amount: invoice.unknown }]
      : []),
  ];

  const connectedCards = banks.flatMap(({ accounts, institution }) => {
    const name = bankNames[institution];
    const counts = { credit: 0, checking: 0, savings: 0 };
    for (const { kind } of accounts) counts[kind]++;

    const positions = { credit: 0, checking: 0, savings: 0 };
    const details = accounts.map((account, index) => {
      const { kind } = account;
      const isCredit = kind === "credit";
      const position = ++positions[kind];
      const accountName = kind === "checking" ? "Conta corrente" : "Poupança";
      const title = isCredit ? name : `${name} (${accountName})`;
      const suffix =
        counts[kind] > 1 ? ` · ${isCredit ? "Cartão " : ""}${position}` : "";
      const bills = isCredit
        ? account.bills.filter(({ due }) => monthOf(due) === month)
        : [];
      const billedAmount = bills.length
        ? bills.reduce((total, bill) => total + bill.amount, 0)
        : null;
      return {
        id: `${institution}-${index}`,
        kind,
        name: title + suffix,
        amount: isCredit ? billedAmount : account.balance,
        isCredit,
        amountLabel: isCredit
          ? `Fatura de ${monthLabel(month)}`
          : "Saldo disponível",
        emptyLabel: isCredit
          ? (account.limited ? "Fatura indisponível" : "Sem fatura no mês")
          : "Saldo indisponível",
        due: bills.length === 1 ? bills[0].due : null,
      };
    });
    const hasPair = counts.checking === 1 && counts.credit === 1;
    const standalone = details
      .filter(({ kind }) => !hasPair || kind === "savings")
      .map((detail) => ({ id: detail.id, name: detail.name, details: [detail] }));

    if (!hasPair) return standalone;

    const pair = details
      .filter(({ kind }) => kind !== "savings")
      .sort((a, b) => Number(a.isCredit) - Number(b.isCredit));
    return [{ id: institution, name, details: pair }, ...standalone];
  });

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
          </div>
        </div>

        <div className="fo-all-cards-grid">
          <section
            aria-labelledby="fo-card"
            className="fo-card-box credit"
          >
            <div className="fo-card-box-header">
              <Badge variant="light" color="indigo" size="sm" className="fo-type-pill">
                <CreditCard size={13} aria-hidden="true" /> CRÉDITO
              </Badge>
              <span className="fo-nature-label">DESPESAS DA FATURA</span>
            </div>
            <div className="fo-card-box-body">
              <h3 id="fo-card" className="fo-card-title">
                {state.settings.cardName}
              </h3>
              <small className="fo-card-meta">
                Vencimento: dia {state.settings.invoiceDay}
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
                Ver compras e pagamentos <ArrowRight size={16} />
              </UnstyledButton>
            </div>
          </section>
          {connectedCards.map((card) => {
            const combined = card.details.length > 1;
            const creditOnly = !combined && card.details[0].isCredit;
            const variant = combined ? "combined" : creditOnly ? "credit" : "debit";

            return (
              <section
                key={card.id}
                aria-labelledby={`fo-card-${card.id}`}
                className={`fo-card-box ${variant}`}
              >
                <div className="fo-card-title-row">
                  {creditOnly ? (
                    <CreditCard size={18} aria-hidden="true" />
                  ) : (
                    <Landmark size={18} aria-hidden="true" />
                  )}
                  <h3 id={`fo-card-${card.id}`} className="fo-card-title">
                    {card.name}
                  </h3>
                </div>
                {card.details.map((detail) => (
                  <div key={detail.id} className="fo-connected-card-detail">
                    <div className="fo-card-box-header">
                      <Badge
                        variant="light"
                        color={detail.isCredit ? "indigo" : "finance"}
                        size="sm"
                        className="fo-type-pill"
                      >
                        {detail.isCredit ? (
                          <CreditCard size={13} aria-hidden="true" />
                        ) : (
                          <Wallet size={13} aria-hidden="true" />
                        )}
                        {detail.isCredit ? " CRÉDITO" : " DÉBITO"}
                      </Badge>
                      <span className="fo-nature-label">
                        {detail.isCredit ? "DESPESAS DA FATURA" : "SALDO EM CONTA"}
                      </span>
                    </div>
                    <div className="fo-card-box-amount">
                      <span className="fo-amount-tag">{detail.amountLabel}</span>
                      {detail.amount === null ? (
                        <strong className="fo-card-meta">{detail.emptyLabel}</strong>
                      ) : (
                        <strong
                          className={`fo-card-value ${detail.isCredit || detail.amount < 0 ? "expense" : "positive"}`}
                        >
                          {money(detail.amount)}
                        </strong>
                      )}
                      {detail.due && (
                        <small className="fo-card-meta">
                          Vencimento em {dateLabel(detail.due)}
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
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
          <h2 id="fo-current-month-heading">
            Previsão para o mês atual ({monthLabel(currentMonth)})
          </h2>
        </div>
        <div className="fo-next-month-metrics-grid">
          <section
            className="fo-next-tile total fo-balance"
            aria-labelledby="fo-balance"
          >
            <div className="fo-card-box-body">
              <h3 id="fo-balance" className="fo-next-label">
                <Wallet size={16} aria-hidden="true" /> Saldo disponível hoje
              </h3>
              <p className="fo-card-desc">
                {bankBalance === null
                  ? "Saldo confirmado no orçamento"
                  : "Saldo informado pelos bancos"}
              </p>
            </div>
            <div className="fo-card-box-amount">
              <strong
                className={`fo-next-amount ${balance < 0 ? "negative" : "positive"}`}
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
          <div className="fo-next-tile income">
            <span className="fo-next-label">
              <ArrowDownLeft size={16} aria-hidden="true" /> Já entrou
            </span>
            <strong className="fo-next-amount positive">{money(movements.inflows)}</strong>
          </div>
          <div className="fo-next-tile expense">
            <span className="fo-next-label">
              <ArrowUpRight size={16} aria-hidden="true" /> Já saiu
            </span>
            <strong className="fo-next-amount negative">{money(movements.outflows)}</strong>
          </div>
        </div>
        <div className="fo-period-note">
          {bankCashCoverage ? (
            <p>Movimentações bancárias até {dateLabel(lastCashDay)}, incluindo transferências entre contas.</p>
          ) : (
            <>
              <p>
                {bankRead?.enabled && "Extrato bancário incompleto para o mês atual. "}
                Entradas e saídas confirmadas no orçamento.
              </p>
              <UnstyledButton className="text-button" onClick={onEntries}>
                Ver lançamentos <ArrowRight size={16} />
              </UnstyledButton>
            </>
          )}
        </div>
      </section>

      <section
        className="panel fo-forecast-next-month"
        aria-labelledby="fo-forecast"
      >
        <div className="fo-next-month-header">
          <div>
            <h2 id="fo-forecast">Previsão do próximo mês</h2>
            <p>{monthLabel(nextMonth)}</p>
          </div>
        </div>
        <div className="fo-next-month-metrics-grid">
          <div className="fo-next-tile income">
            <span className="fo-next-label">
              <ArrowDownLeft size={16} aria-hidden="true" /> O que vai entrar
            </span>
            <strong className="fo-next-amount positive">{money(nextSummary.inflows)}</strong>
          </div>
          <div className="fo-next-tile expense">
            <span className="fo-next-label">
              <ArrowUpRight size={16} aria-hidden="true" /> O que vai sair
            </span>
            <strong className="fo-next-amount negative">{money(nextSummary.outflows)}</strong>
          </div>
          <div
            role="group"
            aria-labelledby="fo-next-closing"
            className={`fo-next-tile total ${nextSummary.closing < 0 ? "negative" : "positive"}`}
          >
            <span id="fo-next-closing" className="fo-next-label">
              <Wallet size={16} aria-hidden="true" /> Saldo previsto no fim do mês
            </span>
            <strong className={`fo-next-amount ${nextSummary.closing < 0 ? "negative" : "positive"}`}>
              {money(nextSummary.closing)}
            </strong>
            <small>Inclui o saldo previsto do mês anterior.</small>
          </div>
        </div>
        <div className="fo-period-note">
          <UnstyledButton className="text-button" onClick={onPlan}>
            Ver próximos dias <ArrowRight size={16} />
          </UnstyledButton>
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
