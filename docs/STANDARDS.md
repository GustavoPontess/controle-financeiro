---
owner: Gustavo
last_reviewed: 2026-07-17
next_review: 2026-10-17
status: CURRENT
---

# Code Standards & Conventions

Padrões de código que todo contributor deve seguir para manter consistência.

## Backend (.NET/C#)

### Naming Conventions

| Item | Pattern | Example |
|------|---------|---------|
| **Classes** | PascalCase | `TransacaoService`, `BancoController` |
| **Methods** | PascalCase | `CriarTransacaoAsync`, `ObterPorId` |
| **Parameters** | camelCase | `usuarioId`, `criarTransacaoDto` |
| **Private fields** | _camelCase | `_context`, `_mapper` |
| **Constants** | UPPER_CASE | `TAXA_PADRAO`, `TIMEOUT_MS` |
| **Interfaces** | IPascalCase | `ITransacaoService`, `IRepository` |
| **Enums** | PascalCase | `TipoTransacao`, `StatusFatura` |
| **Enum values** | PascalCase | `Receita`, `Despesa`, `Aberta`, `Paga` |

### File & Folder Structure

```
ControleFinanceiro.Api/
├── Controllers/
│   ├── TransacoesController.cs
│   ├── ContasController.cs
│   └── [other]Controller.cs
├── Services/
│   ├── TransacaoService.cs
│   ├── ContaService.cs
│   └── [other]Service.cs
├── Domain/
│   ├── Entities/
│   │   ├── Transacao.cs
│   │   ├── Conta.cs
│   │   └── ...
│   └── Enums/
│       ├── TipoTransacao.cs
│       └── ...
├── DTOs/
│   ├── Transacao/
│   │   ├── TransacaoDto.cs
│   │   └── CriarTransacaoDto.cs
│   ├── Conta/
│   │   └── ...
│   └── ...
├── Infrastructure/
│   ├── AppDbContext.cs
│   └── Identity/
│       ├── JwtTokenProvider.cs
│       └── PasswordHasher.cs
├── Migrations/
│   ├── 20260303175437_InitialCreate.cs
│   └── ...
└── Data/
    ├── BancoSeeder.cs
    └── CategoriaSeeder.cs
```

**One file per class rule:** Cada classe em seu próprio arquivo.

### Async/Await Pattern

```csharp
// Correct ✓
public async Task<TransacaoDto> CriarAsync(CriarTransacaoDto dto, Guid usuarioId)
{
    var transacao = new Transacao { /* ... */ };
    await _context.Transacoes.AddAsync(transacao);
    await _context.SaveChangesAsync();
    return Map(transacao);
}

// Avoid ✗
public TransacaoDto Criar(CriarTransacaoDto dto) { /* ... */ }
```

**Rules:**
- Use `async/await` for all I/O (DB, API calls)
- Methods should end with `Async` suffix
- Return `Task<T>` or `Task`
- Never use `.Result` or `.Wait()` (deadlock risk)

### Constructor Injection

```csharp
public class TransacaoService
{
    private readonly AppDbContext _context;
    private readonly IMapper _mapper;
    private readonly CategoriaService _categoriaService;

    public TransacaoService(AppDbContext context, IMapper mapper, CategoriaService categoriaService)
    {
        _context = context;
        _mapper = mapper;
        _categoriaService = categoriaService;
    }
}
```

**Rules:**
- Use constructor injection (DI)
- Declare private readonly fields
- Assign in constructor

### Data Isolation Pattern

```csharp
[Authorize]
[HttpGet]
public async Task<ActionResult<IEnumerable<TransacaoDto>>> Listar()
{
    var usuarioId = GetUserId();  // ← Always extract user from JWT
    var transacoes = await _service.ListarAsync(usuarioId);  // ← Pass to service
    return Ok(transacoes);
}

private Guid GetUserId()
{
    var claim = User.FindFirst(ClaimTypes.NameIdentifier);
    if (claim == null || !Guid.TryParse(claim.Value, out var userId))
        throw new UnauthorizedAccessException();
    return userId;
}
```

