---
owner: Caio
last_reviewed: 2026-05-28
status: EM PROGRESSO
issue_atual: '#88 Bancos com logo real — branch feature/88-bancos-logo-real'
---

## Issue em execução — #88 (Bancos com logo real + PontesBankBadge) ⏳ PR ABERTO

Branch `feature/88-bancos-logo-real`. Frontend only (sem backend). `PontesBankBadge` novo componente em `src/components/pontes/data/BankBadge.tsx` + `BankBadge.module.css` — círculo colorido com img real do banco (Google favicon sz=128) + fallback de iniciais (onError). Exportado no barrel `index.ts`. `AccountsPage.tsx` refatorado MUI→Pontes: zero Box/Paper/Typography/Chip/tokens.ts/CustomButton, CSS Modules `AccountsPage.module.css`, `PontesBankBadge` para cada conta (pega banco.logoUrl + banco.cor), `PontesDialog` para confirmação de exclusão (remove window.confirm), saldo via `conta.saldoAtual` (remove getTransactions). `DashboardPage.AccountTile` boy-scout: substituiu inline img+onError+imgErr state por `PontesBankBadge`. `BancosPage.tsx` refatorado (página separada, não está no router mas útil para futuro). 13 testes AccountsPage + 12 testes BancosPage → 249/249 frontend verde. 209/209 backend inalterado.

## Última issue mergeada — #89 (Recorrentes refator + cancelar/editar próxima) ✅ PR #145 MERGEADO

PR #145 — branch `feat/89-recorrentes-refactor`. Backend: `EditarProximaOcorrenciaDto`, endpoint `POST /{id}/cancelar` (motivo obrigatório, soft-delete recorrente + cancela Previsoes), endpoint `PATCH /{id}/proxima` (edita primeiro Previsao). Fix exception types em todos os métodos (KeyNotFoundException/UnauthorizedAccessException/ArgumentException). 18 novos testes backend → 209/209. Frontend: refactor completo MUI→Pontes + CSS Modules (zero Box/Paper/Typography/Dialog/tokens.ts/CustomButton), 3 stat cards (Ativas/Custo mensal/Próximas 30 dias), modais Cancelar (validação motivo obrigatório) e Editar próxima (valor/descrição opcionais). Fix parseMoneyString para aceitar formato BR "45,90" e "1.234,56". Update types (canceladoEm/motivoCancelamento/EditarProximaDto) e service (cancelarRecorrente/editarProximaOcorrencia). 16 novos testes frontend → 224/224.

PR #145 — branch `feat/89-recorrentes-refactor`. Backend: `EditarProximaOcorrenciaDto`, endpoint `POST /{id}/cancelar` (motivo obrigatório, soft-delete recorrente + cancela Previsoes), endpoint `PATCH /{id}/proxima` (edita primeiro Previsao). Fix exception types em todos os métodos (KeyNotFoundException/UnauthorizedAccessException/ArgumentException). 18 novos testes backend → 209/209. Frontend: refactor completo MUI→Pontes + CSS Modules (zero Box/Paper/Typography/Dialog/tokens.ts/CustomButton), 3 stat cards (Ativas/Custo mensal/Próximas 30 dias), modais Cancelar (validação motivo obrigatório) e Editar próxima (valor/descrição opcionais). Fix parseMoneyString para aceitar formato BR "45,90" e "1.234,56". Update types (canceladoEm/motivoCancelamento/EditarProximaDto) e service (cancelarRecorrente/editarProximaOcorrencia). 16 novos testes frontend → 224/224.

## Última issue mergeada — #87 (Limites por categoria com alertas) ✅ PR #144 MERGEADO

PR #144 — branch `feature/87-limites-categoria`. LimitesPage: grid de cards com progress bar, badge Em alerta (warning) / Ultrapassado (danger), seletor de período (mês/ano), modal criar/editar (PontesModal), dialog de confirmação de exclusão (PontesDialog). Boy-scout: OrcamentoService.ObterGastosAsync corrigido (filtros Ativo + Executado + !EhTransferencia + !EhSaldoInicial + !EhPagamentoFatura). Bug URL: `BASE = "/api/orcamentos"` → `"orcamentos"` (axios combina relative path com baseURL `/api/v1`). 14 testes backend + 12 testes frontend. 191/191 back + 208/208 front verdes.

## Última issue mergeada — #138 (redesign visual/UX da tela de Cartões) ✅ MERGEADO

