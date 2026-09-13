# Prompt — Nova Sessão

**Ponto de entrada de qualquer sessão de trabalho com Claude no projeto Pontes.** Leia do começo ao fim antes de qualquer outra coisa.

---

## 1. Identidade da sessão

Você é Claude trabalhando no projeto **Pontes** (controle financeiro) em `E:\VSCode\controle-financeiro`.

**Objetivo do produto:** produto B2C brasileiro de finanças pessoais e familiares, com diferencial em **gestão financeira de casais e famílias** (rateio "quem paga o quê", papéis dinâmicos, dependentes, acerto). Ver `docs/features/familia/visao.md`.

**Não é projeto pessoal de brincadeira** — é produto futuro. Padrão de qualidade alto: testes, validação, documentação atualizada, commits semânticos.

**Projeto solo.** Gustavo desenvolve sozinho. Não há coordenação de dupla, assignee de terceiros, nem review de outro dev. `gh issue` ainda pode ser usado pra rastrear trabalho, mas é opcional e sem assignee de terceiros.

---

## 2. Primeira ação — skill `caveman`

Invoque a skill `caveman` no modo `full` (reduz tokens em respostas conversacionais). **Código e arquivos do projeto seguem normais** — caveman afeta só o chat. Se já estiver ativa, ignore.

---

## 3. Ordem de leitura (a cada nova sessão)

Use `Read` nesta ordem:

1. **`STATE.md`** — onde a sessão anterior parou. **Mais importante.**
2. **`ROADMAP.md`** — backlog vivo (o que fazer a seguir, prioridade).
3. **`CLAUDE.md`** — convenções, stack, comandos, padrões.
4. **`docs/QUICK_REFERENCE.md`** — resumo de stack/comandos/padrões.

Conforme a sessão exigir:

- **Qualquer código:** `docs/STANDARDS.md` (convenções), `docs/GIT_WORKFLOW.md` (branches/commits).
- **Schema:** `docs/DATABASE.md`.
- **Fluxo de negócio:** `docs/FLOWS.md`.
- **Feature nova:** `docs/features/<nome>/` — `arquitetura.md` e `ux.md` se existirem.
- **Controller novo:** `docs/CONTROLLER_TEMPLATE.md`.
- **UI:** `docs/DESIGN_SYSTEM.md`.
- **Por que do roadmap:** `docs/ANALISE_PRODUTO.md` + `docs/concorrentes/`.

**Histórico:** trabalho concluído em `docs/history/` (ISSUES/PROGRESS/IMPLEMENTATION_STATE por quarter).

---

## 4. Pré-flight de git

Antes de tocar em código:

```bash
git checkout main
git pull --ff-only origin main          # se houver remoto à frente
git checkout -b feature/<slug-kebab>     # branch por unidade de trabalho
```

Atualize `STATE.md` com o que vai atacar. `gh issue` é opcional pra rastrear — se usar, `gh issue edit <N> --add-assignee @me`.

---

## 5. Regras inegociáveis (todo trabalho de front Q5+ segue, sempre)

1. **Biblioteca, nunca inline.** Toda UI vem de `@/components/pontes`. Zero `<button style>`, zero MUI, zero `<select>` nativo. **Estilo em `*.module.css` (CSS Modules), nunca `style={{}}` de cor/fonte/tema.** Exceção única a inline: valor dinâmico de runtime que CSS não alcança (`width: %`, cor vinda de dado tipo `conta.cor`). **Boy-scout:** achou `style={{}}` de tema/estático, arruma na hora.
2. **Componente reutilizável novo (2+ telas) → vai pra biblioteca** (`src/components/pontes/`) ANTES de usar: arquivo + barrel `index.ts` + demo no `/design-system` + smoke test em `src/test/components/pontes.test.tsx`. Específico de 1 tela → fica na pasta da tela.
3. **Cor e fonte SEMPRE via `var(--pontes-*)`** em `*.module.css`. Vars injetadas no `:root` pelo `PontesThemeProvider`. `usePontesTheme()` só onde precisa de cor REAL hex (atributo SVG/recharts). Feedback = `var(--pontes-success|warning|danger|info)`.
4. **Personalização é global + persistida.** `PontesThemeProvider` no root, localStorage. Vale em todas as telas, sobrevive reload.
5. **Site público usa `SiteLayout`.** Páginas = só conteúdo; navbar/footer vêm do layout.
6. **Teste automatizado SEMPRE** — front (vitest) E back (xUnit) cobrindo o que mudou. Sem teste = não fecha. Exceção: só copy/CSS/docs.
7. **Ícones via `lucide-react`** (`<Plus size={16} strokeWidth={2.5}/>`), nunca char texto.
8. **Form valida por campo, sempre.** `PontesField error=` + `invalid` no controle, nunca toast pra campo faltando. Bloqueia submit se inválido; erro limpa ao editar; mensagem ≠ placeholder. Teste obrigatório (submit vazio bloqueia + mostra erros).
9. **Confirmação destrutiva:** `PontesDialog`, nunca `window.confirm`.
10. **Baseline de segurança + qualidade — SEM PEDIR, toda entrega.** Rodar o **checklist obrigatório
    por entrega** (`docs/SEGURANCA_BEST_PRACTICES.md` §0) antes de fechar: input validado back+front,
    isolamento/IDOR, SQL só parametrizado, DoS/força bruta, erro/log sem vazar segredo/PII, **menor
    exposição de informação** (o que não é da pessoa ela nem vê — conferir no `dist` que rota/endpoint
    de admin não vaza no bundle comum), DS-only, teste, e conformidade por fonte primária. **Afirmação
    de segurança só com evidência verificada** (grep/dist/DTO), nunca de memória. Modelo de ameaça:
    atacante automatizado com IA sem limites — não confiar em obscuridade.

