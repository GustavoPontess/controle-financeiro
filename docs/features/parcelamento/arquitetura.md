# 🏗️ ARQUITETURA: Sistema de Parcelamento Flexível

**Data:** 2026-05-07 (atualizado em 2026-05-08 — refatoração arquitetural pós-revisão)
**Branch:** `feature/parcelamento-flexivel`
**Status:** Design Complete (pronto pra implementar)
**Usuário Final:** Gustavo (produto futuro — app financeiro sofisticado, estilo Mobills/YNAB/Monarch)
**Escopo deste doc:** apenas **domínio e regras financeiras**. Mockups de UI/UX foram movidos para `UX_PARCELAMENTO.md`.

---

## 📌 RESUMO EXECUTIVO

Sistema de parcelamento que **reflete a realidade do mercado financeiro** (Nubank, Itaú, Bradesco, Santander). Foco em **usabilidade** e **controle total** do usuário sobre seus gastos parcelados.

### Decisão fundamental: Fatura agrega, parcela tem estado mínimo

A modelagem segue dois níveis complementares (não excludentes):

- **Fatura** é o agregador de cobrança e a fonte de verdade do estado de **ciclo, pagamento e atraso**. É o que o usuário paga.
- **ParcelaTransacao** é a unidade individual de dívida, com **estado mínimo** (`Pendente | Paga | Cancelada`) para suportar antecipação, cancelamento individual e UX estilo Nubank ("ver minhas parcelas").

A fatura nunca deriva seu estado das parcelas — ela tem estado próprio. As parcelas existem para permitir operações granulares (antecipar, cancelar uma específica) e exibição.

**Conceitos chave:**
- ✅ **Fatura é o agregador de cobrança** — paga-se fatura, não parcela
- ✅ **Parcela tem estado mínimo** (`Pendente | Paga | Cancelada`) — permite antecipação e cancelamento individual
- ✅ **Limite é GLOBAL** (não por mês)
- ✅ **Parcela entra na fatura do mês em que vence**
- ✅ **Fechamento é automático via background job** (Hangfire) — não on-demand
- ✅ **Limite bloqueado** = soma de tudo no crédito ainda não pago — parcelamento, à vista no crédito, PIX crédito, saque
- ✅ **Soft delete em todo o domínio financeiro** — auditoria, suporte e analytics dependem disso
- ✅ **FinancialEventLog** registra cada mudança de saldo/limite — audit trail simples, não event sourcing

---

## 🎯 FUNCIONALIDADES MVP

### ✅ Parcelamento com Atraso de Início (Por Mês)

```
Compra: 07/05/2026 (Notebook R$ 6.000)
Usuário escolhe:
  - Quantas parcelas? [4]
  - Primeira parcela em qual MÊS? [Julho]
  
Sistema calcula:
  - Parcela 1: 07/07/2026 - R$ 1.500 (mesmo dia, próximo mês)
  - Parcela 2: 07/08/2026 - R$ 1.500
  - Parcela 3: 07/09/2026 - R$ 1.500
  - Parcela 4: 07/10/2026 - R$ 1.500

Bloqueio de limite:
  - Limite total: R$ 5.000
  - Bloqueia R$ 6.000 imediatamente
  - Limite disponível: R$ -1.000
  
  ❌ ERRO: "Você não tem limite pra isso!
     Precisa de R$ 6.000, tem apenas R$ 5.000 disponível."
```

### ✅ Pagamento Antecipado de Parcelas

```
Parcela 2: 07/08/2026 - R$ 1.500 (PENDENTE)
Usuário clica [PAGAR AGORA]
  → Sistema marca parcela como PAGA
  → Libera R$ 1.500 do limite imediatamente
  → Próxima parcela (3) segue em 07/09 normalmente
  
FATURA AGO/2026 — após pagamento antecipado da parcela 2:
  - ValorTotal: R$ 3.500
  - ValorPago: R$ 1.500 (antecipado)
  - Restante: R$ 2.000
  - Estado: (Aberta, Parcial, false)
```

### ✅ Cancelamento (com confirmação dupla na UI)

```
Domínio: POST /api/parcelamentos/<id>/cancelar { motivo, idempotencyKey }
  → Soft delete (Ativo=false), parcelas Pendentes viram Canceladas
  → Parcelas já Pagas são preservadas (requerEstorno=true na response)

UX: ver UX_PARCELAMENTO.md > Modal Cancelar Parcelamento
```

### ✅ Dashboard de Parcelamentos Ativos

> Mockups visuais movidos para `UX_PARCELAMENTO.md`. O contrato de dados está documentado mais abaixo em "Dashboard — Contratos de API".

Resumo do que cada card de parcelamento exibe (a partir do contrato `parcelamentosAtivos`):
- Descrição, tipo, quantidade total de parcelas
- Quantas estão pagas (parcelasPagas)
- Valor original, pago, restante
- Próxima parcela: data de vencimento (que coincide com a fatura), valor, faturaId

> **Nota crítica de copy** (lembrete): a parcela vence junto com a fatura. NÃO mostrar contagem de dias por parcela individual — mostrar "Próxima parcela na fatura JUL/2026" e deixar a contagem de dias para a fatura.

### ✅ Múltiplos Parcelamentos Simultâneos

```
Limite Total: R$ 10.000

Parcelamentos Ativos:
├─ Notebook: R$ 6.000 bloqueado
├─ Monitor: R$ 2.000 bloqueado
├─ Compra à vista (não parcelada): R$ 500 bloqueado
└─ Limite Disponível: R$ 1.500

Quando pagar Notebook (parcela 1 = R$ 1.500):
├─ Limite bloqueado: R$ 8.500 - R$ 1.500 = R$ 7.000
└─ Limite disponível: R$ 10.000 - R$ 7.000 = R$ 3.000
```

### ✅ PIX Crédito (com Juros + IOF)

```
PIX Crédito: R$ 1.000 (3x com juros de 5% ao mês)

Cálculo:
├─ Valor original: R$ 1.000
├─ Juros (5% a.m.): ≈ R$ 50 (primeira parcela, decresce)
├─ IOF: ≈ R$ 15
└─ Valor total com juros: ≈ R$ 1.065

Parcelas:
├─ Parcela 1: R$ 333 + juros ≈ R$ 350
├─ Parcela 2: R$ 333 + juros ≈ R$ 340
└─ Parcela 3: R$ 334 + juros ≈ R$ 338

⚠️ LIMITE BLOQUEADO: R$ 1.065 (valor total com juros)
   (não apenas R$ 1.000)

Diferença do parcelamento normal:
- Parcelamento de compra: SEM juros
- PIX Crédito: COM juros + IOF
```

### ✅ Recorrentes com Janela de 3 Meses (Opt-In)