**Rules:**
- Extract `usuarioId` from JWT in controller
- Pass `usuarioId` to service methods
- Service filters all queries by `usuarioId`
- Never trust user input; always validate

### Error Handling

```csharp
// Correct ✓
[HttpPost]
public async Task<ActionResult<TransacaoDto>> Criar([FromBody] CriarTransacaoDto dto)
{
    try
    {
        var usuarioId = GetUserId();
        var result = await _service.CriarAsync(dto, usuarioId);
        return CreatedAtAction(nameof(BuscarPorId), new { id = result.Id }, result);
    }
    catch (ArgumentException ex)
    {
        return BadRequest(new { message = ex.Message });
    }
    catch (InvalidOperationException ex)
    {
        return BadRequest(new { message = ex.Message });
    }
    catch (Exception ex)
    {
        return StatusCode(500, new { message = "Erro interno" });
    }
}
```

**Rules:**
- Wrap service calls in try-catch
- Catch specific exceptions first
- Return appropriate HTTP status codes
- Log exceptions (if logging enabled)

### EF Core Patterns

```csharp
// Query
var transacao = await _context.Transacoes
    .Include(t => t.Conta)
    .Include(t => t.Categoria)
    .FirstOrDefaultAsync(t => t.Id == id && t.UsuarioId == usuarioId);

// Insert
var transacao = new Transacao { /* ... */ };
await _context.Transacoes.AddAsync(transacao);
await _context.SaveChangesAsync();

// Update
transacao.Descricao = "novo";
_context.Transacoes.Update(transacao);
await _context.SaveChangesAsync();

// Delete
_context.Transacoes.Remove(transacao);
await _context.SaveChangesAsync();
```

**Rules:**
- Always use `async` methods (AddAsync, SaveChangesAsync, etc.)
- Eager load with `Include()` to avoid N+1
- Filter by `usuarioId` always
- One `SaveChangesAsync()` per transaction

---

## Frontend (React/TypeScript)

### Estilização — CSS Modules + CSS variables (PADRÃO OBRIGATÓRIO Q5+) ⭐

> **Decidido na issue #122 (sessão 2026-05-22). Vale daqui em diante para toda tela nova ou refatorada.** Telas legadas (MUI / inline) migram para este padrão quando forem refatoradas.

**Regra de ouro: zero `style={{}}` para cor/fonte/espaçamento de tema. Todo estilo vai em `*.module.css` e lê `var(--pontes-*)`.**

1. **Cada componente/tela tem seu `*.module.css`** ao lado do `.tsx`. Importa `import styles from "./X.module.css"` e usa `className={styles.foo}`. Sem `style={{}}` para layout/cor.
2. **Cor e fonte SEMPRE via CSS vars** `var(--pontes-primary)`, `var(--pontes-text)`, `var(--pontes-bg)`, `var(--pontes-font)`, etc. As vars são injetadas no `:root` pelo `PontesThemeProvider` (e escopadas localmente no `/design-system`). Nunca hex/fonte hardcoded de tema.
   - Feedback semântico: `var(--pontes-success|warning|danger|info)` (+ `*-soft`). Imune à paleta.
   - Hover/foco/estado via `:hover`, `:focus`, e atributos `data-*` (ex.: `data-active`, `data-open`, `data-tone`) — **não** via state JS + re-render.
   - Escurecer/alpha: `color-mix(in srgb, var(--pontes-primary) 90%, #000)` / `... 13%, transparent)`.
