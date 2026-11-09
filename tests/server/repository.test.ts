import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createPool, migrate } from "../../server/db";
import {
  PostgresRepository,
  ConflictError,
  NotFoundError,
} from "../../server/repository";
import { createEmptyState } from "../../src/lib/validation";
import { createDemo } from "../../src/lib/demo";
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error(
    "Defina TEST_DATABASE_URL para um PostgreSQL exclusivo de testes.",
  );
const pool = createPool(url),
  repo = new PostgresRepository(pool);
let userId: string;
beforeAll(() => migrate(pool));
beforeEach(async () => {
  userId = randomUUID();
  await pool.query(
    "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
    [userId, `${userId}@example.test`, "Teste", "unused"],
  );
  await pool.query("INSERT INTO budgets(user_id,initial_month) VALUES($1,$2)", [
    userId,
    "2026-11",
  ]);
});
afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE '%@example.test'");
  await pool.end();
});
it("persiste todos os componentes do orçamento em tabelas e recupera em outra conexão", async () => {
  const state = createDemo("2026-11");
  state.settled["salario:2026-11"] = { date: "2026-11-05" };
  state.overrides["farmacia:2026-11"] = {
    description: "Remédio",
    amount: 12500,
    category: "Saúde",
    owner: "mother",
  };
  state.skipped = ["cafe:2026-11"];
  state.payments = [
    { id: "p1", month: "2026-11", amount: 10000, date: "2026-11-10" },
  ];
  state.reimbursements = [
    { id: "r1", month: "2026-11", amount: 5000, date: "2026-11-09" },
  ];
  await repo.saveBudget(userId, state, 0);
  const second = new PostgresRepository(pool);
  const loaded = await second.readBudget(userId);
  expect({ ...loaded.state, entries: [] }).toEqual({ ...state, entries: [] });
  expect(loaded.revision).toBe(1);
  expect(loaded.state.entries).toEqual(expect.arrayContaining(state.entries));
  expect(loaded.state.entries).toHaveLength(11);
  const counts = await pool.query(
    "SELECT count(*)::int AS total FROM entries WHERE budget_id=(SELECT id FROM budgets WHERE user_id=$1)",
    [userId],
  );
  expect(counts.rows[0].total).toBe(11);
});
it("permite somente uma gravação concorrente para a mesma revisão", async () => {
  const first = createEmptyState("2026-11"),
    second = createEmptyState("2026-11");
  first.settings.openingBalance = 50000;
  second.settings.openingBalance = 80000;
  const results = await Promise.allSettled([
    repo.saveBudget(userId, first, 0),
    repo.saveBudget(userId, second, 0),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    reason: expect.any(ConflictError),
  });
  expect((await repo.readBudget(userId)).revision).toBe(1);
});
it("não expõe outro orçamento por id inexistente", async () => {
  await expect(repo.readBudget(randomUUID())).rejects.toBeInstanceOf(
    NotFoundError,
  );
});
it("não grava estado inválido nem altera a revisão", async () => {
  const invalid = createEmptyState("2026-11");
  invalid.settings.invoiceDay = 45;
  await expect(repo.saveBudget(userId, invalid, 0)).rejects.toThrow();
  expect((await repo.readBudget(userId)).revision).toBe(0);
});
it("serializa criação de sessão com redefinição de senha para não reativar a senha antiga", async () => {
  const account = (
    await pool.query(
      "SELECT id,email,name,password_hash FROM users WHERE id=$1",
      [userId],
    )
  ).rows[0];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
      userId,
      "new-password-hash",
    ]);
    await client.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
    const pending = repo.createSession(
      account,
      "a".repeat(64),
      new Date(Date.now() + 60000),
    );
    // Let the second real connection reach the locked user row before committing.
    await new Promise((resolve) => setTimeout(resolve, 150));
    await client.query("COMMIT");
    expect(await pending).toBe(false);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS total FROM sessions WHERE user_id=$1",
          [userId],
        )
      ).rows[0].total,
    ).toBe(0);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
it("persiste a correção de data recorrente e sua confirmação após reabrir o orçamento", async () => {
  const { editOccurrence } = await import("../../src/lib/entry-editing");
  const { occurrences } = await import("../../src/lib/finance");
  const state = createEmptyState("2026-11");
  state.entries = [
    {
      id: "salary",
      description: "Salário",
      amount: 300000,
      date: "2026-11-05",
      kind: "income",
      method: "account",
      owner: "me",
      category: "Salário",
      repeat: "monthly",
    },
  ];
  state.settled["salary:2026-11"] = { date: "2026-11-06" };
  await repo.saveBudget(userId, state, 0);
  const first = await repo.readBudget(userId),
    row = occurrences(first.state, "2026-11")[0];
  const updated = editOccurrence(
    first.state,
    row,
    { ...row, date: "2026-12-09" },
    "2026-11-03",
  );
  await repo.saveBudget(userId, updated, first.revision);
  const reloaded = await new PostgresRepository(pool).readBudget(userId);
  expect(occurrences(reloaded.state, "2026-11")).toHaveLength(0);
  const december = occurrences(reloaded.state, "2026-12");
  expect(december.map((e) => e.date)).toEqual(["2026-12-05", "2026-12-09"]);
  expect(december[1].settledOn).toBe("2026-11-03");
  expect(occurrences(reloaded.state, "2027-01")[0].date).toBe("2027-01-05");
});
