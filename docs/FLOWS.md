---
owner: Gustavo
last_reviewed: 2026-05-13
next_review: 2026-08-13
status: CURRENT
---

# Data Flow Diagrams

Visual representation of core business flows.

## 1. Authentication Flow

```mermaid
sequenceDiagram
    User->>Frontend: Enter email/password
    Frontend->>API: POST /auth/login
    API->>DB: Query usuario by email
    API->>API: Verify password (BCrypt)
    API-->>Frontend: 200 OK + JWT token
    Frontend->>LocalStorage: Save token
    Frontend->>API: GET /auth/me (Bearer token)
    API->>API: Validate JWT claims
    API-->>Frontend: 200 OK + user data
    Frontend->>Frontend: Redirect to /dashboard
```

**JWT Structure:**
- **Header:** `{"alg":"HS256","typ":"JWT"}`
- **Payload:** `{"sub":"user-id","email":"user@email.com","name":"User","iat":...,"exp":...}`
- **Secret:** Configured in `appsettings.json`
- **Expiration:** 60 minutes

---

## 2. Create Transaction Flow (À Vista)

```mermaid
sequenceDiagram
    User->>Frontend: Fill form (amount, category, account)
    Frontend->>API: POST /transacoes {CriarTransacaoDto}
    API->>Service: CriarTransacaoAsync(dto, usuarioId)
    Service->>DB: Validate categoria matches type
    Service->>DB: Create Transacao entity
    Service->>DB: Calculate new Conta.saldo
    Service->>DB: Save & commit
    API-->>Frontend: 201 Created + TransacaoDto
    Frontend->>Frontend: Show success message
    Frontend->>API: GET /transacoes (refresh list)
    API-->>Frontend: 200 OK + updated list
    Frontend->>Frontend: Re-render table
```

**Validation:**
- `Valor > 0`
- `CategoriaId` exists & matches `TipoTransacao`
- `ContaId` or `CartaoCreditoId` (exactly one)
- `Data` cannot be future date

---

## 3. Create Parcelamento (Flexible Installment) Flow — ETAPA 2

```mermaid
sequenceDiagram
    User->>Frontend: Fill "Parcelamento" form (valor, parcelas, cartão, primeiraParcelaMes)
    Frontend->>API: POST /api/parcelamentos {CriarParcelamentoDto}
    API->>Service: CriarAsync(dto, usuarioId)
    Service->>Service: Check Idempotency-Key (header)
    Service->>DB: Validar: cartão, categoria, limite, primeiraParcelaMes >= fatura da compra
    Service->>DB: BEGIN TRANSACTION
    Service->>DB: INSERT Parcelamento (QuantidadeParcelas=N, ValorTotal, TipoParcelamento)
    Service->>Service: Loop i=1 to N:
    Service->>DB: GET/CREATE Fatura que FECHA em primeiraParcelaMes + (i-1) meses
    Service->>Service: Calc RateiovalorComJuros (incluindo juros PIX se aplicável)
    Service->>DB: INSERT ParcelaTransacao (numero=i, DataVencimento = vencimento da fatura, ValorComJuros, Status=Pendente)
    Service->>DB: UPDATE Fatura.ParcelasTransacao += ParcelaTransacao
    Service->>DB: INSERT Transacao (ParcelamentoId, StatusTransacao=Previsao) — materializar quando vencer
    Service->>DB: REGISTRAR FinancialEventLog (ParcelamentoCriado + LimiteBloqueado)
    Service->>DB: COMMIT TRANSACTION
    API-->>Frontend: 201 Created + ParcelamentoDetalheDto
    Frontend->>Frontend: Show "12 parcelas criadas com juros"
```

**Key Points (ETAPA 2):**
- `TipoParcelamento`: 0=CompraParcelada (à vista no cartão), 1=PIXCredito (com juros)
- `QuantidadeParcelas`: 2-36, flexível
- `primeiraParcelaMes` (yyyy-MM) = o mês em que **fecha** a fatura da 1ª parcela (o rótulo da fatura na tela Cartões: "Outubro de 2026 · 10/09–10/10"); não depende do dia da compra. Não pode ser antes da fatura em que a compra cai (a que fecha depois da `DataCompra`); o form sugere essa fatura e usa como mínimo do `PontesMonthInput`
- Parcela N → fatura que fecha em `primeiraParcelaMes + N-1`; `DataVencimento` da parcela = vencimento real dessa fatura (`FaturaService.DataNoCicloQueFechaEm` + `CalcularPeriodo`/`CalcularVencimento`)
- Cada ParcelaTransacao = 1 Fatura diferente
- Idempotência via `Idempotency-Key` header + `FinancialEventLogService`
- Limite bloqueado imediatamente (`LimiteBloqueado += ValorComJuros`)
- Juros PIX: simples (1.99%-11.99% a.m.)

