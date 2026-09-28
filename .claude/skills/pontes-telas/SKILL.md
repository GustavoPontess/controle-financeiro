---
name: pontes-telas
description: Receita OBRIGATÓRIA pra criar ou alterar qualquer tela interna do Pontes (lista, card, detalhe, formulário, resumo) e componentes do DS Pontes. Diz quais blocos usar, que informação mostrar em cada posição e o que é proibido. Use sempre que for mexer em controle-financeiro.web/src/pages (menos Site, DesignSystem, Auth, Convite, Onboarding) ou em src/components/pontes.
paths: "controle-financeiro.web/src/pages/**,controle-financeiro.web/src/components/pontes/**,controle-financeiro.web/src/layouts/**"
---

# Receita de tela do Pontes

**Regra de ouro: não inventar.** Toda tela interna é montada com os mesmos blocos, na mesma ordem, com a mesma anatomia. Se algo não cabe na receita, **pare e pergunte ao Gustavo** — não crie variação por conta própria. Consistência vale mais que criatividade aqui (o visual já está decidido: tokens `var(--pontes-*)`, biblioteca `@/components/pontes`).

Antes de escrever UI: leia a **ficha da entidade** em [`docs/features/padrao-telas/ficha-por-entidade.md`](../../../docs/features/padrao-telas/ficha-por-entidade.md) — ela diz o que vai em cada posição. Plano e contexto: [`docs/features/padrao-telas/plano.md`](../../../docs/features/padrao-telas/plano.md).

## 1. Toda tela é feita de 4 blocos (nesta ordem)

| Bloco | Componente | Responde |
|---|---|---|
| Cabeçalho | `PontesPageHeader` (abas/período à esquerda em `start`; 1 botão primário "Novo/Nova <coisa>" à direita) | — |
| Resumo do topo (opcional) | hero ou `PontesStatCard` | "Como estou?" — máx. 3-4 números, nenhum repetido da coleção |
| Coleção | `PontesToolbar` + lista/tabela/cards | "O que eu tenho?" |
| Detalhe / formulário | página de detalhe / `PontesModal` | "Tudo sobre isso" / "criar ou alterar" |

**Nunca** `<h1>` nem subtítulo na página: o título mora na Navbar. Nada de texto explicativo sob título, nem contador redundante ("13 registrados").

## 2. Qual coleção usar

- **`list`** (linha: identidade + título + meta + valor + ⋮) — itens homogêneos com 1 valor principal: Transferências, Contas Fixas, Parcelamentos, Empréstimos, listas da Família.
- **`table`** — só com 4+ colunas que o usuário compara entre linhas: Transações, Admin.
- **`cards`** — coleção pequena (até ~12) de "objetos" com estado visual: Contas, Metas, Limites, Famílias.
- **Fora do molde (exceções aprovadas; usam as peças do DS):** Cartões (mestre-detalhe + fatura), Categorias (árvore), Dashboard, Relatórios, caixa de pendências da Família (Aprovar/Recusar visíveis em vez de ⋮).

## 3. Anatomia fixa do item (linha ou card) — sempre nesta ordem

1. **Identidade:** ícone lucide 16px/strokeWidth 2.5, logo do banco (`PontesBankBadge`) ou avatar.
2. **Título:** o nome do item.
3. **Meta:** UMA linha, máx. 2-3 fatos separados por " · " (data, conta/cartão, categoria/pessoa).
4. **Valor principal:** à direita na linha, em destaque no card. `formatMoney` (`@/utils/money`), `font-variant-numeric: tabular-nums`.
5. **Status:** `PontesBadge` **só quando foge do normal**. Item ativo e em dia não tem badge. Vocabulário único: **Ativo · Pausado · Encerrado · Cancelado · Atrasado · Pago · Parcial** (termo novo só com a ficha aprovada).
6. **Progresso** (se existe): `PontesProgress` + "x de y".
7. **⋮ `PontesRowActions`:** todas as ações da linha, com ícone + texto; destrutiva (`danger`) por último, **sempre** confirmada com `PontesDialog`. Clicar na linha abre o detalhe.

