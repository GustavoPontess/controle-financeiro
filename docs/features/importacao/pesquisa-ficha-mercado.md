---
owner: Gustavo
last_reviewed: 2026-11-08
---

> Pesquisa de mercado (workflow, 6 agentes) pedida pelo Gustavo em 2026-11-08: "gosto desse estilo mas a disposição está me incomodando; pense em como o mercado lida". Nenhum app foi visto ao vivo: centrais de ajuda, changelogs, tutoriais e galerias.

# Ficha do lugar no /importar: como o mercado organiza e como reorganizar a nossa

## 1) O que o mercado faz

1. **O que vem do banco aparece como texto. Não vira campo travado.**
   - O Inter mostra valor, data, hora, local e forma de pagamento só para leitura: https://blog.inter.co/detalhamento-de-compras/
   - O Lunch Money não deixa editar o valor da transação sincronizada: https://support.lunchmoney.app/finances/transactions/transaction-actions
   - O Monarch deixa o texto original do banco num "original statement" recolhido: https://www.monarch.com/blog/july-product-update
   - Os guias de design dizem o mesmo: o que nunca se edita vira texto.
     - NSW: https://designsystem.nsw.gov.au/docs/content/methods/inactive-fields.html
     - Carbon: https://carbondesignsystem.com/patterns/read-only-states-pattern/
     - Smashing: https://www.smashingmagazine.com/2024/05/hidden-vs-disabled-ux/
   - O segmentado existe para escolher, não para mostrar um valor (Apple): https://developer.apple.com/design/human-interface-guidelines/segmented-controls
   - No Minhas Economias, o tipo aparece pela cor: https://www.techtudo.com.br/dicas-e-tutoriais/2019/02/aplicativo-para-organizar-contas-saiba-como-usar-o-minhas-economias.ghtml

2. **A categoria vem logo abaixo do nome. Primeiro aparecem poucos palpites, a lista completa fica atrás.**
   - Emma: https://help.emma-app.com/en/article/change-a-transaction-category-iipyy2
   - Rocket Money: https://help.rocketmoney.com/en/articles/3332081-reviewing-editing-and-creating-transaction-categories
   - Copilot põe os 2 palpites mais prováveis no topo: https://intercom.help/copilotmoney/en/articles/8182433-copilot-intelligence-for-spending
   - YNAB sugere as 5 categorias mais recentes do favorecido: https://support.ynab.com/en_us/categorizing-transactions-a-guide-HyRl60sks.md

3. **Grupo: os campos do grupo ficam em cima e a lista de lançamentos fica embaixo.** Cada linha da lista tem editar, tirar e desagrupar.
   - Lunch Money: https://support.lunchmoney.app/finances/transactions/transaction-types
   - Meu Dinheiro: lista à esquerda, painel à direita, e o painel age sobre a seleção: https://docs.meudinheiroweb.com.br/ferramentas-avancadas/conciliacao-e-importacao-de-lancamentos/acoes-em-lote

4. **"Vale para todas deste lugar" é oferecido no momento da escolha, com a contagem de quantas mudam.**
   - Monarch, "Apply # changes": https://help.monarch.com/hc/en-us/articles/360048393372
   - PocketGuard: https://pocketguard.com/help/transaction-rules
   - Lunch Money: https://support.lunchmoney.app/setup/rules.md
   - Emma, "Select All": mesma URL do item 2.

5. **O que falta fica marcado onde falta e também somado num lugar só.**
   - YNAB, "This needs a category" na linha: URL do item 2.
   - Ramp, "(required)" no campo e uma seção "Missing items": https://support.ramp.com/hc/en-us/articles/360042588454-Submitting-receipts-memos-and-accounting-for-your-Ramp-transactions
   - O NN/g diz que o resumo no topo nunca pode ser o único aviso: https://www.nngroup.com/articles/required-fields/

6. **Editar salva na hora. Concluir e ir para o próximo é uma ação separada, com "pular".**
   - Monarch: https://www.monarch.com/review-on-the-go-and-smart-split
   - YNAB: https://www.ynab.com/up-next
   - Copilot no web: setas andam pela lista, R marca revisado, C troca a categoria: https://help.copilot.money/en/articles/11780342-copilot-money-for-web

7. **Opcionais e ações raras ficam no fim ou recolhidos.**
   - Meu Dinheiro, "Anexar documentos" na barra do pé: https://docs.meudinheiroweb.com.br/lancamentos/incluir-lancamentos
   - Simplifi: https://support.simplifi.quicken.com/en/articles/4340112-managing-transactions-on-the-mobile-app
   - Organizze mobile: https://ajuda.organizze.com.br/hc/pt-br/articles/6492204625427-Android-Lan%C3%A7amentos-Como-lan%C3%A7ar-uma-despesa

