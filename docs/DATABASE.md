---
owner: Gustavo
last_reviewed: 2026-05-13
next_review: 2026-08-13
status: CURRENT
---

# Database Schema

SQLite database with 11 core entities. **File:** `ControleFinanceiro.Api/controlefinanceiro.db`

## Entity Relationship Diagram

```mermaid
erDiagram
    USUARIO ||--o{ CONTA : cria
    USUARIO ||--o{ CARTAO_CREDITO : cria
    USUARIO ||--o{ CATEGORIA : cria
    USUARIO ||--o{ TRANSACAO : cria
    USUARIO ||--o{ FATURA : cria
    USUARIO ||--o{ TRANSFERENCIA : cria
    USUARIO ||--o{ RECORRENTE : cria
    USUARIO ||--o{ EMPRESTIMO : cria

    CONTA ||--o{ TRANSACAO : "tem"
    CARTAO_CREDITO ||--o{ TRANSACAO : "tem"
    CARTAO_CREDITO ||--o{ FATURA : "gera"
    CATEGORIA ||--o{ TRANSACAO : "classifica"
    TRANSACAO ||--o{ FATURA : "agrupa em"
    CONTA ||--o{ TRANSFERENCIA : "origem/destino"
    BANCO ||--o{ CONTA : "possui"
    BANCO ||--o{ CARTAO_CREDITO : "emite"
```

---

## Tables

### USUARIOS
Usuários do sistema. Autenticação via JWT.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | Chave primária |
| `Email` | TEXT | UNIQUE NOT NULL | Email único para login |
| `Nome` | TEXT | NOT NULL | Nome completo |
| `SenhaHash` | TEXT | NOT NULL | BCrypt hash da senha |
| `DataNascimento` | DateTime | NULL | Opcional |
| `DataCriacao` | DateTime | NOT NULL | Timestamp de criação |
| `DataAtualizacao` | DateTime | NOT NULL | Timestamp de atualização |

**Delete Behavior:** RESTRICT (não pode deletar se tem contas/cartões/etc)

---

### CONTAS
Contas bancárias e carteiras do usuário.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `UsuarioId` | UUID | FK(Usuarios) NOT NULL | Isolamento de dados |
| `BancoId` | UUID | FK(Bancos) | Banco da conta |
| `Nome` | TEXT | NOT NULL | Ex: "Conta Corrente Itaú" |
| `Tipo` | INT | NOT NULL | 0=Corrente, 1=Poupança, 2=Carteira |
| `NumeroConta` | TEXT | NULL | Número da conta |
| `IsCarteira` | BOOL | DEFAULT 0 | Carteira padrão do user |
| `DataCriacao` | DateTime | NOT NULL | |

**Saldo:** Calculado dinamicamente como `SUM(Receitas) - SUM(Despesas)`

**Delete Behavior:** Contas com transações → RESTRICT

---

### BANCOS
Bancos do Brasil. Sincronizados com BCB (Banco Central do Brasil) API.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `Codigo` | INT | UNIQUE NOT NULL | Código BCB (Ex: 001 = BB) |
| `Nome` | TEXT | NOT NULL | Ex: "Banco do Brasil" |
| `Ispb` | TEXT | NOT NULL | Identificador ISPB |
| `Url` | TEXT | NULL | Website do banco |

**Sincronização:** `BancoSeeder.cs` faz fetch no init do app.

---

### CARTOES_CREDITO
Cartões de crédito do usuário.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `UsuarioId` | UUID | FK(Usuarios) NOT NULL | |
| `BancoId` | UUID | FK(Bancos) | Banco emissor |
| `Nome` | TEXT | NOT NULL | Ex: "Visa Platinum" |
| `Bandeira` | INT | NOT NULL | 0=Visa, 1=Mastercard, 2=Amex, 3=Elo |
| `LimiteTotal` | DECIMAL | NOT NULL | Limite total de crédito (ETAPA 5a) |
| `DataVencimento` | INT | NOT NULL | Dia do mês (1-31) |
| `DataCriacao` | DateTime | NOT NULL | |

