---
feature: admin
status: EM_DISCUSSAO
owner: Gustavo
created: 2026-08-26
---

# Feature — Painel Admin (beta → produção)

Spec técnica do admin do Pontes. Nasce pra viabilizar o **beta fechado** (gate de cadastro +
métricas), mas desenhado pra crescer até um admin real (gestão de usuários, LGPD, auditoria,
controles do beta). Escopo escolhido pelo Gustavo (2026-08-26): **os 4 módulos**.

> Regra do projeto: app de dinheiro + PII → pesquisar/aplicar segurança antes de subir. A parte de
> exclusão de dados foi fundamentada em `docs/CONFORMIDADE_BR.md` (LGPD Art. 15-16).

---

## 0. Princípio de segurança nº 1 — a flag de admin (INEGOCIÁVEL)

> Requisito explícito do Gustavo: **usuário comum NUNCA pode receber a flag de admin, nem no beta.**
> Nenhuma interação do usuário no sistema pode conceder permissão global.

Regras de proteção contra escalação de privilégio:

1. **`Usuario.IsAdmin` (bool, default `false`)** — flag global, **separada** do `PapelFamilia`
   (que é por-família, escopo local, e continua como está). Admin global é coisa nova e isolada.
2. **Nenhum endpoint escreve `IsAdmin`.** Não existe rota que sete/promova admin. Setar admin é
   **operação manual fora da aplicação**: migration/seed dedicado ou UPDATE direto no banco pelo
   dono da infra. (Quando existir "promover admin" pela UI — futuro, área de contabilidade/B2B —
   virá com spec própria e trava dupla; **não** entra agora.)
3. **Mass-assignment blindado.** `IsAdmin` **nunca** aparece em nenhum DTO de request (registro,
   update de perfil, etc.). Os DTOs são allowlist de campos; a entidade nunca é bindada direto do
   body. Teste de regressão: tentar mandar `isAdmin:true` no registro/update → ignorado, continua
   `false`.
4. **Autorização em profundidade.** Endpoint admin exige policy `IsAdmin` que valida a claim do
   token **E** reconfirma no banco (`Usuario.IsAdmin == true`) — não confia só no JWT (defense in
   depth, mesmo espírito da allowlist do Hangfire). Sem os dois, 403.
5. **Toda ação de admin é auditada** (`AdminAuditLog`, módulo 4) — quem fez, o quê, quando, sobre
   quem. Ação sobre dado de terceiro sempre deixa rastro.
6. **Admin não é auto-alvo perigoso.** Um admin não pode remover/rebaixar a própria flag nem apagar
   a própria conta pela UI de admin (evita lockout e pega-ratão). Mudança de admin é sempre manual.

---

## 0.1 Bootstrap do primeiro admin + resiliência de acesso (CRÍTICO)

Requisito do Gustavo: **nunca perder o acesso admin, e ter como recuperar se a conta for hackeada.**

**Como nasce o primeiro admin (bootstrap):** como nenhum endpoint seta `IsAdmin` (§0.2), o primeiro
é ligado **fora do app** — migration/seed dedicado num e-mail definido pelo Gustavo, ou UPDATE direto
no banco. É a única forma; e é justamente o que blinda contra escalação.

**Nunca perder acesso:**
- A flag mora no **banco**, não na sessão/token. Perder a senha NÃO perde o admin — o reset de senha
  por e-mail (fluxo existente) recupera o login e a conta segue admin.
- **Backstop que não pode ser tirado de você:** admin é setado na infra/banco, que é do Gustavo.
  No pior caso, sempre dá pra repor/arrumar admin via acesso ao banco — o atacante não tem esse acesso.
- **Conta break-glass de emergência** (recomendado — padrão Microsoft/NIST SP 800-53 IR-3): manter
  **2 contas admin** — a **diária** (com MFA, uso normal) + uma **break-glass** separada, **não usada
  no cotidiano**, com senha longa guardada **offline** (cofre/gerenciador), `IsAdmin` setado no banco.
  Fica "parada" → baixa superfície de ataque. Serve só pra recuperar se a diária for perdida/hackeada.
  **Testar periodicamente** (senha funciona, tem admin, MFA passa). Não é gerenciável pelos fluxos
  normais do app.

**Se a conta admin for comprometida:**
- **MFA OBRIGATÓRIO pra admin** — reusa o MFA já pronto. Conta com `IsAdmin=true` sem MFA ativo é
  bloqueada de ações sensíveis (ou o login admin exige MFA). Admin não é opt-in de MFA.
- **Toda ação de admin auditada** (`AdminAuditLog`) → dá pra ver o que o invasor fez.
- **Admin não rebaixa/apaga a si mesmo** pela UI (§0.6) → invasor não derruba o dono com 1 clique.
- **Revogar admin comprometido = UPDATE no banco** (acesso de infra do Gustavo), instantâneo.

## 1. Escopo

