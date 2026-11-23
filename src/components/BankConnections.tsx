import { useEffect, useRef, useState } from "react";
import { Landmark } from "lucide-react";
import { Alert, NativeSelect } from "@mantine/core";
import { ApiError, apiRequest } from "../lib/api";
import {
  bankNames,
  type BankAccount,
  type BankOverview,
  type BankPurchaseOwner,
  type BankResult,
} from "../lib/bank-feed";
import { dateLabel, money } from "../lib/finance";
import { personOptions } from "../lib/people";
import type { Person } from "../lib/types";
import "../ui/banks.css";

const statusMessages: Record<BankResult["status"], string> = {
  ready: "Dados disponíveis",
  partial: "Parte dos dados ficou indisponível",
  empty: "Nenhuma conta ou cartão compatível retornado",
  pending: "O MeuPluggy está atualizando a conexão",
  reconnect: "Confira a autorização no MeuPluggy",
  unavailable: "Conexão indisponível",
};
const accountNames = {
  checking: "Conta",
  savings: "Poupança",
  credit: "Cartão de crédito",
};
const checkedAtFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

type SaveOwner = (key: string, owner: BankPurchaseOwner) => Promise<boolean>;
const pendingOwnerWrites = new Map<
  string,
  Promise<{ owner: BankPurchaseOwner }>
>();

function writePurchaseOwner(
  accountId: string,
  key: string,
  owner: BankPurchaseOwner,
) {
  const scope = `${accountId}:${key}`;
  const previous = pendingOwnerWrites.get(scope);
  const send = () =>
    apiRequest<{ owner: BankPurchaseOwner }>(
      `/banks/purchases/${key}/owner`,
      "PUT",
      { owner },
      accountId,
    );
  // Serialize writes even if navigation remounts the list before a response arrives.
  const pending = previous ? previous.then(send, send) : send();
  pendingOwnerWrites.set(scope, pending);
  const clear = () => {
    if (pendingOwnerWrites.get(scope) === pending)
      pendingOwnerWrites.delete(scope);
  };
  void pending.then(clear, clear);
  return pending;
}

function PurchaseOwnerSelect({
  transaction,
  people,
  onSave,
}: {
  transaction: BankAccount["transactions"][number] & { purchaseKey: string };
  people: Person[] | undefined;
  onSave: SaveOwner;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const owner = transaction.owner ?? "unknown";
  const options = [
    ...personOptions(people),
    { id: "other", name: "Outra pessoa (sem nome)" },
  ];
  async function assign(value: BankPurchaseOwner) {
    if (busy.current || value === owner) return;
    busy.current = true;
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      if (await onSave(transaction.purchaseKey, value))
        setMessage("Responsável salvo.");
    } catch {
      setFailed(true);
      setMessage("Não foi possível salvar. Tente de novo.");
    } finally {
      setSaving(false);
      busy.current = false;
    }
  }
  return (
    <div className="bank-owner" aria-busy={saving}>
      <NativeSelect
        label="Quem fez a compra?"
        aria-label={`Responsável por ${transaction.description}`}
        value={
          owner.startsWith("person_") && !options.some(({ id }) => id === owner)
            ? "other"
            : owner
        }
        onChange={(event) =>
          void assign(event.currentTarget.value as BankPurchaseOwner)
        }
        disabled={saving}
        data={options.map(({ id, name }) => ({ value: id, label: name }))}
      />
      {message && (
        <small
          role={failed ? "alert" : "status"}
          className={failed ? "negative" : undefined}
        >
          {message}
        </small>
      )}
    </div>
  );
}

