# Controle Financeiro

[![CI](https://github.com/GustavoPontess/controle-financeiro/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/GustavoPontess/controle-financeiro/actions/workflows/ci.yml)

Sistema de controle de gastos residenciais desenvolvido como projeto full-stack.

## Sobre o Projeto

Este é um sistema para gerenciamento financeiro pessoal com as seguintes funcionalidades:

- Cadastro e gerenciamento de pessoas
- Criação de categorias de receitas e despesas
- Registro de transações financeiras
- Relatórios com totais e saldo por pessoa

## Estrutura

O projeto está dividido em dois repositórios independentes:

```
controle-financeiro/
├── ControleFinanceiro.Api/     # Backend (.NET 8)
└── controle-financeiro.web/    # Frontend (React + TypeScript)
```

## Tecnologias Utilizadas

**Backend:**
- .NET 8 Web API
- Entity Framework Core
- SQLite
- Swagger

**Frontend:**
- React 19 com TypeScript
- Material-UI
- React Router
- Axios
- Vite

## Como Executar

### Pré-requisitos
- .NET 8 SDK
- Node.js 18+

### Backend

```bash
cd ControleFinanceiro.Api
dotnet restore
dotnet ef database update
dotnet run
```

### Frontend

```bash
cd controle-financeiro.web
npm install
npm run dev
```

### Acessos
- Frontend: http://localhost:5173
- API: http://localhost:5293
- Swagger: http://localhost:5293/swagger

## Documentação

Cada parte do projeto possui documentação detalhada:

- [Backend](./ControleFinanceiro.Api/README.md) - Regras de negócio e endpoints da API
- [Frontend](./controle-financeiro.web/README.md) - Estrutura de componentes e páginas

## Funcionalidades Implementadas

### Pessoas
- CRUD completo
- Validação de idade (0-120 anos)
- Menores de 18 anos só podem registrar despesas
- Exclusão remove transações vinculadas

### Categorias
- CRUD completo
- Três tipos de finalidade: Despesa, Receita ou Ambas
- Validação de vínculo com transações

### Transações
- Registro de receitas e despesas
- Validação de compatibilidade entre tipo e categoria
- Restrições baseadas na idade da pessoa
- Vinculação obrigatória com pessoa e categoria

### Relatórios
- Totais por pessoa (receitas, despesas, saldo)
- Totais gerais do sistema
- Saldo calculado dinamicamente

## Observações

O projeto foi desenvolvido seguindo boas práticas de separação de responsabilidades, com validações tanto no backend quanto no frontend, e documentação via Swagger para facilitar testes da API.