8. **Forma de pagamento por lançamento é rara.**
   - O formulário web do Organizze não tem esse campo: https://ajuda.organizze.com.br/hc/pt-br/articles/5662695438739-Web-Lan%C3%A7amentos-Como-lan%C3%A7ar-uma-despesa
   - No Meu Dinheiro é um cadastro opcional, desligado por padrão: https://docs.meudinheiroweb.com.br/cadastros/formas-de-pagamento

**Inferência minha:** já que o Pontes exige forma de pagamento, o caminho é definir "para todos do lugar" e deixar a exceção na linha. Isso segue o lote do item 3.

**Limite:** não vi nenhum app ao vivo. Tudo vem de central de ajuda, changelog e tutorial.

## 2) O que incomoda na nossa (do maior impacto para o menor)

1. **O fixo tem cara de controle e ocupa o topo.** O segmentado Despesa|Receita travado e as caixas cinza de Data e Conta parecem campos que se mexem. O mercado resolve com o padrão 1.
2. **Não dá para ver a quem cada campo vale.** Categoria vale para o lugar todo. Hora e Pago com valem para um lançamento só. Os dois tipos ficam no mesmo bloco, longe da linha onde aparece "Sem forma de pagamento". Padrões 3 e 5.
3. **O título é a descrição do lançamento mostrado, não o nome do lugar.** Ele muda quando a pessoa clica em Editar, e o lápis renomeia um lançamento só. Padrão 3.
4. **"Escolha a conta" aparece numa caixa que não se clica.** E a conta é a mesma para a importação inteira. Padrão 1: ela sai da ficha.
5. **O valor grande é ambíguo e aparece repetido.** É do lançamento mostrado ou é o total dos 3? A primeira linha da lista repete o mesmo valor. Padrões 1 e 3.
6. **A falta não aparece no campo que a resolve.** O "Usar Pix nos outros" fica longe do Pago com. Padrão 5.
7. **"Editar" na verdade só escolhe qual lançamento aparece lá em cima.** Os botões Editar e Separar ficam apagados até passar o mouse. Padrões 3 e 7.
8. **O espaçamento é igual entre tudo,** sem grupos, e a categoria mistura chips com select na mesma linha. Baixo impacto. Base: proximidade do NN/g, https://www.nngroup.com/articles/gestalt-proximity/

## 3) Propostas de disposição

As três seguem o mesmo princípio: a conta sai da ficha (fica no rodapé "Em qual conta?", que já existe) e o tipo aparece só pela cor do ícone e do valor.

### Proposta A: "O lugar em cima, os lançamentos numa tabela"

Vem do grupo do Lunch Money, do painel com lote do Meu Dinheiro e da linha do YNAB.

```
[ícone] Nome do lugar ✎                         R$ 1.240,30   (total, cor do tipo)
3 lançamentos, 02 a 28/out                                    < 3 de 12 >
[Resposta alerta: Falta forma de pagamento em 2]   (só quando falta)

Categoria
 (chip)(chip)(chip)(Outra ▾)
Subcategoria                     (só se a categoria tiver)
 (chip)(chip)(Outra ▾)

Lançamentos                              Pago com em todos [Selecao ▾]
 ☑ 02/10  Pix enviado Fulano   14:32   [Pix ▾]     R$ 692,06   ⋮
 ☑ 15/10  Pix enviado Fulano   --:--   [Falta ▾]   R$ 300,00   ⋮
 ☑ 28/10  Compra débito        --:--   [Débito ▾]  R$ 248,24   ⋮
          ⋮ = Descrição, Local e anexos (Dialogo), Separar
                                         [Pular]  [Próximo lugar]
```

- **Onde fica cada coisa:**
  - Nome do lugar e total: no topo.
  - Data e valor de cada lançamento: texto na linha dele.
  - Hora: na linha, editada com ValorNaLinha.
  - Forma de pagamento: na linha, mais um "em todos" no cabeçalho da lista.
  - Categoria e subcategoria: logo abaixo do topo.
  - Nota, local e anexos: no ⋮ da linha.
  - Ações: no pé da ficha.
- **Prós:**
  - A proximidade mostra o escopo: o que vale para o lugar fica em cima, o que vale para o lançamento fica na linha dele.
  - Acaba o "Editar sobe para cima".
  - As colunas alinham.
  - O falta aparece onde se resolve.
