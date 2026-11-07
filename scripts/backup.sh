#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="backups/controle-renda-$stamp.dump"
temporary="$target.partial"
trap 'rm -f "$temporary"' EXIT HUP INT TERM
docker compose exec -T db pg_dump -U controle_admin -d controle --format=custom --no-owner > "$temporary"
mv "$temporary" "$target"
printf 'Backup salvo em %s\n' "$target"
