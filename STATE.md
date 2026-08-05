---
owner: Gustavo
last_reviewed: 2026-07-20
status: EM_PROGRESSO
foco: 'Empréstimo compartilhado pronto (back+front), branch aberta sem PR ainda. Próximo: decidir cleanup + push, depois spec do fluxo pagamento-com-comprovante.'
---

# STATE — onde parei

**Estado vivo da sessão.** Só duas coisas: o que está em execução agora e a próxima ação concreta. Backlog completo em [`ROADMAP.md`](ROADMAP.md).

> Atualizar ao fim de toda sessão que mexeu em código/docs. Substitui o antigo `IMPLEMENTATION_STATE.md` (Q2-Q5 em `docs/history/`).

---

## Em execução

**Empréstimo compartilhado (vínculo bilateral)** — spec em `docs/features/emprestimo-compartilhado/spec.md`, **backend + frontend completos e testados**, mas **branch `feature/emprestimo-compartilhado` ainda não pushada, sem PR**. 3 commits locais: spec, backend, frontend. Verificado end-to-end no browser real (criar → vincular → copiar link → 2ª conta aceita → gate de autorização confirmado).

**Working tree tem mudanças NÃO commitadas agora** (feitas depois do commit de frontend, em cima da mesma branch):
- `.gitignore` + `ControleFinanceiro.Api/Program.cs` — wiring via reflection do `MeuCenarioSeeder.cs` (novo arquivo, **gitignored de propósito**, não aparece no `git status`). Compilação testada com e sem o arquivo presente.
- `ROADMAP.md` — 5 achados novos catalogados no intake (ver seção própria abaixo).
- `controle-financeiro.web/src/pages/Auth/LoginPage.tsx` + `.module.css` — painel DEV do login virou lista (3 contas fictícias do seeder + extensível via `.env` local `VITE_DEV_LOGIN_EXTRA`, gitignored).
- `docs/concorrentes/the-box-app/` — prints novos, untracked, seguro comitar (só UI de concorrente).

**Pendências reais, na ordem:**
1. Decidir: limpar dado de teste do banco de dev (empréstimo "Ajuda com aluguel atrasado" em `dev@controle.test` + conta `terceira.pessoa@teste.com`, ambos criados durante a verificação manual) — Gustavo ainda não respondeu.
2. Commitar as mudanças soltas acima (provavelmente 1-2 commits pequenos na mesma branch).
3. Push + abrir PR de `feature/emprestimo-compartilhado`.
4. Servidores locais (backend 5293, frontend 5173, Postgres) — **estavam no ar** no fim da sessão; confirmar se ainda estão ou se precisam subir de novo (`docker compose up -d postgres`, `dotnet run`, `npm run dev`).

**Achados novos catalogados no ROADMAP (intake), gerados testando o fluxo ao vivo:**
- 🟠 P1 — pagamento com comprovante + aprovação do credor (hoje só o credor age; devedor não tem ação nenhuma). Reaproveitar arquitetura da 2.4 (aprovação de despesa). **Próxima spec a escrever.**
- 🟡 P2 — Empréstimo ↔ Conta/Transacao real (mesma questão crítica não resolvida do §16.5 de `familia/visao.md`, agora em 2 features).
- 🟡 P2 — parcelamento do empréstimo + extrato embutido no detalhe.
- ⚪ P3 — agrupar/unificar empréstimos por pessoa (depende dos 2 P2 acima).
- ⚪ P3 — gesto "toque duplo na traseira" (achado no concorrente the-box-app) — **ressalva técnica:** é recurso nativo do iOS via Atalhos, não dá pra implementar direto num PWA.

**Sobre o `MeuCenarioSeeder.cs` (arquivo local, gitignored):** criado com placeholders — Gustavo edita com dados reais dele + da pessoa pra quem empresta (nome/e-mail/limite de cartão/valor do empréstimo) antes de rodar. Popula os 2 usuários já **vinculados** (pula o convite). Nunca vai pro Git — é por isso que não aparece em `git status`.

> ⚠️ **Lição registrada 2026-07-17, reforçada agora:** este arquivo tinha ficado ~1 mês sem atualizar antes. Setar o hábito de passar pela seção 9 do `PROMPT_NOVA_SESSAO.md` ao encerrar qualquer sessão — inclusive quando a sessão "não termina" de vez (compactação de contexto) precisa desse registro pra não se perder.

## Próxima ação concreta

