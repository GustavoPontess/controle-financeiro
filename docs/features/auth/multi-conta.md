---
owner: Gustavo
last_reviewed: 2026-09-16
status: IMPLEMENTADO
---

# Multi-conta (várias contas logadas + troca real) — desenho + implementação

**Documento de decisão (ADR).** P1 do ROADMAP: "multi-conta não alterna de verdade (bug de auth)".
Desenho produzido por investigação + revisão adversarial de segurança (2026-09-15).

> **STATUS (2026-09-16): IMPLEMENTADO (Opção A + Opção B), branch `feat/multi-conta-fase1`.**
> - **Fase 1 (A):** `/auth/switch` server-authoritative (anti-IDOR, fail-closed), cookies por conta
>   (`rt_<slot>` opaco), `logout`/`logout-all`, guarda multi-aba (header `X-Active-Account` +
>   `ActiveAccountGuardMiddleware` → 409), silent refresh (interceptor axios), cap de 5 contas,
>   CSRF 7d + `FixedTimeEquals`.
> - **Fase 2 (B):** reuse-detection (RFC 9700 §4.14 — `FamiliaId`/`SubstituidoPorId`; replay de
>   token rotacionado revoga a família + alerta admin), tela **Sessões e dispositivos** (listar/
>   encerrar/"sair dos outros"), device/IP por sessão.
> - **Revogação INSTANTÂNEA (2026-09-16):** access token curto (**15min**, era 60) + claim `sid`
>   (FamiliaId da sessão) no JWT + `JwtBearerEvents.OnTokenValidated` que, por request, valida se a
>   sessão ainda tem refresh vivo E se o usuário está Ativo — senão 401 na hora. Fecha a janela de
>   até 1h em que uma sessão revogada seguia válida. Uma query indexada cobre: encerrar sessão,
>   sair-de-todos, reset, reuse-detection **e** bloqueio/exclusão. **Verificado ao vivo** (2 cookie
>   jars = 2 dispositivos): revoga A da B → A toma 401 imediato, B intacta. Decisão: FamiliaId-liveness
>   no lugar de TokenVersion separado (cobre per-sessão E global). Cache com invalidação = otimização
>   de escala (ROADMAP P3); no beta a query direta indexada basta.
> - **Verificado ao vivo** (Postgres real): login, adicionar conta, switch A↔B, listar/revogar sessão.
> - Testes: back 546/546, front 356/356. **Pré-condição de PROD (não codável): rotacionar `Jwt:Key`.**
> - Não implementado de propósito: cookie de grupo `sid`-de-navegador (sessões são por-usuário,
>   dispensa) e BFF (Opção D, futuro). Path-scoping do refresh ficou em Path=/api/v1/auth.

## Diagnóstico — por que hoje NÃO alterna

Verificado no código:

- **1 só jogo de cookies por origem:** `jwt` (httpOnly, Path=/, 1h), `refreshToken` (httpOnly,
  Path=/, 7d), `X-CSRF-Token` (legível por JS, 1h) — todos SameSite=Strict, Secure=IsHttps
  (`AuthController.cs:64-93`).
- Backend identifica a request **100% pelo cookie fixo `jwt`** → claim NameIdentifier
  (`Program.cs:269-274`). Não há registro de sessão/device no servidor (`RefreshToken.cs` só tem
  Id/UsuarioId/hash/ExpiresAt/Revogado/CriadoEm).
- `addAccount()` chama `/auth/login` (`AuthContext.tsx:176`) → `SetAuthCookies` **sobrescreve** o
  único jogo → a conta anterior perde a sessão no browser.
- `switchAccount()` (`AuthContext.tsx:190-209`) seta `currentUser` otimista do localStorage e chama
  `/auth/me` — que **sempre** devolve o dono do cookie `jwt` atual (o último logado).
- **Resultado:** o "switch" é mentira — a UI mostra a conta B enquanto as requests saem como A.
- `savedAccounts` no localStorage guarda **só** id/email/nome (sem token — ok pra "nada de token em JS").

Dívidas pré-existentes reveladas (não introduzidas pelo multi-conta, mas relevantes): CSRF com
comparação `Ordinal` **não** constant-time e token não assinado/ligado à sessão
(`CsrfTokenService.cs:22`); sem reuse-detection no refresh (`AuthService.cs:329-338`); axios só
redireciona no 401, **sem** refresh-and-retry (`axiosConfig.ts:65-97`).

## Opções

| Opção | Como | Segurança | Esforço |
|---|---|---|---|
| **A — N cookies httpOnly por conta (path-scoped) + endpoint de switch server-authoritative** | Cada conta guarda seu refresh em cookie próprio `rt_<slotOpaco>` (Path=/api/v1/auth). `POST /auth/switch` lê o cookie, valida dono/estado (fail-closed), rotaciona e reemite `jwt`+CSRF. accountId do body é só seletor. | Tokens 100% httpOnly; switch decidido no servidor (sem IDOR); reusa RefreshToken atual (zero migração). | Baixo-Médio |
| **B — Registro de sessão/device + grupo de navegador (ALVO)** | RefreshToken vira Sessão 1ª classe (GrupoNavegadorId/DeviceId/reuse-detection); cookie opaco `sid` do grupo; `GET /auth/sessions`, switch por sessionId, logout-all. | A mais completa: reuse-detection + "sair de todos" + revogar por device (o que o CLAUDE.md pede pro 1.0.0). Só 2-3 cookies. | Médio-Alto |
| **C — Re-login na troca** | Trocar = pedir senha (+MFA) da conta destino. Honesto: 1 sessão por vez. | Máxima "menor exposição". Mas **não é alternar** — é relogar (atrito alto). | Muito baixo |
| **D — BFF (tokens todos no servidor)** | Gateway guarda todos os tokens; browser só tem 1 cookie opaco. | Tier mais forte (IETF recomenda pra fintech). Único que resolve multi-aba de verdade. | Alto (nova camada) |

