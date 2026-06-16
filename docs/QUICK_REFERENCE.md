# Quick Reference — Controle Financeiro

**Leia isto PRIMEIRO. Links para docs detalhadas no final.**

---

## 🏗️ Stack

- **Backend:** .NET 8, C#, EF Core, **Postgres** (provider dinâmico; SQLite fallback sem Docker), JWT + refresh token
- **Frontend:** React 19, TypeScript, Vite, **biblioteca Pontes** (`src/components/pontes/`) — **zero MUI** (purgado PR #166), CSS Modules + `var(--pontes-*)`
- **DB:** Postgres via `docker compose up -d postgres` (dev e prod). Provider escolhido em runtime por `DATABASE_URL`
- **Auth:** JWT Bearer (HS256, 60min) + refresh token (rotação, 7 dias) + reset password (1h)
- **API:** versionada em `/api/v1/...`; jobs via Hangfire; observabilidade `/health` + Serilog

---

## 🚀 Running

```powershell
# Backend (http://localhost:5293, Swagger at /swagger)
cd ControleFinanceiro.Api
dotnet run

# Frontend (http://localhost:5173)
cd controle-financeiro.web
npm run dev

# API versionada: rotas em /api/v1/... (configurado globalmente)
```

---

## 📁 Project Structure

```
ControleFinanceiro.Api/
├── Controllers/          # 16 thin HTTP layers
├── Services/             # Business logic (one per entity)
├── Domain/
│   ├── Entities/         # EF Core models
│   └── Enums/            # 11 enums (TipoTransacao, StatusFatura, etc)
├── DTOs/                 # Request/response contracts
├── Infrastructure/
│   ├── AppDbContext.cs   # EF DbContext + migrations
│   └── Identity/         # JWT + PBKDF2 + refresh/reset tokens
└── Data/                 # Seeders (Banco, Categoria)

controle-financeiro.web/
├── src/pages/            # Page containers (Site/ público + internas autenticadas)
├── src/components/pontes/ # ⭐ Biblioteca Pontes — ÚNICA fonte de UI (37+ componentes)
├── src/components/       # Só infra: Logo/, Auth/ (rotas), Navbar/, Sidebar/, Pwa/
├── src/services/         # API clients (axiosClient)
├── src/types/            # DTOs (mirror backend)
├── src/api/axiosConfig.ts # Axios + JWT/CSRF interceptor
└── src/routes/           # React Router v7 config
```

> **Regra:** toda UI vem de `@/components/pontes`. Estilo em `*.module.css` com `var(--pontes-*)`. Detalhes em `docs/STANDARDS.md` e `PROMPT_NOVA_SESSAO.md` §5-6.

---

## 🎯 Key Concepts (MUST KNOW)

| Concept | Definition | Key Notes |
|---------|-----------|-----------|
| **Transacao** | Core entity. Links to Conta OR CartaoCredito (never both) | Supports parcelamento (installments) |
| **Parcelamento** | Create 1 txn with Parcelas=12 → generates 12 DB rows | Each with NumeroParcela (1..12) |
| **Fatura** | Auto-created invoice for credit card. Status: Aberta→Fechada→Paga | Delete CartaoCredito RESTRICTED if Fatura open |
| **Conta** | Bank account/wallet. Saldo = SUM(Receitas) - SUM(Despesas) | Saldo NOT stored; calculated on-the-fly |
| **Categoria** | Has Finalidade (Despesa/Receita/Ambas) matching TipoTransacao | Validação ao criar transação |
| **Transferencia** | Between user's own accounts. Creates 2 implicit txns (Despesa + Receita) | Contabiliza ambas contas |

---

## 🔐 Data Isolation (CRITICAL)

**Every query filters by `UsuarioId`:**

```csharp
// Controller: Extract userId from JWT
var usuarioId = User.FindFirst(ClaimTypes.NameIdentifier).Value;

// Service: Pass to ALL queries
var transacoes = await _context.Transacoes
    .Where(t => t.UsuarioId == usuarioId)  // ← NEVER omit this
    .ToListAsync();
```

**NEVER trust user input for filtering.**

---

## 📋 Entidades (18 no total — schema completo em `DATABASE.md`)

Núcleo:

1. **Usuario** — Auth + user data
2. **Conta** — Bank accounts/wallets (Saldo calculado)
3. **Banco** — Banks (synced from BCB API)
4. **CartaoCredito** — Credit cards
5. **Transacao** — Transactions (core)
6. **Categoria** / **Subcategoria** — Expense/income categories
7. **Fatura** — Credit card invoices (auto-created)
8. **Transferencia** — Inter-account transfers
9. **Recorrente** — Recurring expenses/income
10. **Emprestimo** — Loan tracking
11. **Parcelamento** / **ParcelaTransacao** — installments
12. **Familia** / **Meta** / **Orcamento** / **FinancialEventLog** / etc.

> Lista completa e relacionamentos: `DATABASE.md`.

---

## 🔤 Naming Conventions

### Backend (C#)
| Type | Pattern | Example |
|------|---------|---------|
| Classes | PascalCase | `TransacaoService`, `ContasController` |
| Methods | PascalCase + Async | `CriarTransacaoAsync`, `ObterPorId` |
| Params | camelCase | `usuarioId`, `criarTransacaoDto` |
| Private fields | _camelCase | `_context`, `_mapper` |
| Enums | PascalCase | `TipoTransacao`, `StatusFatura` |

### Frontend (React/TS)
| Type | Pattern | Example |
|------|---------|---------|
| Components | PascalCase | `TransacaoForm.tsx`, `ContaList.tsx` |
| Services | [Entity]Service | `TransacaoService.ts` |
| Types | PascalCase | `TransacaoDto`, `CreateTransacaoDto` |
| Variables | camelCase | `isLoading`, `userId` |

---

## 💻 Code Patterns

### Backend Service
```csharp
public class TransacaoService
{
    private readonly AppDbContext _context;
    public TransacaoService(AppDbContext context) => _context = context;
    
    public async Task<TransacaoDto> CriarAsync(CriarTransacaoDto dto, Guid usuarioId)
    {
        var txn = new Transacao { /* map from dto */ };
        await _context.Transacoes.AddAsync(txn);
        await _context.SaveChangesAsync();
        return Map(txn);
    }
}
```

### Backend Controller
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TransacoesController : ControllerBase
{
    private Guid GetUserId() => 
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);
    
    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarTransacaoDto dto)
    {
        var usuarioId = GetUserId();
        var result = await _service.CriarAsync(dto, usuarioId);
        return CreatedAtAction(nameof(BuscarPorId), new { id = result.Id }, result);
    }
}
```

### Frontend Service
```typescript
const TransacaoService = {
  obterTodos: () => axiosClient.get<TransacaoDto[]>('/transacoes'),
  criar: (dto: CreateTransacaoDto) => axiosClient.post('/transacoes', dto),
};
export default TransacaoService;
```

### Frontend Component (biblioteca Pontes — zero MUI)
```typescript
import { PontesField, PontesInput, PontesButton } from "@/components/pontes";
import styles from "./TransacaoForm.module.css";

