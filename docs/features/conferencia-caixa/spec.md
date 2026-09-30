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

## Evolução — modelo de "marco datável" (decisão do Gustavo, 2026-09-30)

> Responde a pergunta em aberto de "Fora de escopo v1" (reconstrução de saldo histórico por data).
> Nasceu da confusão real com a hero de Transações: saldo inicial **não** é "Entrou" (correto), mas
> sem um ponto de referência datável a tela mostra "dado viajado" (ex.: Entrou R$0, Saiu R$8k, saldo
> positivo) e o usuário não sabe se falta lançamento ou é bug.

**Ideia:** o saldo inicial deixa de ser só o pontapé da criação da conta e vira um **marco** — um
"saldo real **nesta data**" que o usuário pode cravar em **qualquer data** (retroativa ou não). O
marco é o `SaldoConferencia`/`DataConferencia` da spec acima, só que tratado como **âncora temporal**:

- **Do marco pra frente** (marco → hoje) os lançamentos **têm que reconciliar**: `marco +
  Σ(entradas caixa) − Σ(saídas caixa) = saldo atual`. Se não bater, faltou/sobrou lançamento.
- **Do marco pra trás = "fds"** — o usuário não precisa lançar retroativo infinito até o 1º dia da
  conta; o marco é o piso. (Quem quiser histórico mais antigo crava um marco mais antigo.)
- **Onboarding:** conta nova → usuário registra o saldo de **hoje** como o 1º marco; tudo pra frente
  é normal. Se ele quiser ver o mês, crava um marco retroativo (ex.: 1º do mês) com o saldo daquele
  dia e lança dali pra frente.
- **Aviso de consolidação:** ao lançar algo **retroativo** (data anterior ao último marco, ou que
  quebra a janela marco→hoje), o app **avisa que os dados precisam ser consolidados** e mostra
  **como** (cravar um novo marco naquela data / conferir o saldo / lançar o que falta). Informativo,
  não bloqueia.
- **Indicador na tela** (Transações/Bancos): "confere até dd/mm" quando há marco recente; "não
  conferido — pode não bater com seu banco" quando não há.

**Impacto técnico (a decidir no início da frente):** a reconciliação marco→hoje exige **somar
transações por data de corte** (reconstrução de saldo histórico), que a spec v1 tinha adiado — é a
parte mais pesada. Decidir no MVP: (a) só o indicador + aviso (sem reconstrução real, compara saldo
total como hoje), ou (b) reconstrução por data de verdade (soma até a `DataConferencia`). Segurança:
é dado financeiro — validar dono da conta, isolamento por `UsuarioId`, idempotência nas mutações.

**Relação com o front atual:** a hero de Transações hoje já é honesta (saldo em conta = soma real
das contas; Entrou/Saiu = fluxo de caixa, crédito fora). O "fechar de verdade" (marco + reconciliação)
é esta feature. Enquanto ela não existe, a hero não mente — só não reconcilia o saldo inicial.

## Referências

- [A Guide to Reconciling Accounts in YNAB](https://support.ynab.com/en_us/reconciling-accounts-a-guide-BJFE3fHys) — fluxo "Looks Good"/"Let's Fix It", inspiração do modo certinho × ajuste automático.
- [Balance Adjustments in YNAB: A Guide](https://support.ynab.com/en_us/balance-adjustments-a-guide-rko4OwILs) — transação de ajuste especial, excluída do orçamento normal (mesma ideia do `EhAjusteConferencia`).
- [Manually Edit an Account Balance – Monarch Money](https://help.monarch.com/hc/en-us/articles/32368722344212-Manually-Edit-an-Account-Balance) — modelo mais simples (sobrescreve saldo direto), base do "modo preguiçoso".
