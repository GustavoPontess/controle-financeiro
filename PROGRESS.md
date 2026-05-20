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
Site público (6):       0/6  ⏳ #75 #76 #77 #78 #79 #80
Telas internas (9):     0/9  ⏳ #81 #82 #83 #84 #85 #86 #87 #88 #89
Infra e qualidade (3):  0/3  ⏳ #90 #91 #92

Total Q5 2026:          0/18 (0%)
```

**Status geral:** ciclo recém iniciado. Q4 2026 fechado parcialmente — telas piloto (#61), propagação tokens (#62), brand preview + design system (#74) mergeados; dark mode (#63 / PR #73) cancelado e absorvido pela nova estratégia de refator completo.

**Marca decidida na sessão de 2026-05-21:**
- Nome: **Pontes**
- Logo: conceito 20 (wordmark + arco sublinhado) em `src/components/Logo/Logo.tsx`
- Tipografia da marca: **Plus Jakarta Sans** (fixa)
- Paleta e fonte do produto: escolha do usuário via personalização in-app (#90)

---

## Em progresso

(nenhuma issue em execução — Q5 começou)

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

---

## Checklist de encerramento de sessão

Cada sessão que tocar em código deve, ao terminar, atualizar este arquivo:

1. Mover itens iniciados de "Pendentes" para "Em progresso" ou "Resolvidos"
2. Atualizar dashboard (`X/Y` dos grupos)
3. Adicionar entrada nova em "Histórico de sessões" com data, o que foi feito, próxima ação
4. Se um item virou concluído, mover seção dele de `ISSUES.md` para a área "Resolvidos" (mantém referência)
5. Commit do estado: `chore(docs): atualiza progress — sessão N`
