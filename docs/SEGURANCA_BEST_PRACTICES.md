---
owner: Gustavo
last_reviewed: 2026-09-27
status: ATIVO
---

# Segurança — best practices (pesquisa OWASP/NIST)

Spec de segurança nível fintech para o nosso stack (.NET 10 + EF Core + Postgres + React/JWT), levantado por deep-research com **verificação adversarial** (3 votos) contra **fontes primárias**. Cada item marca se foi **✅ verificado** (sobreviveu à verificação com fonte primária) ou **🔶 aberto** (pesquisado mas a verificação foi cortada por rate-limit do servidor — não refutado, só não confirmado; re-pesquisar antes de decidir).

> Cross-map com a auditoria do código (`AUDITORIA_CODIGO_HERDADO.md`) e plano priorizado no fim.

---

## 0. Checklist obrigatório por entrega ⭐ (rodar SEMPRE, sem lembrete)

**Toda mudança passa por este checklist antes de fechar — não é opcional, não espera o Gustavo pedir.**
É o baseline de segurança + qualidade do projeto (app de dinheiro + PII). Registrado em memória do
Claude como regra permanente.

### Modelo de ameaça (assumir)
Atacante **sofisticado e automatizado**, inclusive usando IAs próprias sem as limitações de um
assistente comum, tentando SQLi, DDoS/força bruta, XSS/CSRF, IDOR, escalação de privilégio e
**information disclosure** (reconhecimento). Não confiar em obscuridade nem em "ninguém vai tentar".
Backend é a **fronteira real**; o front é defesa em profundidade.

### Princípio central — MENOR EXPOSIÇÃO DE INFORMAÇÃO
**O que não é para uma pessoa, ela não pode nem VER — mesmo que não consiga usar/acessar.** Vazar a
existência de uma rota/endpoint/campo/estrutura (ex.: rotas de admin no bundle comum) já é munição de
reconhecimento para o atacante. "Não dá pra ele acessar" **NÃO** basta.

### Checklist (marcar cada item com evidência, não com "acho que sim")
- [ ] **Input validado no BACK e no FRONT** — limite de chars, tipo, faixa, obrigatório
      (`docs/REGRAS_CAMPOS.md`). `[ApiController]` + DataAnnotations no DTO; validação por campo no form.
      Rotas com id tipado (`{id:guid}`). Nunca confiar só no cliente.
- [ ] **Isolamento de dados (IDOR)** — toda query filtra por `UsuarioId`; endpoint sensível sob
      `[Authorize]`/policy correta; nunca expor recurso de outro usuário.
- [ ] **SQL só via EF/LINQ parametrizado** — zero concatenação de string em query; sem `FromSqlRaw`
      com input do usuário.
- [ ] **DoS/força bruta** — endpoint público tem rate-limit; caps de tamanho (body, senha);
      operação cara (hash, export) protegida.
- [ ] **Segredo/erro não vaza** — resposta de erro genérica (middleware nunca ecoa `Message`);
      log não grava PII/segredo (logar id, não e-mail/senha/token); sem stack trace pro cliente.
- [ ] **Menor exposição** — nada que não seja da pessoa aparece pra ela. Se tocou admin/rota
      sensível: **conferir no `dist` que nenhuma string/endpoint/rota de admin vaza no bundle comum**
      (só no chunk lazy). Mascarar PII na tela quando fizer sentido (olhinho de revelar).
- [ ] **Conformidade (se tocou auth/PII/dado sensível)** — fonte primária (OWASP/NIST/ANPD/LGPD),
      nunca chute; catalogar achado no `ROADMAP.md`. Ver `docs/CONFORMIDADE_BR.md`.
- [ ] **DS Pontes, zero inline** — UI só de `@/components/pontes`; estilo em CSS Modules +
      `var(--pontes-*)`; componente reutilizável (2+ telas) vira componente da lib (barrel + smoke test).
- [ ] **Teste cobrindo o que mudou** — front (vitest) E back (xUnit). Sem teste = não fecha.
- [ ] **Afirmação de segurança = verificada** — não dizer "está seguro/isolado" sem rodar a checagem
      (grep no dist, revisar DTO/erro/resposta). Ver a regra "verificar antes de afirmar" (memória).

