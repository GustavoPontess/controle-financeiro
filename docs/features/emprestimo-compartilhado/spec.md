# Feature — Empréstimo compartilhado (vínculo bilateral)

> Spec curta (spec-driven, CLAUDE.md §Processo). Registrada no ROADMAP como P1 (intake, 2026-07-17).
> Status: **spec — não implementado**. Origem: caso real do Gustavo (pagou contas atrasadas de
> terceiro, parcelado, terceiro devolve em parcelas). Não depende de `Familia` existir.

## Problema

Hoje `Emprestimo` é **100% privado**: `Pessoa` é texto livre, só `CriadoPor` vê/edita/confirma
pagamento. Isso quebra no caso real — duas pessoas reais têm o mesmo empréstimo em mente, mas só
uma enxerga o registro, e essa mesma pessoa pode marcar como pago **sozinha**, sem a outra parte
confirmar nada. Num app de dinheiro isso é tanto um problema de produto (a contraparte não vê
nada) quanto de confiança (autoconfirmação de pagamento por quem tem interesse no resultado).

## Comportamento

**`Pessoa` texto livre continua existindo e é o default.** Vincular a um usuário real é
**opcional e nunca automático** — vira bilateral só depois que a contraparte aceita
explicitamente. Reaproveita o padrão de convite já usado em Família (`ConviteFamilia` /
`ConviteService`), que é **um fluxo só** — o convite é sempre por e-mail com token, tenha ou não
conta a pessoa; a única diferença é se dispara notificação in-app na hora (se já tiver conta) ou
se a pessoa só vai descobrir o convite quando entrar no app com aquele e-mail.

**Fluxo de vínculo (único, cobre os dois casos):**

1. Credor propõe (`POST /emprestimos/{id}/vincular`, body `{ email }`) — só `CriadoPor`, só
   quando `StatusVinculo` é `SemVinculo` ou `Recusado`. Gera convite: `EmailContraparte` (o
   e-mail digitado), token opaco guardado **hasheado** (`OpaqueTokenHasher` — elevando o padrão
   do `ConviteFamilia`, que hoje guarda o token em texto puro), `ConviteExpiraEm = +7 dias`
   (mesma validade do convite de família), `StatusVinculo = PendenteAceite`.
   **Resposta idêntica em qualquer caso** (e-mail existente ou não — mesmo padrão anti-enumeração
   do C1 de reset-password, `docs/SEGURANCA_BEST_PRACTICES.md`): a API nunca confirma nem nega
   existência de conta.
2. Se o e-mail já bate com um `Usuario` → notifica in-app na hora (`NotificacaoService`, mesmo
   mecanismo do convite de família). Se não bate → só o e-mail com o link; a pessoa só vai ver o
   convite quando se cadastrar e entrar logada com aquele e-mail (mesmo comportamento do
   `ListarPendentesAsync` da família — filtra convite pendente pelo e-mail da conta logada, não
   importa quando ela se cadastrou).
3. **Link do e-mail leva a uma página pública dedicada** (`/convite/emprestimo/{token}`, fora de
   `/auth`, `SiteLayout` — mesma casca das páginas institucionais `/casais`/`/contadores`), **não
   direto pro formulário de cadastro cru**. Mostra o contexto do convite (quem chamou, do que se
   trata — sem valor exato, sensível demais pra mostrar antes de logar) + uma apresentação curta
   do Pontes reaproveitando copy/componentes já prontos do site (`HomePage`/`CouplesPage`) + CTA
   "Criar conta e ver o convite". **Objetivo explícito de produto:** quem entra por aqui deve
   virar usuário ativo do app inteiro, não só logar uma vez pra confirmar um empréstimo e nunca
   mais voltar — é canal de aquisição, mesmo espírito do referral do Lote 3.4. Quem já tem conta
   cai direto no login.
4. Cadastro/login em si não muda de contrato (`/auth/register` continua igual). Logada, a pessoa
   vê o convite pendente (mesma lógica do `ListarPendentesAsync`) e confirma explicitamente via
   `POST /emprestimos/{id}/aceitar-vinculo` — token validado por hash + expiração, e-mail da conta
   logada precisa bater com `EmailContraparte` (mesmas duas checagens do `AceitarAsync` da
   família). Só aí `ContraparteUsuarioId` é setado e `StatusVinculo → Vinculado`.
5. Contraparte recusa (`POST /emprestimos/{id}/recusar-vinculo`) — mesmas checagens. →
   `StatusVinculo = Recusado`. Registro volta a ser só do criador; `Vincular` de novo a partir de
   `Recusado` reabre o fluxo (novo token).
6. **Convite expira sem resposta** — some da lista de pendentes da contraparte; não bloqueia nada
   (ela pode usar o app normalmente se já se cadastrou). Credor pode chamar `Vincular` de novo
   pra gerar convite novo (mesmo "reenviar" do `ConviteFamilia` §5.2).

**Autorização assimétrica de confirmação — a parte que mais importa.** `Tipo` já existe
(`Emprestei` / `PegueiEmprestado`) e define quem é credor daquele registro específico:

