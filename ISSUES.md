---
owner: Gustavo
last_reviewed: 2026-05-18
next_review: 2026-08-18
status: CURRENT
---

# Issues & Roadmap — Q4 2026

**Contexto:** Q3 2026 encerrado com 21/21 (100%) — ver `docs/history/ISSUES_2026Q3.md`. Este ciclo é monobloc, focado em elevar a base visual e UX do produto usando **Monarch Money** como referência. Ver `docs/features/redesign-ux/visao.md` para o documento completo de visão.

**Status geral:** 0/5 itens iniciados • 1 bloco único.

---

## Por que esse ciclo

O backlog Q3 entregou competência funcional ampla (família, rateio, importação, PWA, onboarding, notificações), mas a percepção visual ainda não comunica "produto pago de verdade". Para um produto B2C de finanças cobrado por assinatura, a base visual é tão crítica quanto a funcionalidade — usuário não paga R$15-30/mês por algo que parece amador.

Referência escolhida: **Monarch Money** (monarch.com). Empresa de $850M (Série B em maio/2025), US-only, com foco explícito em casais e família — alinhada com nosso pivot Bloco C. Brasil sem concorrente forte nesse nicho.

---

## 🅰️ BLOCO A — Redesign UX (inspirado em Monarch Money)

A ordem das fases é sequencial — cada uma alimenta a próxima.

### 🟡 #59 — Fase 1: Atlas Playwright das telas atuais

**Severidade:** 🟡 ALTA • **Esforço:** 1 dia • **Status:** ⏳ NÃO INICIADO

**Por quê:** Antes de redesenhar, precisamos enxergar o que temos. Atlas dá visão objetiva, comparável lado a lado com referência. Vira baseline de regressão visual depois.

**Escopo:**
- Setup `playwright` no frontend (`controle-financeiro.web`)
- Script `scripts/snapshot.ts`: login com usuário de teste, varre todas as rotas do React Router, tira screenshot em desktop (1440x900) e mobile (390x844), salva em `screenshots/atlas/desktop/` e `/mobile/` com nome determinístico
- Comando `npm run snapshot`
- `.gitignore` para `screenshots/` (não comitar 30+ PNGs)
- Documentação curta de uso no README

**Checkpoint:** `npm run snapshot` roda em < 3min e gera atlas completo do app em ambos os viewports.

---

### 🟡 #60 — Fase 2: Design tokens do Monarch

**Severidade:** 🟡 ALTA • **Esforço:** 2-3 dias • **Status:** ⏳ NÃO INICIADO

**Por quê:** Sem tokens bem definidos, "redesign" vira opinião subjetiva. Tokens dão objetivo executável.

Esta fase tem **3 sub-tasks**. A 1 é puramente tooling (script Playwright); a 2 é navegação do sócio (manual, ~1-2h); a 3 é análise + documentação.

---

#### 🛠️ Sub-task 1 — Monarch Session Recorder

**Esforço:** 3-4h • **Para o Code implementar**

Script Playwright passivo que captura automaticamente toda a navegação do sócio pelo Monarch (telas, HTML, CSS, design tokens, ordem do fluxo). Especificação completa em `docs/features/redesign-ux/visao.md` seção 4.2.

**Entregáveis:**