3. **Componentes da biblioteca leem as vars sozinhos.** Telas **não** passam mais `p`/`font` para componentes Pontes (`<PontesButton variant="primary">`, sem `p`/`font`). As props `p`/`font` continuam opcionais nos types só para override pontual e compat — não usar em tela.
4. **`useTheme(...)` (`p`/`font`) só sobrevive onde precisa de cor REAL (hex):** atributos de apresentação SVG e gráficos `recharts` (`fill`, `stroke`, `stop-color`, `Cell`, gradientes). `var(--pontes-*)` **não resolve** em atributo SVG — aí passa o hex da paleta. Ver `DashboardPage.tsx` e `HomePage.tsx`.
5. **Inline `style={{}}` permitido SÓ para valor genuinamente dinâmico/runtime:** largura de barra de progresso (`width: %`), cor vinda do banco de dados (`conta.cor`), injeção das vars escopadas no root do `/design-system`, swatches que mostram a própria paleta. Nunca para cor de tema fixa.
6. **Keyframes/animações globais** que são referenciadas por string em `animation:` ficam num `<style>` global (CSS Modules renomeia keyframes e quebra a referência) — ver `HomePage.tsx`.
7. **Boy-scout (obrigatório):** achou `style={{}}` de tema/estático — legado ou recém-introduzido — **arruma na hora** pra CSS Module + `var(--pontes-*)`. Não deixa passar "porque não é meu", não vira dívida técnica. Só não toca no que é exceção legítima da regra 5 (valor dinâmico de runtime).

```tsx
// ✓ Correto — Q5+
import styles from "./MinhaTela.module.css"
export default function MinhaTela() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Olá</h1>
      <PontesButton variant="primary">Salvar</PontesButton>
    </div>
  )
}
```
```css
/* MinhaTela.module.css */
.wrap { display: flex; flex-direction: column; gap: 16px; font-family: var(--pontes-font); }
.title { color: var(--pontes-text); font-size: 28px; font-weight: 700; }
```
```tsx
// ✗ Errado — cor/fonte de tema inline, p/font threading
<div style={{ color: p.text, fontFamily: font }}>
  <PontesButton p={p} font={font} variant="primary">Salvar</PontesButton>
</div>
```

### Validação de formulários (PADRÃO OBRIGATÓRIO) ⭐

**Todo formulário valida por campo e mostra o erro visualmente. Sempre. Usa o mecanismo do Design System — não inventar outro.**

Mecanismo do DS (já existe, não criar nada novo):
- `PontesField error="mensagem"` → mensagem vermelha embaixo do campo.
- `PontesInput` / `PontesSelect` / `PontesGroupedSelect` `invalid` → borda vermelha.

Regras:
1. **Valida antes de submeter e bloqueia o submit se inválido.** `onSubmit`/serviço só é chamado com dados válidos.
2. **Cada campo obrigatório vazio → `error` no `PontesField` + `invalid` no controle.** Nunca deixar submit falhar em silêncio.
3. **Erro de campo é inline (vermelho), nunca toast.** Toast (`PontesToast`) só para sucesso e erro de servidor/save — nunca para "campo faltando".
4. **Erro limpa assim que o usuário mexe no campo** (ex.: `useEffect(() => setErrors({}), [form])` ou limpar a chave no `onChange`).
5. **Mensagem de erro ≠ placeholder** (ex.: placeholder "Selecione a categoria" → erro "Categoria obrigatória"). Evita ambiguidade e facilita teste.
6. **Toast fica acima do modal** (`z-index` do wrapper de toast > overlay do modal) — senão o usuário não vê.
7. **Estado inválido é padrão único do DS** em TODO controle de form (`PontesInput`, `PontesSelect`, `PontesGroupedSelect`, `PontesMoneyInput`, `PontesTextarea`): passa a prop `invalid` → **borda `var(--pontes-danger)` + ring `color-mix(danger 13%)`, sem preencher fundo**. Não inventar variação por componente; todo campo destaca igual. Demo: `/design-system` → "Estado inválido".

Padrão de implementação:

```typescript
const [errors, setErrors] = useState<Record<string, string>>({})
useEffect(() => { setErrors((e) => (Object.keys(e).length ? {} : e)) }, [form]) // limpa ao editar

const validate = (): boolean => {
  const e: Record<string, string> = {}
  if (!form.nome.trim()) e.nome = "Nome obrigatório"
  // ...demais campos
  setErrors(e)
  return Object.keys(e).length === 0
}

const handleSubmit = (ev: React.FormEvent) => {
  ev.preventDefault()
  if (!validate()) return        // bloqueia
  // ...chama serviço
}

// JSX
<PontesField label="Nome" required error={errors.nome}>
  <PontesInput value={form.nome} onChange={...} invalid={!!errors.nome} />
</PontesField>
```

