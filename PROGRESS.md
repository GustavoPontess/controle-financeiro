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
Bloco A — Redesign UX (inspirado em Monarch Money):  1/5  ✅ #59  ⏳ #60, #61, #62, #63

Total Q4 2026:                                       1/5 (20%)
```

**Status geral:** ciclo em andamento. #59 (Atlas Playwright) concluída. Q3 2026 encerrou com 21/21 (100%) — ver `docs/history/PROGRESS_2026Q3.md`. A decisão estratégica deste ciclo: pausar entrega de features novas e investir no nível visual/UX do produto, porque o frontend funcional não é suficiente para B2C de finanças pago. Referência escolhida: Monarch Money (US-only, foco em casais/família, design system maduro, $850M de valor).

Ambos os devs trabalhando no front juntos. Distribuição prevista: Pontes lidera atlas + extração de tokens; sócio lidera telas piloto; revisão cruzada.

---

## Em progresso

**#60 — Fase 2: Design tokens.** Sub-task 1 (Monarch Session Recorder, script Playwright) concluída no mesmo PR da #59. Sub-task 2 (navegação do sócio no Monarch) bloqueada aguardando acesso à conta. Sub-task 3 (análise + extração de tokens) depende da 2.

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
- Criadas issues #59-#63 no GitHub (GH #59-#63)
- **#59 concluída** — `scripts/snapshot.ts` (atlas Playwright), `npm run snapshot`,
  validado: 36 PNGs em 47.5s. Doc no README do frontend.
- **#60 sub-task 1 concluída** — `scripts/monarch-recorder.ts` (Monarch Session
  Recorder), `npm run monarch:record`
- Branch `feature/32-33-playwright-tooling`, PR a abrir (Closes #59)
- Próxima ação: #60 sub-task 2 — sócio navega o Monarch com o recorder
  (bloqueado: aguarda acesso à conta Monarch)

---

## Checklist de encerramento de sessão

Cada sessão que tocar em código deve, ao terminar, atualizar este arquivo:

1. Mover itens iniciados de "Pendentes" para "Em progresso" ou "Resolvidos"
2. Atualizar dashboard (`X/Y` do bloco)
3. Adicionar entrada nova em "Histórico de sessões" com data, o que foi feito, próxima ação
4. Se um item virou concluído, mover seção dele de `ISSUES.md` para a área "Resolvidos" (mantém referência)
5. Commit do estado: `chore(docs): atualiza progress — sessão N`
