---
owner: Gustavo
last_reviewed: 2026-05-20
status: REFERENCIA
---

# Concorrentes — Análise textual e estratégica

Documento de **referência viva** para decisões de produto. Mantém o resumo textual dos concorrentes (copy, features, preços) e o posicionamento estratégico do Controle Financeiro frente a eles.

Imagens originais ficam em `docs/referencias/` (gitignored, capturadas por cada dev local).

---

## 1. Despezzas — concorrente direto BR

**Site:** despezzas.com.br · **Empresa:** INSIDE TECH LTDA (CNPJ 41.629.624/0001-50)

### Tração
- 350K+ usuários ativos
- 50M+ transações processadas
- 500K+ downloads

### Headline / posicionamento
> "Automatize seu controle financeiro e economize sem esforço!"
> "Facilite o controle das suas finanças com Despezzas."

### Features (versão completa, segundo o site)
- Controle de contas (poupança, corrente, investimentos)
- Gestão de cartões de crédito
- Limites por categoria
- Categorias customizáveis
- Relatórios com gráficos
- Metas pessoais
- Versão web
- **Open Finance** (integração direta com bancos via OFB)
- **IA para categorização** automática
- **Chat com IA financeira**

### Pricing
| Plano | Preço | Conexões Open Finance | Compartilhamento |
|---|---|---|---|
| Individual | R$ 34,90/mês | 3 bancos | Não |
| Plus (recomendado) | R$ 99,90/mês | 6 bancos | Até 3 perfis |

App é "gratuito para sempre" no básico, premium destrava features pesadas. Assinaturas via Apple/Google.

### O que se vê nas telas (mobile-first, dark mode)

**Estrutura de navegação:**
- Bottom nav: Home · Lista · `+` central verde · Gráfico · Perfil
- Header: avatar verde + "Gustavo / Perfil Principal ▾" + help + sino
- Menu lateral: Minhas contas, Meus cartões, Minhas categorias, **Minhas subcategorias**, **Minhas metas**, **Meus limites**, Meu plano, **Meus perfis**, Exportar dados, Sugestões e problemas

**Dashboard:**
- Seletor de mês no topo ("Maio 2026 ▾ / Esconder ▲")
- Saldo atual com olho de "esconder valor" (privacidade)
- 6 cards 2×3: Receitas (verde), Despesas (vermelho), **Recebido / Pago** (já efetivado), **Para receber / Para pagar** (futuro)
- Gráfico de linha "Gastos com Cartão" em mês cheio
- Lista "Minhas contas" com **logo real do banco** (Nubank roxo, Carteira ilustração)

**Add transação (sheet):**
- "O que você quer Adicionar?" → Receita (verde) / Despesa (vermelho) / Transferência (cinza)
- Form: valor gigante no topo verde · descrição · **Hoje / Ontem / Selecionar data** · Categoria · Subcategoria · Conta ou cartão · Toggle "Recebido/Pago" · **Único / Recorrente / Parcelado** · Recorrência (Anual/Semanal/Quinzenal × N ocorrências em wheel picker)

**Categorias:**
- Ícones grandes coloridos por categoria (investimentos amarelo, moradia marrom, poupança verde, saúde vermelho, seguros azul, serviços financeiros roxo, streaming vermelho, transporte amarelo, etc)
- Toda categoria em **minúscula** (estilo do app)
- Filtro + busca no header

**Criar conta:**
- Seletor de **ícone do banco** (logo real, Nubank visível)
- Título da conta
- Saldo inicial via teclado numérico custom

**Criar cartão:**
- Conta de pagamento (vinculada)
- Ícone do cartão
- Nome
- Limite total
- Fecha dia / Vence dia

**IA (paywall):**
- "Desbloqueie os insights com inteligência artificial"
- "Para gerar os melhores resultados, precisamos te conhecer melhor"
- CTA "Desbloquear agora"

**Notificações (gamificação):**
- Receber todas as notificações (master toggle)
- Lembretes de feriados
- Dicas sazonais de economia
- **Desafios financeiros** ("participe de desafios de economia criados para ajudar a melhorar seu planejamento")

