---
owner: Gustavo
last_reviewed: 2026-05-18
status: AGUARDANDO_INICIO
issue_atual: '#32 — Atlas Playwright (não iniciada)'
---

# Implementation State — sessão atual

**Este arquivo é o checkpoint vivo entre sessões.** Toda sessão começa lendo este arquivo, e termina atualizando-o.

> O estado do ciclo anterior (Q3 2026, 21/21 itens) está arquivado em `docs/history/IMPLEMENTATION_STATE_2026Q3.md`.

---

## Ciclo em execução

**Ciclo:** Q4 2026 — Redesign UX inspirado em Monarch Money
**Iniciado em:** 2026-05-18 (após encerramento do Q3)
**Backlog:** 5 issues (#32-#36) em bloco único
**Spec da iniciativa:** `docs/features/redesign-ux/visao.md`

---

## Issue em execução

**Issue:** Nenhuma iniciada ainda — próxima é **#32 — Fase 1: Atlas Playwright**
**Bloco:** A (Redesign UX)
**Status:** AGUARDANDO INÍCIO

### Pré-requisitos para começar
- [x] Q3 arquivado em `docs/history/`
- [x] PROGRESS.md, ISSUES.md e este arquivo resetados para Q4
- [x] `docs/features/redesign-ux/visao.md` criado
- [x] Sócio com acesso ao Monarch (conta criada, logado)
- [ ] Sócio confirma alinhamento do plano (revisão pelos 2 devs)

### Próxima ação concreta (duas frentes paralelizáveis pelo Code)

**Frente 1 — #32 Atlas Playwright (nosso app):**
1. Criar branch `feature/32-atlas-playwright` a partir de `main`
2. `npm install -D playwright @playwright/test`
3. `npx playwright install chromium`
4. Criar `scripts/snapshot.ts` conforme spec em `docs/features/redesign-ux/visao.md` → Fase 1
5. Comando `npm run snapshot` no `package.json`
6. Rodar localmente e gerar primeiro atlas em `screenshots/atlas/` (gitignored)

**Frente 2 — #33 sub-task 1: Monarch Session Recorder:**
1. Criar branch `feature/33-monarch-recorder` (ou incluir no mesmo PR que #32 — Playwright é dependência comum)
2. Reaproveitar a instalação de `playwright` da Frente 1
3. Criar `scripts/monarch-recorder.ts` conforme spec em `docs/features/redesign-ux/visao.md` → seção 4.2 e `ISSUES.md` → #33 sub-task 1
4. Comando `npm run monarch:record`
5. Adicionar `docs/features/redesign-ux/monarch-session/` e `.playwright-monarch-profile/` ao `.gitignore`
6. Sócio executa: roda o comando, navega Monarch livremente, fecha browser quando satisfeito. Output completo em disco.

**Sequência sugerida do Code:** ambas as frentes em um único PR (`feature/32-33-playwright-tooling`), já que compartilham a dependência `playwright`. Reduz fricção de instalar/configurar duas vezes.

---

## Roadmap visual do ciclo

```
Fase 1 — Atlas (#32)            ⏳ Aguardando início
  ↓
Fase 2 — Design Tokens (#33)    ⏳ Pendente
  ↓
Fase 3 — Telas piloto (#34)     ⏳ Pendente (3 telas: Dashboard, FamiliasPage, Adicionar Transação)
  ↓
Fase 4 — Propagação (#35)       ⏳ Pendente
  ↓
Fase 5 — Dark mode revisão (#36) ⏳ Pendente
```

Cada fase tem checkpoint próprio no `ISSUES.md`. Não pular fases — cada uma valida a próxima.

---

## Divisão de trabalho prevista (a confirmar com sócio)

- **Pontes (Gustavo):** lidera #32 (atlas Playwright) e #33 (extração de tokens). É a fase mais técnica/menos visual; trabalha bem solo.
- **Sócio:** lidera #34 (telas piloto) com input do Pontes na revisão. Forte em frontend, mais próximo de design visual.
- **Ambos:** revisão cruzada em #35 e #36. Telas restantes podem ser divididas por área (sócio: relatórios; Pontes: importação/onboarding).
- **Em paralelo:** sócio está criando conta real no Monarch para capturar screenshots internos. Material que enriquece #33 (tokens) sem bloquear o início de #32.

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
