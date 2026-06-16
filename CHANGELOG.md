# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
versionamento segue [SemVer](https://semver.org/lang/pt-BR/) **0.x (pré-lançamento)** —
`1.0.0` fica reservado para o lançamento público. Processo em [`docs/RELEASING.md`](docs/RELEASING.md).

## [Unreleased]

_(mudanças desde a v0.9.0 entram aqui)_

## [0.9.0] - 2026-06-16

Primeiro snapshot versionado. O produto já tem o core completo, em fase de
hardening pré-lançamento.

### Added
- **App financeiro completo:** transações (à vista/parceladas/recorrentes), contas, cartões de crédito com faturas, transferências, empréstimos, categorias + subcategorias, metas, limites/orçamento, relatórios com gráficos, importação de extrato (OFX/CSV), dashboard, onboarding e notificações.
- **Módulo família (fosso):** famílias + membros, convites, dependentes, despesa compartilhada, rateio e acerto de contas.
- **Biblioteca de UI própria (Pontes):** 37+ componentes, CSS Modules + `var(--pontes-*)`, personalização global de paleta + fonte (persistida).
- **Privacy toggle** (ocultar saldo) global no navbar.
- **Infra:** JWT + refresh token + reset password, API versionada `/api/v1`, Hangfire (jobs), Serilog, health checks, Docker Compose, CI (build + lint + testes + E2E Playwright via docker compose).
- **Análise de concorrentes** + roadmap derivado (`docs/concorrentes/`, `ROADMAP.md`).

### Changed
- **Postgres é o único provider** (SQLite removido). Rodar a API exige Postgres no ar.
- Documentação reorganizada para modelo solo (`ROADMAP.md` + `STATE.md`).

### Fixed
- Boot do backend não trava mais em DB novo: `Npgsql.EnableLegacyTimestampBehavior` setado explícito (estava órfão); seed de bancos com timeout; jobs Hangfire agendados pós-boot.

### Security
- Auditoria do código herdado (`docs/AUDITORIA_CODIGO_HERDADO.md`) — 🔴 pendentes para fechar antes do `1.0.0`: reset token vazado na resposta (C1), contrato de exceção (C2), soft-delete de Transação (C3).

[Unreleased]: https://github.com/GustavoPontess/controle-financeiro/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/GustavoPontess/controle-financeiro/releases/tag/v0.9.0
