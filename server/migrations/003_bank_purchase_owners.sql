CREATE TABLE bank_purchase_owners (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_key text NOT NULL CHECK (purchase_key ~ '^[0-9a-f]{64}$'),
  owner text NOT NULL CHECK (owner IN ('me', 'mother', 'other') OR owner ~ '^person_[a-zA-Z0-9_-]{1,80}$'),
  PRIMARY KEY (user_id, purchase_key)
);
