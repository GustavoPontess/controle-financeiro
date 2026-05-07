# CLAUDE.md

Guia para Claude trabalhar eficientemente com este repositório. **Leia este arquivo antes de qualquer mudança.**

## Project Overview

Sistema pessoal de controle financeiro focado em **usabilidade**. 
- **Backend:** .NET 8 Web API com SQLite/EF Core
- **Frontend:** React 19 + TypeScript + Vite + Material-UI
- **Banco de Dados:** SQLite com 11 entidades principais
- **Autenticação:** JWT Bearer (HS256, 60min expiration)

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
- **Controllers/** — thin HTTP layer; 12 controllers mapping to each domain area
- **Services/** — all business logic; each controller has a paired service registered as Scoped
- **Domain/Entities/** — EF Core entity models (never exposed directly in responses)
- **Domain/Enums/** — 11 enums (TipoTransacao, Finalidade, TipoConta, MeioPagamento, etc.)
- **DTOs/** — request/response contracts; services map entities ↔ DTOs
- **Infrastructure/AppDbContext.cs** — EF Core DbContext with 11 DbSets and delete behavior configuration
- **Infrastructure/Identity/** — JWT generation and BCrypt password hashing
- **Data/** — seeders: BancoSeeder fetches from BCB (Banco Central do Brasil) live API; CategoriaSeeder populates initial categories

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
- SQLite file: `ControleFinanceiro.Api/controlefinanceiro.db`
- EF Core migrations in `Migrations/`
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

- **⚠️ PORT MISMATCH:** Frontend baseURL (`axiosClient.ts`) é `http://localhost:5296/api` mas backend roda em `5293`. **PRECISA AJUSTAR** quando ambos rodam.
- Delete behavior: `Conta → Transacoes` (cascade), `CartaoCredito → Faturas` (restrict)
- User ID é extraído via `User.FindFirstValue(ClaimTypes.NameIdentifier)` e passado pelos serviços para isolamento de dados
- **API Docs:** Ver `endpoints_access_guide.md` (memória) para como Claude acessa endpoints

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

## Important Notes

- **⚠️ PORT MISMATCH:** Frontend baseURL é `5296` mas backend roda em `5293`
- Delete behavior: `Conta → Transacoes` (cascade), `CartaoCredito → Faturas` (restrict)
- User ID é extraído e passado pelos serviços para isolamento de dados
