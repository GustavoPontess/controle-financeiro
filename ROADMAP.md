---
owner: Gustavo
last_reviewed: 2026-06-16
status: ATIVO
---

# Roadmap — Pontes

**Fonte única do "o que fazer a seguir".** Backlog vivo do produto. O estado granular do que está em execução agora vive em [`STATE.md`](STATE.md).

> Projeto **solo** (Gustavo). `gh issue` continua sendo usado pra rastrear trabalho no GitHub, mas sem assignee de terceiros.

---

## Onde estamos

- **Q5 2026 fechado:** app inteiro refatorado pra biblioteca **Pontes** (zero MUI), CSS Modules + `var(--pontes-*)`, personalização global (paleta + fonte), paginação server-side real, CI gate. Histórico em `docs/history/` (ISSUES/PROGRESS/IMPLEMENTATION_STATE `_2026Q5`).
- **Frente atual:** features derivadas da análise de concorrentes (Pierre, Despezzas, Monarch). Pesquisa bruta em `docs/concorrentes/`. **Sem gating/plano/preço por enquanto — tudo acessível.**
- **Fosso de produto:** gestão financeira de **casal/família real BR** (rateio "quem paga o quê", papéis, dependentes, acerto). Nenhum concorrente faz bem. Ver `docs/features/familia/visao.md`.

---

## Backlog — features de concorrentes

> Origem: `docs/concorrentes/ACHADOS_ACIONAVEIS.md`. Ordem = quick-wins primeiro, fosso (família) com maior peso de produto.

### Lote 1 — quick-wins (front + dados que já temos)

- [x] **1.2 Privacy toggle (ocultar saldo)** — olho global no navbar, `formatMoney` central, persiste em localStorage, mascara em toda tela. _(branch `feature/privacy-toggle-ocultar-saldo`)_
- [x] **1.1 Filtros de transação ricos** ⭐ flagship → ✅ — **back** (`Listar`+controller: contaId/cartaoId/valorMin-Max/status/ordenacao, 4 testes) + **front** (`PontesDrawer` de filtros na TransactionsPage com conta/cartão/faixa-valor/status/ordenação + **chips** de filtro ativo removíveis + badge de contagem no botão + "Limpar"; service estende `ListTransactionsFilter`, 3 testes). Verificado no preview ponta-a-ponta (valor ≥ R$100 → 20→9 lançamentos). _Fonte: Despezzas + Pierre._
- [x] **1.4 Orçamento no Dashboard** → ✅ — _decisão (alinhada ao mercado): NÃO criar entidade "salário+meta" (modelo rígido/datado) — o `Orcamento` por-categoria já existe e suporta **orçamento geral** (CategoriaId=null). Surfaçamos isso num card **"Orçamento do mês"** no Dashboard ("safe-to-spend" estilo Monarch/YNAB): barra de progresso + "ainda pode gastar X" (tom ok/alerta/estourou), ou CTA "Configurar" → `/limites` se não houver. Frontend puro (zero migration), consome `getOrcamentos`. 2 testes. Verificado no preview (41%, R$4.698 restante)._ _Fonte: Despezzas/Monarch._
- [x] **1.3 Variação % vs mês anterior** → ✅ (Dashboard) — cards "Entrou/Saiu" mostram delta % vs mês anterior + seta colorida (cor por bom/ruim pra métrica). Back: `DashboardDto.EntradasCaixaMesAnterior`/`SaidasCaixaMesAnterior` (mesma base caixa). Verificado no preview com dados reais. _Extensão opcional: replicar em `/reports`._ _Fonte: Pierre + Despezzas._

### Lote 2 — colaboração / família (o fosso)

> ⚠️ **Reconciliação (auditoria 2026-06-17, workflow de 7 agentes):** o fosso **já está construído** ponta-a-ponta (entidades Familia/Membro/Convite/Dependente/RateioTransacao/AcertoContas; services Familia/Rateio/DespesaCompartilhada/Acerto/Dependente; `FamiliasController`; `FamiliasPage`; ~9 migrations; testes fortes). O ROADMAP listava tudo como `[ ]` — **errado**. Status real abaixo. Os gaps reais **não são features faltando**, são **buracos de segurança de app de dinheiro** (ver "Achados da auditoria família" na seção de higiene).

