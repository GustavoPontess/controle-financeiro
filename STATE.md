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

### Auditoria do código herdado — ✅ CONCLUÍDA

Varredura completa dos 41 commits (Caio 39 + Joao 2) em 6 frentes paralelas. Relatório em **`docs/AUDITORIA_CODIGO_HERDADO.md`**.

**Resultado:** maioria boa/alta qualidade (infra sólida, telas Q5 bem-feitas, 502 testes reais, família multi-tenancy trancada, CSV injection corrigido). Mas **3 🔴 bloqueiam produção:**
- **C1** reset token vazado na resposta HTTP = account takeover.
- **C2** 67 `throw new Exception` → erros viram HTTP 500 + vazam mensagem.
- **C3** soft-delete de `Transacao` violado (hard delete + listagem mostra canceladas).

Fixes priorizados no `ROADMAP.md` → "Higiene / dívida". Branches pendentes do Caio (`114-drop-sqlite`, `92-e2e-playwright`) = MERGEAR-COM-AJUSTE.

**Próxima ação concreta:** decisão do dono — atacar os 🔴 da auditoria (começar por C1 reset token) OU seguir feature do roadmap (1.1 filtros ricos). Rotação de segredos continua pendente.

---

## Última feature entregue

**1.2 Privacy toggle (ocultar saldo)** — branch `feature/privacy-toggle-ocultar-saldo` (não pushada). Olho global no navbar, `formatMoney` central, persistência localStorage, mascara ao vivo em qualquer tela. 286 testes verdes.
