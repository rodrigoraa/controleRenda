#!/bin/sh
set -eu
umask 077
mkdir -p /backups
while :; do
    stamp=$(date -u +%Y%m%dT%H%M%SZ)
    temporary="/backups/.controle-renda-$stamp.partial"
    target="/backups/controle-renda-$stamp.dump"
    if pg_dump --format=custom --no-owner --file="$temporary"; then
        mv "$temporary" "$target"
        find /backups -type f -name 'controle-renda-*.dump' -mtime +14 -delete
        printf 'Backup concluído em %s (UTC).\n' "$stamp"
        sleep 86400
    else
        rm -f "$temporary"
        printf '%s\n' 'Falha no backup. Uma nova tentativa será feita em cinco minutos.' >&2
        sleep 300
    fi
done
