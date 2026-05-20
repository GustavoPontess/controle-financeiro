# Prompt — Nova Sessão

**Este arquivo é o ponto de entrada para qualquer sessão de trabalho com Claude no projeto Controle Financeiro.**

Leia este arquivo do começo ao fim antes de fazer qualquer outra coisa.

---

## 1. Identidade da sessão

Você é Claude trabalhando no projeto **Controle Financeiro** em `E:\VSCode\controle-financeiro`.

**Objetivo do projeto:** Tornar-se um produto B2C brasileiro de finanças pessoais e familiares, com diferencial em **gestão financeira de casais e famílias** (rateio "quem paga o quê", papéis dinâmicos, dependentes). Ver `docs/features/familia/visao.md` para a visão completa de produto.

**Não é projeto pessoal** — é produto futuro. Padrão de qualidade alto: testes, validação, documentação atualizada, commits semânticos.

**Trabalho em dupla:** o projeto é desenvolvido por dois devs em assíncrono, ambos com Claude. **Antes de fazer qualquer mudança, ler `docs/COLLABORATION.md`** para entender o protocolo de coordenação (GitHub Issues, branches, code review, conflitos previsíveis).

---

## 2. Primeira ação — invocar skill `caveman`

Antes de qualquer outra coisa, invoque a skill `caveman` no modo `full` para reduzir consumo de tokens em respostas conversacionais. Código e arquivos do projeto seguem normais (sem caveman) — caveman afeta apenas as respostas em chat.

Se a skill já estiver ativa de invocação anterior, ignore.

## 3. Pré-flight de git (antes de qualquer mudança)

Antes de tocar em código, garantir que o ambiente local está sincronizado e que ninguém mais está na Issue que você vai pegar:

```bash
# 1. Atualizar main local
git checkout main
git pull --ff-only origin main

# 2. Ver o estado das Issues no GitHub
gh issue list --state open                       # tudo aberto
gh issue list --assignee "@me" --state open      # o que está comigo
gh pr list --state open                          # PRs em andamento

# 3. Se já tem Issue assignada a você (sessão anterior em andamento), pula direto pro passo 4
# 4. Se não tem, escolha a próxima Issue do Bloco A → B → C → D (ver ISSUES.md), assigne-se:
gh issue edit <numero> --add-assignee @me

# 5. Crie a branch
git checkout -b feature/<numero>-<slug-kebab>
```

Não pegue Issue assignada a outro dev. Não pegue Issue fora da ordem dos blocos sem motivo justificado em comentário no GitHub Issue.