1. Responder as 2 perguntas em aberto (limpar dado de teste? push+PR agora?).
2. Commitar `.gitignore`/`Program.cs`/`ROADMAP.md`/`LoginPage.*` soltos.
3. Push + PR de `feature/emprestimo-compartilhado`.
4. Escrever spec do fluxo **pagamento com comprovante + aprovação do credor** (P1 do intake acima) — reaproveitando o padrão de `Familia.LimiteAprovacao`/`Transacao.StatusAprovacao` (2.4). Spec antes de codar, mesmo padrão desta sessão.
5. Depois: 2.3-frontend (papéis/permissões) continua pendente de sessões anteriores, sem prioridade nova — ver "Depois" abaixo.

**Depois — escolha de direção** (decidir com o Gustavo):
- **2.3-frontend** (badge de papel, convite com papel, promover/rebaixar, gates de UI) — ainda pendente, sem trabalho nesta sessão.
- **Lote 3 (aquisição/SEO):** tela de Assinaturas, ferramentas grátis, referral.
- **Conformidade — pesquisa LEVE** (§8.6): LGPD #126 (base legal, direitos do titular, minimização, DPO/RIPD; e se BACEN/Open Finance se aplica). Tem componente legal/decisão.
- **P2 restante:** dropar regras de composição da senha (NIST) — decisão de UX do Gustavo (afrouxa a senha).
- **Deploy (futuro):** rotacionar segredos de prod; ajustar `connect-src` do CSP + baseURL hardcoded do axios pro domínio real.

---

## Entregue (2026-07-20)

- **Empréstimo compartilhado — vínculo bilateral (spec + backend + frontend)** ✅ — spec em `docs/features/emprestimo-compartilhado/spec.md` (validada contra OWASP API1:2023/BOLA, Pix Automático do Bacen, e Splitwise antes de codar). Backend: migration `AddVinculoEmprestimo`, fluxo de convite por e-mail com token hasheado (`OpaqueTokenHasher`, mesmo padrão do reset/refresh), autorização assimétrica de confirmação por `Tipo` (credor do registro específico, não só `CriadoPor`), soft-delete (bug do EF `defaultValue: false` corrigido antes de aplicar — teria apagado empréstimos existentes), `FinancialEventLog`, idempotência. Frontend: badge de vínculo + gate de pagamento/quitar por `souCredor`, modal de vincular com link pra copiar (sem envio de e-mail automático — projeto não tem SMTP real), seção de convites pendentes in-app (aceite sem token, por e-mail autenticado), landing pública `/convite/emprestimo/:token`. Back 323/323, front 317/317, 0 warning. **Verificado end-to-end no browser real com 2 contas** (não só teste automatizado): perspectiva invertida certa nos dois lados, gate de autorização confirmado (devedora não vê botão de pagamento).
- **Doc reconciliation** (início da sessão, antes do empréstimo) — PRs #232/#233/#234 mergeados: `STATE.md`/`ROADMAP.md` reconciliados contra `gh pr list` (1 mês sem review), exemplos MUI trocados por Pontes em `CLAUDE.md`/`STANDARDS.md`, item 2.2 corrigido (marcado "falta" já resolvido há semanas). Branch `claude/shared-loan-feature-d4327e` (nome não-conforme, criada pelo harness) apagada; convenção `feature/<slug>` retomada.
- **Seeder pessoal de dogfooding** — `Data/MeuCenarioSeeder.cs` (gitignored) + wiring via reflection em `Program.cs` (compila com ou sem o arquivo — CI/outros checkouts não quebram). Resolve o pedido de testar com cenário real sem colocar dado financeiro real ou de terceiro no Git.
- **Painel DEV do login virou lista** — 3 contas fictícias do seeder + extensível via `.env` local (`VITE_DEV_LOGIN_EXTRA`, gitignored).

## Entregue (2026-06-22)