---

## 1. Hash de senha ✅ IMPLEMENTADO (A1/A2 — 2026-06-17)

- **Algoritmo:** OWASP rankeia **Argon2id como 1ª escolha** (`m=19456 KiB, t=2, p=1` = 19 MiB), depois scrypt, bcrypt (legado), PBKDF2 (só se exigir FIPS-140). **Decisão: Argon2id** (app não tem requisito FIPS) via `Konscious.Security.Cryptography.Argon2` v1.3.1 (MIT, targeta net8.0, maduro). _Deep-research verificado por fonte primária (24/25 claims confirmados)._
- **Se ficasse no PBKDF2:** mínimo **600.000 iterações** (HMAC-SHA256). O valor antigo de 310k está superado; o do app (10k) estava ~60× abaixo.
- **Parâmetros aplicados** (`PasswordHasher.cs`): Argon2id m=19456 KiB / t=2 / p=1, **salt 16 bytes** (RNG), **saída 32 bytes** (não truncar — 20 bytes derrubava a resistência a colisão p/ nível SHA-1, NIST SP 800-63B §3.1.1.2 SHOULD = tamanho nativo do algoritmo).
- **Formato versionado, auto-descritivo:** `ARGON2ID$<memKiB>$<t>$<p>$<b64salt>$<b64hash>` — permite migrar parâmetros/algoritmo no futuro (NIST: guardar referência ao esquema + custo).
- **Migração transparente:** `VerifyPassword` aceita o hash legado (PBKDF2 10k/20B, blob base64 sem `$`); `NeedsRehash` detecta hash fora do padrão atual; `LoginAsync` **regrava no esquema atual após login bem-sucedido** — upgrade gradual sem forçar reset (OWASP). `VerifyArgon2` recomputa com os parâmetros gravados no próprio hash, então subir os params no futuro não invalida hashes antigos.
- **Comparação constant-time** no verify (`FixedTimeEquals`).
- **Pepper (NIST SHOULD): ✅ implementado (2026-08-23).** Segredo server-side (`Argon2.KnownSecret`) aplicado por cima do hash, guardado **separado** do banco (env var `PASSWORD_PEPPER`, nunca no Postgres). Opcional/fail-safe: sem a env var, hash/verify seguem sem pepper (não quebra dev local). Formato do hash versionado ganhou um `pepperFlag` — hash antigo sem pepper faz rehash transparente no próximo login quando o pepper liga. `PasswordHasher.cs`, testes cobrindo liga/desliga/rehash.
- _Fontes: OWASP Password Storage Cheat Sheet; NIST SP 800-63B §3.1.1.2._

## 2. Política de senha ✅ (mín. 15 aplicado — 2026-06-17)

- **NIST SP800-63B:** mínimo **15 chars sem MFA** (8 com MFA), **máximo ≥64** (permitir passphrase), **sem regra de composição** (não exigir maiúscula/número/símbolo).
- **Aplicado:** `PasswordPolicyService` subiu de 10 → **15 chars** + teto **128** (anti-DoS no Argon2id); espelhado no front (`utils/passwordPolicy.ts`). **Regra de composição removida (2026-08-23)** — NIST SP 800-63B §5.1.1.2 SHALL NOT impor maiúscula/número/especial (aumenta previsibilidade sem entropia real). Agora só tamanho + blocklist de senha comum. **Atualizado 2026-10-15 (NIST SP 800-63B rev4 §3.1.1.2 + OWASP Authentication Cheat Sheet, conferidos na fonte):** a blocklist antiga era inalcançável (só senhas < 15). Agora: lista local de comuns de 15+, recusa de sequência/repetição/e-mail (senha INTEIRA, nunca substring) e **senha vazada via Pwned Passwords** (`PwnedPasswordsVerificador`: k-anonymity, só os 5 primeiros hex do SHA-1 saem, `Add-Padding`, timeout 3s, **fail-open** com log; desliga com `SENHA_VAZADA_CHECAGEM=off`, fora em Testing). Motivo da recusa sempre dito (NIST SHALL). Tamanho em code points depois de **NFC**; hash e verify normalizam NFC (verify tenta a forma crua se a NFC não bater — hashes antigos seguem valendo).
- _Fonte: OWASP Authentication Cheat Sheet + NIST SP800-63B-4._

