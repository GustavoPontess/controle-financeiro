# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
versionamento segue [SemVer](https://semver.org/lang/pt-BR/) **0.x (pré-lançamento)** —
`1.0.0` fica reservado para o lançamento público. Processo em [`docs/RELEASING.md`](docs/RELEASING.md).

## [Unreleased]

### Security
- **C1 — reset de senha não vaza mais o token** (account takeover): `/forgot-password` passou a responder uma mensagem genérica e idêntica para qualquer e-mail (sem enumeração de usuário). A geração do token e o envio do e-mail agora rodam fire-and-forget (Hangfire `PasswordResetEmailJob`), eliminando o oráculo de timing; o token só chega ao usuário pelo e-mail.
- **C2 — o 500 não vaza mais detalhe interno**: o `GlobalExceptionHandlerMiddleware` deixou de ecoar a mensagem da exceção no HTTP 500 (vazava EF/Npgsql/SQL) — agora retorna mensagem genérica e loga o detalhe só no servidor. Os 67 `throw new Exception(...)` dos services viraram tipos específicos, então erros de validação/não-encontrado/conflito voltam com o status correto (400/404/409) em vez de 500.
- **C3 — soft delete de transação**: excluir uma transação não a apaga mais fisicamente (preserva histórico e a referência do `FinancialEventLog`) — marca `Ativo=false`/`Cancelado`. Um filtro global passou a excluir transações canceladas de toda consulta (saldo, listagem, dashboard, relatórios, faturas); de quebra, pernas de transferências excluídas deixaram de aparecer na listagem.
- **A1/A2 — hash de senha forte (Argon2id)**: o armazenamento de senha migrou de PBKDF2 com 10.000 iterações (≈60× abaixo da recomendação OWASP) e hash de 20 bytes para **Argon2id** (1ª escolha OWASP) com saída de 32 bytes. Senhas antigas continuam funcionando e são **regravadas no esquema novo no próximo login**, sem forçar reset.
- **Reset de senha endurecido**: o token de reset agora é **guardado como hash (SHA-256)** no banco — o token em si só vai no e-mail, então um vazamento do banco não expõe tokens utilizáveis. Adicionado **limite por conta** (3 pedidos de reset por hora, além do limite por IP). A política de senha subiu para **mínimo de 15 caracteres** (teto de 128), alinhada à recomendação NIST sem MFA.
- **Headers de segurança na API**: toda resposta agora traz Content-Security-Policy (estrita para a API; relaxada só nas páginas do Swagger/Hangfire), além de X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy e HSTS (sob HTTPS). Confirmado que troca de senha exige a senha atual e que os tokens ficam em cookies HttpOnly.
- **Segredos fora do versionamento**: o `docker-compose.yml` não traz mais senha de banco nem chave JWT padrão — exige `POSTGRES_PASSWORD` e `JWT_SECRET` via `.env` (gitignored; template em `.env.example`), falhando o boot se ausentes em vez de cair num default fraco.
- **Refresh token guardado como hash**: assim como o token de reset, o refresh token agora é gravado no banco como hash (SHA-256) — o valor real só vive no cookie do navegador. Um vazamento do banco não expõe sessões reutilizáveis.

- **CSP e headers de segurança no SPA**: o nginx que serve o frontend em produção agora envia Content-Security-Policy estrita + X-Content-Type-Options, X-Frame-Options, Referrer-Policy e Permissions-Policy. O servidor de desenvolvimento (Vite) não é afetado.

### Changed
- **403 para falta de permissão (antes 401)**: erros de autorização (mexer em recurso/ação que não é seu) agora retornam HTTP 403 em vez de 401. Antes, qualquer erro de permissão deslogava o usuário; agora só falha de autenticação real (login/refresh/senha) desloga. A mensagem de "sem permissão" aparece na tela sem derrubar a sessão.

### Fixed
- Teste flaky `RecorrentesPage` no CI (`getAllByTitle` síncrono → `await findAllByTitle`).

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
