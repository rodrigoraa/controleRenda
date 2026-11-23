import { useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Checkbox,
  NativeSelect,
  Pagination,
  Table,
  TextInput,
} from "@mantine/core";
import { Calculator, TriangleAlert } from "lucide-react";
import {
  addMonths,
  comparePaymentOptions,
  dateInMonth,
  dateLabel,
  money,
  monthLabel,
  monthOf,
  parseMoney,
  simulatePurchase,
  type PurchaseScenario,
} from "../lib/finance";
import type { State } from "../lib/types";
import { ValidatedForm } from "../ui/ValidatedForm";

const monthsPerPage = 6;
type Scenario = PurchaseScenario & {
  comparison?: { cardCount: number; firstInvoice: string; reserve: number };
};
const paymentLabels = {
  today: "Pagar à vista hoje",
  afterIncome: "Esperar a próxima receita",
  card: "Pagar no cartão",
};

function PaymentComparison({
  comparison,
  reserve,
  count,
}: {
  comparison: ReturnType<typeof comparePaymentOptions>;
  reserve: number;
  count: number;
}) {
  return (
    <section
      className="panel payment-comparison"
      aria-labelledby="payment-comparison-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="payment-comparison-title">Qual opção preserva a reserva?</h2>
          <p>
            Reserva de {money(reserve)} · previsão até{" "}
            {dateLabel(comparison.through)}
          </p>
        </div>
      </div>
      {comparison.baselineBelow && (
        <p className="cash-warning">
          <TriangleAlert size={17} aria-hidden="true" /> A previsão fica abaixo
          da reserva mesmo sem a compra.
        </p>
      )}
      <ul className="plan-list comparison-list">
        {comparison.options.map((option) => (
          <li key={option.kind}>
            <div>
              <strong>{paymentLabels[option.kind]}</strong>
              <small>
                {option.kind === "card"
                  ? `${count === 1 ? "Fatura" : `${count} parcelas`} · ${dateLabel(option.date)}${count > 1 ? ` a ${dateLabel(option.lastDate)}` : ""}`
                  : dateLabel(option.date)}
                {option.kind === "afterIncome" &&
                  comparison.nextIncome &&
                  ` · Após ${comparison.nextIncome.label}, previsto para ${dateLabel(comparison.nextIncome.date)}`}
              </small>
            </div>
            <div className="comparison-outcome">
              <strong className={option.firstBelow ? "negative" : "positive"}>
                {option.firstBelow
                  ? `Abaixo da reserva em ${dateLabel(option.firstBelow.date)}`
                  : "Mantém a reserva"}
              </strong>
              <small>
                Menor saldo de {money(option.lowest.balance)} em{" "}
                {dateLabel(option.lowest.date)}
              </small>
            </div>
          </li>
        ))}
        {!comparison.nextIncome && (
          <li>
            <div>
              <strong>Esperar a próxima receita</strong>
              <small>
                Nenhuma receita futura cadastrada nos próximos seis meses.
              </small>
            </div>
          </li>
        )}
      </ul>
      <p className="planning-note">
        A comparação considera saídas antes das entradas do mesmo dia e deixa de
        fora as receitas vencidas sem confirmação.
      </p>
    </section>
  );
}

