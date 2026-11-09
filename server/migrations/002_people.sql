CREATE TABLE budget_people (
 budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
 id varchar(100) NOT NULL CHECK (id ~ '^person_[a-zA-Z0-9_-]{1,80}$'),
 name varchar(60) NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
 PRIMARY KEY(budget_id,id)
);
CREATE UNIQUE INDEX budget_people_name_idx ON budget_people(budget_id,lower(name));
ALTER TABLE entries DROP CONSTRAINT entries_owner_check;
ALTER TABLE entries ADD CONSTRAINT entries_owner_check CHECK (owner IN ('me','mother','unknown') OR owner ~ '^person_[a-zA-Z0-9_-]{1,80}$');
ALTER TABLE occurrence_overrides DROP CONSTRAINT occurrence_overrides_owner_check;
ALTER TABLE occurrence_overrides ADD CONSTRAINT occurrence_overrides_owner_check CHECK (owner IN ('me','mother','unknown') OR owner ~ '^person_[a-zA-Z0-9_-]{1,80}$');