- **Contras:**
  - Um select por linha deixa a tabela densa em 800px.
  - Os opcionais ficam menos visíveis atrás do ⋮.
  - Precisa de uma decisão sua: o lápis do título renomeia todos os lançamentos do lugar? (Inferência a partir do grupo do Lunch Money.)
- **Peças:**
  - `src/componentes/Dinheiro.tsx`, `Resposta.tsx`, `Selecao.tsx` (tamanho sm na linha)
  - `Planilha.tsx` (LinhaPlanilha, CelulaPlanilha), `ValorNaLinha.tsx`, `Marcar.tsx`, `Menu.tsx`, `Botao.tsx`
  - Dialogo com `Localizacao.tsx` e `Anexos.tsx`
  - Os chips locais (`.chip`, `chipsCategoria()`) e `faltas()`/`fraseFalta()` de `telas/ImportarExtrato.tsx`

### Proposta B: "Do lugar, depois do lançamento" (evolução do modelo F)

Vem do bloco de leitura seguido do bloco de completar (Monny e Flint no Dribbble, só conceito), da summary list do GOV.UK (https://design-system.service.gov.uk/components/summary-list/) e da gaveta do Simplifi (https://community.simplifimoney.com/discussion/17050/new-feature-alert-enhanced-transaction-detail-view).

```
[ícone] Nome do lugar ✎         3 lançamentos, R$ 1.240,30
[Resposta: Falta ...]

Para os 3
 Categoria     (chips)(Outra ▾)
 Subcategoria  (chips)
 Pago com      [Selecao ▾]   Usar nos outros

Lançamentos
 ▸ 02/10  Pix enviado   Pix     R$ 692,06      (linha selecionada destacada)
   15/10  Pix enviado   Falta   R$ 300,00
   28/10  Compra        Débito  R$ 248,24

02/10, R$ 692,06                  (Cupom do lançamento selecionado)
 Hora        14:32 ✎
 Pago com    Pix ▾
 Descrição   Pix enviado Fulano ✎
 Local       + Adicionar
 Anexos      + Adicionar
```

- **Prós:**
  - Mantém o cupom que você já aprovou no F.
  - Coluna única, com escopo dito no título do bloco.
  - Os opcionais têm lugar visível.
- **Contras:**
  - Tela mais longa.
  - O detalhe continua longe da linha a que pertence.
  - Pago com aparece em dois lugares, no lugar e no lançamento, e isso pode confundir.
- **Peças:**
  - `Cupom.tsx` (LinhaCupom e `empilhado` para os anexos), `Selecao.tsx` (variante texto)
  - `.fEditavel` da tela, `Etiqueta.tsx` (falta), `Localizacao.tsx`, `Anexos.tsx`, `Planilha.tsx`

### Proposta C: "Completar à esquerda, banco à direita"

Vem das 3 colunas do Marlow (conceito no Dribbble, https://dribbble.com/shots/27797256-Accounting-Software-UX-for-Transactions-Review-Reconciliation) e do layout `lateral` do app.

```
[ícone] Nome do lugar ✎                              R$ 1.240,30
┌ Completar ─────────────────┐ ┌ Do extrato ───────────────┐
│ Categoria (chips)          │ │ 3 lançamentos             │
│ Subcategoria (chips)       │ │ 02 a 28/out               │
│ Pago com [▾] em todos      │ │ PreviaLancamento          │
└────────────────────────────┘ └───────────────────────────┘
Lançamentos (tabela como na A)
```

- **Prós:**
  - A separação entre o fixo e o editável fica física e óbvia.
  - A prévia mostra como o lançamento vai ficar.
- **Contras:**
  - Em 800px cada coluna fica com cerca de 380px.
  - A Baymard desaconselha layout de várias colunas: https://baymard.com/blog/avoid-multi-column-forms
  - No celular vira pilha de qualquer jeito.
- **Peças:**
  - `Formulario.tsx` (layout lateral, Lado), `Cupom.tsx`, `PreviaLancamento.tsx`, mais as da Proposta A para a tabela.

## 4) Recomendação

Eu faria a **Proposta A**. Ela resolve os 3 problemas mais graves só com proximidade: o fixo vira texto, o que vale para o lugar fica em cima e o que vale para o lançamento fica na linha dele. Também acaba com o "Editar sobe".

É o arranjo mais próximo do que o mercado faz com grupos e lote (Lunch Money, Meu Dinheiro, YNAB). Usa peças que já existem (Planilha, ValorNaLinha, Selecao, Menu) e no celular cada linha pode virar uma ficha com rótulo, sem outra disposição.

Antes de codar, preciso de uma decisão sua: o lápis do título renomeia todos os lançamentos do lugar?
