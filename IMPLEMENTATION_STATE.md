---
owner: Gustavo
last_reviewed: 2026-05-18
status: EM_EXECUCAO
issue_atual: '#59 concluída + #60 sub-task 1 concluída — falta #60 sub-tasks 2 e 3'
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

**Issue:** **#60 — Fase 2: Design tokens** (sub-tasks 2 e 3 pendentes)
**Bloco:** A (Redesign UX)
**Status:** EM EXECUÇÃO — branch `feature/32-33-playwright-tooling`

### Concluído nesta sessão (PR a abrir)

**#59 — Atlas Playwright:** ✅ COMPLETA
- `playwright` + `tsx` instalados como dev deps; chromium baixado
- `scripts/snapshot.ts` — login via UI, varre 18 rotas, screenshot full-page
  desktop (1440x900) + mobile (390x844)
- `npm run snapshot` no `package.json`
- `screenshots/` no `.gitignore`
- Validado: 18 rotas x 2 viewports = 36 PNGs em 47.5s (< 3min ✓)
- Doc no `controle-financeiro.web/README.md`

**#60 sub-task 1 — Monarch Session Recorder:** ✅ COMPLETA
- `scripts/monarch-recorder.ts` — Playwright passivo, `launchPersistentContext`,
  captura screenshot/HTML/CSS/tokens por tela, `journey.json`
- `npm run monarch:record` no `package.json`
- `monarch-session/` e `.playwright-monarch-profile/` no `.gitignore`
- Typecheck OK; checkpoint funcional depende do sócio rodar (precisa conta Monarch)

### Decisão: seguir solo

Sócio sumiu — sem revisão cruzada do plano. Decisão de tocar #59/#60 solo;
o PR serve de revisão assíncrona quando o sócio voltar. Pré-requisito de
acesso ao Monarch fica com o sócio (sub-task 2).

### Próxima ação concreta

**#60 sub-task 2 — Navegação do sócio no Monarch (manual, bloqueado):**
- Aguarda o sócio passar acesso à conta Monarch
- Sócio roda `npm run monarch:record`, navega as telas de `visao.md` §4.2
- Checkpoint: `journey.json` >= 30 entradas

**#60 sub-task 3 — Análise + extração de tokens (depois da sub-task 2):**
- Extrair paleta, tipografia, espaçamento, raio, sombras, estados de
  `monarch-session/`
- Outputs: `docs/design-tokens.md`, `src/theme/tokens.ts`, `src/theme/theme.ts`,
  >= 1 componente refatorado

**Enquanto bloqueado:** atlas da #59 já dá baseline do nosso app — pode
adiantar análise visual comparando com material público do Monarch
(`visao.md` §4.1).

---

## Roadmap visual do ciclo

```
Fase 1 — Atlas (#59)            ⏳ Aguardando início
  ↓
Fase 2 — Design Tokens (#60)    ⏳ Pendente
  ↓
Fase 3 — Telas piloto (#61)     ⏳ Pendente (3 telas: Dashboard, FamiliasPage, Adicionar Transação)
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
