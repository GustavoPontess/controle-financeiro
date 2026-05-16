# CLAUDE.md

Guia para Claude trabalhar eficientemente com este repositório. **Leia este arquivo antes de qualquer mudança.**

> **Antes de uma sessão de trabalho:** ler também `PROMPT_NOVA_SESSAO.md` (ponto de entrada do workflow de sessão) e `IMPLEMENTATION_STATE.md` (estado vivo).
>
> **Trabalho em dupla:** o projeto é desenvolvido por dois devs em assíncrono. Antes de fazer mudança em código, ler `docs/COLLABORATION.md` para entender o protocolo de coordenação (GitHub Issues, branches, code review, conflitos em arquivos vivos).

## Project Overview

Produto B2C de finanças pessoais e familiares, com diferencial em **gestão financeira de casais e famílias** (ver `docs/features/familia/visao.md`).

- **Backend:** .NET 8 Web API com EF Core. Provider escolhido em runtime pela connection string: SQLite em dev, Postgres em prod (ver `Infrastructure/DatabaseProvider.cs`)
- **Frontend:** React 19 + TypeScript + Vite + Material-UI v7
- **Banco de dados:** 18 entidades. Provider dinâmico SQLite/Postgres (Issue #16 concluída); `docker-compose.yml` sobe Postgres local
- **Autenticação:** JWT Bearer (HS256) + refresh token (rotação, 7 dias) + reset password (1h)
- **API versionada:** rotas em `/api/v1/...` (via `Asp.Versioning.Mvc`)
- **Jobs:** Hangfire — storage dinâmico: `PostgreSqlStorage` (schema `hangfire`) em prod, `MemoryStorage` em dev SQLite. Dashboard `/hangfire` exige autenticação
- **Observabilidade:** health checks `/health` e `/health/ready`; logs estruturados via Serilog (console JSON + arquivo); correlation ID por request; Sentry ativado por `SENTRY_DSN`
- **Backlog ativo:** ver `ISSUES.md` — 4 blocos sequenciais (A: higiene → B: infra → C: pivot Família → D: UX B2C)

## Commands

### Backend (ControleFinanceiro.Api/)
```powershell
dotnet restore
dotnet build
dotnet run                    # API at http://localhost:5293, Swagger at /swagger
dotnet ef database update     # Apply pending migrations
dotnet ef migrations add <Name>
```

### Frontend (controle-financeiro.web/)
```powershell
npm install
npm run dev     # Dev server at http://localhost:5173
npm run build
npm run lint
```

## Architecture

### Backend Structure
- **Controllers/** — thin HTTP layer; 16 controllers mapping to each domain area
- **Services/** — all business logic; 19 services, each registered Scoped
- **Domain/Entities/** — 18 EF Core entity models (never exposed directly in responses)
- **Domain/Enums/** — vários enums (TipoTransacao, Finalidade, TipoConta, StatusFatura, MeioPagamento, etc.)
- **DTOs/** — request/response contracts; services map entities ↔ DTOs. `DTOs/Common/PagedResult<T>` é o envelope padrão de listagens paginadas.
- **Infrastructure/AppDbContext.cs** — EF Core DbContext com DbSets e configuração de delete behavior
- **Infrastructure/Identity/** — JWT generation + PBKDF2 password hashing + refresh/reset tokens
- **Infrastructure/Middleware/GlobalExceptionHandlerMiddleware.cs** — captura exceções e mapeia para `ErrorResponseDto { code, message }`
- **Data/** — seeders: `BancoSeeder` (BCB live API), `CategoriaSeeder`
- **Jobs/** — Hangfire jobs (`FaturaFechamento`, `FaturaAtraso`, `ExpandirRecorrentes`, `ExecutarRecorrentes`, `RecalcularLimites`)

### Frontend Structure
- **src/api/axiosClient.ts** — single Axios instance; request interceptor injects JWT from localStorage; response interceptor redirects to `/auth/login` on 401
- **src/services/** — one service file per API resource, all using axiosClient
- **src/contexts/** — auth state context
- **src/routes/** — React Router v7 configuration
- **src/types/** — TypeScript interfaces mirroring backend DTOs

### Key Domain Concepts

**Transacao** — core entity. Links to either `Conta` or `CartaoCredito` (not both). Supports `parcelamento` (installments): creating one transaction can generate N installment entries spread across N consecutive `Fatura` cycles.

**Fatura** — invoice grouping for credit card transactions. Created automatically when a credit card transaction is added. Status enum controls open/closed/paid state. Delete behavior is `Restrict` (cannot delete a CartaoCredito with open Faturas).

**Conta** — bank account/wallet. `Saldo` is calculated dynamically as `Receitas - Despesas` from linked transactions, not stored. `IsCarteira` flags the user's default cash wallet.

**Categoria** — has `Finalidade` (Despesa/Receita/Ambas) that must be compatible with the transaction type.

### Auth Flow
- JWT Bearer (HS256), 60-minute expiration, configured in `appsettings.json`
- Claims: `NameIdentifier` (user ID), `Email`, `Name`
- CORS allows only `http://localhost:5173`
- All endpoints except `/auth/login` and `/auth/register` require `[Authorize]`

### Database
- Provider escolhido em runtime via `DATABASE_URL` (`DatabaseProvider.IsPostgres`): `Host=` → Postgres, senão SQLite
- **SQLite (dev):** arquivo `ControleFinanceiro.Api/controlefinanceiro.db`, schema criado via `EnsureCreated` (sem migrations)
- **Postgres (prod):** migrations versionadas em `Migrations/` (geradas para Postgres pelo `AppDbContextFactory`); `docker compose up -d` sobe Postgres local
- `Npgsql.EnableLegacyTimestampBehavior` ativo — `DateTime` mapeia para `timestamp without time zone`
- Some schema patches for the Fatura system are applied via raw DDL in `Program.cs` startup (check for column existence before executing)

## API Documentation

**Documentação é 100% automática** via Swagger/OpenAPI:

1. Adicione comentários XML nos controllers:
   ```csharp
   /// <summary>
   /// Descrição do endpoint
   /// </summary>
   ```

2. Build: `dotnet build`

3. Run: `dotnet run`

4. Acesse: `http://localhost:5293/swagger`

**Resultado:** Swagger gera documentação completa automaticamente. Nenhum arquivo manual.

---

## Important Notes

- Delete behavior: `Conta → Transacoes` (cascade), `CartaoCredito → Faturas` (restrict)
- User ID é extraído via `User.FindFirstValue(ClaimTypes.NameIdentifier)` e passado pelos serviços para isolamento de dados (multi-tenancy manual em cada query)
- **API Docs:** Swagger em `http://localhost:5293/swagger` — gerado a partir dos comentários XML dos controllers
- **Soft delete** em entidades financeiras (`Transacao`, `Parcelamento`, `ParcelaTransacao`, `Recorrente`) via flag `Ativo`. Nunca `_context.Remove()` nessas entidades.
- **Idempotência** obrigatória em endpoints transacionais via header `Idempotency-Key`
- **`FinancialEventLog`** registra mudanças de saldo/limite — usar em qualquer operação que afete saldo

---

## Frontend Patterns & Conventions

### Adicionar Novo Recurso Frontend

```
src/pages/NovaFuncionalidade/
├── index.tsx                  # Container principal
├── Form.tsx                   # Formulário reutilizável
├── List.tsx                   # Lista/tabela
├── Detail.tsx                 # Detalhe de um item
└── styles.ts                  # Estilos Material-UI

src/services/NovaFuncionalidadeService.ts
src/types/NovaFuncionalidade.ts
```

### Padrão de Componente React

```typescript
// Com hooks, forms, Material-UI buttons
import { useState } from 'react';
import { TextField, Button, CircularProgress, Box } from '@mui/material';
import NovaFuncionalidadeService from '@/services/NovaFuncionalidadeService';

export const NovaFuncionalidade = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const handleSubmit = async (formData) => {
    setLoading(true);
    try {
      const result = await NovaFuncionalidadeService.criar(formData);
      setData(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* MUI components */}
    </Box>
  );
};
```

### Service Pattern

```typescript
// src/services/NovaFuncionalidadeService.ts
import axiosClient from '@/api/axiosClient';