**Teste obrigatório (vitest):** todo form valida em teste — (a) submit vazio mostra os erros e **não** chama `onSubmit`; (b) cada campo obrigatório coberto; (c) erro some ao preencher. Referência: `src/test/components/TransactionForm.test.tsx`.

### Naming Conventions

| Item | Pattern | Example |
|------|---------|---------|
| **Component files** | PascalCase | `TransacaoList.tsx`, `FormConta.tsx` |
| **Component names** | PascalCase | `export const TransacaoList = () => {}` |
| **Hooks** | camelCase | `useAuth()`, `useTransacoes()` |
| **Services** | PascalCase+Service | `TransacaoService.ts`, `ContaService.ts` |
| **Types/Interfaces** | PascalCase | `TransacaoDto`, `CreateTransacaoDto` |
| **Variables** | camelCase | `isLoading`, `userId`, `errorMessage` |
| **Constants** | UPPER_CASE | `API_BASE_URL`, `DEBOUNCE_MS` |

### Folder Structure

```
src/
├── pages/
│   ├── Transacoes/
│   │   ├── index.tsx
│   │   ├── List.tsx
│   │   ├── Form.tsx
│   │   └── Detail.tsx
│   ├── Contas/
│   │   └── ...
│   └── ...
├── components/
│   ├── Navbar.tsx
│   ├── Sidebar.tsx
│   ├── Form/
│   │   ├── TextField.tsx
│   │   └── SelectField.tsx
│   └── ...
├── services/
│   ├── TransacaoService.ts
│   ├── ContaService.ts
│   └── ...
├── contexts/
│   ├── AuthContext.tsx
│   └── ...
├── hooks/
│   ├── useAuth.ts
│   ├── useTransacoes.ts
│   └── ...
├── types/
│   ├── TransacaoDto.ts
│   ├── ContaDto.ts
│   └── ...
├── api/
│   └── axiosClient.ts
├── routes/
│   └── index.tsx
└── App.tsx
```

**Rules:**
- Pages: containers (pages/)
- Components: reusable UI (components/)
- Services: API calls (services/)
- Types: Interfaces (types/)
- One component per file

### React Component Pattern

```typescript
import { useState } from 'react';
import { PontesField, PontesInput, PontesMoneyInput, PontesButton } from '@/components/pontes';
import TransacaoService from '@/services/TransacaoService';
import styles from './TransacaoForm.module.css';

interface Props {
  onSuccess?: () => void;
}

export const TransacaoForm = ({ onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!descricao.trim()) e.descricao = 'Descrição obrigatória';
    if (!valor || Number(valor) <= 0) e.valor = 'Valor deve ser maior que zero';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return; // bloqueia submit se inválido

    setLoading(true);
    try {
      await TransacaoService.criar({ descricao, valor: parseFloat(valor) });
      setDescricao('');
      setValor('');
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <PontesField label="Descrição" error={errors.descricao}>
        <PontesInput
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          invalid={!!errors.descricao}
          disabled={loading}
        />
      </PontesField>

      <PontesField label="Valor" error={errors.valor}>
        <PontesMoneyInput
          value={valor}
          onChange={setValor}
          invalid={!!errors.valor}
          disabled={loading}
        />
      </PontesField>

      <PontesButton type="submit" variant="primary" loading={loading}>
        Criar
      </PontesButton>
    </form>
  );
};
```

**Rules:**
- Use `useState` for component state
- Use `useEffect` for side effects (com cleanup no `return`)
- Valida por campo antes de submeter, bloqueia se inválido (ver "Validação de formulários" acima) — nunca deixar erro de campo silencioso
- Type props with interfaces
- Use componentes da biblioteca Pontes (`@/components/pontes`) — nunca MUI, nunca HTML nativo pra input/select/button
- Destructure props

