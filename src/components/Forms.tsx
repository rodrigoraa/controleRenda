import { useState, type FormEvent } from "react";
import { Button, Checkbox, NativeSelect, TextInput } from "@mantine/core";
import { ValidatedForm } from "../ui/ValidatedForm";
import { ArrowDownLeft, ArrowUpRight, Info } from "lucide-react";
import type { Entry, Occurrence, State, Transfer } from "../lib/types";
import {
  dateInMonth,
  moneyInput,
  parseMoney,
  monthOf,
  money,
  addMonths,
  monthLabel,
} from "../lib/finance";
import { Modal } from "./Modal";
import { PersonCreator, type AddPerson } from "./PersonControls";
import { personOptions } from "../lib/people";
export function EntryForm({
  month,
  today,
  state,
  editing,
  initialMethod = "account",
  onSave,
  onClose,
  onAddPerson,
}: {
  month: string;
  today: string;
  state: State;
  editing?: Occurrence;
  initialMethod?: Entry["method"];
  onSave: (
    entry: Entry,
    count: number,
    settled: boolean,
    settledOn?: string,
  ) => void;
  onClose: () => void;
  onAddPerson?: AddPerson;
}) {
  const [kind, setKind] = useState<Entry["kind"]>(editing?.kind ?? "expense");
  const [method, setMethod] = useState<Entry["method"]>(
    editing?.method ?? initialMethod,
  );
  const [owner, setOwner] = useState<Entry["owner"]>(editing?.owner ?? "me");
  const [addingPerson, setAddingPerson] = useState(false);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState(
    editing ? moneyInput(editing.amount) : "",
  );
  const [date, setDate] = useState(
    editing?.date ?? dateInMonth(month, Number(today.slice(8))),
  );
  const [confirmedDate, setConfirmedDate] = useState(editing?.settledOn ?? "");
  const [category, setCategory] = useState(editing?.category ?? "Outros");
  const [repeat, setRepeat] = useState<Entry["repeat"]>(
    editing?.repeat ?? "none",
  );
  const [count, setCount] = useState(1),
    [settled, setSettled] = useState(false),
    [error, setError] = useState("");
  const categories =
    kind === "income"
      ? ["Salário", "Bolsa", "Sistema vendido", "Outros"]
      : [
          "Alimentação",
          "Moradia",
          "Transporte",
          "Saúde",
          "Estudos",
          "Lazer",
          "Compras",
          "Contas",
          "Outros",
        ];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!description.trim())
      return setError("Informe uma descrição para o lançamento.");
    if (cents === null || cents <= 0)
      return setError(
        "Informe um valor maior que zero, com até duas casas decimais.",
      );
    if (monthOf(date) < state.settings.initialMonth)
      return setError(
        "A data precisa estar no mês inicial do controle ou depois dele.",
      );
    if (cents < count)
      return setError("O total deve ser de pelo menos um centavo por parcela.");
    onSave(
      {
        id: editing?.id ?? crypto.randomUUID(),
        description: description.trim(),
        amount: cents,
        date,
        kind,
        method: kind === "income" ? "account" : method,
        owner: kind === "income" || method === "account" ? "me" : owner,
        category,
        repeat: method === "card" && count > 1 ? "none" : repeat,
        ...(editing?.installment ? { installment: editing.installment } : {}),
      },
      count,
      settled,
      editing?.settledOn ? confirmedDate : undefined,
    );
  };
  return (
    <Modal
      title={editing ? "Editar lançamento" : "Novo lançamento"}
      subtitle={
        editing
          ? editing.installment
            ? "Data e valor valem só para esta parcela. Mudar o responsável vale para toda a compra."
            : "Altere este lançamento. Outros meses mantêm os dados cadastrados."
          : "Poucos detalhes. Tudo organizado."
      }
      onClose={onClose}
    >
      <ValidatedForm onSubmit={submit} className="cr-form">
        {!editing && (
          <div className="cr-kind-toggle">
            <Button
              type="button"
              variant={kind === "expense" ? "white" : "subtle"}
              aria-pressed={kind === "expense"}
              onClick={() => {
                setKind("expense");
                setCategory("Outros");
              }}
            >
              <ArrowUpRight size={17} />
              Despesa
            </Button>
            <Button
              type="button"
              variant={kind === "income" ? "white" : "subtle"}
              aria-pressed={kind === "income"}
              onClick={() => {
                setKind("income");
                setMethod("account");
                setCount(1);
                setCategory("Outros");
              }}
            >
              <ArrowDownLeft size={17} />
              Receita
            </Button>
          </div>
        )}
        <TextInput
          className="cr-field"
          withAsterisk={false}
          label={<>Descrição</>}
          required
          maxLength={120}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="next"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            kind === "income"
              ? "Ex.: pagamento do sistema"
              : "Ex.: supermercado"
          }
        />
        <div className="cr-form-grid">
          <TextInput
            className="cr-field"
            withAsterisk={false}
            label={
              <>
                {method === "card" && count > 1
                  ? "Valor total da compra (R$)"
                  : "Valor (R$)"}
              </>
            }
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
          />
          <TextInput
            className="cr-field"
            withAsterisk={false}
            label={
              <>
                {method === "card"
                  ? editing
                    ? "Data na fatura"
                    : "Data na primeira fatura"
                  : "Data prevista"}
              </>
            }
            required
            type="date"
            min={`${state.settings.initialMonth}-01`}
            max="2099-12-31"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {editing?.settledOn && (
          <>
            <TextInput
              className="cr-field"
              withAsterisk={false}
              label={
                <>
                  {kind === "income"
                    ? "Data do recebimento"
                    : "Data do pagamento"}
                </>
              }
              type="date"
              required
              min={`${state.settings.initialMonth}-01`}
              max={today}
              value={confirmedDate}
              onChange={(e) => setConfirmedDate(e.target.value)}
            />
            <p className="field-note">
              A data prevista organiza o orçamento. A data da movimentação
              informa quando o dinheiro realmente entrou ou saiu.
            </p>
          </>
        )}
        {editing?.repeat === "monthly" && (
          <p className="field-note">
            <Info size={16} />A mudança de data vale só para este lançamento. Os
            próximos meses continuam na data original.
          </p>
        )}
        {editing?.installment && (
          <p className="field-note">
            <Info size={16} />
            Data e valor mudam só nesta parcela. Ao alterar o responsável, ele
            será aplicado a todas as parcelas desta compra. Pagamentos e
            repasses já registrados são mantidos.
          </p>
        )}
        {kind === "expense" && (
          <div className="cr-form-grid">
            <NativeSelect
              className="cr-field"
              label={<>Forma de pagamento</>}
              value={method}
              disabled={!!editing}
              onChange={(e) => {
                setMethod(e.target.value as Entry["method"]);
                if (e.target.value === "account") setCount(1);
              }}
            >
              <option value="account">Pix, débito ou dinheiro</option>
              <option value="card">Cartão de crédito</option>
            </NativeSelect>
            {method === "card" && (
              <div className="person-field">
                <NativeSelect
                  className="cr-field"
                  label={<>Responsável</>}
                  value={owner}
                  onChange={(e) => setOwner(e.target.value as Entry["owner"])}
                >
                  {personOptions(state.people).map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </NativeSelect>
                {onAddPerson && !addingPerson && (
                  <Button
                    type="button"
                    variant="subtle"
                    className="cr-add-person"
                    onClick={() => setAddingPerson(true)}
                  >
                    Adicionar pessoa
                  </Button>
                )}
                {onAddPerson && addingPerson && (
                  <PersonCreator
                    onAdd={onAddPerson}
                    onCreated={(person) => {
                      setOwner(person.id);
                      setAddingPerson(false);
                    }}
                    onCancel={() => setAddingPerson(false)}
                  />
                )}
              </div>
            )}
          </div>
        )}
        <div className="cr-form-grid">
          <NativeSelect
            className="cr-field"
            label={<>Categoria</>}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[...new Set([...categories, category])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
          <NativeSelect
            className="cr-field"
            label={<>Repetição</>}
            value={repeat}
            disabled={!!editing || count > 1}
            onChange={(e) => setRepeat(e.target.value as Entry["repeat"])}
          >
            <option value="none">Só desta vez</option>
            <option value="monthly">Todo mês</option>
          </NativeSelect>
        </div>
        {!editing && repeat === "monthly" && (
          <div className="recurrence-start">
            <p className="field-note">
              {kind === "income"
                ? "Primeiro recebimento"
                : "Primeiro lançamento"}{" "}
              em{" "}
              {date
                ? `${date.slice(8)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
                : "uma data a definir"}
              .
              {date &&
                ` Depois, uma vez por mês, a partir de ${monthLabel(monthOf(date))}. O valor não entra nos meses anteriores.`}
            </p>
            {addMonths(monthOf(today), 1) >= state.settings.initialMonth && (
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  setDate(
                    dateInMonth(
                      addMonths(monthOf(today), 1),
                      Number((date || today).slice(8)),
                    ),
                  );
                  setSettled(false);
                }}
              >
                A partir do próximo mês
              </Button>
            )}
          </div>
        )}
        {method === "card" &&
          kind === "expense" &&
          !editing &&
          repeat === "none" && (
            <NativeSelect
              className="cr-field"
              label={<>Parcelas</>}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option value={i + 1} key={i}>
                  {i === 0 ? "À vista" : `${i + 1} parcelas`}
                </option>
              ))}
            </NativeSelect>
          )}
        {method === "card" && (
          <p className="field-note">
            <Info size={16} />
            {editing
              ? "O mês da data escolhida define a fatura desta compra. Pagamentos e repasses já registrados permanecem na fatura original."
              : "O mês da data escolhida é o mês da fatura. As parcelas seguintes entram nos próximos meses."}
          </p>
        )}
        {!editing && method === "card" && count > 1 && (
          <p className="field-note">
            O responsável escolhido vale para todas as {count} parcelas desta
            compra.
          </p>
        )}
        {!editing && method === "account" && (
          <Checkbox
            className="cr-checkbox"
            checked={settled}
            onChange={(e) => setSettled(e.target.checked)}
            label={
              kind === "income"
                ? "Já recebi este valor"
                : "Já paguei este valor"
            }
            description="Registrar com a data de hoje."
          />
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer className="cr-form-footer">
          <Button variant="default" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="filled" type="submit">
            Salvar lançamento
          </Button>
        </footer>
      </ValidatedForm>
    </Modal>
  );
}
export function BalanceForm({
  current,
  onSave,
  onClose,
}: {
  current: number;
  onSave: (amount: number) => void;
  onClose: () => void;
}) {
  const [balance, setBalance] = useState(moneyInput(current));
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const negative = balance.trim().startsWith("-");
    const value = parseMoney(balance.trim().replace(/^-/, "").trim());
    if (value === null) return setError("Informe um saldo válido.");
    onSave(negative ? -value : value);
  }
  return (
    <Modal
      title="Saldo da conta hoje"
      subtitle="Informe o valor que aparece agora no aplicativo do seu banco."
      onClose={onClose}
    >
      <ValidatedForm className="cr-form" onSubmit={submit}>
        <TextInput
          className="cr-field"
          withAsterisk={false}
          label={<>Saldo na conta hoje (R$)</>}
          required
          inputMode="decimal"
          value={balance}
          onChange={(event) => setBalance(event.target.value)}
        />
        <Checkbox
          className="cr-checkbox"
          checked={balance.trim().startsWith("-")}
          onChange={(event) => {
            const unsigned = balance.trim().replace(/^-/, "").trim() || "0";
            setBalance(event.target.checked ? `-${unsigned}` : unsigned);
          }}
          label="Saldo negativo"
        />
        <p className="field-note">
          O ajuste considera as movimentações já confirmadas e corrige o ponto
          de partida, sem registrar uma nova receita. Você pode informar zero ou
          um saldo negativo.
        </p>
        <p className="field-note">
          Lançamentos pendentes continuam nas previsões. Se um valor já entrou
          ou saiu da conta, confirme esse lançamento antes de ajustar o saldo.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <footer className="cr-form-footer">
          <Button type="button" variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="filled" type="submit">
            Salvar saldo atual
          </Button>
        </footer>
      </ValidatedForm>
    </Modal>
  );
}
export function SettingsForm({
  state,
  onSave,
  onClose,
}: {
  state: State;
  onSave: (settings: State["settings"]) => void;
  onClose: () => void;
}) {
  const [balance, setBalance] = useState(
      moneyInput(state.settings.openingBalance),
    ),
    [month, setMonth] = useState(state.settings.initialMonth),
    [day, setDay] = useState(state.settings.invoiceDay),
    [name, setName] = useState(state.settings.cardName),
    [error, setError] = useState("");
  const hasData =
    state.entries.length > 0 ||
    state.payments.length > 0 ||
    state.reimbursements.length > 0;
  function submit(e: FormEvent) {
    e.preventDefault();
    const negative = balance.trim().startsWith("-"),
      value = parseMoney(balance.trim().replace(/^-/, "").trim());
    if (value === null) return setError("Informe um saldo válido.");
    onSave({
      initialMonth: month,
      openingBalance: negative ? -value : value,
      invoiceDay: day,
      cardName: name.trim(),
    });
  }
  return (
    <Modal
      title="Ajustar meu controle"
      subtitle="Você pode mudar estes detalhes quando precisar."
      onClose={onClose}
    >
      <ValidatedForm onSubmit={submit} className="cr-form">
        <div className="cr-form-grid">
          <TextInput
            className="cr-field"
            withAsterisk={false}
            label={<>Mês inicial</>}
            type="month"
            min="2000-01"
            max="2099-11"
            required
            value={month}
            disabled={hasData}
            onChange={(e) => setMonth(e.target.value)}
          />
          <TextInput
            className="cr-field"
            withAsterisk={false}
            label={<>Saldo no início desse mês (R$)</>}
            required
            inputMode="decimal"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </div>
        <p className="field-note">
          <Info size={16} />
          Use o saldo que você tinha antes das entradas e saídas do mês inicial.
          Cadastre os movimentos desse mês para não contar valores duas vezes.
        </p>
        <div className="cr-form-grid">
          <TextInput
            className="cr-field"
            withAsterisk={false}
            label={<>Nome do cartão</>}
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextInput
            className="cr-field"
            withAsterisk={false}
            label={<>Dia de vencimento da fatura</>}
            type="number"
            min="1"
            max="31"
            required
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
          />
        </div>
        <p className="field-note">
          O repasse pendente da sua mãe é previsto para o vencimento. Confirme o
          recebimento quando o Pix entrar.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <footer className="cr-form-footer">
          <Button type="button" variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="filled" type="submit">
            Salvar configurações
          </Button>
        </footer>
      </ValidatedForm>
    </Modal>
  );
}
export function TransferForm({
  mode,
  maximum,
  month,
  today,
  initialMonth,
  onSave,
  onClose,
}: {
  mode: "payment" | "reimbursement" | "settle";
  maximum: number;
  month: string;
  today: string;
  initialMonth: string;
  onSave: (value: Transfer) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(moneyInput(maximum)),
    [date, setDate] = useState(today),
    [error, setError] = useState("");
  const isPayment = mode === "payment";
  function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (cents === null || cents <= 0 || cents > maximum)
      return setError(`Informe um valor entre R$ 0,01 e ${money(maximum)}.`);
    onSave({ id: crypto.randomUUID(), month, amount: cents, date });
  }
  return (
    <Modal
      title={
        isPayment
          ? "Registrar pagamento da fatura"
          : mode === "reimbursement"
            ? "Registrar repasse"
            : "Confirmar movimentação"
      }
      subtitle={
        mode === "settle"
          ? "Confirme o dia em que o dinheiro entrou ou saiu."
          : "Registre somente o valor que realmente foi transferido."
      }
      onClose={onClose}
    >
      <ValidatedForm className="cr-form" onSubmit={submit}>
        <TextInput
          className="cr-field"
          withAsterisk={false}
          label={<>Valor recebido ou pago (R$)</>}
          inputMode="decimal"
          required
          value={amount}
          disabled={mode === "settle"}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextInput
          className="cr-field"
          withAsterisk={false}
          label={<>Data da movimentação</>}
          type="date"
          required
          min={`${initialMonth}-01`}
          max={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <footer className="cr-form-footer">
          <Button type="button" variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="filled" type="submit">
            {isPayment
              ? "Confirmar pagamento"
              : mode === "reimbursement"
                ? "Confirmar recebimento"
                : "Confirmar movimentação"}
          </Button>
        </footer>
      </ValidatedForm>
    </Modal>
  );
}