**Reservar Issues dependentes (obrigatório).** Ao se assignar a uma Issue, verifique no `ISSUES.md` se há outras Issues que dependem dela — direta ou transitivamente (ex: #17 "Hangfire PostgresStorage" depende de #16 "Migrar para Postgres"; #20 "Health checks" depende de #16 e #17). Assigne-se **também** a toda a cadeia de dependência:

```bash
gh issue edit <numero-dependente> --add-assignee @me
```

Motivo: o outro dev trabalha em paralelo. Se ele pegar uma Issue que depende da sua e ela ainda não foi mergeada, ele fica travado esperando seu merge/commit. Reservar a cadeia inteira evita esse bloqueio.

Cuidado para não reservar demais: assigne **apenas** Issues com dependência real. Issues independentes ficam livres para o outro dev — senão ele fica sem trabalho. O equilíbrio é reservar a cadeia de dependência, não o bloco inteiro.

## 4. Ordem de leitura obrigatória (a cada nova sessão)

Use o tool `Read` nesta ordem:

1. **`IMPLEMENTATION_STATE.md`** — onde a sessão anterior parou. **Mais importante.**
2. **`PROGRESS.md`** — dashboard de progresso geral e histórico de sessões.
3. **`ISSUES.md`** — catálogo do backlog atual (Q3 2026, 4 blocos).
4. **`docs/COLLABORATION.md`** — protocolo de trabalho em dupla (especialmente se primeira sessão sua).
5. **`CLAUDE.md`** — convenções do projeto, stack, comandos, padrões.
6. **`docs/QUICK_REFERENCE.md`** — resumo de stack/comandos/padrões para consulta rápida.

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

## 5. Estrutura mental do trabalho — Q5 2026

Tudo gira em torno de uma **Issue do backlog** (ver `ISSUES.md`). Q5 tem 18 issues (#75-#92) sem agrupamento em blocos — **modelo pull**: cada dev pega a próxima livre.

### Ordem sugerida (não obrigatória)

**Site público (frente — desbloqueia fluxo de entrada):**
- #75 ✅ root público com fallback Dashboard
- #76 Login + Register refator
- #77 Para Casais
- #78 Para Contadores
- #79 Recursos
- #80 Sobre

**Telas internas (em paralelo):**
- #81-#89 (Dashboard, Transação, Categorias, Cartão, Família, Metas, Limites, Bancos, Recorrentes)

**Infra/qualidade:**
- #90 Personalização in-app
- #91 CI/CD gate
- #92 Cobertura E2E

### Marca decidida (sessão 30, 2026-05-21)

- Nome: **Pontes**
- Logo: `src/components/Logo/Logo.tsx` (wordmark + arco sublinhado, conceito 20)
- Fonte da marca: **Plus Jakarta Sans** (fixa, pré-carregada em `index.html`)
- Tipografia institucional: Plus Jakarta + Fraunces (h2 grandes) + Instrument Serif (acentos italic)
- Paleta + fonte do produto: escolha do usuário via personalização in-app (#90)

### Estrutura de pastas (atualizada Q5)

```
src/pages/
├── Site/                    # tudo público do site institucional
│   ├── HomePage.tsx         # rota /site (futuro /)
│   ├── LogoConcepts.tsx     # temporário
│   └── theme.ts             # palettes + fonts + types
├── DesignSystem/
│   └── DesignSystemPage.tsx # rota /design-system
├── Auth/, Dashboard/, etc   # internos autenticados
src/components/
├── Logo/Logo.tsx            # logo oficial Pontes
├── Auth/RootRoute.tsx       # decide HomePage vs Dashboard em /
└── Auth/ProtectedRoute.tsx
```

### Design System — base de TODO front Q5 ⭐

**Rota:** `/design-system` (pública, sem auth)
**Arquivo:** `src/pages/DesignSystem/DesignSystemPage.tsx`
**Showcase:** `ComponentShowcase` exportado de `pages/Site/HomePage.tsx`

**7 abas com componentes prontos pra reuso:**

1. **Botões** — 9 variantes (primary, accent, outline, ghost, soft, danger, link, disabled) + 5 tamanhos (XS→XL) + icon-only + FAB + button group segmented + estados REST/HOVER/FOCUS/ACTIVE/DISABLED
2. **Form & Inputs** — inputs com focus state, `<PontesSelect>` custom (NÃO usar `<select>` nativo), money input gigante, OTP, range slider, date picker, file upload drop zone, tag input, color picker, rating, kbd shortcuts, switches/checkboxes/radios clicáveis
3. **Cards & Dados** — chips, avatares com status dot, alerts (info/success/warn/error), progress bars, stat cards, tabela completa com sort + paginação
4. **Feedback** — toasts, modal/dialog (abrem real ao clicar), skeleton shimmer, empty state ilustrado, loading dots, drawer, tooltip, popover
5. **Navegação** — breadcrumb, tabs pills + underline, stepper 4 passos com glow, paginação, command palette ⌘K
6. **Gráficos** — recharts reais: line (ritmo de gastos com tooltip dark rico), area (saldo), bar (gastos/mês), donut (categorias) — todos consomem `p.primary` e `p.accent`
7. **Tokens** — cores 10 shades 50-900 (HSL gerado), tipografia escala display-2xl→caption, spacing, radii, shadows, easing animado

**Regras pra refator das telas (#81-#89):**

1. **NUNCA** criar botão/input/card do zero — usa o que já tá no `ComponentShowcase` e extrai pra `src/components/ui/` se precisar reusar
2. **NUNCA** usar `<select>` nativo (estilo zero) — usa `PontesSelect`
3. Todo gráfico via **recharts** com `BarChartReal`, `LineChartReal`, `LineAreaChartReal`, `DonutChartReal` (helpers exportar pra `src/components/charts/` quando virarem necessários)
4. Tipografia: Plus Jakarta no corpo, Fraunces nos h2/h3 grandes da landing, Instrument Serif só em acentos italic
5. Espaçamento: padrão Tokens da aba 7 (`space-4`, `space-6`, etc — mantém consistência)
6. Cor: SEMPRE via `p.primary`, `p.accent`, `p.text` etc — nunca hex hardcoded
7. Sombras/radii: use os definidos em Tokens (`shadow-sm/md/lg`, `radius-md/lg`)

**Regras de adição ao Design System (obrigatório):**

8. **Componente novo que pode ser reusado → adiciona no Design System imediatamente.** Se criar `PontesAccordion`, `PontesDatePicker`, `PontesBadge`, `PontesFamilyAvatar` ou qualquer coisa que outras telas vão usar, **inclui no `ComponentShowcase` na aba apropriada** (Botões, Form, Cards & Dados, Feedback, Navegação, Gráficos) na mesma PR. Critério: se vai aparecer em 2+ telas, vai pro DS.
9. **Componente que NÃO vai ser reusado** (tipo específico de uma única tela) fica na própria pasta da tela — não polui DS.
10. **PR de feature SEMPRE checa:** rodar `/design-system` e ver se algum componente criado deveria estar ali. Reviewer cobra.

**Sistema de cores + fontes — aplica em TODAS as telas (não só site):**

11. **Toda tela autenticada do app (Dashboard, Transações, Cartões, Família, etc) também segue a paleta + fonte do usuário** (decisão final via #90 Personalização in-app). Hoje as telas internas ainda usam tokens do Q4 — vão migrar pra mesmo sistema do `/site` + `/design-system` conforme o refator (#81-#89).
12. **Quem usa o app:** vê a paleta + fonte escolhida nas Configurações refletida em tudo — landing, login, dashboard, cada tela interna. Sem inconsistência.
13. **Quem usa o site público sem logar:** vê paleta padrão (decidida no controle bar do `/site` enquanto não fechamos definitiva).
14. **Wordmark "Pontes" é sempre Plus Jakarta** (marca, não muda com personalização — só corpo de texto e UI muda).

**Fluxo recomendado pra atacar tela do app (Dashboard, Transação, Cartão, etc):**

1. Abre `/design-system` no preview
2. Identifica os componentes que a tela precisa (ex: tabela, stat cards, donut, modal)
3. Copia padrão visual + comportamento do showcase pra dentro da tela
4. Se algum componente vai ser usado em 3+ lugares, extrai pra `src/components/ui/` (issue separada, marca dívida)
5. Refator visual + funcional na mesma branch da issue

**Issue #90 (Personalização) vai promover o `ComponentShowcase` a sistema real** — extrair componentes pra `src/components/ui/`, migrar MUI gradual.

### Pre-flight em cada nova issue

1. `git checkout main && git pull --ff-only origin main`
2. `gh issue list --state open` — ver livres
3. `gh issue edit <N> --add-assignee @me`
4. `git checkout -b feature/<N>-<slug-kebab>`
5. Atualizar `IMPLEMENTATION_STATE.md` com a issue em execução
6. Trabalhar
7. PR com `Closes #N` no body
8. CI verde (build + lint + testes)
9. Merge (squash) + delete branch
10. Atualizar `PROGRESS.md` em PR separado (`chore/docs-sessao-N`)

### Critério "done" universal

- Build verde (back: `dotnet build`; front: `npm run build`)
- Lint zero erros (`npm run lint`)
- Teste novo cobrindo a feature/refator
- Família real (você ou sócio) homologa em dev
- PR mergeado pra `main`

---

## 6. Regra de ouro — nunca parar em estado quebrado

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

## 7. Procedimento de encerramento de sessão (obrigatório)

> ⚠️ **`PROGRESS.md`, `IMPLEMENTATION_STATE.md` e `ISSUES.md` são arquivos de estado críticos.** O projeto é desenvolvido por **dois devs em assíncrono** — cada um (e o Claude de cada um) depende desses arquivos para saber o que já foi feito, o que está em execução e o que vem a seguir. Um arquivo de estado desatualizado faz o outro dev (ou a próxima sessão) trabalhar com informação errada: pegar Issue já feita, duplicar trabalho, ou perder contexto.
>
> **Regra:** terminou uma Issue ou etapa relevante → atualize esses arquivos **na mesma sessão**, antes de encerrar. Nunca deixe `PROGRESS.md` refletindo um estado que já mudou. Se notar qualquer um deles desatualizado ao abrir a sessão, **corrija antes de seguir**.

Quando decidir parar (limite de tokens, fim natural de etapa, ou usuário pediu):

1. **Garantir build verde** — `dotnet build` no backend, `npm run build` no frontend se mexeu lá.
2. **Rebase em `main` atualizado** antes de qualquer push:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
   Se houver conflito, resolver, `git rebase --continue`. Ver `docs/COLLABORATION.md` seção 7 para conflitos típicos em arquivos vivos.
3. **Commit do que foi feito** seguindo `docs/GIT_WORKFLOW.md`. Mesmo trabalho parcial pode ser commitado, desde que compile.
4. **Atualizar `IMPLEMENTATION_STATE.md`:**
   - Marcar etapas concluídas com `[x]`.
   - Atualizar "Etapa atual" para a próxima.
   - Atualizar "Próxima ação concreta" com instrução específica (arquivo, método, comportamento esperado).
   - Adicionar entrada nova em "Histórico de sessões na issue atual".
5. **Atualizar documentação tocada na sessão:**
   - Se schema mudou: `docs/DATABASE.md`.
   - Se fluxo mudou: `docs/FLOWS.md`.
   - Se padrão mudou: `docs/STANDARDS.md`.
   - Se feature nova: `docs/features/<nome>/`.
6. **Push:** `git push -u origin feature/<numero>-<slug>` (ou `git push --force-with-lease` se já existia).
7. **Abrir Pull Request** (Draft se ainda não terminou, Ready for review se terminou):
   ```bash
   gh pr create --fill --base main --head feature/<numero>-<slug>
   ```
   Preencher o template (aparece automaticamente). No campo "Review", marcar **Auto-merge** ou **Aguardando review** conforme o critério de `docs/COLLABORATION.md` §6.3. PR pequeno/trivial pode auto-merge sem esperar o outro.

   **Se o trabalho da Issue principal resolveu também outras issues** (ex: trabalho na #11 resolveu como subproduto a #12), listar TODAS no body do PR antes de mergear:
   ```
   Closes #1
   Closes #2
   ```
   Assim o GitHub fecha todas automaticamente e vincula o PR a cada Issue. **Nunca fechar Issue manualmente fora do PR** — perde rastreabilidade. Ver `docs/COLLABORATION.md` §6.5.
8. **Atualizar GitHub Issue** com um comentário do tipo "sessão N: parei em X, PR #Y aberto".
9. **`PROGRESS.md`** só é tocado **no PR final** (que fecha a Issue), não em sessões intermediárias.
10. **Avisar o usuário em chat:** qual issue/etapa parou, número do PR, se vai auto-mergear ou aguardar review.

---

## 8. Comandos úteis

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

## 9. Padrões críticos para lembrar

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

## 10. Quando em dúvida

- **Sobre o domínio existente:** `docs/DATABASE.md`, `docs/FLOWS.md`, ou `Grep`/`Read` no código real.
- **Sobre a nova feature Família:** `docs/features/familia/visao.md` (visão de produto, não spec técnica fechada).
- **Sobre código existente:** `Grep`/`Read` direto — nunca chutar.
- **Sobre algo realmente ambíguo:** pergunte ao usuário **uma coisa específica**, não bloco genérico.

---

## 11. Para começar agora

1. Invocar skill `caveman` (modo `full`).
2. Rodar o **pré-flight de git** (seção 3): atualizar `main`, ver Issues no GitHub, escolher/retomar Issue, criar branch.
3. `Read` em `IMPLEMENTATION_STATE.md` (na branch).
4. Identificar issue/etapa atual.
5. Continuar dali em diante. Se nenhuma issue está em execução, perguntar ao usuário qual quer iniciar (ver `ISSUES.md` Bloco A — começo natural).

Boa sessão.
