#!/bin/sh
set -eu
# Application owns only its database and cannot administer the PostgreSQL cluster.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password APP_DB_PASSWORD
CREATE ROLE controle_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER DATABASE controle OWNER TO controle_app;
GRANT USAGE, CREATE ON SCHEMA public TO controle_app;
SQL