---

## 3b. Pagar Parcela Antecipada — ETAPA 2

```mermaid
sequenceDiagram
    User->>Frontend: View Parcelamento detail, click "Pagar antecipado"
    Frontend->>API: POST /api/parcelas/{parcelaId}/pagar {ContaPagamentoId, DataPagamento}
    API->>Service: PagarAntecipadoAsync(parcelaId, dto, usuarioId)
    Service->>DB: Validar: parcela Status=Pendente, conta saldo>=parcela.Valor
    Service->>DB: BEGIN TRANSACTION
    Service->>DB: UPDATE ParcelaTransacao SET Status=Paga, PagoEm=now
    Service->>DB: INSERT Transacao (EhPagamentoFatura=true, FaturaPagaId=faturaId, ContaId=dto.ContaPagamentoId, Valor=parcela.Valor)
    Service->>DB: UPDATE Fatura recalc EstadoPagamento
    Service->>DB: REGISTRAR FinancialEventLog (ParcelaPaga + LimiteLiberado)
    Service->>DB: COMMIT TRANSACTION
    API-->>Frontend: 200 OK + FaturaAtualizadaDto
    Frontend->>Frontend: Show "Parcela paga em 10/05"
```

---

## 3c. Cancelar Parcelamento Inteiro — ETAPA 2

```mermaid
sequenceDiagram
    User->>Frontend: View Parcelamento, click "Cancelar"
    Frontend->>API: POST /api/parcelamentos/{id}/cancelar {CancelarParcelamentoDto}
    API->>Service: CancelarAsync(parcelamentoId, dto, usuarioId)
    Service->>DB: BEGIN TRANSACTION
    Service->>DB: UPDATE Parcelamento SET Ativo=false, CanceladoEm, MotivoCancelamento
    Service->>DB: UPDATE ParcelasTransacao WHERE Status=Pendente SET Status=Cancelada
    Service->>DB: REGISTRAR FinancialEventLog (ParcelamentoCancelado + LimiteLiberado)
    Service->>DB: COMMIT TRANSACTION
    API-->>Frontend: 200 OK + {canceladas: int, jaPagas: int, requerEstorno: bool}
    Frontend->>Frontend: Show "5 parcelas canceladas, 7 já pagas — considere estorno?"
```

---

## OLD 3. Create Parcelada (Legacy — Removed in ETAPA 2)

```
DEPRECATED: Old system used Transacao.Parcelas + NumeroParcela.
Replaced by: Parcelamento + ParcelaTransacao (flexible, per-month parcelas).
```

---

## 4. Pagar Fatura Flow

```mermaid
sequenceDiagram
    User->>Frontend: Abre o modal "Pagar" (gera Idempotency-Key = crypto.randomUUID())
    Frontend->>API: POST /cartoes/{cartaoId}/faturas/{id}/pagar {contaId, valor, dataPagamento, meioPagamento} + header Idempotency-Key
    API->>Service: PagarFaturaAsync(faturaId, dto, usuarioId, idempotencyKey)
    Service->>DB: Fatura do usuário (+ Transacoes + ParcelasTransacao) — de outro usuário/inexistente → 404
    Service->>DB: RegistroIdempotencia (usuário, "PagarFatura", chave) já existe? → replay
    Service->>Service: restante = RegrasFinanceiras.ValorRestanteFatura (sem parcela cancelada)
    Service->>DB: INSERT Transacao de pagamento (EhPagamentoFatura, FaturaPagaId) + UPDATE Fatura.ValorPago/EstadoPagamento + INSERT RegistroIdempotencia + FinancialEventLog — UM SaveChanges
    API-->>Frontend: 204 No Content
    Frontend->>API: recarrega faturas/detalhe (falha aqui NÃO vira "erro ao pagar")
```

