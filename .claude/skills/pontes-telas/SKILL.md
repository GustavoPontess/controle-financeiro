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

## 4. Receita de LISTA = `useListaPaginada` + `PontesListPage` (não montar à mão)

Referências vivas: `src/pages/Transferencias/TransferenciasPage.tsx` (simples) e `src/pages/Recorrentes/RecorrentesPage.tsx` (com resumo do topo, filtro e ações por situação).

```tsx
const lista = useListaPaginada<Coisa, { status: "ativas" | "encerradas" }>({
  buscar: ({ page, pageSize, busca, filtros }) => service.listarPage(page, pageSize, { status: filtros.status, busca }),
  filtrosPadrao: { status: "ativas" },
  aoFalhar: () => notify({ open: true, message: "Erro ao carregar <coisas>.", severity: "error" }),
})

<PontesListPage
  lista={lista}
  acao={{ label: "Nova <coisa>", onClick: abrirCriar }}
  topo={resumo}                                    // opcional, máx. 3-4 números
  busca="Buscar <coisa>…"
  filtros={[{ campo: "status", ariaLabel: "Situação", opcoes: [{ value: "ativas", label: "Ativas" }, { value: "encerradas", label: "Encerradas" }] }]}
  rotulo={["<coisa>", "<coisas>"]}
  vazio={{ icone: <Icone size={28} strokeWidth={2.5} />, titulo: "Nenhuma <coisa> ainda" }}
  chave={(c) => c.id}
  item={(c) => ({ icone, tom, titulo, status, meta: [fato1, fato2], valor, valorTom, inativo, acoes, onClick })}
/>
```

O molde já garante: busca/filtro/paginação **no servidor**, página e filtros na URL (F5 e voltar preservam; texto da busca fica fora da URL), página 1 ao filtrar, resposta velha descartada, esqueleto, erro com "Tentar de novo" (nunca vazio falso), vazio com botão, "Nada encontrado" + "Limpar filtros", página além do fim. **Não reimplementar nada disso na página.**

- `item(...)` segue a **ficha da entidade**: `meta` só aceita texto (fatos; `{ texto, alerta }` pra prazo ≤ 7 dias); `status` só fora do normal; `valorTom` "entrada" (verde) ou "problema" (vermelho, só pra problema).
- Depois de criar/editar/excluir: `lista.recarregar()` (troca no lugar, sem piscar). Ajuste imediato: `lista.setItens(...)`.
- Excluir: `PontesDialog` com `onConfirm` **assíncrono** (o diálogo trava em "carregando", sem clique duplo), toast, recarregar.
- Variante nova (`table`, `cards`) só entra no molde quando uma tela precisar — não montar tabela/cards à mão na página.

## 5. Receita de FORMULÁRIO

- `PontesModal` + `PontesField label error` + `invalid` no controle. Valida ao enviar e **bloqueia**; erro inline (nunca toast pra campo); erro limpa ao editar; mensagem ≠ placeholder. Detalhe: `docs/STANDARDS.md` → "Validação de formulários"; limites de campo: `docs/REGRAS_CAMPOS.md`.
- Dinheiro: **`PontesMoneyField`** em formulário (valor `number | undefined`; dígitos viram centavos à vista, sem negativo). `PontesMoneyInput` é só o campo grande de destaque. Nunca `PontesInput` texto + parser próprio. Data: `PontesDateInput`; mês: `PontesMonthInput`; "hoje" = `dataLocalISO()` (`@/utils/dateTime`), nunca `toISOString().split("T")[0]`.
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
