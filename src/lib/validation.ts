import { z } from "zod";
import type { State, Person } from "./types";
import { monthOf } from "./finance";
const month = z.string().regex(/^(20\d{2})-(0[1-9]|1[0-2])$/);
const date = z
  .string()
  .regex(/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
const amount = z.number().int().positive().max(100_000_000_000);
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const personId = z
  .string()
  .regex(/^person_[a-zA-Z0-9_-]{1,80}$/)
  .transform((value) => value as Person["id"]);
const owner = z.union([z.enum(["me", "mother", "unknown"]), personId]);
const editable = {
  description: z.string().trim().min(1).max(120),
  amount,
  owner,
  category: z.string().trim().min(1).max(50),
};
const entry = z
  .object({
    id,
    ...editable,
    date,
    kind: z.enum(["income", "expense"]),
    method: z.enum(["account", "card"]),
    repeat: z.enum(["none", "monthly"]),
    endMonth: month.optional(),
    installment: z
      .object({
        index: z.number().int().min(1).max(120),
        total: z.number().int().min(1).max(120),
        group: id,
      })
      .optional(),
  })
  .strict()
  .refine((e) => e.method !== "card" || e.kind === "expense")
  .refine((e) => e.method !== "account" || e.owner === "me")
  .refine((e) => !e.endMonth || e.endMonth >= monthOf(e.date))
  .refine(
    (e) =>
      !e.installment ||
      (e.installment.index <= e.installment.total &&
        e.repeat === "none" &&
        e.method === "card"),
  );
const transfer = z.object({ id, month, amount, date }).strict();
const schema = z
  .object({
    version: z.literal(1),
    people: z
      .array(
        z
          .object({ id: personId, name: z.string().trim().min(1).max(60) })
          .strict(),
      )
      .max(100)
      .optional(),
    settings: z
      .object({
        initialMonth: month,
        openingBalance: z
          .number()
          .int()
          .min(-100_000_000_000)
          .max(100_000_000_000),
        invoiceDay: z.number().int().min(1).max(31),
        cardName: z.string().trim().min(1).max(40),
      })
      .strict(),
    entries: z.array(entry).max(10000),
    overrides: z.record(z.string(), z.object(editable).strict()),
    skipped: z.array(z.string()).max(50000),
    settled: z.record(z.string(), z.object({ date }).strict()),
    payments: z.array(transfer).max(10000),
    reimbursements: z.array(transfer).max(10000),
  })
  .strict()
  .superRefine((s, ctx) => {
    const issue = () =>
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Referências ou períodos inconsistentes no backup.",
      });
    const ids = s.entries.map((e) => e.id);
    const people = s.people ?? [];
    const peopleIds = new Set(people.map((person) => person.id));
    const names = people.map((person) =>
      person.name
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("pt-BR"),
    );
    if (
      peopleIds.size !== people.length ||
      new Set(names).size !== names.length ||
      names.some((name) => ["eu", "minha mãe", "a identificar"].includes(name))
    )
      issue();
    const knownOwner = (value: string) =>
      ["me", "mother", "unknown"].includes(value) ||
      peopleIds.has(value as Person["id"]);
    if (
      s.entries.some((entry) => !knownOwner(entry.owner)) ||
      Object.values(s.overrides).some((override) => !knownOwner(override.owner))
    )
      issue();
    const entriesById = new Map(s.entries.map((e) => [e.id, e]));
    if (new Set(s.skipped).size !== s.skipped.length) issue();
    if (new Set(ids).size !== ids.length) issue();
    for (const records of [s.payments, s.reimbursements])
      if (new Set(records.map((r) => r.id)).size !== records.length) issue();
    if (s.entries.some((e) => monthOf(e.date) < s.settings.initialMonth))
      issue();
    if (
      [...s.payments, ...s.reimbursements].some(
        (t) =>
          t.month < s.settings.initialMonth ||
          monthOf(t.date) < s.settings.initialMonth,
      )
    )
      issue();
    const lookup = (key: string) => {
      if (key.at(-8) !== ":") return undefined;
      const m = key.slice(-7),
        eid = key.slice(0, -8),
        e = entriesById.get(eid);
      if (
        !month.safeParse(m).success ||
        !e ||
        m < monthOf(e.date) ||
        m < s.settings.initialMonth ||
        (e.repeat === "none" && m !== monthOf(e.date)) ||
        (e.endMonth && m > e.endMonth)
      )
        return undefined;
      return e;
    };
    for (const key of [
      ...s.skipped,
      ...Object.keys(s.overrides),
      ...Object.keys(s.settled),
    ])
      if (!lookup(key)) issue();
    for (const [key, change] of Object.entries(s.overrides))
      if (lookup(key)?.method === "account" && change.owner !== "me") issue();
    for (const [key, value] of Object.entries(s.settled))
      if (
        lookup(key)?.method !== "account" ||
        s.skipped.includes(key) ||
        monthOf(value.date) < s.settings.initialMonth
      )
        issue();
  });
export function createEmptyState(month: string): State {
  return {
    version: 1,
    settings: {
      initialMonth: month,
      openingBalance: 0,
      invoiceDay: 10,
      cardName: "Meu cartão",
    },
    entries: [],
    overrides: {},
    skipped: [],
    settled: {},
    payments: [],
    reimbursements: [],
  };
}
export function parseBackup(text: string): State {
  if (new TextEncoder().encode(text).length > 5_000_000)
    throw new Error("O backup deve ter no máximo 5 MB.");
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    throw new Error(
      "Backup inválido. Selecione um arquivo exportado pelo Controle Renda.",
    );
  }
}

export function serializeBackup(state: State): string {
  const text = JSON.stringify(state);
  parseBackup(text);
  return text;
}