**Regras:**
- `Idempotency-Key` **obrigatória** (sem ela → 400). Mesma chave + mesmos dados (conta, valor, data, meio) → 204 sem pagar de novo (replay vem antes do "já paga"). Mesma chave + outros dados, ou em outra fatura → 409. Tentativa que falha não gasta a chave.
- `0 < valor <= restante`; fatura `Pago` recusa (409).
- Concorrência: `Fatura.Versao` = `xmin`. Outro pagamento/operação na mesma fatura entre a leitura e o save → 409 `CONCURRENCY_CONFLICT`; corrida com a **mesma** chave (23505 no índice único ou `xmin`) → replay.
- Front: 4xx com mensagem vira **aviso** com a mensagem do servidor; no 409 o modal fecha e a fatura recarrega (reabrir gera chave nova).

---

## 5. Transferência Entre Contas Flow

```mermaid
sequenceDiagram
    User->>Frontend: Fill transfer form (origin, destination, amount)
    Frontend->>API: POST /transferencias {contaOrigemId, contaDestinoId, valor}
    API->>Service: CriarTransferenciaAsync(dto, usuarioId)
    Service->>DB: Create Transferencia entity
    Service->>DB: Create Transacao (Despesa in ContaOrigem)
    Service->>DB: Create Transacao (Receita in ContaDestino)
    Service->>DB: Update both Conta saldos
    Service->>DB: Commit all
    API-->>Frontend: 201 Created + TransferenciaDto
    Frontend->>Frontend: Show confirmation
    Frontend->>API: GET /contas (refresh)
    API-->>Frontend: 200 OK + updated saldos
```

**Implicit Transactions:**
```sql
-- Created automatically:
INSERT INTO transacoes (id, conta_id, tipo, valor, descricao, data)
  VALUES (uuid1, conta_origem_id, 1, 1000, 'Transferência saída', '2026-05-07');

INSERT INTO transacoes (id, conta_id, tipo, valor, descricao, data)
  VALUES (uuid2, conta_destino_id, 0, 1000, 'Transferência entrada', '2026-05-07');
```

---

## 6. Frontend Component Integration Flow

```mermaid
graph TD
    A["Page Component"] -->|imports| B["Service"]
    A -->|useState| C["Local State"]
    C -->|onChange| D["Form Input"]
    D -->|onSubmit| E["handleSubmit"]
    E -->|await| B
    B -->|GET/POST/PUT| F["API"]
    F -->|Bearer JWT| G["Backend"]
    G -->|validates UserId| H["Database"]
    H -->|returns DTO| F
    F -->|Promise resolve| B
    B -->|result| E
    E -->|setData| C
    C -->|re-render| A
```

**Pattern:**
1. Component mounts → `useEffect(() => fetchData())`
2. User interacts → State updates
3. Submit handler → Calls service
4. Service uses axiosClient → sends request with JWT
5. Backend validates JWT → processes → returns
6. Service returns → Component updates state
7. State change → re-render

---

## 7. Saldo Dinâmico Calculation

**Not Stored:** Conta.Saldo is NOT a table column.