**Delete Behavior:** Parcelamentos ativos → RESTRICT; Faturas abertas → RESTRICT

**Limits (Calculated):**
- `LimiteBloqueado` = SUM(ValorBloqueado de todos Parcelamentos.Ativo)
- `LimiteDisponivel` = LimiteTotal - LimiteBloqueado

---

### TRANSACOES
Movimentações financeiras. Core entity.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `UsuarioId` | UUID | FK(Usuarios) NOT NULL | |
| `ContaId` | UUID | FK(Contas) | NULL se CartãoCredito |
| `CartaoCreditoId` | UUID | FK(CartoesCreditito) | NULL se Conta |
| `CategoriaId` | UUID | FK(Categorias) | NULL = sem categoria |
| `FaturaId` | UUID | FK(Faturas) | Para transações diretas do cartão |
| `ParcelamentoId` | UUID | FK(Parcelamentos) | Se é parte de parcelamento (ETAPA 2) |
| `ParcelaTransacaoId` | UUID | FK(ParcelasTransacao) | Ref bidirecional pra parcela individual |
| `FaturaPagaId` | UUID | FK(Faturas) | Se é pagamento antecipado de parcela |
| `Descricao` | TEXT | NOT NULL | Até 400 chars |
| `Valor` | DECIMAL | NOT NULL | Sempre positivo |
| `Tipo` | INT | NOT NULL | 0=Receita, 1=Despesa |
| `MeioPagamento` | INT | NULL | 0=Dinheiro, 1=Débito, 2=Crédito, 3=TED, 4=PIX |
| `UsadoComoCredito` | BOOL | DEFAULT 0 | Se receita foi creditada |
| `StatusTransacao` | INT | DEFAULT 1 | 0=Previsao, 1=Executado (ETAPA 2) |
| `EhPagamentoFatura` | BOOL | DEFAULT 0 | Pagamento de fatura (usa `FaturaPagaId`, não `FaturaId`) — fora do P&L |
| `EhTransferencia` | BOOL | DEFAULT 0 | Perna de transferência entre contas — fora do P&L (#128) |
| `EhSaldoInicial` | BOOL | DEFAULT 0 | Saldo de abertura de conta — fora do P&L (#128) |
| `Ativo` | BOOL | DEFAULT 1 | Soft delete flag (ETAPA 2) |
| `CanceladoEm` | DateTime | NULL | Data do soft delete |
| `MotivoCancelamento` | TEXT | NULL | Razão do soft delete |
| `Data` | DateTime | NOT NULL | Quando a transação ocorreu |
| `CriadoEm` | DateTime | NOT NULL | Timestamp de criação |

> **Saldo ≠ Relatório de P&L (#128):** o **saldo** da conta conta TODO movimento real (`Ativo` + `StatusTransacao=Executado`), incluindo transferência, pagamento de fatura e saldo inicial (movem dinheiro). Já os **relatórios de receita/despesa** (RelatorioService, KPIs do Dashboard) **excluem** `EhTransferencia`, `EhPagamentoFatura` e `EhSaldoInicial` — não são receita/despesa real (evita inflar totais e dupla contagem). Migration `AddFlagsContabeisTransacao` faz backfill dos dados existentes.

**Parcelamento (NEW — ETAPA 2):**
- Parcelamentos criados em tabela separada `Parcelamentos`
- Cada Parcelamento tem N `ParcelasTransacao` (1 per vencimento)
- Cada ParcelaTransacao gera 1 Transacao ao ser criada (Status=Previsao)
- Quando ParcelaTransacao é paga, cria Transacao de pagamento (EhPagamentoFatura=true, FaturaPagaId=...)

**Constraints:**
- `ContaId XOR CartaoCreditoId` — nunca ambos NULL ou ambos preenchidos
- Se `CartaoCreditoId` + !ParcelamentoId → linkado a `FaturaId`
- `Ativo=false` = soft deleted (nunca deletar fisicamente)

---

### PARCELAMENTOS (New — ETAPA 2)
Parcelamentos flexíveis de compras à vista ou PIX.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `UsuarioId` | UUID | FK(Usuarios) NOT NULL | |
| `CartaoCreditoId` | UUID | FK(CartoesCreditito) NOT NULL | Cartão usado |
| `CategoriaId` | UUID | FK(Categorias) | Categoria da compra |
| `Descricao` | TEXT | NOT NULL | "Compra XYZ" |
| `ValorTotal` | DECIMAL | NOT NULL | Valor original |
| `TipoParcelamento` | INT | NOT NULL | 0=CompraParcelada, 1=PIXCredito |
| `TaxaJuroMensal` | DECIMAL | NULL | Se PIX: 1.99%-11.99% |
| `QuantidadeParcelas` | INT | NOT NULL | 2-36 |
| `Ativo` | BOOL | DEFAULT 1 | Soft delete |
| `CanceladoEm` | DateTime | NULL | Quando foi cancelado |
| `MotivoCancelamento` | TEXT | NULL | Por quê |
| `DataCriacao` | DateTime | NOT NULL | |

**Delete Behavior:** Cascade → ParcelasTransacao

**Limits Impact:**
- `LimiteBloqueado += ValorComJuros ?? ValorTotal` ao criar
- `LimiteBloqueado -= ...` ao cancelar

---

### PARCELAS_TRANSACAO (New — ETAPA 2)
Parcelas individuais de um Parcelamento. Cada uma vira Transacao em sua Fatura.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `UsuarioId` | UUID | FK(Usuarios) NOT NULL | |
| `ParcelamentoId` | UUID | FK(Parcelamentos) NOT NULL | Qual parcelamento |
| `FaturaId` | UUID | FK(Faturas) NOT NULL | Fatura do vencimento |
| `TransacaoId` | UUID | FK(Transacoes) | Transacao criada ao vencer |
| `Numero` | INT | NOT NULL | 1, 2, 3... N |
| `DataVencimento` | DateTime | NOT NULL | Quando vence |
| `ValorOriginal` | DECIMAL | NOT NULL | Valor da parcela (sem juros) |
| `JurosMensais` | DECIMAL | DEFAULT 0 | Juros acumulados (PIX) |
| `ValorComJuros` | DECIMAL | NOT NULL | = ValorOriginal + JurosMensais |
| `StatusParcela` | INT | DEFAULT 0 | 0=Pendente, 1=Paga, 2=Cancelada |
| `PagoEm` | DateTime | NULL | Quando foi paga (antecipado) |
| `CanceladoEm` | DateTime | NULL | Quando foi cancelada |
| `MotivoCancelamento` | TEXT | NULL | Por quê |
| `DataCriacao` | DateTime | NOT NULL | |

**Delete Behavior:** Restrict (referenciada por Fatura)

**Workflow:**
1. Ao criar Parcelamento → INSERT N ParcelasTransacao (Status=Pendente)
2. Ao vencer → Hangfire job auto-materialize Transacao na Fatura (cria transacao.EhParcelamento=true)
3. Ao pagar antecipado → UPDATE Status=Paga, cria Transacao de pgto (EhPagamentoFatura=true)
4. Ao cancelar → UPDATE Status=Cancelada, libera limite

---

### FINANCIAL_EVENT_LOG (New — ETAPA 2)
Auditoria de eventos financeiros. Suporta idempotência via `IdempotencyKey`.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `UsuarioId` | UUID | FK(Usuarios) NOT NULL | |
| `Tipo` | INT | NOT NULL | 0=ParcelamentoCriado, 1=LimiteBloqueado, 2=ParcelaPaga, ... (enum) |
| `EntidadeId` | UUID | NULL | ID da entidade afetada |
| `EntidadeNome` | TEXT | NULL | "Parcelamento", "ParcelaTransacao", ... |
| `CorrelationId` | UUID | NULL | Agrupa eventos da mesma operação |
| `PayloadJson` | TEXT | NOT NULL | JSON com dados (inclui idempotencyKey se presente) |
| `DataCriacao` | DateTime | NOT NULL | Quando ocorreu |

**Índices:**
```sql
CREATE INDEX idx_financial_events_usuario ON financial_event_logs(usuario_id);
CREATE INDEX idx_financial_events_tipo ON financial_event_logs(tipo);
CREATE INDEX idx_financial_events_correlacao ON financial_event_logs(correlation_id);
```

**Idempotência:**
- `BuscarPorIdempotencyKeyAsync(usuarioId, idempotencyKey)` → busca no PayloadJson
- Se encontra → retorna operação anterior reconstituída
- Se não → processa normalmente, registra novo evento

---

### CATEGORIAS
Categorias de despesas/receitas.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `UsuarioId` | UUID | FK(Usuarios) NOT NULL | |
| `Nome` | TEXT | NOT NULL | Ex: "Alimentação" |
| `Finalidade` | INT | NOT NULL | 0=Despesa, 1=Receita, 2=Ambas |
| `SaldoInicial` | DECIMAL | NULL | Deprecated (was optional) |
| `DataCriacao` | DateTime | NOT NULL | |

**Validação:** Ao criar transação, validar que `Categoria.Finalidade` é compatível com `Transacao.Tipo`

---

### FATURAS
Faturas de cartão de crédito. Auto-criadas.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `UsuarioId` | UUID | FK(Usuarios) NOT NULL | |
| `CartaoCreditoId` | UUID | FK(CartoesCreditito) NOT NULL | |
| `MesReferencia` | TEXT | NOT NULL | Format: "2026-05" |
| `EstadoCiclo` | INT | DEFAULT 0 | 0=Aberta, 1=Fechada (ETAPA 3) |
| `EstadoPagamento` | INT | DEFAULT 0 | 0=NaoPago, 1=PagoParcial, 2=Pago (ETAPA 3) |
| `EstaAtrasada` | BOOL | DEFAULT 0 | Marcada atrasada por Hangfire (ETAPA 3) |
| `DataVencimento` | DateTime | NOT NULL | Calculada: dia DiaVencimento do cartão no mês |
| `DataFechamentoEfetiva` | DateTime | NULL | Quando foi fechada (ETAPA 3) |
| `DataPagamentoTotal` | DateTime | NULL | Quando foi paga 100% (ETAPA 3) |
| `JurosDeMora` | DECIMAL | DEFAULT 0 | Juros por atraso (ETAPA 8) |
| `Multa` | DECIMAL | DEFAULT 0 | Multa por atraso (ETAPA 8) |
| `DataCriacao` | DateTime | NOT NULL | |

**Fluxo (NEW — ETAPA 2+):**
1. User cria transação com CartãoCredito → auto-cria Fatura (EstadoCiclo=Aberta, EstadoPagamento=NaoPago)
2. Transação é linkada a Fatura
3. Ao fim do mês → Hangfire `FaturaFechamentoJob` (EstadoCiclo=Fechada, DataFechamentoEfetiva=now)
4. User paga totalmente → UpdateEstadoPagamento=Pago, DataPagamentoTotal=now, EstaAtrasada=false
5. Se vence sem pagar → `FaturaAtrasoJob` marca EstaAtrasada=true, adiciona JurosDeMora + Multa

**Delete Behavior:** ParcelasTransacao linkadas → Restrict

**3 Flags (Ortogonais):**
- `EstadoCiclo`: Aberta (pode receber transações) vs Fechada (read-only)
- `EstadoPagamento`: NaoPago (0 pago) vs PagoParcial (parcialmente pago) vs Pago (100%)
- `EstaAtrasada`: true se passou vencimento sem pagar

---

### TRANSFERENCIAS
Transferências entre contas do user.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `UsuarioId` | UUID | FK(Usuarios) NOT NULL | |
| `ContaOrigemId` | UUID | FK(Contas) NOT NULL | De onde |
| `ContaDestinoId` | UUID | FK(Contas) NOT NULL | Para onde |
| `Valor` | DECIMAL | NOT NULL | > 0 |
| `Descricao` | TEXT | NULL | |
| `Data` | DateTime | NOT NULL | |
| `DataCriacao` | DateTime | NOT NULL | |

**Contabilização:**
- Cria 2 transações implícitas:
  - Despesa na ContaOrigem
  - Receita na ContaDestino

---

### RECORRENTES (Assinaturas)
Despesas/receitas que se repetem. Janela móvel de 3 meses (ETAPA 5).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `UsuarioId` | UUID | FK(Usuarios) NOT NULL | |
| `ContaId` | UUID | FK(Contas) | NULL se CartãoCredito; XOR CartaoCreditoId |
| `CartaoCreditoId` | UUID | FK(CartoesCreditito) | NULL se Conta; XOR ContaId (ETAPA 5) |
| `CategoriaId` | UUID | FK(Categorias) | |
| `Nome` | TEXT | NOT NULL | Ex: "Netflix" |
| `Valor` | DECIMAL | NOT NULL | |
| `Tipo` | INT | NOT NULL | 0=Receita, 1=Despesa |
| `Frequencia` | INT | NOT NULL | 0=Diária, 1=Semanal, 2=Mensal, 3=Anual |
| `DataProxima` | DateTime | NOT NULL | Próxima execução |
| `CanceladoEm` | DateTime | NULL | Soft delete timestamp (ETAPA 5) |
| `MotivoCancelamento` | TEXT | NULL | Por quê foi cancelado (ETAPA 5) |
| `CriadoEm` | DateTime | NOT NULL | Timestamp de criação (ETAPA 4) |

**Validação (ETAPA 5):** ContaId XOR CartaoCreditoId (nunca ambos, nunca nenhum)

**Janela Móvel (ETAPA 5):**
- Ao criar: materializa 3 transações futuras com Status=Previsao
- `ExpandirRecorrentesJob` (diário 03:00): avança janela se data próxima < 1 mês
- `ExecutarRecorrentesJob` (diário 03:30): Previsao → Executado pela data
- Ao cancelar: marca CanceladoEm, cancela Transacoes Previsao futuras, preserva Executadas

**Delete Behavior:** CartaoCreditoId referência SET NULL (deletar cartão mantém recorrente órfã)

---

### EMPRESTIMOS
Registro de empréstimos.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `Id` | UUID | PK | |
| `UsuarioId` | UUID | FK(Usuarios) NOT NULL | |
| `ContaId` | UUID | FK(Contas) | Conta que recebeu |
| `Nome` | TEXT | NOT NULL | "Empréstimo João" |
| `Valor` | DECIMAL | NOT NULL | Montante total |
| `TaxaJuro` | DECIMAL | NULL | % a.m. |
| `Tipo` | INT | NOT NULL | 0=Contraído, 1=Concedido |
| `DataInicio` | DateTime | NOT NULL | |
| `DataVencimento` | DateTime | NULL | |
| `Status` | INT | NOT NULL | 0=Ativo, 1=Encerrado, 2=Quitado |
| `DataCriacao` | DateTime | NOT NULL | |

**Notas:** Apenas registro; transações de amortização são criadas manualmente como Transacoes.

---

## Migration Strategy

Migrations estão em `Migrations/` com timestamp:
- `20260303175437_InitialCreate.cs` — Schema base
- `20260427181311_AddDataToTransacao.cs` — Adiciona coluna `Data`
- `20260502182837_AddCartaoCredito.cs` — Nova entidade CartãoCredito
- etc.

**Apply migrations:**
```powershell
dotnet ef database update
```

**Create migration:**
```powershell
dotnet ef migrations add AddNewColumn
```

---

## Índices

Recomendados (não necessariamente implementados):

```sql
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_contas_usuario ON contas(usuario_id);
CREATE INDEX idx_transacoes_usuario ON transacoes(usuario_id);
CREATE INDEX idx_transacoes_data ON transacoes(data);
CREATE INDEX idx_faturas_cartao ON faturas(cartao_credito_id);
CREATE INDEX idx_faturas_status ON faturas(status);
```

---

## Notes

- **Data Isolation:** Todos queries filtram por `UsuarioId`
- **Soft Deletes:** Não implementado (usar RESTRICT delete behavior)
- **Timestamps:** Sempre UTC
- **Decimals:** DECIMAL(18, 2) para valores monetários
- **Saldo calculado:** Não armazenado em `Contas.saldo`; computed on-the-fly
