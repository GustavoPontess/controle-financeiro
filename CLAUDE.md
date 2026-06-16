# CLAUDE.md

Guia para Claude trabalhar eficientemente com este repositório. **Leia este arquivo antes de qualquer mudança.**

> **Antes de uma sessão de trabalho:** ler `PROMPT_NOVA_SESSAO.md` (ponto de entrada do workflow de sessão), `STATE.md` (onde a última sessão parou) e `ROADMAP.md` (backlog vivo).
>
> **Projeto solo** (Gustavo). Sem coordenação de dupla. `gh issue` é opcional pra rastrear trabalho, sem assignee de terceiros.

## Project Overview

Produto B2C de finanças pessoais e familiares, com diferencial em **gestão financeira de casais e famílias** (ver `docs/features/familia/visao.md`).

- **Backend:** .NET 8 Web API com EF Core. **Dev e prod usam Postgres** (paridade dev/prod, via `docker compose up -d postgres`). Provider escolhido em runtime pela connection string (`Infrastructure/DatabaseProvider.cs`); SQLite continua suportado como fallback opcional sem Docker
- **Frontend:** React 19 + TypeScript + Vite + biblioteca própria **Pontes** (`src/components/pontes/`). **Zero MUI** — purgado no PR #166
- **Banco de dados:** 18 entidades. Provider dinâmico SQLite/Postgres (Issue #16 concluída); `docker-compose.yml` sobe Postgres local
- **Autenticação:** JWT Bearer (HS256) + refresh token (rotação, 7 dias) + reset password (1h)
- **API versionada:** rotas em `/api/v1/...` (via `Asp.Versioning.Mvc`)
- **Jobs:** Hangfire — storage dinâmico: `PostgreSqlStorage` (schema `hangfire`) em prod, `MemoryStorage` em dev SQLite. Dashboard `/hangfire` exige autenticação
- **Observabilidade:** health checks `/health` e `/health/ready`; logs estruturados via Serilog (console JSON + arquivo); correlation ID por request; Sentry ativado por `SENTRY_DSN`
- **Backlog ativo:** ver `ROADMAP.md` — features dos achados de concorrentes (Lotes 1-5) + fosso família. Estado granular em `STATE.md`

## Commands

### Backend (ControleFinanceiro.Api/)
```powershell
docker compose up -d postgres # Sobe o Postgres de dev (rodar uma vez)
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
- **src/api/axiosConfig.ts** — single Axios instance; request interceptor injects CSRF token; response interceptor redirects to `/auth/login` on 401 (exceto em paths públicos: `/auth/`, `/site`, `/design-system`, `/logo-concepts`)
- **src/services/** — one service file per API resource, all using axiosClient
- **src/contexts/** — auth state context
- **src/routes/** — React Router v7 configuration
- **src/types/** — TypeScript interfaces mirroring backend DTOs
- **src/components/Logo/Logo.tsx** — logo oficial Pontes (conceito 20). Props: `color`, `size`, `variant` ("full" | "wordmark" | "mark"). Fonte da marca: Plus Jakarta Sans (fixa, global em `index.html`).
- **src/components/pontes/** — ⭐ **Biblioteca oficial e ÚNICA fonte de UI.** 37+ componentes (`PontesButton`, `PontesField`, `PontesInput`, `PontesMoneyInput`, `PontesSelect` (busca default + auto-placement), `PontesDateInput` (popover do PontesDatePicker), `PontesModal`, `PontesDialog`, `PontesNavbar`, `PontesFooter`, `PontesBankBadge`, `PontesStatCard` (com `tone`), `PontesLogo`, etc) + tokens em `theme.ts` (15 paletas, 7 fontes, spacing, radii, shadows, semantic). Import via barrel `@/components/pontes`. **Todas as telas importam SOMENTE daqui.** Ícones via `lucide-react` (14-16px / strokeWidth 2.5). Demo: rota `/design-system`. Componentes novos reutilizáveis (2+ telas) **DEVEM** ser adicionados aqui — regra detalhada em `PROMPT_NOVA_SESSAO.md` §5.
- **src/components/Auth/** — `RootRoute.tsx` + `ProtectedRoute.tsx` (lógica de rota, não UI). Únicos arquivos fora de `pontes/` em `src/components/` desde a purga do PR #166 (sessão 2026-05-29) que apagou todo o legado (`CustomButton`, `BackButton`, MUI direto, `tokens.ts` antigo) e desinstalou `@mui` completamente (`-212 KiB` no bundle).
- **src/pages/Site/** — todas as páginas públicas do site institucional (HomePage, CouplesPage, ContadoresPage, RecursosPage, SobrePage). Rotas `/`, `/casais`, `/contadores`, `/recursos`, `/sobre`.
- **src/pages/DesignSystem/** — showroom da biblioteca em rota dedicada `/design-system`, com paleta + fonte trocáveis ao vivo.
- **src/pages/Auth/, Dashboard/, Transactions/, etc** — telas internas autenticadas, todas refatoradas Q5 (CSS Modules + var(--pontes-*) + PontesField validation + zero MUI).

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

### Estilização — CSS Modules + CSS variables (PADRÃO OBRIGATÓRIO Q5+) ⭐

**Decidido na #122. Daqui em diante, toda tela nova ou refatorada segue:**

- **Zero `style={{}}` para cor/fonte/tema.** Estilo vai em `*.module.css` ao lado do `.tsx` (`import styles from "./X.module.css"`, `className={styles.foo}`).
- **Cor/fonte SEMPRE via `var(--pontes-*)`** (`--pontes-primary`, `--pontes-text`, `--pontes-bg`, `--pontes-font`, semânticas `--pontes-success|warning|danger|info`). Vars injetadas no `:root` pelo `PontesThemeProvider`. Nunca hex/fonte hardcoded de tema.
- **Telas não passam mais `p`/`font` pros componentes Pontes** — eles leem as vars sozinhos (`<PontesButton variant="primary">`). Props `p`/`font` continuam opcionais só pra override/compat.
- **`usePontesTheme()`/`useSiteTheme()` só onde precisa de cor REAL (hex):** atributos SVG e `recharts` (`fill`/`stroke`/`Cell`/gradiente) — `var()` não resolve em atributo SVG. Ex.: `DashboardPage`, `HomePage`.
- **Estado → CSS:** hover/foco via `:hover`/`:focus`, ativo/aberto via `data-*`, não state JS.
- **Inline só pra valor dinâmico runtime:** `width: %`, cor do banco (`conta.cor`), vars escopadas do `/design-system`.
- **Boy-scout (obrigatório):** achou `style={{}}` de tema/estático (legado ou novo), arruma na hora pra CSS Module — não deixa virar dívida técnica.

Detalhe completo + exemplos em `docs/STANDARDS.md` → "Estilização — CSS Modules + CSS variables".

### Validação de formulários (PADRÃO OBRIGATÓRIO) ⭐

Todo form valida por campo e mostra erro **visual** via DS: `PontesField error="..."` + `invalid` no controle. Valida antes de submeter e **bloqueia** se inválido; erro de campo é inline vermelho (nunca toast — toast só sucesso/erro de servidor); erro limpa ao editar; mensagem ≠ placeholder; toast acima do modal. Teste obrigatório (submit vazio bloqueia + mostra erros). Detalhe + snippet: `docs/STANDARDS.md` → "Validação de formulários". Referência viva: `src/test/components/TransactionForm.test.tsx`.

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
├── STATE.md                     ← estado vivo: onde a última sessão parou
├── ROADMAP.md                   ← backlog vivo (o que fazer a seguir, prioridade)
├── README.md                    ← README público do projeto
└── docs/
    ├── README.md                ← índice da documentação
    ├── QUICK_REFERENCE.md       ← resumo de stack/comandos/padrões
    ├── STANDARDS.md             ← convenções de código (naming, error handling, etc.)
    ├── DATABASE.md              ← schema, ER, delete behavior
    ├── FLOWS.md                 ← fluxos de negócio
    ├── DESIGN_SYSTEM.md         ← paleta, tipografia, biblioteca Pontes
    ├── GIT_WORKFLOW.md          ← padrão de branches e commits
    ├── CONTROLLER_TEMPLATE.md   ← scaffold de controller novo
    ├── ANALISE_PRODUTO.md       ← análise crítica de produto (maio/2026)
    ├── concorrentes/            ← análise de concorrentes (Pierre, Despezzas, Monarch, etc.)
    ├── features/                ← uma pasta por feature
    │   ├── parcelamento/        ← (concluída em Q2 2026)
    │   ├── familia/             ← visão do fosso (rateio/papéis/dependentes)
    │   │   └── visao.md
    │   ├── b2b-contadores/      ← visão do eixo PJ/contador
    │   ├── cartao-credito/      ← regras de negócio
    │   │   └── regras.md
    │   └── redesign-ux/         ← visão e concorrentes (Q4)
    ├── referencias/             ← prints de concorrentes + iterações de logo (gitignored)
    └── history/                 ← documentos arquivados (por quarter Q2-Q5)
        └── {ISSUES,PROGRESS,IMPLEMENTATION_STATE}_2026Q{2,3,4,5}.md + BUILD_PLAN_CONCORRENTES.md
```

**Princípio:** documentação por feature mora em `docs/features/<nome>/`. Quando uma feature complexa for iniciada, criar pelo menos `arquitetura.md` (spec técnica) e `ux.md` (mockups e copy) dentro da pasta da feature.

**Manutenção:** ao fim de cada sessão que mudou padrões, schema ou fluxo, atualizar o doc correspondente — checklist em `PROMPT_NOVA_SESSAO.md` seção 9.
