---
owner: Gustavo
last_reviewed: 2026-05-15
next_review: 2026-08-15
status: CURRENT
---

# Índice da Documentação

Documentação completa do projeto Controle Financeiro.

> **Para começar uma sessão de trabalho com Claude:** ler `../PROMPT_NOVA_SESSAO.md` (na raiz).

---

## Documentação na raiz do repositório

Arquivos que ficam na raiz porque são acessados a cada sessão:

| Arquivo | Propósito |
|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | Convenções gerais, stack, padrões |
| [`../PROMPT_NOVA_SESSAO.md`](../PROMPT_NOVA_SESSAO.md) | Protocolo de início e encerramento de sessão |
| [`../IMPLEMENTATION_STATE.md`](../IMPLEMENTATION_STATE.md) | Estado vivo da issue em execução |
| [`../ISSUES.md`](../ISSUES.md) | Backlog atual (Q3 2026, 4 blocos) |
| [`../PROGRESS.md`](../PROGRESS.md) | Dashboard e histórico de sessões |
| [`../README.md`](../README.md) | README público do projeto |

---

## Documentação geral (`docs/`)

| Arquivo | Quando consultar |
|---|---|
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | Resumo de stack/comandos/padrões — primeira leitura |
| [STANDARDS.md](./STANDARDS.md) | Convenções de código (C#, TS, naming, error handling, paginação) |
| [DATABASE.md](./DATABASE.md) | Schema, ER, delete behavior, descrição das entidades |
| [FLOWS.md](./FLOWS.md) | Fluxos de negócio (transação, parcelamento, fatura) |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Paleta, tipografia, componentes MUI |
| [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) | Padrão de branches, commits, PR, squash merge |
| [COLLABORATION.md](./COLLABORATION.md) | Protocolo de trabalho em dupla (Issues, conflitos, review) |
| [CONTROLLER_TEMPLATE.md](./CONTROLLER_TEMPLATE.md) | Scaffold para criar novo controller |
| [ANALISE_PRODUTO.md](./ANALISE_PRODUTO.md) | Análise crítica de produto (maio/2026) — leitura recomendada para entender o porquê do roadmap atual |

---

## Documentação por feature (`docs/features/`)

Cada feature complexa tem sua própria pasta com spec técnica e UX. Ao iniciar uma feature nova, criar a pasta + `arquitetura.md` + `ux.md` antes de codar.

| Feature | Status | Arquivos |
|---|---|---|
| [parcelamento](./features/parcelamento/) | ✅ Concluída (Q2 2026) | [arquitetura.md](./features/parcelamento/arquitetura.md), [ux.md](./features/parcelamento/ux.md) |
| [familia](./features/familia/) | 🔵 Em visão (Q3 2026) | [visao.md](./features/familia/visao.md) |

---

## Arquivos arquivados (`docs/history/`)

Documentos que cumpriram seu propósito e ficam preservados para consulta histórica:

- [ISSUES_2026Q2.md](./history/ISSUES_2026Q2.md) — Backlog do Q2 2026, todos concluídos
- [PROGRESS_2026Q2.md](./history/PROGRESS_2026Q2.md) — Tracker do Q2 2026
- [IMPLEMENTATION_STATE_2026Q2_parcelamento.md](./history/IMPLEMENTATION_STATE_2026Q2_parcelamento.md) — Estado detalhado das 13 sessões que implementaram o Parcelamento Flexível

---

## Documentação automática (Swagger)

A API tem documentação **100% automática** via Swagger/OpenAPI.

```powershell
cd ControleFinanceiro.Api
dotnet run
# acessar http://localhost:5293/swagger
```

Os endpoints são documentados a partir dos comentários XML dos controllers — manutenção zero fora do código.

---

## Ciclo de revisão de documentação

Cada documento em `docs/` tem frontmatter:

| Campo | Descrição |
|---|---|
| `owner` | Responsável por manter o documento atualizado |
| `last_reviewed` | Data da última revisão |
| `next_review` | Data prevista para próxima revisão (trimestral) |
| `status` | `CURRENT` / `OUTDATED` / `DEPRECATED` |

**Checklist trimestral (owner: Gustavo):**

- [ ] DATABASE.md — schema ainda reflete todas as entidades?
- [ ] FLOWS.md — fluxos ainda correspondem ao código?
- [ ] STANDARDS.md — padrões ainda são seguidos? Algum novo padrão surgiu?
- [ ] QUICK_REFERENCE.md — comandos e contagens (entidades, controllers) atualizados?
- [ ] features/*/visao.md — visão de cada feature reflete decisões atuais?
- [ ] CLAUDE.md (raiz) — arquitetura e referências internas válidas?
- Atualizar `last_reviewed` e `next_review` em cada arquivo revisado
- Marcar `status: OUTDATED` em arquivos que precisem de atenção urgente

**Última revisão geral:** 2026-05-15 (reorganização Q3 + criação de `docs/features/` e `docs/history/`)