### Service Pattern

```typescript
import axiosClient from '@/api/axiosClient';
import { TransacaoDto, CreateTransacaoDto } from '@/types';

const TransacaoService = {
  obterTodos: async () => {
    const response = await axiosClient.get<TransacaoDto[]>('/transacoes');
    return response.data;
  },

  obterPorId: async (id: string) => {
    const response = await axiosClient.get<TransacaoDto>(`/transacoes/${id}`);
    return response.data;
  },

  criar: async (dto: CreateTransacaoDto) => {
    const response = await axiosClient.post<TransacaoDto>('/transacoes', dto);
    return response.data;
  },

  atualizar: async (id: string, dto: Partial<CreateTransacaoDto>) => {
    const response = await axiosClient.put<TransacaoDto>(`/transacoes/${id}`, dto);
    return response.data;
  },

  deletar: async (id: string) => {
    await axiosClient.delete(`/transacoes/${id}`);
  },
};

export default TransacaoService;
```

**Rules:**
- One file per resource
- Export as default singleton object
- Type all responses
- Use async/await
- Throw errors (let components handle)

### Type Definitions

```typescript
// types/TransacaoDto.ts
export interface TransacaoDto {
  id: string;
  descricao: string;
  valor: number;
  tipo: 0 | 1; // 0=Receita, 1=Despesa
  categoriaId?: string;
  contaId?: string;
  data: string; // ISO datetime
}

export interface CreateTransacaoDto
  extends Omit<TransacaoDto, 'id'> {}

export interface UpdateTransacaoDto
  extends Partial<CreateTransacaoDto> {}
```

**Rules:**
- Mirror backend DTOs exactly
- Use `|` for union types
- Use `?` for optional fields
- Use `Omit<>` & `Partial<>` utilities
- Export from types/ folder

---

## TypeScript

### Type Safety

```typescript
// Correct ✓
const valor: number = 100;
const dados: TransacaoDto[] = await service.obterTodos();
const opcoes: 'receita' | 'despesa' = 'receita';

// Avoid ✗
const valor: any = 100;
const dados = await service.obterTodos(); // implicit any
```

**Rules:**
- No implicit `any`
- Always type function params & returns
- Use union types for enums
- Strict mode enabled

### Null Checks

```typescript
// Correct ✓
if (usuario === null || usuario === undefined) {
  return null;
}

if (!usuario) {
  return null;
}

if (usuario?.email) {
  console.log(usuario.email);
}

// Avoid ✗
if (usuario) { // false positives
}
```

---

## Git & Commits

### Branch Naming

```
feature/add-transferencias
bugfix/fix-saldo-calculation
docs/update-api-docs
refactor/extract-service-logic
```

### Commit Messages

```
feat: add transaction parcelamento feature

- Create parcela splits
- Auto-create faturas
- Update frontend UI

feat: add transfer between accounts
fix: correct saldo calculation for transactions
docs: update API documentation
refactor: extract validation logic into service
```

**Rules:**
- Start with type: `feat:`, `fix:`, `docs:`, `refactor:`, etc.
- Lowercase after type
- Imperative mood
- Max 50 chars for subject
- Detailed description if complex

---

## Documentation

### Comments

```csharp
// Bad
var x = t.V.Where(a => a.T == 1); // Filter

// Good
// Calculate total expenses for this month
var expenses = transactions
    .Where(t => t.Type == TransactionType.Expense)
    .ToList();
```

**Rules:**
- Explain WHY, not WHAT
- Use clear variable names (self-documenting)
- Comment complex logic
- Update comments when changing code

### Docstrings

```csharp
/// <summary>
/// Create a new transaction or parcelamento.
/// </summary>
/// <param name="dto">Transaction details</param>
/// <param name="usuarioId">User ID for isolation</param>
/// <returns>Created transaction(s)</returns>
/// <exception cref="ArgumentException">If validation fails</exception>
public async Task<Transacao> CriarAsync(CriarTransacaoDto dto, Guid usuarioId)
```

