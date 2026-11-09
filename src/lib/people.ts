import type { Owner, Person, State } from "./types";
import { parseBackup } from "./validation";
export const basePeople: { id: Owner; name: string }[] = [
  { id: "me", name: "Eu" },
  { id: "mother", name: "Minha mãe" },
  { id: "unknown", name: "A identificar" },
];
const normalizedName = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ");
export function personOptions(people: Person[] = []) {
  return [...basePeople, ...people];
}
export function personName(people: Person[] | undefined, owner: Owner): string {
  return (
    personOptions(people).find((person) => person.id === owner)?.name ??
    "Pessoa não cadastrada"
  );
}
export function addPersonToBudget(
  state: State,
  input: string,
): { state: State; person: Person } {
  const name = normalizedName(input);
  if (!name || name.length > 60)
    throw new Error("Informe um nome de 1 a 60 caracteres.");
  if (
    personOptions(state.people).some(
      (person) =>
        normalizedName(person.name).toLocaleLowerCase("pt-BR") ===
        name.toLocaleLowerCase("pt-BR"),
    )
  )
    throw new Error(
      "Essa pessoa já está cadastrada. Selecione o nome na lista.",
    );
  if ((state.people?.length ?? 0) >= 100)
    throw new Error("O limite é de 100 pessoas cadastradas.");
  const person: Person = { id: `person_${crypto.randomUUID()}`, name };
  const next = parseBackup(
    JSON.stringify({ ...state, people: [...(state.people ?? []), person] }),
  );
  return { state: next, person };
}
