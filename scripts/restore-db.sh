#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
file=${1:-}
[ -n "$file" ] && [ -f "$file" ] || { printf '%s\n' 'Uso: sh scripts/restore-db.sh backups/arquivo.dump' >&2; exit 1; }
printf '%s\n' 'A restauração substituirá os dados atuais do banco. Faça um backup antes de continuar.'
printf 'Digite RESTAURAR para confirmar: '
IFS= read -r confirmation
[ "$confirmation" = RESTAURAR ] || { printf '%s\n' 'Operação cancelada.'; exit 1; }
docker compose stop app backups
if ! docker compose exec -T db pg_restore -U controle_admin -d controle --role=controle_app --clean --if-exists --no-owner --single-transaction --exit-on-error < "$file"; then
    printf '%s\n' 'A restauração falhou e a transação foi revertida. A aplicação continua parada para conferência.' >&2
    exit 1
fi
# Do not resurrect previously revoked sessions from the restored backup.
docker compose exec -T db psql -U controle_admin -d controle -v ON_ERROR_STOP=1 -c 'DELETE FROM sessions' >/dev/null
docker compose up -d app backups
printf '%s\n' 'Banco restaurado. Todas as contas precisarão entrar novamente.'
