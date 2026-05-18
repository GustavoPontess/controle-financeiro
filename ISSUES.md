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

### 🟡 #32 — Fase 1: Atlas Playwright das telas atuais

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

### 🟡 #33 — Fase 2: Design tokens do Monarch

**Severidade:** 🟡 ALTA • **Esforço:** 2 dias • **Status:** ⏳ NÃO INICIADO

**Por quê:** Sem tokens bem definidos, "redesign" vira opinião subjetiva. Tokens dão objetivo executável.

**Escopo:**
- Extrair de fontes públicas + screenshots reais do app interno (via conta do sócio):
  - **Paleta:** 3-5 cores principais + escala de neutros (mínimo 10 tons de cinza) + cores semânticas (sucesso, erro, atenção, info)
  - **Tipografia:** família, escala (1.125x ou 1.25x), pesos usados, line-height
  - **Espaçamento:** unidade base (4px ou 8px) e escala
  - **Raio de borda:** valores
  - **Sombras:** níveis de elevação (mínimo 3)
  - **Estados:** hover, focus, active, disabled para botões e inputs
- Output: `docs/design-tokens.md` com tabelas + arquivo `src/theme/tokens.ts` no frontend exportando as constantes
- Adaptar tokens MUI (`createTheme`) para usar os novos valores em vez dos defaults

**Checkpoint:** `docs/design-tokens.md` revisado pelos 2 devs; `tokens.ts` importável e usado em pelo menos 1 componente.

---

### 🟡 #34 — Fase 3: Refator de 3 telas piloto

**Severidade:** 🟡 ALTA • **Esforço:** 3-5 dias • **Status:** ⏳ NÃO INICIADO

**Por quê:** Aplicar tokens em 3 telas representativas valida a direção antes de propagar pelo app inteiro. Errar piloto é barato; errar tudo é caro.

**Escopo:**
- **Tela A — Dashboard:** densidade de informação, hierarquia visual, gráficos. Referência Monarch direta.
- **Tela B — FamiliasPage:** lista de membros, balanço, despesas compartilhadas. Diferencial competitivo nosso.
- **Tela C — Adicionar/editar transação:** formulário mais usado. UX de input critica.
- Cada tela: print do "antes" (atlas da #32) lado a lado com print do "depois" no PR
- Componentes reutilizáveis criados durante o piloto devem ser documentados (Storybook fica para depois — overhead alto agora)

**Checkpoint:** 3 telas em produção com novos tokens; revisão entre os 2 devs aprova a direção.

---

### 🟠 #35 — Fase 4: Propagação dos tokens para o resto do app

**Severidade:** 🟠 MÉDIA • **Esforço:** 1 semana • **Status:** ⏳ NÃO INICIADO

**Por quê:** Telas piloto valeram pra calibrar; agora aplica em todas as outras (transações, faturas, cartões, contas, importação, onboarding, etc.).

**Escopo:**
- Listar todas as páginas remanescentes a partir do atlas da #32
- Aplicar tokens novos página a página
- Refator de componentes compartilhados (Navbar, Sidebar, Modais, Tabelas, Cards)
- Garantir consistência: nenhum hex hardcoded fora de `tokens.ts`/MUI theme
- Atualizar atlas Playwright (`npm run snapshot`) ao final — comparar com baseline da #32

**Checkpoint:** Atlas pós-propagação consistente visualmente; nenhuma página destoa.

---

### 🟠 #36 — Fase 5: Refinar dark mode sobre os novos tokens

**Severidade:** 🟠 MÉDIA • **Esforço:** 1-2 dias • **Status:** ⏳ NÃO INICIADO

**Por quê:** O dark mode entregue no #31 foi construído sobre a base visual antiga. Com tokens novos, vale revalidar e ajustar.

**Escopo:**
- Audit do dark mode existente contra os tokens novos
- Ajustar paleta dark (não é só inverter — ajustar contrastes e neutros)
- Validar contraste AA WCAG em texto/fundo
- Atualizar atlas Playwright com viewport dark também

**Checkpoint:** Toggle light/dark consistente em todas as páginas; sem regressões visuais.

---

## Histórico

Backlog anterior (Q3 2026, Issues #11-#31) — todos concluídos.
Ver: `docs/history/ISSUES_2026Q3.md`
