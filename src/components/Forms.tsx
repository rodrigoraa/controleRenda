import { useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Info } from "lucide-react";
import type { Entry, Occurrence, State, Transfer } from "../lib/types";
import {
  dateInMonth,
  moneyInput,
  parseMoney,
  monthOf,
  money,
} from "../lib/finance";
import { Modal } from "./Modal";
export function EntryForm({
  month,
  today,
  state,
  editing,
  onSave,
  onClose,
}: {
  month: string;
  today: string;
  state: State;
  editing?: Occurrence;
  onSave: (entry: Entry, count: number, settled: boolean) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Entry["kind"]>(editing?.kind ?? "expense");
  const [method, setMethod] = useState<Entry["method"]>(
    editing?.method ?? "account",
  );
  const [owner, setOwner] = useState<Entry["owner"]>(editing?.owner ?? "me");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState(
    editing ? moneyInput(editing.amount) : "",
  );
  const [date, setDate] = useState(
    editing?.date ?? dateInMonth(month, Number(today.slice(8))),
  );
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
    );
  };
  return (
    <Modal
      title={editing ? "Editar lançamento" : "Novo lançamento"}
      subtitle={
        editing
          ? "A alteração vale somente para este mês."
          : "Poucos detalhes. Tudo organizado."
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-content">
        {!editing && (
          <div className="kind-toggle">
            <button
              type="button"
              className={kind === "expense" ? "active expense" : ""}
              onClick={() => {
                setKind("expense");
                setCategory("Outros");
              }}
            >
              <ArrowUpRight size={17} />
              Despesa
            </button>
            <button
              type="button"
              className={kind === "income" ? "active income" : ""}
              onClick={() => {
                setKind("income");
                setMethod("account");
                setCount(1);
                setCategory("Outros");
              }}
            >
              <ArrowDownLeft size={17} />
              Receita
            </button>
          </div>
        )}
        <label>
          Descrição
          <input
            required
            maxLength={120}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              kind === "income"
                ? "Ex.: pagamento do sistema"
                : "Ex.: supermercado"
            }
          />
        </label>
        <div className="form-grid">
          <label>
            {method === "card" && count > 1
              ? "Valor total da compra (R$)"
              : "Valor (R$)"}
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </label>
          <label>
            {method === "card" ? "Data na primeira fatura" : "Data prevista"}
            <input
              required
              type="date"
              min={`${state.settings.initialMonth}-01`}
              max="2099-12-31"
              value={date}
              disabled={!!editing}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        {kind === "expense" && (
          <div className="form-grid">
            <label>
              Forma de pagamento
              <select
                value={method}
                disabled={!!editing}
                onChange={(e) => {
                  setMethod(e.target.value as Entry["method"]);
                  if (e.target.value === "account") setCount(1);
                }}
              >
                <option value="account">Pix, débito ou dinheiro</option>
                <option value="card">Cartão de crédito</option>
              </select>
            </label>
            {method === "card" && (
              <label>
                Responsável
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value as Entry["owner"])}
                >
                  <option value="me">Eu</option>
                  <option value="mother">Minha mãe</option>
                  <option value="unknown">A identificar</option>
                </select>
              </label>
            )}
          </div>
        )}
        <div className="form-grid">
          <label>
            Categoria
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[...new Set([...categories, category])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Repetição
            <select
              value={repeat}
              disabled={!!editing || count > 1}
              onChange={(e) => setRepeat(e.target.value as Entry["repeat"])}
            >
              <option value="none">Só desta vez</option>
              <option value="monthly">Todo mês</option>
            </select>
          </label>
        </div>
        {method === "card" &&
          kind === "expense" &&
          !editing &&
          repeat === "none" && (
            <label>
              Parcelas
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option value={i + 1} key={i}>
                    {i === 0 ? "À vista" : `${i + 1} parcelas`}
                  </option>
                ))}
              </select>
            </label>
          )}
        {method === "card" && (
          <p className="field-note">
            <Info size={16} />O mês da data escolhida é o mês da fatura. As
            parcelas seguintes entram nos próximos meses.
          </p>
        )}
        {!editing && method === "account" && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settled}
              onChange={(e) => setSettled(e.target.checked)}
            />
            {kind === "income"
              ? "Já recebi este valor"
              : "Já paguei este valor"}
            <small>Registrar com a data de hoje.</small>
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer className="form-footer">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" type="submit">
            Salvar lançamento
          </button>
        </footer>
      </form>
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
      <form onSubmit={submit} className="form-content">
        <div className="form-grid">
          <label>
            Mês inicial
            <input
              type="month"
              min="2000-01"
              max="2099-11"
              required
              value={month}
              disabled={hasData}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <label>
            Saldo no início desse mês (R$)
            <input
              required
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </label>
        </div>
        <p className="field-note">
          <Info size={16} />
          Use o saldo que você tinha antes das entradas e saídas do mês inicial.
          Cadastre os movimentos desse mês para não contar valores duas vezes.
        </p>
        <div className="form-grid">
          <label>
            Nome do cartão
            <input
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Dia de vencimento da fatura
            <input
              type="number"
              min="1"
              max="31"
              required
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            />
          </label>
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
        <footer className="form-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary">Salvar configurações</button>
        </footer>
      </form>
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
      <form className="form-content" onSubmit={submit}>
        <label>
          Valor recebido ou pago (R$)
          <input
            inputMode="decimal"
            required
            value={amount}
            disabled={mode === "settle"}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Data da movimentação
          <input
            type="date"
            required
            min={`${initialMonth}-01`}
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <footer className="form-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary">
            {isPayment
              ? "Confirmar pagamento"
              : mode === "reimbursement"
                ? "Confirmar recebimento"
                : "Confirmar movimentação"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
