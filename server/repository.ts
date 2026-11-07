import type pg from "pg";
import type { State } from "../src/lib/types";
import { parseBackup } from "../src/lib/validation";
export type BudgetSnapshot = { state: State; revision: number };
export type Account = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
};
export class ConflictError extends Error {}
export class NotFoundError extends Error {}
const keyParts = (key: string) => ({
  entry_id: key.slice(0, -8),
  month: key.slice(-7),
});
export class PostgresRepository {
  constructor(readonly pool: pg.Pool) {}
  async readBudget(userId: string): Promise<BudgetSnapshot> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await client.query(
        "SELECT * FROM budgets WHERE user_id=$1",
        [userId],
      );
      if (!result.rowCount)
        throw new NotFoundError("Orçamento não encontrado.");
      const budget = result.rows[0],
        id = budget.id;
      const [entries, overrides, skipped, settled, payments, reimbursements] =
        await (async () => {
          const results = [];
          for (const sql of [
            "SELECT * FROM entries WHERE budget_id=$1 ORDER BY id",
            "SELECT * FROM occurrence_overrides WHERE budget_id=$1",
            "SELECT * FROM skipped_occurrences WHERE budget_id=$1 ORDER BY entry_id,month",
            "SELECT * FROM settled_occurrences WHERE budget_id=$1",
            "SELECT * FROM invoice_payments WHERE budget_id=$1 ORDER BY occurred_on,id",
            "SELECT * FROM reimbursements WHERE budget_id=$1 ORDER BY occurred_on,id",
          ])
            results.push(await client.query(sql, [id]));
          return results;
        })();
      const state: State = {
        version: 1,
        settings: {
          initialMonth: budget.initial_month,
          openingBalance: Number(budget.opening_balance),
          invoiceDay: budget.invoice_day,
          cardName: budget.card_name,
        },
        entries: entries.rows.map((e) => ({
          id: e.id,
          description: e.description,
          amount: Number(e.amount),
          date: e.due_date,
          kind: e.kind,
          method: e.method,
          owner: e.owner,
          category: e.category,
          repeat: e.repeat,
          ...(e.end_month ? { endMonth: e.end_month } : {}),
          ...(e.installment_index
            ? {
                installment: {
                  index: e.installment_index,
                  total: e.installment_total,
                  group: e.installment_group,
                },
              }
            : {}),
        })),
        overrides: Object.fromEntries(
          overrides.rows.map((e) => [
            `${e.entry_id}:${e.month}`,
            {
              description: e.description,
              amount: Number(e.amount),
              owner: e.owner,
              category: e.category,
            },
          ]),
        ),
        skipped: skipped.rows.map((e) => `${e.entry_id}:${e.month}`),
        settled: Object.fromEntries(
          settled.rows.map((e) => [
            `${e.entry_id}:${e.month}`,
            { date: e.settled_on },
          ]),
        ),
        payments: payments.rows.map((e) => ({
          id: e.id,
          month: e.invoice_month,
          amount: Number(e.amount),
          date: e.occurred_on,
        })),
        reimbursements: reimbursements.rows.map((e) => ({
          id: e.id,
          month: e.invoice_month,
          amount: Number(e.amount),
          date: e.occurred_on,
        })),
      };
      const validated = parseBackup(JSON.stringify(state));
      await client.query("COMMIT");
      return { state: validated, revision: budget.revision };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async saveBudget(
    userId: string,
    input: State,
    revision: number,
  ): Promise<BudgetSnapshot> {
    const state = parseBackup(JSON.stringify(input));
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const changed = await client.query(
        "UPDATE budgets SET initial_month=$3,opening_balance=$4,invoice_day=$5,card_name=$6,revision=revision+1,updated_at=now() WHERE user_id=$1 AND revision=$2 RETURNING id,revision",
        [
          userId,
          revision,
          state.settings.initialMonth,
          state.settings.openingBalance,
          state.settings.invoiceDay,
          state.settings.cardName,
        ],
      );
      if (!changed.rowCount) {
        const exists = await client.query(
          "SELECT 1 FROM budgets WHERE user_id=$1",
          [userId],
        );
        if (!exists.rowCount)
          throw new NotFoundError("Orçamento não encontrado.");
        throw new ConflictError("O orçamento foi alterado em outro aparelho.");
      }
      const id = changed.rows[0].id;
      await client.query("DELETE FROM entries WHERE budget_id=$1", [id]);
      await client.query("DELETE FROM invoice_payments WHERE budget_id=$1", [
        id,
      ]);
      await client.query("DELETE FROM reimbursements WHERE budget_id=$1", [id]);
      await client.query(
        `INSERT INTO entries(budget_id,id,description,amount,due_date,kind,method,owner,category,repeat,end_month,installment_index,installment_total,installment_group)
    SELECT $1,x.id,x.description,x.amount,x.due_date,x.kind,x.method,x.owner,x.category,x.repeat,x.end_month,x.installment_index,x.installment_total,x.installment_group
    FROM jsonb_to_recordset($2::jsonb) AS x(id text,description text,amount bigint,due_date date,kind text,method text,owner text,category text,repeat text,end_month text,installment_index smallint,installment_total smallint,installment_group text)`,
        [
          id,
          JSON.stringify(
            state.entries.map((e) => ({
              id: e.id,
              description: e.description,
              amount: e.amount,
              due_date: e.date,
              kind: e.kind,
              method: e.method,
              owner: e.owner,
              category: e.category,
              repeat: e.repeat,
              end_month: e.endMonth,
              installment_index: e.installment?.index,
              installment_total: e.installment?.total,
              installment_group: e.installment?.group,
            })),
          ),
        ],
      );
      await client.query(
        `INSERT INTO occurrence_overrides(budget_id,entry_id,month,description,amount,owner,category) SELECT $1,x.entry_id,x.month,x.description,x.amount,x.owner,x.category FROM jsonb_to_recordset($2::jsonb) AS x(entry_id text,month text,description text,amount bigint,owner text,category text)`,
        [
          id,
          JSON.stringify(
            Object.entries(state.overrides).map(([key, value]) => ({
              ...keyParts(key),
              ...value,
            })),
          ),
        ],
      );
      await client.query(
        `INSERT INTO skipped_occurrences(budget_id,entry_id,month) SELECT $1,x.entry_id,x.month FROM jsonb_to_recordset($2::jsonb) AS x(entry_id text,month text)`,
        [id, JSON.stringify(state.skipped.map(keyParts))],
      );
      await client.query(
        `INSERT INTO settled_occurrences(budget_id,entry_id,month,settled_on) SELECT $1,x.entry_id,x.month,x.settled_on FROM jsonb_to_recordset($2::jsonb) AS x(entry_id text,month text,settled_on date)`,
        [
          id,
          JSON.stringify(
            Object.entries(state.settled).map(([key, value]) => ({
              ...keyParts(key),
              settled_on: value.date,
            })),
          ),
        ],
      );
      // Table names are a fixed allowlist; all user values remain bound parameters.
      for (const [table, transfers] of [
        ["invoice_payments", state.payments],
        ["reimbursements", state.reimbursements],
      ] as const) {
        await client.query(
          `INSERT INTO ${table}(budget_id,id,invoice_month,amount,occurred_on) SELECT $1,x.id,x.invoice_month,x.amount,x.occurred_on FROM jsonb_to_recordset($2::jsonb) AS x(id text,invoice_month text,amount bigint,occurred_on date)`,
          [
            id,
            JSON.stringify(
              transfers.map((t) => ({
                id: t.id,
                invoice_month: t.month,
                amount: t.amount,
                occurred_on: t.date,
              })),
            ),
          ],
        );
      }
      await client.query("COMMIT");
      return { state, revision: changed.rows[0].revision };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async findAccount(email: string): Promise<Account | null> {
    const r = await this.pool.query<Account>(
      "SELECT id,email,name,password_hash FROM users WHERE email=$1",
      [email],
    );
    return r.rows[0] ?? null;
  }
  async createAccount(
    email: string,
    name: string,
    passwordHash: string,
    initialMonth: string,
  ): Promise<Account> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const r = await client.query<Account>(
        "INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id,email,name,password_hash",
        [email, name, passwordHash],
      );
      await client.query(
        "INSERT INTO budgets(user_id,initial_month) VALUES($1,$2)",
        [r.rows[0].id, initialMonth],
      );
      await client.query("COMMIT");
      return r.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async createSession(
    user: Account,
    tokenHash: string,
    expires: Date,
  ): Promise<boolean> {
    await this.pool.query("DELETE FROM sessions WHERE expires_at<=now()");
    const result = await this.pool.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) SELECT $1,id,$3 FROM users WHERE id=$2 AND password_hash=$4 FOR SHARE RETURNING user_id",
      [tokenHash, user.id, expires, user.password_hash],
    );
    return result.rowCount === 1;
  }
  async sessionAccount(hash: string): Promise<Account | null> {
    const r = await this.pool.query<Account>(
      "SELECT u.id,u.email,u.name,u.password_hash FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [hash],
    );
    return r.rows[0] ?? null;
  }
  async deleteSession(hash: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash=$1", [hash]);
  }
  async changePassword(
    user: Account,
    newHash: string,
    sessionHash?: string,
    expires?: Date,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const r = await client.query(
        "UPDATE users SET password_hash=$2 WHERE id=$1 AND password_hash=$3 RETURNING id",
        [user.id, newHash, user.password_hash],
      );
      if (!r.rowCount) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
      if (sessionHash && expires)
        await client.query(
          "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
          [sessionHash, user.id, expires],
        );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