- [~] **2.2 Família REAL — rateio + settle-up** ⭐⭐ FOSSO → **QUASE PRONTO** — rateio (igualitário/proporcional/personalizado) em `RateioService`, balanço "quem deve a quem" + abate por acerto em `DespesaCompartilhadaService`, quitação em `AcertoService`, UI completa na `FamiliasPage`. **Falta:** idempotência no POST de acerto + `FinancialEventLog` (auditoria) — ver P1 na higiene.
- [~] **2.1 Atribuir transação a um membro/responsável** → **PARCIAL** — `Transacao.FamiliaId` existe e despesa é compartilhada via família; **falta** `responsavelId` por-membro + filtro + badge na lista. _Fonte: Monarch._
- [~] **2.3 Papéis/permissões + dependentes** → **PARCIAL** — dependentes completos (`DependenteService`); **papéis são string livre (`MembroFamilia.Papel`), sem enum nem enforcement por papel** (admin/membro/dependente). Falta o controle de permissão real.
- [~] **2.4 Aprovação de despesa** → **BACKEND ✅ / FRONT pendente** — spec em `docs/features/familia/aprovacao-despesa.md`. Backend: `Familia.LimiteAprovacao` + `Transacao.StatusAprovacao` (NaoRequerida/Pendente/Aprovada/Rejeitada) + `AprovadoPor`/`Em`; compartilhar ≥ limite → Pendente (fora do balanço até aprovar); endpoints `PUT /limite-aprovacao` (admin), `POST /despesas/{id}/aprovar|rejeitar` (membro ≠ criador); migration `AddAprovacaoDespesa`; 12 testes. **Falta:** UI na `FamiliasPage` (config de limite + botões aprovar/rejeitar + badge de status no feed) + service/types/testes front.

### Lote 3 — aquisição / SEO (site público)

- [ ] **3.1 Tela de Assinaturas** — derivar de `Recorrente`: agrupar recorrências, total/mês, projeção anual. _Fonte: Pierre, Despezzas, Monarch._
- [ ] **3.2 Ferramentas grátis + comparações** — páginas públicas `pages/Site/ferramentas/`: juros compostos, CLT×PJ. SEO "sem cadastro". _Fonte: Despezzas, Monarch, Qive._
- [ ] **3.3 Fotografia lifestyle de casal/família** em `/casais` e `/contadores`. _Fonte: Monarch._
- [ ] **3.4 Programa de indicação (referral)** — código por usuário + "Convide e ganhe". _Fonte: Despezzas + Monarch._

### Lote 4 — eixo PJ / contador (futuro)

- [ ] **4.1 Wedge PJ leve + ponte contador** — separar PF/PJ, módulo NF simples, conexão com contador (referência Conta Azul). Spec dedicada antes de codar. Ver `docs/features/b2b-contadores/visao.md`.

### Lote 5 — estratégico (caro, longo)

- [ ] **Open Finance / agregação** — gap nº 1, table-stakes. Via Pluggy ou Belvo, começa com 1 banco. Despezzas e Pierre já têm.
- [ ] **IA conversacional / categorização automática**.
- [ ] **App mobile / PWA** (PWA base já existe).

---

## Higiene / dívida conhecida

> **Prioridade (protocolo de triagem — `PROMPT_NOVA_SESSAO.md` §8.5):** **P0** 🔴 bloqueador/segurança crítica (fura fila, vira o próximo; se bloqueia o trabalho atual, parka a branch e troca) · **P1** 🟠 alta · **P2** 🟡 média · **P3** ⚪ baixa. **Todo achado entra aqui com nível, na hora.**

### 📥 Achados a triar (intake)
- _(vazio — quando algo for descoberto e ainda não classificado/encaixado, cai aqui primeiro com um nível provisório, depois é movido pra seção certa.)_

### 🏠 Achados da auditoria família (2026-06-17) — segurança de app de dinheiro
> Auditoria por workflow (7 agentes) do módulo família. Fosso construído; gaps = safety holes. **P1 fechado em PR #221 (`a331efa`).**
- [x] **P1 🟠 — `AcertoService.CancelarAsync` sem checar dono** (authz hole) → ✅ — só criador OU participante (de/para) cancela; terceiro → `ForbiddenAccessException` (403). PR #221.
- [x] **P1 🟠 — POST `/acertos` sem idempotência** → ✅ — `idempotencyKey` no DTO + `BuscarPorIdempotencyKeyAsync` (padrão `ParcelamentoService`); front gera UUID estável por tentativa. PR #221.
- [x] **P1 🟠 — acerto sem `FinancialEventLog`** → ✅ — `AcertoRegistrado`/`AcertoCancelado` gravados em registrar/cancelar. PR #221.
- [x] **P2 🟡 — `FamiliasPage` `ehProprio` hardcoded `true`** → ✅ — `ehProprio = m.usuarioId === currentUser?.id` (via `useAuth`); botão remover só aparece pro próprio membro (sair) ou pra admin removendo outro; criador nunca removível; label dinâmico "Sair da família"/"Remover membro". 3 testes. _branch `fix/familia-remover-membro-ehproprio`._
- [ ] **P3 ⚪ — papéis (2.3) + aprovação de despesa (2.4)** — sem enum de papel/enforcement; compartilhar é unilateral. Feature, não bug. Ver Lote 2.
- _Descartado (não é bug):_ `RateioService.RemoveRange` hard-delete de `RateioTransacao` — é config de split substituída por inteiro na edição, **não** entidade de ledger; soft-delete não se aplica.