## Recomendação

**Opção A agora (fase 1), desenhada pra crescer na B (fase 2).** A entrega a troca real sem
migração, com toda credencial httpOnly e servidor como autoridade (sem IDOR). B é o alvo de segurança
completo; D o norte de longo prazo. C fica como fallback/step-up.

A revisão adversarial **aprovou A como direção** (token não vaza pra JS ✅, sem IDOR ✅, session
fixation tratada por reemissão ✅, logout de uma conta não derruba as outras ✅) — **mas listou
correções obrigatórias de execução antes de subir.**

## Correções obrigatórias (crítica de segurança) — entram na fase 1

1. **Janela CSRF (1h) vs refresh (7d):** hoje, após 1h ocioso não há cookie CSRF → `/auth/refresh` E
   `/auth/switch` (POST não-isentos) tomam 403, e o axios não faz refresh-and-retry. **Resolver sem
   downgrade** (alinhar TTL do CSRF ao refresh OU CSRF signed/session-bound reemitido no refresh);
   **NUNCA** isentar o switch de CSRF só apoiando em SameSite (viola a regra de 2 camadas).
2. **Logout × switch:** logout de conta única apaga o cookie CSRF que o switch pós-logout precisa →
   reemitir CSRF no pós-logout (ou não apagá-lo) + interceptor axios tratando 401/403 com
   refresh-and-retry.
3. **Slot opaco no nome do cookie:** `rt_<slotOpaco aleatório>`, nunca o GUID da conta (o GUID no
   nome vaza todas as contas conectadas no devtools — fere "o que não é pra pessoa ela nem vê").
4. **SwitchAsync anti-IDOR:** autoridade = posse do cookie httpOnly (hash no DB); accountId só
   seletor; fail-closed (slot ausente/revogado/expirado/Status≠Ativo → 401/404 genérico).
5. **Reemitir jwt+CSRF(+rt) em TODO evento de auth** (login, mfa, switch, refresh) — anti fixation;
   manter switch/logout/logout-all fora de IsPublicEndpoint.
6. **Guarda de multi-aba (grave pra app de dinheiro):** só há 1 `jwt` por origem — após switch A→B,
   uma aba antiga que "acha" que é A dispara requests que executam como **B** → risco de gravar
   transação/mover valor na **conta errada**. Fixar conta por aba OU bloquear/avisar aba defasada.
7. **Cap de contas conectadas por browser** (blast-radius) + política (avaliar excluir conta de alto
   valor do multi-sessão por BACEN/LGPD).
8. **Boy-scout CSRF:** `CryptographicOperations.FixedTimeEquals`; evoluir p/ signed double-submit
   (HMAC ligado ao active_acct) + prefixo `__Host-`.

## Pré-condição (fora do código do multi-conta)

- **Rotacionar a `Jwt:Key`** (possivelmente comprometida — ex-colaboradores/domínios abertos,
  `SEGURANCA_BEST_PRACTICES.md`): quem tem a chave forja `jwt` de qualquer conta. O multi-conta não
  piora, mas herda o risco → rotacionar antes/junto do shipping em prod (já está no gate 1.0.0).

## Deferido pra fase 2 (Opção B)

Registro de device/sessão, `GET /auth/sessions` (tela de sessões ativas), reuse-detection
(refresh roubado usado 2× → mata a família + alerta), "sair de todos". Reaproveita a mesma superfície
da fase 1 (endpoint de switch, rotação, cookies path-scoped).

## Plano fase 1 (Opção A) — resumo

**Backend:** refatorar `SetAuthCookies` em ativos (jwt+csrf, Path=/) + `ParkRefreshCookie`
(rt_<slot>, Path=/api/v1/auth) + `active_acct`; login/mfa parqueiam sem matar outros; `POST
/auth/switch`; `/auth/refresh` lê o slot ativo; `/auth/logout` revoga só a ativa; `POST
/auth/logout-all`; `SwitchAsync` reusando validação do refresh com guard anti-IDOR; CSRF
constant-time.
**Frontend:** `switchAccount` → `POST /auth/switch` → `refreshUser` → `accountKey++`; falha poda a
conta; `addAccount` mantém login (agora não mata outras); `logout`/`logoutAll`; guarda multi-aba;
`savedAccounts` só display.
**Testes:** só com contas de teste (nunca dado real): login A→addAccount B (A sobrevive)→switch
A↔B (request sai com a conta certa; /auth/me confere)→logout ativo (outra sobrevive)→logout-all;
bloqueio de switch sem slot (anti-IDOR); POST sem CSRF → 403.

## Questões abertas (precisam decisão / fonte primária antes de codar as partes tocadas)

- Cap de sessões por browser (quantas?) — OWASP Session Management.
- Semântica de reuse-detection (fase 2) — OWASP.
- Switch exige step-up (MFA na conta destino) ou posse do refresh basta? — CONFORMIDADE_BR / BACEN.
- `__Host-` (exige Path=/) × refresh em Path=/api/v1/auth (menor exposição) — resolver precedência.
- TTL do CSRF alinhado ao refresh × isenção apoiada em SameSite — OWASP CSRF.
