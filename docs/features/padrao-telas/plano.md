---
owner: Gustavo
last_reviewed: 2026-09-28
status: PROPOSTA (aguardando OK do Gustavo pra começar o PR 1)
---

# Front sem retrabalho — plano

Pesquisa de 2026-09-28 (8 agentes: auditoria das telas, prontidão do DS, bibliotecas de mercado, ecossistema Claude Code, necessidades da Família, síntese e revisão adversarial). **Escrito pra qualquer modelo seguir** (Opus 4.8 inclusive): cada PR abaixo é fechado e pequeno.

## Por que o front vive quebrando

1. **Cada tela monta a própria lista.** Das ~24 telas, só Transferências e Contas Fixas usam `PontesPageHeader` + `PontesRowActions`. A linha é desenhada de 5 jeitos, o ⋮ de 5, a faixa de filtros de 3, o leitor de dinheiro de 6.
2. **A lógica de lista paginada é copiada à mão** (~50 linhas por tela, ex. `TransferenciasPage.tsx:52-111`). Cópia sem proteção contra resposta velha = bug.
3. **O DS induz ao erro:** `PontesTable` pagina no cliente (`Table.tsx:86`, `total={rows.length}` em `:136`) — nenhuma lista paginada no servidor consegue usar.
4. **O Claude recebia ordem de variar:** `.claude/skills/frontend-design/SKILL.md` (genérica da Anthropic) pede "BOLD aesthetic direction" (:13), "Unexpected layouts" (:33), "No design should be the same" (:38). E nada trava desvio (lint sem regra de página).

Comportamentos errados achados (a auditoria contou ~75, **reconferir cada um antes de catalogar** — houve falso positivo): resposta velha vence (~9 telas), vazio pisca ou erro vira "vazio" (~12), filtro/página perdidos ao voltar (todas — nenhuma usa a URL), excluir sem confirmação ou com clique duplo (~9), página vazia após excluir o último item (3).

## Decisões de ferramenta

| Adotar | Por quê |
|---|---|
| **TanStack Query** (~14 KB, sem visual) | Resolve resposta velha, recarregar após mutação, manter a página anterior enquanto carrega. Só dentro dos hooks do DS, nunca espalhado nas páginas |
| **Skill de projeto `pontes-telas`** | Receita fechada de lista, detalhe e formulário. Substitui a `frontend-design` genérica nas telas internas |
| **`web-design-guidelines`** ([vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills), MIT) | Revisor de usabilidade (100+ regras: acessibilidade, foco, formulários, navegação). Não inventa visual. Trazer pro repo **depois de ler inteira**, invocada manualmente antes do PR |
| **ESLint** (`no-restricted-syntax`/`no-restricted-imports`) | Tela fora do padrão vira erro de build |
| **Contrato Playwright de lista** | Trava de comportamento (busca volta pra página 1, toda linha tem ⋮, destrutivo confirma, vazio tem botão) |

| Adiar | Quando |
|---|---|
| TanStack Table | Só se precisar de ordenação por coluna ou seleção em lote |
| nuqs | O hook próprio com `useSearchParams` resolve a URL |