const NovaFuncionalidadeService = {
  obterTodos: () => axiosClient.get('/api/nova-funcionalidade'),
  obterPorId: (id: string) => axiosClient.get(`/api/nova-funcionalidade/${id}`),
  criar: (dto) => axiosClient.post('/api/nova-funcionalidade', dto),
  atualizar: (id: string, dto) => axiosClient.put(`/api/nova-funcionalidade/${id}`, dto),
  deletar: (id: string) => axiosClient.delete(`/api/nova-funcionalidade/${id}`),
};

export default NovaFuncionalidadeService;
```

---

## Backend Patterns & Conventions

### Adicionar Nova Entidade

1. **Domain/Entities/NovaEntidade.cs**
```csharp
public class NovaEntidade
{
    public int Id { get; set; }
    public string Nome { get; set; }
    public int UsuarioId { get; set; }
    
    // Relacionamentos
    public Usuario Usuario { get; set; }
}
```

2. **DTOs/NovaEntidade/NovaEntidadeDto.cs & CriarNovaEntidadeDto.cs**

3. **Services/NovaEntidadeService.cs**
```csharp
public class NovaEntidadeService
{
    private readonly AppDbContext _context;

    public async Task<NovaEntidadeDto> ObterPorId(int id, int usuarioId)
    {
        var entidade = await _context.NovaEntidades
            .FirstOrDefaultAsync(x => x.Id == id && x.UsuarioId == usuarioId);
        return _mapper.Map<NovaEntidadeDto>(entidade);
    }

