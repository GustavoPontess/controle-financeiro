---
owner: Gustavo
last_reviewed: 2026-06-16
status: ATIVO
---

# Segurança — best practices (pesquisa OWASP/NIST)

Spec de segurança nível fintech para o nosso stack (.NET 8 + EF Core + Postgres + React/JWT), levantado por deep-research com **verificação adversarial** (3 votos) contra **fontes primárias**. Cada item marca se foi **✅ verificado** (sobreviveu à verificação com fonte primária) ou **🔶 aberto** (pesquisado mas a verificação foi cortada por rate-limit do servidor — não refutado, só não confirmado; re-pesquisar antes de decidir).

> Cross-map com a auditoria do código (`AUDITORIA_CODIGO_HERDADO.md`) e plano priorizado no fim.

---

## 1. Hash de senha ✅

- **Algoritmo:** OWASP rankeia **Argon2id como 1ª escolha** (`m=19456 KiB, t=2, p=1`, ou `m=47104,t=1,p=1`), depois scrypt, bcrypt (legado), PBKDF2 (só se exigir FIPS-140). .NET: `Konscious.Security.Cryptography` (não tem Argon2 nativo no BCL).
- **Se ficar no PBKDF2:** mínimo **600.000 iterações** (HMAC-SHA256) ou 220.000 (SHA512). O valor antigo de 310k está **superado**.
- **Comparação constant-time** no verify (já usamos `FixedTimeEquals`).
- _Fonte: OWASP Password Storage Cheat Sheet._

## 2. Política de senha ✅

- **NIST SP800-63B:** mínimo **15 chars sem MFA** (8 com MFA), **máximo ≥64** (permitir passphrase), **sem regra de composição** (não exigir maiúscula/número/símbolo).
- _Fonte: OWASP Authentication Cheat Sheet + NIST SP800-63B-4._

## 3. Reset de senha ✅

- Token **aleatório-cripto** (`RandomNumberGenerator`), longo, **hasheado no banco** (SHA-256 basta p/ token de alta entropia — não precisa KDF lento), **uso único**, **expiry curto** (1h ok), **ligado a um user**, invalidado após uso.
- **Anti-enumeração:** resposta **idêntica** p/ conta existente vs inexistente **e timing uniforme** — enviar o e-mail em **fire-and-forget** (a latência do envio não pode vazar se a conta existe).
- **Rate-limit por conta** (não só por IP) + CAPTCHA/controle equivalente. .NET: `AddRateLimiter` keyed por e-mail.
- _Fonte: OWASP Forgot Password Cheat Sheet._

## 4. Armazenamento de token (frontend) ✅

- **NUNCA** access/refresh token em `localStorage`/`sessionStorage` (nem só in-memory/service-worker) — **um XSS exfiltra todos os tokens**.
- **Recomendado:** cookie **`HttpOnly; Secure; SameSite=Strict`** (preferido) **OU** padrão **BFF (Backend-for-Frontend)** — tier mais forte, mantém token fora do browser. O draft IETF OAuth-browser-based-apps **recomenda fortemente BFF** pra "apps que lidam com dados pessoais/financeiros".
- _Fonte: OWASP Session Management Cheat Sheet + Curity + IETF draft._

## 5. CSRF (quando usa cookie) ✅

- Cookie de sessão com **`SameSite=Strict`** (ou Lax); nunca `None` sem `Secure`. SameSite é **defense-in-depth, NÃO substitui token CSRF**.
- Pra app stateless/JWT: **Signed Double-Submit Cookie** (token HMAC ligado à sessão + secret server-side), **não** o double-submit ingênuo (bypassável via subdomínio/DNS takeover). Usar cookie prefixado **`__Host-`**.
- Token CSRF via **header customizado setado por JS** (cookie-to-header) — só JS same-origin lê o cookie e seta o header.
- **XSS derrota TODA mitigação de CSRF** → **CSP estrita** + auditar sinks de XSS é pré-condição.
- _Fonte: OWASP CSRF Prevention + HTML5 Security Cheat Sheets._

## 6. Hardening de API ✅

- **Validação de JWT completa** (não só decode): assinatura, **`alg≠none`**, `exp`, `issuer`, `audience` via `TokenValidationParameters` (todos default `true` no .NET 8). _Fonte: OWASP API2:2023 + RFC 8725 + MS Learn._
- **Re-autenticação em operações sensíveis** (trocar e-mail/senha/2FA) — permitir sem confirmar senha = Broken Auth (API2:2023). _Fonte: OWASP API2:2023._
- **MFA onde possível** (genérico OWASP — o *como* no .NET ficou 🔶 aberto). _Fonte: OWASP API2:2023._
- **CORS restritivo:** `WithOrigins(...)` por ambiente, **nunca `AllowAnyOrigin`** (e nunca AllowAnyOrigin+AllowCredentials). _Fonte: MS Learn ASP.NET Core CORS._
- **Security headers** (HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) — recomendado, detalhe de implementação 🔶.

