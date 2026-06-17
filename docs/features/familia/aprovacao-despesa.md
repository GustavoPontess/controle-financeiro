# Feature 2.4 — Aprovação de despesa compartilhada

> Spec curta (spec-driven, CLAUDE.md §Processo). Lote 2 / fosso família.
> Status: **em implementação** (backend primeiro). Origem: auditoria família 2026-06-17.

## Problema

Hoje compartilhar uma despesa é **unilateral**: o membro marca `Transacao.FamiliaId` e a
despesa já entra no balanço da família, sem o outro lado concordar. Num app de casal/família,
gasto alto que entra no rateio sem aval gera briga — o oposto da proposta do produto.

## Comportamento

**Limite por família.** `Familia.LimiteAprovacao` (decimal?, default `null`). `null` = aprovação
desligada (compartilhar continua direto). Configurável **só por admin**.

**Ao compartilhar** uma despesa (`CompartilharAsync`):
- Se a família tem `LimiteAprovacao` definido **e** `Transacao.Valor >= LimiteAprovacao` →
  `StatusAprovacao = Pendente`; notifica os outros membros pedindo aprovação.
- Senão → `StatusAprovacao = NaoRequerida` (conta normal no balanço, como hoje).

**Aprovar / rejeitar** (`POST /familias/{id}/despesas/{transacaoId}/aprovar|rejeitar`):
- Só um membro ativo **que não é o criador** da despesa pode (403 caso contrário). Uma
  aprovação basta (v1). Admin também pode.
- Aprovar → `Aprovada` + `AprovadoPorUsuarioId`/`AprovadoEm`; notifica o criador.
- Rejeitar → `Rejeitada`; notifica o criador. Continua compartilhada (transparência no feed),
  mas **não conta no balanço**. O criador pode editar/descompartilhar.

**Efeito no balanço/feed:**
- **Balanço** (`ObterBalancoAsync`): conta só despesas `NaoRequerida` **ou** `Aprovada`.
  `Pendente` e `Rejeitada` ficam **fora** do rateio.
- **Feed** (`ListarDespesasAsync`): mostra **todas** as compartilhadas com o `statusAprovacao`,
  pra todo mundo ver o que está pendente/rejeitado.

## Estado (enum `StatusAprovacaoDespesa`)

| valor | quando |
|---|---|
| `NaoRequerida = 0` | default; despesa pessoal, ou compartilhada abaixo do limite / família sem limite |
| `Pendente = 1` | compartilhada ≥ limite, aguardando aval |
| `Aprovada = 2` | um membro (≠ criador) aprovou |
| `Rejeitada = 3` | um membro (≠ criador) rejeitou |

## Modelo de dados

- **`Transacao`** (campos só relevantes quando `FamiliaId != null`):
  `StatusAprovacao` (enum, default `NaoRequerida`), `AprovadoPorUsuarioId` (Guid?),
  `AprovadoEm` (DateTime?).
- **`Familia`**: `LimiteAprovacao` (decimal?, null = off).
- Migration: `AddAprovacaoDespesa`. Colunas nullable / default 0 — sem backfill (despesas
  existentes ficam `NaoRequerida`, comportamento idêntico ao de hoje).

## API

| método | rota | quem | efeito |
|---|---|---|---|
| `PUT` | `/familias/{id}/limite-aprovacao` | admin | seta/limpa `LimiteAprovacao` |
| `POST` | `/familias/{id}/despesas/{transacaoId}/aprovar` | membro ≠ criador | `Aprovada` |
| `POST` | `/familias/{id}/despesas/{transacaoId}/rejeitar` | membro ≠ criador | `Rejeitada` |

`DespesaCompartilhadaDto` ganha `statusAprovacao` + `aprovadoPorNome`. `FamiliaDetalheDto`/
`FamiliaDto` expõem `limiteAprovacao`.

## Fora de escopo (v1)

- Aprovação multi-membro (quorum) — uma basta.
- `FinancialEventLog` — aprovação não move saldo de conta real (é flag de inclusão no balanço
  computado); fica de fora.
- Re-submeter após rejeição / histórico de aprovação — editar a despesa basta.
- 2.3 papéis com enum/enforcement é feature à parte (hoje `MembroFamilia.Papel` é string;
  "admin" é derivado de `ehAdmin`/criador).

## Testes (backend)

- Compartilhar ≥ limite → Pendente + notifica; < limite ou família sem limite → NaoRequerida.
- Aprovar por membro ≠ criador → Aprovada; por criador → 403; por não-membro → 404.
- Rejeitar → Rejeitada.
- Balanço: Pendente/Rejeitada não contam; Aprovada/NaoRequerida contam.
- Feed: lista todas com status.
- Limite: setar por admin ok; por não-admin → 403.
