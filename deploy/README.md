# Deploy de produção do Pontes (Kamal 2)

O Pontes vai pro ar com o **Kamal 2** (v2.12.0). Contrato e plano completos: `E:\VSCode\pontes\servidor\deploy\PLANO-KAMAL.md`. A VPS (usuário `deploy`, firewall, backup, DNS, snapshot) é do chat do servidor; a configuração de deploy do app mora aqui.

| O quê | Valor |
|---|---|
| Endereço | https://app.pontesdev.com.br |
| Apps Kamal | `pontes-api` (`config/deploy.api.yml`, com o Postgres como acessório `db` = container `pontes-api-db`) e `pontes-web` (`config/deploy.web.yml`) |
| Roteamento | `kamal-proxy` na VPS faz o HTTPS; `/api/...` vai pra API (prefixo mantido), o resto pro web |
| Imagens | `ghcr.io/gustavopontess/controle-financeiro-api` e `-web` (privadas), tag = SHA do commit |
| Segredos | só nos secrets do environment `production` do GitHub; `.kamal/secrets` lê do ambiente, sem valor no repo |
| Backup | na VPS: cron + antes de todo deploy da API (hook `.kamal/hooks/pre-deploy`); o dado nunca sai pro GitHub |

## Como publicar

Actions → **Deploy** → Run workflow, na `main`. O clique é a aprovação. O workflow:

1. para se o CI daquele commit não estiver verde;
2. `kamal deploy -c config/deploy.api.yml`: monta a imagem, publica no GHCR, roda o backup na VPS (se falhar, o deploy para), sobe a versão nova ao lado da velha; o `kamal-proxy` só manda tráfego pra nova quando o `/health` responde (até 120 s, por causa das migrações) e então derruba a velha;
3. `kamal deploy -c config/deploy.web.yml`: o mesmo pro front (health check em `/`).

Se a versão nova não ficar saudável, o deploy falha e a anterior continua no ar.

## Voltar versão

```bash
kamal app containers -c config/deploy.api.yml    # lista as versões guardadas na VPS
kamal rollback <versão> -c config/deploy.api.yml
kamal rollback <versão> -c config/deploy.web.yml
```

Precisa dos mesmos secrets no ambiente (rodar a partir de quem tem a chave de deploy; hoje, só o GitHub).

## Migração de banco (atenção)

A API aplica as migrações sozinha ao subir (`MigrateAsync` no `Program.cs`, antes de abrir a porta; o `/health` só responde depois). Durante o deploy as duas versões ficam de pé ao mesmo tempo, e o **rollback troca a imagem mas não desfaz migração**. Por isso toda migração tem que funcionar com a versão anterior ainda rodando:

- Pode: criar tabela, coluna que aceita nulo ou tem valor padrão, índice.
- Em duas etapas (dois deploys): renomear ou apagar coluna/tabela, tornar coluna obrigatória. Primeiro o código para de usar; no deploy seguinte, a migração tira.
- Se precisar mesmo desfazer: restaurar o backup feito logo antes do deploy (chat do servidor).

## Peças deste repo

- `config/deploy.api.yml`, `config/deploy.web.yml`, `.kamal/secrets`, `.kamal/hooks/pre-deploy`, `.github/workflows/deploy.yml`.
- `ControleFinanceiro.Api/Dockerfile`: imagem da API.
- `controle-financeiro.v2/Dockerfile` + `Caddyfile`: front v2 servido por um Caddy interno (sem HTTPS), com CSP e HSTS.
- `deploy/scripts/segredos.sh`: **histórico**. Foi como as chaves de produção nasceram (23/10/2026). Os valores hoje moram nos secrets do GitHub e no cofre; não rodar de novo (trocar o pepper invalida todas as senhas).

## Fora do ar de propósito

- O painel do Hangfire (`/hangfire`) não é roteado pelo `kamal-proxy` (só `/api`). Acesso, se precisar: pelo chat do servidor.

## Pendências

- E-mail (SMTP) em produção: sem ele, recuperar senha não envia nada. Ao ligar o provedor, o SPF do DNS muda (chat do servidor).
- LGPD art. 33 (servidor nos EUA) e cookies `__Host-`: ver gate no ROADMAP.
