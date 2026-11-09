import type { Entry, Occurrence, State } from "./types";
import { monthOf, occurrences } from "./finance";
import { parseBackup } from "./validation";
/** Changes only the chosen occurrence, keeping real cash movements and other installments. */
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
    current.settledOn !== row.settledOn
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
  return parseBackup(JSON.stringify(next));
}