```
Criar Recorrente:
├─ Descrição: "Netflix"
├─ Valor: R$ 20
├─ Tipo: Despesa
├─ Frequência: Mensal
├─ Dia: 15
├─ DataInicio: 15/06/2026
└─ Destino: ContaId XOR CartaoCreditoId (validação de Service)

Resultado AO CRIAR:
├─ INSERT Recorrente (Ativo=true)
├─ Materializa 3 Transacoes Previsao:
│  ├─ JUN/2026: 15/06 → R$ 20 (Status=Previsao)
│  ├─ JUL/2026: 15/07 → R$ 20 (Status=Previsao)
│  └─ AGO/2026: 15/08 → R$ 20 (Status=Previsao)
├─ DataProximaGeracao = 15/09/2026 (limite atual da janela)
└─ INSERT FinancialEventLog: RecorrenteCriada

Resultado AO LONGO DO TEMPO (jobs Hangfire):
├─ ExpandirRecorrentesJob (diário): mantém sempre 3 meses materializados à frente
├─ ExecutarRecorrentesJob (diário): Previsao → Executado quando Data <= hoje
└─ Para projeção de saldo > 3 meses: cálculo VIRTUAL (não materializado)

Por que NÃO gerar 12 meses (ou anos infinitos):
├─ Usuário muda valor/frequência/pausa frequentemente
├─ Materializar muito vira inferno reconciliar
├─ Projeção visual no dashboard usa cálculo virtual sob demanda
└─ Equivalente ao que apps reais (Mobills, YNAB) fazem
```

---

## 📊 SCHEMA DO BANCO DE DADOS

### Tabelas Novas

#### `ParcelaTransacao`
```
Id: GUID (PK)
ParcelamentoId: GUID (FK) ← referencia o parcelamento
Numero: INT (1, 2, 3, ...)
QuantidadeTotal: INT (total de parcelas: 4)
DataVencimento: DateTime (07/07/2026)
Valor: DECIMAL (1500.00) ← valor base (sem juros)
ValorComJuros: DECIMAL (1550.00) ← null se sem juros
TaxaJuro: DECIMAL (null ou 5.00 se PIX Crédito)
IOF: DECIMAL (null ou valor IOF se PIX)
FaturaId: GUID (FK) ← fatura à qual a parcela pertence
Status: INT (enum StatusParcela: 0=Pendente, 1=Paga, 2=Cancelada)
PagoEm: DateTime (null até pagar)
CanceladoEm: DateTime (null até cancelar)
MotivoCancelamento: TEXT (null até cancelar)
CriadoEm: DateTime
UsuarioId: GUID (FK)
```

> **Estado da parcela é mínimo** (`Pendente | Paga | Cancelada`). A fatura é quem tem estado de ciclo, pagamento e atraso. A parcela existe para suportar antecipação individual e cancelamento granular sem precisar mexer na fatura inteira.

#### `Parcelamento`
```
Id: GUID (PK)
UsuarioId: GUID (FK)
Tipo: INT (0=CompraParcelada, 1=PIXCredito, 2=Recorrente)
Descricao: TEXT ("Notebook ASUS")
DataCompra: DateTime (07/05/2026)
ValorTotal: DECIMAL (6000.00)
ValorComJuros: DECIMAL (null ou total com juros)
QuantidadeParcelas: INT (4)
TaxaJuroMensal: DECIMAL (null ou 5.00)
Ativo: BOOL (true=ativo, false=cancelado) ← soft delete
CanceladoEm: DateTime (null até cancelar)
MotivoCancelamento: TEXT (null até cancelar)
CriadoEm: DateTime
Navegação: ICollection<ParcelaTransacao>
```

> **Hard delete proibido.** Cancelamento sempre via `Ativo=false` + motivo + timestamp. Histórico financeiro precisa ser preservado para auditoria, suporte e analytics.

#### `Recorrente` (alterações)
```
Id: GUID (PK)                              ← já existe
UsuarioId: GUID (FK)                       ← já existe (CriadoPor)
Descricao: TEXT ("Netflix")                ← já existe
Valor: DECIMAL (20.00)                     ← já existe
Tipo: INT (0=Despesa, 1=Receita)           ← já existe
Frequencia: INT                            ← já existe
ContaId: GUID (FK, nullable)               ← já existe (atualmente NOT NULL — relaxar)
CartaoCreditoId: GUID (FK, nullable)       ← ADICIONAR
DataInicio: DateTime                       ← já existe
DataProximaGeracao: DateTime               ← já existe
DataFim: DateTime (nullable)               ← já existe
Ativo: BOOL                                ← já existe
CanceladoEm: DateTime (nullable)           ← ADICIONAR
MotivoCancelamento: TEXT (nullable)        ← ADICIONAR
CriadoEm: DateTime                         ← ADICIONAR (auditoria)

⚠️ IMPORTANTE:
  ├─ ContaId XOR CartaoCreditoId (nunca ambos, nunca nenhum) — validação de Service
  ├─ Se CartaoCreditoId → Transacao entra em Fatura do mês
  ├─ Se ContaId → Transacao debita/credita conta diretamente
  └─ Geração de Transacoes futuras: JANELA DE 3 MESES (não 12 anos infinitos)
     └─ Job Hangfire diário expande janela conforme tempo passa
```

### Tabelas Modificadas

#### `Fatura` (Mudanças — três flags ortogonais em vez de enum gigante)
```
Existente (manter):
├─ Id, CartaoCreditoId, CriadoPor, Transacoes
├─ DataInicio: DateTime
├─ DataFechamento: DateTime
├─ DataVencimento: DateTime
└─ ValorPago: DECIMAL

REMOVER:
└─ Status: StatusFatura (enum monolítico) ← substituído por 3 flags abaixo

ADICIONAR (3 dimensões independentes):
├─ EstadoCiclo: INT (enum: 0=Aberta, 1=Fechada)
├─ EstadoPagamento: INT (enum: 0=NaoPago, 1=Parcial, 2=Pago)
├─ EstaAtrasada: BOOL (calculado/atualizado pelo job de atraso)
├─ DataFechamentoEfetiva: DateTime? (quando ciclo virou Fechada)
├─ DataPagamentoTotal: DateTime? (quando virou Pago)
├─ JurosDeMora: DECIMAL (default 0, atualizado pelo job de atraso)
└─ Multa: DECIMAL (default 0, atualizado pelo job de atraso)

⚠️ Combinações válidas (matriz 2 × 3 × bool):
  ├─ Aberta + NaoPago + nãoAtrasada     → fatura corrente, esperando gastos
  ├─ Aberta + Parcial + nãoAtrasada     → pagamento antecipado parcial
  ├─ Aberta + Pago + nãoAtrasada        → pagamento antecipado total ("PagoAntecipado")
  ├─ Fechada + NaoPago + nãoAtrasada    → fechada, dentro do prazo
  ├─ Fechada + Parcial + nãoAtrasada    → pagou parte, ainda no prazo
  ├─ Fechada + Pago + nãoAtrasada       → quitada (fluxo normal)
  ├─ Fechada + NaoPago + Atrasada       → vencida sem pagar
  └─ Fechada + Parcial + Atrasada       → pagou parte, vencida
```

