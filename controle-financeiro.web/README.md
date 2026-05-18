# Controle Financeiro - Frontend

## Sobre

Interface web desenvolvida em React 19 com TypeScript para o sistema de controle de gastos.

Funcionalidades:
- Gerenciar pessoas
- Criar categorias
- Registrar transações
- Visualizar relatórios

## Tecnologias

- React 19
- TypeScript
- Material-UI (MUI) v7
- React Router v7
- Axios
- Vite
- ESLint

## Estrutura do Projeto

```
src/
├── api/            # Configuração Axios
├── components/     # Componentes reutilizáveis
├── layouts/        # Layout padrão
├── pages/          # Páginas (Categories, People, Transactions, Reports)
├── routes/         # Configuração de rotas
├── services/       # Serviços da API
├── styles/         # Estilos globais
├── types/          # Tipos TypeScript
├── App.tsx
└── main.tsx
```

## Como Executar

### Pré-requisitos
- Node.js 18+
- Backend rodando em `http://localhost:5293`

### Instalação

1. Instalar dependências:
```bash
npm install
```

2. Iniciar desenvolvimento:
```bash
npm run dev
```

3. Acessar:
```
http://localhost:5173
```

### Scripts
```bash
npm run dev            # Servidor de desenvolvimento
npm run build          # Build de produção
npm run preview        # Preview do build
npm run lint           # Executa linter
npm run test           # Testes (Vitest)
npm run snapshot       # Atlas Playwright das telas (ver Redesign UX)
npm run monarch:record # Captura sessão Monarch Money (ver Redesign UX)
```

## Ferramentas de redesign (ciclo Q4)

### `npm run snapshot` — Atlas Playwright (#59)

Varre todas as rotas do app e gera screenshots full-page em desktop
(1440x900) e mobile (390x844). Baseline visual para o redesign.

Pré-requisitos: backend e frontend rodando, e um usuário de teste.

Saída em `screenshots/atlas/{desktop,mobile}/<rota>.png` (gitignored).

Variáveis de ambiente opcionais: `SNAPSHOT_BASE_URL` (default
`http://localhost:5173`), `SNAPSHOT_EMAIL` (default `dev@controle.test`),
`SNAPSHOT_PASSWORD` (default `Dev@123456`).

Crie o usuário de teste uma vez via API:
```bash
curl -X POST http://localhost:5293/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@controle.test","nome":"Dev Atlas","password":"Dev@123456","confirmPassword":"Dev@123456"}'
```

### `npm run monarch:record` — Monarch Session Recorder (#60)

Abre um navegador persistente e captura automaticamente cada tela visitada
(screenshot, HTML, CSS, design tokens) enquanto o usuário navega o Monarch
Money. Logue no browser que abrir, navegue à vontade, feche quando terminar.
Saída em `docs/features/redesign-ux/monarch-session/` (gitignored); o login
persiste entre runs (`.playwright-monarch-profile/`).

Por padrão usa o Chromium do Playwright. Para usar o Google Chrome
instalado (dispensa `npx playwright install chromium`):

```bash
MONARCH_CHANNEL=chrome npm run monarch:record
```

## Funcionalidades

### Pessoas
- Listagem, cadastro e edição
- Validação de idade (0-120 anos)
- Indicação visual para menores de 18
- Exclusão com confirmação

### Categorias
- Tabela de categorias
- Criação com finalidade (Despesa/Receita/Ambas)
- Validação de vínculos

### Transações
- Registro de receitas e despesas
- Seleção de pessoa e categoria
- Validação de compatibilidade
- Formatação monetária
- Restrição para menores de 18 anos

### Relatórios
- Resumo por pessoa
- Totais gerais do sistema
- Cálculo de saldos

## Integração com a API

**Axios configurado:**
```typescript
baseURL: 'http://localhost:5293/api'
```

**Serviços:**
- `categoryService.ts`
- `personService.ts`
- `transactionService.ts`
- `reportService.ts`

## Componentes

**Layout:**
- Default (Navbar + Sidebar)

**Reutilizáveis:**
- EmptyState
- Navbar
- Sidebar

**Domínio:**
- CategoriesTable
- CategoryForm
- PersonForm
- TransactionForm

## Boas Práticas

- Tipagem TypeScript
- Separação de responsabilidades
- Componentização
- React Hooks
- Validações frontend/backend
- Feedback visual

## Observações

Certifique-se de que:
1. Backend está em `http://localhost:5293`
2. Banco migrado: `dotnet ef database update`
3. CORS configurado

Veja [README do Backend](../ControleFinanceiro.Api/README.md) para detalhes.