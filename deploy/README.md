# Deploy de produção do Pontes

Daqui sai só o que é do app: as imagens (API e web) e o gatilho do deploy. **O compose de produção, o backup, o proxy com HTTPS, o DNS e o mecanismo de deploy moram no repo do servidor, `E:\VSCode\pontes\servidor`** (`deploy/projetos/pontes/`; padrão em `deploy/PADRAO.md`). Mudança neles é no chat do servidor: eles rodam como root na VPS, então não vêm deste repo. Decisão e contexto: `docs/features/hospedagem-beta/decisao.md`.

| O quê | Valor |
|---|---|
| Endereço | https://app.pontesdev.com.br |
| Imagens | `ghcr.io/gustavopontess/controle-financeiro-api` e `-web` (privadas), tag = SHA do commit |
| Versão no ar | `/var/lib/deploy/pontes.versao`; log em `/var/log/deploy/pontes.log` |
| Backup | antes de todo deploy e no cron (repo do servidor) |

## Peças deste repo

- `.github/workflows/deploy.yml`: monta e publica as imagens (job `imagens`, único que escreve no GHCR) e avisa a VPS (job `publicar`, só leitura, environment `production`). Actions fixadas por SHA.
- `ControleFinanceiro.Api/Dockerfile`: imagem da API.
- `controle-financeiro.v2/Dockerfile` + `controle-financeiro.v2/Caddyfile`: front v2 servido por um Caddy interno (sem HTTPS), com a CSP do app.
- `scripts/segredos.sh <emails-admin>`: roda uma vez, à mão, no servidor; gera `.env` e `.env.api`. Não sobrescreve (trocar o pepper invalida todas as senhas).

## Atualizar o app: automático

Merge na `main` → CI verde → workflow Deploy. A VPS: confere que o Postgres está de pé (sem backup, não publica) → backup → baixa as imagens → `up -d` → espera API e web saudáveis (2 min) → se não ficarem, **volta sozinha pra versão anterior** e o job falha.

- **PR não publica.** Só push na `main` com CI verde (ou disparo manual em Actions → Deploy). Os secrets do deploy existem só no environment `production`, que só aceita a `main`.
- **Fora de ordem não sobe.** Se a `main` já andou quando o deploy de um commit chega na vez dele, ele pula sem falhar (um SHA velho não pode subir por cima de um banco já migrado pelo novo).
- **Voltar versão:** Actions → o deploy do commit antigo → Re-run (re-run passa direto pela checagem de ordem).
- **Acesso às imagens privadas:** nenhuma senha fica no servidor. O pacote que vai pra VPS é só o `.registro` com o `GITHUB_TOKEN` do job `publicar` (só lê pacotes, morre com o job); a VPS faz login numa pasta temporária, baixa e apaga.

### Migração de banco (atenção)

A API aplica as migrações sozinha ao subir (`MigrateAsync` no `Program.cs`, antes de abrir a porta; o healthcheck só fica verde depois). **A volta automática troca as imagens, mas não desfaz migração**: se a versão nova migrou e não ficou saudável, a anterior volta rodando em cima do banco já migrado. Por isso toda migração tem que funcionar com a versão anterior ainda de pé:

- Pode: criar tabela, coluna que aceita nulo ou tem valor padrão, índice.
- Em duas etapas (dois deploys): renomear ou apagar coluna/tabela, tornar coluna obrigatória. Primeiro o código para de usar; no deploy seguinte, a migração tira.
- Se precisar mesmo desfazer: restaurar o backup feito logo antes do deploy (comando no README do servidor).

## Manual: só em emergência

Com o deploy automático fora do ar: pelo chat do servidor (compose e comandos moram lá).

## Pendências

- E-mail (SMTP) em produção: sem ele, recuperar senha não envia nada. Ao ligar o provedor, o SPF do DNS muda (chat do servidor).
- Cópia do backup fora do servidor.
- LGPD art. 33 (servidor nos EUA): ver gate no ROADMAP.
- Cookies do app e `pontesdev.com.br` (site de outro repo) no mesmo "site": ver item no ROADMAP.
