---
owner: Gustavo
last_reviewed: 2026-05-29
status: Q5 FECHADO + paginação real entregue
issue_atual: 'nenhuma — PR aberto pendente, depois pegar próxima'
---

## Estado atual — Q5 fechado + paginação real

Sessão 2026-05-29 (parte 2) atacou bug crítico de paginação descoberto durante revisão da `TransactionsPage`. Front pedia `pageSize=1000`, backend clampava em 100 silenciosamente, usuário com 247 transações via 100 sem saber. Consertado fim-a-fim: backend (filtros opcionais + default 25), 5 services (envelope `PagedResult<T>`), 5 telas (server-side real), `PontesTablePagination` novo no DS.

**Working tree:** branch `feature/paginacao-server-side` com 3 commits prontos. Backend rodando local em :5293. Aguardando PR + merge.

**Issues abertas (4):** só infra opcional + legal — nada de UI.
- **#92** — Cobertura E2E Playwright expandir (média)
- **#114** — Remover SQLite (Postgres provider único) (baixa)
- **#125** — INPI marca Pontes (legal, não-código)
- **#126** — LGPD pré-lançamento (legal, não-código)

**Caveats novos (não bloqueiam, mas vale issue dedicada):**
- KPIs do topo das 5 telas paginadas (`TransactionsPage`, `Recorrentes`, `Emprestimos`, `Parcelamentos`) agregam 1 página de 100 itens — quem tiver >100 vê stats imprecisos. Fix correto: endpoints `/stats` dedicados por tela.
- Filtros server-side só em `TransacaoService` (`from`/`to`/`categoriaId`) e `ParcelamentoService` (`ativo`). Outras 3 ainda sem filtros — adicionar quando UI precisar.

**Próxima ação concreta:** Gustavo decide entre (a) endpoints `/stats` dedicados (médio esforço, alta qualidade), (b) #114 drop SQLite, (c) #92 E2E, ou (d) parar.

---

## Sessão 2026-05-29 — fechou Q5 (25 PRs mergeados)

Sequência completa do dia, em ordem de merge:

### Refator MUI→Pontes (em massa, sobraram os monstros)
- **#157 (#151)** TransferenciasPage MUI→Pontes + validação por campo
- **#158 (#152)** EmprestimosPage MUI→Pontes + validação
- **#159 (#153)** ParcelamentosPage (index + detalhe) MUI→Pontes
- **#162 (#154)** ImportacaoPage MUI→Pontes
- **#164 (#150)** ReportsPage MUI→Pontes
- **#165 (#149)** TransactionsPage MUI→Pontes (maior bloco legado, ~500 MUI)
- **#147** boy-scout: NewContaDialog (modal Nova Conta) MUI→Pontes + validação
- **#148** quick win: SettingsPage MUI→Pontes

### Infra / personalização
- **#155 (#91)** CI gate: branch protection na `main` via GitHub API + status badge no README
- **#156 (#90)** Settings picker — paleta + fonte no perfil; persiste via `PontesThemeProvider`
- **#161** hotfix: `PontesStatCard tone` + hint standalone (resgate de build pós-#159/#160)

### Polimento visual + DS
- **#160** alinhamento `.page` Metas/Limites com padrão das outras telas
- **#163** fix BASE URL Metas (era `/api/v1/api/metas` → 404)
- **#166** purga total dos componentes legados + desinstala MUI (`-212 KiB` no bundle)
- **#167** h1 padrão Fraunces 24px/600/-0.02em em TODAS as telas; BankBadge quadrado-arredondado
- **#168** BankBadge: logo cobre 100% (fim do halo preto)

### Spin-offs do #82 (encerrados)
- **#169 (#130)** editar transação não bloqueia data futura no crédito (paridade com criar)
- **#170 (#131)** mover `components/transactions` → `pages/Transactions/components` (saiu da zona legada)

### PontesDateInput + correções do componente
- **#171** novo `PontesDateInput`: popover do `PontesDatePicker`, API `string YYYY-MM-DD` compatível com input nativo; migrou 8 páginas (Transferencias, CreditCards/Pagar, Emprestimos×2, Parcelamentos, Recorrentes×2, Familias, Metas, TransactionForm×3). Register manteve `PontesInput type="date"` por dependência de teste.
- **#172** remove dupla borda do popover (PontesDatePicker já carrega bg/border/radius)
- **#173** PontesSelect menu width = trigger (box-sizing: border-box); MoneyInput compactado (tentativa que foi revertida pelo #174)
- **#174** **MoneyInput restaura visual hero + responsividade via `clamp()`** — `font-size: clamp(32px, 7vw, 48px)` no input + `clamp(20px, 4vw, 28px)` no cifrão. Responsivo no componente, sem fix por formulário.
- **#175** DateInput trigger height = PontesInput (padding 12px 14px + border-radius 10px + box-sizing border-box)
- **#176** scrollbar overlay `--os-size: 8px` (era 12px); estados Inválido do DS reorganizados em grid responsivo; cor da thumb adaptativa via `color-mix(var(--pontes-text-muted))`
- **#177** PontesSelect: `searchable` default `true` em TODO select (igual o Ctrl+K); auto-placement do menu com `BUFFER 24px` — abre pra cima se faltar espaço, encolhe `maxHeight` se for tela curta. Menu nunca cobre footer de modal nem edge da página.

### Issues fechadas no dia
**21 issues** — #82, #84, #85, #86, #87, #88, #89, #90, #91, #128, #129, #138, #146 (não existia como issue mas equivalente), #149, #150, #151, #152, #153, #154, #130, #131.