| `Tipo` | Credor (pode confirmar pagamento/quitar) | Devedor (só visualiza) |
|---|---|---|
| `Emprestei` | `CriadoPor` | `ContraparteUsuarioId` (se vinculado) |
| `PegueiEmprestado` | `ContraparteUsuarioId` (se vinculado) | `CriadoPor` |

Enquanto não `Vinculado`, só `CriadoPor` existe no registro — comportamento atual preservado, sem
mudança de authz. **Só depois de `Vinculado`** é que `RegistrarPagamento`/`Quitar` passam a
checar "sou eu o credor deste registro?" em vez de "sou eu o `CriadoPor`?" — e quando
`Tipo = PegueiEmprestado`, isso significa que o **`CriadoPor` deixa de poder confirmar sozinho**:
quem confirma é a contraparte. É fácil inverter essa regra por engano — testar os dois `Tipo`
explicitamente. Alinhado com OWASP API1:2023 (Broken Object Level Authorization, #1 risco de API
— checagem por objeto individual, não por dono genérico) e com o desenho do Pix Automático do
Bacen (cobrança nasce pendente do lado de quem recebe, só ativa quando o outro lado confirma
explicitamente).

**Ponto de vista da contraparte.** O `EmprestimoDto` retornado pra contraparte não pode ecoar
`TipoDescricao` da perspectiva do criador ("Emprestei" visto por quem pegou emprestado é
confuso). DTO ganha `souCredor: bool` calculado relativo a `usuarioId` da requisição, e o texto
descritivo se adapta ao papel de quem está olhando.

**Anti-spam/anti-assédio.** Sem limite hoje. Adicionar: **1 convite pendente por par
credor→e-mail** (se já existe `PendenteAceite` pro mesmo e-mail naquele empréstimo, `Vincular`
de novo só reenvia/regenera token, não empilha). Mais simples que o limite de 20 por família
(`ConviteFamilia`) porque aqui o escopo é 1 convite por registro, não uma lista.

## Estado (enum `StatusVinculoEmprestimo`)

| valor | quando |
|---|---|
| `SemVinculo = 0` | default; comportamento atual (100% privado) |
| `PendenteAceite = 1` | credor propôs (tenha ou não a contraparte conta ainda), aguardando aceite |
| `Vinculado = 2` | contraparte aceitou; registro bilateral |
| `Recusado = 3` | contraparte recusou; volta a ser só do criador |

## Modelo de dados

- **`Emprestimo`** ganha: `ContraparteUsuarioId` (`Guid?`, só setado no aceite — antes disso é
  `null`, mesmo padrão de `MembroFamilia.UsuarioId`), `StatusVinculo` (enum, default
  `SemVinculo`), `EmailContraparte` (`string?`), `ConviteTokenHash` (`string?`,
  `OpaqueTokenHasher`), `ConviteExpiraEm` (`DateTime?`), `VinculoRespondidoEm` (`DateTime?`),
  **`Ativo`** (`bool`, default `true` — soft-delete, ver abaixo).
- Migration: `AddVinculoEmprestimo`. Colunas nullable/default — sem backfill (empréstimos
  existentes ficam `SemVinculo`, idênticos a hoje).
- **`/auth/register` não muda de contrato.** Vínculo só acontece via `aceitar-vinculo`, depois de
  logada — nenhuma superfície nova em auth.
- **Página nova pública:** `/convite/emprestimo/{token}` — landing de conversão, `SiteLayout`,
  reaproveita componentes/copy do site institucional. Sem dado sensível (valor) antes do login.
- **Soft delete (mudança de comportamento atual):** `DeletarAsync` hoje faz hard-delete
  (`_context.Emprestimos.Remove`) — contraria a lista de entidades financeiras com soft-delete
  obrigatório do `CLAUDE.md`. Passa a soft-deletar via `Ativo=false` sempre, independente do
  vínculo. **Enquanto `Vinculado`, `DELETE` fica bloqueado (403)** — não existe "apagar sozinho"
  um registro que a outra parte já confirmou fazer parte. Quitar (zerar saldo) é a forma correta
  de encerrar um empréstimo vinculado.
- **`FinancialEventLog`** — hoje o `EmprestimoService` não grava nenhum (contraria o mandato do
  `CLAUDE.md` de auditar tudo que mexe em saldo/compromisso financeiro). Novos tipos em
  `FinancialEventType`: `EmprestimoCriado`, `EmprestimoPagamentoRegistrado`,
  `EmprestimoQuitado`, `EmprestimoVinculado`, `EmprestimoVinculoRecusado`.
- **Idempotência** — `POST /emprestimos` (criar) e `POST .../vincular` passam a aceitar header
  `Idempotency-Key`, mesmo padrão `AcertoService`/`ParcelamentoService`.

## Queries a remapear (todo `Where(e => e.CriadoPor == usuarioId)` vira OR)

`ListarAsync`, `BuscarPorIdAsync`, `ObterStatsAsync` (e qualquer query nova) passam a:

```csharp
.Where(e => e.CriadoPor == usuarioId
         || (e.ContraparteUsuarioId == usuarioId && e.StatusVinculo == StatusVinculoEmprestimo.Vinculado))
```