- `scripts/monarch-recorder.ts` (ou `.mjs`) — ~120 linhas
- Lib: `playwright` (já será adicionada como dev dep em #59 — reaproveitar)
- Modo: `launchPersistentContext` em pasta `.playwright-monarch-profile/` (gitignorada) para preservar login entre runs
- Viewport: 1920×1080 (full-page screenshots cobrem scroll)
- Event listener: `page.on('load', captureSnapshot)`
- `captureSnapshot()` deve gerar em `docs/features/redesign-ux/monarch-session/step-NNN-<slug>/`:
  - `screenshot.png` (full-page)
  - `page.html` (`page.content()`)
  - `styles.css` (consolidado de `document.styleSheets`, tratando CORS-blocked)
  - `tokens.json` (CSS custom properties no `:root`, via `getComputedStyle`)
  - Entrada em `journey.json` no root da sessão (n°, timestamp, url, título, slug)
- Comando: `npm run monarch:record` no `package.json` chamando `npx tsx scripts/monarch-recorder.ts`
- Tratamento: ao fechar o browser, script encerra graceful (não trava)
- `docs/features/redesign-ux/monarch-session/` adicionado ao `.gitignore`
- `.playwright-monarch-profile/` adicionado ao `.gitignore`

**Checkpoint:** sócio roda `npm run monarch:record`, navega 3 telas teste, fecha o browser. Output em disco tem 3 pastas `step-001-*`, `step-002-*`, `step-003-*` com os 4 arquivos cada, e `journey.json` com 3 entradas.

---

#### 🚶 Sub-task 2 — Navegação completa do sócio no Monarch

**Esforço:** 1-2h • **Para o sócio executar (manual)**

Com o recorder rodando, sócio percorre as telas listadas em `docs/features/redesign-ux/visao.md` seção 4.2 ("Lista mínima para ele navegar"). Não precisa otimizar — o recorder pega tudo, então melhor exagerar na navegação.

**Checkpoint:** `journey.json` tem ≥ 30 entradas cobrindo Dashboard, Transactions, Adicionar Transação, Shared Views, Reports, Goals, Settings e Onboarding.

---

#### 🧪 Sub-task 3 — Análise da captura + extração de tokens

**Esforço:** 1-2 dias • **Para Pontes + sócio em revisão cruzada**

Com a sessão capturada, extrair os tokens visuais e documentar.

**Extrair de `monarch-session/`:**

- **Paleta:** 3-5 cores principais + escala de neutros (mínimo 10 tons de cinza) + cores semânticas (sucesso, erro, atenção, info). Fonte: `tokens.json` consolidado + `styles.css` (procurar `--color-*`, `--bg-*`, hex values recorrentes)
- **Tipografia:** família, escala (1.125x ou 1.25x), pesos usados, line-height. Fonte: `styles.css` + computed em `tokens.json`
- **Espaçamento:** unidade base (4px ou 8px) e escala. Fonte: `--space-*` + valores recorrentes em `padding`/`margin`
- **Raio de borda:** valores. Fonte: `--radius-*` ou `border-radius` recorrentes
- **Sombras:** níveis de elevação (mínimo 3). Fonte: `box-shadow` recorrentes
- **Estados:** hover, focus, active, disabled para botões e inputs. Fonte: regras `:hover`, `:focus`, `:active`, `[disabled]` em `styles.css`

**Outputs:**

- `docs/design-tokens.md` com tabelas legíveis (paleta, tipografia, espaçamento, etc.)
- `controle-financeiro.web/src/theme/tokens.ts` exportando constantes TypeScript
- `controle-financeiro.web/src/theme/theme.ts` ajustado para usar os novos tokens via `createTheme(...)` MUI
- Pelo menos 1 componente já refatorado para validar que os tokens funcionam end-to-end

**Checkpoint:** `docs/design-tokens.md` revisado pelos 2 devs; `tokens.ts` importável e usado em pelo menos 1 componente; toggle dark/light no novo componente usa as variantes corretas.

---

### 🟡 #61 — Fase 3: Refator de 3 telas piloto

**Severidade:** 🟡 ALTA • **Esforço:** 3-5 dias • **Status:** ⏳ NÃO INICIADO

**Por quê:** Aplicar tokens em 3 telas representativas valida a direção antes de propagar pelo app inteiro. Errar piloto é barato; errar tudo é caro.

**Escopo:**
- **Tela A — Dashboard:** densidade de informação, hierarquia visual, gráficos. Referência Monarch direta.
- **Tela B — FamiliasPage:** lista de membros, balanço, despesas compartilhadas. Diferencial competitivo nosso.
- **Tela C — Adicionar/editar transação:** formulário mais usado. UX de input critica.
- Cada tela: print do "antes" (atlas da #59) lado a lado com print do "depois" no PR
- Componentes reutilizáveis criados durante o piloto devem ser documentados (Storybook fica para depois — overhead alto agora)

**Checkpoint:** 3 telas em produção com novos tokens; revisão entre os 2 devs aprova a direção.

---

### 🟠 #62 — Fase 4: Propagação dos tokens para o resto do app

**Severidade:** 🟠 MÉDIA • **Esforço:** 1 semana • **Status:** ✅ CONCLUÍDO — PR #72 mergeado em main (2026-05-20)

**Por quê:** Telas piloto valeram pra calibrar; agora aplica em todas as outras (transações, faturas, cartões, contas, importação, onboarding, etc.).

**Escopo:**
- Listar todas as páginas remanescentes a partir do atlas da #59
- Aplicar tokens novos página a página
- Refator de componentes compartilhados (Navbar, Sidebar, Modais, Tabelas, Cards)
- Garantir consistência: nenhum hex hardcoded fora de `tokens.ts`/MUI theme
- Atualizar atlas Playwright (`npm run snapshot`) ao final — comparar com baseline da #59

**Checkpoint:** Atlas pós-propagação consistente visualmente; nenhuma página destoa.

---

### 🟠 #63 — Fase 5: Refinar dark mode sobre os novos tokens

**Severidade:** 🟠 MÉDIA • **Esforço:** 1-2 dias • **Status:** 🔄 EM REVISÃO — PR #73 aberto (2026-05-20)

**Por quê:** O dark mode entregue no #31 foi construído sobre a base visual antiga. Com tokens novos, vale revalidar e ajustar.

**Escopo:**
- Audit do dark mode existente contra os tokens novos
- Ajustar paleta dark (não é só inverter — ajustar contrastes e neutros)
- Validar contraste AA WCAG em texto/fundo
- Atualizar atlas Playwright com viewport dark também

**Checkpoint:** Toggle light/dark consistente em todas as páginas; sem regressões visuais.

---

---

## 🅱️ BLOCO B — Dívida técnica & regras de negócio

### 🟠 #64 — Refatoração do frontend

**Severidade:** 🟠 MÉDIA • **Esforço:** 2-3 dias • **Status:** ⏳ NÃO INICIADO

**Por quê:** Com o redesign das telas piloto (issues #59-#61), o `CreditCardsPage.tsx` e outros componentes cresceram em responsabilidade. Antes de propagar o redesign (#62), vale dividir componentes grandes, eliminar lógica inline e padronizar padrões de estado.

**Escopo:**
- `CreditCardsPage.tsx` — extrair `FaturaTable`, `FaturaRow`, `FaturaTransacaoRows` em componentes próprios
- Padronizar tratamento de loading/error em todas as páginas (hook `useAsync` ou similar)
- Eliminar props drilling profundo — avaliar Context ou query cache (React Query)
- Garantir que nenhuma página tenha mais de ~300 linhas
- Revisar e unificar os padrões de service (`axiosClient`) e tipagem das respostas

**Checkpoint:** `CreditCardsPage.tsx` < 300 linhas; componentes de fatura reutilizáveis; lint sem warnings.

---

### 🔴 #65 — Refatoração das regras de negócio do cartão de crédito

**Severidade:** 🔴 ALTA • **Esforço:** 1-2 dias • **Status:** ⏳ NÃO INICIADO

**Por quê:** Durante o desenvolvimento da sessão de maio/2026 foram descobertos inconsistências entre `EstadoPagamento` (persistido no banco) e `valorRestante` (calculado dinamicamente). O flag pode ficar "sujo" quando uma transação é adicionada a uma fatura já paga. Isso causa bugs visuais e pode causar bloqueio indevido de pagamento.

**Escopo:**
- `FaturaService`: ao adicionar transação a uma fatura com `EstadoPagamento = Pago`, recalcular e corrigir o estado (`Pago → Parcial` ou `Pago → NaoPago`)
- `FaturaService.PagarFaturaAsync`: proteger contra double-payment usando `valorRestante` calculado on-the-fly, não o valor armazenado
- `CartaoCreditoService`: validar invariante — `estadoPagamento = Pago` implica `valorRestante = 0`; logar warning se inconsistente
- Cobrir os cenários com testes unitários: pagar fatura, adicionar transação pós-pagamento, recalcular estado
- Atualizar `docs/features/cartao-credito/regras.md` com o comportamento corrigido

**Checkpoint:** Adicionar transação a fatura já paga atualiza `EstadoPagamento` corretamente; testes cobrem os 3 cenários de estado.

---

## Histórico

Backlog anterior (Q3 2026, Issues #11-#31) — todos concluídos.
Ver: `docs/history/ISSUES_2026Q3.md`
