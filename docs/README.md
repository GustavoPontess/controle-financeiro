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
| [`../STATE.md`](../STATE.md) | Estado vivo: onde a última sessão parou |
| [`../ROADMAP.md`](../ROADMAP.md) | Backlog vivo (o que fazer a seguir, prioridade) |
| [`../README.md`](../README.md) | README público do projeto |

---

## Documentação geral (`docs/`)

| Arquivo | Quando consultar |
|---|---|
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | Resumo de stack/comandos/padrões — primeira leitura |
| [STANDARDS.md](./STANDARDS.md) | Convenções de código (C#, TS, naming, error handling, paginação) |
| [DATABASE.md](./DATABASE.md) | Schema, ER, delete behavior, descrição das entidades |
| [FLOWS.md](./FLOWS.md) | Fluxos de negócio (transação, parcelamento, fatura) |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Paleta, tipografia, biblioteca Pontes |
| [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) | Padrão de branches, commits, PR, squash merge |
| [RELEASING.md](./RELEASING.md) | Como cortar uma versão (SemVer 0.x, CHANGELOG, tag, release) |
| [CONFORMIDADE_BR.md](./CONFORMIDADE_BR.md) | ⚖️ Índice das fontes autoritativas (OWASP/NIST + LGPD/ANPD/BACEN) — consultar sempre |
| [SEGURANCA_BEST_PRACTICES.md](./SEGURANCA_BEST_PRACTICES.md) | Spec técnico de segurança (OWASP/NIST, verificado) + plano de hardening |
| [AUDITORIA_CODIGO_HERDADO.md](./AUDITORIA_CODIGO_HERDADO.md) | Auditoria do código herdado (3 🔴 + altos) |
| [CONTROLLER_TEMPLATE.md](./CONTROLLER_TEMPLATE.md) | Scaffold para criar novo controller |
| [ANALISE_PRODUTO.md](./ANALISE_PRODUTO.md) | Análise crítica de produto (maio/2026) — leitura recomendada para entender o porquê do roadmap atual |
| [concorrentes/](./concorrentes/) | Análise de concorrentes (Pierre, Despezzas, Monarch, Conta Azul, Bling, Qive) + achados acionáveis |

---

## Documentação por feature (`docs/features/`)

Cada feature complexa tem sua própria pasta com spec técnica e UX. Ao iniciar uma feature nova, criar a pasta + `arquitetura.md` + `ux.md` antes de codar.

| Feature | Status | Arquivos |
|---|---|---|
| [cartao-credito](./features/cartao-credito/) | ✅ Ativo | [regras.md](./features/cartao-credito/regras.md) — ciclo, limite, fatura, pagamento |
| [parcelamento](./features/parcelamento/) | ✅ Concluída (Q2 2026) | [arquitetura.md](./features/parcelamento/arquitetura.md), [ux.md](./features/parcelamento/ux.md) |
| [familia](./features/familia/) | 🔵 Fosso de produto — rateio/papéis/dependentes (ver ROADMAP Lote 2) | [visao.md](./features/familia/visao.md) + sub-1..5 arquitetura |
| [b2b-contadores](./features/b2b-contadores/) | 💡 Visão (ROADMAP Lote 4) | [visao.md](./features/b2b-contadores/visao.md) |
| outras | — | importacao, notificacoes, onboarding, pwa |

---

## Arquivos arquivados (`docs/history/`)

Documentos que cumpriram seu propósito e ficam preservados para consulta histórica. Cada quarter fechado tem seu trio `ISSUES`/`PROGRESS`/`IMPLEMENTATION_STATE`:

- **Q2 2026** — feature Parcelamento. `ISSUES_2026Q2.md`, `PROGRESS_2026Q2.md`, `IMPLEMENTATION_STATE_2026Q2_parcelamento.md`
- **Q3 2026** — higiene + infra + pivot Família. `*_2026Q3.md`
- **Q4 2026** — redesign UX. `*_2026Q4.md`
- **Q5 2026** — refator completo MUI→Pontes + paginação real + personalização. `*_2026Q5.md`
- **BUILD_PLAN_CONCORRENTES.md** — plano original dos achados de concorrentes (absorvido pelo `ROADMAP.md`)

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