**Teto:** título + 1 meta + 1 valor + 1 status + 1 progresso. O resto vai pro detalhe.

## 4. Receita de LISTA (referência viva: `src/pages/Transferencias/TransferenciasPage.tsx`)

1. `PontesPageHeader actionLabel="Nova <coisa>"`.
2. `PontesToolbar` com busca (`placeholder="Buscar <coisa>…"`) e, se a coisa acaba, `PontesSegmented` **Ativas | Encerradas**.
3. Busca, filtro e paginação **no servidor** (`useDebouncedValue` + service paginado + `PontesTablePagination`). Nunca filtrar só o array carregado de uma lista paginada. Mudar busca/filtro volta pra página 1.
4. Carregando → `PontesSkeletonList`. Vazio sem filtro → `PontesEmptyState` com ícone + título "Nenhuma <coisa> ainda" + botão de criar. Vazio com filtro → "Nada encontrado" + "Limpar filtros".
5. Resposta velha não pode vencer (descartar resposta de busca/página antiga). Página além do fim após excluir → voltar pra última página válida.
6. Excluir: `PontesDialog` de confirmação, botão com `loading` (sem clique duplo), toast de sucesso/erro, recarregar a lista.

## 5. Receita de FORMULÁRIO

- `PontesModal` + `PontesField label error` + `invalid` no controle. Valida ao enviar e **bloqueia**; erro inline (nunca toast pra campo); erro limpa ao editar; mensagem ≠ placeholder. Detalhe: `docs/STANDARDS.md` → "Validação de formulários"; limites de campo: `docs/REGRAS_CAMPOS.md`.
- Dinheiro: **sempre** `PontesMoneyInput` (nunca `PontesInput` texto + parser próprio; nunca aceitar negativo). Data: `PontesDateInput`; mês: `PontesMonthInput`; "hoje" = `dataLocalISO()` (`@/utils/dateTime`), nunca `toISOString().split("T")[0]`.
- Botão de enviar com `loading` e `disabled` durante o envio.
- Operação de dinheiro com `Idempotency-Key`: gerar a chave **ao abrir** o modal/diálogo e reusar em nova tentativa após erro de rede/5xx; trocar só depois de sucesso ou erro 4xx definitivo. Nunca `crypto.randomUUID()` dentro do handler de envio.

## 6. Receita de DETALHE

- Caminho do topo com o nome do item: `useDetalheNoCaminho(nome)` (`@/layouts/Default/useDetalheNoCaminho`).
- Topo: título do item + status (badge só fora do normal) + ações (as mesmas do ⋮ da lista; destrutiva só aqui ou no ⋮, confirmada).
- Item encerrado/cancelado: `PontesAlert` dizendo quando e por quê, e sem ações que não fazem mais sentido.

## 7. Proibido (o lint e a revisão barram)

- `<table>` cru, `<h1>`, subtítulo, texto explicativo, contador redundante.
- `style={{}}` pra cor/fonte/tema; hex ou fonte hardcoded (usar `var(--pontes-*)` em `*.module.css`). MUI ou qualquer lib de UI de terceiros.
- Ícones soltos por linha no lugar do ⋮; badge em item normal; status com nome fora do vocabulário.
- Filtro client-side em lista paginada; `formatDate`/parser de dinheiro próprios da página quando já existe o utilitário.
- Mostrar dado de outra pessoa que ela não precisa ver (ex.: renda de outro membro). Menor exposição sempre.
- Componente genérico novo dentro de `pages/` — se serve pra 2+ telas, vai pro DS (`src/components/pontes/`, export no barrel `index.ts`) e aparece em `/design-system`.

## 8. Antes de dizer que terminou

1. `npm run build` (o `tsc --noEmit` é no-op neste projeto), `npm run lint`, `npm test` do arquivo.
2. Rodar a skill **`/revisar-usabilidade <arquivos>`** e corrigir os P1/P2.
3. Abrir a tela no navegador (preview) e conferir: carregando, vazio, com dados, erro, ⋮, confirmação.