    // Sempre passar usuarioId para isolamento de dados
}
```

4. **Controllers/NovaEntidadeController.cs**
```csharp
[ApiController]
[Route("api/[controller]")]
public class NovaEntidadeController : ControllerBase
{
    private readonly NovaEntidadeService _service;

    [HttpGet("{id}")]
    [Authorize]
    public async Task<ActionResult<NovaEntidadeDto>> GetById(int id)
    {
        var usuarioId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var result = await _service.ObterPorId(id, int.Parse(usuarioId));
        return Ok(result);
    }
}
```

5. **Infrastructure/AppDbContext.cs** — Adicionar DbSet

6. **Criar Migration**
```powershell
dotnet ef migrations add AddNovaEntidade
dotnet ef database update
```

---

## Database Design Principles

- **Data Isolation:** Sempre filtrar por `UsuarioId`
- **Soft Deletes:** Quando aplicável, usar `IsDeleted` flag
- **Calculated Fields:** `Conta.Saldo` é calculado, não armazenado
- **Constraints:** Validações no banco (FK, NOT NULL, unique)
- **Cascade Rules:** Documento em `Infrastructure/AppDbContext`

---

## Common Tasks

### Fix a Bug
1. Localize no código (use `Grep`)
2. Escreva teste se possível
3. Applique fix
4. Verifique com `npm run lint` (frontend) ou `dotnet build` (backend)
5. Atualizar CLAUDE.md se a correção muda padrões

### Add Feature
1. Comece pelo backend (entidade → service → controller)
2. Adicione migrations
3. Implemente frontend (service → componente → página)
4. Documente em `docs/` se for complexo
5. Atualize este arquivo com padrões novos

### Refactor Code
- Mantenha a assinatura pública igual (não quebre dependentes)
- Teste integração após mudanças
- Documente razão da refatoração

---

## Documentation Structure

```
.
├── CLAUDE.md                    ← este arquivo (convenções e padrões)
├── PROMPT_NOVA_SESSAO.md        ← ponto de entrada de cada sessão de trabalho
├── IMPLEMENTATION_STATE.md      ← estado vivo da issue em execução
├── ISSUES.md                    ← backlog atual (Q3 2026, 4 blocos)
├── PROGRESS.md                  ← dashboard de progresso e histórico de sessões
├── README.md                    ← README público do projeto
└── docs/
    ├── README.md                ← índice da documentação
    ├── QUICK_REFERENCE.md       ← resumo de stack/comandos/padrões
    ├── STANDARDS.md             ← convenções de código (naming, error handling, etc.)
    ├── DATABASE.md              ← schema, ER, delete behavior
    ├── FLOWS.md                 ← fluxos de negócio
    ├── DESIGN_SYSTEM.md         ← paleta, tipografia, componentes MUI
    ├── GIT_WORKFLOW.md          ← padrão de branches e commits
    ├── CONTROLLER_TEMPLATE.md   ← scaffold de controller novo
    ├── ANALISE_PRODUTO.md       ← análise crítica de produto (maio/2026)
    ├── features/                ← uma pasta por feature
    │   ├── parcelamento/        ← (concluída em Q2 2026)
    │   │   ├── arquitetura.md
    │   │   └── ux.md
    │   └── familia/             ← (próximo grande pivot)
    │       └── visao.md
    └── history/                 ← documentos arquivados
        ├── ISSUES_2026Q2.md
        ├── PROGRESS_2026Q2.md
        └── IMPLEMENTATION_STATE_2026Q2_parcelamento.md
```

**Princípio:** documentação por feature mora em `docs/features/<nome>/`. Quando uma feature complexa for iniciada, criar pelo menos `arquitetura.md` (spec técnica) e `ux.md` (mockups e copy) dentro da pasta da feature.

**Manutenção:** ao fim de cada sessão que mudou padrões, schema ou fluxo, atualizar o doc correspondente — checklist em `PROMPT_NOVA_SESSAO.md` seção 5.