export const TransacaoForm = () => {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null); // erro por campo, inline

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) { setErro("Campo obrigatório"); return; } // valida ANTES, bloqueia
    setLoading(true);
    try { await TransacaoService.criar(formData); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <PontesField label="Valor" error={erro ?? undefined}>
        <PontesInput invalid={!!erro} onChange={() => setErro(null)} />
      </PontesField>
      <PontesButton variant="primary" loading={loading}>Salvar</PontesButton>
    </form>
  );
};
```

---

## 🗄️ Database

**18 tabelas, todas com UsuarioId para isolamento:**

Key relationships:
- `Conta` ← has many → `Transacao` (cascade delete)
- `CartaoCredito` ← has many → `Fatura` (restrict delete)
- `Fatura` ← has many → `Transacao` (cascade delete)
- `Categoria` ← has many → `Transacao` (no delete if has txns)

**Schema:** See `docs/DATABASE.md` for ER diagram + full specs

---

## 📡 API Documentation

**Documentação 100% automática via Swagger/OpenAPI**

```powershell
dotnet run
# → http://localhost:5293/swagger
```

**16 controllers com endpoints documentados:**
- Auth (register, login, me, profile, change-password)
- Transacoes (CRUD + parcelamento)
- Contas (CRUD)
- CartoesCreditito (CRUD)
- Faturas (listar, pagar)
- Categorias (CRUD)
- Transferencias (GET, POST)
- Bancos (GET — synced from BCB)
- Recorrentes (CRUD)
- Emprestimos (CRUD)
- Dashboard (/resumo)
- Relatorios (/categoria-mes)

**Documentação está no CÓDIGO** — comentários XML dos controllers
**Swagger gera automaticamente** — sem arquivo manual para manter

---

## 🔄 Common Flows

1. **Register/Login** → JWT stored in localStorage → Interceptor injects on every request
2. **Create Transaction (à vista)** → Create 1 Transacao row → Update Conta.saldo (calculated)
3. **Create Transaction (parcelada)** → Create 12 Transacao rows → Auto-create 12 Faturas → Each links to its month
4. **Pay Invoice** → Update Fatura.status to "Paga" → Done
5. **Transfer Between Accounts** → Create 1 Transferencia row → Creates 2 implicit Transacoes (Despesa + Receita)

**Detailed flows:** See `docs/FLOWS.md` with sequence diagrams

---

## ⚡ Common Commands

```powershell
# Backend
dotnet restore
dotnet build
dotnet run
dotnet ef migrations add MigrationName
dotnet ef database update

