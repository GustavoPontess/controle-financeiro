# Convenções do front v2

Regras curtas pra toda tela nova seguir o mesmo padrão. Se uma regra daqui atrapalhar, muda a regra aqui — não abre exceção na tela.

## Estilo global

- **Tokens** (`src/estilo/tokens.css`): cor, fonte, tamanho de letra (`--v2-fs-*`), raio (`--v2-r-*`), sombra. Moram no `:root`; o tema é `data-tema="claro|escuro"` no `<html>` (aplicado no `index.html` antes do 1º desenho; a escolha fica em **Configurações → Aparência** via `useTema`, estado compartilhado em `layout/useTema.ts`).
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
| Data | `SeletorData` | no lugar de `<input type="date">` (calendário próprio, tema, teclado). `min`/`max`, `limpavel` pra data opcional. Valor sempre `YYYY-MM-DD` |
| Valor em dinheiro (campo principal) | `EntradaValor` | R$ grande, dígitos viram centavos, nunca negativo, até 12 dígitos · `compacto` = caixa comum com "R$" na frente, pra dinheiro secundário que divide a linha (saldo inicial, limite) |
| Valor em dinheiro (filtro/campo pequeno) | `Entrada` + `prefixo="R$"` + `maskMoney` | nunca `type="number"` (aceita sinal de menos) |
| Escolha única curta (2–4 opções) | `Segmentos` | radiogroup com setas; `cheio` pra ocupar a largura |
| Liga/desliga | `Interruptor` | role=switch ("Já paguei", "Conta fixa") |
| Status | `Etiqueta` | tom positivo / negativo / alerta |
| Layout de formulário | `Formulario`, `LinhaCampos`, `RodapeFormulario` | `layout="pilha"` empilha; `layout="lateral"` = `<Campos>` à esquerda + `<Lado>` (prévia, opções, rodapé) à direita, 1 coluna no celular. `LinhaCampos colunas="2fr 1fr"` pra proporção sob medida |
| Prévia do lançamento | `PreviaLancamento` | "Como vai aparecer": linha igual à da lista + frase do efeito; some no celular |
| Lista de lançamentos por dia | `ListaPorDia` | Transações, fatura do cartão… — cabeçalho do dia, linha com inicial/ícone, nome, detalhe, hora, etiqueta, valor. Mantém a ordem recebida |
| Barra de proporção | `BarraProgresso` | limite usado, fatura paga, parcelas pagas (4px, tom alerta/negativo/positivo) |
| Carinha do cartão | `FaceCartao` | cartão em miniatura (proporção 1,6:1) na cor do banco: chip, bandeira no canto, últimos dígitos no `lg` (md 72×45 na lista, lg 112×70 no cabeçalho) |
| Busca de lista | `Busca` | lupa + input de pesquisa, 36px, à esquerda da barra da lista (Transações, Cartões); quem filtra é a tela |
| Casca de tela de formulário | `PaginaFormulario` | título + aviso de carga/esqueleto + o formulário (Nova transação, Novo/Editar cartão) |
| Ações de uma linha | `Menu` | ⋮ com itens (ícone, perigo); fecha fora/Esc/ao escolher. Pra ação que não merece botão na linha |
| Paginação de lista | `Paginacao` | linhas por página + páginas numeradas; servidor pagina |
| Confirmar ação | `Confirmar` | excluir/estornar; `perigo` pra destrutiva |
| Caixa de conteúdo | `Bloco` | título + ação à direita |
| Valor em dinheiro | `Dinheiro` | respeita "esconder valores" |

## Formulário

