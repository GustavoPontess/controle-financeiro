# Controle Financeiro - Backend

## Sobre

API RESTful desenvolvida em .NET 8 para gerenciar gastos residenciais.

Funcionalidades:
- Cadastro de pessoas
- Cadastro de categorias
- Registro de transações (receitas e despesas)
- Relatórios consolidados

## Tecnologias

- .NET 8
- ASP.NET Core Web API
- Entity Framework Core
- SQLite
- Swagger

## Estrutura do Projeto

```
ControleFinanceiro.Api/
├── Controllers/     # Endpoints da API
├── Services/        # Regras de negócio
├── Domain/          # Entidades e enums
├── DTOs/            # Objetos de transferência
└── Infrastructure/  # Configuração do banco (DbContext)
```

As entidades não são expostas diretamente. A comunicação usa DTOs.

## Regras de Negócio

### Pessoas
- Id gerado automaticamente (Guid)
- Nome obrigatório (máx. 200 caracteres)
- Idade entre 0 e 120
- Exclusão em cascata (remove transações vinculadas)

### Categorias
- Id gerado automaticamente
- Descrição obrigatória (máx. 400 caracteres)
- Finalidade: 1 = Despesa | 2 = Receita | 3 = Ambas

### Transações
- Id gerado automaticamente
- Descrição obrigatória (máx. 400 caracteres)
- Valor maior que zero
- Tipo: 1 = Despesa | 2 = Receita
- Menores de 18 anos: apenas despesas
- Categoria deve ser compatível com o tipo
- Pessoa e categoria obrigatórias

### Relatórios

**Totais por Pessoa:**
- Lista todas as pessoas
- Exibe: receitas, despesas e saldo por pessoa
- Totais gerais do sistema
- Saldo calculado dinamicamente

## Banco de Dados

- SQLite
- Entity Framework Core
- Migrations para versionamento
- Exclusão em cascata configurada

## Como Executar

1. Restaurar dependências:
```bash
dotnet restore
```

2. Aplicar migrations:
```bash
dotnet ef database update
```

3. Executar:
```bash
dotnet run
```

4. Acessar:
- API: http://localhost:5293
- Swagger: http://localhost:5293/swagger

## Observações

Projeto desenvolvido com:
- Código organizado e legível
- Separação de responsabilidades
- DTOs para comunicação
- Regras de negócio validadas
- Documentação automática via Swagger
- Pronto para integração com o frontend React