### 🔒 Sprint de Auth Hardening (spec em `docs/SEGURANCA_BEST_PRACTICES.md`, verificado OWASP/NIST)
- [x] **C1 — reset token vazado na resposta HTTP** 🔴 = account takeover. **Corrigido:** token fora da resposta (DTO só com `Mensagem` genérica idêntica), geração+e-mail **fire-and-forget** (Hangfire `PasswordResetEmailJob` + `IPasswordResetEmailSender`) → sem timing/enumeração. 6 testes de regressão. _OWASP Forgot Password._
- [x] **C2 — contrato de exceção furado** 🔴 → ✅ — os 67 `throw new Exception(...)` viraram tipos certos (404/400/409/401 conforme semântica) e o middleware **não ecoa mais `Message` no 500** (mensagem genérica; detalhe só no log). 5 testes do middleware + 26 asserts de teste atualizados. _Follow-up registrado: distinguir 403 (ownership) de 401 (auth) — hoje 401 desloga; pré-existente em ~32 sites._
- [x] **C3 — soft-delete de `Transacao` violado** 🔴 → ✅ — `DeletarAsync` agora faz soft delete (`Ativo=false` + `Cancelado` + `CanceladoEm` + motivo, padrão do `TransferenciaService`) e foi adicionado **global query filter** `HasQueryFilter(t => t.Ativo)` no `Transacao` → toda query/navegação (saldo, listagem, dashboard, relatório, totais de fatura) exclui canceladas automaticamente. Corrige de quebra o caso real do bug (pernas de transferência soft-deleted apareciam na lista). 3 testes de regressão.
- [x] **A1/A2 — PasswordHasher** 🟠 → ✅ — migrado p/ **Argon2id** (Konscious v1.3.1, OWASP 1ª escolha) m=19456/t=2/p=1, salt 16B, **saída 32B** (era 20), formato versionado `ARGON2ID$...` + **rehash transparente no login** (verifica hash legado PBKDF2, regrava no esquema atual sem forçar reset). 8 testes. _Deep-research OWASP/NIST. Pepper (NIST SHOULD) fica de follow-up com a rotação de segredos._
- [x] **Reset token hasheado** no banco + **rate-limit por conta** + **política 15 chars** → ✅ — token guardado como SHA-256 (`OpaqueTokenHasher`), bruto só no e-mail; rate-limit 3/conta/hora no `PasswordResetEmailJob` (+ 1/IP/15min no endpoint); política 10→15 + teto 128 (front e back). 11 testes.
- [x] **Re-auth em operação sensível + cookie HttpOnly + CSP** → ✅ — troca de senha já exige senha atual (`ChangePasswordAsync`); não há troca de e-mail/delete de conta (nada mais a re-autenticar); jwt+refresh confirmados em cookie HttpOnly+Secure+SameSite=Strict; **`SecurityHeadersMiddleware`** adiciona CSP (estrita p/ API, relaxada p/ Swagger/Hangfire) + nosniff + X-Frame DENY + Referrer + Permissions + HSTS(HTTPS). 5 testes.
- [ ] **A4 — critério de gasto divergente** Orçamento (`CriadoPor`) × Relatório (ownership) — padronizar.
- [x] **⚠️ Rotacionar segredos — DEV** ✅ (2026-06-17) — `JWT_SECRET` + senha Postgres novos (aleatórios) nos `.env` locais; volume do Postgres recriado; API + login verificados. Chave de dev antiga invalidada. **Falta só prod:** gerar segredos frescos no secret manager quando houver deploy (nunca reusar os de dev). A chave nunca esteve no git.
- [ ] **Pepper de senha (NIST SHOULD)** — segredo server-side por cima do Argon2id, guardado separado do banco (KMS/HSM/env). Ponto de extensão já existe (`Argon2id.KnownSecret` no `PasswordHasher`). Fazer junto da gestão/rotação de segredos.
- [x] **A3 — segredos no compose/CI versionado** → ✅ — `docker-compose.yml` deixou de hardcodar senha Postgres e o `JWT_SECRET` default fraco; agora exige `${POSTGRES_PASSWORD:?}` e `${JWT_SECRET:?}` (falha-rápido sem default). `.env.example` na raiz + `.env` gitignored; CI passa valores efêmeros. Validado com `docker compose config`. **Falta só a metade manual (valores reais) — ver "Rotação de segredos" abaixo.**
- [x] **403 (ownership) × 401 (auth)** → ✅ — criado `ForbiddenAccessException`→403; **27 sites** de ownership/autorização (Categoria, Conta, Convite, Dependente, DespesaCompartilhada, Familia, Fatura, Meta, Rateio, Recorrente, Subcategoria) remapeados de 401→403; os 6 de **autenticação real** do `AuthService` (login/refresh/senha) ficam 401. O interceptor do front só desloga em 401 → erro de permissão não desloga mais (mostra a mensagem). 14 asserts de teste + caso 403 no middleware. Convenção atualizada em `PROMPT_NOVA_SESSAO.md` §11.

