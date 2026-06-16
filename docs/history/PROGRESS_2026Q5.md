---
owner: Gustavo
last_reviewed: 2026-05-29
next_review: 2026-08-21
status: Q5 FECHADO
---

# Progress Tracker — Q5 2026

**Objetivo:** Refator completo tela por tela (front + back + testes) seguindo o fluxo natural do produto. Marca decidida (nome Pontes, logo wordmark+arco, tipografia fixa Plus Jakarta). Foco em deixar tudo que existe **funcionando** + criar o que falta no site público + completar gaps de produto (subcategorias, metas, limites, módulo família avançado).

**Backlog atual:** 18 issues (#75-#92).
**Iniciado em:** 2026-05-21.
**Encerrado em:** 2026-05-29 (UI/refator 100% mergeados, sobrou só infra/legal opcional).

---

## Dashboard

```
Site público (6):       6/6  ✅ #75 #76 #77 #78 #79 #80
Telas internas (9):     9/9  ✅ #81 #82 #83 #84 #85 #86 #87 #88 #89
Infra e qualidade (3):  2/3  ✅ #90 #91   ⏳ #92 (E2E Playwright — média)
Refatores extras:       8/8  ✅ #128 #129 #130 #131 #138 #149 #150 #151 #152 #153 #154
Fundação:               ✅ #101 biblioteca Pontes (+ v2 #106, SiteLayout #108, #122 CSS Modules/vars)

Total Q5 2026:          17/18 issues do backlog + 11 extras (spin-offs + refators massivos)
Abertas:                #92 (E2E média) + #114 (drop SQLite baixa) + #125/#126 (legal/INPI/LGPD)
```

**Status geral:** **Q5 efetivamente fechado.** 0 MUI no codebase, bundle `-212 KiB` pós-purga, biblioteca Pontes única fonte de UI, CI gate com branch protection ativa, personalização global persistida. Q4 2026 absorvido (dark mode #63 virou parte de #90, agora entregue).

**Marca decidida na sessão de 2026-05-21:**
- Nome: **Pontes**
- Logo: conceito 20 (wordmark + arco sublinhado) em `src/components/Logo/Logo.tsx`
- Tipografia da marca: **Plus Jakarta Sans** (fixa)
- Paleta e fonte do produto: escolha do usuário via personalização in-app (#90)

---

## Em progresso

(nenhuma issue em execução — Q5 fechado. Próximas livres: #92 E2E Playwright, #114 drop SQLite, #125/#126 legais.)

## Resolvidos Q5

- **#149/#150/#151/#152/#153/#154** — Refatores MUI→Pontes em massa (PRs #157, #158, #159, #162, #164, #165 · sessão 2026-05-29)
  - **#151 Transferencias** (PR #157), **#152 Emprestimos** (PR #158), **#153 Parcelamentos** index+detalhe (PR #159)
  - **#154 Importacao** (PR #162), **#150 Reports** (PR #164), **#149 Transactions** (PR #165 — maior bloco legado, ~500 MUI)
  - Boy-scout: NewContaDialog (PR #147), SettingsPage (PR #148)
  - Todos: CSS Modules + var(--pontes-*), validação por campo, PontesDialog em vez de window.confirm, PontesDateInput em vez de input nativo
  - Hotfix PR #161 (PontesStatCard `tone` + hint standalone) e #160 (alinhamento .page Metas/Limites)

- **#91** — CI gate (PR #155 · sessão 2026-05-29)
  - Branch protection na main via GitHub API (build+lint+test obrigatórios pra merge)
  - Status badge no README
  - Auto-merge habilitado pra PRs com CI verde

- **#90** — Personalização in-app — picker paleta + fonte (PR #156 · sessão 2026-05-29)
  - SettingsPage `/perfil` ganhou seletor de paleta (15 opções) + fonte (7 opções)
  - Persiste em localStorage via `PontesThemeProvider` (já fundação desde #108)
  - Wordmark/cores semânticas/Alert/Toast imunes (regras de #101)

- **#88** — Bancos com logo real + PontesBankBadge (PR #146 · sessão 2026-05-28)
  - `PontesBankBadge` em `src/components/pontes/data/BankBadge.tsx`: img real (Google favicon sz=128) + fallback iniciais (onError)
  - Quadrado-arredondado (border-radius 10px), logo cover 100% (fim do halo preto após #167/#168)
  - AccountsPage refatorado MUI→Pontes; DashboardPage AccountTile boy-scout; BancosPage refatorado também
  - 13 testes AccountsPage + 12 testes BancosPage

- **#138 spin-offs** — fechados (sessão 2026-05-29)
  - **#130** editar transação não bloqueia data futura no crédito (PR #169 — paridade com criar)
  - **#131** mover `components/transactions` → `pages/Transactions/components` (PR #170 — saiu da zona legada)

- **Purga legacy + polimento DS** (sessão 2026-05-29)
  - **PR #166** — purge total dos componentes legados + desinstala MUI completo (`-212 KiB` bundle)
  - **PR #167** — h1 padrão Fraunces 24px/600/-0.02em em TODAS as telas + BankBadge quadrado
  - **PR #168** — BankBadge logo cobre 100%
  - **PR #171** — novo `PontesDateInput` (popover do PontesDatePicker, API YYYY-MM-DD compatível); migrou 9 páginas
  - **PRs #172-#177** — afinação do componente: dupla borda, height=Input, MoneyInput hero+clamp(), scrollbar fina, Select searchable default + auto-placement com BUFFER 24px

- **#89** — Recorrentes refator + cancelar/editar próxima (PR #145 · sessão 2026-05-28)
  - Backend: `EditarProximaOcorrenciaDto`, endpoints `POST /{id}/cancelar` + `PATCH /{id}/proxima`
  - Fix exception types em todos os métodos: KeyNotFoundException/UnauthorizedAccessException/ArgumentException
  - Frontend: refactor completo MUI→Pontes + CSS Modules (zero Box/Paper/Typography/Dialog/tokens.ts/CustomButton)
  - 3 stat cards (Ativas, Custo mensal despesas, Próximas 30 dias)
  - Modal cancelar: motivo obrigatório, soft-delete recorrente + cancela Previsoes; motivo exibido na row
  - Modal editar próxima: altera apenas o primeiro Previsao (valor/descrição opcionais)
  - Fix parseMoneyString: suporte "45,90" (BR) e "1.234,56" (BR completo)
  - 18 novos testes backend (RecorrenteServiceTests) → 209/209
  - 16 novos testes frontend (RecorrentesPage.test.tsx) → 224/224

- **#87** — Limites por categoria com alertas (PR #144 · aguardando review · sessão 2026-05-28)
  - LimitesPage: grid de cards, progress bar com cores primary/warning/danger, badges "Em alerta" / "Ultrapassado"
  - Seletor de período (mês/ano), modal criar/editar (PontesModal), dialog confirmar exclusão (PontesDialog)
  - Validação por campo: valorLimite > 0, percentualAlerta 1–100 (bloqueia submit, erro inline)
  - OrcamentoService (boy-scout): filtros ObterGastosAsync corrigidos (Ativo + Executado + !EhTransferencia + !EhSaldoInicial + !EhPagamentoFatura)
  - Bug URL orcamentoService: `BASE "/api/orcamentos"` → `"orcamentos"` (axios double-path com baseURL `/api/v1`)
  - 14 testes backend (OrcamentoServiceTests) + 12 testes frontend (LimitesPage.test.tsx)
  - 191/191 backend + 208/208 frontend verdes

- **#138** — Redesign visual/UX da tela de Cartões (mergeado · PR #139 · sessão 2026-05-27)
  - Cartão físico com gradiente da cor da marca do banco (Nubank roxo, fallback bandeira); chip + contactless + número em relevo; bandeira Mastercard SVG inline
  - Modo foco (clica → isola cartão + fatura); 1 cartão → auto-foco
  - Fatura: navegação por mês, atual por data, janela de 3 pré-cacheada, timeline cronológica compras + pagamentos por data+hora, "Total pago", previstas das assinaturas até Dez
  - Botão "Hoje" (PontesButton outline) na nav de mês; atalhos teclado ← → respeitando foco em input
  - Bloqueio pagar fatura futura (padrão Nubank/Itaú/Bradesco); badge "Futura" neutral
  - Destaque dias: ≤5 dias até vencimento → cor danger; até fechamento → warning
  - Pagar modal: PontesInput máscara R$ (parseMoney/fmtMoneyInput); skeleton + EmptyState
  - Form: validação por campo (nome/banco obrigatórios, últimos 4 só número, limite máscara, dia 1–31); PontesSelect busca >8 + portal + fix scroll
  - **Soft-delete cartão**: Ativo=false no cartão + compras; pagamentos preservados com FaturaPagaId; faturas intactas; listar/buscar filtram Ativo; teste regressão
  - Backend: CartaoCreditoDto ganha BancoLogoUrl + BancoCor; FaturaDetalheDto.Pagamentos; ExpandirRecorrentes horizonte = fim do ano + UsadoComoCredito=true; seeder rico (MeioPagamento, faturas reais, recorrentes)
  - Sidebar rail colapsado: avatar 28px sem anel, hover azul claro
  - Favicon Pontes; dedupe contas por email
  - 135/135 frontend + 160/160 backend verde

- **#85** — Família — rateio explícito + aprovação despesa + acerto (mergeado · PR #140 · sessão 2026-05-25)
  - Backend 100% completo (Issues #22–#27): Família, Convite, Despesa Compartilhada, Dependentes, Rateio, Acerto de Contas
  - FamiliasPage refatorada MUI → Pontes + CSS Modules (zero MUI, zero inline style)
  - 50 testes front cobrindo: render, convites pendentes, Nova Família, detalhe (membros/renda/dependentes/balanço/acertos), permissões admin, modais, PontesDialog
  - Fix bug: `CriarDependenteDto` usava `[property: Attr]` em record → ASP.NET Core 8 joga `InvalidOperationException` → middleware converte em 409. Corrigido: atributos direto no param do ctor

- **#84** — Cartão de Crédito — auditoria e refator completo (mergeado · PR #137 · sessão 2026-05-25)
  - CreditCardsPage refatorada MUI → Pontes + CSS Modules
  - Faturas, pagamento de fatura, stats + limite; 3 testes integração

- **#129** — Validação por campo nos forms (mergeado · PR #135 · sessão 2026-05-23)
  - Login/Register/Categorias: erro vermelho inline via DS (`PontesField error` + `invalid`), `form noValidate` (sem balão nativo)
  - Register: todos os campos obrigatórios (incl. data de nascimento)
  - PontesField: erro **absolute** → não empurra layout (zero reflow, vale em todo form)
  - Auth padronizado: BackButton legado removido → `<Link>` + CSS var; Fraunces → `var(--pontes-font-heading)`; `#fff` → `var(--pontes-hero-fg)`

- **#128** — Contabilidade: saldo × P&L (mergeado · PR #133 · sessão 2026-05-23)
  - `Transacao` ganhou flags `EhTransferencia`/`EhSaldoInicial` (`EhPagamentoFatura` já existia)
  - Relatórios (RelatorioService) e KPIs do Dashboard **excluem** as 3 → some o double-count do pagamento de fatura, transferência não infla receita/despesa, saldo inicial não vira receita
  - Saldo (Dashboard/ContasController) filtra `Ativo`+`Executado`; transferência vira soft-delete
  - Migration `AddFlagsContabeisTransacao` + backfill dos dados existentes · 159 testes back

- **#82** — Transação Adicionar/Editar (mergeado · sessão 2026-05-23)
  - `TransactionForm` único pra criar e editar (`mode="edit"`); `NewTransactionDialog` + `EditTransactionDialog` em `PontesModal`; Edit saiu do MUI
  - Popup unificado por natureza: Despesa · Receita · Transferência; crédito+parcelas; assinatura (recorrente); transferência via `createTransferencia`
  - Lib nova: `PontesChoiceCards`, `PontesGroupedSelect` (substituiu CategoryPicker local); fixes `PontesModal`/`PontesSelect`/`PontesMoneyInput`
  - Validação por campo + **estado inválido padronizado no DS** (borda danger + ring, sem fundo) via prop `invalid`; toast acima do modal; `PontesMoneyInput` só números (máscara BR)
  - Backend `SubcategoriaId` em criar/editar/parcelamento + validação
  - 125 testes front · regras documentadas (validação de form, boy-scout anti-inline) + hook `.claude/hooks/form-rule.cjs`
  - Spin-offs: #128 #129 #130 #131

- **#77** — Página Para Casais `/casais` (PR #111 mergeado · sessão 34)
  - CouplesPage refeita 100% biblioteca, content-only sob SiteLayout
  - Sections: Hero (GridPattern + mesh + foto + toasts), Stats, ComoFunciona, Rateio, Aprovação, Acerto, Privacidade, Testimonial, CtaFamília
  - Promo "Beta aberto" movido pro SiteLayout (site-wide, aparece em todas as páginas)
  - URLs limpas: `/casais` (rota `/site` removida)
  - Teste smoke `CouplesPage.test.tsx` · suite 70/70

- **#106** — Biblioteca Pontes v2 (PR #107 mergeado · sessão 33)
  - Hover/active via classe `pontes-clickable` + CSS vars seguindo paleta (outline hover não vira primary — evita colisão visual)
  - Scrollbar overlay accent sempre visível (overlayscrollbars + `usePontesBodyScrollbar`)
  - `PontesNavLink`, `PontesScrollArea` novos; footer com mesh gradient animado
  - lucide-react afinado (strokeWidth/size por feedback do usuário)

- **#108 + fundação #90** — HomePage refator + SiteLayout + tema global persistido (PR #109 mergeado · sessão 33)
  - HomePage 100% biblioteca (−1450 linhas inline mortas: ComponentShowcase, charts)
  - `SiteLayout` (`pages/Site/SiteLayout.tsx`): shell único navbar+footer+control-bar+scrollbar+promo. Páginas filhas só conteúdo, leem `{p,font}` via `useSiteTheme()`
  - `PontesThemeProvider` global no `App.tsx` + `usePontesTheme()` — paleta+fonte persistidos em **localStorage** (sobrevivem reload, valem em todas as telas → fundação #90)
  - Brand preview recolhível (seta esquerda, overlay fixed, push/pull)
  - Regras inegociáveis escritas em PROMPT_NOVA_SESSAO §5

- **#101** — Biblioteca de componentes Pontes (PR #102 mergeado · sessão 32)
  - 36 componentes em `src/components/pontes/` (Button/Field/Input/Select/Toggle/Checkbox/Radio/Otp/Slider/DatePicker/FileDrop/TagInput/ColorPicker/Rating/Kbd/Badge/Avatar/Alert/Progress/StatCard/Card/Table/Toast/Modal/Dialog/Skeleton/EmptyState/LoadingDots/Drawer/Tooltip/Popover/Breadcrumb/Tabs/Stepper/Pagination/CommandPalette/Navbar/Footer)
  - `theme.ts` com 15 paletas + 7 fontes + spacing/radii/shadows/semantic
  - lucide-react v1.16 adotado (chars texto banidos em botões)
  - DesignSystemPage reescrita: 6 abas (Botões/Form/Cards/Feedback/Navegação/Tokens), control bar troca paleta + fonte ao vivo
  - Alert + Toast IMUNES à paleta (padrão universal fixo) — só fonte muda
  - 14 smoke tests novos · suite 60/60
  - Regras documentadas em PROMPT_NOVA_SESSAO §5 (refator OBRIGATÓRIO importa biblioteca; teste automatizado front+back obrigatório; cor+fonte aplica em todas as telas)
  - Desbloqueia: #76 #77 #78 #79 #80 #81 #82 #83 #84 #86 #87 #89

- **#75** — `/` vira root público com fallback Dashboard (PR #94 mergeado)
  - RootRoute novo em `src/components/Auth/RootRoute.tsx`
  - `axiosConfig.publicPaths` ganhou `/` (strict equal)
  - Botões "Entrar" e "Criar conta" da navbar linkados (`/auth/login`, `/auth/register`)
  - Bonus: extração de `theme.ts` (palettes + fonts), fix de Math.random no render, re-ativação de `react-hooks/exhaustive-deps` com useCallback em 9 telas
  - 3 testes novos · suite 46/46

---

## Backlog Q4 (parcialmente concluído)

5 issues, 4 mergeadas:
- ✅ #59 Atlas Playwright
- ✅ #60 Design tokens do Monarch
- ✅ #61 Telas piloto (Dashboard, Famílias, Form transação, Cartões, Relatórios)
- ✅ #62 Propagação de tokens
- ❌ #63 Dark mode — cancelado (absorvido em #90 personalização)
- ✅ #74 Brand preview + design system

Histórico em `docs/history/PROGRESS_2026Q4.md`.

---

## Backlog Q3 (concluído)

21 itens em 4 blocos, todos resolvidos. Histórico em `docs/history/PROGRESS_2026Q3.md`.

---

## Histórico de sessões

### Sessão 2026-05-29 — Q5 fechado (25 PRs mergeados)

Sessão maratona que liquidou tudo que sobrou de UI/refator/personalização/CI no Q5. Estado final: 0 MUI no codebase, biblioteca Pontes única fonte de UI, bundle -212 KiB, CI gate ativo, personalização global.

**Refatores MUI→Pontes (em massa):**
- #157 (#151) Transferencias
- #158 (#152) Emprestimos
- #159 (#153) Parcelamentos index + detalhe
- #162 (#154) Importacao
- #164 (#150) Reports
- #165 (#149) Transactions — maior bloco legado, ~500 ocorrências de MUI
- #147 boy-scout: NewContaDialog
- #148 quick win: SettingsPage

**Infra/personalização:**
- #155 (#91) CI gate: branch protection na main via gh API + status badge
- #156 (#90) Settings picker paleta + fonte em /perfil
- #161 hotfix PontesStatCard tone + hint standalone (resgate de build)

**Polimento visual + DS:**
- #160 alinhamento .page Metas/Limites
- #163 fix BASE URL Metas (/api/v1/api/metas → /api/v1/metas)
- #166 PURGA TOTAL: deletou src/components/ legado + desinstalou @mui (-212 KiB)
- #167 h1 Fraunces 24px/600/-0.02em em todas as telas + BankBadge quadrado
- #168 BankBadge logo cobre 100% (fim do halo preto via mix-blend/mask/filter)

**Spin-offs do #82 (encerrados):**
- #169 (#130) editar não bloqueia data futura no crédito (paridade com criar)
- #170 (#131) mover components/transactions → pages/Transactions/components

**PontesDateInput + afinação do componente:**
- #171 novo PontesDateInput (popover do calendar custom, API YYYY-MM-DD); migrou 9 páginas
- #172 remove dupla borda do popover
- #173 PontesSelect menu width = trigger; tentativa MoneyInput compacto (revertida)
- #174 MoneyInput RESTAURA visual hero + responsividade via clamp(20px,4vw,28px)/clamp(32px,7vw,48px) — responsivo no componente, sem fix por formulário (lição: "voce sempre faz o contrario do que eu pedi")
- #175 DateInput trigger height = PontesInput (padding 12px 14px + border-radius 10px + box-sizing)
- #176 scrollbar overlay --os-size 8px (era 12px); estados Inválido do DS em grid responsivo; cor da thumb via color-mix(var(--pontes-text-muted))
- #177 PontesSelect: searchable default true em TODO select (igual Ctrl+K); auto-placement com BUFFER 24px — abre pra cima/encolhe se faltar espaço, nunca cobre footer

**Padrões cristalizados:**
- CSS Modules + var(--pontes-*) sempre, inline só pra valor dinâmico runtime
- @/components/pontes única fonte de UI, src/components legado APAGADO
- Validação por campo via PontesField error + invalid (zero toast pra campo)
- PontesDialog em vez de window.confirm
- PontesDateInput em todo formulário
- lucide-react 14-16px / strokeWidth 2.5
- BankBadge quadrado-arredondado 10px + logo cover 100%
- h1 Fraunces 24px/600/-0.02em em todas as telas internas
- MoneyInput visual hero responsivo via clamp() (responsividade NO componente)

**Final state:** working tree clean, branch main em `3dfadf8`. 4 issues abertas só: #92 (E2E Playwright), #114 (drop SQLite), #125 (INPI), #126 (LGPD).

**Próxima ação:** Gustavo decide próxima prioridade (#114, #92, ou pausar Q5 e ir pra outra coisa).

### Sessão 2026-05-28 — telas internas finais (#87 + #89 + #88)

- **#87 Limites por categoria** (PR #144): grid de cards com progress bar, badges Em alerta/Ultrapassado, seletor de período, modal criar/editar, dialog de exclusão. Boy-scout OrcamentoService (filtros Ativo + Executado + !EhTransferencia + !EhSaldoInicial + !EhPagamentoFatura). Fix URL `/api/v1/api/orcamentos` → `/api/v1/orcamentos`. 14 testes back + 12 front.
- **#89 Recorrentes** (PR #145): backend `EditarProximaOcorrenciaDto` + endpoints `POST /{id}/cancelar` e `PATCH /{id}/proxima`; soft-delete recorrente + cancela Previsoes; refactor MUI→Pontes + CSS Modules; 3 stat cards; modais Cancelar (motivo obrigatório) e Editar próxima (valor/descrição opcionais); fix parseMoneyString BR. 18 back + 16 front.
- **#88 Bancos com logo real** (PR #146): `PontesBankBadge` novo componente; AccountsPage refatorado; DashboardPage AccountTile boy-scout; BancosPage refatorado. 13+12 testes.

### Sessão 2026-05-27 — #138 redesign Cartões (PR #139)

Cartão físico com gradiente do banco; modo foco; navegação por mês + "Hoje" + atalhos teclado; timeline cronológica; bloqueio pagar fatura futura (padrão Nubank/Itaú/Bradesco); soft-delete cartão preservando pagamentos+faturas; seeder rico. Spin-offs #130/#131 abertos (fechados depois na sessão massiva).

### Sessão 2026-05-25 — #84 + #85 (PRs #137 + #140)

CreditCardsPage refator MUI→Pontes + auditoria (#84). FamiliasPage refator MUI→Pontes + 50 testes (#85). Fix bug `CriarDependenteDto` record + `[property: Attr]` (ASP.NET 8 joga InvalidOperationException).

### Sessão 2026-05-23 — #82 + spin-offs #128/#129

#82 Transação Adicionar/Editar (PR #132): TransactionForm único pra criar e editar; popup unificado por natureza; lib nova `PontesChoiceCards` + `PontesGroupedSelect`; validação por campo padronizada. #128 saldo×P&L (PR #133): flags EhTransferencia/EhSaldoInicial, relatórios e dashboard excluem as 3 não-receita-não-despesa. #129 validação Login/Register/Categorias (PR #135).

### Sessão 34 — 2026-05-21

**#77 mergeada (PR #111) — Página Para Casais.**

- CouplesPage refeita do zero 100% biblioteca, content-only sob `SiteLayout` (`const {p,font} = useSiteTheme()`).
- Sections: Hero (GridPattern + mesh + foto + toasts flutuantes), Stats, ComoFunciona, SecaoRateio, SecaoAprovacao, SecaoAcerto, SecaoPrivacidade, Testimonial, CtaFamilia. Componentes: PontesButton/Card/Badge/Avatar/Progress + lucide.
- **Promo "✦ Beta aberto" movido pro SiteLayout** → aparece site-wide (todas as páginas, não só Home).
- **GridPattern adicionado no hero** (paridade com Home).
- **URLs limpas:** rota `/site` removida; `/casais` direto. `axiosConfig.publicPaths` atualizado.
- Teste smoke `CouplesPage.test.tsx` · suite 70/70.
- Sequência de PRs do dia: #107 (biblioteca v2) → #109 (HomePage+SiteLayout+tema) → #111 (CouplesPage).
- main = `7d5397b`. Branches limpas, sem stash.

**Próxima ação:** verticais do site #78 Contadores, #79 Recursos, #80 Sobre (rápidas com SiteLayout) ou telas internas #81-#89.

### Sessão 33 — 2026-05-21

**#106 (PR #107) + #108/#90-fundação (PR #109) mergeadas.**

Pivô de arquitetura: biblioteca real → SiteLayout shell → tema global persistido (fundação #90 completa).

- **#106 biblioteca v2:**
  - Hover/active via classe `pontes-clickable` + `data-pontes-variant` + CSS vars (`--pontes-hover-bg`, `--pontes-active-bg`) seguindo paleta. Outline hover vira primarySoft (não primary cheio — evita colidir com botão primary vizinho); active mostra cor forte momentânea.
  - Scrollbar overlay accent sempre visível (overlayscrollbars + overlayscrollbars-react, `usePontesBodyScrollbar`, autoHide never, track transparente).
  - `PontesNavLink`, `PontesScrollArea` novos. Footer com mesh gradient animado (blobs). `pontes-no-lift` pra button group.
  - lucide-react afinado por feedback (strokeWidth/size do +, setas, FAB sombra neutra).
- **#108 + fundação #90 (HomePage refator + SiteLayout + tema global):**
  - HomePage agora content-only: −1450 linhas inline mortas (ComponentShowcase, CS*, charts). Usa biblioteca + GridPattern.
  - **`SiteLayout`** (`pages/Site/SiteLayout.tsx`): shell único com navbar + footer + control-bar dev recolhível + scrollbar overlay + promo. Páginas filhas só renderizam conteúdo. Aceita `children` (RootRoute deslogado) OU `<Outlet/>` (rotas aninhadas).
  - **`PontesThemeProvider`** global no `App.tsx` + `usePontesTheme()` (em `themeContext.ts` p/ react-refresh). Paleta+fonte persistidos em **localStorage** (`pontes.paletteId`/`pontes.fontId`) — sobrevivem reload e valem em QUALQUER tela (site, auth, internas). Fundação #90 completa.
  - `useSiteTheme()` adapter retorna `{p, font}` pras páginas do site.
  - Brand preview recolhível: seta esquerda esconde, tab pequena mostra, comportamento push/pull, overlay fixed. Altura medida via ResizeObserver → offset da navbar/conteúdo.
  - Estilos via `_globalStyles.ts` / `overlayStyles.ts` injetados; HMR atualiza textContent.
- **Regras inegociáveis** escritas em PROMPT_NOVA_SESSAO §5 (8 regras): biblioteca nunca inline, componente novo → biblioteca primeiro, cor+fonte sempre do provider, personalização global+persistida, site usa SiteLayout, teste sempre front+back, ícones lucide, CI verde.
- #90 restante (ajusta conforme refator): Settings picker na tela Configurações + auth/internas consumindo `usePontesTheme()`.
- suite 70/70.

**Próxima ação:** refazer CouplesPage #77 com biblioteca (vira sessão 34).

### Sessão 30 — 2026-05-20 → 2026-05-21

**Pivô estratégico** — pausamos o ciclo Q4 monobloc e abrimos Q5 focado em refator completo tela por tela.

- **Brand decidido** ao vivo via `/site` (antiga `/brand-preview`) + `/logo-concepts`:
  - Nome: **Pontes** (sobrenome do fundador vira marca)
  - Logo: conceito 20 do `LogoConcepts.tsx` (wordmark Plus Jakarta + arco sublinhado)
  - Tipografia da marca: Plus Jakarta Sans (fixa)
  - Paleta e fonte do produto: escolha do usuário (vira #90)
- **Componente oficial criado:** `src/components/Logo/Logo.tsx` com props `color` / `size` / `variant`
- **Plus Jakarta + Fraunces + Instrument Serif** pré-carregadas em `index.html`
- **Brand preview transformado em site público** real:
  - Pasta `pages/BrandPreview/` → `pages/Site/`
  - `BrandPreview.tsx` → `HomePage.tsx`, componente `HomePage`
  - Rota `/brand-preview` → `/site` (futuro `/`)
  - Hero com headline-typing, mockups com toast flutuante, mesh gradient animado, sections com fotos reais Unsplash, tipografia Fraunces serif coesa, navbar pill fixed que adapta visual conforme scroll
- **Design System extraído** pra rota própria `/design-system` (página dedicada, com control bar próprio de paleta+fonte). Página antiga `DesignSystemShowcase.tsx` apagada.
- **Bug fix:** mesh gradient blobs cortados nas bordas (corrigido com border-radius 50% + filter blur)
- **PR #74** aberto na sessão anterior com brand preview + design system
- **PR #73 / Issue #63** (dark mode) cancelados — dark mode vira parte de #90 (personalização)
- **18 issues Q5 criadas** no GitHub (#75-#92)
- **Estrutura de pastas nova:**
  ```
  pages/
  ├── Site/                       # site público (HomePage, LogoConcepts, futuras Couples/Professionals/Pricing/About)
  ├── DesignSystem/               # /design-system
  ├── Dashboard/, Auth/, etc      # internos autenticados
  ```

**Próxima ação:** dev pega a próxima issue livre da ordem sugerida em `ISSUES.md`. Sugestão: começar por #75 (root público) — desbloqueia o fluxo de entrada do produto.

### Sessão 32 — 2026-05-21

**#101 mergeada (PR #102) — biblioteca de componentes Pontes.**

- Bloqueio identificado em sessão: Caio começou #76 Login refator, mas DS antigo era só showcase inline (sem biblioteca real). Sem biblioteca, qualquer refator de tela viraria retrabalho/desvio.
- Criada issue #101 (fundação Q5), priorizada acima de tudo.
- PR #100 (CouplesPage feito antes) fechado sem merge — branch preservada pra refazer com biblioteca depois.
- Biblioteca: 36 componentes em `src/components/pontes/`, theme.ts (15 paletas, 7 fontes, spacing/radii/shadows/semantic), barrel export, DesignSystemPage reescrita usando biblioteca.
- **lucide-react v1.16** adotado pra ícones SVG reais. Chars de texto (`+`, `→`, `←`, etc) banidos em botões — quebram alinhamento vertical.
- **Alert + Toast IMUNES à paleta** (padrão universal de alerta — vermelho=erro sempre). Só fonte muda. Prop `p` marcada @deprecated nesses dois.
- **Sombras tintadas removidas** do FAB (`0 12px 28px ${accent}66` → `0 8px 20px rgba(11,18,32,0.18)`).
- 14 smoke tests novos · suite 60/60.
- Regras escritas em `PROMPT_NOVA_SESSAO §5`:
  - **Regra 1-9 (refator):** telas Q5 importam SOMENTE de `@/components/pontes`. Componente novo reutilizável → biblioteca primeiro, depois usa.
  - **Regra 10-14 (cor+fonte):** TODA tela (site OU interna) consome paleta+fonte ao vivo. Wordmark fixo Plus Jakarta. Cores semânticas independem de paleta.
  - **Critério done universal:** teste automatizado novo OBRIGATÓRIO (vitest front + xUnit back). Sem teste = PR não merga.
- Branches limpas. main = `356dbc6`.

**Próxima ação:** dev livre pega próxima issue.
- Caio: já em #76 (Login + Register) — agora desbloqueado pra importar de `@/components/pontes`.
- Você: livre. Recomendação: #77 (Para Casais, fácil — refaz CouplesPage que tinha feito antes mas usando biblioteca) ou alguma tela interna (#81 Dashboard, #82 Transação).

### Sessão 31 — 2026-05-21

**#75 mergeada (PR #94).**

- `RootRoute.tsx` criado: `/` deslogado → HomePage; logado → redirect `/dashboard`
- `axiosConfig.publicPaths` ganhou `/` (strict equal — não bate em /dashboard etc)
- Botões "Entrar"/"Criar conta" da navbar linkados via `useNavigate`
- Suite testes: 46/46 (3 novos do RootRoute)
- Bonus: extração `pages/Site/theme.ts` (palettes + fonts + types) — resolve `react-refresh/only-export-components`
- Bonus: `Math.random()` em render → `useId()` em GridPattern e LineAreaChartReal
- Bonus: re-ativada `react-hooks/exhaustive-deps` com `useCallback` em 9 telas (Accounts, Bancos, CreditCards, Dashboard, FamiliasPage, Parcelamentos/[id], Recorrentes, HomePage LiveActivity, Transactions)
- `react-hooks/set-state-in-effect` mantida desativada (regra nova React 19, reavaliar com React Query)
- CI: backend pass / frontend pass

**Próxima ação:** dev pega #76 (Login + Register refator) ou outra livre.

---

## Checklist de encerramento de sessão

Cada sessão que tocar em código deve, ao terminar, atualizar este arquivo:

1. Mover itens iniciados de "Pendentes" para "Em progresso" ou "Resolvidos"
2. Atualizar dashboard (`X/Y` dos grupos)
3. Adicionar entrada nova em "Histórico de sessões" com data, o que foi feito, próxima ação
4. Se um item virou concluído, mover seção dele de `ISSUES.md` para a área "Resolvidos" (mantém referência)
5. Commit do estado: `chore(docs): atualiza progress — sessão N`
