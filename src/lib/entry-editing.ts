import type { Entry, Occurrence, State } from "./types";
import { monthOf, occurrences } from "./finance";
import { parseBackup } from "./validation";
function applyInstallmentOwner(
  state: State,
  group: string,
  owner: Entry["owner"],
) {
  const ids = new Set(
    state.entries
      .filter(
        (entry) =>
          entry.method === "card" && entry.installment?.group === group,
      )
      .map((entry) => entry.id),
  );
  state.entries = state.entries.map((entry) =>
    ids.has(entry.id) ? { ...entry, owner } : entry,
  );
  for (const [key, override] of Object.entries(state.overrides)) {
    if (ids.has(key.slice(0, -8)))
      state.overrides[key] = { ...override, owner };
  }
}

/** A purchase has one owner across its installments; ungrouped entries keep occurrence-level assignment. */
export function assignOccurrenceOwner(
  state: State,
  row: Occurrence,
  owner: Entry["owner"],
): State {
  const current = occurrences(state, row.month).find(
    (entry) => entry.key === row.key,
  );
  if (!current || current.method !== "card")
    throw new Error(
      "Este lançamento foi alterado ou removido. Abra o item novamente.",
    );
  const next = structuredClone(state);
  if (current.installment)
    applyInstallmentOwner(next, current.installment.group, owner);
  else
    next.overrides[current.key] = {
      description: current.description,
      amount: current.amount,
      category: current.category,
      owner,
    };
  return parseBackup(JSON.stringify(next));
}

/** Edits only this occurrence's fields, except ownership changes shared by the purchase's installments. */
export function editOccurrence(
  state: State,
  row: Occurrence,
  updated: Entry,
  settledOn?: string,
): State {
  const current = occurrences(state, row.month).find(
    (item) => item.key === row.key,
  );
  const original = state.entries.find((item) => item.id === row.id);
  if (
    !current ||
    !original ||
    current.date !== row.date ||
    current.settledOn !== row.settledOn ||
    current.owner !== row.owner
  )
    throw new Error(
      "Este lançamento foi alterado ou removido. Feche a edição e abra o item novamente.",
    );
  const next = structuredClone(state);
  const fields = {
    description: updated.description,
    amount: updated.amount,
    owner: updated.owner,
    category: updated.category,
  };
  const confirmation = state.settled[row.key];
  const actualDate = confirmation
    ? (settledOn ?? confirmation.date)
    : undefined;
  if (updated.date === current.date) {
    next.overrides[row.key] = fields;
    if (confirmation) next.settled[row.key] = { date: actualDate! };
  } else {
    delete next.overrides[row.key];
    delete next.settled[row.key];
    let targetId = original.id;
    if (original.repeat === "monthly") {
      // A dated exception must not change the recurring schedule or collide with another month.
      next.skipped.push(row.key);
      targetId = crypto.randomUUID();
      next.entries.push({
        id: targetId,
        ...fields,
        date: updated.date,
        kind: original.kind,
        method: original.method,
        repeat: "none",
      });
    } else {
      next.entries = next.entries.map((item) =>
        item.id === original.id
          ? {
              id: item.id,
              ...fields,
              date: updated.date,
              kind: item.kind,
              method: item.method,
              repeat: "none",
              ...(item.installment ? { installment: item.installment } : {}),
            }
          : item,
      );
    }
    if (confirmation)
      next.settled[`${targetId}:${monthOf(updated.date)}`] = {
        date: actualDate!,
      };
  }
  if (original.installment && updated.owner !== current.owner)
    applyInstallmentOwner(next, original.installment.group, updated.owner);
  return parseBackup(JSON.stringify(next));
}
