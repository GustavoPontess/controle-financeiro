---
owner: Gustavo
last_reviewed: 2026-05-13
next_review: 2026-08-13
status: CURRENT
---

# Documentation Index

Complete documentation for the Controle Financeiro project.

## 📖 Quick Links

### Setup & Running
- See root `CLAUDE.md` for project overview and running locally

### Development Guides
- **[STANDARDS.md](./STANDARDS.md)** — Code conventions, naming, patterns (C#, React, TypeScript)
- **[DATABASE.md](./DATABASE.md)** — Schema, relationships, entity descriptions
- **[FLOWS.md](./FLOWS.md)** — Data flow diagrams for core business logic

### API Documentation
⚠️ **API.md foi removido** — A documentação é **100% automática via Swagger**

Endpoints são documentados automaticamente:
- Rode: `dotnet run`
- Acesse: `http://localhost:5293/swagger`
- Documentação gera-se a partir dos comentários XML nos controllers

---

## 📐 Architecture at a Glance

```
Frontend (React 19)
    ↓ HTTP/JWT
Backend (.NET 8)
    ↓ EF Core
SQLite Database
```

**Key Files:**
- **CLAUDE.md** (root) — AI assistant guidance, tech stack, patterns
- **Package.json** — Frontend dependencies
- **ControleFinanceiro.Api.csproj** — Backend project config

---

## 🎯 Common Tasks

### Add a New Endpoint

1. Create **Entity** in `Domain/Entities/`
2. Create **DTOs** in `DTOs/[EntityName]/`
3. Create **Service** in `Services/[Entity]Service.cs`
4. Create **Controller** in `Controllers/[Entity]Controller.cs`
5. Create **Migration**: `dotnet ef migrations add Add[Entity]`
6. Update frontend `Services/` with API client
7. Document in this `docs/` folder

See **STANDARDS.md** for patterns and **FLOWS.md** for data flows.

### Fix a Bug

1. Reproduce in dev environment
2. Locate in codebase (use grep or IDE)
3. Write a test if possible
4. Apply fix
5. Run linter: `npm run lint` (frontend) or `dotnet build` (backend)
6. Test end-to-end
7. Update CLAUDE.md if patterns changed

### Deploy

(To be defined — not in current scope)

---

## 📚 Document Purposes

| Document | Purpose | Audience |
|----------|---------|----------|
| **CLAUDE.md** (root) | AI guidance + quick ref | Claude, developers |
| **STANDARDS.md** | Code style & conventions | All developers |
| **API.md** | Endpoint specifications | Backend devs, frontend devs |
| **DATABASE.md** | Schema & relationships | Backend devs, DB admins |
| **FLOWS.md** | Business logic flows | Backend devs, architects |
| **README.md** (this) | Doc navigation | Everyone |

---

## 🔍 Key Concepts

### Data Isolation
Every query filters by `UsuarioId` from JWT claims. **Never** skip this filter.

### Parcelamento (Installments)
Creating 1 transaction with `Parcelas=12` generates 12 database rows, one per installment month.

### Saldo (Balance)
NOT stored; calculated dynamically as `SUM(Receitas) - SUM(Despesas)` per Conta.

### Fatura (Invoice)
Auto-created when credit card transaction is added. Status: Aberta → Fechada → Paga.

### Transferência
Creates 2 implicit transactions: Despesa (origin) + Receita (destination).

---

## 🚀 Quick Start (Dev)

### Backend
```powershell
cd ControleFinanceiro.Api
dotnet restore
dotnet run
# Swagger: http://localhost:5293/swagger
```

### Frontend
```powershell
cd controle-financeiro.web
npm install
npm run dev
# Dev server: http://localhost:5173
```

### Database
```powershell
# Apply migrations
dotnet ef database update

# Create migration
dotnet ef migrations add MigrationName
```

---

## 🐛 Debugging Tips

### Backend
- Use Swagger at `/swagger` to test endpoints
- Enable EF Core logging in `appsettings.Development.json`
- Check `controlefinanceiro.db` with SQLite tools

### Frontend
- React DevTools browser extension
- Network tab to inspect API requests
- Console for JavaScript errors
- VSCode debugger for TypeScript

---

## ⚠️ Known Issues

1. **No Rate Limiting:** Future security concern
2. **No API Versioning:** Issue #7 — endpoints sem versionamento

---

## 📝 Contributing

1. Read **STANDARDS.md** for code style
2. Read **FLOWS.md** to understand the flow
3. Check **API.md** for endpoint contracts
4. Reference **DATABASE.md** for schema
5. Follow patterns in existing code
6. Run linter before committing
7. Write clear commit messages

---

## 📞 Questions?

- Check **CLAUDE.md** for tech stack & patterns
- Check **FLOWS.md** for how data flows
- Check **STANDARDS.md** for coding conventions
- Check **API.md** for endpoint details
- Check **DATABASE.md** for schema details

If still stuck, trace through the code and add documentation!

---

---

## 🔄 Ciclo de Revisão de Documentação

Cada documento em `docs/` possui frontmatter com:

| Campo | Descrição |
|-------|-----------|
| `owner` | Responsável por manter o documento atualizado |
| `last_reviewed` | Data da última revisão |
| `next_review` | Data prevista para próxima revisão (trimestral) |
| `status` | `CURRENT` / `OUTDATED` / `DEPRECATED` |

### Checklist de revisão trimestral (owner: Gustavo)

- [ ] DATABASE.md — schema ainda reflete todas as entidades?
- [ ] FLOWS.md — fluxos ainda correspondem ao código?
- [ ] STANDARDS.md — padrões ainda são seguidos? Algum novo padrão surgiu?
- [ ] README.md (este) — links válidos? Known issues atualizado?
- [ ] CLAUDE.md (raiz) — arquitetura e comandos ainda corretos?
- Atualizar `last_reviewed` e `next_review` em cada arquivo revisado
- Marcar `status: OUTDATED` se o arquivo precisar de atualização urgente

**Last Updated:** 2026-05-13