export function PurchaseSimulator({
  state,
  today,
}: {
  state: State;
  today: string;
}) {
  const currentMonth = monthOf(today);
  const start =
    currentMonth < state.settings.initialMonth
      ? state.settings.initialMonth
      : currentMonth;
  const [method, setMethod] = useState<PurchaseScenario["method"]>("account");
  const [compareCard, setCompareCard] = useState(false);
  const showComparison = method === "card" || compareCard;
  const nextInvoice =
    dateInMonth(start, state.settings.invoiceDay) < today
      ? addMonths(start, 1)
      : start;
  const paymentMonths = Array.from({ length: 12 }, (_, offset) => {
    const month = addMonths(start, offset);
    return { value: month, label: monthLabel(month) };
  });
  const invoiceMonths = paymentMonths.filter(
    ({ value }) => value >= nextInvoice,
  );
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [page, setPage] = useState(1);
  const [amountError, setAmountError] = useState("");
  const [reserveError, setReserveError] = useState("");
  const result = useMemo(
    () =>
      scenario && {
        monthly: simulatePurchase(state, scenario, currentMonth),
        comparison:
          scenario.comparison &&
          comparePaymentOptions(state, {
            today,
            amount: scenario.amount,
            count: scenario.comparison.cardCount,
            reserve: scenario.comparison.reserve,
            firstInvoice: scenario.comparison.firstInvoice,
          }),
      },
    [state, scenario, currentMonth, today],
  );
  const negative =
    result?.monthly.months.find(
      ({ projected, baseline }) => projected < 0 && baseline >= 0,
    ) ?? result?.monthly.months.find(({ projected }) => projected < 0);
  const first = result?.monthly.months.find(
    ({ month }) => month === scenario?.month,
  );
  const startRow = (page - 1) * monthsPerPage;

  function simulate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const amount = parseMoney(String(fields.get("amount")));
    const cardCount = Number(fields.get("count") ?? 1);
    const reserve = parseMoney(
      String(fields.get("reserve") ?? "").trim() || "0",
    );
    const amountField = event.currentTarget.elements.namedItem(
      "amount",
    ) as HTMLInputElement;
    if (amount === null || amount < cardCount) {
      setAmountError(
        amount === null || amount === 0
          ? "Informe um valor maior que zero, com até duas casas decimais."
          : "Informe pelo menos um centavo por parcela.",
      );
      amountField.focus();
      return;
    }
    if (reserve === null) {
      setReserveError(
        "Informe um valor a partir de zero, com até duas casas decimais.",
      );
      (
        event.currentTarget.elements.namedItem("reserve") as HTMLInputElement
      ).focus();
      return;
    }
    setAmountError("");
    setReserveError("");
    setPage(1);
    const firstInvoice = String(fields.get("firstInvoice") ?? nextInvoice);
    setScenario({
      amount,
      count: method === "card" ? cardCount : 1,
      method,
      month: method === "card" ? firstInvoice : String(fields.get("month")),
      comparison: showComparison
        ? { cardCount, firstInvoice, reserve }
        : undefined,
    });
  }

  return (
    <div className="purchase-simulator">
      <section className="panel" aria-labelledby="purchase-inputs">
        <div className="panel-heading">
          <div>
            <h2 id="purchase-inputs">Dados da compra</h2>
            <p>A simulação fica aqui e não cria um lançamento.</p>
          </div>
        </div>
        <ValidatedForm
          className="cr-form"
          onSubmit={simulate}
          onChange={() => {
            setAmountError("");
            setReserveError("");
            setScenario(null);
          }}
        >
          <TextInput
            name="amount"
            label="Valor total (R$)"
            inputMode="decimal"
            placeholder="0,00"
            required
            error={amountError || undefined}
          />
          <NativeSelect
            label="Forma de pagamento"
            value={method}
            onChange={(event) =>
              setMethod(event.currentTarget.value as PurchaseScenario["method"])
            }
            data={[
              { value: "account", label: "À vista na conta" },
              { value: "card", label: "No cartão" },
            ]}
          />
          {method === "account" && (
            <NativeSelect
              name="month"
              label="Mês do pagamento"
              data={paymentMonths}
            />
          )}
          {method === "account" && (
            <Checkbox
              label="Comparar com cartão"
              checked={compareCard}
              onChange={(event) => setCompareCard(event.currentTarget.checked)}
            />
          )}
          {showComparison && (
            <>
              <NativeSelect
                name="firstInvoice"
                label={
                  method === "account"
                    ? "Primeira fatura para comparar"
                    : "Mês da primeira fatura"
                }
                data={invoiceMonths}
                defaultValue={nextInvoice}
              />
              <TextInput
                name="count"
                label={
                  method === "account" ? "Parcelas para comparar" : "Parcelas"
                }
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                step={1}
                defaultValue={1}
                required
              />
              <TextInput
                name="reserve"
                label="Reserva mínima (R$)"
                description="Quanto você quer manter disponível."
                inputMode="decimal"
                placeholder="0,00"
                error={reserveError || undefined}
              />
            </>
          )}
          <Button
            className="button primary"
            type="submit"
            leftSection={<Calculator size={18} />}
          >
            Calcular impacto
          </Button>
        </ValidatedForm>
      </section>
      <div className="purchase-output">
        {result?.comparison && scenario?.comparison && (
          <PaymentComparison
            comparison={result.comparison}
            reserve={scenario.comparison.reserve}
            count={scenario.comparison.cardCount}
          />
        )}
        <section
          className="panel purchase-results"
          aria-labelledby="purchase-results"
        >
          <div className="panel-heading">
            <h2 id="purchase-results">Saldo no fim de cada mês</h2>
          </div>
          {result && scenario && first ? (
            <>
              <div className="purchase-summary" role="status">
                <span>{monthLabel(first.month)}</span>
                <strong
                  className={first.projected < 0 ? "negative" : undefined}
                >
                  {money(first.projected)}
                </strong>
                <p>
                  Saldo previsto com a compra de {money(scenario.amount)}
                  {scenario.count > 1 && (
                    <>
                      {" "}
                      em {scenario.count} parcelas de{" "}
                      {money(result.monthly.installments.at(-1)!)}
                      {result.monthly.installments[0] !==
                        result.monthly.installments.at(-1) && (
                        <> a {money(result.monthly.installments[0])}</>
                      )}
                    </>
                  )}
                  .
                </p>
              </div>
              {negative && (
                <Alert
                  color="red"
                  className="purchase-warning"
                  role="status"
                  icon={<TriangleAlert size={18} />}
                >
                  {negative.baseline < 0
                    ? "O saldo já estava previsto no negativo"
                    : "A compra leva o saldo previsto ao negativo"}{" "}
                  em {monthLabel(negative.month)} ({money(negative.projected)}).
                </Alert>
              )}
              <Table className="purchase-table" captionSide="top">
                <caption className="sr-only">
                  Comparação do saldo previsto com e sem a compra
                </caption>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th scope="col">Mês</Table.Th>
                    <Table.Th scope="col">Sem a compra</Table.Th>
                    <Table.Th scope="col">Com a compra</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {result.monthly.months
                    .slice(startRow, startRow + monthsPerPage)
                    .map(({ month, baseline, projected }) => (
                      <Table.Tr key={month}>
                        <Table.Th scope="row">
                          {monthLabel(month, true)}
                        </Table.Th>
                        <Table.Td>{money(baseline)}</Table.Td>
                        <Table.Td>
                          <strong
                            className={projected < 0 ? "negative" : undefined}
                          >
                            {money(projected)}
                          </strong>
                          {projected !== baseline && (
                            <small>
                              <span className="sr-only">Diferença </span>
                              {money(projected - baseline)}
                            </small>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
              {result.monthly.months.length > monthsPerPage && (
                <Pagination
                  className="purchase-pagination"
                  size="sm"
                  value={page}
                  onChange={setPage}
                  total={Math.ceil(
                    result.monthly.months.length / monthsPerPage,
                  )}
                  siblings={0}
                  boundaries={0}
                  getItemProps={(value) => ({
                    "aria-label": `Período ${value}`,
                  })}
                  getControlProps={(control) => ({
                    "aria-label":
                      control === "previous"
                        ? "Seis meses anteriores"
                        : "Seis meses seguintes",
                  })}
                />
              )}
            </>
          ) : (
            <p className="purchase-empty">
              Preencha os dados da compra para ver quanto sobraria nos próximos
              meses.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