> **Por que 3 flags em vez de enum?** Cada dimensão evolui independente. Queries ficam triviais (`WHERE EstaAtrasada AND EstadoPagamento != Pago`). Adicionar um novo estado nunca exige migração de enum gigante. Não há risco de combinações impossíveis virarem letra-morta no código.

#### `CartaoCredito` (Mudanças)
```
Existente (manter):
├─ Id, Nome, UltimosDigitos, Bandeira, BancoId, ContaId, CriadoPor
├─ TemCredito, TemDebito, EhPrePago
├─ DiaFechamento, DiaVencimento
└─ Ativo (já tem)

ALTERAR:
├─ Limite (decimal?) → LimiteTotal (decimal, NOT NULL para cartões com TemCredito=true)

ADICIONAR (calculados, não persistidos):
├─ LimiteBloqueado: DECIMAL  ← SUM de parcelas Pendentes + à vista não pagas
├─ LimiteDisponivel: DECIMAL  ← LimiteTotal - LimiteBloqueado
└─ Método: RecalcularLimites() — chamado após qualquer evento financeiro

⚠️ REGRA CRÍTICA — datas de fechamento/vencimento:
  ├─ DiaFechamento e DiaVencimento são FIXAS por padrão
  ├─ Podem ser alteradas SOMENTE se LimiteBloqueado == 0 (sem pendências)
  ├─ Faturas PASSADAS preservam snapshot das datas vigentes na época (auditoria)
  └─ Faturas FUTURAS usam a configuração nova (não retroativo)
```

#### `Transacao` (Mudanças)
```
Existente (manter):
├─ Id, CriadoPor (= UsuarioId), ContaId, CartaoCreditoId
├─ CategoriaId, FaturaId, Descricao, Valor, Tipo
├─ MeioPagamento, UsadoComoCredito, Data
├─ RecorrenteOrigemId (já existe)

ADICIONAR:
├─ ParcelamentoId: GUID (FK, nullable)  ← link para Parcelamento (se aplicável)
├─ ParcelaTransacaoId: GUID (FK, nullable)  ← link para a parcela específica
├─ StatusTransacao: INT (enum: 0=Previsao, 1=Executado, 2=Cancelado)
├─ EhPagamentoFatura: BOOL (default false)
├─ FaturaPagaId: GUID (FK, nullable)  ← se EhPagamentoFatura=true, qual fatura quitou
├─ Ativo: BOOL (default true)  ← soft delete
├─ CanceladoEm: DateTime (nullable)
├─ MotivoCancelamento: TEXT (nullable)
└─ CriadoEm: DateTime

REMOVER (substituídos por ParcelamentoId + ParcelaTransacaoId):
├─ Parcelas: INT
├─ NumeroParcela: INT
└─ TransacaoOrigemId: GUID
```

#### `FinancialEventLog` (NOVA — audit log simples, não event sourcing)
```
Id: GUID (PK)
UsuarioId: GUID (FK)
Tipo: INT (enum FinancialEventType — ver abaixo)
EntidadeAfetada: TEXT ("Fatura", "Parcelamento", "ParcelaTransacao", "CartaoCredito", "Conta")
EntidadeId: GUID
ValorAntes: DECIMAL? (estado antes da mudança, quando aplicável)
ValorDepois: DECIMAL? (estado depois da mudança)
PayloadJson: TEXT (snapshot adicional em JSON, para casos complexos)
CorrelationId: GUID (agrupa eventos da mesma operação — útil pra rastrear "1 pagamento gerou 4 eventos")
OrigemAcao: TEXT ("UserClick", "Job:FecharFaturas", "Job:MarcarAtrasadas", "Job:ExpandirRecorrentes", "API")
CriadoEm: DateTime (UTC)
```

**FinancialEventType (enum):**
```
ParcelamentoCriado = 1
ParcelamentoCancelado = 2
ParcelaPaga = 10
ParcelaCancelada = 11
FaturaFechada = 20
FaturaMarcadaAtrasada = 21
FaturaPagaTotal = 22
FaturaPagaParcial = 23
LimiteBloqueado = 30
LimiteLiberado = 31
RecorrenteCriada = 40
RecorrenteCancelada = 41
RecorrenteExecutada = 42
TransacaoCriada = 50
TransacaoCancelada = 51
```

> **Não é event sourcing.** É audit log append-only que vive ao lado do estado mutável. Resolve 80% das dores de auditoria, suporte e debugging com 5% do esforço de implementar event sourcing puro. Tabela cresce indefinidamente — particionar por mês quando passar de ~10M linhas.

#### `StatusTransacao` (ENUM NOVO)
```
enum StatusTransacao {
  PREVISAO = 0,      // Recorrente futura (não executada ainda)
  EXECUTADO = 1,     // Já foi cobrada/creditada
  CANCELADO = 2      // Usuário cancelou
}

⚠️ IMPORTANTE:
- Transacoes criadas por Recorrentes começam com PREVISAO
- Dashboard filtra StatusTransacao == EXECUTADO para mostrar saldo real
- StatusTransacao == PREVISAO mostra em seção "Previsão" separada
```

---

## 📦 ENUMS NOVOS E MODIFICADOS

### `EstadoCicloFatura` (Enum — substitui `StatusFatura` antigo)
```
Aberta = 0    // Aceita novas transações
Fechada = 1   // Não aceita mais transações; aguarda pagamento
```

### `EstadoPagamentoFatura` (Enum)
```
NaoPago = 0   // Nenhum pagamento registrado
Parcial = 1   // ValorPago > 0 e < ValorTotal
Pago = 2      // ValorPago >= ValorTotal
```

### `EstaAtrasada` (bool em Fatura)
```
true   // DataVencimento passou e EstadoPagamento != Pago
false  // Caso contrário
```

> **Migração de dados**: o enum atual `StatusFatura` (Aberta/Fechada/Paga) mapeia trivialmente: Aberta → (Aberta, NaoPago, false); Fechada → (Fechada, NaoPago, false); Paga → (Fechada, Pago, false). A migração EF Core precisa popular as 3 novas colunas e dropar a antiga.

### `StatusParcela` (Enum — NOVO)
```
Pendente = 0    // Aguardando vencimento ou pagamento
Paga = 1        // Paga (antecipadamente ou via fatura)
Cancelada = 2   // Cancelada (parcelamento cancelado, parcela individual cancelada, etc)
```

### `StatusTransacao` (Enum — NOVO)
```
Previsao = 0      // Transação de recorrente futura (não executada)
Executado = 1     // Já foi cobrada/creditada
Cancelado = 2     // Usuário cancelou

⚠️ IMPACTO NO SALDO E NO LIMITE:
  - Saldo Conta REAL = SUM(Transacao WHERE Status==Executado AND Ativo)
  - Saldo Conta PREVISTO = SUM(Transacao WHERE Status==Previsao AND Ativo)
  - LimiteBloqueado = SUM(ParcelaTransacao WHERE Status==Pendente AND Parcelamento.Ativo)
                    + SUM(Transacao à vista no crédito WHERE Status==Executado AND não paga em fatura)
  - Previsão NÃO bloqueia limite (apenas exibida em "exposição futura prevista")
  - Dashboard mostra real e previsto separados
```

