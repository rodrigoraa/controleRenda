import type pg from "pg";
import type {
  BankOverview,
  BankPurchaseOwner,
  BankResult,
} from "../src/lib/bank-feed";

export function purchaseKeys(view: BankOverview): string[] {
  if (!view.enabled) return [];
  return view.banks.flatMap(({ accounts }) =>
    accounts.flatMap((account) =>
      account.kind === "credit"
        ? account.transactions.flatMap(({ purchaseKey, direction }) =>
            purchaseKey && direction === "DEBIT" ? [purchaseKey] : [],
          )
        : [],
    ),
  );
}

export async function withPurchaseOwners(
  pool: pg.Pool,
  userId: string,
  view: BankOverview,
): Promise<BankOverview> {
  const keys = purchaseKeys(view);
  if (!view.enabled || !keys.length) return view;
  const { rows } = await pool.query<{
    purchase_key: string;
    owner: BankPurchaseOwner;
  }>(
    `SELECT purchase_key, CASE WHEN left(owner, 7) = 'person_' AND person.id IS NULL THEN 'other' ELSE owner END AS owner
       FROM bank_purchase_owners assignment
       LEFT JOIN budgets budget ON budget.user_id = assignment.user_id
       LEFT JOIN budget_people person ON person.budget_id = budget.id AND person.id = assignment.owner
      WHERE assignment.user_id = $1 AND purchase_key = ANY($2::text[])`,
    [userId, keys],
  );
  const owners = new Map(
    rows.map(({ purchase_key, owner }) => [purchase_key, owner]),
  );
  return {
    ...view,
    banks: view.banks.map((bank) => filterBank(bank)),
  };

  function filterBank(bank: BankResult): BankResult {
    return {
      ...bank,
      accounts: bank.accounts.map((account) =>
        account.kind === "credit"
          ? {
              ...account,
              transactions: account.transactions.map((transaction) =>
                transaction.purchaseKey && transaction.direction === "DEBIT"
                  ? {
                      ...transaction,
                      owner:
                        owners.get(transaction.purchaseKey) ??
                        ("unknown" as const),
                    }
                  : transaction,
              ),
            }
          : account,
      ),
    };
  }
}

export async function savePurchaseOwner(
  pool: pg.Pool,
  userId: string,
  key: string,
  owner: BankPurchaseOwner,
) {
  if (owner === "unknown") {
    await pool.query(
      "DELETE FROM bank_purchase_owners WHERE user_id=$1 AND purchase_key=$2",
      [userId, key],
    );
    return true;
  }
  const result = await pool.query(
    `INSERT INTO bank_purchase_owners (user_id, purchase_key, owner)
     SELECT $1, $2, $3::text
     WHERE $3 IN ('me', 'mother', 'other') OR EXISTS (
       SELECT 1 FROM budgets b JOIN budget_people p ON p.budget_id = b.id
       WHERE b.user_id = $1 AND p.id = $3
     )
     ON CONFLICT (user_id, purchase_key) DO UPDATE SET owner = EXCLUDED.owner`,
    [userId, key, owner],
  );
  return result.rowCount === 1;
}