### 🔬 Re-pesquisar (gaps que o rate-limit cortou) antes de codar
- [ ] **Rotação de segredos / key rollover** da JWT key sem downtime · **MFA no .NET** (TOTP/passkeys) · **cripto-at-rest / PII em EF Core** · **logging/auditoria** · **LGPD + BACEN/Open Finance**. Deep-research verificado por fonte primária.

### 🟡 / outros
- [x] **P2 — Refresh token em plaintext no banco** → ✅ — `RefreshToken.Token` agora é guardado como hash (SHA-256 via `OpaqueTokenHasher`); o bruto vai só pro cookie. `CriarRefreshTokenAsync` devolve `(entity, bruto)`; refresh/logout fazem lookup por hash. Vazamento de DB não dá refresh tokens reutilizáveis. 3 testes.
- [x] **P2 — CSP no SPA (frontend prod)** → ✅ — headers de segurança + CSP estrita no `nginx.conf` que serve o SPA buildado (`default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` p/ estilos inline do React, `connect-src` pro API, `frame-ancestors 'none'`, nosniff, X-Frame DENY, Referrer, Permissions). Dev (Vite) não passa por nginx → HMR intacto. Verificado via build+curl. _⚠️ prod real: ajustar `connect-src` pro domínio do API (e o baseURL hardcoded do axios)._
- [ ] **P2 — Política: remover regras de composição (NIST)** — NIST SP 800-63B recomenda NÃO exigir maiúscula/número/símbolo (leva a senhas previsíveis tipo `Password1!`); com mín. 15 + blocklist já basta. Hoje `PasswordPolicyService` ainda exige as 4 classes. Mudança de UX — decidir antes. _Documentado em `docs/SEGURANCA_BEST_PRACTICES.md` §2._
- [ ] Médios da auditoria (enumeração de usuário, categoria sem filtro de dono, nits Pontes nas telas família/auth, coverage gate no CI) — branch de fixes.
- [x] **#114 Postgres único + #92 E2E** mergeados na main, auditados e limpos. Dev exige Postgres no ar.
- [x] **Versionamento** — SemVer 0.x, CHANGELOG, `docs/RELEASING.md`, release `v0.9.0`.
- [x] **Ex-colaboradores apagados** do repo (autoria/co-autoria/branches/site/co-autoria-IA) + histórico linearizado.
- [ ] **KPIs de topo agregam só 1 página** (Transactions/Recorrentes/Emprestimos/Parcelamentos) — endpoints `/stats` dedicados.
- [ ] **#125 INPI marca Pontes** · **#126 LGPD pré-lançamento** (legais, não-código).
- [x] **Lint debt NBSP** resolvido (escape `\u00A0` no ReportsPage.test, comportamento idêntico).

---

## 🚦 Gate de lançamento `1.0.0` (conformidade obrigatória)

> **Regra inegociável** (também em `CLAUDE.md`): app de dinheiro + dados pessoais. **Antes de lançar, pesquisar e aplicar prática bancária/fintech + LGPD + regras regulatórias (ANPD; BACEN/Open Finance se aplicável) e respeitar TODAS as regras impostas.** `1.0.0` só sai com:

- [ ] Sprint de Auth Hardening fechado (🔴 C1/C2/C3 + 🟠)
- [ ] Segredos rotacionados
- [ ] Pesquisa de conformidade completa (LGPD: base legal, direitos do titular, minimização, DPO, RIPD; e se BACEN/Open Finance se aplica) — `#126`
- [ ] Gaps de segurança re-pesquisados e fechados (`docs/SEGURANCA_BEST_PRACTICES.md`)

---

## Processo (futuro, quando atacar feature grande)

**Spec-Driven Development** — antes de feature complexa (rateio família, módulo contador, Open Finance), escrever `docs/features/<feature>/spec.md` (comportamento, regras, casos de uso, edge cases, contrato de API) e só depois codar. Reduz drift. Começar pelo próximo grande pivot (família real).

---

## Branches pendentes (decidir merge)

- `feature/privacy-toggle-ocultar-saldo` — 1.2 entregue, não pushada.
- `feature/paginacao-server-side` — 3 commits, PR pendente.
- `polish/relatorios` — base de outras branches.
- `chore/reorg-docs-solo` — esta reorganização de docs.