### `TipoParcelamento` (Enum)
```
CompraParcelada = 0  // Compra normal parcelada (sem juros)
PIXCredito = 1       // PIX no crédito (com juros + IOF)
Recorrente = 2       // Vinculado a uma Recorrente
```

---

## 🔄 ESTADOS E TRANSIÇÕES

### Estados de Uma Fatura (3 dimensões independentes)

A fatura tem três flags ortogonais. Cada uma evolui independente:

```
EstadoCiclo:       Aberta ──(job FecharFaturas)──► Fechada
EstadoPagamento:   NaoPago ──(qualquer pagamento)──► Parcial ──(quitação)──► Pago
EstaAtrasada:      false ──(job MarcarAtrasadas + DataVencimento passada)──► true
                         ◄─(quitação total)──── true
```

### Combinações práticas (em vez de enum monstro)

| EstadoCiclo | EstadoPagamento | EstaAtrasada | Significado prático |
|-------------|-----------------|--------------|---------------------|
| Aberta      | NaoPago         | false        | Fatura corrente, esperando gastos |
| Aberta      | Parcial         | false        | Pagou um pouco antes de fechar |
| Aberta      | Pago            | false        | "Pago antecipado" — quitada antes do fechamento |
| Fechada     | NaoPago         | false        | Fechou, dentro do prazo |
| Fechada     | Parcial         | false        | Pagou parte, dentro do prazo |
| Fechada     | Pago            | false        | Quitada — fluxo normal |
| Fechada     | NaoPago         | true         | Atrasada sem nenhum pagamento |
| Fechada     | Parcial         | true         | Pagou parte e atrasou |

### Fluxo de pagamento antecipado (substitui antigo "PagoAntecipado" enum)

```
1. Fatura está (Aberta, NaoPago, false)
2. Usuário paga total via [PAGAR ANTECIPADO]
3. Validação: Saldo da Conta indicada >= ValorTotal?
   ├─ NÃO → erro: "Saldo insuficiente em [Conta]. Tem R$ X, precisa R$ Y"
   └─ SIM → continua
4. Sistema cria Transacao com EhPagamentoFatura=true, FaturaPagaId=<fatura.Id>
   ├─ Debita Conta (Saldo -= ValorTotal)
   └─ Marca todas as ParcelaTransacao da fatura como Status=Paga
5. Fatura passa para (Aberta, Pago, false)
   ├─ Não vira Fechada — fechamento é função do job, não do pagamento
   └─ LimiteBloqueado é recalculado (libera o que foi pago)
6. Job FecharFaturas, quando rodar na DataFechamento, transiciona para (Fechada, Pago, false)
7. FinancialEventLog registra: FaturaPagaTotal, ParcelaPaga (×N), LimiteLiberado
```

### Parcela tem estado mínimo — NÃO deriva da fatura

```
ParcelaTransacao.Status:
  ├─ Pendente  ← criada com este estado
  ├─ Paga      ← marcada quando: pagamento antecipado individual OU pagamento da fatura inteira
  └─ Cancelada ← marcada quando: parcelamento todo cancelado OU parcela individual cancelada

A fatura agrega — mas a parcela tem identidade própria.

Exemplo: Fatura JUL (Fechada, Parcial, true) contém:
  ├─ Parcela 1 Notebook  → Status=Paga       (usuário pagou antecipado em JUN)
  ├─ Parcela 1 Monitor   → Status=Pendente   (faz parte do que ainda falta pagar)
  └─ Netflix R$ 20       → Transacao normal (não é parcela)

A fatura está atrasada porque DataVencimento passou e EstadoPagamento != Pago.
Mas internamente, parcelas individuais podem estar em estados diferentes.
```

### Por que parcela TEM estado (revertido da decisão original)

A decisão original era "parcela não tem estado". Isso entrou em conflito com:
- Antecipação individual ("paguei só a parcela 2 do notebook")
- Cancelamento individual ("essa parcela específica eu já paguei por fora")
- UX estilo Nubank que mostra cada parcela com seu estado

A nova decisão: **parcela tem estado mínimo**, fatura agrega para cobrança. Os dois conceitos coexistem sem se contradizer.

---

## 💰 CÁLCULO DE LIMITE DE CRÉDITO

### Fórmula

```
Limite Disponível = Limite Total - Limite Bloqueado

Limite Bloqueado = SUM(Tudo que você ainda não pagou)
  ├─ Parcelamentos em andamento
  ├─ Compras à vista pendentes
  ├─ PIX Crédito (com juros)
  └─ Recorrentes já cobradas mas não pagas
```

### Exemplo Passo a Passo

```
ESTADO INICIAL:
├─ Limite Total: R$ 5.000
├─ Limite Bloqueado: R$ 0
└─ Limite Disponível: R$ 5.000

1. CRIA PARCELAMENTO (Notebook 4x 1500):
   ├─ Valor: R$ 6.000
   ├─ Limite Bloqueado: R$ 0 + R$ 6.000 = R$ 6.000
   └─ RESULTADO: ❌ ERRO (limite insuficiente)
   
   "Você precisa de R$ 6.000, tem apenas R$ 5.000"
   ❌ BLOQUEADO - Parcelamento não criado

2. CRIA PARCELAMENTO (Monitor 2x 1000):
   ├─ Valor: R$ 2.000
   ├─ Limite Bloqueado: R$ 0 + R$ 2.000 = R$ 2.000
   ├─ Limite Disponível: R$ 5.000 - R$ 2.000 = R$ 3.000
   └─ ✅ SUCESSO

3. CRIA PIX CRÉDITO (1000, 3x, juros 5%):
   ├─ Valor total com juros: ≈ R$ 1.065
   ├─ Limite Bloqueado: R$ 2.000 + R$ 1.065 = R$ 3.065
   ├─ Limite Disponível: R$ 5.000 - R$ 3.065 = R$ 1.935
   └─ ✅ SUCESSO

4. PAGA PARCELA 1 DO MONITOR (R$ 1.000):
   ├─ Limite Bloqueado: R$ 3.065 - R$ 1.000 = R$ 2.065
   └─ Limite Disponível: R$ 5.000 - R$ 2.065 = R$ 2.935

5. PAGA FATURA INTEIRA (todas as parcelas de JUL):
   ├─ Supondo que pague R$ 3.000
   ├─ Limite Bloqueado: R$ 2.065 - R$ 3.000 = ❌ Erro
   
   (Precisa pagar só o que está na fatura de JUL)
```

### Validação ao Criar Parcelamento

```
Usuário quer parcelar R$ 6.000
Limite Disponível: R$ 2.000

✅ VALIDAÇÕES:
  ├─ Valor > 0? SIM
  ├─ Limite Disponível >= Valor? NÃO
  ├─ Data não é futura? SIM
  └─ Primeira parcela é válida? SIM

❌ RESULTADO:
  Bloqueia a ação e avisa:
  "Você não tem limite pra isso!
   Precisa de R$ 6.000, tem apenas R$ 2.000 disponível."
```