# Frontend
npm install
npm run dev
npm run build
npm run lint

# Git
git add .
git commit -m "feat: description"
git push origin feature-branch
```

---

## 🔗 Full Documentation

| Doc | Purpose | When to Read |
|-----|---------|-------------|
| **CLAUDE.md** (root) | Tech stack, architecture, patterns | First time setup |
| **docs/STANDARDS.md** | Code conventions, naming, git | Before writing code |
| **Swagger** (`/swagger`) | All endpoints + examples | When implementing frontend or testing |
| **docs/DATABASE.md** | Schema + ER diagram | When working with data |
| **docs/FLOWS.md** | Business logic sequences | When understanding how features work |
| **docs/README.md** | Doc index | Navigation |

---

## ⚠️ Important Notes

1. **API versionada:** todas as rotas em `/api/v1/...` (configurado globalmente em `Program.cs`)
2. **Delete behavior:** Contas cascade (txns deleted), Cartões restrict (can't delete if open Faturas)
3. **Soft delete obrigatório** em entidades financeiras (`Transacao`, `Parcelamento`, `ParcelaTransacao`, `Recorrente`) via flag `Ativo`
4. **Background jobs:** 5 jobs Hangfire (`FaturaFechamento`, `FaturaAtraso`, `ExpandirRecorrentes`, `ExecutarRecorrentes`, `RecalcularLimites`). Storage dinâmico: `PostgreSqlStorage` em prod, `MemoryStorage` em dev SQLite
5. **Backlog atual:** ver `../ROADMAP.md`. Estado vivo em `../STATE.md`

---

## 🎯 Adding a New Feature (Quick Checklist)

- [ ] Create Entity in `Domain/Entities/`
- [ ] Create DTOs in `DTOs/[Entity]/`
- [ ] Create Service in `Services/[Entity]Service.cs`
- [ ] Create Controller in `Controllers/[Entity]Controller.cs`
- [ ] Register Service in `Program.cs`
- [ ] Create Migration: `dotnet ef migrations add Add[Entity]`
- [ ] Create Frontend Service in `src/services/`
- [ ] Create Frontend Types in `src/types/`
- [ ] Create Frontend Components in `src/pages/[Entity]/`
- [ ] Test end-to-end
- [ ] Update docs if needed

---

**Keep this open while developing. Links to detailed docs above.**