- **UI da família — lista com cards ricos + página de detalhe** ✅ (branch `feat/familia-pagina-detalhe`, PR #233) — `/familias`: lista virou cards ricos (avatares + nomes dos membros, papel, chip do modo de rateio, seu saldo do mês "a receber / a acertar / quitado") clicáveis → detalhe em página dedicada `/familias/:id`. Detalhe extraído no componente reutilizável `FamiliaDetalhe` + casca fina `FamiliaDetalhePage`; resumo dos cards buscado por cima da lista (`getFamilia`+`getBalancoFamilia`). Mata a modalzona antiga (tudo empilhado).
- **Copy:** "deve" → "acerto / equilíbrio / a acertar / a receber" em todo contexto de casal (app `FamiliaDetalhe` + site Casais/Home/Sobre). "Deve" pesa como cobrança num relacionamento.
- **Login:** atalho de credenciais de teste (`dev@controle.test`) no canto inferior direito, clicável p/ autopreencher — só em DEV (`import.meta.env.DEV`), nunca em prod.
- tsc + lint limpos, 52 testes de família verdes, verificado no preview (cards, clique→detalhe, voltar, zero erro de console).
- **Abandonado:** export do DS pro "Claude Designer" (refazer o front existente lá dava muito retrabalho e frustração). Pasta `docs/ds-export/` apagada — não vai pro repo.
- _Ficou pronta e commitada em 2026-06-22 mas só ganhou PR/merge em 2026-07-17 — motivo de mais um mês sem review dos arquivos de estado._

## Entregue (2026-06-18) — reconstruído via `gh pr list`, nunca tinha sido registrado aqui

- **2.4 Aprovação de despesa** ✅ — back (PR #224): `Familia.LimiteAprovacao` + `Transacao.StatusAprovacao`, endpoints de aprovar/rejeitar, migration, 12 testes. Front (PR #225): config de limite, badge de status, botões aprovar/rejeitar.
- **2.1 Responsável de despesa** ✅ (PR #226) — `Transacao.ResponsavelUsuarioId`, atribuição por qualquer membro, filtro no feed.
- **2.3 Papéis/permissões — backend** ✅ (PR #228) — enum `PapelFamilia`, `FamiliaPermissoes` central nos 6 services, endpoint de permissão. Back 294/294. Front ainda não feito.
- **CI: zero warnings + GitHub Actions Node 24** ✅ (PR #227).
- **Vitrine do design system** ✅ — tokens de espaçamento/radii/sombras (PR #229), aba "Espaço & Efeitos" + fonte de título corrigida (PR #230).
- **Flake `CreditCardsPage` (CI vermelho)** ✅ (PR #231) — race de auto-foco + data hardcoded corrigidos.

## Entregue (2026-06-17)

- **Auditoria do módulo família (workflow 7 agentes)** ✅ — mapeou back+front+testes e reconciliou contra o ROADMAP. Veredito: fosso construído ponta-a-ponta com testes fortes; gaps reais = segurança de app de dinheiro. Status do Lote 2 corrigido no ROADMAP; achados catalogados (P1/P2/P3).
- **Acerto de contas endurecido (P1, branch `fix/familia-acerto-safety`)** 🟠→✅ — (1) **authz no cancelamento** (`AcertoService.CancelarAsync`): só criador ou partes (de/para) cancelam → `ForbiddenAccessException` (era: qualquer membro cancelava acerto alheio); (2) **idempotência** no POST `/acertos` (`idempotencyKey` no DTO + `BuscarPorIdempotencyKeyAsync`, padrão `ParcelamentoService`; front gera UUID estável por tentativa, reusa no retry); (3) **`FinancialEventLog`** (`AcertoRegistrado`/`AcertoCancelado`) em registrar/cancelar. Back 266/266 (+novos casos: replay idempotente, 403 de terceiro, cancel por participante, audit log); front 295/295 (+teste de service); build+lint verdes. _Descartado como não-bug: hard-delete de `RateioTransacao` (config de split, não ledger)._

## Entregue nesta sessão (2026-06-16)

- **1.3 Variação % vs mês anterior** ✅ (1ª feature de produto pós-segurança) — cards "Entrou/Saiu" do Dashboard ganham delta % vs mês anterior + seta colorida. Back: `EntradasCaixaMesAnterior`/`SaidasCaixaMesAnterior` no `DashboardDto`/service. 1 teste back + 2 front; verificado no preview (real: Entrou +10% verde, Saiu +6% vermelho).
- **CSP do SPA (frontend prod)** (P2) ✅ — `nginx.conf` que serve o build ganhou CSP estrita + headers de segurança (nosniff, X-Frame DENY, Referrer, Permissions). Dev/Vite não passa por nginx (HMR intacto). Verificado via build+curl. Prod real precisa ajustar `connect-src` + baseURL hardcoded do axios.
- **403 (ownership) × 401 (auth)** (P2) ✅ — `ForbiddenAccessException`→403; 27 sites de ownership remapeados (401→403); AuthService mantém 401 só pra autenticação real. Front não desloga mais em erro de permissão (interceptor só age em 401). Convenção em `PROMPT §11`. 14 asserts + caso 403 no middleware (back 255/255).
- **Refresh token hasheado no banco** (P2) ✅ — `RefreshToken.Token` virou hash SHA-256 (`OpaqueTokenHasher`); bruto só no cookie; `CriarRefreshTokenAsync` devolve `(entity, bruto)`; refresh/logout por hash. 3 testes (back 254/254).
- **Rotação dos segredos de DEV** ✅ — `JWT_SECRET` + senha Postgres novos (aleatórios, `openssl`) nos `.env` locais; Postgres recriado (volume novo) com a senha nova; API reseedada + login do dev verificado (cookie jwt assinado pela chave nova). Chave de dev antiga morta. (Prod fica pra quando deployar.)
- **A3 — segredos fora do compose/CI versionado** 🟠→✅ (código) — compose exige `${POSTGRES_PASSWORD:?}`/`${JWT_SECRET:?}` (sem default fraco), `.env.example` raiz + `.env` gitignored, CI passa valores efêmeros. Validado `docker compose config` (resolve com .env; falha sem). Confirmado: chave real **não está no git**.
- **Re-auth + CSP/headers** 🟠→✅ — verificado que troca de senha exige senha atual e que jwt+refresh estão em cookie HttpOnly+Secure+SameSite=Strict (não há troca de e-mail/delete); `SecurityHeadersMiddleware` novo: CSP (estrita p/ API, relaxada p/ Swagger/Hangfire) + nosniff + X-Frame DENY + Referrer + Permissions + HSTS(HTTPS). 5 testes (back 251/251). Headers confirmados ao vivo via curl.
- **Reset token hasheado + rate-limit por conta + política 15 chars** 🟠→✅ — token guardado como SHA-256 (`OpaqueTokenHasher`), bruto só no e-mail; rate-limit 3/conta/hora no job; política 10→15 + teto 128 (front e back, com testes ajustados). Achados catalogados (P2): refresh token plaintext, NIST dropar composição. Back 246/246, front 287/287.
- **A1/A2 — PasswordHasher** 🟠→✅ — migrado p/ **Argon2id** (Konscious, m=19456/t=2/p=1, salt 16B, saída 32B), formato versionado + **rehash transparente no login** (aceita hash legado PBKDF2, regrava sem reset). Decisão por **deep-research verificado** (OWASP/NIST, 24/25 claims). 8 testes (back 238/238).
- **C3 — soft-delete de `Transacao`** 🔴→✅ — `DeletarAsync` virou soft delete (`Ativo=false`+`Cancelado`+`CanceladoEm`+motivo) e **global query filter** `HasQueryFilter(t => t.Ativo)` no `Transacao` exclui canceladas de toda query/navegação. Corrige de quebra pernas de transferência soft-deleted que apareciam na lista. 3 testes (back 230/230).
- **C2 — contrato de exceção** 🔴→✅ — 67 `throw new Exception(...)` → tipos certos (404/400/409/401 por semântica); `GlobalExceptionHandlerMiddleware` deixou de ecoar `Message` no 500 (genérico; detalhe só no log). 5 testes do middleware + 26 asserts atualizados (back 227/227). Conversão feita via workflow (9 services em paralelo + verificação adversarial).
- **C1 — reset token não vaza mais** 🔴→✅ — `/forgot-password` responde genérico e idêntico pra qualquer e-mail; geração de token + envio agora é **fire-and-forget** (`HangfirePasswordResetDispatcher` → `PasswordResetEmailJob` → `IPasswordResetEmailSender`). Mata account takeover + timing/enumeração. 6 testes de regressão (back 222/222).
- **Flaky test `RecorrentesPage`** corrigido — `getAllByTitle` síncrono → `await findAllByTitle` (header estático rendava antes das rows async). PR #204.
- **Reorg de docs (solo)** — modelo `ROADMAP` + `STATE`; Q5 arquivado; COLLABORATION deletado; QUICK_REFERENCE/CLAUDE/PROMPT/GIT_WORKFLOW atualizados; `docs/` limpo (redesign-ux Q4 → history, ponteiros consertados).
- **Auditoria do código herdado** — `docs/AUDITORIA_CODIGO_HERDADO.md`. 3 🔴 (C1/C2/C3) + altos.
- **Branches consolidadas na `main`** — #114 (Postgres único) + #92 (E2E Playwright) cherry-picked; fix crítico de boot (Npgsql legacy timestamp órfão pós-#114) achado pelo CI.
- **CI E2E via docker compose** — robusto (corrigiu compose quebrado: API porta 8080→5293).
- **Caio + João apagados do repo** — autoria reescrita (196 commits → só Gustavo), **132 co-autorias do Claude removidas** da história, histórico **linearizado** (sem merge commit), removidos do site (Sobre) e das branches. Refs órfãs limpas.
- **Versionamento** — SemVer 0.x; `CHANGELOG.md` + `docs/RELEASING.md` (processo); release **`v0.9.0`** publicada. `1.0.0` reservado pro lançamento público.
- **Pesquisa de segurança** — deep-research verificado (OWASP/NIST) → `docs/SEGURANCA_BEST_PRACTICES.md`. Gaps abertos (rate-limit cortou): MFA-.NET, rotação de segredos, cripto-at-rest, logging, LGPD/BACEN — **re-pesquisar**.
- **Regra de conformidade gravada** (CLAUDE.md): sempre pesquisar prática bancária + LGPD + regulatório antes de lançar.