---

## 🔀 FLUXOS PRINCIPAIS

### Fluxo 1: Criar Parcelamento

```
1. Usuário envia ao backend:
   {
     descricao: "Notebook",
     valor: 6000,
     tipo: Despesa,
     cartaoCreditoId: <nubank>,
     dataCompra: 2026-05-07,
     parcelas: 4,
     primeiraParcelaMes: "2026-07"
   }

2. Sistema valida (em ParcelamentoService):
   ├─ Valor > 0
   ├─ LimiteDisponível >= Valor (recalcula on-the-fly, não confia em coluna stale)
   ├─ DataCompra não é futura
   ├─ primeiraParcelaMes >= mês atual
   ├─ 2 <= parcelas <= 36
   └─ Em caso de falha → 422 com mensagem específica

3. Em transação SQL única (ACID):
   ├─ INSERT Parcelamento
   ├─ INSERT 4× ParcelaTransacao (Status=Pendente, FaturaId=<resolvido por mês>)
   ├─ ObterOuCriarFatura para cada mês (07/2026..10/2026)
   ├─ INSERT FinancialEventLog: ParcelamentoCriado (CorrelationId=<novo>)
   ├─ INSERT FinancialEventLog: LimiteBloqueado (delta=+6000, mesmo CorrelationId)
   └─ COMMIT

4. RecalcularLimites do cartão:
   └─ LimiteBloqueado e LimiteDisponivel são derivados, não persistidos

5. Retorna ParcelamentoDto + novo limite disponível
```

### Fluxo 2: Pagar Parcela Antecipado

```
1. Usuário envia POST /api/parcelas/<id>/pagar
   {
     contaPagamentoId: <conta-id>,
     idempotencyKey: <uuid-cliente>  ← obrigatório
   }

2. Validações:
   ├─ ParcelaTransacao existe, Status==Pendente, Parcelamento.Ativo==true
   ├─ Conta.Saldo >= Parcela.Valor
   ├─ Fatura associada está em (Aberta, *, *) OU (Fechada, NaoPago/Parcial, *)
   └─ Idempotência: se já há FinancialEventLog com este idempotencyKey, retorna 200 com resultado anterior

3. Em transação SQL única:
   ├─ UPDATE ParcelaTransacao SET Status=Paga, PagoEm=NOW
   ├─ INSERT Transacao (EhPagamentoFatura=true, FaturaPagaId=<fatura>, Valor=parcela.Valor, ContaId=<conta>)
   ├─ Conta.Saldo é recalculado naturalmente (Receitas - Despesas, sem coluna)
   ├─ UPDATE Fatura.ValorPago += parcela.Valor
   ├─ Recalcula EstadoPagamento da fatura (NaoPago/Parcial/Pago)
   ├─ INSERT FinancialEventLog: ParcelaPaga + LimiteLiberado (CorrelationId compartilhado)
   └─ COMMIT

4. Retorna:
   ├─ Parcela atualizada
   ├─ Fatura atualizada (com novo EstadoPagamento)
   └─ Novo LimiteDisponivel do cartão
```

### Fluxo 3: Cancelar Parcelamento (soft delete)

> **Nunca há hard delete em domínio financeiro.** Cancelar marca como inativo, preserva todo o histórico.

```
1. Usuário envia POST /api/parcelamentos/<id>/cancelar
   {
     motivo: "Devolvi o produto",
     idempotencyKey: <uuid-cliente>
   }

2. Validações:
   ├─ Parcelamento.Ativo == true
   ├─ Pertence ao usuário
   └─ motivo é obrigatório (não vazio)

3. Avaliação de parcelas já pagas:
   ├─ Conta quantas ParcelaTransacao têm Status=Paga
   └─ Se houver pagas → response inclui flag "requerEstorno=true"
      e a UI deve oferecer criar Transacao de estorno (não automático)

4. Em transação SQL única:
   ├─ UPDATE Parcelamento SET Ativo=false, CanceladoEm=NOW, MotivoCancelamento=<motivo>
   ├─ UPDATE ParcelaTransacao SET Status=Cancelada, CanceladoEm=NOW
   │   WHERE ParcelamentoId=<id> AND Status=Pendente
   │   (parcelas já pagas NÃO viram canceladas — preservam Status=Paga)
   ├─ Remove vinculação de parcelas Pendentes das Faturas futuras
   │   (Fatura.ValorTotal recalcula naturalmente sem essas parcelas)
   ├─ INSERT FinancialEventLog: ParcelamentoCancelado + ParcelaCancelada (×N) + LimiteLiberado
   └─ COMMIT

5. Retorna:
   ├─ Parcelamento cancelado (mas visível no histórico)
   ├─ Quantas parcelas foram canceladas vs já estavam pagas
   ├─ Flag requerEstorno (UI usa para sugerir criação de transação de estorno)
   └─ Novo LimiteDisponivel
```

### Fluxo 4: Job Hangfire — Fechar Faturas

```
Execução: Hangfire RecurringJob, agendado todo dia às 02:00 (horário do servidor)
Idempotente: pode rodar várias vezes por dia sem efeito colateral.

⚠️ REGRAS CRÍTICAS:
  ├─ DiaFechamento e DiaVencimento do CartaoCredito são FIXOS (snapshot por fatura)
  ├─ Podem ser alterados SOMENTE se LimiteBloqueado == 0
  ├─ Faturas passadas preservam o snapshot vigente quando foram criadas
  └─ Mudança vale apenas para faturas FUTURAS

Pseudocódigo (FaturaFechamentoJob):
1. SELECT Fatura WHERE EstadoCiclo=Aberta AND DataFechamento <= TODAY
2. Para cada fatura:
   ├─ UPDATE EstadoCiclo=Fechada, DataFechamentoEfetiva=NOW
   ├─ INSERT FinancialEventLog: FaturaFechada (Origem="Job:FecharFaturas")
   └─ Dispara notificação (fora desta transação)
3. COMMIT por fatura (não em batch — cada fatura é unidade independente)

Tolerância a falhas: se job não rodar por X dias (servidor down), no próximo run
ele pega TODAS as faturas elegíveis (não só as do dia). Resultado é o mesmo.
```

### Fluxo 5: Job Hangfire — Marcar Atrasadas + Calcular Juros