PR #139 squash `c6630b3`. Cartão físico com gradiente da cor da marca do banco (Nubank roxo, fallback bandeira); modo foco; navegação por mês com botão "Hoje" (PontesButton outline) + atalhos teclado ← → respeitando foco em input; timeline cronológica pagamentos+compras com nota "Total pago"; previstas das assinaturas até Dez; **bloqueio de pagar fatura futura** (padrão Nubank/Itaú/Bradesco — fatura com `dataInicio > hoje` recebe badge "Futura" sem botão Pagar); destaque dias até vencimento/fechamento (≤5 dias → danger/warning); Pagar modal com máscara R$; skeleton + EmptyState; badge "Vencida" danger; **soft-delete cartão** preservando pagamentos (saída real de dinheiro continua refletida) e faturas (auditoria); seeder rico (MeioPagamento, faturas reais, recorrentes). 135/135 frontend + 160/160 backend verde.

### Decisões registradas em `docs/features/cartao-credito/regras.md` (§9)

### Spin-offs ainda abertos
- **#130** editar bloqueia data futura no crédito
- **#131** mover `components/transactions` → `pages/Transactions`
- **#88** logo banco via SVG limpo (gilbarbara CDN ou local sprite) — favicon Google bloqueia CORS pra mask, vira badge ruim; tentativas com mix-blend-mode deixam halo do anti-aliasing

### Dev local
Postgres docker `controlefinanceiro-db` + API 5293 + front 5173. Login `dev@controle.test` / `Dev@123456`. Preview MCP serverId muda a cada sessão.

---

## Anterior — #129 (validação por campo nos forms) ✅ MERGEADO

PR #135 (`66d11ad`). Login/Register/Categorias validam por campo com o estado do
DS (borda vermelha + erro inline), `form noValidate` (mata o balão nativo).
Register: todos os campos obrigatórios (inclui data de nascimento). Erro **não
empurra o layout** (PontesField `.helper` absolute, zero reflow — vale em todo
form). Auth padronizado: BackButton legado removido → `<Link>` + CSS var;
Fraunces → `var(--pontes-font-heading)`; `#fff` → `var(--pontes-hero-fg)`.
129 testes front.


## Última issue concluída — #128 (contabilidade: saldo × P&L) ✅ MERGEADO

PR #133 (`ad2c053`). Saldo separado de relatório de P&L. `Transacao` ganhou flags
`EhTransferencia`/`EhSaldoInicial` (`EhPagamentoFatura` já existia); relatórios e KPIs
do dashboard **excluem** as 3 (não são receita/despesa real → some o double-count do
pagamento de fatura, transferência não infla totais, saldo inicial não vira receita).
Saldo (Dashboard/ContasController) passou a filtrar `Ativo`+`Executado`. Transferência
agora soft-delete. Migration `AddFlagsContabeisTransacao` + backfill. 159 testes back.


## Última issue concluída — #82 (Transação Adicionar/Editar) ✅ MERGEADO

**Branch:** `feature/82-transacao-form` → mergeada na `main` (squash) e deletada.
**Mergeado antes no main:** #122 (PR #124), #81 (PR #123), **#83 Subcategorias (PR #127)**.
**Dev no ar:** Postgres docker `controlefinanceiro-db` + API 5293 + front 5173. Login dev `dev@controle.test` / `Dev@123456`. Seeder cria cartão **Nubank (limite 5k)** pra testar crédito.

### Decisões de produto travadas (#83/#82)
- **Taxonomia enxuta:** 14 categorias / 68 subcategorias (só consumo=Despesa e ganho=Renda). Transferência, pgto de fatura, empréstimo, investimento NÃO são categoria — têm entidades próprias (`Transferencia`, `Fatura`/`EhPagamentoFatura`, `Emprestimo`). `TipoTransacao` segue Receita/Despesa (sem 3º tipo).
- **Popup unificado por natureza:** Despesa · Receita · Transferência (cards). Meio de pagamento define conta vs cartão. Parcelado ⊻ Assinatura mutuamente exclusivos (cartão). Empréstimo fica na página própria (decisão: fora do popup).

