#!/usr/bin/env bash
# Gera os segredos de produção NO servidor (nunca no chat, nunca no git), uma vez só.
# Uso (de dentro de deploy/): scripts/segredos.sh <emails-admin-separados-por-virgula>
# NÃO sobrescreve: trocar o PASSWORD_PEPPER depois invalida a senha de todo mundo.
set -euo pipefail
cd "$(dirname "$0")/.."

ADMINS="${1:?informe os e-mails admin}"

if [ -e .env ] || [ -e .env.api ]; then
  echo "erro: .env ou .env.api já existe; não sobrescrevo segredo de produção" >&2
  exit 1
fi

umask 077
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 32)
EOF

cat > .env.api <<EOF
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
JWT_ISSUER=ControleFinanceiro
JWT_AUDIENCE=ControleFinanceiroUsers
PASSWORD_PEPPER=$(openssl rand -base64 48 | tr -d '\n')
MFA_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
ADMIN_EMAILS=${ADMINS}
HANGFIRE_ADMIN_EMAILS=${ADMINS}
# E-mail: sem SMTP_HOST nada é enviado (recuperar senha não funciona). Preencher com o provedor.
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=
# SMTP_SECURITY=starttls
# SENTRY_DSN=
EOF

echo "ok: .env e .env.api criados (só root lê). Guarde uma cópia do .env.api fora do servidor."
