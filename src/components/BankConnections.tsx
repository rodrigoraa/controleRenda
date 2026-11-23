import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { Alert } from "@mantine/core";
import { apiRequest } from "../lib/api";
import {
  bankNames,
  type BankAccount,
  type BankOverview,
  type BankResult,
} from "../lib/bank-feed";
import { dateLabel, money } from "../lib/finance";
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

function AccountReadout({
  account,
  index,
}: {
  account: BankAccount;
  index: number;
}) {
  return (
    <details className="bank-account">
      <summary>
        <span>
          {accountNames[account.kind]}
          {index > 0 && ` ${index + 1}`}
        </span>
        {account.balance !== null && <strong>{money(account.balance)}</strong>}
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
              <li key={`${transaction.date}-${index}`}>
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

export function BankConnections({ accountId }: { accountId: string }) {
  const [view, setView] = useState<BankOverview | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let pending = false;
    async function read() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const next = await apiRequest<BankOverview>(
          "/banks",
          "GET",
          undefined,
          accountId,
        );
        if (active) {
          setView(next);
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
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
  }, [accountId]);

  if (!view?.enabled) return null;
  return (
    <section
      className="panel bank-connections"
      aria-labelledby="bank-connections-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="bank-connections-title">Contas e cartões conectados</h2>
          <p>
            Consulta automática pelo MeuPluggy. Os dados ficam separados do
            orçamento.
          </p>
        </div>
        <Landmark size={22} aria-hidden="true" />
      </div>
      {failed ? (
        <Alert color="red" role="alert">
          Não foi possível consultar as conexões. A página tenta novamente
          automaticamente.
        </Alert>
      ) : view.status === "loading" ? (
        <p role="status">Consultando os dados disponíveis no MeuPluggy…</p>
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
