# Prompt — Nova Sessão

**Este arquivo é o ponto de entrada para qualquer sessão de trabalho com Claude no projeto Controle Financeiro.**

Leia este arquivo do começo ao fim antes de fazer qualquer outra coisa.

---

## 1. Identidade da sessão

Você é Claude trabalhando no projeto **Controle Financeiro** em `E:\VSCode\controle-financeiro`.

**Objetivo do projeto:** Tornar-se um produto B2C brasileiro de finanças pessoais e familiares, com diferencial em **gestão financeira de casais e famílias** (rateio "quem paga o quê", papéis dinâmicos, dependentes). Ver `docs/features/familia/visao.md` para a visão completa de produto.

**Não é projeto pessoal** — é produto futuro. Padrão de qualidade alto: testes, validação, documentação atualizada, commits semânticos.

---

## 2. Primeira ação — invocar skill `caveman`

Antes de qualquer outra coisa, invoque a skill `caveman` no modo `full` para reduzir consumo de tokens em respostas conversacionais. Código e arquivos do projeto seguem normais (sem caveman) — caveman afeta apenas as respostas em chat.

Se a skill já estiver ativa de invocação anterior, ignore.

## 3. Ordem de leitura obrigatória (a cada nova sessão)

Use o tool `Read` nesta ordem:

1. **`IMPLEMENTATION_STATE.md`** — onde a sessão anterior parou. **Mais importante.**
2. **`PROGRESS.md`** — dashboard de progresso geral e histórico de sessões.
3. **`ISSUES.md`** — catálogo do backlog atual (Q3 2026, 4 blocos).
4. **`CLAUDE.md`** — convenções do projeto, stack, comandos, padrões.
5. **`docs/QUICK_REFERENCE.md`** — resumo de stack/comandos/padrões para consulta rápida.

Conforme o trabalho da sessão exigir, leia adicionalmente:

- **Para qualquer trabalho em código:** `docs/STANDARDS.md` (convenções), `docs/GIT_WORKFLOW.md` (branches e commits).
- **Para trabalhar no schema:** `docs/DATABASE.md`.
- **Para entender fluxo de negócio:** `docs/FLOWS.md`.
- **Para implementar nova feature:** `docs/features/<nome>/` — vise sempre `arquitetura.md` e `ux.md` se existirem.
- **Para criar novo controller:** `docs/CONTROLLER_TEMPLATE.md`.
- **Para UI:** `docs/DESIGN_SYSTEM.md`.
- **Para entender análise de produto:** `docs/ANALISE_PRODUTO.md`.

**Histórico:** trabalho concluído está em `docs/history/`. Consulte se precisar de contexto sobre decisões antigas.

---

## 4. Estrutura mental do trabalho

Tudo gira em torno de uma **Issue do backlog** (ver `ISSUES.md`). Cada Issue pertence a um dos 4 blocos:

| Bloco | Tema | Ordem |
|---|---|---|
| A | Higiene de produção (segredos, CORS, auth, rate limit) | Primeiro |
| B | Infraestrutura para escalar (Postgres, Docker, CI/CD) | Segundo |
| C | Pivot Família (a feature diferenciadora) | Terceiro |
| D | Retenção e UX B2C (OFX, PWA, notificações) | Quarto |

**Ordem dos blocos é obrigatória** — pular A para fazer C cria dívida que custa caro depois.

Quando a Issue estiver clara em `IMPLEMENTATION_STATE.md`, siga as etapas dela em ordem. Cada etapa tem um **checkpoint** que precisa estar verde antes de passar para a próxima.

---

## 5. Regra de ouro — nunca parar em estado quebrado

Se sentir pressão de tokens (após ~70% do contexto), **interrompa em ponto seguro**:

**Pontos seguros para parar:**
- Após checkpoint verde de uma etapa.
- Após commit bem-sucedido.
- Antes de começar uma nova entidade/serviço/componente.

**Pontos perigosos — nunca parar aqui:**
- Migration criada mas não aplicada.
- Entidade modificada mas DbContext não atualizado (build vermelho).
- Service refatorado mas controller ainda chamando assinatura antiga.
- Frontend chamando endpoint que não existe no backend.
- Testes quebrados que não estavam quebrados antes.

Se a próxima ação vai te empurrar para ponto perigoso e tokens estão escassos, **pare antes** dessa ação.

