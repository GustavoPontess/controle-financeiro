---
owner: Gustavo
last_reviewed: 2026-05-18
status: EM_EXECUCAO
issue_atual: '#61 — 3 telas piloto, 2/3 feitas (Dashboard, FamiliasPage); falta Adicionar Transação'
---

# Implementation State — sessão atual

**Este arquivo é o checkpoint vivo entre sessões.** Toda sessão começa lendo este arquivo, e termina atualizando-o.

> O estado do ciclo anterior (Q3 2026, 21/21 itens) está arquivado em `docs/history/IMPLEMENTATION_STATE_2026Q3.md`.

---

## Ciclo em execução

**Ciclo:** Q4 2026 — Redesign UX inspirado em Monarch Money
**Iniciado em:** 2026-05-18 (após encerramento do Q3)
**Backlog:** 5 issues (#59-#63) em bloco único
**Spec da iniciativa:** `docs/features/redesign-ux/visao.md`

---

## Issue em execução

**Issue:** **#61 — Fase 3: Refator de 3 telas piloto**
**Bloco:** A (Redesign UX)
**Status:** EM EXECUÇÃO — branch `feature/61-telas-piloto` (2/3 telas)

### Progresso #61
- ✅ Dashboard (commit `fb1abe3`) — saudação, hero teal, cards de conta com
  avatar gradiente, seção mensal, donut de categorias, KPIs com avatar.
  `TransactionTable` (compartilhado) tokenizado, linhas com ícone/chips,
  ações em menu `⋮` quando o container estreita.
- ✅ FamiliasPage (commit `1a03d0a`) — cards de família com avatar, dialog
  tokenizado, bug HTML corrigido (`Chip` dentro de `Typography`).
- ⏳ Adicionar/editar transação — pendente.

### Próxima ação concreta
Refatorar a 3ª tela piloto: formulário de adicionar/editar transação
(`EditTransactionDialog` e o fluxo de "Nova Transação"). Aplicar tokens,
mesmo padrão visual do Dashboard/FamiliasPage. Build + commit, depois
abrir PR fechando o #61.

### Concluído (#59 e #60)

**#59 — Atlas Playwright:** ✅ COMPLETA (PR #64)
- `scripts/snapshot.ts` — login via UI, varre 18 rotas, screenshot full-page
  desktop (1440x900) + mobile (390x844); `npm run snapshot`
- `screenshots/` no `.gitignore`; doc no README do frontend

**#60 — Design tokens:** ✅ COMPLETA
- sub-task 1 — `scripts/monarch-recorder.ts` (PR #64); recorder com Chrome
  instalado + captura SPA (PR #66)
- sub-task 2 — Caio rodou o recorder no Monarch
- sub-task 3 — `src/theme/tokens.ts`, `src/theme/theme.ts`,
  `docs/design-tokens.md`, `EmptyState` refatorado (PR #67)
- pós-review (PR #68): cor de marca = teal placeholder (`#0d9488`), não o
  laranja do Monarch; `borderRadius`/`fontSize` via token

### Apoio: DevDataSeeder (PR #69)

`ControleFinanceiro.Api/Data/DevDataSeeder.cs` — só Development, idempotente.
Cria `dev@controle.test` (com família/casal), `conjuge@controle.test` e
`solo@controle.test` (sem família), com contas e ~transações realistas.
Faz o atlas capturar telas cheias em vez de vazias.

---

## Roadmap visual do ciclo

```
Fase 1 — Atlas (#59)            ✅ Concluída
  ↓
Fase 2 — Design Tokens (#60)    ✅ Concluída
  ↓
Fase 3 — Telas piloto (#61)     🔵 Em execução (2/3: Dashboard ✅, FamiliasPage ✅, Add Transação ⏳)
  ↓
Fase 4 — Propagação (#62)       ⏳ Pendente
  ↓
Fase 5 — Dark mode revisão (#63) ⏳ Pendente
```

Cada fase tem checkpoint próprio no `ISSUES.md`. Não pular fases — cada uma valida a próxima.

---

## Divisão de trabalho prevista (a confirmar com sócio)

- **Pontes (Gustavo):** lidera #59 (atlas Playwright) e #60 (extração de tokens). É a fase mais técnica/menos visual; trabalha bem solo.
- **Sócio:** lidera #61 (telas piloto) com input do Pontes na revisão. Forte em frontend, mais próximo de design visual.
- **Ambos:** revisão cruzada em #62 e #63. Telas restantes podem ser divididas por área (sócio: relatórios; Pontes: importação/onboarding).
- **Em paralelo:** sócio está criando conta real no Monarch para capturar screenshots internos. Material que enriquece #60 (tokens) sem bloquear o início de #59.

---

## Decisões registradas

- **Ciclo monobloc:** sem segunda frente paralela. Os 2 devs concentram no redesign para ter ganho visível rápido.
- **Atlas Playwright em vez de Storybook:** Storybook é mais robusto mas tem overhead de setup alto. Atlas resolve a necessidade imediata (ver o que temos, baseline visual). Storybook fica como possibilidade futura quando os componentes estabilizarem.
- **Material público + acesso interno via conta do sócio:** sem custo de Mobbin/Pageflows. Conta real do Monarch (free trial ou plano básico) dá screenshots internos que valem mais que catálogos pagos.
- **Tokens primeiro, refator depois:** evita opinião subjetiva no piloto. Tokens viram contrato objetivo.

---

## Pontos pendentes / dúvidas

- Confirmar com o sócio: divisão de issues entre os 2 está OK?
- Definir usuário de teste para o script Playwright (criar `dev@controle.test` com dados seed?)
- O atlas vai no repo ou em pasta separada? Sugestão: `screenshots/` no `.gitignore`; gerar sob demanda.
- Quando rodar atlas: localmente, em CI, ou ambos? Sugestão: localmente por enquanto; CI quando virar regressão visual ativa.

---

## Template para preencher quando começar uma issue

```
## Issue em execução

**Issue:** #XX — [nome]
**Bloco:** A (Redesign UX)
**Iniciada em:** YYYY-MM-DD
**Sessões nessa issue:** N

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
