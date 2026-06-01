# Pierre — Produto, rotas e telas

> Mapa de todas as rotas navegadas, o que cada tela faz e os detalhes de interação (cliques dentro de cada uma).

## Pré-login — site público completo (`lp.pierre.finance`)

> Capturado em 2026-05-31. O site público vive no subdomínio `lp.pierre.finance` (separado do app `pierre.finance/dashboard`). **Mapeamento exaustivo de TODAS as páginas/links públicos abaixo.**

### Mapa do site público (tudo que existe antes do login)

| Página/destino | Tipo | URL |
|---|---|---|
| **Landing** (single-page) | marketing | `lp.pierre.finance/` |
| ↳ Recursos | âncora da landing | `#features` |
| ↳ Preços | âncora da landing | `#pricing` |
| ↳ Como funciona | âncora da landing | `#about` |
| **Central de Ajuda** | página própria | `lp.pierre.finance/ajuda` |
| **Política de Privacidade** | legal | `pierre.finance/privacy-policy` |
| **Termos de Uso** | legal | (link no footer) |
| **Login/Cadastro** | auth | `pierre.finance/login` (ver seção própria) |
| Instagram | social | `@pierre.finance.ai` |
| **Discord** (comunidade) | social/comunidade | `discord.gg/QurJK5p7GJ` |
| WhatsApp (falar com o Pierre) | canal | `wa.me/5511953250832` |
| App Store / Google Play | download app | via `pierre.onelink.me/...` + QR code |

**Observações de estrutura:**
- Site público é **enxuto**: uma landing single-page + página de ajuda + legais. **Não tem blog** (≠ Despezzas, que tem ~400 artigos). O trust/awareness do Pierre vem de **imprensa** + **comunidade Discord**, não de SEO de conteúdo.
- **Tem app mobile** (App Store + Google Play, com QR code no footer) — apesar de eu ter analisado o web app.
- **Central de Ajuda** (`/ajuda`) = formulário de suporte (Nome, Email, Assunto, CPF/CNPJ, Mensagem) + FAQ. Assuntos do dropdown confirmam a superfície do produto: *Alteração de dados cadastrais · Dúvidas sobre o App · Problemas com o App · Chat do Pierre · Agentes do Pierre · Problema ao conectar banco · Outro*. Suporte seg-sex 10h–16h via chat no app + `ajuda@pierre.finance`.
- Footer: logo + "Seu assistente de IA para finanças pessoais" + social + Termos/Ajuda + badges de loja + **QR code com o gato no centro**.

**Como divulgam (pitch):**
- **IA personificada em 1ª pessoa.** Headline: *"Não gerencie mais seu dinheiro sozinho"*. Copy: *"Olá, eu sou PIERRE e meus agentes inteligentes monitoram, organizam e agem pra tornar sua vida financeira mais fácil, sem sofrimento."* O produto se apresenta como **uma pessoa/assistente**, não um app.
- **Agentes nomeados** (Marie, Einstein, Galileu) como estrelas — automação humanizada.
- **Anti-planilha:** posicionamento de imprensa repetido = *"transforma gestão financeira em uma conversa — sem planilhas, sem gráficos confusos"*. Vendem **conversa**, não dashboard.
- **CTA primário:** "Começar agora" (branco sobre preto) + "Conversar/Fale com o Pierre".

**Blocos de feature da landing (cada um com CTA):**
1. *"Surpresas na fatura? Comigo, não"* — organiza a fatura → "Descobrir surpresas".
2. *"Eu te mostro pra onde seu dinheiro tá indo"* — categorização → "Categorizar gastos".
3. *"Entenda o que pesa no próximo mês"* — assinaturas/boletos/parcelas futuras → "Planejar finanças".
4. *"Seus investimentos, do jeito que deveriam ser"* — **visão de carteira de investimentos** → "Ver investimentos".
5. *"Pergunte do seu jeito que eu entendo"* — chat NL ("Quanto gastei?", "Tô gastando muito?") → "Converse comigo".

**Confiança/segurança (seção "Como eu funciono"):** Criptografia **AES-256**, conexão via **Open Finance** (nunca pede senha), **somente leitura** (não movimenta dinheiro), **regulamentado pelo Banco Central**. Aborda de frente o medo de conectar o banco.