---

## 6. Procedimento de encerramento de sessão (obrigatório)

Quando decidir parar (limite de tokens, fim natural de etapa, ou usuário pediu):

1. **Garantir build verde** — `dotnet build` no backend, `npm run build` no frontend se mexeu lá.
2. **Commit do que foi feito** seguindo `docs/GIT_WORKFLOW.md`. Mesmo trabalho parcial pode ser commitado, desde que compile.
3. **Atualizar `IMPLEMENTATION_STATE.md`:**
   - Marcar etapas concluídas com `[x]`.
   - Atualizar "Etapa atual" para a próxima.
   - Atualizar "Próxima ação concreta" com instrução específica (arquivo, método, comportamento esperado).
   - Adicionar entrada nova em "Histórico de sessões na issue atual".
4. **Atualizar `PROGRESS.md`:**
   - Adicionar entrada em "Histórico de sessões" com data, o que foi feito, próxima ação.
   - Se a issue foi concluída, mover dela para a seção "Resolvidos" e atualizar o dashboard.
5. **Atualizar documentação tocada:**
   - Se schema mudou: `docs/DATABASE.md`.
   - Se fluxo mudou: `docs/FLOWS.md`.
   - Se padrão mudou: `docs/STANDARDS.md`.
   - Se feature nova: `docs/features/<nome>/`.
6. **Commit final do state:** `chore(docs): atualiza state — sessão N`.
7. **Avisar o usuário em chat:** qual issue/etapa parou, o que foi feito, e que ele pode reabrir nova sessão com este mesmo prompt.

---

## 7. Comandos úteis

```powershell
# Backend (porta 5293)
cd E:\VSCode\controle-financeiro\ControleFinanceiro.Api
dotnet build
dotnet run                          # http://localhost:5293/swagger
dotnet ef migrations add <Name>
dotnet ef database update
dotnet test                         # roda os 48 testes

# Frontend (porta 5173)
cd E:\VSCode\controle-financeiro\controle-financeiro.web
npm install
npm run build
npm run dev                         # http://localhost:5173
npm run lint
```

---

## 8. Padrões críticos para lembrar

- **`UsuarioId` em toda query** — multi-tenancy é checagem manual em cada service. Nunca confiar em filtros vindos do cliente.
- **Soft delete** em entidades financeiras (`Transacao`, `Parcelamento`, `ParcelaTransacao`, `Recorrente`) — nunca `_context.Remove()`.
- **Idempotência** em endpoints transacionais via header `Idempotency-Key`.
- **`FinancialEventLog`** registra mudanças de saldo/limite — auditoria sempre.
- **Hangfire** para jobs recorrentes — não on-demand, não cron caseiro.
- **3 flags ortogonais** na `Fatura` (`EstadoCiclo`, `EstadoPagamento`, `EstaAtrasada`), não enum monolítico.
- **API versioning:** todas as rotas em `/api/v1/...` (configurado globalmente, não precisa repetir em cada controller).
- **Error handling:** lançar `ArgumentException` (→400), `KeyNotFoundException` (→404), `InvalidOperationException` (→409), `UnauthorizedAccessException` (→401). Não usar try/catch nos controllers.
- **Paginação:** endpoints de listagem grande retornam `PagedResult<T>` com `?page=&pageSize=`.
- **Não vazar UI no backend** — copy, contagem de dias, cores são responsabilidade do frontend.

---

## 9. Quando em dúvida

- **Sobre o domínio existente:** `docs/DATABASE.md`, `docs/FLOWS.md`, ou `Grep`/`Read` no código real.
- **Sobre a nova feature Família:** `docs/features/familia/visao.md` (visão de produto, não spec técnica fechada).
- **Sobre código existente:** `Grep`/`Read` direto — nunca chutar.
- **Sobre algo realmente ambíguo:** pergunte ao usuário **uma coisa específica**, não bloco genérico.

---

## 10. Para começar agora

1. Invocar skill `caveman` (modo `full`).
2. `Read` em `IMPLEMENTATION_STATE.md`.
3. Identificar issue/etapa atual.
4. Continuar dali em diante. Se nenhuma issue está em execução, perguntar ao usuário qual quer iniciar (ver `ISSUES.md` Bloco A — começo natural).

Boa sessão.
