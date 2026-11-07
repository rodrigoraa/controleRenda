import { it, expect, vi } from "vitest";
import {
  STORAGE_KEY,
  createEmptyState,
  loadState,
  saveState,
  parseBackup,
} from "../src/lib/storage";
it("persiste e recupera o orçamento real", () => {
  const s = createEmptyState("2026-11");
  s.settings.openingBalance = 12345;
  saveState(s);
  expect(loadState("2026-11").state.settings.openingBalance).toBe(12345);
});
it("rejeita backup malformado e mantém os dados salvos", () => {
  const s = createEmptyState("2026-11");
  saveState(s);
  expect(() => parseBackup('{"version":1}')).toThrow();
  expect(() =>
    parseBackup(
      JSON.stringify({
        ...s,
        settings: { ...s.settings, openingBalance: 1.5 },
      }),
    ),
  ).toThrow();
  expect(loadState("2026-11").state).toEqual(s);
});
it("rejeita datas inexistentes e lançamentos de cartão como receita", () => {
  const s = createEmptyState("2026-11");
  const e = {
    id: "a",
    description: "Teste",
    amount: 100,
    date: "2026-02-30",
    kind: "income",
    method: "account",
    owner: "me",
    category: "Outros",
    repeat: "none",
  };
  expect(() => parseBackup(JSON.stringify({ ...s, entries: [e] }))).toThrow();
  expect(() =>
    parseBackup(
      JSON.stringify({
        ...s,
        entries: [{ ...e, date: "2026-11-01", method: "card" }],
      }),
    ),
  ).toThrow();
});
it("avisa sobre armazenamento corrompido sem sobrescrevê-lo", () => {
  localStorage.setItem(STORAGE_KEY, "broken");
  expect(loadState("2026-11").error).toBeTruthy();
  expect(localStorage.getItem(STORAGE_KEY)).toBe("broken");
});
it("propaga falha de gravação para que a interface não anuncie salvamento", () => {
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("QuotaExceededError");
  });
  expect(() => saveState(createEmptyState("2026-11"))).toThrow();
  spy.mockRestore();
});
it("exporta um backup em UTF-8 que pode ser importado mesmo com muitos acentos", async () => {
  const { serializeBackup } = await import("../src/lib/storage");
  const s = createEmptyState("2026-11");
  s.entries = Array.from({ length: 10000 }, (_, i) => ({
    id: `entry-${i}`,
    description: "á".repeat(120),
    category: "ó".repeat(50),
    amount: 100,
    date: "2026-11-01",
    kind: "expense" as const,
    method: "account" as const,
    owner: "me" as const,
    repeat: "none" as const,
  }));
  saveState(s);
  const backup = serializeBackup(s);
  expect(new TextEncoder().encode(backup).length).toBeLessThanOrEqual(
    5_000_000,
  );
  expect(parseBackup(backup)).toEqual(s);
});
it("rejeita uma gravação baseada em dados antigos e preserva a alteração da outra aba", async () => {
  const { saveStateIfUnchanged, StaleStateError } = await import(
    "../src/lib/storage"
  );
  const first = createEmptyState("2026-11"),
    second = createEmptyState("2026-11");
  first.settings.openingBalance = 50000;
  second.settings.openingBalance = 30000;
  await saveStateIfUnchanged(first, null);
  await expect(saveStateIfUnchanged(second, null)).rejects.toBeInstanceOf(
    StaleStateError,
  );
  expect(loadState("2026-11").state.settings.openingBalance).toBe(50000);
});
it("rejeita referências ambíguas e exclusões duplicadas antes de gravar no banco", () => {
  const s = createEmptyState("2026-11");
  s.entries = [
    {
      id: "a",
      description: "Conta",
      amount: 100,
      date: "2026-11-01",
      kind: "expense",
      method: "account",
      owner: "me",
      category: "Contas",
      repeat: "none",
    },
  ];
  s.overrides["aX2026-11"] = {
    description: "Outra conta",
    amount: 200,
    owner: "me",
    category: "Contas",
  };
  expect(() => parseBackup(JSON.stringify(s))).toThrow();
  s.overrides = {};
  s.skipped = ["a:2026-11", "a:2026-11"];
  expect(() => parseBackup(JSON.stringify(s))).toThrow();
});