## 3. Reset de senha ✅ (token hasheado + rate-limit por conta — 2026-06-17)

- Token **aleatório-cripto** (`RandomNumberGenerator`, 64 bytes), **hasheado no banco** (SHA-256 via `OpaqueTokenHasher` — basta p/ token de alta entropia, não precisa KDF lento), **uso único**, **expiry curto** (1h), **ligado a um user**, invalidado após uso. **Aplicado:** `PasswordResetEmailJob` guarda o hash, envia o bruto por e-mail; `ResetSenhaAsync` faz lookup pelo hash. Se o banco vazar, os hashes não dão tokens utilizáveis.
- **Anti-enumeração:** resposta **idêntica** p/ conta existente vs inexistente **e timing uniforme** — e-mail em **fire-and-forget** (C1, já feito).
- **Rate-limit por conta** (não só por IP): **aplicado** — `PasswordResetEmailJob` limita a 3 tokens por conta por hora (no worker, sem vazar timing), somado ao limite por-IP (1/15min) no endpoint.
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

- **Validação de JWT completa** (não só decode): assinatura, **`alg≠none`**, `exp`, `issuer`, `audience` via `TokenValidationParameters` (todos default `true` no .NET 10). _Fonte: OWASP API2:2023 + RFC 8725 + MS Learn._
- **Re-autenticação em operações sensíveis** (trocar e-mail/senha/2FA) — permitir sem confirmar senha = Broken Auth (API2:2023). _Fonte: OWASP API2:2023._
- **MFA onde possível** (genérico OWASP — o *como* no .NET ficou 🔶 aberto). _Fonte: OWASP API2:2023._
- **CORS restritivo:** `WithOrigins(...)` por ambiente, **nunca `AllowAnyOrigin`** (e nunca AllowAnyOrigin+AllowCredentials). _Fonte: MS Learn ASP.NET Core CORS._
- **Security headers** (HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) — recomendado, detalhe de implementação 🔶.

## 7. Proteção contra força bruta no login ✅ (2026-08-19)

- **Contador de falha por CONTA, não só por IP.** O rate-limit por IP (`Program.cs`, 5
  tentativas/5min em prod) sozinho é contornável trocando de IP — OWASP: *"O contador de logins
  falhos deve ser associado à própria conta, pra evitar que o atacante contorne trocando de IP."*
- **Delay progressivo:** a partir da 3ª tentativa errada, cada nova tentativa exige esperar um
  delay que **dobra** a cada erro (1s, 2s, 4s... teto de 5min) — OWASP: *"lockout exponencial...
  começa curto (ex. 1s), mas dobra a cada tentativa falha."* Aplicado mesmo se a próxima tentativa
  usar a senha certa (é delay, não é "só bloqueia erro").
- **Bloqueio permanente após 10 falhas seguidas** — só reset de senha libera (zera o contador).
  OWASP: *"amount of time to delay after each account lockout (max 2-3, after that permanent
  account lockout)"*.
- **Reset de senha também zera o contador** — outra via de recuperação legítima.
- **CAPTCHA — decisão consciente de NÃO implementar no beta.** OWASP recomenda CAPTCHA só depois
  de N tentativas suspeitas (não na 1ª tentativa), mas exige serviço externo (ex. Cloudflare
  Turnstile) e conta própria do Gustavo — adiado pro lançamento público ou se aparecer bot de
  verdade (`ROADMAP.md` → "Catalogado pro lançamento público"). A defesa mais forte segundo a
  própria OWASP é **MFA** ("preveniria 99,9% dos comprometimentos"), não CAPTCHA — MFA já está no
  domínio 🔶 aberto abaixo.