Mais uma query nova: **convites pendentes pra mim** — `Where(e => e.StatusVinculo ==
PendenteAceite && e.EmailContraparte == meuEmail)`, mesmo padrão do `ListarPendentesAsync` da
família.

`ObterStatsAsync` (a receber/a pagar) precisa inverter `Tipo` pra quem está vendo como
contraparte — "a receber" pra um lado é "a pagar" pro outro no mesmo registro.

## API

| método | rota | quem | efeito |
|---|---|---|---|
| `POST` | `/emprestimos/{id}/vincular` | `CriadoPor`, só `SemVinculo`/`Recusado` | gera convite (token), notifica se já tem conta |
| `GET` | `/emprestimos/convites-pendentes` | usuário logado | convites cujo e-mail bate com o meu |
| `POST` | `/emprestimos/{id}/aceitar-vinculo` | e-mail logado = `EmailContraparte`, só `PendenteAceite` | → `Vinculado` |
| `POST` | `/emprestimos/{id}/recusar-vinculo` | idem | → `Recusado` |
| `PATCH` | `/emprestimos/{id}/pagamento` | credor do registro (ver tabela acima) | registra pagamento parcial |
| `PATCH` | `/emprestimos/{id}/quitar` | credor do registro | quita |
| `DELETE` | `/emprestimos/{id}` | `CriadoPor`, **bloqueado se `Vinculado`** (403) | soft-delete |

`EmprestimoDto` ganha `statusVinculo`, `contraparteNome` (quando vinculado), `souCredor`.

## Casos extremos (registrar, não resolver tudo agora)

- **Contraparte se cadastra mas nunca aceita** — fica `PendenteAceite` indefinidamente; sem
  lembrete automático em v1 (poderia entrar num job Hangfire depois, tipo os de Fatura).
- **E-mail do convite é de terceiro errado (typo)** — quem se cadastra/loga com aquele e-mail vê
  a tela de aceite com os detalhes do empréstimo antes de confirmar qualquer coisa; recusa é
  sempre uma saída limpa. É por isso que cadastro **nunca** pula o aceite explícito.
- **Fim da relação entre as pessoas** — vínculo sobrevive (é o ponto central do design: não
  depende de `Familia`). Não há "desvincular" em v1 — se a dívida quitar ou for cancelada, o
  histórico fica pros dois.
- **Recusa** — registro não é apagado nem alterado além do `StatusVinculo`; segue 100% privado
  do criador, como antes de propor.

## Fora de escopo (v1)

- Desvincular um empréstimo já `Vinculado`.
- Lembrete automático pra convite parado em `PendenteAceite`.
- Onboarding guiado pós-cadastro além da landing de conversão (tour, checklist, etc.) — a landing
  em si entra; um funil de ativação mais elaborado fica pra quando houver dado de conversão real
  pra justificar o esforço.
- Comprovante de pagamento (foto/anexo) — mencionado na visão de Família (§7.4) mas não faz parte
  desta spec.
- Empréstimo/divisão de limite de cartão entre pessoas — item separado no ROADMAP, P3, "pra
  depois" por pedido explícito do Gustavo.

## Testes (backend)

- Vincular por `CriadoPor` ok; por não-criador → 403; e-mail existente e inexistente → mesma
  resposta (anti-enumeração), mas efeito interno correto (notifica só se achou usuário).
- Convite duplicado pro mesmo par credor→e-mail não empilha, regenera token.
- `aceitar-vinculo`/`recusar-vinculo`: só o e-mail correto, token válido e não expirado; qualquer
  outro caso → 403/404. Funciona tanto pra quem já tinha conta quanto pra quem acabou de
  registrar.
- `RegistrarPagamento`/`Quitar`: credor confirma ok; devedor tenta confirmar → 403 — testar os
  dois `Tipo` (`Emprestei` e `PegueiEmprestado`) explicitamente, é o ponto mais fácil de inverter.
- `DELETE` enquanto `Vinculado` → 403; enquanto `SemVinculo`/`Recusado` → ok (soft-delete).
- Listagem/detalhe/stats retornam o registro pros dois lados após `Vinculado`; não retornam pra
  terceiros; `stats` inverte `Tipo` corretamente pro lado da contraparte.
- `FinancialEventLog` gravado em criar/pagamento/quitar/vincular/recusar.
- Idempotência: replay do `POST /emprestimos` com mesma chave não duplica.

## Referências

- OWASP API Security Top 10 2023, [API1 — Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) — #1 risco de API (~40% dos ataques); mitigação = checagem por objeto individual.
- Banco Central, [Guia de implementação do Pix Automático](https://liftchallenge.bcb.gov.br/content/estabilidadefinanceira/pix/automatico/guia_pix_automatico.pdf) — cobrança nasce pendente, só ativa com confirmação explícita do outro lado.
- Splitwise — [merge de convite em conta existente](https://feedback.splitwise.com/knowledgebase/articles/493592-how-can-i-merge-a-group-invite-or-friend-invite-in); placeholder sem e-mail real não mescla depois (por isso e-mail é obrigatório aqui).