**Onboarding:**
- Tour passo-a-passo ("1 de 4 / Pular / Próximo") com highlight do elemento da tela
- Texto curto explicando seção: "Aqui você vê todas as suas contas bancárias de forma organizada"

### Pontos fortes deles
1. **Open Finance funcionando** — usuário não digita nada, transação cai sozinha
2. **IA categoriza + chat** — vira o app em "consultor financeiro"
3. **Logos reais de banco** — sensação de "isso é meu banco mesmo"
4. **Gamificação** — desafios mantém retenção
5. **Mobile-first nativo** (iOS + Android) — não é PWA

### Pontos fracos / onde dá pra atacar
1. **"Perfis compartilhados" é raso** — só vê as transações de quem, não modela rateio nem aprovação de despesa entre membros
2. **Sem visão de contador / advisor** — não tem como um terceiro autorizado ver a conta de outros
3. **Categoria em minúscula é opinião visual** — pode ser cansativo
4. **Sem fluxo de despesa compartilhada com aprovação**
5. **R$99,90/mês para 3 perfis é caro** — abre espaço pra plano família melhor

---

## 2. Monarch Money — referência mundial

**Site:** monarch.com (antes monarchmoney.com) · 30K+ Redditors na comunidade

### Headline / posicionamento principal
> "Track, budget, plan, and do more with your money"
> "The modern way to manage money"
> "Budget, track your progress, and plan for the future—all in one app."
> "Your home base for money clarity"

### Pilares (do site principal)
1. **Track** — "Know where you stand. From your net worth to day-to-day spending and cash flow, feel confident about where you're at."
2. **Budget** — "Budgeting that fits your life. Create a budget that flexes to your needs - and not the other way around - so you can stay focused on the things that matter most."
3. **Collaborate** — "Make smart money moves together. Invite your partner to see your full picture, budget together, and reach your goals faster (and with more high fives)."
4. **Plan** — "Set goals (and crush them). From planning a vacation to a home remodel — track your goals and adjust your cash flow to make sure you stick the landing."

### Features destacadas
- "All your accounts, in one place" — bancos, cartões, empréstimos, imóveis, investimentos
- "Every transaction in one list" — busca unificada
- **"Take control of your subscriptions"** — detecta assinaturas recorrentes automaticamente
- "Visualize the flow of money" — gráficos customizáveis
- "Your goals, on track" — metas
- "On every device, always in sync" — web + iOS + Android
- "Best-in-class data connectivity" — **13.000+ instituições financeiras** (múltiplos providers)

### Pricing
- **30% OFF código WELCOME** primeiro ano
- Plus tier: ~$99/ano (≈ R$500/ano)
- Trial 7 dias

### Press / awards
- WSJ: "best budgeting app overall for 2024"
- Forbes: best budgeting app
- USA Today: customizable reports, goal tracking

### Reviews-âncora (App Store)
- "I love everything about this app."
- "Because of this app, I feel like I am not winging it financially anymore."
- "Mint shutting down was a blessing in disguise. Monarch is way better."
- "Monarch has been a game-changer for how my wife and I manage our finances."

---

## 3. Monarch for Couples — feature dedicada

> "Stay on the same page about money. Create a shared view of your finances, track progress together, and make money check-ins a breeze."

### Três pilares
**Unified Dashboard**
- "Get a full picture of your finances by bringing separate and joint accounts together, all into one view"
- "Know how you spend as a household, no matter who makes the purchase"
- "See how your net worth grows together over time"

**Collaboration Tools**
- **"Tag your partner to review transactions and be sure everything looks right"** ← (é exatamente fluxo de aprovação de despesa que nosso §16.3 propõe)
- "Make money check-ins quick and easy with a monthly summary and interactive reports"
- "Partner on a budget that gives you both the flexibility to spend on what's important to you"

**Joint Goals & Planning**
- "Align on goals you feel good about and track progress along the way"
- "Contribute toward goals together in Monarch, even if you keep your money in separate accounts"
- "Use reports to see trends in your household spending and identify easy ways to save"

