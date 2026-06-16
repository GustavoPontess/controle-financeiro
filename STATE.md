---
owner: Gustavo
last_reviewed: 2026-06-16
status: EM_EXECUCAO
foco: 'Reorg de docs (solo) + auditoria do código herdado'
---

# STATE — onde parei

**Estado vivo da sessão.** O backlog completo vive em [`ROADMAP.md`](ROADMAP.md). Este arquivo é só: o que está em execução agora e qual a próxima ação concreta.

> Atualizar ao fim de toda sessão que mexeu em código/docs. Substitui o antigo `IMPLEMENTATION_STATE.md` (versões Q2-Q5 em `docs/history/`).

---

## Em execução

### Reorg de documentação (branch `chore/reorg-docs-solo`)

Projeto virou **solo** — toda a doc de "trabalho em dupla" estava obsoleta, e o backlog estava espalhado entre `ISSUES.md` (Q5 fechado) e `docs/BUILD_PLAN_CONCORRENTES.md` (lotes ativos). Reorganização:

- [x] Arquivar Q5 (`ISSUES`/`PROGRESS`/`IMPLEMENTATION_STATE` → `docs/history/*_2026Q5.md`)
- [x] Deletar `docs/COLLABORATION.md` (protocolo de dupla)
- [x] Criar `ROADMAP.md` (backlog único, absorve BUILD_PLAN)
- [x] Criar `STATE.md` (este arquivo)
- [ ] Reescrever `PROMPT_NOVA_SESSAO.md` pro modelo solo
- [ ] Atualizar `CLAUDE.md`, `docs/README.md`, `docs/GIT_WORKFLOW.md`
- [ ] Revisar `docs/QUICK_REFERENCE.md` (gravemente stale: dizia SQLite/MUI/11 entidades)
- [ ] Atualizar `.github/` templates (PR + issue)
- [ ] Atualizar memória (regra de issues-dependentes-pro-outro-dev é obsoleta)

### Track paralelo — auditoria do código herdado

Caio-Amarall (39 commits) + Joao Coelho (2) mergearam trabalho substancial na `main`. Sem sócio agora → revisar tudo pra garantir que está correto/seguro. Áreas:
- **Segurança:** auth refresh/reset token (#5), política de senha (#15), CSV formula injection (#121, Joao).
- **Infra:** Docker/compose (#18), CI Actions (#19), Vitest setup (#21), remove SQLite (#114), Playwright E2E (#92).
- **Telas Q5:** Familia (#85), Metas (#86), Limites (#87), Recorrentes (#89), Bancos (#88), redesign auth (#76).

**Próxima ação concreta:** terminar a reorg de docs (itens acima), commitar `chore/reorg-docs-solo`. Depois rodar a auditoria por área e gerar relatório de achados em `docs/AUDITORIA_CODIGO_HERDADO.md`.

---

## Última feature entregue

**1.2 Privacy toggle (ocultar saldo)** — branch `feature/privacy-toggle-ocultar-saldo` (não pushada). Olho global no navbar, `formatMoney` central, persistência localStorage, mascara ao vivo em qualquer tela. 286 testes verdes.
