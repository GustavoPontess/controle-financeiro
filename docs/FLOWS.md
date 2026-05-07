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

## 3. Create Parcelada (Installment) Flow

```mermaid
sequenceDiagram
    User->>Frontend: Fill form + Parcelas=12
    Frontend->>API: POST /transacoes {parcelas: 12, CartaoCreditoId}
    API->>Service: CriarParcelamentoAsync()
    Service->>Service: Loop i=1 to 12:
    Service->>DB: Create Transacao(NumeroParcela=i)
    Service->>DB: Find/Create Fatura for month i
    Service->>DB: Link Transacao → Fatura
    Service->>DB: Commit all
    API-->>Frontend: 201 Created + array[12 TransacaoDto]
    Frontend->>Frontend: Show "12 parcelas criadas"
```

**Key Points:**
- `Parcelas.HasValue && Parcelas > 1` triggers parcelamento
- Each `Transacao` has unique `NumeroParcela` (1..N)
- `Fatura` auto-created for each month
- Status starts as "Aberta"

---

## 4. Pagar Fatura Flow

```mermaid
sequenceDiagram
    User->>Frontend: Select fatura + click "Pagar"
    Frontend->>API: POST /faturas/{id}/pagar {dataPagamento}
    API->>Service: PagarFaturaAsync(faturaId, dataPagamento)
    Service->>DB: Query Fatura + all linked Transacoes
    Service->>DB: Update Fatura.status = "Paga"
    Service->>DB: Update Fatura.dataPagamento
    Service->>DB: Commit
    API-->>Frontend: 200 OK + updated FaturaDto
    Frontend->>Frontend: Update UI (show "Paga")
```

**Behavior:**
- Only `Status=Aberta` can be paid
- Auto-updates linked `Transacoes` implicitly

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

**Calculated On-the-fly:**
```csharp
var saldo = transacoes
    .Where(t => t.ContaId == contaId)
    .GroupBy(t => t.Tipo)
    .ToDictionary(g => g.Key, g => g.Sum(t => t.Valor));

var receitas = saldo.GetValueOrDefault(TipoTransacao.Receita, 0);
var despesas = saldo.GetValueOrDefault(TipoTransacao.Despesa, 0);
var saldoFinal = receitas - despesas;
```

**Performance Note:** Consider indexing `transacoes(conta_id, tipo)` for large datasets.

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

## 11. Estado de Fatura Transitions

```mermaid
stateDiagram-v2
    [*] --> Aberta: Transaction created
    Aberta --> Fechada: Month ends
    Fechada --> Paga: User pays
    Paga --> [*]: Complete
    
    note right of Aberta
        Transactions can be added/removed
        Total calculated dynamically
    end note
    
    note right of Fechada
        Read-only
        Due date visible
    end note
    
    note right of Paga
        Archived
        Payment date recorded
    end note
```

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