- `AuthService.LoginAsync`/`ResetSenhaAsync`, migration `AddLoginBruteForceProtection`
  (`Usuario.FalhasLoginConsecutivas`/`UltimaFalhaLoginEm`). 5 testes novos
  (`AuthServiceTests.cs`).
- _Fonte: OWASP Authentication Cheat Sheet ("Account Lockout"/"Automated Threats") + OWASP
  Credential Stuffing Prevention Cheat Sheet._

## 8. MFA (TOTP, opt-in) ✅ (2026-08-23)

- **Opt-in, NUNCA obrigatório** — decisão explícita do Gustavo. LGPD Art. 46 pede só "medidas de segurança aptas", sem nomear MFA; é boa prática OWASP oferecida como opção, não obrigação. O usuário liga/desliga em `/settings`.
- **TOTP RFC 6238** via `Otp.NET` (SHA1, 6 dígitos, passo 30s, janela ±1 pra clock drift) — compatível com qualquer app autenticador. Não usamos ASP.NET Identity (auth própria).
- **Secret criptografado em repouso:** AES-256-GCM (`MfaCrypto`), chave `MFA_ENCRYPTION_KEY` (env var, 32 bytes base64) **separada do banco** — vazamento do Postgres sozinho não expõe os secrets. Diferente de hash: o secret precisa ser recuperável pra validar o código, então é cifrado, não hasheado.
- **Ativação em 2 passos:** setup gera secret pendente (não ativa ainda) → usuário confirma com 1 código certo → só aí vira ativo + gera 10 **backup codes** (hasheados SHA-256, uso único, mostrados 1 vez).
- **Login em 2 passos:** senha certa NÃO emite sessão pra quem tem MFA — cria um `MfaLoginChallenge` (token opaco, hash no banco, TTL 5min, uso único no sucesso). Só `verificar-login` com código TOTP/backup emite JWT. Código errado não consome o challenge (permite retry no TTL); rate-limit `auth-mfa` (5/5min prod) cobre brute-force.
- **Desativar** exige senha atual + código (defense-in-depth) e apaga todos os backup codes.
- `verificar-login` é isento de CSRF (faz parte do login, ainda sem sessão/cookie CSRF — igual `/auth/login`); protegido pelo challenge de uso único + TTL + rate-limit.
- _Fontes: OWASP MFA Cheat Sheet + Credential Stuffing Prevention ("MFA is by far the best defense") + RFC 6238._

## 9. Sessão — refresh rotativo + reuse-detection ✅ (2026-09-16; janela de corrida 2026-09-27)