- Todo campo dentro de `Campo` (nunca `<label>` solto com `<input>` estilizado na tela).
- Valida ao enviar, mostra erro **no campo** (vermelho, embaixo), limpa o erro ao editar, não chama o servidor se estiver inválido. Erro do servidor vai num aviso no topo do formulário. O erro do campo **não ocupa altura** (desenha no respiro de 18px entre campos — aparecer/sumir não mexe na tela), então é **uma linha curta** (corta com reticências; texto inteiro no title).
- Limite de caracteres igual ao do back (ex.: descrição 255).
- Hover de linha de lista usa `--v2-hover-linha` (cor do fundo da página), nunca `--v2-superficie-2`: essa é a cor da bolinha, da etiqueta e do trilho que ficam DENTRO da linha e sumiam ao passar o mouse (2026-10-15).
- Busca com espera de digitação: `utils/useAtrasado.ts` (Transações, lançamentos da fatura) — nunca bater no servidor a cada tecla.
- Conta bancária: tipos, validação (agência/número) e a linha de detalhe em `src/dominio/conta.ts`. Conta **encerrada** sai das seleções (`getContas()` já filtra; a tela de contas pede `incluirEncerradas`).
- Tipos de conta e grupos da lista (em conta / poupança / investimentos / dinheiro por último) vêm de `src/dominio/conta.ts` (`TIPOS_CONTA`, `ehGuardado`, `ehDinheiro`, `temDadosBancarios`): Dinheiro não tem banco/agência/número (o formulário esconde); "Guardado" = poupança + investimentos; a carteira é sempre dinheiro, mesmo com tipo antigo.
- **Bancos é só das contas** (decisão 2026-10-15, modelo Pierre): a linha abre, ali embaixo, a ficha (banco, tipo, agência, número) e as ações — sem página de detalhe nem extrato ali. Extrato é Transações: o link "Ver lançamentos" manda `state.filtros` e a tela já abre filtrada. Outra tela devolve a pessoa pra lista com a conta aberta por `state.abrir` (Nova/Editar/Encerrar fazem isso).
- Conta fixa: repetição e situação em `src/dominio/contaFixa.ts`; criar/editar é o `FormularioTransacao` (prop `recorrente` edita a regra; `inicial={{ fixa: true }}` abre já como conta fixa).
- Ciclos de fatura (meses contínuos, vazio quando não há fatura, estado da fatura) moram em `src/dominio/fatura.ts` e espelham o servidor.
- Listas e regras de domínio usadas por mais de uma tela (meios de pagamento, parcelas, frequências, limites) moram em `src/dominio/`, não copiadas por tela.
- Topo: olho (esconder valores) · sino (não lidas, `estado/notificacoes.ts`, consulta a cada minuto e a cada troca de tela) · "Nova transação". Menu lateral: só as seções; **Configurações e Sair ficam no menu da conta** (o bloco avatar + nome no pé é um botão, em todo estado do menu — aberto, trilho e gaveta). Tela sem item no menu (Notificações) é `semMenu` em `secaoDaRota`: ganha a seta de voltar pra onde a pessoa estava.
- Telas de autenticação (Entrar, Cadastro, Redefinir senha) dividem `telas/Auth.module.css` (palco + painel). Regra de senha em `src/dominio/senha.ts` (espelha o servidor: 15–128, sem composição; senhas comuns só no servidor). Cadastro: aceite da Política de Privacidade **nunca** pré-marcado (LGPD); no beta não loga — mostra a mensagem da API (conta aguardando aprovação). Redefinir senha (`/redefinir-senha?token=`) é a tela do link do e-mail; sem token ou com token vencido, manda pro Entrar já no passo "esqueci" (`state.esqueci`). Termos e Privacidade são telas públicas do v2 (`telas/Legal.tsx`), e os links do Entrar/Cadastro apontam pra elas.
- Configurações: seções uma embaixo da outra, largura toda (aparência, segurança — verificação em duas etapas em `telas/SegurancaMfa.tsx`: QR + chave, confirmar com código, códigos de recuperação mostrados UMA vez, desativar pede senha + código —, conta). Gustavo não quis lado a lado (2026-10-15). O campo de código do login aceita código de recuperação (tem letra: sem teclado só numérico).
- Estado compartilhado entre telas (olho, contador do sino, tema) mora em `src/estado/` (ou `layout/useTema.ts`) com `useSyncExternalStore` — nunca prop drilling nem contexto só pra isso.
- "Voltar" é a seta no **topo**, antes do título da seção (o layout põe sozinho em toda rota abaixo da raiz da seção) — a página não repete o nome da seção nem desenha link de voltar.
- Ações da página (salvar, editar, excluir, estornar) ficam **no pé, à direita**, no `RodapeFormulario` — nunca no cabeçalho. Destrutiva à esquerda, principal à direita.
- Página de formulário/detalhe **não** tem `max-width`: o conteúdo termina na mesma linha dos botões do topo (fresta à direita parece erro de alinhamento).
- Formulário de dinheiro = layout lateral com `PreviaLancamento` à direita. Criar e editar usam **o mesmo** componente (`telas/FormularioTransacao.tsx`, com ou sem `transacao`) — nunca dois formulários parecidos que divergem.
- Filtro de período: o back trata `to` como exclusivo (`Data < to`) — mande `diaSeguinte(ate)` pra o "até" incluir o dia.