### O que NÓS já temos vs Monarch couples
| Feature Monarch | Nosso estado |
|---|---|
| Dashboard unificado de contas separadas + conjuntas | ✅ família + perfis |
| "Tag partner to review transaction" | ❌ (mas é §16.3 do roadmap Q5) |
| Money check-in mensal + relatório interativo | ⚠️ parcial (relatórios sim, check-in não) |
| Goals colaborativas | ❌ ainda não |
| Net worth conjunto ao longo do tempo | ❌ |
| **Rateio explícito (quem-paga-o-quê)** | ✅ **NÓS TEMOS, Monarch NÃO TEM** |
| **Dependentes (filhos, agregados)** | ✅ **NÓS TEMOS, Monarch NÃO TEM** |
| **Acerto de contas virtual** | ✅ NÓS TEMOS (com a ressalva do §16.5) |

---

## 4. Monarch for Professionals — segmento contador / consultor

> "Make your great advice even better. With Monarch."

### Target
Financial advisors, money coaches, tax professionals, estate planning attorneys.

### Como funciona
1. Profissional convida cliente para o Monarch (sponsor ou cliente paga)
2. Cliente cria conta e conecta contas bancárias
3. Profissional ganha **visibilidade em tempo real** de cash flow, net worth, budgeting
4. Profissional alterna entre clientes pela "Professionals dashboard"

### Pricing
- Conta profissional: **grátis**
- Cliente sponsored: **US$ 14,99/mês cada** (≈ R$ 75/mês)

### Value props
- "Get a full view of your clients' accounts"
- "Make recommendations based on actual habits and numbers"
- "Use real-time data to help clients course correct"

### Testimonials
- CFP: "Monarch Money is the most effective tool I use in helping my clients feel confident with their finances."
- Outro advisor: dados precisos "lead[s] to more accurate financial plans"
- Terceiro: account linking "super dependable" — time mantém dados atualizados sem trabalho manual

### Por que isso interessa pra gente
**Esse segmento não existe no Brasil de forma estruturada.** Contador hoje recebe planilha de Excel, print de extrato, ou cliente manda PDF. **Não há SaaS B2B2C consolidado pra contador acompanhar finanças pessoais de clientes.**

LTV de contador (B2B) é 10-20× LTV de B2C. Contador paga porque economiza horas dele × N clientes.

---

## 5. Análise comparativa — onde estamos

