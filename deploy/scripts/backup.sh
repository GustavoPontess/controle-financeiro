#!/usr/bin/env bash
# Backup do banco: pg_dump comprimido em /var/backups/pontes, guarda 14 dias. Roda no cron (3h) e no deploy
# automático antes de trocar a versão (bash scripts/backup.sh, de dentro de /srv/pontes/deploy).
# Instalar: echo "0 3 * * * root /srv/pontes/deploy/scripts/backup.sh" > /etc/cron.d/pontes-backup
# Restaurar: ver deploy/README.md.
set -euo pipefail
cd "$(dirname "$0")/.."

# O compose exige VERSAO (tag das imagens) até pra um exec no Postgres; o cron não tem. Qualquer valor serve:
# o exec não troca imagem nem recria container.
export VERSAO="${VERSAO:-$(cat /var/lib/deploy/pontes.versao 2>/dev/null || echo atual)}"

DESTINO=/var/backups/pontes
ARQUIVO="$DESTINO/pontes-$(date -u +%Y%m%d-%H%M%S).sql.gz"
umask 077

docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U pontes -d pontes --no-owner --clean --if-exists | gzip > "$ARQUIVO"
[ -s "$ARQUIVO" ] || { echo "erro: backup vazio" >&2; rm -f "$ARQUIVO"; exit 1; }

find "$DESTINO" -name 'pontes-*.sql.gz' -mtime +14 -delete
