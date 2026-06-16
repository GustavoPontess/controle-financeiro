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
- [ ] **1.1 Filtros de transação ricos** ⭐ flagship UX — back: `TransacaoService.Listar` + `TransacoesController` ganham `contaId`, `cartaoId`, `valorMin`/`valorMax`, `status` (previsto/efetivado), `ordenacao` (data/valor ↑↓), mantendo paginação. Front: `PontesDrawer` de filtros na TransactionsPage + chips de filtro ativo + "Limpar". Testes back+front. _Fonte: Despezzas + Pierre._
- [ ] **1.4 Orçamento simples** — back: `Orcamento` (salário mensal + meta economia) por usuário, GET/PUT. Front: card "Configure seu orçamento" no Dashboard + seção em `/perfil` → "quanto posso gastar" + barra de progresso. _Fonte: Despezzas._
- [ ] **1.3 Variação % vs mês anterior** — nos cards de gasto/categoria (Dashboard, `/reports`): delta vs mês anterior + seta colorida. Dados já existem. _Fonte: Pierre + Despezzas._

### Lote 2 — colaboração / família (o fosso)

- [ ] **2.2 Família REAL — rateio + settle-up** ⭐⭐ FOSSO, maior peso — rateio proporcional de despesa entre membros, saldo "quem deve a quem", quitação. **Spec própria antes de codar** (ampliar `docs/features/familia/`). Quebrar em sub-issues: modelo de dados, cálculo de saldo, UI de divisão no lançamento, tela "acertos".
- [ ] **2.1 Atribuir transação a um membro/responsável** — `Transacao.responsavelId` + filtro + badge na lista. _Fonte: Monarch._
- [ ] **2.3 Papéis/permissões + dependentes** — admin/membro/dependente, permissões por papel, contas de dependente.
- [ ] **2.4 Aprovação de despesa** — despesa acima de X exige aprovação de outro membro (pendente/aprovada).

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

### 🔴 Fixes da auditoria do código herdado (`docs/AUDITORIA_CODIGO_HERDADO.md`) — bloqueiam produção
- [ ] **C1 — reset token vazado na resposta HTTP** (`AuthService`/`AuthController`) = account takeover. Tirar token da resposta + enviar por e-mail.
- [ ] **C2 — contrato de exceção furado** — 67 `throw new Exception(...)` nos services viram HTTP 500 + vazam mensagem. Trocar pelos tipos certos + middleware não ecoar `Message` no 500.
- [ ] **C3 — soft-delete de `Transacao` violado** — `DeletarAsync` faz hard `Remove`; `ListarAsync` não filtra `Ativo`.

### 🟠 Altos
- [ ] **A1/A2 — PasswordHasher** — PBKDF2 10k→≥100k iterações + hash 20→32 bytes (rehash no próximo login).
- [ ] **A3 — segredos no compose/CI versionado** — senha Postgres + JWT_SECRET default hardcoded → `.env`.
- [ ] **A4 — critério de gasto divergente** Orçamento (`CriadoPor`) × Relatório (ownership) — padronizar.
- [ ] **Rotacionar segredos** — `Jwt:Key`, senha Postgres, API keys. Ex-colaboradores tinham clone local. ⚠️

### 🟡 / outros
- [ ] Médios da auditoria (tokens em plaintext, enumeração de usuário, categoria sem filtro de dono, nits Pontes nas telas família/auth, coverage gate no CI) — branch de fixes.
- [ ] **Mergear branches pendentes do Caio:** `feature/114-drop-sqlite` → depois `feature/92-e2e-playwright` (com ajustes — ver auditoria; o 92 esconde mudança de rate-limit no `Program.cs`).
- [ ] **KPIs de topo agregam só 1 página** (Transactions/Recorrentes/Emprestimos/Parcelamentos) — endpoints `/stats` dedicados.
- [ ] **#125 INPI marca Pontes** · **#126 LGPD pré-lançamento** (legais, não-código).
- [ ] **Lint debt:** `ReportsPage.test.tsx` 2 NBSP — é do Gustavo (`bae7d18`), NBSP intencional; resolver com `eslint-disable` ou ` ` escapado.

---

## Processo (futuro, quando atacar feature grande)

**Spec-Driven Development** — antes de feature complexa (rateio família, módulo contador, Open Finance), escrever `docs/features/<feature>/spec.md` (comportamento, regras, casos de uso, edge cases, contrato de API) e só depois codar. Reduz drift. Começar pelo próximo grande pivot (família real).

---

## Branches pendentes (decidir merge)

- `feature/privacy-toggle-ocultar-saldo` — 1.2 entregue, não pushada.
- `feature/paginacao-server-side` — 3 commits, PR pendente.
- `polish/relatorios` — base de outras branches.
- `chore/reorg-docs-solo` — esta reorganização de docs.