- **Modelo:** jwt de **15min** em cookie HttpOnly (claim `sid` = família, conferida a cada request) + refresh **opaco rotativo** de 7d (só o hash SHA-256 no banco). Cada uso rotaciona: o antigo fica revogado com `SubstituidoPorId` apontando o sucessor, na mesma `FamiliaId`. Desenho completo: `docs/features/auth/multi-conta.md`.
- **Reuse-detection (RFC 9700 §4.14.2):** refresh já rotacionado reapresentado = replay → revoga a **família inteira** + alerta admin (`NotificacaoAdmin` Segurança) + 401 genérico `UNAUTHORIZED`.
- **Desvio consciente — janela de corrida (30s, `AuthService.SegundosToleranciaReuso`):** se a reapresentação chega até 30s depois da rotação **e** do mesmo dispositivo (User-Agent + IP iguais aos gravados no sucessor), é tratada como corrida do próprio cliente (duas abas restauradas juntas): não revoga, não alerta, **não emite token novo** e responde 401 com code próprio `REFRESH_EM_CORRIDA` — o front refaz a request original 1x com os cookies da aba vencedora. Toda reapresentação (tolerada ou não) gera **Warning estruturado** no log (UsuarioId, FamiliaId, idade da rotação, `MesmoIp`/`MesmoUserAgent` — nunca o token, nunca IP/UA em claro), pra o desvio não ser silencioso. `/auth/switch` segue estrito (sem janela).
- **⚠️ Limite: "outro IP compromete mesmo dentro dos 30s" só vale com X-Forwarded-For confiável.** O IP comparado é `Connection.RemoteIpAddress`, que o `ForwardedHeadersMiddleware` sobrescreve com o X-Forwarded-For. Hoje o `Program.cs` **limpa `KnownProxies`/`KnownIPNetworks`**, então o header é aceito de **qualquer** peer; com o `ForwardLimit` default (1) vale o valor **mais à direita**. A Microsoft é explícita: *"Only allow trusted proxies and networks to forward headers. Otherwise, IP spoofing attacks are possible."* A garantia só se sustenta se **(a)** a API só for alcançável por um proxy que acrescenta/sobrescreve o X-Forwarded-For com o IP real do cliente (o valor mais à direita é o que o próprio proxy escreveu — não forjável pelo cliente) **ou (b)** `KnownProxies`/`KnownIPNetworks` estiver configurado com o IP/rede do proxy. Exposta direto ou atrás de proxy que repassa o header do cliente sem tratar, um atacante com o refresh roubado forja IP + UA da vítima e cai na janela nas duas ordens: **depois** da rotação legítima não ganha token, mas o reuso **deixa de ser detectado** (sem revogação/alerta); **antes** dela, fica com a sessão que rotacionou e a reapresentação legítima dentro dos 30s não revoga a família (a vítima vê login em vez do alarme). Mesmo com proxy confiável, sobra o risco residual de mesma rede NAT + mesmo UA. Com mais de um salto de proxy (ex.: CDN → nginx → API) e ForwardLimit 1, o IP visto é o do salto intermediário — muitos usuários com o "mesmo IP", a checagem enfraquece. **Configurar `KnownProxies`/`KnownIPNetworks` (e `ForwardLimit` conforme os saltos) antes de produção.**
- _Fontes: RFC 9700 (OAuth 2.0 Security BCP) §4.14.2; Microsoft Learn — "Configure ASP.NET Core to work with proxy servers and load balancers" (Forwarded Headers Middleware: ordem direita→esquerda, `ForwardLimit` default 1, KnownProxies/KnownNetworks); OWASP Logging Cheat Sheet (não logar token/PII)._

---

## 🔶 Domínios ABERTOS (rate-limit cortou a verificação — re-pesquisar)

Pesquisados, **não confirmados** por fonte primária nesta rodada. Defaults abaixo = senso comum da indústria, **não verificados adversarialmente** — tratar como hipótese.

- ~~**MFA no .NET 8 concretamente**~~ **✅ implementado (2026-08-23) — TOTP opt-in.** Não usamos ASP.NET Identity (auth própria), então TOTP via **Otp.NET** (RFC 6238, SHA1/6díg/30s — compatível com Google Authenticator/Authy/1Password). Opt-in, NUNCA obrigatório (decisão do Gustavo; LGPD não exige). Secret criptografado em repouso (AES-256-GCM, chave `MFA_ENCRYPTION_KEY` separada do banco); 10 backup codes hasheados (uso único); login em 2 passos (challenge de uso único + TTL 5min entre senha e código); rate-limit `auth-mfa` (5/5min prod). Ver seção "8. MFA" abaixo. Passkeys/FIDO2 seguem como evolução futura (não bloqueia nada).
- **Gestão de segredos + rotação sem downtime:** env var vs secret manager (Azure Key Vault / Vault / AWS Secrets Manager); **key rollover da JWT signing key** (múltiplas chaves de validação simultâneas) + rotação da senha do Postgres sem derrubar a API. ⚠️ **Urgente** — ex-colaboradores têm clone com a `Jwt:Key`. _Sem fonte verificada._
- **Criptografia:** TLS obrigatório; encryption-at-rest do Postgres (disco/TDE) vs criptografia de campos PII/financeiros em EF Core (`ValueConverter` / `EntityFrameworkCore.DataEncryption`); gestão/rotação dessas chaves. _Não confirmado._
- **Logging/auditoria:** trilha de eventos financeiros; **nunca logar** senha/token/PII/número de conta; mascaramento; retenção. (Já temos `FinancialEventLog`.) _Não confirmado._
- ~~**Regulatório BR:** obrigações LGPD (base legal, direitos do titular, minimização, DPO, RIPD/DPIA Art.38). **BACEN/Open Finance** se aplica a agregador de finanças pessoais que **não movimenta dinheiro**?~~ **Resolvido em 2026-08-18** — pesquisa completa fonte primária em `docs/CONFORMIDADE_BR.md`. BACEN fora do escopo; LGPD com base legal mapeada, DPO dispensado.

