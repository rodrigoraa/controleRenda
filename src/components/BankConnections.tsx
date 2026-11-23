import { Landmark } from "lucide-react";
import { Alert } from "@mantine/core";
import {
  bankNames,
  isUnassignedBankPurchase,
  type BankAccount,
  type BankResult,
} from "../lib/bank-feed";
import { dateLabel, money } from "../lib/finance";
import type { useBankConnections } from "../lib/use-bank-connections";
import {
  BankPurchaseOwnerSelect,
  type SaveBankPurchaseOwner,
} from "./BankPurchaseOwnerSelect";
import type { Person } from "../lib/types";
import "../ui/banks.css";

const statusMessages: Record<Exclude<BankResult["status"], "ready">, string> = {
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

function AccountReadout({
  account,
  index,
  people,
  onSave,
}: {
  account: BankAccount;
  index: number;
  people: Person[] | undefined;
  onSave: SaveBankPurchaseOwner;
}) {
  const unidentified =
    account.kind === "credit"
      ? account.transactions.filter(isUnassignedBankPurchase).length
      : 0;
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
                  <BankPurchaseOwnerSelect
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
  connection: { view, failed, listChanged, assign },
  people,
}: {
  connection: ReturnType<typeof useBankConnections>;
  people?: Person[];
}) {
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
          <div className="bank-list">
            {view.banks.map((bank) => (
              <section className="bank-institution" key={bank.institution}>
                <h3>{bankNames[bank.institution]}</h3>
                {bank.status !== "ready" && (
                  <p>{statusMessages[bank.status]}</p>
                )}
                {bank.providerUpdatedAt && (
                  <p>
                    Dados atualizados em{" "}
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
