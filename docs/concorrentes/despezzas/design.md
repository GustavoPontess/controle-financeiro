# Despezzas — análise de design

> Como o produto deles é desenhado e o que vale (ou não) trazer pro nosso DS. Base: site público (landing light, ferramentas/auth dark) + mockups do app.

## Identidade

- **Wordmark:** "despezzas" em **lowercase, sans-serif bold, preto** — sem mascote. Minimalista, sóbrio. (Contraste com Pierre, que tem mascote-gato.)
- **Brand mark (ícone):** monograma **"ZZ"** (os dois z de despe**zz**as) num quadrado arredondado preto/branco — usado como app-icon e no card de login. É a "marca" compacta deles.
- **Motivo gráfico:** **arcos/curvas finas** cruzando no hero da tela de auth — abstrato, "pontes/conexão" (ironia: parecido com o nosso conceito de ponte). Usado como textura, não como logo.
- **Tom de marca:** acessível, direto, foco em **resultado/economia** ("economize sem esforço", "automatize"). Menos lúdico que Pierre, menos institucional que banco. Fala com classe média BR que quer praticidade.

## Cores

Produto **dual-theme** bem resolvido (light na landing, dark nas ferramentas/auth):

| Papel | Cor aprox. | Uso |
|---|---|---|
| Base light | branco `#FFFFFF` | landing, cards |
| Base dark | preto/grafite `~#0E0F10` | ferramentas, tela de auth, mockup |
| **Marca / destaque** | **verde-menta `~#34D27A / #3FD27A`** | gradiente do hero, CTAs "Abrir ferramenta", variação positiva, ícone $ de receita |
| Receita / positivo | verde | KPI Receitas/Recebido, badge de queda de gasto |
| Despesa / negativo | vermelho-coral `~#F75555` | KPI Despesas/Pago, gráfico, accent de resultado nas calculadoras |
| Texto primário | preto (light) / branco (dark) | títulos, valores |
| Texto secundário | cinza | labels, descrições |
| Botões primários | **preto sólido** pílula | "Baixe para iPhone", "Iniciar sessão", auth |

**Observações:**
- **Verde-menta é a cor de marca** — quase idêntico ao tom que usamos numa das nossas paletas. Eles usam com parcimônia (CTA, positivo, gradiente de fundo).
- **Botão primário é PRETO**, não verde — verde fica pro gradiente/accent. Decisão elegante (alto contraste, neutro).
- Gradiente verde→branco suave atrás do hero = respiro, "leveza".

## Tipografia

- **Sans-serif geométrica** (estilo Inter/Geist/SF), sem serifa em lugar nenhum. Wordmark e corpo na mesma família.
- Hierarquia por **peso + tamanho**, não por cor. H1 do hero **enorme e bold** ("Automatize seu controle financeiro").
- Valores monetários proeminentes nos cards (o número é herói) — igual padrão do mercado.

## Layout e componentes

- **Cards arredondados** (radius ~14–18px), borda sutil, sem sombra dura — profundidade por contraste de fundo. Mesmo idioma do Pierre e do nosso DS.
- **Pílulas pretas** para CTA primário; pílulas com ícone + seta externa (↗) nos botões de download.
- **Badge "Novo"** preto para anunciar features (OpenFinance, Versão Web, Assinaturas).
- **Grid 2 colunas** nas seções de feature (texto + mockup), empilha no mobile.
- **Mockup de iPhone** realista repetido (frame do device) pra mostrar telas — reforça mobile-first.
- **KPIs em grid 2×2** com ícone colorido + label pequeno + valor bold (Receitas/Despesas/Recebido/Pago).
- **Cards de ferramenta** (dark) com ícone em quadrado arredondado, seta externa, CTA verde.
- **Privacy toggle** (olho) pra ocultar saldo — detalhe de confiança.

## O que aprender (aplicável ao nosso DS)

**Vale inspirar:**
1. **CTA primário preto + verde só como accent** — alternativa elegante ao "tudo verde". Testar no nosso DS (botão neutro forte, marca no detalhe).
2. **Dual-theme limpo** (light marketing / dark ferramentas) — bem executado; referência de como alternar sem quebrar identidade.
3. **Separação Receitas/Despesas × Recebido/Pago no dashboard** (previsto×efetivado) — valida nossa feature recém-feita; o jeito deles (grid 2×2) é boa referência visual.
4. **Variação % vs mês anterior** com badge colorido no card de cartão — já no nosso radar (`/reports`), Despezzas reforça.
5. **Funil de ferramentas grátis (SEO)** — calculadoras "sem cadastro" como aquisição. Barato, alto alcance orgânico. Forte candidato pro nosso site.
6. **Privacy toggle (ocultar saldo)** — detalhe de confiança barato.
7. **Badge "Novo"** discreto pra comunicar features recém-lançadas.

**NÃO copiar:**
- Wordmark lowercase genérico — nossa marca **Pontes** (arco) tem mais personalidade; manter.
- Mobile-first dependente de loja — nosso web-first dá controle de billing e de UX desktop (nosso foco, por memória do produto: desktop primeiro).
- Densidade/sobriedade neutra — nosso diferencial é **personalização** (15 paletas + 7 fontes); Despezzas é monocromático verde fixo.

## Comparação rápida de design

| Dimensão | Despezzas | Pierre | Nós (Pontes Q5) |
|---|---|---|---|
| Tema | light + dark (dual, sem escolha rica) | dark-first | light/dark **+ 15 paletas + 7 fontes** |
| Cor de marca | verde-menta (CTA preto) | verde-menta | paleta escolhível pelo usuário |
| Personalidade | prático/econômico, sóbrio | tech/IA, lúdico (gato) | família/confiança, marca Pontes (arco) |
| Plataforma | mobile-first + web | web-first | web-first (desktop primeiro) |
| Marca visual | wordmark lowercase, arcos | mascote-gato | wordmark Pontes + arco |
| Densidade | média, respiro grande | premium, respiro grande | média, foco em clareza |
