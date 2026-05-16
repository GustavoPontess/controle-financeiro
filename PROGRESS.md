---
owner: Gustavo
last_reviewed: 2026-05-15
next_review: 2026-08-15
status: CURRENT
---

# Progress Tracker — Q3 2026

**Objetivo:** Tornar o projeto produto B2C de finanças familiares.
**Backlog atual:** 21 itens em 4 blocos sequenciais (ver `ISSUES.md`).
**Iniciado em:** 2026-05-15.

---

## Dashboard

```
Bloco A — Higiene de Produção:          2/5  ✅ #11, #12
Bloco B — Infraestrutura para Escalar:  0/6  ⏳
Bloco C — Pivot Família:                0/5  ⏳
Bloco D — Retenção e UX B2C:            0/5  ⏳

Total Q3 2026:                          2/21 (9%)
```

**Status geral:** Bloco A 40% concluído. Issues #11, #12 fechadas em 1 sessão.

---

## Backlog Q2 2026 (concluído)

Todos os 10 issues do backlog anterior foram resolvidos.
Histórico completo em `docs/history/PROGRESS_2026Q2.md` e `docs/history/ISSUES_2026Q2.md`.

Síntese:
- ✅ #1 Parcelamento Flexível (11h)
- ✅ #2 Testes Unitários/Integração (1h — 48 testes)
- ✅ #3 Validações de Negócio (30min)
- ✅ #4 Paginação em Endpoints (1h)
- ✅ #5 Autenticação Robusta — refresh + reset (1h)
- ✅ #6 Documentação com Dono e Revisão (20min)
- ✅ #7 API Versioning (`/api/v1`) (1h)
- ✅ #8 Error Handling Consistente (1h)
- ✅ #9 SQL Raw removido de Program.cs (30min)
- ✅ #10 Features Básicas — relatórios, CSV, orçamento (2h, parcial)

---

## Em progresso

Nenhum item em execução. Aguardando início do **Bloco A** (higiene de produção).

---

## Histórico de sessões

### Sessão 15 — 2026-05-16
- **Issue #11 — Segredos via variáveis de ambiente (✅ CONCLUÍDA)**
  - Moveu JWT secret, database URL e CORS origins para variáveis de ambiente via `DotNetEnv`
  - Criou `.env.example` versionado; `.env` local ignorado
  - Atualizou `Program.cs` com `Env.Load()` e fallback claro (fail-fast)
  - Removeu segredos de `appsettings.json` versionado
  - Testou build ✅, API sobe com `.env` ✅, erro sem vars ✅
  - Documentou em `docs/STANDARDS.md` §Configuration via Environment Variables
  - PR #23 mergeado em main
  
- **Issue #12 — Corrigir CORS contraditório (✅ CONCLUÍDA)**
  - Removido `.AllowAnyOrigin()` que sobrescrevia `WithOrigins()`
  - CORS origins agora lidos dinamicamente de `CORS_ALLOWED_ORIGINS` env var
  - Resolvida como parte de #11 (mesmo commit que env vars)
  - Requisição de origem não-permitida retorna erro CORS correto
  - Issue #12 fechada

- **Próxima ação:** Issue #13 (JWT em httpOnly cookie + CSRF token) — Bloco A, segurança crítica

### Sessão 14 — 2026-05-15
- Análise crítica completa do projeto sob lente de produto B2C (`docs/ANALISE_PRODUTO.md`)
- Decisão de pivot para nicho de finanças familiares/casais
- Reorganização da documentação em `docs/features/` por feature
- Backlog Q2 arquivado em `docs/history/`
- Novo backlog Q3 criado com 21 itens em 4 blocos
- Visão da feature Família escrita (`docs/features/familia/visao.md`)

---

## Checklist de encerramento de sessão

Cada sessão que tocar em código deve, ao terminar, atualizar este arquivo:

1. Mover itens iniciados de "Pendentes" para "Em progresso" ou "Resolvidos"
2. Atualizar dashboard (`X/Y` de cada bloco)
3. Adicionar entrada nova em "Histórico de sessões" com data, o que foi feito, próxima ação
4. Se um item virou concluído, mover seção dele de `ISSUES.md` para a área "Resolvidos" (mantém referência)
5. Commit do estado: `chore(docs): atualiza progress — sessão N`
