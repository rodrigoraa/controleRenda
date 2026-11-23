import { useRef, useState } from "react";
import { NativeSelect } from "@mantine/core";
import type { BankPurchase, BankPurchaseOwner } from "../lib/bank-feed";
import { personOptions } from "../lib/people";
import type { Person } from "../lib/types";
import "../ui/banks.css";

export type SaveBankPurchaseOwner = (
  key: string,
  owner: BankPurchaseOwner,
) => Promise<boolean>;

export function BankPurchaseOwnerSelect({
  transaction,
  people,
  onSave,
}: {
  transaction: BankPurchase;
  people: Person[] | undefined;
  onSave: SaveBankPurchaseOwner;
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
