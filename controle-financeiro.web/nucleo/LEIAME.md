# Núcleo Pontes (front)

O que é comum a todo projeto da Pontes Dev: o design system, o layout do app logado, as telas de acesso e de
segurança, o painel de dev, as travas do build e as regras. **Gerado** do app Pontes por
`scripts/exportarNucleo.mjs` (no repositório do app); a versão de origem está em `../VERSAO.txt`.

## A regra

1. **Seguir, não se inspirar.** O projeto usa estes arquivos como estão. Mesma cor, mesma medida, mesmo componente,
   mesma tela. Nada de rascunho em HTML solto nem "direção" nova de visual.
2. **A cópia não se edita no projeto.** Precisou mudar algo comum (um componente, o layout, uma tela de acesso)?
   Pede ao Gustavo: a mudança nasce no app Pontes, o núcleo é gerado de novo e o projeto puxa.
3. **O que é do projeto fica fora destas pastas:** as telas do produto (agenda, conversas…), os services e types
   delas, o `layout/menu.ts` e a marca. Tela nova é montada SÓ com as peças de `src/componentes/`; peça que não
   existe e serve pra mais de uma tela é pedida pro núcleo, não criada no projeto.
4. **Uma trava no projeto** compara as pastas copiadas com o núcleo e falha se divergirem.

## O que vem

| Pasta | O que é |
|---|---|
| `src/estilo/` | `tokens.css` (cores, fontes, raios, sombras, tema claro/escuro) e `global.css`. Cor nunca crua na tela: sempre `var(--v2-*)` |
| `src/componentes/` | As peças: `Botao`, `Campo`, `Entrada`, `Selecao`, `SeletorData`, `EntradaValor`, `Segmentos`, `Interruptor`, `Marcar`, `Etiqueta`, `Bloco`, `Formulario`, `Planilha`, `SecaoPlanilha`, `ListaFicha`, `ListaPorDia`, `Paginacao`, `Busca`, `PainelFiltros`, `NavSecoes`, `NavegadorMes`, `Menu`, `Dialogo`, `Confirmar`, `Resposta`, `Avatar`, `VerificacaoHumana` (Turnstile da Cloudflare)… |
| `src/layout/` | `V2Layout.tsx` (menu lateral, topo, menu da conta, barra de atalhos no celular, margens do iPhone) e o CSS. **Só o `menu.ts` muda por projeto** (itens, ação principal, atalhos) |
| `src/auth/`, `src/api/` | Sessão: cookie httpOnly + CSRF, renovação única no 401, multi-conta, duas etapas, sair por inatividade |
| `src/telas/` | Entrar, Pedir acesso, Criar senha nova, links do e-mail, Proteja sua conta, Configurações (segurança e login, perfil, aparência, app no celular, dados e exclusão da conta), Notificações |
| `src/site/` | A moldura das telas de acesso (foto + frase) e o recorte do CSS dela. Frase, foto e benefícios: trocar pelos do produto |
| `src/admin/`, `admin.html` | Mini-app do admin, fora do pacote do app (aprova pedidos de acesso, lê solicitações) |
| `src/pwa/` | App instalável: manifesto, service worker que nunca guarda `/api`, botão Instalar e passo a passo do iPhone |
| `src/dev/` | Painel de dev (estados da tela, contas de teste), só em desenvolvimento |
| `src/utils/` | Relógio único no fuso da conta (`dateTime.ts`), espera de digitação, máscara de e-mail |
| `scripts/` | Travas do build: admin fora do pacote, dev fora do build, hash do script inline no CSP |
| `src/test/` | Testes que leem o código: relógio único, sem travessão, admin fora |
| `CONVENCOES.md` | As regras do front, uma por decisão |
| `REGRAS.md` | As regras gerais (segurança, LGPD, processo) |

## Como o projeto puxa

Um script no projeto (ex. `scripts/puxarNucleo.mjs`) copia `web/` por cima das mesmas pastas, sem tocar no que é do
projeto, e grava a versão. A trava do item 4 roda no `npm test`.
