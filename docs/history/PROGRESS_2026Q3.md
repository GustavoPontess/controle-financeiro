---
owner: Gustavo
archived_at: 2026-05-18
status: ARQUIVADO
---

# Progress Tracker — Q3 2026 [ARQUIVADO]

> Snapshot final do ciclo Q3 2026, encerrado em 2026-05-18.
> Backlog ativo está em `PROGRESS.md` (Q4 2026 — Redesign UX).

**Objetivo:** Tornar o projeto produto B2C de finanças familiares.
**Backlog:** 21 itens em 4 blocos sequenciais.
**Iniciado em:** 2026-05-15. **Encerrado em:** 2026-05-18.

---

## Dashboard final

```
Bloco A — Higiene de Produção:          5/5  ✅ #11, #12, #13, #14, #15
Bloco B — Infraestrutura para Escalar:  6/6  ✅ #16, #17, #18, #19, #20, #21
Bloco C — Pivot Família:                5/5  ✅ #22, #23, #24, #25, #26
Bloco D — Retenção e UX B2C:            5/5  ✅ #27, #28, #29, #30, #31

Total Q3 2026:                          21/21 (100%) 🎉
```

**Resultado:** Todos os 4 blocos concluídos. Entregas: higiene de produção (segredos via env vars, CORS, JWT em httpOnly cookie + CSRF, rate limiting, senha forte), infraestrutura (Postgres, Hangfire persistente, Docker, CI GitHub Actions, health checks, Serilog/Sentry), pivot Família (família/membros, despesa compartilhada, dependentes, modos de rateio, acerto de contas), UX B2C (importação OFX/CSV, PWA, onboarding, notificações in-app, dark mode).

**Nota sobre #31 (Dark mode):** A issue chegou a ser pausada formalmente na sessão 25 (2026-05-18) quando se decidiu pivotar para um redesign UX inspirado no Monarch Money. A pause foi revertida no mesmo dia — o sócio preferiu completar a entrega do dark mode antes de iniciar o redesign. O dark mode entregue foi construído sobre a base visual atual; está previsto refinar/revalidar em Q4 2026 sobre os novos design tokens.

---

## Histórico de sessões

### Sessão 26 — 2026-05-18
- **Issue #31 — Dark mode (✅ CONCLUÍDA — sócio)**
  - Pause revertida: sócio optou por terminar a entrega antes do redesign
  - Theme MUI dark + toggle persistente + respeito a `prefers-color-scheme`
  - Construído sobre a base visual atual; revalidação prevista para Q4 sobre novos tokens
- **Q3 2026 encerrado em 21/21 (100%)** 🎉
- **Decisão estratégica para Q4:** ciclo monobloco de Redesign UX, ambos os devs no front, Monarch Money como referência
- **Documentação arquivada** em `docs/history/` (PROGRESS, ISSUES, IMPLEMENTATION_STATE de Q3)

### Sessão 25 — 2026-05-18
- **Decisão estratégica (depois revertida no mesmo dia): pausar #31 e pivot UX**
  - Discussão sobre nível de polimento do frontend atual
  - Referência escolhida para o redesign: **Monarch Money** (monarch.com) — US-only, foco em casais/família alinhado com Bloco C, design system público, $850M de valor (Série B CNBC 23/05/2025)
  - Oportunidade: Brasil sem concorrente forte em couples — pesquisa em InfoMoney/Exame/Valor confirma zero cobertura de Monarch em mídia BR
  - Material público levantado: landing, blog ("Shared Views"), App Store screenshots, Figma community, API reversa em github.com/hammem/monarchmoney
  - Pause revertida na sessão 26; decisão de redesign continua, agora como Q4 2026

### Sessão 24 — 2026-05-17/18
- **Issue #28 — PWA instalável + offline básico (✅ CONCLUÍDA)** — PR #54
  - `vite-plugin-pwa`: manifest + Service Worker (Workbox, autoUpdate, precache do shell)
  - Ícone SVG do app + metatags theme-color/apple-touch-icon
  - Componente `InstallPrompt` (banner "instalar", exibe a partir da 2ª sessão)