---

## 🔶 Domínios ABERTOS (rate-limit cortou a verificação — re-pesquisar)

Pesquisados, **não confirmados** por fonte primária nesta rodada. Defaults abaixo = senso comum da indústria, **não verificados adversarialmente** — tratar como hipótese.

- **MFA no .NET 8 concretamente:** TOTP via ASP.NET Identity? passkeys/FIDO2 (`fido2-net-lib`) no .NET 8 vs esperar .NET 10? SMS é fraco (NIST). _Não confirmado._
- **Gestão de segredos + rotação sem downtime:** env var vs secret manager (Azure Key Vault / Vault / AWS Secrets Manager); **key rollover da JWT signing key** (múltiplas chaves de validação simultâneas) + rotação da senha do Postgres sem derrubar a API. ⚠️ **Urgente** — ex-colaboradores têm clone com a `Jwt:Key`. _Sem fonte verificada._
- **Criptografia:** TLS obrigatório; encryption-at-rest do Postgres (disco/TDE) vs criptografia de campos PII/financeiros em EF Core (`ValueConverter` / `EntityFrameworkCore.DataEncryption`); gestão/rotação dessas chaves. _Não confirmado._
- **Logging/auditoria:** trilha de eventos financeiros; **nunca logar** senha/token/PII/número de conta; mascaramento; retenção. (Já temos `FinancialEventLog`.) _Não confirmado._
- **Regulatório BR:** obrigações LGPD (base legal, direitos do titular, minimização, DPO, RIPD/DPIA Art.38). **BACEN/Open Finance** se aplica a agregador de finanças pessoais que **não movimenta dinheiro**? _Pergunta-chave SEM resposta confirmada._

---

## Cross-map com a nossa auditoria + plano

| # | Item (verificado) | Nosso estado | Prioridade |
|---|---|---|---|
| C1 | Reset token não pode vir na resposta + e-mail fire-and-forget | **Vaza na resposta** (account takeover) | 🔴 |
| — | JWT validation (assinatura/exp/iss/aud) | ✅ já fazemos (ClockSkew=0) | ok |
| — | CORS `WithOrigins` | ✅ restrito a localhost:5173 (falta allowlist prod) | 🟡 |
| — | Token em cookie HttpOnly+SameSite=Strict | ✅ já usamos cookie HttpOnly (confirmar refresh tb) | verificar |
| A1/A2 | PBKDF2 ≥600k OU Argon2id | **PBKDF2 10k + hash 20 bytes** (60× abaixo) | 🟠 |
| — | Reset token hasheado no banco | **plaintext** | 🟡 |
| — | Anti-enumeração (timing) | ramo existe≠não-existe vaza timing | 🟡 |
| — | Rate-limit reset por conta | só por IP, e reset sem limit | 🟡 |
| — | Política senha 15 chars (sem MFA) | temos 10 | 🟡 |
| — | Re-auth em trocar e-mail/senha | confirmar se exige senha | 🟡 |
| — | CSP estrita (pré-condição XSS) | confirmar | 🟡 |

### Sprint de Auth Hardening recomendado (cada um = branch → PR → CI)
1. **C1** — tira reset token da resposta + e-mail fire-and-forget (mata account takeover + timing enum)
2. **A1/A2** — PBKDF2 10k→600k agora + migração Argon2id (Konscious) com rehash no próximo login
3. **Reset token hasheado** + rate-limit por conta + política 15 chars
4. **Re-auth** em operações sensíveis + confirmar cookie do refresh + CSP
5. **⚠️ Rotacionar segredos** (JWT key + senha Postgres) — não depende de pesquisa, é procedimento

### Antes de codar os domínios abertos
Re-rodar deep-research (quando o servidor não estiver rate-limitando) para: **rotação de segredos/key rollover**, **MFA no .NET**, **cripto-at-rest/PII**, **LGPD/BACEN**.

---

## Fontes primárias
OWASP Cheat Sheets: Password Storage · Forgot Password · Authentication · Session Management · CSRF Prevention · HTML5 Security · Secrets Management · Logging. OWASP API Security Top 10 (2023) API2/API4. NIST SP800-63B. RFC 8725 (JWT BCP). Microsoft Learn (ASP.NET Core CORS / Key Vault / EF value conversions). IETF draft-ietf-oauth-browser-based-apps. ANPD (RIPD).
