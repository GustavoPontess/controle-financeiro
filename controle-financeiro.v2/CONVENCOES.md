# Convenções do front v2

Regras curtas pra toda tela nova seguir o mesmo padrão. Se uma regra daqui atrapalhar, muda a regra aqui — não abre exceção na tela.

## Estilo global

- **Tokens** (`src/estilo/tokens.css`): cor, fonte, tamanho de letra (`--v2-fs-*`), raio (`--v2-r-*`), sombra. Moram no `:root`; o tema é `data-tema="claro|escuro"` no `<html>` (aplicado no `index.html` antes do 1º desenho e mantido pelo `useTema`).
- **Base global** (`src/estilo/global.css`): box-sizing, fundo/cor/fonte da página, seleção de texto, foco de teclado, **barra de rolagem** e `prefers-reduced-motion`. Visual que vale pro app inteiro mora aqui — nunca remendado dentro de um componente.
- Os dois CSS globais são importados **antes** de qualquer componente no `main.tsx` (o CSS de componente vem depois e ganha no empate).
- Tela usa CSS Module ao lado do `.tsx`, sempre com `var(--v2-*)`. Nada de cor ou tamanho de letra cru.

## Componentes (`src/componentes/`)

Peça que aparece em mais de uma tela vira componente aqui. A tela escolhe **variante e tamanho**; medida e cor ficam no componente. `className` nos componentes é só pra posição/largura no layout da tela.

| Precisa de… | Use | Notas |
|---|---|---|
| Botão | `Botao` | `variante` primario / secundario (padrão) / texto · `perigo` · `tamanho` md 36 / lg 44 · `soIcone` · `ativo` · `cheio` · `compactoNoCelular` · `icone` |
| Campo de formulário | `Campo` | rótulo + controle + erro. `erro` deixa o controle vermelho e liga a mensagem (aria). `grupo` pra 2 controles ("de … até"), `estatico` + `ValorFixo` pra valor que não muda |
| Caixa de texto | `Entrada` | md 44 / sm 40 · `prefixo` ("R$") · `sufixo` (ex.: olho da senha). Dentro do `Campo` herda id e erro sozinha |
| Escolha numa lista | `Selecao` | no lugar de `<select>`. md 44 / sm 40 / xs 32. Dentro do `Campo` herda id e erro |
| Paginação de lista | `Paginacao` | linhas por página + páginas numeradas; servidor pagina |
| Confirmar ação | `Confirmar` | excluir/estornar; `perigo` pra destrutiva |
| Caixa de conteúdo | `Bloco` | título + ação à direita |
| Valor em dinheiro | `Dinheiro` | respeita "esconder valores" |

## Formulário

- Todo campo dentro de `Campo` (nunca `<label>` solto com `<input>` estilizado na tela).
- Valida ao enviar, mostra erro **no campo** (vermelho, embaixo), limpa o erro ao editar, não chama o servidor se estiver inválido. Erro do servidor vai num aviso no topo do formulário.
- Limite de caracteres igual ao do back (ex.: descrição 255).
