#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -e .env ]; then
    printf '%s\n' 'O arquivo .env já existe e foi preservado. Edite-o para mudar a configuração.' >&2
    exit 1
fi
command -v openssl >/dev/null 2>&1 || { printf '%s\n' 'Instale openssl para gerar a senha do banco.' >&2; exit 1; }
printf 'Domínio do sistema (ex.: financas.seudominio.com, sem https://): '
IFS= read -r domain
# Accept only plain DNS hostnames, preventing shell/Compose interpolation.
case "$domain" in ''|*[!a-zA-Z0-9.-]*|.*|*.|*..*|-*|*.-*|*-.*) printf '%s\n' 'Informe um domínio válido, sem caminho ou porta.' >&2; exit 1;; esac
case "$domain" in *.*) ;; *) printf '%s\n' 'Informe o domínio completo.' >&2; exit 1;; esac
domain=$(printf '%s' "$domain" | tr '[:upper:]' '[:lower:]')
umask 077
password=$(openssl rand -hex 32)
app_password=$(openssl rand -hex 32)
cat > .env <<CONF
APP_DOMAIN=$domain
APP_ORIGIN=https://$domain
POSTGRES_PASSWORD=$password
APP_DB_PASSWORD=$app_password
APP_PORT=3000
LOG_LEVEL=info
CONF
printf '%s\n' 'Configuração criada em .env. A senha aleatória do banco foi salva sem ser exibida.'
