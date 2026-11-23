import { useEffect, useRef, useState } from "react";
import { ApiError, apiRequest } from "./api";
import type { BankOverview, BankPurchaseOwner } from "./bank-feed";

const pendingBankReads = new Map<
  string,
  { response: Promise<BankOverview>; outdated: boolean }
>();

function readBankOverview(accountId: string): Promise<BankOverview> {
  const pending = pendingBankReads.get(accountId);
  if (pending) {
    if (!pending.outdated) return pending.response;
    const readAgain = () => readBankOverview(accountId);
    return pending.response.then(readAgain, readAgain);
  }
  const response = apiRequest<BankOverview>(
    "/banks",
    "GET",
    undefined,
    accountId,
  );
  pendingBankReads.set(accountId, { response, outdated: false });
  const clear = () => pendingBankReads.delete(accountId);
  void response.then(clear, clear);
  return response;
}

function invalidateBankRead(accountId: string) {
  const pending = pendingBankReads.get(accountId);
  if (pending) pending.outdated = true;
}

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

const disabledView: BankOverview = { enabled: false };

export function useBankConnections(
  accountId: string | undefined,
  poll: boolean,
) {
  const [result, setResult] = useState<{
    accountId: string;
    view: BankOverview | null;
    failed: boolean;
  }>();
  const [changedAccount, setChangedAccount] = useState<string | null>(null);
  const [readRequest, requestRead] = useState(0);
  const savedVersion = useRef(0);
  useEffect(() => {
    if (!accountId || !poll) return;
    let active = true;
    let pending = false;
    const read = async () => {
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
        const next = await readBankOverview(accountId);
        if (active && version === savedVersion.current) {
          setResult({ accountId, view: next, failed: false });
          setChangedAccount((current) =>
            current === accountId ? null : current,
          );
        }
      } catch {
        if (active && version === savedVersion.current) {
          setResult((current) => ({
            accountId,
            view: current?.accountId === accountId ? current.view : null,
            failed: true,
          }));
        }
      } finally {
        pending = false;
      }
    };
    void read();
    const interval = setInterval(() => void read(), 60_000);
    window.addEventListener("focus", read);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", read);
    };
  }, [accountId, poll, readRequest]);

  async function assign(key: string, owner: BankPurchaseOwner) {
    if (!accountId) return false;
    const saved = await writePurchaseOwner(accountId, key, owner).catch(
      (error: unknown) => {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        invalidateBankRead(accountId);
        savedVersion.current += 1;
        setChangedAccount(accountId);
        requestRead((value) => value + 1);
        return null;
      },
    );
    if (!saved) return false;
    invalidateBankRead(accountId);
    setChangedAccount((current) => (current === accountId ? null : current));
    savedVersion.current += 1;
    setResult((current) => {
      if (current?.accountId !== accountId || !current.view?.enabled)
        return current;
      return {
        ...current,
        view: {
          ...current.view,
          banks: current.view.banks.map((bank) => ({
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
        },
      };
    });
    return true;
  }

  const current = result?.accountId === accountId ? result : undefined;
  return {
    view: accountId ? (current?.view ?? null) : disabledView,
    failed: current?.failed ?? false,
    listChanged: accountId !== undefined && changedAccount === accountId,
    assign,
  };
}
