---
owner: Gustavo
last_reviewed: 2026-05-18
next_review: 2026-08-18
status: CURRENT
---

# Progress Tracker — Q4 2026

**Objetivo:** Elevar o nível visual e de UX do produto ao patamar de "produto pago de verdade", usando **Monarch Money** como referência. Ciclo monobloc de redesign.
**Backlog atual:** 5 itens em 1 bloco único.
**Iniciado em:** 2026-05-18.

---

## Dashboard

```
Bloco A — Redesign UX (inspirado em Monarch Money):  2/5  ✅ #59 #60  ⏳ #61, #62, #63

Total Q4 2026:                                       2/5 (40%)
```

**Status geral:** ciclo em andamento. #59 (Atlas Playwright) e #60 (Design tokens) concluídas. Q3 2026 encerrou com 21/21 (100%) — ver `docs/history/PROGRESS_2026Q3.md`. A decisão estratégica deste ciclo: pausar entrega de features novas e investir no nível visual/UX do produto, porque o frontend funcional não é suficiente para B2C de finanças pago. Referência escolhida: Monarch Money (US-only, foco em casais/família, design system maduro, $850M de valor).

Ambos os devs trabalhando no front juntos. Distribuição prevista: Pontes lidera atlas + extração de tokens; sócio lidera telas piloto; revisão cruzada.

---

## Em progresso

**#61 — Fase 3: Refator de 3 telas piloto.** Branch `feature/61-telas-piloto`, 2/3 telas:
- ✅ Dashboard — hero, cards de conta, donut, KPIs, tabela tokenizada
- ✅ FamiliasPage — cards com avatar, dialog tokenizado, bug HTML corrigido
- ⏳ Adicionar/editar transação

`DevDataSeeder` popula o banco; `npm run snapshot` gera o atlas com dados reais.

---

## Backlog Q3 2026 (concluído)

21 itens em 4 blocos, todos resolvidos. Histórico completo em `docs/history/PROGRESS_2026Q3.md` e `docs/history/ISSUES_2026Q3.md`.

Síntese:
- ✅ Bloco A — Higiene de Produção (5/5): #11–#15
- ✅ Bloco B — Infraestrutura para Escalar (6/6): #16–#21
- ✅ Bloco C — Pivot Família (5/5): #22–#26
- ✅ Bloco D — Retenção e UX B2C (5/5): #27–#31

Suíte de testes: 130+ ao fim do Q3.

---

## Histórico de sessões

(Será preenchido conforme o ciclo avança.)

### Sessão 27 — 2026-05-18
- Início do ciclo Q4 — Redesign UX
- Criadas issues #59-#63 no GitHub
- **#59 concluída** (PR #64) — `scripts/snapshot.ts` (atlas Playwright),
  `npm run snapshot`, validado: 36 PNGs em 47.5s
- **#60 sub-task 1 concluída** — `scripts/monarch-recorder.ts` (Monarch
  Session Recorder), `npm run monarch:record`
- PR #65 — fix: `/auth/register` inacessível (interceptor 401 redirecionava)
- Numeração interna alinhada à do GitHub (#59-#63)

### Sessão 28 — 2026-05-18
- **#60 concluído** — Caio rodou o recorder no Monarch (sub-task 2) e
  extraiu os design tokens (sub-task 3, PR #67): `tokens.ts`, `theme.ts`,
  `design-tokens.md`, `EmptyState` refatorado
- PR #66 — recorder: suporte a Chrome instalado (`MONARCH_CHANNEL`) +
  captura de navegação SPA (`framenavigated`)
- PR #68 — fix pós-review: cor de marca trocada do laranja Monarch para
  teal placeholder; `borderRadius`/`fontSize` via token
- PR #69 — `DevDataSeeder`: dados de exemplo (dev com família + solo),
  saldos realistas via "Saldo Inicial". Valida o atlas com telas cheias.
- **Q4 em 2/5.** Próxima ação: #61 — refator das 3 telas piloto, Caio lidera

---

## Checklist de encerramento de sessão

Cada sessão que tocar em código deve, ao terminar, atualizar este arquivo:

1. Mover itens iniciados de "Pendentes" para "Em progresso" ou "Resolvidos"
2. Atualizar dashboard (`X/Y` do bloco)
3. Adicionar entrada nova em "Histórico de sessões" com data, o que foi feito, próxima ação
4. Se um item virou concluído, mover seção dele de `ISSUES.md` para a área "Resolvidos" (mantém referência)
5. Commit do estado: `chore(docs): atualiza progress — sessão N`