**É:** gate de cadastro do beta, gestão de convites/testadores, métricas, gestão de usuários,
ferramentas LGPD (exportar/apagar), visualizador de auditoria, controles do beta (flags).

**NÃO é (agora):** promover/criar admin pela UI, suporte financeiro (mexer em transação de terceiro),
billing, área de contabilidade/B2B (virá com papel próprio, spec futura).

---

## 2. Modelo de dados (novo)

- **`Usuario.IsAdmin`** (bool, default false) — ver §0.
- **`Usuario.Status`** (enum: `AguardandoAprovacao` | `Ativo` | `Recusado` | `Bloqueado` |
  `MarcadoParaExclusao`) + `AprovadoPor`/`AprovadoEm`, `BloqueadoEm`, `MarcadoExclusaoEm` (DateTime?).
  `UltimoAcessoEm` (DateTime?) pra métricas/gestão. **Cadastro novo nasce `AguardandoAprovacao`**
  (a menos que o e-mail esteja pré-aprovado → nasce `Ativo`).
- **`EmailPreAprovado`** — lista de e-mails que ganham **aprovação automática**: `Email` (único,
  lower), `AdicionadoPor` (admin), `CriadoEm`. Se um cadastro chega com e-mail dessa lista, a conta
  já nasce `Ativo` (pula a fila).
- **`AdminAuditLog`** — `AdminUsuarioId`, `Acao` (enum), `AlvoTipo`/`AlvoId`, `Detalhe` (json),
  `CriadoEm`, `CorrelationId`. Append-only.

Exclusão em 2 estágios reusa `Status=MarcadoParaExclusao` + `MarcadoExclusaoEm` (janela de carência).

> **Sem feature flags e sem limite configurado.** Descartados (2026-08-26) — complexidade sem
> necessidade. O controle do beta é a **fila de aprovação manual** (§3): o Gustavo aprova/recusa cada
> cadastro, e controla o volume aprovando. Nada de toggle nem env var de teto.

---

## 3. Módulo A — Fila de aprovação + métricas (o gate do beta)

Modelo simples (decidido pelo Gustavo, 2026-08-26): **cadastro aberto, aprovação manual.**

**Fluxo:**
1. Qualquer um preenche `/auth/register` normalmente. A conta é criada mas nasce
   **`AguardandoAprovacao`** — o usuário **não loga/usa** o sistema ainda (login barra com
   "conta aguardando aprovação").
2. Se o e-mail estiver na lista `EmailPreAprovado`, a conta já nasce **`Ativo`** (aprovação
   automática, pula a fila).
3. O admin vê a **fila de pendentes** e **aprova** (`→ Ativo`) ou **recusa** (`→ Recusado`, não loga).

**Sem limite configurado** — o Gustavo controla o volume aprovando/recusando (nada de env var de teto).

**Gestão de pré-aprovados (admin):** listar, adicionar, remover e-mails que ganham auto-aprovação.

**Métricas básicas (admin):** total de cadastrados / pendentes / ativos / recusados, cadastros por
dia, últimos acessos. Dashboard simples (sem BI).

Endpoints (sob policy IsAdmin): `GET /admin/pendentes`, `POST /admin/usuarios/{id}/aprovar|recusar`,
`GET/POST/DELETE /admin/pre-aprovados`, `GET /admin/metricas`.

---

## 4. Módulo B — Gestão de usuários

Listar testadores (nome, e-mail, status, último acesso), **bloquear/reativar** (bloqueado não
loga — checagem no login, mensagem clara), **forçar reset de senha** (dispara o fluxo de reset
existente). **Não** apaga aqui (isso é o módulo C, com carência). Admin não age sobre si mesmo (§0.6).

Endpoints: `GET /admin/usuarios`, `PATCH /admin/usuarios/{id}/bloquear|reativar`,
`POST /admin/usuarios/{id}/forcar-reset`.

---

## 5. Módulo C — Ferramentas LGPD (exportar + apagar) ⚠️ sensível

Fundamento legal em `docs/CONFORMIDADE_BR.md` ("Eliminação de dados — prazo e retenção").

- **Exportar dados de um usuário** — JSON com os dados pessoais dele (atende direito de acesso/
  portabilidade). Ação auditada.
