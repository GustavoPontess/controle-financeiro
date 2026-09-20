# Monarch — **Budget** (`/plan`)

> Orçamento mensal planejado × real, integrado a Goals. Comparar com nosso módulo de orçamento.

## Layout
- Topo: **navegador de mês** (setembro de 2026) · ← → · **Today** · views **Month / Year / Decade** · **Settings**.
- Tabela central: colunas **[categoria] · Planned · Actual · Remaining**.
- Painel direito: **"$X Left to budget"** (verde/vermelho) + abas **Summary / Income / Expenses**.

## Estrutura da tabela (3 grandes seções)
1. **Income** — receitas. `Actual` puxa das transações (meu salário $5.000 apareceu). "Show N unbudgeted" (categorias sem valor planejado colapsadas).
2. **Expenses** — sub-agrupado (no modo **Flex Budget**):
   - **Fixed** — despesas fixas (Rent, Gas & Electric… → Actual $1.690).
   - **Flexible** — variáveis (Groceries $650 + Restaurants $280 → Actual $930).
   - **Non-Monthly** — esporádicas/anuais.
   - Cada linha: **barra de progresso** (Actual vs Planned).
3. **Contributions** ⭐ — **as METAS entram no orçamento**:
   - **Save up**: "Comprar Casa 2027 · On track · Planned **$3.750** · Actual $0 · Remaining $3.750" — a mensalidade da meta É uma linha de orçamento.
   - **Pay down**: metas de dívida ("None of your liability accounts are included in the budget").

**`Left to Budget` = Income planejado − Expenses planejado − Contributions planejado.** Filosofia "cada real tem função" (zero-based-ish). Aqui fica **negativo (-$3.750)** porque não pus income planejado, só a contribuição da meta.

## ⭐ Achado-chave: Goals ↔ Budget ↔ Alocação são o MESMO sistema
A contribuição mensal da meta (calculada no wizard, $3.750/mo) aparece automaticamente como **linha de orçamento** na seção Contributions. Ou seja: criar meta com data → gera necessidade mensal → entra no orçamento → você vê se sobra dinheiro ("Left to budget"). Loop fechado: **Forecasting (futuro) → Goals (alvo+data) → Budget (mês) → Transações (real) → Allocation (reserva)**. É o núcleo do produto deles.

## Budget Settings (engrenagem)
- **Sistema de orçamento (2 métodos):**
  - **Flex Budget** (Recomendado) — "foca no seu número de despesa flexível"; agrupa em Fixed/Flexible/Non-Monthly. Simples.
  - **Category Budget** — "orça cada categoria individualmente, do jeito tradicional". Detalhado.
- **Aplicar mudanças por padrão a:** **This month only** × **All future months** (propaga pro futuro).
- **More options:**
  - **Recalculate default budgets** — gera orçamento automático das médias históricas (sobrescreve tudo).
  - **Clear all budget values** — zera desde o mês inicial.
  - **Budget walkthrough** (Start setup) — tutorial passo a passo do orçamento.

## Criação automática
Popup **"Create a budget"** → "criamos com base no seu histórico de gastos, você customiza depois" → **"Your plan has been created"** (bucketiza suas categorias em Fixed/Flexible/Non-Monthly a partir das transações reais).

## Como fazer no nosso (stack)
- Tabela Planned/Actual/Remaining por categoria/mês. Backend: `Orcamento { UsuarioId, CategoriaId, Mes, ValorPlanejado }`; `Actual` = Σ transações da categoria no mês; `Remaining = Planejado − Actual`.
- **Duas visões (Flex × Category)** — flag por usuário; Flex agrupa por bucket (Fixed/Flexible/Non-Monthly = atributo da categoria).
- **Integrar metas no orçamento** (seção Contributions) — reusar nosso módulo de Metas quando adotar o modelo de alocação ([goals](./goals.md)).
- Views Month/Year/Decade = agregações temporais do mesmo dataset.
- "Apply to all future months" = propagar `ValorPlanejado` pros meses futuros (default) — cuidar de override por mês.

## Comparar com nosso
- Nosso app tem orçamento? (checar módulo). Se sim, alinhar colunas Planned/Actual/Remaining + bucket Fixed/Flexible/Non-Monthly + integração com Metas. Se não, é feature de roadmap forte (pilar do Monarch).