---

## Dashboard Q5 — final

```
Site público (6):       6/6  ✅ #75 #76 #77 #78 #79 #80
Telas internas (9):     9/9  ✅ #81 #82 #83 #84 #85 #86 #87 #88 #89
Infra e qualidade (3):  2/3  ✅ #90 #91   ⏳ #92
Refatores extras:       7/7  ✅ #128 #129 #130 #131 #138 #149-#154 #146
Fundação:               ✅ #101 biblioteca + #106 v2 + #108/#90-fundação + #122 CSS Modules/vars

Total Q5:               17/18 issues do backlog (#75-#92) + 7 extras
Abertas:                #92 (E2E média) + #114 (SQLite drop baixa) + #125/#126 (legal)
```

---

## Padrões cristalizados no Q5 (referência rápida)

- **Estilização:** CSS Modules + `var(--pontes-*)` — zero inline pra tema/estático. Inline só pra valor dinâmico runtime (`width: %`, cor de banco, vars escopadas).
- **Componentes:** `@/components/pontes` é a ÚNICA fonte. Zero MUI no codebase. `src/components/` legado APAGADO.
- **Forms:** validação por campo via `PontesField error=` + `invalid`. Toast só pra erro de servidor. Erro limpa ao editar.
- **Confirmação destrutiva:** `PontesDialog`, nunca `window.confirm`.
- **Datas:** `PontesDateInput` em TODO formulário (popover do calendar custom).
- **Select:** busca default; menu auto-place sem cobrir footer; portal pra escapar overflow.
- **MoneyInput:** visual hero + `clamp()` responsivo no componente — nada de fix por formulário.
- **Scrollbar:** `--os-size: 8px` idle / 10px hover; cor adaptativa.
- **h1 padrão:** Fraunces 24px/600/-0.02em em TODAS as telas internas.
- **Ícones:** `lucide-react` 14-16px / strokeWidth 2.5.
- **BankBadge:** quadrado-arredondado (10px), logo cover 100%.
- **Tema global:** `PontesThemeProvider` + `usePontesTheme()` + persistência localStorage. Picker em `/perfil`.
- **CI gate:** branch protection na main, build+lint+test obrigatórios.

---

## Histórico anterior (preservado abaixo)

### Issue anteriormente em execução — #88 ✅ MERGEADA via #146

Branch `feature/88-bancos-logo-real`. `PontesBankBadge` novo + AccountsPage refatorada + DashboardPage AccountTile boy-scout. 13+12 testes. Mergeada na sessão 2026-05-28.

### Última issue mergeada antes da sessão massiva — #89 ✅ PR #145

PR #145 — Recorrentes refator + cancelar/editar próxima. Backend `EditarProximaOcorrenciaDto` + endpoints `POST /{id}/cancelar` e `PATCH /{id}/proxima`. Frontend refactor completo MUI→Pontes + CSS Modules. 18 testes back + 16 testes front.

### #87 — Limites por categoria (PR #144 · sessão 2026-05-28)

LimitesPage com progress bar, badges, seletor de período, modal criar/editar, dialog de exclusão. Boy-scout OrcamentoService. Fix URL `/api/v1/api/orcamentos` → `/api/v1/orcamentos`. 14+12 testes.

### #138 — Redesign Cartões (PR #139 · sessão 2026-05-27)

Cartão físico com gradiente do banco, modo foco, navegação por mês + "Hoje" + atalhos, timeline cronológica, bloqueio pagar fatura futura, soft-delete cartão preservando pagamentos. Spin-offs #130/#131 fechados na sessão de hoje.

---

## Decisões registradas (Q5)

- **Pull-based:** sem assignee fixo. Dev livre pega a próxima da ordem sugerida.
- **Branch por issue:** sempre `feature/<numero>-<slug>`.
- **Critério done:** build + lint + testes verdes + homologação em dev + PR mergeado.
- **Personalização vence dark mode:** #63 cancelada, absorvida por #90.
- **Marca fixa:** nome Pontes, logo conceito 20, Plus Jakarta da marca. Paleta/fonte do produto = escolha do usuário (#90, entregue).
- **Estrutura `pages/Site/`** pra todas as páginas públicas.
- **CSS Modules + vars (#122):** padrão obrigatório, sem volta. Boy-scout em qualquer style inline encontrado.

---

## Como esse arquivo se relaciona com PROGRESS.md e ISSUES.md

- **ISSUES.md** = catálogo trimestral, não muda durante a sessão.
- **PROGRESS.md** = dashboard + histórico, atualizado ao final de cada sessão.
- **IMPLEMENTATION_STATE.md (este)** = estado granular da issue em execução.

Os três funcionam em camadas. Quando uma issue está em execução, este arquivo tem o template preenchido. Q5 fechado → sem issue em execução agora.

---

## Template para preencher quando começar uma issue

```
---
owner: Gustavo
last_reviewed: YYYY-MM-DD
status: EM_EXECUCAO
issue_atual: '#XX — <título curto>'
---

## Issue em execução

**Issue:** #XX — [nome]
**Iniciada em:** YYYY-MM-DD
**Sessões nessa issue:** N
**Branch:** feature/XX-slug

### Etapas
- [x] 1. [descrição] — checkpoint: [...]
- [ ] 2. [descrição] — checkpoint: [...]

### Etapa atual
[Qual etapa, o que falta pra fechar]

### Próxima ação concreta
[Exatamente o próximo passo]

### Decisões tomadas nesta sessão
- [Decisão importante que afeta outros pontos]
```