---

## Performance Checklist

- [ ] No N+1 queries (use `Include()`)
- [ ] Indexed frequently-queried columns
- [ ] Async/await all I/O
- [ ] Minimize data transfers (pagination)
- [ ] Cache immutable data (banks, categories)
- [ ] Bundle frontend assets
- [ ] Lazy load routes

---

## Parcelamento Patterns (ETAPA 2+)

### ParcelamentoService Conventions

**ACID Transactions:**
```csharp
public async Task<ParcelamentoDetalheDto> CriarAsync(CriarParcelamentoDto dto, Guid usuarioId)
{
    using var transaction = await _context.Database.BeginTransactionAsync();
    try
    {
        // INSERT Parcelamento + N ParcelasTransacao + FinancialEventLog
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        return MontarDto(...);
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
}
```

**Idempotency via HTTP Header:**
```csharp
// Extract from IHttpContextAccessor
var idempotencyKey = HttpContext.Items["IdempotencyKey"] as string;

// Check existing
var existing = await _financialEventLogService.BuscarPorIdempotencyKeyAsync(usuarioId, idempotencyKey);
if (existing != null)
{
    // Replay response from previous operation
    return await ObterDetalheAsync(existing.EntidadeId, usuarioId);
}

// Proceed if new
```

**Idempotency Filter:**
```csharp
public class IdempotencyAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var idempotencyKey = context.HttpContext.Request.Headers["Idempotency-Key"].FirstOrDefault();
        if (!string.IsNullOrEmpty(idempotencyKey))
        {
            context.HttpContext.Items["IdempotencyKey"] = idempotencyKey;
        }
        await next();
    }
}
```

**Soft Deletes (Parcelamento + ParcelaTransacao):**
```csharp
// Never DELETE physically
// Only UPDATE Ativo = false + CanceladoEm + MotivoCancelamento

// Query always filters:
var parcelamentos = await _context.Parcelamentos
    .Where(p => p.UsuarioId == usuarioId && p.Ativo)
    .ToListAsync();
```

### FinancialEventLog Patterns

**Event Types (Enum):**
```csharp
public enum FinancialEventType
{
    ParcelamentoCriado = 0,
    ParcelamentoCancelado = 1,
    ParcelaPaga = 2,
    ParcelaCancelada = 3,
    LimiteBloqueado = 4,
    LimiteLiberado = 5,
    FaturaPagaTotal = 6,
    FaturaPagaParcial = 7,
}
```

**Registering Events:**
```csharp
await _financialEventLogService.Registrar(
    usuarioId: usuarioId,
    tipo: FinancialEventType.ParcelamentoCriado,
    entidadeId: parcelamento.Id,
    entidadeNome: "Parcelamento",
    correlationId: Guid.NewGuid(),
    payloadJson: JsonSerializer.Serialize(new 
    { 
        parcelamento.Id, 
        parcelamento.QuantidadeParcelas,
        idempotencyKey: dto.IdempotencyKey
    })
);
```

**Idempotency Search:**
```csharp
// Service searches PayloadJson for idempotencyKey
// If found + same type + same entity: return previous result
// Enables replay without re-processing
```

### Limite (Credit Limit) Patterns

**Calculation (NOT Stored):**
```csharp
public class LimiteSnapshot
{
    public decimal LimiteTotal { get; set; }          // CartaoCredito.LimiteTotal
    public decimal LimiteBloqueado { get; set; }      // SUM Parcelamentos.Ativo.ValorComJuros
    public decimal LimiteDisponivel { get; set; }     // LimiteTotal - LimiteBloqueado
    public decimal ExposicaoFuturaPrevisao { get; set; } // Next 3 months (Recorrentes)
}
```

**When to Calculate:**
- Before creating Parcelamento (validate `disponivel >= valorComJuros`)
- After paying Parcela (liberar limite)
- Hangfire RecalcularLimitesJob (hourly)

---