| Descartar | Motivo |
|---|---|
| MUI DataGrid, react-admin | Trazem o MUI de volta (purgado no #166) |
| AG Grid | Planilha; modo servidor é pago |
| Refine | Pagar fatura, acerto, parcela não são CRUD genérico |
| Storybook | Duplica `/design-system` |
| ui-ux-pro-max e skills de "estilo" | Disparam sozinhas e sugerem estilo novo — mesmo problema da `frontend-design`. Aproveitar só regras de UX copiando pra `pontes-telas` |

## Regra de escolha (vai pra skill)

- **`list`** (linha com item principal + meta + valor + ⋮): Transferências, Contas Fixas, listas da Família (membros, acertos, despesas, convites), Sessões.
- **`table`**: 4+ colunas comparáveis (Transações, Admin).
- **`cards`**: coleção pequena com estado visual (Contas, Metas, Limites) — só quando uma tela precisar.
- **Fora do molde (exceção aprovada, usam as peças):** Cartões (mestre-detalhe + timeline da fatura), Categorias (árvore), Dashboard, Relatórios.
- **Página interna:** sem `<h1>`/subtítulo (a Navbar tem o título); ⋮ com destrutivo por último e confirmação; vazio com botão; esqueleto ao carregar.
- **Exceção ao ⋮:** caixa de pendências da Família (Aprovar/Recusar visíveis).

## Pré-requisitos antes do TanStack Query (achados da revisão)

1. **GETs que gravam** (P2 → vira P1 pré-requisito): `GET /recorrentes` roda `GerarPendentesAsync` antes de listar (`RecorrentesController.cs:44`); Empréstimos aplica multa na leitura. O Query recarrega sozinho (foco, montagem, novas tentativas) → mais gravações concorrentes. Tirar a gravação da leitura, ou até lá `refetchOnWindowFocus: false` e `retry: false`.
2. **Multi-conta:** a guarda `X-Active-Account` só barra escrita (`ActiveAccountGuardMiddleware.cs`). Com recarga automática, aba antiga mostra dados da outra conta. Fazer: `queryKey` prefixada com a conta ativa; `QueryClient` dentro da parte remontada na troca (`<Outlet key={accountKey}>`, `DefaultLayout.tsx`) ou `clear()` em logout, troca, `addAccount` e login; teste com 2 abas.
3. **Evento `transactionCreated`** (botão global de nova transação): o hook de lista escuta ou vira `invalidateQueries`.
4. **URL:** `setSearchParams(..., { replace: true })` pra página/filtro (senão o Voltar anda pelas páginas); texto da busca em `location.state` (navegador compartilhado guarda histórico após logout).
5. **Idempotency-Key** gerada ao abrir o modal/diálogo, mantida em falha de rede/5xx, trocada só após sucesso ou 4xx definitivo (vale pro `useFormModal` e pro `confirm` do ⋮).

## Sequência de PRs

**PR 0 — P1 dinheiro/privacidade (independente, já):**
- Parcelamentos gera Idempotency-Key nova a cada envio (`Parcelamentos/index.tsx:168`, `[id].tsx:86`, `[id].tsx:110`): tentar de novo após queda de rede pode duplicar.
- Contas Fixas: digitar "1.500" grava R$ 1,50 (`RecorrentesPage.tsx:64`, `PontesInput` texto + parser próprio). Usar `PontesMoneyInput`.
- Família: a API devolve a renda (`RendaMensal`) de **todos** os membros pra todos (`FamiliaService.cs:84,146,192`; tela em `FamiliaDetalhe.tsx:520`). Contradiz "o sistema sabe o peso, não o valor" e a regra de menor exposição. Backend passa a devolver só a própria.

**PR 1 (P) — trava do Claude:**
- Skill `.claude/skills/pontes-telas/SKILL.md` (receita da fase 1 + regra de escolha acima + exceções). Reescrever quando o molde existir (PR 4).
- `frontend-design`: descrição restrita a `pages/Site` (site público) ou apagar.
- Trazer `web-design-guidelines` pro repo (após ler, com OK do Gustavo).
- ESLint só nas telas do `DefaultLayout` (fora: Site, DesignSystem, Auth, Convite, Onboarding): proibir `<table>` cru, `<h1>`, `PontesTable` antigo. Legados listados por nome em bloco `off` (lista só encolhe).
- Hook `.claude/hooks/form-rule.cjs`: `console.log` com exit 0 em PostToolUse provavelmente não chega ao modelo — devolver JSON `hookSpecificOutput.additionalContext` e **testar se chega**.

**PR 2 (P) — peças base:** `PontesDialog` com confirmação assíncrona (carregando); `PontesRowActions` com `hidden`/`disabled`/`confirm` (+ Idempotency-Key); leitor único de dinheiro; `EmptyState` com ícone.

**PR 3 (M) — dados:** pré-requisitos 1-5 acima + TanStack Query + `usePagedList` (servidor) + modo coleção pequena sem paginação (a Família inteira devolve arrays hoje). Testes: resposta velha, página 1 ao filtrar, página além do fim, 2 abas.

**PR 4 (M) — molde:** `PontesListPage` com variantes `list` e `table`, `sections`, `embedded`, `PontesPeriodNav` (mês na URL, em cima do `PontesMonthInput`). **Só 2 consumidores reais:** Transferências (`list`) e Acertos da Família (embutida, sem paginação). **Sem mudança visual** nesse PR. Variante nova só quando uma tela precisar.

**PR 5 (P) — Contas Fixas no molde** + contrato Playwright. Screenshot antes/depois só como prova local (não permanente no CI — base de screenshot só pode ser gerada no Linux do CI).

**PR 6 (M) — `PontesDetailHeader` + `useFormModal`**, estreando no hub da Família.

**Em paralelo (não depende do front):**
- Backend da Família: paginar despesas, endpoint de resumo sem N+1.
- PR pequeno: `TransactionTable.tsx` troca o ⋮ caseiro (:118-169) por `PontesRowActions` e extrai o editor de divisão (porta de entrada da Família).

**PR 7+ (1 tela por PR, pode ser o Opus 4.8 seguindo a skill):** Parcelamentos (tem `CartoesAbas`; service filtra por `ativo`), Empréstimos (**decidir antes** "Arquivados → Ativos | Encerrados"), Admin, Contas/Metas/Limites, Transações por último. Hero único muda o visual de algumas telas → listar quais e pegar OK antes.

## Fica de fora
Mobile (desktop primeiro), redesenho visual, TanStack Table, nuqs, Storybook.

## P3 anotado
Detalhe da família devolve o `Token` dos convites pendentes pra todos os membros (`FamiliaService.cs:89`). Aceitar exige o e-mail convidado (`ConviteService.cs:208`), então o risco é baixo; menor exposição sugere mostrar só pra quem pode convidar.