**Prova social:** carrossel "Pierre na mídia" (várias matérias). Destaque: *"Pierre, assistente de IA para finanças, vira aposta da **Cloudwalk** para crescer com o consumidor final"* → **Pierre é bancado pela Cloudwalk** (fintech grande BR, dona da InfinitePay). Concorrente bem financiado.

**Canal extra:** integração **WhatsApp** ("Converse no WhatsApp") — falar com o Pierre fora do app.

**Planos (na landing, toggle Mensal/Anual −19%):**
| Plano | Preço | Inclui |
|---|---|---|
| Básico | Grátis | 1 banco, 1 agente IA, limite de conversas, WhatsApp |
| **Pro** (Mais Popular) | **R$ 39/mês** | até 5 bancos, 2 agentes, lembretes de pagamento, relatórios personalizados, maior limite de conversa |
| Premium | **R$ 199/mês** | bancos ilimitados, até 10 agentes, conversas ilimitadas, acesso prioritário a novidades |

Monetização = **nº de bancos conectados + nº de agentes IA + volume de conversa**. O CRUD/visão é grátis; cobram a automação e a integração.

**FAQ (perguntas):** é seguro? · como conecta os bancos? · posso cancelar? · funciona com todos os bancos? · como funcionam os alertas? · diferença entre planos? · tem acesso pra movimentar meu dinheiro? (todas focadas em **confiança + escopo da IA**).

## Tela de login (`pierre.finance/login`) — deslogado

> Layout split dark. Direita = foto lúdica/jovem (pessoa sorrindo de óculos + **gato preto** no ombro = mascote, fundo tile de emojis de moeda 🪙) — estética meme/jovem, distante de "app de banco".

**Autenticação WhatsApp-first + passwordless (achado forte):**
- **Default = WhatsApp:** headline *"Qual seu Whatsapp?"* + *"Inicie seu cadastro ou acesse sua conta."* + campo número (+55) + botão "Começar". O **número de WhatsApp é a identidade** — sem senha. Amarra direto no canal de agente WhatsApp deles.
- **Variante e-mail** ("Logar com E-mail"): *"Qual seu email?"* + campo único "Digite seu email" + "Começar". **Também sem senha** (OTP/magic-link).
- Alternativas: **Continuar com Google · Continuar com Apple**.
- **Fluxo único cadastro+login** (mesma tela, "inicie seu cadastro OU acesse"). Fricção mínima — nada de "criar senha", "confirmar senha", etc.

