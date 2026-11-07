CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE CHECK (email=lower(email) AND length(email)<=254),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 token_hash char(64) PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
CREATE TABLE budgets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 initial_month char(7) NOT NULL,
 opening_balance bigint NOT NULL DEFAULT 0 CHECK(abs(opening_balance)<=100000000000),
 invoice_day smallint NOT NULL DEFAULT 10 CHECK(invoice_day BETWEEN 1 AND 31),
 card_name text NOT NULL DEFAULT 'Meu cartão',
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE entries (
 budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
 id varchar(100) NOT NULL,
 description varchar(120) NOT NULL,
 amount bigint NOT NULL CHECK(amount>0 AND amount<=100000000000),
 due_date date NOT NULL,
 kind text NOT NULL CHECK(kind IN ('income','expense')),
 method text NOT NULL CHECK(method IN ('account','card')),
 owner text NOT NULL CHECK(owner IN ('me','mother','unknown')),
 category varchar(50) NOT NULL,
 repeat text NOT NULL CHECK(repeat IN ('none','monthly')),
 end_month char(7),
 installment_index smallint,
 installment_total smallint,
 installment_group varchar(100),
 PRIMARY KEY(budget_id,id),
 CHECK(method<>'card' OR kind='expense'),
 CHECK(method<>'account' OR owner='me'),
 CHECK((installment_index IS NULL AND installment_total IS NULL AND installment_group IS NULL) OR (installment_index BETWEEN 1 AND installment_total AND installment_total<=120 AND installment_group IS NOT NULL AND repeat='none' AND method='card'))
);
CREATE INDEX entries_budget_date_idx ON entries(budget_id,due_date);
CREATE TABLE occurrence_overrides (
 budget_id uuid NOT NULL,
 entry_id varchar(100) NOT NULL,
 month char(7) NOT NULL,
 description varchar(120) NOT NULL,
 amount bigint NOT NULL CHECK(amount>0 AND amount<=100000000000),
 owner text NOT NULL CHECK(owner IN ('me','mother','unknown')),
 category varchar(50) NOT NULL,
 PRIMARY KEY(budget_id,entry_id,month),
 FOREIGN KEY(budget_id,entry_id) REFERENCES entries(budget_id,id) ON DELETE CASCADE
);
CREATE TABLE skipped_occurrences (
 budget_id uuid NOT NULL,
 entry_id varchar(100) NOT NULL,
 month char(7) NOT NULL,
 PRIMARY KEY(budget_id,entry_id,month),
 FOREIGN KEY(budget_id,entry_id) REFERENCES entries(budget_id,id) ON DELETE CASCADE
);
CREATE TABLE settled_occurrences (
 budget_id uuid NOT NULL,
 entry_id varchar(100) NOT NULL,
 month char(7) NOT NULL,
 settled_on date NOT NULL,
 PRIMARY KEY(budget_id,entry_id,month),
 FOREIGN KEY(budget_id,entry_id) REFERENCES entries(budget_id,id) ON DELETE CASCADE
);
CREATE TABLE invoice_payments (
 budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
 id varchar(100) NOT NULL,
 invoice_month char(7) NOT NULL,
 amount bigint NOT NULL CHECK(amount>0 AND amount<=100000000000),
 occurred_on date NOT NULL,
 PRIMARY KEY(budget_id,id)
);
CREATE INDEX invoice_payments_month_idx ON invoice_payments(budget_id,invoice_month);
CREATE TABLE reimbursements (
 budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
 id varchar(100) NOT NULL,
 invoice_month char(7) NOT NULL,
 amount bigint NOT NULL CHECK(amount>0 AND amount<=100000000000),
 occurred_on date NOT NULL,
 PRIMARY KEY(budget_id,id)
);
CREATE INDEX reimbursements_month_idx ON reimbursements(budget_id,invoice_month);