### Stack visual e UX
| Eixo | Despezzas | Monarch | Nós (pós-Q4) |
|---|---|---|---|
| Design system / tokens | ✅ verde + dark | ✅ teal | ✅ teal + dark (#63 em review) |
| Mobile nativo | ✅ iOS + Android | ✅ iOS + Android | ❌ só PWA |
| Logos de banco nos cards | ✅ | ✅ | ❌ (backlog) |
| Dark mode | ✅ | ✅ | ✅ (#63 review) |
| Gráficos | Linha simples | Cash flow + reports profundos | ✅ donut, linha, barra |
| Idioma | PT-BR | EN | PT-BR |

### Features financeiras
| Eixo | Despezzas | Monarch | Nós |
|---|---|---|---|
| Open Finance / sync com banco | ✅ direto OFB | ✅ 13k instituições | ❌ **gap crítico** |
| Importação OFX/CSV | ⚠️ não destacado | ✅ | ✅ |
| IA categorização | ✅ | ⚠️ rule-based | ❌ |
| IA chat financeiro | ✅ | ❌ | ❌ |
| Parcelamento | ⚠️ básico | ⚠️ limitado | ✅ completo |
| Recorrentes | ✅ | ✅ | ✅ |
| Cartão de crédito (fatura, ciclo) | ✅ | ✅ | ✅ regras formalizadas |
| Subscriptions tracking | ⚠️ | ✅ destacado | ⚠️ via recorrentes |
| Metas | ✅ | ✅ destacado | ❌ |
| Limites por categoria | ✅ | ✅ (budgets) | ❌ |
| Subcategorias | ✅ | ✅ | ⚠️ via categorias |

### Família / colaboração
| Eixo | Despezzas | Monarch | Nós |
|---|---|---|---|
| Perfis compartilhados / família | ⚠️ "perfis" (raso) | ✅ couples | ✅ família completa |
| Convite + papéis (admin/membro) | ⚠️ básico | ⚠️ couples só | ✅ admin + dependente |
| Rateio explícito | ❌ | ❌ | ✅ |
| Aprovação de despesa | ❌ | ⚠️ "tag for review" | ❌ (Q5 §16.3) |
| Dependentes (filhos) | ❌ | ❌ | ✅ |
| Acerto de contas virtual | ❌ | ❌ | ✅ (com bug §16.5) |
| Múltiplas famílias | ❌ | ❌ | ✅ |

### Profissional / contador
| Eixo | Despezzas | Monarch | Nós |
|---|---|---|---|
| Visão de contador / consultor | ❌ | ✅ Advisors | ❌ **não existe** |
| Convite contador → cliente | ❌ | ✅ | ❌ |
| Dashboard multi-cliente | ❌ | ✅ | ❌ |
| Cobrança B2B | ❌ | ✅ $14,99/cliente | ❌ |

### Negócio
| Eixo | Despezzas | Monarch | Nós |
|---|---|---|---|
| Usuários | 350K | ~milhões | dev |
| Pricing B2C | R$ 34,90–99,90/mês | $99/ano (≈ R$500/ano) | grátis (sem cobrança) |
| Trial | App grátis sempre | 7 dias | n/a |
| Comunidade / brand | Apple/Google reviews | 30K Redditors | n/a |

---

## 6. Conclusões para o roadmap

### O que NÃO faz sentido fazer
- Atacar Despezzas frontalmente em B2C puro com mesmas features. Eles têm 5 anos, time, OFB integrado, 350k users. Não há motivo pra trocar de app só pra ter o mesmo.
- Apostar tudo em IA chat agora. É copy-cat, não diferencia, e custa caro de infra.

### O que tem chance real
1. **Open Finance MVP** — mesmo que cobrindo só Itaú/Nubank/Bradesco via Belvo ou Pluggy. Sem isso é amador frente a Despezzas.
2. **Família séria** — não "perfis compartilhados", e sim **modelagem real de rateio, aprovação, dependentes**. Isso ninguém tem. Está 80% pronto.
3. **Módulo Contador / Profissional** — **mercado virgem no BR.** Reaproveita 80% do código de família (multi-tenant, papéis, convite). Vende B2B (contador paga, embute no preço do cliente).
4. **Logos de banco** — esforço baixo, ganho de percepção alto. Despezzas faz, Monarch faz.

### O que pode esperar
- IA chat / insights — depois de ter base de transações real (sem Open Finance, IA não tem dado pra trabalhar).
- Mobile nativo — PWA por enquanto. Quando tiver tração e dinheiro de Apple/Google reviews, aí vira nativo.
- Gamificação (desafios) — depois que retenção for medida.

### Posicionamento sugerido
> "Controle financeiro para famílias brasileiras — com a inteligência de Monarch e a clareza para o seu contador acompanhar."

Não vende "outro app de finanças". Vende **"o app de finanças que finalmente entende casal + dependentes + contador como peças do mesmo sistema"**.

---

## 7. Próximos vetores concretos (proposta)

Ordem de prioridade pensando em **monetização real**, não só código.

1. **Open Finance MVP (Pluggy ou Belvo)** — 1 sprint pra integração + 1 sprint pra polir importação automática + categorização. Sem isso, B2C não vende.
2. **§16.5 — Despesa compartilhada × saldo real** — modelagem dura, valor de produto alto, ninguém faz. Documentar decisão A/B/C antes de qualquer código novo.
3. **Módulo Contador** — convite contador → cliente, dashboard multi-cliente, papel "profissional" no modelo de família. Reaproveita autenticação e isolamento por UsuarioId já existente.
4. **Logos de banco** — popular `Banco.LogoUrl`/`Cor` no seeder + linkar `Conta.BancoId` + expor no DTO + componente `BankBadge` no front.
5. **Metas + Limites por categoria** — Despezzas e Monarch têm, e é onde retenção mora.
6. **Subscriptions tracker dedicado** — Monarch destaca, fácil de fazer em cima do que já temos de recorrentes.

Cada item vira issue própria, com decisão de bloco/quarter quando tiver clareza de prioridade comercial.