## Testing (Includes ETAPA 9)

### Unit Tests (xUnit)
- LimiteCalculatorService (5 testes)
- ParcelamentoService (5 testes)
- Idempotência (same key = same result)

### Integration Tests (EF InMemory)
- End-to-end parcelamento creation
- Hangfire job scheduling
- Limite bloqueado/liberado

### Coverage
- All happy paths
- Validations (valor>0, parcelas 2-36, categoria, etc.)
- Edge cases (atraso, juros, soft delete)

---

## Hangfire Jobs (ETAPA 8)

| Job | Cron | Behavior |
|-----|------|----------|
| `FaturaFechamentoJob` | 02:00 UTC | EstadoCiclo: Aberta → Fechada |
| `FaturaAtrasoJob` | 02:30 UTC | EstaAtrasada=true, adiciona JurosDeMora+Multa |
| `ExpandirRecorrentesJob` | 03:00 UTC | Janela móvel: materializa mais 3 meses se < 1 mês restante |
| `ExecutarRecorrentesJob` | 03:30 UTC | StatusTransacao: Previsao → Executado (por data) |
| `RecalcularLimitesJob` | Hourly | LimiteBloqueado/Disponivel (não persiste, só calcula) |

**Storage:** In-memory (MVPMat pode migrar para SQLite em prod)

---

## Configuration via Environment Variables

**Objetivo:** Eliminar segredos hardcoded do repositório. JWT secret, database URLs e CORS origins são lidos de variáveis de ambiente via DotNetEnv.

### Setup

1. **Create `.env` file** (ignored by git, local only):
```bash
# ControleFinanceiro.Api/.env
JWT_SECRET=your-super-secret-key-change-this-in-production-minimum-32-characters-long!
JWT_ISSUER=ControleFinanceiro
JWT_AUDIENCE=ControleFinanceiroUsers
JWT_EXPIRATION_MINUTES=60
DATABASE_URL=Data Source=controlefinanceiro.db
CORS_ALLOWED_ORIGINS=http://localhost:5173
ASPNETCORE_ENVIRONMENT=Development
```

2. **Reference `.env.example`** (versioned, shows structure):
```bash
# See .env.example for all available variables
cp ControleFinanceiro.Api/.env.example ControleFinanceiro.Api/.env
# Edit .env with your values
```

### Variables

| Variable | Type | Required | Example | Notes |
|----------|------|----------|---------|-------|
| `JWT_SECRET` | string | ✓ | `your-secret-key-32-chars-min` | Minimum 32 characters, alphanumeric + special recommended |
| `JWT_ISSUER` | string | | `ControleFinanceiro` | Default: ControleFinanceiro |
| `JWT_AUDIENCE` | string | | `ControleFinanceiroUsers` | Default: ControleFinanceiroUsers |
| `JWT_EXPIRATION_MINUTES` | int | | `60` | Default: 60 |
| `DATABASE_URL` | string | ✓ | `Data Source=controlefinanceiro.db` | SQLite or Postgres (future) |
| `CORS_ALLOWED_ORIGINS` | string | | `http://localhost:5173,https://app.example.com` | Comma-separated, no spaces |
| `ASPNETCORE_ENVIRONMENT` | string | | `Development` | Required by .NET |

### Implementation (Program.cs)

```csharp
// Load .env at startup
if (File.Exists(".env"))
{
    Env.Load(".env");
}

// Read with error on missing critical vars
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? throw new InvalidOperationException("JWT_SECRET environment variable is not set");
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? throw new InvalidOperationException("DATABASE_URL environment variable is not set");

// Non-critical with defaults
var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "ControleFinanceiro";
var corsOrigins = (Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS") ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
```

### In Production

- Do NOT commit `.env`
- Set environment variables on host (systemd, Docker, Kubernetes, cloud platform)
- No fallback defaults for critical secrets (fail fast)
- Use `.env.example` as documentation only

### Dependencies

- `DotNetEnv` (NuGet) — reads `.env` into `Environment.GetEnvironmentVariable()`
