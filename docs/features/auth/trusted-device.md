# Trusted-device — "lembrar este dispositivo por X dias" (MFA)

> Pesquisa OWASP/NIST/Entra/Auth0 (2026-09-19). Feature de auth/PII → passou pela regra de
> conformidade do `CLAUDE.md` antes de subir. Gated na fundação do multi-conta (PR #246), que
> fechou o vazamento em navegador compartilhado — pré-requisito do anti-cross-account daqui.

## Objetivo

Quem tem MFA (2 etapas) hoje digita o código TOTP em **todo** login. O trusted-device adiciona um
opt-in **"confiar neste dispositivo por 30 dias"** no 2º passo: marcado, os próximos logins **neste
navegador** pulam o **2º fator** (NUNCA a senha) por 30 dias. Reduz atrito no aparelho de uso
diário sem abrir mão do MFA em dispositivos novos/desconhecidos.

## Design

**Entidade `TrustedDevice`** (`Domain/Entities/TrustedDevice.cs`): `UsuarioId` (FK Cascade),
`TokenHash` (SHA-256 hex do token opaco — banco só guarda o hash, igual RefreshToken/reset),
`ExpiraEm`, `CriadoEm`, `UltimoUsoEm`, `Revogado`, `DispositivoInfo` (UA truncado, só exibição),
`IpCriacao` (só exibição). Índices: `TokenHash` único + `(UsuarioId, Revogado)`. Migration
`AddTrustedDevice`.

**Cookie `td`**: opaco, `HttpOnly` + `Secure` + `SameSite=Strict`, `Path=/api/v1/auth` (só vai nos
endpoints de auth = menor exposição), expira em 30 dias. O token bruto vive **só** no cookie; o
servidor recomputa o hash pra achar a linha.

**Fluxo:**
1. `POST /auth/login` — o controller lê o cookie `td` e passa pro `AuthService.LoginAsync`. Se o
   usuário tem MFA **e** o device é válido **pra essa conta**, o login pula o 2º fator e já devolve
   sessão. Senão, segue pro challenge normal.
2. `POST /auth/mfa/verificar-login` com `confiarDispositivo: true` — após validar o código, cria o
   `TrustedDevice` e seta o cookie `td`.

## Segurança

- **Anti-cross-account (o ponto central).** `ObterDispositivoConfiavelAsync` exige
  `device.UsuarioId == quem está logando`. Num navegador compartilhado, device confiado pela conta
  A **nunca** pula o MFA da conta B — cada uma tem seu token, amarrado à sua conta no servidor. É a
  razão de a feature ter esperado o fix do multi-conta.
- **Fail-closed.** Token ausente/errado/revogado/expirado → cai no fluxo normal de código. Nunca
  "erra pro lado" de pular.
- **Nunca pula a senha.** Só o 2º fator do **login**. Ações sensíveis (trocar senha/e-mail,
  desativar MFA) têm re-autenticação própria e não passam por aqui.
- **Revogação em evento de segurança** (força re-MFA em todos os devices):
  - trocar senha (`ChangePasswordAsync`) e reset de senha (`ResetSenhaAsync`) → revoga todos;
  - desativar MFA (`MfaService.DesativarAsync`) → revoga todos (device sem MFA não faz sentido);
  - marcar conta pra exclusão (`AdminLgpdService`) → remove os devices junto com os refresh tokens.
- **TTL curto** (30 dias, `AuthService.TrustedDeviceDias`) — OWASP recomenda janela curta.

## LGPD / minimização

Opt-in explícito (checkbox desmarcado por padrão). Guarda o mínimo: hash do token + UA truncado +
IP, e estes dois **só** pra exibir "de onde/quando" na futura tela de dispositivos. Sem fingerprint,
sem parsing invasivo. Revogável.

## Limitação conhecida

Um cookie `td` por navegador (nome fixo). Se duas contas confiarem no mesmo navegador, só a última a
confiar mantém o skip; a outra volta a pedir o código (fail-safe — erra pra pedir MFA, nunca pra
pular). Multi-conta com trusted-device por slot (à la `rt_<slot>`) fica pra depois, se houver
demanda.

## Estado

- **Feito (parte do login):** entidade + migration + skip no login + criação no verify + cookie +
  revogação nos eventos de segurança. Testes: back (`TrustedDeviceTests` — anti-cross-account,
  expirado, revogado, skip, hash-não-bruto, revogação em troca de senha) + front (`LoginPage.test`
  — checkbox opt-in envia a flag).
- **Falta (próximo passo):** tela **Configurações → Dispositivos confiáveis** — listar (aparelho/IP/
  último uso/expira) + revogar 1 + "esquecer todos" (endpoints `GET/DELETE /auth/trusted-devices`,
  anti-IDOR por `UsuarioId`; reusa o padrão da tela de Sessões). Sem ela, a revogação manual do
  "device perdido" depende de trocar a senha (que já revoga tudo).

## Fontes

OWASP Authentication Cheat Sheet (§ "Remember me"); NIST SP 800-63B (re-auth em eventos sensíveis);
padrões Microsoft Entra / Auth0 "remember this device" (opt-in, TTL curto, revogável).