**Regra única (#269):** `RegrasFinanceiras` — saldo = Σ receitas − Σ despesas das transações `Ativo` + `Executado` da conta (inclui transferência, saldo inicial e pagamento de fatura; **exclui previsão** e excluídas). Agregado **no banco** numa query só pra todas as contas (`GROUP BY ContaId` + `SUM(CASE ...)`), filtrando pelo dono da conta. Consumidores (`ContasController` via `ContaService.ObterSaldosAsync`, `DashboardService`, `ParcelaTransacaoService`, `TransacaoService.ObterResumoPorContaAsync`) não recalculam na mão.

---

## 8. User Data Isolation

Every query filters by `UsuarioId`:

```csharp
// Correct ✓
var transacoes = await _context.Transacoes
    .Where(t => t.UsuarioId == usuarioId)
    .ToListAsync();

// Dangerous ✗ (missing filter)
var transacoes = await _context.Transacoes.ToListAsync();
```

**Rule:** `usuarioId` passed from Controller → Service → Repository queries

---

## 9. Error Handling Flow

```mermaid
graph TD
    A["Frontend Submit"] -->|await| B["Service"]
    B -->|try| C["API Call"]
    C -->|Success| D["Return Result"]
    C -->|400 BadRequest| E["Catch Error"]
    C -->|401 Unauthorized| F["Redirect to /auth/login"]
    C -->|500 Error| G["Show Toast Error"]
    E -->|ValidationError| H["Show Form Errors"]
    D -->|setState| I["Re-render Success"]
    F -->|localStorage.clear| J["Clear Auth"]
    G -->|Snackbar| K["Notify User"]
```

**Interceptors (axiosClient.ts):**
1. **Request:** Injects JWT from localStorage
2. **Response Success:** Returns data
3. **Response Error 401:** Clears token & redirects to login
4. **Response Error 4xx/5xx:** Lets caller handle

---

## 10. Authentication + Authorization Matrix

| Endpoint | Auth | Scope | Notes |
|----------|------|-------|-------|
| `POST /auth/register` | ❌ No | Public | Anyone can register |
| `POST /auth/login` | ❌ No | Public | Public endpoint |
| `GET /auth/me` | ✅ Yes | User | Requires valid JWT |
| `GET /contas` | ✅ Yes | User | Filters by UsuarioId |
| `POST /contas` | ✅ Yes | User | Creates for current user |
| `PUT /contas/{id}` | ✅ Yes | User | Only own accounts |
| `DELETE /contas/{id}` | ✅ Yes | User | Only own accounts |
| `GET /transacoes` | ✅ Yes | User | Only own transactions |
| `POST /transacoes` | ✅ Yes | User | Creates for current user |

---

## 11. Estado de Fatura Transitions — ETAPA 3 (3 Orthogonal Flags)

```mermaid
stateDiagram-v2
    [*] --> Aberta_NaoPago: Transaction created
    note right of Aberta_NaoPago
        EstadoCiclo=Aberta, EstadoPagamento=NaoPago
        Transações podem ser adicionadas
        Total calculado dinamicamente
    end note
    
    Aberta_NaoPago --> Fechada_NaoPago: Hangfire job (fim do mês)
    Aberta_NaoPago --> Fechada_PagoParcial: User paga parte
    note right of Fechada_PagoParcial
        EstadoCiclo=Fechada, EstadoPagamento=PagoParcial
        Data de fechamento registrada
        Vencimento visível
    end note
    
    Fechada_NaoPago --> Fechada_Atrasada: Hangfire (passado vencimento)
    note right of Fechada_Atrasada
        EstaAtrasada=true
        Juros + Multa adicionados
    end note
    
    Fechada_PagoParcial --> Fechada_Pago: User paga restante
    Fechada_NaoPago --> Fechada_Pago: User paga 100%
    Fechada_Atrasada --> Fechada_Pago: User paga com juros
    
    Fechada_Pago --> [*]: Complete
    note right of Fechada_Pago
        EstadoCiclo=Fechada, EstadoPagamento=Pago, EstaAtrasada=false
        DataPagamentoTotal registrada
        Arquivada
    end note
```

**3 Orthogonal Flags:**
1. **EstadoCiclo:** `Aberta` (0) | `Fechada` (1)
   - Controls if new transactions can be added
2. **EstadoPagamento:** `NaoPago` (0) | `PagoParcial` (1) | `Pago` (2)
   - Calculated from sum of Transacoes + ParcelasTransacao pagas
3. **EstaAtrasada:** `false` | `true`
   - Set by FaturaAtrasoJob if DataVencimento passed without full payment

**No longer:** Single `Status` enum (legacy deleted in ETAPA 5b)

---

## Frontend ↔ Backend Contract (Types)

**Generated in frontend:** `src/types/` mirrors backend DTOs

**Example:**
```typescript
// Frontend type
interface TransacaoDto {
  id: string;
  descricao: string;
  valor: number;
  tipo: 0 | 1; // 0=Receita, 1=Despesa
  categoriaId?: string;
  contaId?: string;
  cartaoCreditoId?: string;
  data: string; // ISO datetime
}

// Backend DTO
public class TransacaoDto {
  public Guid Id { get; set; }
  public string Descricao { get; set; }
  public decimal Valor { get; set; }
  public int Tipo { get; set; }
  // ...
}
```

**Keep them in sync!**