### Entregue no #82 (mergeado)
- [x] Backend `SubcategoriaId` em DTOs + criar/update/parcelamento + validação. Testes.
- [x] Popup `NewTransactionDialog` + `EditTransactionDialog` em `PontesModal`; **EditTransactionDialog reusa `TransactionForm`** (`mode="edit"`), saiu do MUI.
- [x] `TransactionForm` único pra criar/editar: 3 naturezas, crédito+parcelas, assinatura, transferência (origem→destino via `createTransferencia`).
- [x] Lib nova: `PontesChoiceCards`, `PontesGroupedSelect` (substitui CategoryPicker local). Fixes: `PontesModal` (ícone X lucide, título Fraunces via `--pontes-font-heading`), `PontesSelect` (chevron/check lucide, alinhado ao GroupedSelect), `PontesMoneyInput` (máscara só números, default sem chips).
- [x] **Validação por campo + estado inválido padronizado no DS** (borda danger + ring, sem fundo) em Input/Select/GroupedSelect/MoneyInput/Textarea via prop `invalid`. Toast acima do modal.
- [x] `PontesMoneyInput` aceita só números (máscara moeda BR).
- [x] `DevDataSeeder` cadastra cartão de crédito do dev.
- [x] 125 testes front verde · lint · build. Regras documentadas (validação de form, boy-scout anti-inline) + hook `.claude/hooks/form-rule.cjs`.

### Spin-offs criados (NÃO eram escopo do #82)
- **#128** 🔴 contábil: relatórios contam transferência/pagamento-de-fatura/saldo-inicial como receita/despesa; `RelatorioService` não filtra `Ativo`/`StatusTransacao`; transferência hard-delete. (severidade alta)
- **#129** validação por campo nos forms restantes (Login/Register/Categorias).
- **#130** editar transação bloqueia data futura no crédito (inconsistente com criar).
- **#131** mover `components/transactions/` → `pages/Transactions/` (sair da zona legada).

### Próxima ação concreta
Pegar a próxima issue livre. Recomendados: **#84** (Cartão de Crédito — auditar, alta) ou **#85** (Família — rateio, diferencial do produto, alta). Rápidos: **#129** (validação por campo nos forms Login/Register/Categorias) ou site **#78/#79/#80**. Criar branch `feature/<n>-<slug>` a partir de `main` atualizado.

### Anotado pra futuro (jurídico, não-código)
- #125 — proteção de marca + IP (INPI). #126 — mapear LGPD (pré-lançamento).

### Notas técnicas
- Dev: API restart aplica migration via `MigrateAsync`; reset de seed = `DROP DATABASE` + restart. Reset → token do dev morre → refazer login.
- `CategoriaService` legado usa `throw new Exception`; serviços novos seguem ArgumentException/KeyNotFoundException/etc (mapeados pelo GlobalExceptionHandlerMiddleware).
---

<!-- bloco antigo #122 abaixo (histórico) -->
---

# Implementation State — sessão atual

**Este arquivo é o checkpoint vivo entre sessões.** Toda sessão começa lendo este arquivo, e termina atualizando-o.

> O estado dos ciclos anteriores está arquivado em `docs/history/IMPLEMENTATION_STATE_2026Q*.md`.

---

## Ciclo em execução