```
Execução: Hangfire RecurringJob, agendado todo dia às 02:30
Idempotente: recalcula juros sempre, atualiza valores se mudaram.

Pseudocódigo (FaturaAtrasoJob):
1. SELECT Fatura WHERE EstadoCiclo=Fechada
                  AND EstadoPagamento != Pago
                  AND DataVencimento < TODAY
2. Para cada fatura:
   ├─ valorRestante = Fatura.ValorTotal - Fatura.ValorPago
   ├─ diasAtrasados = (TODAY - DataVencimento).Days
   ├─ jurosDeMora = (valorRestante × 0.01) / 30 × diasAtrasados
   ├─ multa = (Fatura.Multa == 0) ? valorRestante × 0.02 : Fatura.Multa  ← multa só lança 1×
   ├─ UPDATE Fatura.EstaAtrasada=true, JurosDeMora=jurosDeMora, Multa=multa
   ├─ Se passou de 0 → INSERT FinancialEventLog: FaturaMarcadaAtrasada
   └─ Dispara notificação (1× por fatura — flag em payload do log)

Reversão: quando usuário pagar fatura atrasada totalmente, próxima execução do
job vê EstadoPagamento=Pago e zera EstaAtrasada na transação de pagamento.

⚠️ MVP: percentuais (1% a.m. juros, 2% multa) são placeholders. Documentar
explicitamente que NÃO refletem cálculo bancário real (CET, IOF diário, etc).
Quando integrar com Open Finance no futuro, banco fornece valores exatos.
```

### Fluxo 6: Recorrente — Janela Móvel de 3 Meses

```
Estratégia: materialização parcial. NÃO gera 12 meses no banco.
Razão: usuário muda valor/frequência/pausa/cancela frequentemente.
       Materializar 12 meses vira inferno reconciliar.

A materialização tem dois pontos:
1. Ao CRIAR a recorrente: gera 3 meses futuros materializados
2. Job Hangfire diário (ExpandirRecorrentesJob): mantém sempre 3 meses à frente

Para projeção de saldo no dashboard, o cálculo é VIRTUAL (não materializado):
  saldoEstimadoEm12Meses = SUM(Transacoes Executadas)
                         + SUM(Transacoes Previsao materializadas nos próximos 3m)
                         + SUM(projeção virtual baseada em Recorrentes ativas)
```

#### 6.1 — Ao criar Recorrente

```
1. Usuário cria Recorrente:
   {
     descricao: "Netflix",
     valor: 20,
     frequencia: Mensal,
     dia: 15,
     dataInicio: 2026-06-15,
     contaId: null,           ← XOR
     cartaoCreditoId: <visa>  ← XOR
   }

2. Validação: ContaId XOR CartaoCreditoId (Service)

3. Em transação SQL:
   ├─ INSERT Recorrente (Ativo=true, DataProximaGeracao=2026-09-15)
   ├─ Para cada mês na janela inicial (3 meses: JUN, JUL, AGO):
   │  ├─ ObterOuCriarFatura (se cartaoCreditoId)
   │  └─ INSERT Transacao (Status=Previsao, RecorrenteOrigemId=<id>)
   ├─ INSERT FinancialEventLog: RecorrenteCriada
   └─ COMMIT
```

#### 6.2 — Job Hangfire ExpandirRecorrentesJob (diário, 03:00)

```
Pseudocódigo:
1. SELECT Recorrente WHERE Ativo=true
2. Para cada recorrente:
   ├─ Calcula próxima janela: hoje + 3 meses
   ├─ Para cada data alvo na janela que ainda não tem Transacao:
   │  ├─ ObterOuCriarFatura (se cartao)
   │  └─ INSERT Transacao (Status=Previsao)
   ├─ UPDATE Recorrente.DataProximaGeracao = limite da janela
   └─ INSERT FinancialEventLog: RecorrenteCriada (uma vez por mês expandido)

Idempotente: roda novamente sem duplicar (verifica existência antes de inserir).
```

#### 6.3 — Job Hangfire ExecutarRecorrentesJob (diário, 03:30)

```
Marca Transacoes Previsão como Executadas quando data <= hoje.

Pseudocódigo:
1. SELECT Transacao WHERE StatusTransacao=Previsao
                      AND RecorrenteOrigemId IS NOT NULL
                      AND Data <= TODAY
                      AND Ativo=true
2. Para cada:
   ├─ UPDATE StatusTransacao=Executado
   ├─ Se for de cartão de crédito: já tinha FaturaId — vira parte da fatura "real"
   ├─ Se for de conta: contribui pro saldo real (Receitas/Despesas)
   ├─ INSERT FinancialEventLog: RecorrenteExecutada
   └─ Notificar (opcional)
```

#### 6.4 — Cancelar Recorrente (soft delete)

```
1. POST /api/recorrentes/<id>/cancelar { motivo, idempotencyKey }

2. Em transação:
   ├─ UPDATE Recorrente SET Ativo=false, CanceladoEm=NOW, MotivoCancelamento=<m>
   ├─ UPDATE Transacao SET Ativo=false, CanceladoEm=NOW
   │     WHERE RecorrenteOrigemId=<id> AND StatusTransacao=Previsao
   │     (transações já EXECUTADAS NÃO são canceladas — preservam histórico)
   ├─ INSERT FinancialEventLog: RecorrenteCancelada
   └─ COMMIT
```

---

## 📋 VALIDAÇÕES

### Ao Criar Parcelamento

```
✅ Valor > 0
✅ Limite Disponível >= Valor Total (recalculado, não confiar em coluna stale)
✅ Data da compra não é futura
✅ Primeira parcela é em mês >= mês atual
✅ Quantidade de parcelas entre 2 e 36
✅ Cada parcela terá valor > 0 (R$ 0,01 mínimo após arredondamento)
✅ Se PIX Crédito: TaxaJuroMensal entre 1.99% e 11.99%
✅ Categoria compatível com Tipo (Despesa vs Receita)
✅ idempotencyKey presente
```

### Ao Pagar Parcela Antecipado

```
✅ ParcelaTransacao existe, pertence ao usuário, Status=Pendente
✅ Parcelamento.Ativo == true
✅ ContaPagamento existe, pertence ao usuário, Saldo >= Parcela.Valor
✅ Fatura associada está em (Aberta, *, *) OU (Fechada, NaoPago/Parcial, *)
✅ idempotencyKey presente; se já existe log com essa chave, retorna 200 idempotente
```

### Ao Pagar Fatura Inteira Antecipado

```
✅ Fatura está em (Aberta, NaoPago/Parcial, *) — fatura já fechada usa fluxo normal de pagamento
✅ ContaPagamento.Saldo >= (Fatura.ValorTotal - Fatura.ValorPago)
✅ idempotencyKey presente

Resultado: Fatura passa para (Aberta, Pago, false) — não vira Fechada
           (fechamento é responsabilidade do job)
```

### Ao Cancelar Parcelamento

```
✅ Parcelamento existe, Ativo=true
✅ Pertence ao usuário
✅ motivo não-vazio
✅ idempotencyKey presente
⚠️ Se há parcelas Status=Paga: response inclui requerEstorno=true
   (UI sugere criação de transação de estorno; nunca automático)
⚠️ Confirmação dupla na UI (não é regra de domínio, é UX)
```

---

## 🎬 PROCESSAMENTO DE FATURAS E RECORRENTES (Background Jobs)

### Stack: Hangfire

**Por que Hangfire e não on-demand:**
- Fatura precisa fechar mesmo se usuário fica 60 dias sem abrir o app
- Recorrente precisa expandir janela mesmo sem login
- Atraso precisa ser registrado no momento certo (juros começam a correr)
- On-demand acoplado a request HTTP é frágil e impreciso

