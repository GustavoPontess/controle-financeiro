# Pierre — Análise de design

> Como o produto deles é desenhado, o que funciona, e o que vale (ou não) trazer pro nosso DS.

## Identidade

- **Mascote/logo:** cabeça de gato estilizada (entre gato e morcego), monocromática. Reaparece como **marca d'água gigante translúcida** atrás dos cards do dashboard — assinatura visual sutil.
- **Tom de marca:** lúdico + informal + pt-BR coloquial. Copy fala como amigo: *"bora revisar pra não pesar no bolso"*, *"seu dinheiro tem algo a dizer hoje"*. Agentes têm **personas nomeadas** (Albert, Marie, Galileu, Tio Patinhas) com ilustrações de gato → humaniza a automação.
- **Posicionamento visual:** premium, escuro, "tech/IA". Bem distante do visual "planilha/banco" tradicional.
- **Site de marketing (`lp.pierre.finance`):** single-page **dark**, navbar pílula (Recursos · Preços · Como funciona · Entrar), logo "Pierre" em **fonte script/manuscrita** + gato. Copy em **1ª pessoa** (o produto fala como pessoa). CTA branco "Começar agora".
- **Tela de login:** split dark; arte à direita = **foto editorial lúdica** (jovem sorrindo, óculos, **gato preto no ombro**, fundo tile de emojis de moeda 🪙). Estética meme/jovem — reforça "finanças sem sofrimento, sem cara de banco". Auth **WhatsApp-first + passwordless** (ver `produto.md`).

## Cores (tema escuro — padrão)

| Papel | Cor aprox. | Uso |
|---|---|---|
| Fundo base | `#0A0A0A` (preto quase puro) | canvas |
| Surface / card | `#141416`–`#18181B` | cards, com borda sutil `rgba(255,255,255,.06)` |
| **Marca / destaque** | **verde-menta `~#34D399 / #3DD68C`** | títulos de insight, CTAs, valores positivos, estado ativo das tabs, glow do plano Premium |
| Despesa / alerta | vermelho-coral `~#F43F5E / #EF4444` | gastos, variação negativa, linha "este mês" do gráfico |
| Atenção / restante | âmbar `~#F59E0B` | "restante" de parcelamento, warnings |
| Texto primário | branco `~#FAFAFA` | valores, títulos |
| Texto secundário | cinza `~#A1A1AA` | labels, descrições |
| Categorias | cor própria por categoria | badges (cada categoria tem cor+ícone fixos) |

Observações:
- Verde-menta é **a** cor da marca — usada com parcimônia, só no que importa (marca, CTA, positivo). Não polui.
- Vermelho/âmbar/verde formam o tripé semântico (gasto / atenção / saúde) consistente em todas as telas.
- Tema claro e Auto existem (Preferências), mas o produto foi claramente desenhado **dark-first**.

## Tipografia

- Sans-serif geométrica/grotesque (estilo Inter/Geist). Sem serifa em lugar nenhum.
- **Hierarquia por peso e tamanho**, não por cor: números grandes em **bold/extrabold** (saldos, faturas), labels pequenos em **uppercase + letter-spacing + cinza**.
- Valores monetários sempre proeminentes — o número é o herói de cada card.

## Layout e componentes

- **Cards arredondados** (radius generoso ~14–18px), fundo surface, borda 1px sutil, sem sombra dura (profundidade vem do contraste de fundo, não de drop-shadow).
- **Espaçamento generoso** — respiro entre seções, nada apertado.
- **Grid de 2 colunas** no dashboard (cards lado a lado), empilha no estreito.
- **Badges de categoria**: pílula com **ícone + cor** próprios da categoria — aparecem idênticos em transações, recentes, parcelas. Consistência forte.
- **Logos reais** de bancos (Nubank) e serviços (Supabase, OpenAI, Claude, Z-Api) puxados automaticamente — dá credibilidade e reconhecimento instantâneo.
- **Barras de progresso** em todo lugar (limite de cartão em 3 níveis, progresso de parcelamento, proporção de categoria) — comunicação visual de "quanto de quê".
- **Gráficos** (recharts-like): linha com área, mapa de calor (calendário), barras. Tooltips escuros arredondados.
- **CTA flutuante** "Conversar com o Pierre" com borda em **gradiente animado** (arco-íris sutil) — chama pro core de IA sem ser intrusivo.
- **Estados de loading**: skeletons cinza animados (não spinners).

## Motion / microinterações

- Skeletons no carregamento de cada tela.
- Insight do topo do dashboard **rotaciona** mensagens.
- Som + vibração opcionais em alertas (Preferências) — reforça o caráter de "app vivo que te avisa".
- Glow/gradiente animado no CTA de chat e no card de plano Premium.

## O que aprender (aplicável ao nosso DS)

**Vale trazer / inspirar:**
1. **Badges de categoria com ícone + cor fixos por categoria** — reforça reconhecimento; barato de fazer.
2. **Logos reais** de banco/serviço nas transações e assinaturas — alto ganho de credibilidade.
3. **Mapa de calor** de gasto diário — visual de alto valor percebido, derivável dos dados que já temos.
4. **Variação % por categoria vs mês anterior** com seta colorida — já planejado no nosso `/reports`; o jeito deles (tabela com barra + "novo") é uma boa referência.
5. **Insight em linguagem natural** no topo — mesmo sem IA, dá pra gerar frases-resumo simples ("você gastou X% a mais em Y").
6. **Tom de copy mais humano** — hoje nosso copy é mais neutro; um toque informal aproxima (sem exagerar).
7. **CTA único e claro** pro recurso-estrela (no caso deles, o chat).

**NÃO copiar (não combina com nós):**
- Tema dark-first fixo — nosso diferencial é **personalização** (15 paletas + 7 fontes). Manter.
- Mascote/personas de gato — é a marca *deles*. Nossa marca (Pontes, arco/ponte) tem outra personalidade (família, confiança). Não imitar.
- Densidade premium-tech — nosso público família pede clareza e acolhimento, não "cockpit de trader".

## Comparação rápida de design

| Dimensão | Pierre | Nós (Pontes Q5) |
|---|---|---|
| Tema | dark-first (claro/auto opcional) | claro/escuro **+ 15 paletas + 7 fontes** (personalização é o diferencial) |
| Personalidade | tech/IA, lúdico (gatos), informal | família/confiança, marca Pontes (arco), copy mais neutro |
| Cor de marca | verde-menta | paleta escolhível pelo usuário |
| Componentização | consistente (badges, barras, logos) | biblioteca Pontes (consistente também) |
| Densidade | premium, respiro grande | média, foco em clareza |