**Ciclo:** Q5 2026 — Refator completo tela por tela
**Iniciado em:** 2026-05-21
**Backlog:** 18 issues (#75-#92)
**Spec do ciclo:** `ISSUES.md`

---

## Issue em execução

**#122 inline → CSS Modules + CSS vars — em revisão (PR aberto).** Branch `feature/122-css-variables`. Migrou TODA a UI já refatorada de `style={{}}` inline para `*.module.css` + `var(--pontes-*)`: biblioteca Pontes inteira, shell (DefaultLayout/Sidebar/Navbar/NotificationBell), Dashboard, Auth (Login/Register), Site (Home/Casais/Contadores/Recursos/Sobre), SiteLayout, DesignSystem (showroom), LogoConcepts. Vars injetadas no `:root` pelo `PontesThemeProvider` (escopadas no `/design-system`). Telas não passam mais `p`/`font` pros componentes Pontes; `usePontesTheme`/`useSiteTheme` sobrevive só onde precisa hex real (SVG/recharts). Helper `scopedThemeVars`/`paletteVars` em `theme.ts`. Props `p`/`font` ficaram opcionais nos types (compat + smoke tests). **17 commits, lint+build+104 testes verdes a cada commit.** Padrão documentado em `docs/STANDARDS.md`, `CLAUDE.md`, `PROMPT_NOVA_SESSAO.md` (regras 1 e 3). **Aguardando merge** (não mergear sem OK do Gustavo).

**#81 Dashboard refator — também em revisão (PR #123).** Branch `feature/81-dashboard-refator`. (Detalhe no histórico abaixo.)

**Pendência opcional pós-#122:** purgar de vez as props `p`/`font` opcionais dos types dos ~40 componentes + smoke tests (hoje inofensivas). Telas internas #82-#89 seguem legado MUI — migram pro padrão CSS Modules + vars quando forem refatoradas.

**Histórico anterior:** Sessões 33-34 mergearam #106 (biblioteca v2), #108+#90-fundação (HomePage refator + SiteLayout + tema global persistido) e #77 (Para Casais). Verticais site #78/#79/#80 e shell #118 também mergeados.

**Pronto pra usar:**
- Biblioteca `src/components/pontes/` (import via `@/components/pontes`).
- `PontesThemeProvider` global no `App.tsx` + `usePontesTheme()` — paleta+fonte persistidos em **localStorage** (sobrevivem reload, valem em todas as telas).
- `SiteLayout` (`pages/Site/SiteLayout.tsx`) — shell único: navbar + footer + control-bar dev + scrollbar overlay + promo "Beta aberto" site-wide. Páginas filhas só renderizam conteúdo e leem `{p, font}` via `useSiteTheme()`.
- Site com URLs limpas: `/` (HomePage via RootRoute deslogado), `/casais`. Rota `/site` removida.

**Próxima livre:** verticais do site (#78 Contadores, #79 Recursos, #80 Sobre — rápidas com SiteLayout) ou telas internas (#81-#89). #76 com Caio (PR #105, precisa rebase no main novo).

### Histórico breve sessões 32-34
- **S32 #101 (PR #102):** biblioteca base — 36 componentes, theme.ts (15 paletas/7 fontes), lucide-react, Alert/Toast imunes à paleta.
- **S33 #106 (PR #107):** biblioteca v2 — hover via `pontes-clickable` + CSS vars, scrollbar overlay (overlayscrollbars), PontesNavLink, ScrollArea, footer mesh animado. Outline hover não vira primary (evita colisão visual).
- **S33 #108+#90 (PR #109):** HomePage 100% biblioteca (−1450 linhas inline mortas); SiteLayout criado; `PontesThemeProvider` + persistência localStorage (fundação #90); brand preview recolhível (seta esquerda, overlay fixed). Tema global vale em qualquer tela e persiste reload.
- **S34 #77 (PR #111):** CouplesPage refeita 100% biblioteca, content-only sob SiteLayout. Promo "Beta aberto" movido pro SiteLayout (site-wide). GridPattern no hero. URLs limpas.

---

## (sessão anterior preservada)

**Issue:** #101 — Biblioteca de componentes Pontes (`src/components/pontes/`)
**Iniciada em:** 2026-05-21 (sessão 32)
**Branch:** `feature/101-biblioteca-pontes`

**Por quê:** DS antigo era página showcase com componentes inline. Caio refator Login (#76) e demais issues de tela não tinham o que importar — vira retrabalho e desvio. #101 bloqueia #76, #77, #78, #79, #80, #81, #82, #83, #84, #86, #87, #89.

### Etapas
- [x] 1. Criar pasta `src/components/pontes/` separada do legado
- [x] 2. theme.ts (palettes + fonts + spacing + radii + shadows + semantic + adjustColor)
- [x] 3. Botões: PontesButton (7 variants × 5 sizes × loading/success/disabled) + PontesIconButton + PontesFab + PontesButtonGroup + PontesLink
- [x] 4. Form: PontesField + PontesInput (com iconStart/End + invalid) + PontesMoneyInput + PontesTextarea + PontesSelect + PontesToggle + PontesCheckbox + PontesRadio/Group
- [x] 5. Form avançado: PontesOtpInput + PontesSlider + PontesDatePicker + PontesFileDrop + PontesTagInput + PontesColorPicker + PontesRating + PontesKbd/Group
- [x] 6. Dados: PontesBadge + PontesAvatar + PontesAvatarStack + PontesAlert + PontesProgress + PontesStatCard + PontesCard + PontesTable
- [x] 7. Feedback: PontesToast + PontesModal + PontesDialog + PontesSkeleton/Row/List + PontesEmptyState + PontesLoadingDots + PontesDrawer + PontesTooltip + PontesPopover
- [x] 8. Navegação: PontesBreadcrumb + PontesTabs (pills/underline) + PontesStepper + PontesPagination + PontesCommandPalette
- [x] 9. Site: PontesNavbar (move de SiteNavbar) + PontesFooter (rich/minimal)
- [x] 10. index.ts barrel
- [x] 11. DesignSystemPage reescrita usando biblioteca (zero inline)
- [x] 12. Build verde + lint zero
- [x] 13. 14 smoke tests novos · suite 60/60
- [ ] 14. Commit + PR

### Etapa atual
14 — commit e abrir PR.

### Próxima ação concreta
`git add ... && git commit && git push && gh pr create`

### Decisões tomadas nesta sessão
- **Separação clara legado vs novo:** componentes antigos (CustomButton, MUI direto, tokens.ts) ficam em `components/` raiz; novos somente em `components/pontes/`. Telas refatoradas Q5 importam SÓ daqui. Final do Q5, deleta legado em PR separado.
- **API uniforme:** todos os componentes recebem `p: Palette` + `font: string` por prop. Quando #90 entregar context global, refatora todos para consumir do context.
- **Cores semânticas independentes de paleta:** success/warning/danger/info fixas em theme.ts → não mudam com troca de paleta (vermelho de erro sempre vermelho).
- **Footer com duas variants:** `rich` (4 cols + brand + social) e `minimal` (linha única). HomePage usa rich, CouplesPage minimal (mais discreto).
- **PR #100 (CouplesPage) fechado sem mergear:** branch `feature/77-site-casais` preservada. Vai ser refeita usando biblioteca quando #101 mergear.

### Ordem sugerida do backlog

**Site público (primeiro — desbloqueia fluxo de entrada):**
1. ~~#75 — `/` vira root público com fallback Dashboard~~ ✅ MERGEADA (PR #94)
2. **#76** — Refator Login + Register (Caio, PR #105 — precisa rebase)
3. ~~#77 — Página Para Casais~~ ✅ MERGEADA (PR #111)
4. **#78** — Página Para Contadores
5. **#79** — Página Recursos completa
6. **#80** — Página Sobre

**Telas internas (em paralelo com site, conforme dev livre):**
7. **#81** — Dashboard refator 6 KPIs + gráficos
8. **#82** — Transação Adicionar/Editar (único + recorrente + parcelado)
9. **#83** — Categorias + Subcategorias
10. **#84** — Cartão de Crédito (auditar)
11. **#85** — Família (rateio + aprovação + §16.5)
12. **#86** — Metas
13. **#87** — Limites por categoria
14. **#88** — Bancos com logo real
15. **#89** — Recorrentes refator

**Infra e qualidade (em paralelo):**
16. **#90** — Personalização in-app (paleta + fonte + dark mode)
17. **#91** — CI/CD gate
18. **#92** — Cobertura E2E Playwright

### Próxima ação concreta

1. Dev livre escolhe issue (recomendação: começar por **#75** se ainda não está em curso, pois desbloqueia o fluxo de entrada)
2. Cria branch `feature/<numero>-<slug-kebab>` a partir de `main` atualizado
3. Atualiza `IMPLEMENTATION_STATE.md` com:
   - `status: EM_EXECUCAO`
   - `issue_atual: '#XX — <título curto>'`
   - Preenche template abaixo

---

## Decisões registradas (Q5)

- **Pull-based:** sem assignee fixo. Dev livre pega a próxima da ordem sugerida.
- **Branch por issue:** sempre `feature/<numero>-<slug>`.
- **Critério done:** build + lint + testes verdes + homologação em dev + PR mergeado.
- **Personalização vence dark mode:** issue #63 (dark mode dedicado) cancelada — vira parte de #90.
- **Marca fixa:** nome Pontes, logo conceito 20, Plus Jakarta da marca. Paleta e fonte do produto = escolha do usuário (#90).
- **Estrutura `pages/Site/`** pra todas as páginas públicas (Home, Couples, Professionals, Pricing, About, etc).

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

---

## Como esse arquivo se relaciona com PROGRESS.md e ISSUES.md

- **ISSUES.md** = catálogo de tudo que precisa ser feito, com escopo e severidade. Não muda durante a sessão.
- **PROGRESS.md** = dashboard de quanto já foi feito, histórico de sessões. Atualizado ao final de cada sessão.
- **IMPLEMENTATION_STATE.md (este)** = estado granular de **uma** issue em execução. Atualizado a cada etapa concluída dentro da sessão.

Os três funcionam em camadas: este é o mais granular, PROGRESS.md é a visão do ciclo, ISSUES.md é o catálogo trimestral.
