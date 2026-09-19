# Experiência de login — manter conectado + roster (escolher conta)

> Pesquisa OWASP (Session Management Cheat Sheet, 2026-09-19) + Google account-chooser (ver
> `trusted-device.md`). Feature de auth/PII → regra de conformidade do `CLAUDE.md`. Empilhada no
> trusted-device (`feat/trusted-device-mfa`, #249): mesmos arquivos de login.

## As 3 peças (independentes, compõem)

1. **Confiar neste dispositivo** — pula o **código MFA** (não a senha). ✅ feito (#249).
2. **Manter-me conectado** — abrir o site e **já estar logado** (sem digitar). Este doc.
3. **Lembrar minha conta** (roster / "escolher conta") — depois de sair, a conta aparece numa lista;
   seleciona + digita a senha. Este doc.

**Princípio unificador (PC emprestado):** os três são **opt-in, desmarcados por padrão**. Não marcou
nada → ao sair, **zero rastro** (sessão morre ao fechar, conta não fica na lista, MFA toda vez). No
PC próprio, marca os três → abre e está dentro.

## Pesquisa (o que guiou)

- **OWASP Session Management:** o **default é cookie de sessão** (sem `Expires`/`Max-Age`) — morre
  ao fechar o navegador; "highly recommended to use non-persistent cookies". Timeouts idle **e**
  absoluto, server-side. Não cobre "remember-me" a fundo → decisão de produto abaixo.
- **Google account-chooser:** a conta entra ao logar e **fica mesmo depois do logout** (sticky),
  só sai em "Remover conta". Isso **trava e-mail em PC compartilhado** — pegadinha conhecida. Nós
  fazemos o oposto: **opt-in** (só entra se marcar) + e-mail **mascarado**.

## Manter-me conectado

- **Checkbox no passo 1 do login** (e-mail/senha), default **OFF**. Para MFA, o passo 1 não cria
  sessão → o flag viaja no passo 2 (verify) junto com o "confiar".
- **OFF (padrão, PC emprestado):** cookies de **sessão** (sem `Expires`) — `rt_<slot>`/`active_acct`/
  `X-CSRF-Token` morrem ao fechar o navegador. Dentro da mesma sessão o silent refresh ainda renova.
- **ON:** cookies **persistentes** (`Expires` = TTL do refresh, 7d). Reabrir → silent refresh →
  logado. Revogável (é o mesmo refresh token: logout/reset revoga).
- **Estado:** coluna `RefreshToken.LembrarSessao` (bool), setada no login/verify e **herdada na
  rotação** (refresh/switch), pra o servidor saber, a cada refresh, se re-emite cookie persistente
  ou de sessão. Sem isso, uma rotação transformaria sessão em persistente.
- **Furo corrigido (o que o Gustavo pegou):** o probe de sessão no reabrir é `GET /auth/me`, que o
  interceptor **excluía do silent refresh** (`url.includes('/auth/')`) — então, passados os 15min do
  jwt, reabrir dava 401 sem renovar e caía no login, mesmo com refresh de 7d vivo. Fix: liberar o
  silent refresh pro `/auth/me` (mantendo a exclusão só pra `login`/`refresh`/`switch`/`logout`/`mfa`,
  que são recursão ou tratados pelo caller).

## Roster ("escolher conta") — pré-login

- **Entra na lista (opt-in):** só quando o login vem com **"lembrar minha conta"** marcado. Não
  marcou → nada é gravado; ao sair, some.
- **Onde:** server-side, amarrado a um **cookie opaco de dispositivo** (`rd`, httpOnly, escopo do
  auth). Entidade `ContaLembrada { DeviceHash, UsuarioId, CriadoEm, UltimoUsoEm }`. **Não duplica
  PII:** junta em `Usuario` por `UsuarioId` na hora de exibir (nome + e-mail); some junto se a conta
  é apagada.
- **Exibição:** nome + **e-mail mascarado** (`gu•••@gmail.com`). Reduz exposição em PC dividido.
- **Selecionar nunca loga sozinho:** só pré-preenche o e-mail; sempre pede a senha (+ MFA se o
  device não for confiável). Nenhum token sobrevive ao logout.
- **Sai da lista:** (1) `DELETE /auth/roster/{usuarioId}` (por device cookie) — "remover desta
  lista"; (2) `DELETE /auth/roster` — "esquecer todas"; (3) marcar conta pra exclusão remove do
  roster; (4) expira sozinho depois de N dias sem uso (job/limpeza — P3, não bloqueia).
- **Endpoints:** `GET /auth/roster` (público, keyed pelo device cookie → lista mascarada), `DELETE`
  acima. Anti-abuso: só devolve o que estiver amarrado ao cookie daquele navegador.

## Segurança / LGPD

- Cookies de sessão por padrão (OWASP). Device cookie httpOnly opaco. E-mail mascarado no chooser.
- Nenhum token sobrevive ao logout (o refresh é revogado). Selecionar pede senha sempre.
- Tudo opt-in + revogável. Fecha o resíduo P3 do `savedAccounts` (PII no localStorage): o roster
  vira server-side; o localStorage deixa de guardar e-mail/nome.

## Escopo desta entrega

- **Feito aqui:** manter-conectado (coluna + cookies + flag no login/verify + fix do `/auth/me`) +
  roster pré-login (entidade + device cookie + endpoints + chooser no front + remover) + testes.
- **Follow-up (P3):** limpeza automática de `ContaLembrada` expirado (job); migrar o switcher
  in-app (logado) do localStorage pro roster server-side, se não sair de graça aqui.

## Fontes

OWASP Session Management Cheat Sheet (cookies persistentes vs sessão; timeouts). Google Account
Community / helloari (account-chooser sticky). Ver `trusted-device.md` p/ o resto.