> **`src/components/` (raiz, fora de `pontes/`) era ZONA LEGADA — já foi purgada (PR #166).** Hoje só sobrevivem ali `Logo/`, `Auth/` (lógica de rota), `Navbar/`, `Sidebar/`, `Pwa/`. Componente novo reutilizável vai pra `pontes/`, sem exceção.

Detalhe completo de estilização e validação: `docs/STANDARDS.md`.

---

## 6. Biblioteca Pontes — fundação do front

- **Pasta:** `src/components/pontes/` — 37+ componentes, única fonte de UI.
- **Barrel:** `import { PontesButton, PontesInput, ... } from "@/components/pontes"`.
- **Showroom:** rota `/design-system` (paleta + fonte trocáveis ao vivo).
- **Tokens:** `theme.ts` — 15 paletas, 7 fontes, `spacing`/`radii`/`shadows`/`semantic`.
- **Tema global:** `PontesThemeProvider` + `usePontesTheme()`, persistido em localStorage. Picker em `/perfil`.

Precisa de componente que não existe? Cria em `pontes/`, re-exporta no `index.ts`, demo no `/design-system`, smoke test — **depois** usa na tela.

---

## 7. Testes — regra obrigatória

**Toda mudança em código precisa de teste novo cobrindo o que mudou. Front E back.**

**Front (vitest + @testing-library/react):** componente DS → smoke test; tela → `src/test/pages/<Tela>.test.tsx` (render + interação + edge case); service → `src/test/services/`; bug fix → teste de regressão.

**Back (xUnit + WebApplicationFactory):** endpoint → integração (happy, 400, 401, 404, 403-outro-usuário); service → unitário; migration → smoke; bug fix → regressão.

**Não precisa de teste:** copy/texto puro, CSS puro, docs.

```bash
cd controle-financeiro.web && npm test -- --run    # front
cd ControleFinanceiro.Api && dotnet test           # back
```

---

## 8. Nunca parar em estado quebrado

Pontos **seguros** pra parar: após checkpoint verde, após commit, antes de começar nova entidade/serviço/componente.

Pontos **perigosos** (nunca parar aqui): migration criada não aplicada; entidade mudada com DbContext desatualizado; service refatorado com controller na assinatura antiga; front chamando endpoint inexistente; testes quebrados que antes passavam.

---

## 8.5. Triagem de achados (catalogar + priorizar) ⭐ INEGOCIÁVEL

**Todo achado** (bug, falha de segurança, dívida, algo faltando) **é anotado em `ROADMAP.md` com prioridade explícita, na hora, ANTES de seguir.** Memória e chip de task são efêmeros — **não contam** como catalogar. Se não está no ROADMAP/STATE, vai ser esquecido.

**Taxonomia de prioridade (define a fila):**

| Nível | O que é | Tratamento |
|---|---|---|
| **P0 — Bloqueador / Segurança crítica** 🔴 | falha de segurança explorável; algo que impede o trabalho atual | **Fura fila → vira o próximo.** Se bloqueia o que estou fazendo: **PARA, parka a branch atual (deixa parada), anota nos arquivos, abre branch nova pra resolver, só volta na parada depois.** |
| **P1 — Alta** 🟠 | dívida séria, hardening importante, bug que afeta uso | topo da fila de higiene/dívida |
| **P2 — Média** 🟡 | melhoria relevante sem urgência | entra na fila média, na ordem |
| **P3 — Baixa** ⚪ | nice-to-have, polish | fundo da fila |

**Fluxo ao achar algo:** anota em ROADMAP (com nível) → decide se fura fila (só P0) ou entra na ordem → se P0-bloqueador, parka a branch e troca de contexto. Nunca largar um achado "pra depois" só na cabeça/no chat.

## 8.6. Economia de pesquisa (orçamento de uso é escasso)

O limite de uso renova de 5 em 5h — gastar cedo deixa o projeto parado. Pesquisa proporcional ao tamanho da dúvida:

1. **Reusar primeiro:** `docs/SEGURANCA_BEST_PRACTICES.md` + `docs/CONFORMIDADE_BR.md` já têm muita coisa verificada e citada. **Não re-pesquisar o que já está documentado.**
2. **Leve por padrão:** `WebFetch`/`WebSearch` direto na fonte primária (OWASP/NIST/ANPD), 1-3 fetches.
3. **Deep-research pesado** (skill `deep-research`, ~100 agentes) **só pra incógnita grande e nova, avisando o custo e pedindo OK antes.**
4. A regra de conformidade (`CLAUDE.md`) continua: fonte primária, nunca chute — só o **método** é proporcional.

---

## 9. Encerramento de sessão

> ⚠️ **`STATE.md` e `ROADMAP.md` são arquivos de estado críticos.** A próxima sessão depende deles. Terminou etapa relevante → atualize **na mesma sessão**, antes de encerrar.

1. **Build verde** — `dotnet build` (back), `npm run build` (front se mexeu).
2. **Lint zero** — `npm run lint`.
3. **Commit** seguindo `docs/GIT_WORKFLOW.md`. Trabalho parcial pode ser commitado desde que compile.
4. **Atualizar `STATE.md`:** marcar etapas concluídas, atualizar "próxima ação concreta", trocar foco.
5. **Atualizar `ROADMAP.md`** se um item foi entregue ou surgiu item novo. **Higiene: o ROADMAP é só backlog ABERTO.** Item concluído não fica marcado `[x]` acumulando — vai pro arquivo `docs/history/ROADMAP_CONCLUIDO.md` (move o texto pra lá, preservando o detalhe; tira do ROADMAP). Fazer no encerramento, ou num pente-fino quando o arquivo inchar. Deduplique itens repetidos. Nada se apaga — só realoca.
6. **Atualizar doc tocada:** `docs/DATABASE.md` (schema), `docs/FLOWS.md` (fluxo), `docs/STANDARDS.md` (padrão novo), `docs/features/<nome>/` (feature).
7. **Push + PR** (se for trabalhar com remoto): `git push -u origin feature/<slug>` → `gh pr create --fill --base main`. `Closes #N` no body se tiver issue.
8. **Avisar em chat:** o que parou, próxima ação.

---

## 10. Comandos úteis

```powershell
# Backend (porta 5293)
cd E:\VSCode\controle-financeiro\ControleFinanceiro.Api
docker compose up -d postgres       # sobe Postgres de dev (uma vez)
dotnet build
dotnet run                          # http://localhost:5293/swagger
dotnet ef migrations add <Name>
dotnet ef database update
dotnet test

# Frontend (porta 5173)
cd E:\VSCode\controle-financeiro\controle-financeiro.web
npm install
npm run build
npm run dev                         # http://localhost:5173
npm run lint
npm test -- --run
```

---

## 11. Padrões críticos para lembrar

- **`UsuarioId` em toda query** — multi-tenancy é checagem manual em cada service. Nunca confiar em filtro do cliente.
- **Soft delete** em entidades financeiras (`Transacao`, `Parcelamento`, `ParcelaTransacao`, `Recorrente`) via flag `Ativo` — nunca `_context.Remove()`.
- **Idempotência** em endpoints transacionais via header `Idempotency-Key`.
- **`FinancialEventLog`** registra mudanças de saldo/limite — auditoria sempre.
- **Hangfire** para jobs recorrentes.
- **3 flags ortogonais** na `Fatura` (`EstadoCiclo`, `EstadoPagamento`, `EstaAtrasada`).
- **API versioning:** rotas em `/api/v1/...` (global).
- **Error handling:** lançar `ArgumentException` (→400), `KeyNotFoundException` (→404), `InvalidOperationException` (→409), `ForbiddenAccessException` (→403, autorização/ownership — usuário autenticado mas sem permissão), `UnauthorizedAccessException` (→401, **só** autenticação real: login/refresh/senha inválida). Sem try/catch nos controllers. O middleware do 500 nunca ecoa `Message` (genérico; detalhe só no log). O front só desloga em 401 — por isso erro de permissão é 403.
- **Paginação:** listagens grandes retornam `PagedResult<T>` com `?page=&pageSize=`.
- **Provider dinâmico:** `DATABASE_URL` com `Host=` → Postgres, senão SQLite. Dev e prod usam Postgres (Docker).

---

## 12. Para começar agora

1. Invocar skill `caveman` (`full`).
2. Pré-flight de git (seção 4).
3. `Read` em `STATE.md` → identificar onde parou.
4. `Read` em `ROADMAP.md` → próximo item se nada estiver em execução.
5. Continuar dali. Se nada em execução e nada óbvio no roadmap, perguntar ao usuário **uma coisa específica**.

Boa sessão.
