# Feature — Conferência de caixa (saldo declarado × saldo calculado)

> Spec curta (spec-driven, CLAUDE.md §Processo). Registrada no ROADMAP como P1 (intake, 2026-07-20).
> Status: **spec — não implementado**. Origem: caso real do Gustavo (começou a lançar retroativo
> num app novo, sem ponto de partida claro pra saber se o saldo bateu).

## Problema

Hoje `Conta.Saldo` (`SaldoAtual` no DTO) é **soma cega**: `Receitas ativas/executadas - Despesas
ativas/executadas`, sem filtro de data (`Controllers/ContasController.cs`). O "Saldo Inicial" (
`ContaService.CriarAsync`) é só uma `Transacao` normal com `EhSaldoInicial=true`, datada no
momento da criação da conta — **não é** "saldo verdadeiro numa data de referência", é só o
pontapé inicial.

Isso quebra assim que o usuário lança retroativo (o caso real: cadastrou a conta hoje dia 20 com
o saldo real de hoje, e quer lançar despesas dos últimos 20 dias pra ter visão do mês). Toda
`Transacao` nova entra na soma total **independente da sua própria `Data`** — lançar uma despesa
"de 10 dias atrás" reduz o saldo de **hoje** do mesmo jeito que lançar ela "hoje". Não existe
reconstrução de saldo histórico por data. Sem mecanismo de conferência, o usuário só descobre que
esqueceu (ou errou) um lançamento quando o saldo do app já diverge visivelmente do extrato real —
e nesse ponto não sabe se é lançamento faltando ou bug do app.

## Comportamento

Nova ação por conta: **"Conferir saldo"**. Dois modos, escolhidos pelo usuário **a cada
conferência** (não é preferência global) — mesmo padrão observado em YNAB (reconciliação
assistida) e Monarch (edição direta de saldo em conta manual):

1. Usuário informa `SaldoDeclarado` (valor do extrato real do banco) numa `DataConferencia`
   (default hoje).
2. Sistema calcula `SaldoCalculado` = mesma fórmula do `SaldoAtual` hoje (soma de transações
   ativas/executadas da conta) e `Diferenca = SaldoDeclarado - SaldoCalculado`.
3. **`Diferenca == 0`** → "bateu", grava o checkpoint, sem criar transação nenhuma.
4. **`Diferenca != 0`** → dois caminhos:
   - **Modo certinho** (pra quem quer tudo rastreável, ex.: o próprio Gustavo) — abre o form de
     lançamento **pré-preenchido** (`Valor = abs(Diferenca)`, `Tipo = Receita` se `Diferenca > 0`
     senão `Despesa`, `ContaId` já selecionado) pra ele achar/lançar o movimento real que faltava.
     Depois de lançar, conferir de novo.
   - **Modo preguiçoso** (pra quem só quer o número bater e seguir a vida) — 1 clique "Aceitar
     ajuste" cria uma `Transacao` especial (`EhAjusteConferencia = true`) no valor exato da
     diferença, **excluída de relatórios de gasto** (mesmo padrão de `EhSaldoInicial`/
     `EhTransferencia` já usado hoje), fecha a diferença na hora sem exigir achar o lançamento
     original.
5. Resolvida (por qualquer um dos dois modos), grava `Conta.SaldoConferencia = SaldoDeclarado` e
   `Conta.DataConferencia = DataConferencia` — vira o último ponto confirmado.
6. Tela de Bancos mostra, por conta, "última conferência: dd/mm — bateu" quando houver checkpoint.
   **Informativo, não bloqueia nada** — não é um alerta constante nem impede uso normal do app.

## Modelo de dados

- **`Conta`** ganha `SaldoConferencia` (`decimal?`) e `DataConferencia` (`DateTime?`) — último
  checkpoint confirmado. Ambos `null` até a primeira conferência.
- **`Transacao`** ganha `EhAjusteConferencia` (`bool`, default `false`) — mesmo padrão de
  `EhTransferencia`/`EhSaldoInicial`: conta pro saldo, mas é excluída de relatórios de P&L.
- Migration: `AddConferenciaCaixa`. Colunas nullable — sem backfill, contas existentes ficam sem
  checkpoint até a primeira conferência.
- **`FinancialEventType`** novo bloco (Conta/conferência, próximo livre = 80):
  `ContaConferenciaRealizada = 80`, `ContaAjusteConferenciaCriado = 81`.
- **Idempotência** — `POST /contas/{id}/conferir/ajustar` aceita `Idempotency-Key`, mesmo padrão
  das outras mutações financeiras do projeto.

## API

| método | rota | efeito |
|---|---|---|
| `POST` | `/contas/{id}/conferir` | body `{ saldoDeclarado, data }` → retorna `{ diferenca, saldoCalculado }`, não persiste nada ainda |
| `POST` | `/contas/{id}/conferir/confirmar` | `Diferenca == 0` (ou depois do lançamento manual do modo certinho) → só grava o checkpoint |
| `POST` | `/contas/{id}/conferir/ajustar` | modo preguiçoso → cria a `Transacao` de ajuste + grava o checkpoint |

## Casos extremos (registrar, não resolver tudo agora)

- **Diferença de centavos** (arredondamento) — mesmo fluxo dos dois modos, sem tratamento
  especial; usuário decide se ajusta ou ignora.
- **Conta recém-criada** — primeira conferência tende a bater exato (mesma sessão do saldo
  inicial), só diverge depois que o usuário começa a lançar.
- **Retroativo lançado depois de uma conferência anterior** — o novo lançamento volta a contar na
  soma; a *próxima* conferência pega a diferença. Sistema não tenta adivinhar se um lançamento é
  "retroativo" ou "novo" — a soma sempre foi cega a isso, e continua sendo; só o checkpoint é novo.

## Fora de escopo (v1)

- **Reconstrução de saldo histórico por data** (exigiria somar transações até uma data de corte,
  arquitetura bem diferente da soma total atual). Fica registrado como pergunta em aberto — não
  ataca agora.
- Lembrete automático/periódico pra conferir (job Hangfire, tipo os de Fatura).
- Categoria de sistema dedicada "Ajuste de conferência" — v1 usa `CategoriaId = null` na
  `Transacao` de ajuste, igual ao `Saldo Inicial` já faz hoje.

## Onboarding / tutorial guiado (achado relacionado, prioridade menor)

Pedido do Gustavo na mesma sessão: um passo-a-passo tipo *product tour* (onde clicar, o que
fazer), como outros apps financeiros oferecem no primeiro uso. **Não faz parte desta spec** —
registrado como item separado no ROADMAP (P3), porque depende de decisão de biblioteca/abordagem
(ver nota lá) e o próprio Gustavo marcou como menos urgente que a conferência de caixa.

## Referências

- [A Guide to Reconciling Accounts in YNAB](https://support.ynab.com/en_us/reconciling-accounts-a-guide-BJFE3fHys) — fluxo "Looks Good"/"Let's Fix It", inspiração do modo certinho × ajuste automático.
- [Balance Adjustments in YNAB: A Guide](https://support.ynab.com/en_us/balance-adjustments-a-guide-rko4OwILs) — transação de ajuste especial, excluída do orçamento normal (mesma ideia do `EhAjusteConferencia`).
- [Manually Edit an Account Balance – Monarch Money](https://help.monarch.com/hc/en-us/articles/32368722344212-Manually-Edit-an-Account-Balance) — modelo mais simples (sobrescreve saldo direto), base do "modo preguiçoso".
