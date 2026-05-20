---
owner: Gustavo
last_reviewed: 2026-05-21
next_review: 2026-08-21
status: CURRENT
---

# Progress Tracker — Q5 2026

**Objetivo:** Refator completo tela por tela (front + back + testes) seguindo o fluxo natural do produto. Marca decidida (nome Pontes, logo wordmark+arco, tipografia fixa Plus Jakarta). Foco em deixar tudo que existe **funcionando** + criar o que falta no site público + completar gaps de produto (subcategorias, metas, limites, módulo família avançado).

**Backlog atual:** 18 issues (#75-#92).
**Iniciado em:** 2026-05-21.

---

## Dashboard

```
Site público (6):       1/6  ✅ #75  ⏳ #76 #77 #78 #79 #80
Telas internas (9):     0/9  ⏳ #81 #82 #83 #84 #85 #86 #87 #88 #89
Infra e qualidade (3):  0/3  ⏳ #90 #91 #92
Fundação (1):           1/1  ✅ #101 biblioteca Pontes

Total Q5 2026:          2/19 (10.5%)
```

**Status geral:** ciclo recém iniciado. Q4 2026 fechado parcialmente — telas piloto (#61), propagação tokens (#62), brand preview + design system (#74) mergeados; dark mode (#63 / PR #73) cancelado e absorvido pela nova estratégia de refator completo.

**Marca decidida na sessão de 2026-05-21:**
- Nome: **Pontes**
- Logo: conceito 20 (wordmark + arco sublinhado) em `src/components/Logo/Logo.tsx`
- Tipografia da marca: **Plus Jakarta Sans** (fixa)
- Paleta e fonte do produto: escolha do usuário via personalização in-app (#90)

---

## Em progresso

(nenhuma issue em execução — próxima livre: #77 Para Casais, #78 Contadores, #79 Recursos, #80 Sobre, ou telas internas #81-#89)

## Resolvidos Q5

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