**Por que Hangfire e não Quartz/cron:**
- Setup mínimo no .NET (nuget + uma linha em Program.cs)
- Dashboard built-in pra inspecionar runs
- Persistência em SQLite (mesmo banco) — sem dependência externa
- Retry automático em caso de falha

**Princípios de design dos jobs:**
- **Idempotente**: rodar 2× no mesmo dia produz mesmo resultado
- **Tolerante a gaps**: se servidor ficou down 5 dias, próximo run pega tudo elegível
- **Por unidade**: cada fatura/recorrente é uma transação SQL separada — falha em uma não derruba outras
- **Audit log**: todo evento financeiro vai pra `FinancialEventLog` com `OrigemAcao="Job:<nome>"`

### Lista de Jobs

| Job | Frequência | Função | CorrelationId |
|-----|-----------|--------|----------------|
| `FaturaFechamentoJob` | Diário 02:00 | Aberta → Fechada quando DataFechamento <= hoje | Por fatura |
| `FaturaAtrasoJob` | Diário 02:30 | EstaAtrasada=true + cálculo de juros/multa | Por fatura |
| `ExpandirRecorrentesJob` | Diário 03:00 | Materializa Transacoes Previsao até hoje+3 meses | Por recorrente |
| `ExecutarRecorrentesJob` | Diário 03:30 | Previsao → Executado quando Data <= hoje | Por transação |
| `RecalcularLimitesJob` | Hora em hora | Recalcula LimiteBloqueado/Disponivel de cartões com FinancialEventLog recente | Por cartão |

> **Nota:** os jobs são apresentados como pseudocódigo nos Fluxos 4, 5 e 6 acima. A implementação concreta vai em `Infrastructure/Jobs/` e usa `IBackgroundJobClient` + `[AutomaticRetry(Attempts=3)]`.

### Idempotência — padrão obrigatório em endpoints transacionais

```
Endpoints que mudam estado financeiro DEVEM aceitar header
"Idempotency-Key" (UUID gerado no cliente).

Implementação simples:
1. Antes de iniciar transação, SELECT do FinancialEventLog WHERE
   PayloadJson->'idempotencyKey' = @key AND CriadoEm > NOW - 24h
2. Se encontrou: retorna o resultado registrado (status 200)
3. Se não encontrou: executa lógica normalmente, persiste idempotencyKey no log

Endpoints com idempotência obrigatória:
- POST /api/parcelamentos
- POST /api/parcelas/<id>/pagar
- POST /api/parcelamentos/<id>/cancelar
- POST /api/faturas/<id>/pagar
- POST /api/recorrentes
- POST /api/recorrentes/<id>/cancelar
```

---

## 📱 DASHBOARD — Contratos de API

> **Esta seção documenta APENAS contratos de dados que o dashboard consome.**
> Mockups visuais, hierarquia de informação, copy de avisos e regras de cor estão em `UX_PARCELAMENTO.md`.

### Endpoint: `GET /api/dashboard`

```json
{
  "cartoes": [
    {
      "id": "<guid>",
      "nome": "Nubank",
      "limiteTotal": 5000.00,
      "limiteBloqueado": 2065.00,
      "limiteDisponivel": 2935.00,
      "exposicaoFuturaPrevisao": 500.00,
      "faturaCorrenteId": "<guid>"
    }
  ],
  "contas": [
    {
      "id": "<guid>",
      "nome": "Conta Corrente",
      "saldoReal": 15000.00,
      "saldoPrevistoFimDeJanela": 28000.00
    }
  ],
  "parcelamentosAtivos": [
    {
      "id": "<guid>",
      "descricao": "Notebook ASUS",
      "tipo": "CompraParcelada",
      "quantidadeParcelas": 4,
      "parcelasPagas": 1,
      "valorOriginal": 6000.00,
      "valorPago": 1500.00,
      "valorRestante": 4500.00,
      "proximaParcela": {
        "id": "<guid>",
        "dataVencimento": "2026-08-07",
        "valor": 1500.00,
        "faturaId": "<guid>"
      }
    }
  ],
  "faturasProximas": [
    {
      "id": "<guid>",
      "cartaoCreditoId": "<guid>",
      "mesReferencia": "2026-07",
      "estadoCiclo": "Aberta",
      "estadoPagamento": "NaoPago",
      "estaAtrasada": false,
      "valorTotal": 3200.00,
      "valorPago": 0,
      "dataFechamento": "2026-08-02",
      "dataVencimento": "2026-08-08",
      "jurosDeMora": 0,
      "multa": 0
    }
  ],
  "previsaoRecorrentes": {
    "receitas": [
      { "descricao": "Salário", "valor": 5000.00, "ocorrenciasNaJanela": 3, "totalNaJanela": 15000.00 }
    ],
    "despesas": [
      { "descricao": "Netflix", "valor": 20.00, "ocorrenciasNaJanela": 3, "totalNaJanela": 60.00 }
    ],
    "saldoEstimadoFimDeJanela": 19940.00
  }
}
```

### Cálculos derivados (referência rápida)

```
LimiteBloqueado(cartao) =
    SUM(ParcelaTransacao WHERE Parcelamento.Ativo
                           AND ParcelaTransacao.Status = Pendente
                           AND Parcelamento via cartão)
  + SUM(Transacao WHERE CartaoCreditoId = cartao
                    AND ParcelamentoId IS NULL
                    AND EhPagamentoFatura = false
                    AND Ativo = true
                    AND Fatura.EstadoPagamento != Pago)

SaldoConta(conta) =
    SUM(Transacao.Valor sign-adjusted by Tipo
        WHERE ContaId = conta
          AND StatusTransacao = Executado
          AND Ativo = true)

SaldoPrevistoFimDeJanela(conta) =
    SaldoConta(conta)
  + SUM(Transacao.Valor sign-adjusted
        WHERE ContaId = conta
          AND StatusTransacao = Previsao
          AND Ativo = true
          AND Data <= dataFimJanela)
```

---

## 🔗 RELAÇÃO CONTA vs CARTÃO (Crítico)

### Fluxo da Transacao

```
Transacao tem duas rotas + uma rota especial:

ROTA 1 — VIA CONTA (débito direto)
├─ ContaId preenchido, CartaoCreditoId = null
├─ Saldo da Conta é refletido imediatamente em SaldoConta() (cálculo derivado)
├─ Limite de Crédito = não afetado
└─ Se origem é Recorrente: cria janela de 3 meses de Transacoes (StatusTransacao=Previsao)

ROTA 2 — VIA CARTÃO DE CRÉDITO (entra na fatura)
├─ CartaoCreditoId preenchido, ContaId = null
├─ ObterOuCriarFatura(mês de Data)
├─ Saldo da Conta = não afetado AINDA
├─ LimiteBloqueado += Valor (registrado em FinancialEventLog)
└─ Se origem é Recorrente: cria janela de 3 meses (StatusTransacao=Previsao, NÃO bloqueia limite)

ROTA 3 — PAGAMENTO DE FATURA (ponte entre conta e cartão)
├─ EhPagamentoFatura=true, FaturaPagaId=<fatura>
├─ ContaId = conta de débito, CartaoCreditoId = null
├─ Tipo = Despesa
├─ Valor = montante pago (pode ser parcial)
├─ Efeitos:
│  ├─ Conta.Saldo -= Valor (via cálculo derivado)
│  ├─ Fatura.ValorPago += Valor
│  ├─ Recalcula Fatura.EstadoPagamento (NaoPago/Parcial/Pago)
│  ├─ Marca ParcelaTransacao Pendentes da fatura como Pagas (se quitação total)
│  └─ LimiteLiberado += Valor (registrado em FinancialEventLog)
```