---

## Cross-map com a nossa auditoria + plano

| # | Item (verificado) | Nosso estado | Prioridade |
|---|---|---|---|
| C1 | Reset token não pode vir na resposta + e-mail fire-and-forget | **Vaza na resposta** (account takeover) | 🔴 |
| — | JWT validation (assinatura/exp/iss/aud) | ✅ já fazemos (ClockSkew=0) | ok |
| — | CORS `WithOrigins` | ✅ restrito ao front de dev (o vite faz proxy da API, mesma origem); produção via `CORS_ALLOWED_ORIGINS` | 🟡 |
| — | Token em cookie HttpOnly+SameSite=Strict | ✅ jwt **e** refresh em cookie HttpOnly+Secure(HTTPS)+SameSite=Strict | ✔ |
| A1/A2 | PBKDF2 ≥600k OU Argon2id | ✅ **Argon2id m=19456/t=2/p=1, salt 16B, saída 32B, rehash no login** | ✔ |
| — | Reset token hasheado no banco | ✅ **SHA-256 (OpaqueTokenHasher); bruto só no e-mail** | ✔ |
| — | Anti-enumeração (timing) | ✅ resolvido no C1 (fire-and-forget) | ✔ |
| — | Rate-limit reset por conta | ✅ **3/conta/hora no job + 1/IP/15min no endpoint** | ✔ |
| — | Política senha 15 chars (sem MFA) | ✅ **15 + teto 128** (front e back) | ✔ |
| — | Re-auth em trocar e-mail/senha | ✅ troca de senha exige senha atual; não há troca de e-mail/delete de conta | ✔ |
| — | CSP estrita + headers de segurança (API) | ✅ `SecurityHeadersMiddleware` (CSP, nosniff, X-Frame DENY, Referrer, Permissions, HSTS sob HTTPS) | ✔ |
| — | CSP + headers no SPA (prod) | ✅ `controle-financeiro.web/Caddyfile` (CSP estrita, HSTS, nosniff, X-Frame DENY, Referrer, Permissions). Prod real: ajustar `connect-src`. | ✔ |

### Sprint de Auth Hardening recomendado (cada um = branch → PR → CI)
1. ✅ **C1** — tira reset token da resposta + e-mail fire-and-forget (mata account takeover + timing enum)
2. ✅ **C2** — contrato de exceção (status corretos + 500 não vaza mensagem)
3. ✅ **C3** — soft delete de Transacao + global query filter
4. ✅ **A1/A2** — Argon2id (Konscious) com rehash transparente no login; salt 16B, saída 32B, formato versionado
5. ✅ **Reset token hasheado** + rate-limit por conta + política 15 chars
6. ✅ **Re-auth** (troca de senha já exige senha atual; sem troca de e-mail/delete) + refresh em cookie HttpOnly (confirmado) + **CSP/headers de segurança** (`SecurityHeadersMiddleware`)
7. **⚠️ Rotacionar segredos** (JWT key + senha Postgres) + **pepper** (NIST SHOULD) — não depende de pesquisa, é procedimento ← próximo

### Antes de codar os domínios abertos
Re-rodar deep-research (quando o servidor não estiver rate-limitando) para: **rotação de segredos/key rollover**, **MFA no .NET**, **cripto-at-rest/PII**, **LGPD/BACEN**.

---

## Fontes primárias
OWASP Cheat Sheets: Password Storage · Forgot Password · Authentication · Session Management · CSRF Prevention · HTML5 Security · Secrets Management · Logging. OWASP API Security Top 10 (2023) API2/API4. NIST SP800-63B. RFC 8725 (JWT BCP). Microsoft Learn (ASP.NET Core CORS / Key Vault / EF value conversions). IETF draft-ietf-oauth-browser-based-apps. ANPD (RIPD).