- **Apagar em 2 ESTÁGIOS: soft delete → carência → hard delete** (padrão GDPR/SOC 2; pesquisado
  2026-08-26, ver `docs/CONFORMIDADE_BR.md`). **Só soft delete permanente NÃO é conforme** — manter o
  dado que a pessoa pediu pra apagar viola o direito ao esquecimento. Por isso o soft é só a janela,
  o hard é obrigatório no fim.
  1. **Soft delete (marcar pra exclusão)** → `Status=MarcadoParaExclusao` + `MarcadoExclusaoEm=agora`;
     derruba sessões, usuário não loga, para de aparecer. **Reversível na janela.**
  2. **Janela de carência: 30 dias** — **convenção de mercado (SOC 2/GDPR), NÃO obrigação legal.** A
     LGPD não fixa prazo pra eliminar (Art. 15-16). O que é lei é o prazo de RESPOSTA ao titular
     (LGPD Art. 19 = 15 dias, dobrado pra 30 pra pequeno porte pela Resolução ANPD 2/2022) — coisa
     diferente da carência. Escolhemos 30 dias por coincidir com esse prazo e ser a prática comum.
     Motivo da janela: (a) arrependimento do titular; (b) **conta hackeada** — o dono real recupera
     antes da purga. Fontes em `docs/CONFORMIDADE_BR.md`.
  3. **Hard delete real** após a janela → apaga o registro (cascade). Roda via job (Hangfire) que
     varre `MarcadoParaExclusao` com janela vencida — ou botão "purgar agora" (confirmação forte,
     digitar o e-mail). Auditar o pedido e a purga.
     - **⚠️ RETENÇÃO OBRIGATÓRIA (Marco Civil Art. 15):** os **registros de acesso a aplicações**
       (login → identificador + IP + timestamp) NÃO são apagados junto — a lei obriga guardá-los por
       **6 meses**, sob sigilo, mesmo após a conta ser apagada. Ficam num **store separado e seguro**
       (não no cascade da conta), com retenção rolante de 6 meses e purga automática depois. É
       conservação por obrigação legal (LGPD Art. 16, I) — compatível.
     - Outros dados retidos por obrigação legal/auditoria (ex.: `FinancialEventLog`) ficam
       **anonimizados** (perdem o vínculo com pessoa identificável, mantêm o fato).
- **Confirmação forte** em apagar/purgar (digitar e-mail do alvo, igual `PontesDialog` destrutivo).
- Admin não apaga a própria conta aqui (§0.6).

Endpoints: `GET /admin/usuarios/{id}/exportar`, `POST /admin/usuarios/{id}/marcar-exclusao`,
`POST /admin/usuarios/{id}/cancelar-exclusao`, `POST /admin/usuarios/{id}/purgar`.

Fecha 2 itens P3 catalogados (autoatendimento LGPD export/apagar).

---

## 6. Módulo D — Visualizador de auditoria

**Auditoria:** ver `FinancialEventLog` (mudanças de saldo/limite, já existe) filtrável, **e** o
`AdminAuditLog` novo (ações de admin). **Só leitura.** Rastreabilidade de app de dinheiro. Risco zero.

Endpoint: `GET /admin/auditoria`.

> Feature flags/controles do beta foram **descartados** (§2) — cadastro fechado por allowlist é o
> controle, sem toggle.

---

## 7. Frontend

Área `/admin` (rota protegida por `IsAdmin`, invisível/404 pra não-admin), toda em biblioteca
Pontes (CSS Modules + `var(--pontes-*)`), navegação por abas: Pendentes (fila de aprovação) · Pré-aprovados · Métricas ·
Usuários · LGPD · Auditoria. Ações destrutivas via `PontesDialog` com confirmação forte.

---

## 8. Decisões

**Fechadas (pesquisadas 2026-08-26):**
- ✅ **Exclusão = soft delete → carência 30 dias → hard delete** (§5). Padrão SOC 2/GDPR. A carência
  de 30 dias é **convenção, não obrigação legal** (a LGPD não fixa prazo pra excluir; ver §5 e `CONFORMIDADE_BR.md`).
- ✅ **Break-glass admin** (§0.1) — 2 contas admin (diária com MFA + emergência offline). Padrão MS/NIST.
- ✅ **MFA obrigatório pra admin** (§0.1).

**Aguardando o Gustavo (dados, não design):**
- **E-mail(s) do admin:** qual e-mail vira a conta admin diária? E um segundo pra a break-glass?
  (setados por seed/migration; nunca por endpoint).
- **Bloqueado vs Marcado-pra-exclusão:** confirmar que os dois estados separados fazem sentido
  (bloquear = suspende, reversível; exclusão = caminho pra purga com carência).

---

## 9. Ordem de implementação (backend-first, testado)

1. **Núcleo de segurança:** `Usuario.IsAdmin` + policy IsAdmin (com re-check no banco) + mass-assignment
   blindado + testes de escalação (mandar `isAdmin:true` → ignorado; não-admin em rota admin → 403).
2. **Módulo A:** `Usuario.Status` + cadastro nasce `AguardandoAprovacao` + login barra não-`Ativo` +
   `EmailPreAprovado` (auto-aprova) + fila de aprovar/recusar + métricas. **Abre o beta.**
3. **Módulo B:** gestão de usuários (bloquear/reativar/reset).
4. **Módulo C:** exportar + exclusão 2 estágios + job de purga. (o mais sensível — deixar por último,
   com mais teste.)
5. **Módulo D:** visualizador de auditoria (só leitura).
6. **Front** acompanha cada módulo.

Cada passo: migration + service + controller + teste (unitário + integração de controller, já que a
lacuna de teste de integração é P1 no ROADMAP — o admin é bom lugar pra começar a fechar isso).