### Visualizações de Dashboard (referência de queries)

```
ATIVIDADES CONTA (extrato de uma Conta):
  SELECT * FROM Transacao
  WHERE ContaId = @conta AND Ativo = true
  ORDER BY Data DESC

  Cálculo de saldo real:    apenas StatusTransacao = Executado
  Cálculo de saldo previsto: também StatusTransacao = Previsao

ATIVIDADES CARTÃO (fatura de um CartaoCredito):
  SELECT * FROM Transacao
  WHERE CartaoCreditoId = @cartao AND Ativo = true
        AND FaturaId = @fatura
  ORDER BY Data DESC

  Estado da fatura: ler EstadoCiclo, EstadoPagamento, EstaAtrasada
  (3 dimensões ortogonais, ver enums acima)
```

---

## ✅ CHECKLIST MVP (Semana 1-2)

### Backend — Entidades e Migrations

- [ ] Criar entidade `Parcelamento` (com Ativo, CanceladoEm, MotivoCancelamento)
- [ ] Criar entidade `ParcelaTransacao` (com Status: Pendente/Paga/Cancelada)
- [ ] Criar entidade `FinancialEventLog` (audit log)
- [ ] Modificar `Fatura`: substituir Status por (EstadoCiclo, EstadoPagamento, EstaAtrasada) + JurosDeMora, Multa
- [ ] Modificar `CartaoCredito`: rename Limite → LimiteTotal; LimiteBloqueado/Disponivel são derivados
- [ ] Modificar `Recorrente`: tornar ContaId nullable; adicionar CartaoCreditoId, CanceladoEm, MotivoCancelamento, CriadoEm
- [ ] Modificar `Transacao`: adicionar ParcelamentoId, ParcelaTransacaoId, StatusTransacao, EhPagamentoFatura, FaturaPagaId, Ativo, CanceladoEm, MotivoCancelamento, CriadoEm; remover Parcelas, NumeroParcela, TransacaoOrigemId
- [ ] Criar enum `EstadoCicloFatura`, `EstadoPagamentoFatura`, `StatusParcela`, `StatusTransacao`, `TipoParcelamento`, `FinancialEventType`
- [ ] Migration EF Core (com data migration para mapear `StatusFatura` antigo → novos campos)

### Backend — Services e Controllers

- [ ] `ParcelamentoService` (criar, cancelar, listar, detalhe — todos com idempotência)
- [ ] `ParcelaTransacaoService` (pagar antecipado, cancelar individual)
- [ ] `FaturaService` (adaptar para 3 flags; pagar fatura inteira; pagar parcial)
- [ ] `RecorrenteService` (criar com janela inicial de 3 meses; cancelar)
- [ ] `FinancialEventLogService` (helper para registrar eventos com CorrelationId)
- [ ] `LimiteCalculatorService` (RecalcularLimites a partir de FinancialEventLog)
- [ ] Middleware/atributo de Idempotência (`[Idempotent]` em ações POST)
- [ ] Controller: `ParcelamentoController`, `ParcelaController`
- [ ] DTOs: Criar, Listar, Detalhe, Cancelar (sempre com `idempotencyKey`)
- [ ] Validações: limite, datas, ContaId XOR CartaoCreditoId em Recorrente

### Backend — Jobs Hangfire

- [ ] Adicionar Hangfire ao Program.cs (storage SQLite, dashboard em `/hangfire`)
- [ ] `FaturaFechamentoJob` (diário 02:00)
- [ ] `FaturaAtrasoJob` (diário 02:30)
- [ ] `ExpandirRecorrentesJob` (diário 03:00)
- [ ] `ExecutarRecorrentesJob` (diário 03:30)
- [ ] `RecalcularLimitesJob` (hora em hora)
- [ ] Garantir idempotência em todos os jobs (verificar antes de inserir/atualizar)
- [ ] Logs estruturados em cada job

### Backend — Testes

- [ ] Testes unitários: cálculo de LimiteBloqueado em cenários complexos
- [ ] Testes unitários: transição correta de estados de fatura
- [ ] Testes unitários: cancelamento preserva parcelas pagas
- [ ] Testes unitários: idempotência (mesmo idempotencyKey, mesmo resultado)
- [ ] Teste integração: criar parcelamento → pagar parcela → cancelar com pagas
- [ ] Teste integração: jobs (rodar 2× sem efeito colateral)

### Frontend

- [ ] Tipos TS: `Parcelamento`, `ParcelaTransacao`, `Fatura` (com 3 flags), `FinancialEventLog`
- [ ] Service: `ParcelamentoService.ts` (com idempotency-key gerada por requisição)
- [ ] Página: `Parcelamentos/index.tsx` (lista)
- [ ] Página: `Parcelamentos/[id].tsx` (detalhe)
- [ ] Componente: `ParcelamentoForm.tsx`
- [ ] Componente: `ParcelamentoCard.tsx`
- [ ] Componente: `FaturaStatusBadge.tsx` (compõe 3 flags em badge visual)
- [ ] Modal: `CancelarParcelamentoModal.tsx` (com motivo obrigatório, fluxo de estorno)
- [ ] Modal: `PagarParcelaModal.tsx` (seleciona conta, mostra impacto no limite)
- [ ] Modal: `PagarFaturaAntecipadoModal.tsx`
- [ ] Tratamento de erros de validação 422
- [ ] Testes básicos (Vitest)

### Documentação

- [ ] Atualizar `docs/DATABASE.md` com novas entidades e schema
- [ ] Atualizar `docs/FLOWS.md` com novos fluxos
- [ ] Atualizar `docs/STANDARDS.md` (idempotência, soft delete, FinancialEventLog)
- [ ] Atualizar `CLAUDE.md` com novo modelo
- [ ] Atualizar `UX_PARCELAMENTO.md` com componentes finalizados
- [x] Feature concluída em Q2 2026 (estado histórico em `docs/history/*_2026Q2_parcelamento.md`)

---

## 🚀 PRÓXIMOS PASSOS

### Próxima Sessão: Criar Branch e Começar Backend

1. Criar branch: `git checkout -b feature/parcelamento-flexivel`
2. Implementar entidades
3. Criar migrations
4. Implementar services
5. Testar queries

### Semana 2: Frontend + Testes

1. Componentes React
2. Integração com API
3. Testes
4. Merge na main

---

**Este documento é LIVE e será atualizado conforme desenvolvimento.**
