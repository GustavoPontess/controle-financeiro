# Deploy de produção do Pontes

Só o app. **Servidor, proxy com HTTPS, DNS, firewall e o mecanismo de deploy na VPS moram em `E:\VSCode\pontes\servidor`** (ponto em comum com o PontesDev; padrão em `servidor/deploy/PADRAO.md`). Decisão e contexto: `docs/features/hospedagem-beta/decisao.md`.

| O quê | Valor |
|---|---|
| Endereço | https://app.pontesdev.com.br |
| Pasta no servidor | `/srv/pontes/deploy` (compose + segredos) |
| Imagens | `ghcr.io/gustavopontess/controle-financeiro-api` e `-web` (privadas), tag = SHA do commit |
| Versão no ar | `/var/lib/deploy/pontes.versao`; log em `/var/log/deploy/pontes.log` |
| Backup | `pg_dump` às 3h (UTC) e antes de todo deploy, em `/var/backups/pontes`, 14 dias |

## Peças

- `docker-compose.prod.yml`: Postgres e API (só rede interna) + `pontes-web` (front v2 + repasse de `/api`), ligado na rede `web` do proxy central. Nenhuma porta pra fora. As imagens vêm do GHCR (`${VERSAO}`), nada de build no servidor. API e web têm healthcheck.
- `controle-financeiro.v2/Dockerfile` + `controle-financeiro.v2/Caddyfile`: build do front servido por um Caddy interno (sem HTTPS), com a CSP do app.
- `scripts/segredos.sh <emails-admin>`: uma vez, gera `.env` e `.env.api` NO servidor. Não sobrescreve (trocar o pepper invalida todas as senhas). O deploy nunca mexe nos dois.
- `scripts/backup.sh`: backup do banco (cron em `/etc/cron.d/pontes-backup` e antes de cada deploy).

## Atualizar o app: automático

Merge na `main` → CI verde → `.github/workflows/deploy.yml` monta as imagens, publica no GHCR e manda esta pasta pra VPS. Lá: backup → baixa as imagens → `up -d` → espera API e web ficarem saudáveis (2 min) → se não ficarem, **volta sozinha pra versão anterior** e o job falha.

- **PR não publica.** Só push na `main` com CI verde (ou disparo manual em Actions → Deploy).
- **Voltar versão:** Actions → o deploy do commit antigo → Re-run.
- **Primeira vez:** a VPS precisa do token de leitura do GHCR (lado do servidor); sem ele o `pull` falha e nada muda no ar.

### Migração de banco (atenção)

A API aplica as migrações sozinha ao subir (`MigrateAsync` no `Program.cs`, antes de abrir a porta). **A volta automática troca as imagens, mas não desfaz migração**: se a versão nova migrou e não ficou saudável, a anterior volta rodando em cima do banco já migrado. Por isso toda migração tem que funcionar com a versão anterior ainda de pé:

- Pode: criar tabela, coluna que aceita nulo ou tem valor padrão, índice.
- Em duas etapas (dois deploys): renomear ou apagar coluna/tabela, tornar coluna obrigatória. Primeiro o código para de usar; no deploy seguinte, a migração tira.
- Se precisar mesmo desfazer: restaurar o backup feito logo antes do deploy (abaixo).

## Manual: só em emergência

Com o deploy automático fora do ar. No servidor, como root:

```bash
cd /srv/pontes/deploy
VERSAO=<sha do commit> docker compose -f docker-compose.prod.yml pull
VERSAO=<sha do commit> docker compose -f docker-compose.prod.yml up -d
```

## Restaurar backup

O backup já leva os comandos de apagar antes de recriar (`--clean`), então restaura por cima do banco atual.

```bash
cd /srv/pontes/deploy
gunzip -c /var/backups/pontes/ARQUIVO.sql.gz | VERSAO=atual docker compose -f docker-compose.prod.yml exec -T postgres psql -U pontes -d pontes
```

## Pendências

- E-mail (SMTP) em produção: sem ele, recuperar senha não envia nada. Ao ligar o provedor, o SPF do DNS muda (chat do servidor).
- Cópia do backup fora do servidor (hoje só no disco da VPS + backup semanal da Hostinger).
- LGPD art. 33 (servidor nos EUA): ver gate no ROADMAP.