function AccountReadout({
  account,
  index,
  people,
  onSave,
}: {
  account: BankAccount;
  index: number;
  people: Person[] | undefined;
  onSave: SaveOwner;
}) {
  const unidentified = account.transactions.filter(
    (transaction) =>
      transaction.purchaseKey && (transaction.owner ?? "unknown") === "unknown",
  ).length;
  return (
    <details className="bank-account">
      <summary>
        <span>
          {accountNames[account.kind]}
          {index > 0 && ` ${index + 1}`}
        </span>
        {account.balance !== null && <strong>{money(account.balance)}</strong>}
        {unidentified > 0 && <small>{unidentified} a identificar</small>}
      </summary>
      {account.kind === "credit" && (
        <div>
          <h4>Faturas informadas</h4>
          {account.bills.length ? (
            <ul>
              {account.bills.map((bill, index) => (
                <li key={`${bill.due}-${index}`}>
                  <span>Vencimento em {dateLabel(bill.due)}</span>
                  <strong>{money(bill.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma fatura disponível nesta consulta.</p>
          )}
        </div>
      )}
      <div>
        <h4>Movimentações recentes</h4>
        {account.transactions.length ? (
          <ul>
            {account.transactions.map((transaction, index) => (
              <li
                key={transaction.purchaseKey ?? `${transaction.date}-${index}`}
              >
                <span>
                  {transaction.description}
                  <small>
                    {dateLabel(transaction.date)}
                    {transaction.status === "PENDING" && " · Pendente"}
                  </small>
                </span>
                <strong>
                  {transaction.direction === "DEBIT" ? "−" : "+"}
                  {money(transaction.amount)}
                </strong>
                {account.kind === "credit" && transaction.purchaseKey && (
                  <PurchaseOwnerSelect
                    transaction={{
                      ...transaction,
                      purchaseKey: transaction.purchaseKey,
                    }}
                    people={people}
                    onSave={onSave}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma movimentação disponível nesta consulta.</p>
        )}
      </div>
    </details>
  );
}

export function BankConnections({
  accountId,
  people,
}: {
  accountId: string;
  people?: Person[];
}) {
  const [view, setView] = useState<BankOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [listChanged, setListChanged] = useState(false);
  const [readRequest, requestRead] = useState(0);
  const savedVersion = useRef(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    async function read() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      let version = savedVersion.current;
      try {
        const inProgress = [...pendingOwnerWrites.entries()]
          .filter(([scope]) => scope.startsWith(`${accountId}:`))
          .map(([, write]) => write);
        if (inProgress.length) await Promise.allSettled(inProgress);
        if (!active) return;
        version = savedVersion.current;
        const next = await apiRequest<BankOverview>(
          "/banks",
          "GET",
          undefined,
          accountId,
        );
        if (active && version === savedVersion.current) {
          setView(next);
          setFailed(false);
        }
      } catch {
        if (active && version === savedVersion.current) setFailed(true);
      } finally {
        pending = false;
      }
    }
    void read();
    const interval = setInterval(() => void read(), 60_000);
    window.addEventListener("focus", read);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", read);
    };
  }, [accountId, readRequest]);

  async function assign(key: string, owner: BankPurchaseOwner) {
    const saved = await writePurchaseOwner(accountId, key, owner).catch(
      (error: unknown) => {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        savedVersion.current += 1;
        setListChanged(true);
        requestRead((value) => value + 1);
        return null;
      },
    );
    if (!saved) return false;
    setListChanged(false);
    savedVersion.current += 1;
    setView((current) =>
      current?.enabled
        ? {
            ...current,
            banks: current.banks.map((bank) => ({
              ...bank,
              accounts: bank.accounts.map((account) => ({
                ...account,
                transactions: account.transactions.map((transaction) =>
                  transaction.purchaseKey === key
                    ? { ...transaction, owner: saved.owner }
                    : transaction,
                ),
              })),
            })),
          }
        : current,
    );
    return true;
  }

  return (
    <section
      className="panel bank-connections"
      aria-labelledby="bank-connections-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="bank-connections-title">Contas e cartões conectados</h2>
          <p>
            Estes são os valores informados pelos bancos. Você pode identificar
            as compras sem alterar o orçamento.
          </p>
        </div>
        <Landmark size={22} aria-hidden="true" />
      </div>
      {listChanged && (
        <Alert color="yellow" role="status" mb="md">
          A lista de compras mudou. Confira os dados atualizados antes de
          escolher de novo.
        </Alert>
      )}
      {failed ? (
        <Alert color="red" role="alert">
          Não foi possível consultar as conexões. A página tenta novamente
          automaticamente.
        </Alert>
      ) : view === null || (view.enabled && view.status === "loading") ? (
        <p role="status">Consultando os dados disponíveis no MeuPluggy…</p>
      ) : !view.enabled ? (
        <p className="bank-checked">
          Nenhuma conexão bancária disponível para este login.
        </p>
      ) : (
        <>
          {view.checkedAt && (
            <p className="bank-checked">
              Consultado pelo Controle Renda em{" "}
              {checkedAtFormatter.format(new Date(view.checkedAt))}
            </p>
          )}
          <div className="bank-list">
            {view.banks.map((bank) => (
              <section className="bank-institution" key={bank.institution}>
                <h3>{bankNames[bank.institution]}</h3>
                <p>{statusMessages[bank.status]}</p>
                {bank.providerUpdatedAt && (
                  <p>
                    Atualizado no MeuPluggy em{" "}
                    {checkedAtFormatter.format(
                      new Date(bank.providerUpdatedAt),
                    )}
                  </p>
                )}
                {bank.accounts.map((account, index) => (
                  <AccountReadout
                    key={`${account.kind}-${index}`}
                    account={account}
                    index={index}
                    people={people}
                    onSave={assign}
                  />
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
