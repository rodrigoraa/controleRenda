import { Button, UnstyledButton } from "@mantine/core";
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from "lucide-react";
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
} from "../lib/finance";
import { personName } from "../lib/people";
import type { Person, Summary } from "../lib/types";
import { AttentionPreview } from "./Planning";
import "../ui/financial-overview.css";

const bankDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function FinancialOverview({
  summary,
  month,
  today,
  bankRead,
  bankError,
  people,
  attentionCount,
  attentionStatus,
  onlyBankPurchases,
  onBalance,
  onPlan,
  onAttention,
  onCard,
  onEntries,
  onDemo,
}: {
  summary: Summary;
  month: string;
  today: string;
  bankRead: BankOverview | null;
  bankError: boolean;
  people?: Person[];
  attentionCount: number;
  attentionStatus?: string;
  onlyBankPurchases: boolean;
  onBalance: () => void;
  onPlan: () => void;
  onAttention: () => void;
  onCard: () => void;
  onEntries: () => void;
  onDemo?: () => void;
}) {
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

      <AttentionPreview
        total={attentionCount}
        status={attentionStatus}
        action={onlyBankPurchases ? "Identificar compras" : "Ver pendências"}
        onOpen={onAttention}
      />

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
          <section aria-labelledby="fo-card">
            <h2 id="fo-card">Cartão do orçamento</h2>
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