- **Issue #30 — Notificações (✅ CONCLUÍDA — escopo in-app)** — PR #53
  - Entidade `Notificacao` + enum `TipoNotificacao` + migration
  - `NotificacaoService` + `NotificacoesController`
  - Integração: convite, despesa compartilhada e acerto geram notificação
  - Frontend: `NotificationBell` no Navbar (badge + dropdown)
  - 7 testes (suíte 123 → 130)
  - Web Push / e-mail ficam como follow-up (exigem VAPID/SMTP)
- **Issue #29 — Onboarding guiado pós-cadastro (✅ CONCLUÍDA)** — PR #52
  - `Usuario.OnboardingConcluido` + migration
  - `OnboardingService` + `OnboardingController`
  - Frontend: `OnboardingPage` em tela cheia (4 passos), rota `/onboarding`, redirect pós-registro
  - 8 testes
- **Issue #27 — Importação OFX/CSV de extrato bancário (✅ CONCLUÍDA)** — PR #51
  - `Transacao.ImportacaoFitId` + migration
  - `ExtratoImportService` — parsers OFX (SGML/XML) e CSV (BR)
  - `ImportacaoService` — preview com dedup (FITID/heurística) + sugestão de categoria
  - Endpoints `POST /importacao/preview` (multipart) e `/importacao/confirmar`
  - Frontend: página `ImportacaoPage` + rota e Sidebar
  - 14 testes
- **Issue #26 — Acerto de contas (✅ CONCLUÍDA)** — PR #50 (Bloco C completo 🎉)
- **Issue #25 — Modos de rateio (✅ CONCLUÍDA)** — PR #49 (14 testes, suíte 69 → 83)
- **Issue #24 — Dependentes (✅ CONCLUÍDA)** — PR #48 (10 testes)
- **Issue #23 — Despesa Compartilhada (✅ CONCLUÍDA)** — PR #46 (7 testes, 62 → 69)
- **Issue #22 — Família + Membros (✅ CONCLUÍDA)** — PR #42 (14 testes, 48 → 62)
- **Postgres vira default de dev** — PR #43 (paridade dev/prod)

### Bloco B — itens do sócio
- **Issue #18 — Docker + docker-compose (✅ CONCLUÍDA)** — PR #34
- **Issue #19 — GitHub Actions CI (✅ CONCLUÍDA)** — PR #38
- **Issue #21 — Testes frontend Vitest + RTL (✅ CONCLUÍDA)**

### Sessão 23 — 2026-05-16
- **Issue #16 — Migrar SQLite para Postgres (✅ CONCLUÍDA)** — PR #35
- **Issue #17 — Hangfire com PostgresStorage (✅ CONCLUÍDA)** — PR #36
- **Issue #20 — Health checks + observabilidade (✅ CONCLUÍDA)** — PR #39

### Sessão 22 — 2026-05-16
- **Issue #15 — Política de senha forte (✅ CONCLUÍDA) — Bloco A 100% 🎉**

### Sessão 21 — 2026-05-16
- **Issue #14 — Rate limiting em endpoints sensíveis (✅ CONCLUÍDA)**

### Sessões 16–20 — 2026-05-16
- **Issue #13 — JWT em httpOnly cookie + CSRF token (✅ CONCLUÍDA)** — PR #26

### Sessão 15 — 2026-05-16
- **Issue #11 — Segredos via variáveis de ambiente (✅ CONCLUÍDA)** — PR #23
- **Issue #12 — Corrigir CORS contraditório (✅ CONCLUÍDA)** — junto com #11

### Sessão 14 — 2026-05-15
- Análise crítica completa do projeto sob lente de produto B2C (`docs/ANALISE_PRODUTO.md`)
- Decisão de pivot para nicho de finanças familiares/casais
- Reorganização da documentação em `docs/features/` por feature
- Backlog Q2 arquivado em `docs/history/`
- Novo backlog Q3 criado com 21 itens em 4 blocos
- Visão da feature Família escrita (`docs/features/familia/visao.md`)

---

## Backlog Q2 2026 (concluído antes de Q3)

10 itens, todos concluídos. Detalhes em `docs/history/PROGRESS_2026Q2.md` e `docs/history/ISSUES_2026Q2.md`.
