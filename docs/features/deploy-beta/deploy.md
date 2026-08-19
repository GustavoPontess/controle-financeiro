# Deploy do beta — Fly.io + Neon + Vercel

Passo a passo pra colocar o Pontes no ar pela primeira vez. Infra escolhida em 2026-08-18: backend
sempre ligado (sem cold start) no Fly.io (~$7-10/mês), Postgres grátis permanente no Neon, frontend
grátis no Vercel. Custo total esperado ~R$40-55/mês.

**Passos que só o Gustavo pode fazer** (criar conta, inserir cartão, login interativo no browser) —
o resto (código, `fly.toml`, `vercel.json`) já está pronto no repo.

## 1. Neon (banco)

1. Criar conta em https://neon.tech (grátis, sem cartão).
2. Criar um projeto novo → banco Postgres.
3. Copiar a connection string que o Neon mostra (formato `postgres://user:pass@host/db`).
4. **Converter pro formato que o Pontes espera** (Npgsql, não URI):
   ```
   Host=<host-do-neon>;Port=5432;Database=<nome-do-banco>;Username=<user>;Password=<senha>;SSL Mode=Require;Trust Server Certificate=true
   ```
   Guardar esse valor — vai virar `DATABASE_URL` no passo 3.

## 2. Fly.io (backend)

1. Instalar a CLI: `curl -L https://fly.io/install.sh | sh` (ou `iwr https://fly.io/install.ps1 -useb | iex` no PowerShell).
2. Criar conta + cartão em https://fly.io (login interativo, abre o browser):
   ```bash
   fly auth login
   ```
3. Dentro de `ControleFinanceiro.Api/` (onde já está o `fly.toml` pronto):
   ```bash
   fly apps create pontes-api   # ou outro nome, se "pontes-api" já existir — daí ajustar
                                  # o campo `app` no fly.toml e o connect-src do vercel.json
   ```
4. Gerar um `JWT_SECRET` novo (nunca reusar o de dev):
   ```bash
   openssl rand -base64 48
   ```
5. Setar os segredos (nunca em arquivo versionado):
   ```bash
   fly secrets set \
     JWT_SECRET="<gerado no passo 4>" \
     DATABASE_URL="<connection string do Neon, passo 1.4>" \
     CORS_ALLOWED_ORIGINS="https://<domínio-do-vercel>" \
     HANGFIRE_ADMIN_EMAILS="<seu-email-de-login-no-pontes>"
   ```
   (`CORS_ALLOWED_ORIGINS` fica provisório até o passo 4 — o domínio do Vercel só existe depois do deploy dele.)
6. Deploy:
   ```bash
   fly deploy
   ```
   As migrations aplicam sozinhas no startup (`Program.cs` já roda `MigrateAsync` automático).
7. Confirmar que subiu: `fly status`, e testar `https://pontes-api.fly.dev/health` (deve responder 200).

## 3. Vercel (frontend)

1. Criar conta em https://vercel.com (grátis, login com GitHub facilita).
2. "Add New Project" → conectar o repo do Pontes → apontar o **root directory** pra
   `controle-financeiro.web/`.
3. Nas configurações do projeto, adicionar a env var:
   - `VITE_API_BASE_URL` = `https://pontes-api.fly.dev/api/v1` (ou o domínio real escolhido no passo 2.3)
4. Deploy (automático). O `vercel.json` já cuida do rewrite de SPA e dos headers de segurança —
   só conferir se o `connect-src` da CSP (dentro do `vercel.json`) bate com o domínio real do Fly.io
   escolhido; se mudou o nome do app no passo 2.3, ajustar esse arquivo antes do deploy.

## 4. Fechar o CORS

Depois que o Vercel gerar o domínio real (ex. `pontes.vercel.app` ou um domínio próprio):
```bash
fly secrets set CORS_ALLOWED_ORIGINS="https://<domínio-real-do-vercel>"
```

## 5. Smoke test

No domínio real: criar conta, fazer login, criar uma transação de teste, criar um empréstimo de
teste, checar `/health` e `/health/ready` no domínio do Fly.io. Confirmar que `/hangfire` só abre
pro e-mail que está em `HANGFIRE_ADMIN_EMAILS`.

## Referências

- `ControleFinanceiro.Api/fly.toml` — config do Fly.io (health check, sempre 1 máquina ligada).
- `controle-financeiro.web/vercel.json` — rewrite SPA + CSP/headers.
- `docs/CONFORMIDADE_BR.md` — pesquisa de conformidade que autorizou o beta a ir ao ar.
- `ROADMAP.md` → "Gate de lançamento" → "Beta fechado" — checklist completo do que foi feito antes deste deploy.