**Contraste:** Despezzas usa Google/Apple/**e-mail+senha** (login tradicional). Pierre é mais ousado (WhatsApp + passwordless). Nós: e-mail+senha + refresh/reset. Pierre tem o onboarding de menor fricção dos três.

---

## Mapa de rotas

| Rota | Tela |
|---|---|
| `/dashboard` | Visão geral ("Vision") |
| `/dashboard/transactions` | Transações |
| `/dashboard/recurring` | Parcelamentos |
| `/dashboard/subscriptions` | Assinaturas |
| `/dashboard/categories` | Categorias (analítica) |
| `/dashboard/credit-cards` | Cartões |
| `/chat` | Fale com o Pierre (chat IA) |
| `/agents` | Agentes (automações IA) |
| `/my-account` | Configurações |
| `/my-account/preferences` | Preferências |

Navegação principal por **tabs no topo** (Visão geral · Transações · Parcelamentos · Assinaturas · Categorias · Cartões) + **sidebar** (Upgrade · Fale com o Pierre · Agentes · Vision · Whatsapp · Recentes/histórico de chat).

---

## 1. Dashboard / Visão geral (`/dashboard`)

📷 Print: *dashboard-visao-geral*, *dashboard-mapa-calor*, *dashboard-transacoes-assinaturas*

- **Card de insight IA** (rotativo): título grande verde + frase humana personalizada. Ex.: *"Vamos transformar números em decisões."* / *"Ei, seu dinheiro tem algo a dizer hoje."* + *"Gustavo, gasolina subiu 300%! Bora revisar esses gastos pra não pesar no bolso."* Embaixo: 3 mini-stats (Gasto no mês, vs. mês anterior, Maior gasto).
- **Ritmo de gastos**: número grande (R$ 832,26 *acima*) + badge de variação (+20.3%) + **gráfico de linha** este-mês (vermelho) vs mês-passado (cinza tracejado), eixo de dias 1→31.
- **Contas correntes**: saldo total + lista de contas (Nubank, Carteira Pierre).
- **Limite total disponível**: número grande + cartão.
- **Mapa de calor**: calendário estilo GitHub (dias × semanas), célula mais vermelha = mais gasto. Total do mês + média diária + maior gasto/dia.
- **Principais categorias**: tabela Categoria | Atual | barra vs mês anterior | **Variação %** (com seta) | Anterior. Categoria nova marcada como **"novo"**. Ex.: Postos de gasolina R$ 802 ↗301% vs R$ 200.
- **Transações recentes**: agrupadas por dia (Ontem / Sex, Mai 29 / ...), com ícone, descrição, badge de categoria, valor colorido.
- **Assinaturas**: total/mês + lista com logo, próximo vencimento, valor.

## 2. Transações (`/dashboard/transactions`)

📷 Print: *transacoes-lista*, *transacoes-detalhe-modal*

### Filtros (coleta logada 2026-05-31 — detalhado)

Barra de **5 filtros + toggle + busca**:
1. **Período** — presets: Todo período · Últimos 30 dias · Últimos 90 dias · Este mês · Mês passado · Últimos 6 meses · Este ano · Ano passado **+ range custom** (calendário de 2 meses + Aplicar).
2. **Conta** — "Todas Contas" + por conta/cartão.
3. **Tipo** — Todas Transações · Saídas (Despesas) · Entradas (Receitas).
4. **Ordenação** — Data (mais recentes) · Data (mais antigas) · Valor (maior primeiro) · Valor (menor primeiro).
5. **Categorias** — **multi-select hierárquico**: busca "Buscar categoria", "Todas Categorias", grupos expansíveis (Alimentação, Compras, Saúde e bem-estar, Serviços digitais, Transporte, Moradia…) com **contador X/Y** (subcategorias selecionadas/total, ex: Transporte 4/12) + chevron pra expandir subcategorias + Cancelar/Aplicar.
6. **Toggle "Mostrar ocultos"**.
+ **Busca** textual.

KPIs no topo: Total (nº) · Despesas · Receitas · Saldo.

### Validação CRUD manual vs Open Finance (promessa×realidade)

- **Criar manual (Nova Transação)** é **limitado à "Carteira Pierre" (dinheiro)** — conta fixa, não selecionável. Tooltip: *"Registre apenas transações em dinheiro. Saques do banco já aparecem no extrato automaticamente."* Campos: Conta(fixa) · Valor · Descrição · Categoria · Tipo (Débito/Saída) · Data · **Moeda (multi-moeda)**.
- **Transação bancária (Open Finance)** — menu de 3 pontos só tem **"Ocultar"**. **Não dá pra editar nem excluir** dado importado, só esconder.
- **Conclusão:** Pierre é **detect-and-correct puro**. O usuário não gerencia lançamentos bancários (read-only + ocultar); CRUD manual existe só pra dinheiro vivo. Oposto do nosso "create-manual" (CRUD completo em qualquer conta).

**Teste real executado (2026-05-31, criar→ocultar):**
- Criei transação manual "Cafe" R$ 12,50, categoria "Alimentos e bebidas", Carteira Pierre → toast *"Transação criada com sucesso!"*. KPIs atualizaram **ao vivo** (Total 52→53, Despesas +12,50, Saldo −12,50). Categoria no modal tem **busca + criar inline** ("Buscar ou digitar nova categoria") e é hierárquica.
- **Surpresa:** o menu da transação **manual** também só tem **"Ocultar"** — **sem editar, sem excluir**. Pierre **não tem edit/delete em transação nenhuma** (nem manual nem bancária). É um **ledger imutável**: só ocultar.
- **Ocultar** → toast "Transação ocultada"; some da lista **e sai dos totais** (Despesas/Saldo voltaram ao valor pré-Cafe). Recuperável via toggle "Mostrar ocultos".
- **Implicação pra nós:** é uma decisão de produto radical (sem edição). Pra nós (create-manual) editar/excluir é essencial. Mas o "ocultar que tira do total" é um padrão interessante pra dado de Open Finance que a gente não quer deletar.

- **Filtros (linha):** Período · Conta · Tipo · Ordenação · Categoria · toggle "Mostrar ocultos" (detalhe completo em `comparativo.md`).
- **4 KPIs:** Total (contagem) · Despesas · Receitas · Saldo.
- **Busca** + botão **Nova Transação**.
- **Tabela:** Descrição (ícone/logo + nome) · Categoria (badge com ícone+cor) · Conta · Data · Valor · menu (⋮).
- **Clicar numa transação** → modal **"Detalhes da Transação"**: dados + botão Editar + **"Transações Semelhantes"** (histórico do mesmo estabelecimento/destino). Revela recorrência oculta — ex.: uma transferência mostrou 6 pagamentos ~R$85/mês na categoria Saúde.
- **Menu (⋮) da transação:** só **"Ocultar"** (sem excluir — dado vem do banco).
- **Modal Nova Transação:** Conta · Valor · Descrição · Categoria (busca + criar inline + agrupado) · Tipo (Débito/Crédito) · Data · **Moeda** (multi-moeda). Tooltip: *"Registre apenas transações em dinheiro. Saques do banco já aparecem no extrato automaticamente."*

## 3. Parcelamentos (`/dashboard/recurring`)

📷 Print: *parcelamentos-lista*, *parcelamentos-detalhe-timeline*

- **Hero:** nº em andamento · Valor total estimado · Já pago · Restante · **barra de progresso geral (% pago)** · projeção "Última parcela: Novembro 2026".
- **Tabs:** Em andamento (N) / Finalizadas (N) + Ordenar por + Mostrar ocultos.
- **Lista:** ícone, nome, badge "Ativo", `X/Yx`, R$/mês, conta, **barra de progresso individual**, valor restante, menu, expandir.
- **Expandir:** mini-cards (Total estimado · Pago · Restante · Última) + badge de categoria + data da compra + início do parcelamento + **timeline das N parcelas** (paga ✓ verde com data+valor; futuras em cinza).
- **Menu (⋮):** só **"Ocultar"**.

## 4. Assinaturas (`/dashboard/subscriptions`)

📷 Print: *assinaturas-lista*

- **Hero:** nº ativas · Gasto mensal · **Projeção anual** · **Média/serviço**.
- **Filtro por conta** + Adicionar.
- **Lista:** logo do serviço, nome, descrição (origem do extrato — ex.: "Openai *Chatgpt Subscr"), próximo vencimento, nº de pagamentos detectados, conta, valor/mês.
- **Detecção automática** pelo extrato (reconhece e atribui logo).
- **Menu (⋮):** só **"Não é uma assinatura"** (corrige falso positivo da detecção).

## 5. Categorias (`/dashboard/categories`)

📷 Print: *categorias-analitica*

- Tela **analítica** (não é CRUD): donut grande + navegação de mês (`< Maio De 2026 >`) + total gasto.
- **Lista hierárquica:** Grupo (badge com nº de subcategorias, cor própria, barra de proporção, valor) → subcategorias (ícone, nome, valor, barra). Ex.: Finanças R$ 1.634 → Empréstimos / Transferências; Transporte R$ 930 → Postos R$ 802 / Pedágios / Manutenção.
- Grupos expansíveis/recolhíveis.

## 6. Cartões (`/dashboard/credit-cards`)

📷 Print: *cartoes-fatura-limite*, *cartoes-faturas-anteriores*

- **Hero:** Fatura atual (número grande).
- **Cartão:** logo do banco, ****final, **Fatura estimada** (com ⓘ), **Fecha dia N (editável ✏️ inline)**, Vence DD/mês.
- **Limite em 3 níveis:** barra com **Usado** / **Disponível** / **Limite máximo** (de Limite total).
- **Disclaimer honesto:** *"Valores marcados como 'Fatura estimada' são calculados a partir da soma das transações... pode não refletir o valor exato, pois o banco não envia essa informação antes do vencimento."*
- **Faturas anteriores:** gráfico de barras histórico mês a mês (Jan→Jun) com navegação — mostra tendência da fatura.

## 7. Fale com o Pierre (`/chat`)

📷 Print: *chat-ia*

- Chat IA conversacional (estilo ChatGPT/Claude): *"Olá Gustavo, Como eu posso te ajudar hoje?"*, campo de mensagem + **anexo de arquivo** + enviar, sugestões.
- Histórico de conversas na sidebar (Recentes), **auto-titulado** (minha pergunta virou "Gastos do mês").

**Teste logado (2026-05-31) — validação da promessa "converse comigo":**
- Perguntei *"Quanto gastei esse mês?"*. Resposta em ~10s, **agêntica** ("Concluí 1 etapa" = rodou tool de consulta) e **data-grounded**.
- Renderizou um **widget de dados inline**: card "Entradas vs Saídas — R$ 3.465,78 · 1–31 mai · Todas as contas/Nubank · **↑41% economizado**" + **gráfico de barras** (Receita R$ 8.398,50 verde × Despesas R$ 4.932,72 vermelho) + legenda.
- Texto NL: *"Gustavo, neste mês suas saídas somaram R$ 4.932,72. Como suas entradas foram R$ 8.398,50, você manteve taxa de poupança de 41%. Vale notar que é estimativa, já que a fatura oficial ainda não foi consolidada."* — **números batem exatamente** com a tela de Transações.
- **Chips de follow-up** contextuais ("Me mostra o detalhamento dos gastos?", "Quero ver o gráfico de receita vs despesa", "Me lista as maiores...") + botões copiar/like/dislike.
- **Veredito:** chat é **real, preciso, agêntico e renderiza gráficos** — não é decorativo. É o ativo mais forte do produto e o mais difícil de copiar (LLM + tool-use sobre dados financeiros). Promessa entregue com folga.

## 8. Agentes (`/agents`)

📷 Print: *agentes-galeria*, *agentes-historico-execucoes*

- **Hero:** *"Seus agentes trabalham por você — Monitore, analise e economize, no piloto automático"* + plano + "Criar agente".
- **Stats:** Ativos · Pausados · Disparos.
- **Sugestões (templates):** Tio Patinhas (analisa investimentos), Santos Dumont (passagens aéreas em promoção), Megamen (alerta ao ultrapassar limite de gastos) — cada um com ilustração de gato.
- **Meus Agentes:** personas nomeadas (Albert — Monitor Diário/Semanal; Marie/Mensal; Galileu/Semanal) com frequência e contador de disparos, badge "Pierre".
- **Clicar num agente** → modal **"Histórico de execuções"** (últimas 10 rodadas, log auditável; "nenhuma execução ainda" se não rodou).

**Teste logado (2026-05-31) — validação da promessa "agentes trabalham por você":**
- Abri o histórico do agente **Galileu** (Semanal, 4 disparos). Execução de 31/mai 17:35 com status **"Enviado"**, título *"Semana que contou uma história de ajustes"* + **análise narrativa longa gerada por IA**: compara a semana atual com a anterior, identifica que os gastos ficaram ~3× maiores, atribui a "parcela alta de reforma + gasolina + manutenção do carro", e levanta hipóteses ("será que rolou algum conserto ou investimento na casa?"). Linguagem de conselheiro humano, não tabela.
- **Promessa confirmada como real:** o agente roda no agendamento, **gera insight personalizado de verdade** sobre os dados do Open Finance e **envia** (status Enviado → notificação/WhatsApp). Não é vaporware.
- **Paywall:** clicar **"Criar agente"** no plano grátis (BASIC, limite 1) abre direto o **modal de upgrade** (Pro R$39 até 5 agentes / Premium R$199 até 10). Agentes são a trava de monetização central.
- **Pra nós:** é o core deles e o mais caro de copiar (IA + agendamento + Open Finance). Nosso "insights em linguagem natural" pode começar com **regras simples** (sem IA) gerando frases-resumo — entrega 20% do valor percebido por 5% do custo.

## 9. Configurações (`/my-account`)

📷 Print: *config-conta*, *config-preferencias*

- Avatar + nome. 2 cards: **plano** e **"2 Bancos" conectados** (confirma Open Finance).
- **Geral:** Perfil · Preferências · Assinatura · **API Keys** (acesso programático pro usuário — dev-friendly). **Suporte:** Falar com suporte · Reportar um problema · **Sair** (logout).
- **Segurança:** Alterar senha.

**Sub-páginas entradas e verificadas (2026-05-31):**
- **Perfil** (`/my-account/profile`): Nome (editável) · Data de nascimento · E-mail (✓ verificado) · WhatsApp (✓ verificado) · **"Excluir conta"** (deleção de conta existe). Avatar editável (lápis).
- **Preferências** (`/my-account/preferences`): **Página inicial** (Chat | Dashboard — qual abre ao entrar) · **Habilitar sons** (toggle) · **Habilitar vibrações** (toggle, viés mobile) · **Aparência** (Claro/Escuro/Auto) · "Restaurar" padrões. **Sem escolha de paleta/fonte** → nossa personalização (15 paletas + 7 fontes) é diferencial real.
- **API Keys** (`/my-account/api-keys`): lista de chaves (Default Key) com **toggle ativar/desativar + lixeira (excluir) + "Criar nova Key"** + link "Documentação de API". **CRUD completo aqui** (é config de dev, não dado de Open Finance — por isso pode deletar, ≠ transações).
- **Assinatura** (`/my-account/subscription`): plano atual (Grátis) + **uso "Conexões bancárias 1/1"** (barra) + botão Upgrade → modal de planos.
- **Preferências (`/my-account/preferences`):**
  - **Página inicial** configurável: **Chat** ou **Dashboard** (qual abre ao entrar no app).
  - **Som** (efeitos sonoros em notificações/alertas) + **Vibração** (feedback tátil) — toggles, viés mobile/gamificado.
  - **Aparência:** Claro / Escuro / Auto.

---

## Coleta interna — resumo de testes (2026-05-31, cliquei/testei tudo)

Padrão geral confirmado em TODA tela: **detect-and-correct**, sem CRUD destrutivo. Resumo do que cada ação faz:

| Tela | Ação testada | Resultado |
|---|---|---|
| **Transações** | criar "Cafe" R$12,50 | ✅ cria (só Carteira/dinheiro); KPIs ao vivo. **Sem editar/excluir** — só **Ocultar** (tira do total) |
| **Transações** | menu de transação bancária | só **Ocultar** |
| **Parcelamentos** | menu + expandir | menu só **Ocultar**; expandir mostra **timeline de parcelas** (data + valor + ✓ paga), auto-detectado |
| **Assinaturas** | menu "..." | **"Não é uma assinatura"** (corrige falso-positivo, não deleta) |
| **Assinaturas** | "+ Adicionar" | **busca transação recorrente existente** pra marcar como assinatura — não cria do zero |
| **Categorias** | clicar subcategoria | **drill-down** → Transações pré-filtradas por categoria (URL com `categories=`) |
| **Cartões** | lápis "Fecha dia 1" | **dia de fechamento da fatura é editável** (rara edição — Open Finance não sabe, usuário corrige) |
| **Configurações** | abrir | Perfil · Preferências (tema/som/vibração/página inicial) · Assinatura · **API Keys** · Alterar senha · avatar editável |
| **Alterar senha** | abrir | form Senha atual/Nova/Confirmar (≥8 chars, olho) |
| **Reportar problema** | abrir | modal textarea 0/255, one-way ("não será respondido por aqui") |
| **Falar com suporte** | abrir | **widget de chat embutido** (estilo Intercom, abas Início/Mensagens) |
| **Menu conta (topo-direito)** | abrir | **gerenciador de conexões Open Finance**: contas (Nubank/Carteira) + status de sync + **refresh manual** + "Adicionar conta" |
| **Adicionar conta** | clicar | **paywall** "Limite de contas atingido" (grátis=1 banco). Fluxo real de conexão fica atrás do Pro |
| **Criar agente** | clicar | **paywall** (grátis=1 agente) |

**Conclusão de produto:** o usuário **nunca cria/edita/deleta dado financeiro** no Pierre — só **classifica e corrige** o que o Open Finance traz (ocultar, "não é assinatura", marcar recorrência, ajustar fechamento). As únicas criações manuais são: transação em **dinheiro** (Carteira) e **agentes/chat**. É um produto de **revisão**, não de **registro**. Nós somos o oposto (registro/CRUD completo) — e é aí que ainda nos diferenciamos pra quem quer controle manual fino.
