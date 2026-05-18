---
owner: Gustavo
archived_at: 2026-05-18
status: ARQUIVADO
---

# Issues & Roadmap — Q3 2026 [ARQUIVADO]

> Snapshot final do roadmap Q3, encerrado em 2026-05-18 com 21/21 itens concluídos (100%).
> Backlog ativo está em `ISSUES.md` (Q4 2026).

**Contexto do ciclo:** Baseado na análise crítica de produto de 2026-05-15 (`docs/ANALISE_PRODUTO.md`), com decisão de pivot para nicho de finanças familiares/casais.

---

## Resumo final por bloco

### 🅰️ Bloco A — Higiene de Produção (5/5 ✅)

| # | Item | PR | Conclusão |
|---|---|---|---|
| #11 | Segredos via variáveis de ambiente | PR #23 | Sessão 15 |
| #12 | Corrigir CORS contraditório | PR #23 (junto com #11) | Sessão 15 |
| #13 | JWT em httpOnly cookie + CSRF token | PR #26 | Sessões 16–20 |
| #14 | Rate limiting em endpoints sensíveis | — | Sessão 21 |
| #15 | Política de senha forte | — | Sessão 22 |

### 🅱️ Bloco B — Infraestrutura para Escalar (6/6 ✅)

| # | Item | PR | Conclusão |
|---|---|---|---|
| #16 | Migrar SQLite para Postgres | PR #35 | Sessão 23 |
| #17 | Hangfire com PostgresStorage | PR #36 | Sessão 23 |
| #18 | Docker + docker-compose | PR #34 | Sócio |
| #19 | GitHub Actions: build, test, lint | PR #38 | Sócio |
| #20 | Health checks + observabilidade | PR #39 | Sessão 23 |
| #21 | Testes frontend (Vitest + RTL) | — | Sócio |

### 🅲️ Bloco C — Pivot Família (5/5 ✅)

| # | Item | PR | Conclusão |
|---|---|---|---|
| #22 | Família + Membros | PR #42 | Sessão 24 |
| #23 | Despesa Compartilhada (igualitário) | PR #46 | Sessão 24 |
| #24 | Dependentes | PR #48 | Sessão 24 |
| #25 | Modos de rateio (proporcional + custom) | PR #49 | Sessão 24 |
| #26 | Acerto de contas | PR #50 | Sessão 24 |

### 🅳️ Bloco D — Retenção e UX B2C (5/5 ✅)

| # | Item | PR | Conclusão |
|---|---|---|---|
| #27 | Importação OFX/CSV de extrato bancário | PR #51 | Sessão 24 |
| #28 | PWA instalável + offline básico | PR #54 | Sessão 24 |
| #29 | Onboarding guiado pós-cadastro | PR #52 | Sessão 24 |
| #30 | Notificações (escopo in-app) | PR #53 | Sessão 24 |
| #31 | Dark mode | — | Sessão 26 (sócio) |

**Notas sobre o Bloco D:**
- #30 entregue só em escopo in-app. Web Push (VAPID) e e-mail (SMTP) ficam como follow-up para próximos ciclos
- #31 chegou a ser pausada na sessão 25 quando se decidiu pivotar para redesign UX. Pause revertida na sessão 26: sócio terminou a entrega; revalidação prevista em Q4 sobre os novos design tokens

---

## Total

**21/21 (100%) concluídos** em 4 dias úteis (2026-05-15 a 2026-05-18) — distribuído entre dois devs trabalhando em paralelo.

## Saída do ciclo

Decisão estratégica para Q4 2026: **redesign UX inspirado no Monarch Money** como ciclo monobloc, ambos os devs no front. Detalhes em `ISSUES.md` (raiz) e `docs/features/redesign-ux/visao.md`.

## Backlog Q2 2026 (concluído antes de Q3)

10 itens (Issues #1–#10), todos concluídos. Detalhes em `docs/history/ISSUES_2026Q2.md`.
