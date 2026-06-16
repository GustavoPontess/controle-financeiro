# Pierre × Pontes — comparativo, gaps e recomendações

## 1. Diferenciais do Pierre que NÃO temos

| # | Recurso | Impacto | Custo p/ nós |
|---|---|---|---|
| 1 | **Open Finance** (sincronização bancária automática + categorização) | 🔴 alto | 🔴 alto |
| 2 | **IA conversacional** (chat sobre as finanças) | 🔴 alto | 🔴 alto |
| 3 | **Agentes autônomos** (automações IA agendadas) | 🟠 médio | 🔴 alto |
| 4 | **Detecção automática de assinaturas** (do extrato, com logo + projeção anual) | 🟠 médio | 🟠 médio |
| 5 | **Mapa de calor** de gasto diário | 🟡 baixo | 🟢 baixo |
| 6 | **Variação % por categoria** vs mês anterior (dashboard) | 🟠 médio | 🟢 baixo |
| 7 | **"Transações semelhantes"** (histórico do mesmo destino → revela recorrência) | 🟠 médio | 🟢 baixo |
| 8 | **Multi-moeda** no lançamento | 🟡 baixo | 🟢 baixo |
| 9 | **Ocultar** transação/parcelamento/assinatura | 🟡 baixo | 🟢 baixo |
| 10 | **Insights em linguagem natural** no topo do dashboard | 🟡 baixo | 🟡 baixo |
| 11 | **API Keys** pro usuário (acesso programático) | 🟡 baixo | 🟡 baixo |
| 12 | **Auth WhatsApp-first + passwordless** (número = identidade, sem senha) | 🟠 médio | 🟢 baixo |
| 13 | **Integração WhatsApp** (falar com o agente fora do app) | 🟠 médio | 🟠 médio |
| 14 | **Backing Cloudwalk** + forte presença de imprensa (não é feature, mas é músculo) | 🔴 alto | — |

## 2. O que TEMOS que o Pierre não tem (nosso fosso)

1. **Família/casais** — rateio "quem paga o quê", dependentes, papéis dinâmicos. Pierre é 100% individual. **Maior diferenciação.**
2. **Aprovação de despesas** (fluxo família).
3. **Personalização visual rica** — 15 paletas + 7 fontes (Pierre só tem Claro/Escuro/Auto).

## 3. Filtros da tela de Transações (comparação detalhada)

| Filtro | Pierre | Nós (Q5) |
|---|---|---|
| **Período** | 8 presets (Todo período, Últimos 30/90 dias, Este mês, Mês passado, Últimos 6 meses, Este ano, Ano passado) **+ range custom** (calendário 2 meses) | só `< Mês >` + Hoje ❌ |
| **Conta/Cartão** | sim (por conta/cartão, badge tipo) | **não tem** ❌ |
| **Tipo** | Todas / Saídas / Entradas | chips Tudo/Receitas/Despesas ✅ |
| **Ordenação** | Data ↑↓ · Valor ↑↓ | **não tem** (fixo data desc) ❌ |
| **Categoria** | **multi-select hierárquico** + busca + contador `X/Y` + expandir subcategorias | single-select (1 cat) ⚠️ |
| **Ocultar** | toggle "Mostrar ocultos" | **não tem** ❌ |
| **Busca** | sim | sim ✅ |

## 4. Diferença de filosofia (importante pra decisões de produto)

- **Pierre = "detect-and-correct"**: Open Finance traz tudo; o usuário só **ajusta** (Ocultar / "Não é assinatura"). Menus de ação são minúsculos. Quase nenhum CRUD manual.
- **Nós = "create-manual"**: o usuário cria/edita cada lançamento. CRUD completo.
- **Implicação:** se um dia integrarmos Open Finance, a UI de lançamento muda de filosofia (de "criar" para "revisar/corrigir"). Vale já desenhar pensando nisso.

## 5. Recomendações priorizadas

### Curto prazo — barato e direto (UI/front, dados que já temos)
1. **Filtros de Transações**: presets + range de período · filtro por conta · ordenação (data/valor) · multi-select de categoria. _(Gaps diretos, puramente front.)_
2. **Variação % por categoria vs mês anterior** no `/reports` _(já no radar; Pierre valida)._
3. **Mapa de calor** de gasto diário _(alto valor percebido, derivável)._
4. **Tela de Categorias analítica** (gasto por categoria/subcategoria com barras), além do CRUD atual.
5. **"Transações semelhantes"** no detalhe de uma transação _(query simples por descrição/contraparte)._

### Médio prazo — diferencial
6. **Detecção de assinaturas** a partir de recorrência de transações + projeção anual e média/serviço.
7. **Insights em linguagem natural** no dashboard (mesmo sem IA: regras simples sobre os dados).
8. **Logos reais** de bancos/serviços nas transações e assinaturas.

### Longo prazo — estratégico (alto custo)
9. **Open Finance** — paridade competitiva real depende disso.
10. **IA conversacional / agentes** — eleva muito a percepção de valor; é o core deles.

### Não fazer / defender
- Não imitar o visual dark-tech nem o mascote — manter nossa identidade (família, personalização).
- **Aprofundar o fosso família** (rateio, aprovação, papéis) — é onde Pierre não compete; evita briga de frente em IA + Open Finance, onde eles dominam.

## 6. Preços (resumo — detalhe em `README.md`)

| Plano | Mensal | Destaque |
|---|---|---|
| Grátis | R$ 0 | conta de teste |
| Pro (Popular) | R$ 39 | 5 contas, 5 agentes, relatórios |
| Premium | R$ 199 | multi-conta, 10 agentes, API+MCP |

Posicionamento **premium** (caro pro mercado BR). Monetizam **contas conectadas + agentes + API**, não o CRUD básico.
