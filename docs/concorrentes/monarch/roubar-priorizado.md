# Monarch → Nosso produto — **backlog priorizado (engenharia reversa)**

> Cruza o deep-dive do Monarch ([paginas/](./paginas/README.md)) com o estado ATUAL do nosso código (varredura de 2026-09-20). Cada item: **temos? / gap / prioridade / esforço / stack**. Prioridade P0(bloqueador)–P3(nice). Alinhar com `ROADMAP.md`.
>
> **Tese (confirmada):** nenhum concorrente BR tem o nível de software do Monarch. Estratégia = **igualar a régua deles** (itens ⬆) **e ganhar** no fosso casal/família (já estamos à frente!) + local BR (PIX/NFC-e/Open Finance).

## Placar — onde estamos vs. Monarch
| Área | Nós hoje | Monarch | Veredito |
|---|---|---|---|
| Transação sem negativo (toggle tipo) | ✅ `PontesChoiceCards` despesa/receita/transferência, Valor `Range(0.01,…)` | ✅ Debit/Credit toggle | **empate** ✅ |
| Transferência = operação própria | ✅ `ContaOrigemId→ContaDestinoId` | ✅ | **empate** |
| Orçamento (Planned/Actual/Remaining) | ✅ `Orcamento` (ValorLimite/ValorGasto/PercentualAlerta) + LimitesPage | ✅ + Flex/Category + buckets + metas | **atrás** (base ok) |
| **Casal/família** | ✅✅ **rateio + acerto + aprovação + dependentes + papéis** (maduro) | ⚠️ só personal/shared, **sem rateio/settle-up** | **NÓS NA FRENTE** 🏆 |
| Metas | ⚠️ contador manual (`ContribuirAsync` só soma), tem DataLimite | ✅✅ **alocação** + meta-por-data + 2 gráficos | **atrás** |
| Recorrente | ⚠️ **3 frequências** + materializa 3m + jobs | ✅ **11 frequências** + forecast | **atrás** (fácil fechar) |
| Charts | ⚠️ recharts (Area/Bar/Pie) | ✅ + **Sankey** + Treemap + projeção | **atrás** |
| Dashboard | ⚠️ fixo, 9 widgets | ✅ customizável + IA por card | **atrás** |
| Merchant (entidade) | ❌ só `Transacao.Descricao` texto | ✅ entidade + typeahead + create | **atrás** |
| Tags | ❌ | ✅ | **atrás** |
| Auto-categorização (Rules) | ❌ | ✅ motor IF/THEN | **atrás** |
| IA Assistant | ❌ | ✅ chat grounded | **atrás** (estratégico) |
| Forecasting (projeção de vida) | ❌ | ✅ (pago/Plus) | **atrás** (nossa isca) |
| Net worth (ativo×passivo) | ⚠️ só conta/cartão | ✅ imóvel/veículo/invest/dívida | **atrás** |
| Local BR (PIX/boleto/NFC-e/OpenFinance) | roadmap | ❌ (US, só cartão) | **NOSSA BRECHA** 🏆 |

---

## P1 — fechar gaps de alto valor (a régua deles)

### 1. Metas: modelo de ALOCAÇÃO + meta-por-data ⭐⭐ (resolve ROADMAP P2)
**Gap:** `MetaService.ContribuirAsync` (`Services/MetaService.cs:92`) só faz `valorAtual = Max(0, valorAtual+valor)` — contador fictício, sem lastro. Sem `TipoMeta`, sem `Meta↔Conta`, sem `Meta↔Transacao`. **Já temos** `Meta.DataLimite` e `Meta.FamiliaId` ✅.
**Roubar ([goals.md](./paginas/goals.md)):**
- Nova entidade `MetaAlocacao { MetaId, ContaId, Valor, UseEntireBalance }`. `Available to contribute` de uma conta = `Saldo − Σ alocações`. Progresso da meta = `Σ alocações` (dinheiro fica na conta = earmark).
- Add `Meta.TipoMeta (SaveUp/PayDown)`.
- **Fórmula meta-por-data:** `mensal = (ValorAlvo − poupado) / mesesAté(DataLimite)`; status On track/At risk. Endpoint `GET /metas/{id}/projecao`.
- 2 gráficos do detalhe: Timeline (trajetória vs alvo, `recharts` + `ReferenceLine`) + Contributions (barras mês vs budget).
**Esforço:** M (entidade + migration + service + 2 telas). **Fosso:** alocações de contas de ambos do household → meta de casal.

### 2. Recorrente: 3 → 11 frequências ⭐ (fácil, fecha gap)
**Gap:** `Enums/FrequenciaRecorrencia.cs` só tem **Semanal/Mensal/Anual**.
**Roubar ([recurring.md](./paginas/recurring.md)):** add **Quinzenal (2 semanas), A cada 4 semanas, 2x/mês (1&15), 2x/mês (15&último), A cada 2/3/4/6 meses**. Ajustar cálculo `ProximaData` + materialização.
**Esforço:** S-M (enum + lógica de data + testes). Alto ROI.

### 3. Casal: toggle visão **solo ↔ compartilhada** ⭐ (único gap visível do fosso)
**Gap:** temos rateio/acerto/papéis/dependentes (maduro!), mas **falta o toggle de visão** (planejado Q5 §16.1). Monarch tem "solo vs together".
**Roubar ([household-casal.md](./paginas/household-casal.md)):** toggle no header (Dashboard/Transações/Metas): solo = `DonoId==eu`; shared = household inteiro. Marcação personal/shared já mapeável via `FamiliaId` na Transacao.
**Esforço:** M (filtro transversal + UI). **É onde a gente exibe o fosso que já construiu.**

---

## P2 — diferenciadores + paridade

### 4. Sankey (Cash Flow) ⭐ wow, ninguém no BR tem
**Gap:** só Area/Bar/Pie (recharts). **Roubar ([cash-flow.md](./paginas/cash-flow.md)):** `@nivo/sankey` ou `d3-sankey`; nós={renda,categorias,poupança}, links={valor}. + **Savings rate** como KPI. **Esforço:** M.

### 5. Merchant como entidade ⭐ (destrava recorrência/rules/breakdown)
**Gap:** ❌ só `Transacao.Descricao` texto livre. **Roubar ([transacao-modal.md](./paginas/transacao-modal.md)):** entidade `Comerciante`, typeahead + create-on-the-fly no form, "View merchant" (histórico). Habilita: recorrência-por-merchant, breakdown por merchant, rules. **Esforço:** M. Migração dos Descricao existentes.

### 6. Auto-categorização (Rules) — motor IF/THEN
**Gap:** ❌ categoria 100% manual. **Roubar ([settings.md](./paginas/settings.md)):** `Regra { Ordem, Condicoes[], Acoes[] }`. IF (merchant/valor/statement/categoria/conta) THEN (recategorizar/renomear/tag/hide/split/link-meta). Preview + aplicar retroativo. **Esforço:** M-L. Precede a IA.

### 7. Budget: modos Flex/Category + buckets + metas no orçamento
**Gap:** temos `Orcamento` por categoria/mês (bom), mas sem **Flex×Category**, sem **Fixed/Flexible/Non-Monthly**, sem **metas na seção Contributions**, sem "apply to future months". **Roubar ([budget.md](./paginas/budget.md)):** add `Categoria.Bucket`; modo Flex agrupa; integrar mensal-da-meta como linha; propagação futura. **Esforço:** M.

### 8. Tags na transação
**Gap:** ❌ sem Tag. **Roubar:** entidade `Tag` + N:N com Transacao + no form (typeahead) + filtro. **Esforço:** S-M.

### 9. Transação: enriquecer form
**Gap:** falta **Notes**, **link/contribute to goal**, (se conta manual) **adjust balance**. **Roubar ([transacao-modal.md](./paginas/transacao-modal.md)):** add campos. Notes = S; link-to-goal depende de #1. **Esforço:** S.

### 10. Dashboard customizável + IA por card
**Gap:** fixo (9 widgets). **Roubar ([dashboard.md](./paginas/dashboard.md)):** `DashboardConfig {widgets:[{id,visivel,ordem}]}` + drag (`dnd-kit`); card **"this vs last month"**; hook "Understand this" por widget (liga na IA). **Esforço:** M.

### 11. Reports: Treemap + Trend + saved reports + export
**Gap:** temos Bar/Area/donut. **Roubar ([reports.md](./paginas/reports.md)):** add Treemap + Trend bars; `RelatorioSalvo {Config json}`; export CSV/imagem (eixo contador). **Esforço:** M.

### 12. Net worth completo (ativo × passivo)
**Gap:** só conta/cartão. **Roubar ([accounts.md](./paginas/accounts.md) + [app.md](./app.md)):** tipos de conta manual (imóvel/veículo/investimento/bens = ativo; financiamento/empréstimo = passivo). Empréstimo já temos módulo → agregar como passivo. Chart Performance/Breakdown. **Esforço:** M-L.

---

## P2/P3 — grandes apostas estratégicas

### 13. IA Assistant (grounded) — a régua que nenhum BR tem ⭐⭐
**Gap:** ❌ zero IA. **Roubar ([ai-assistant.md](./paginas/ai-assistant.md)):** Claude (modelo mais capaz) com **tool-use sobre NOSSOS endpoints** (query transações/saldos/metas/orçamento) — nunca dump, sempre função → **não alucina** (como o Monarch fez ao vivo). Consentimento LGPD explícito + disclaimer "não é aconselhamento". Feedback 👍/👎.
**⭐ Nosso diferencial:** **IA de casal/household** — "quanto gastamos juntos?", "como dividir a meta da casa?", "quem pagou mais?". Ninguém (nem Monarch) faz. **Esforço:** L. Alto impacto de marketing.

### 14. Forecasting (projeção de vida) — nossa isca grátis ⭐⭐⭐
**Gap:** ❌. É o que o Gustavo mais quer ("comprar casa ano que vem → impacto"). **Roubar ([forecasting.md](./paginas/forecasting.md)):** `ForecastService` **determinístico** (sem IA): saldos + recorrentes + eventos + assumções (retorno/inflação/idade aposentadoria) → série de net worth. Eventos: Buy home/Have kid/Income/Expense/Retire (drag na timeline). `recharts` linha + markers.
**Jogada:** Monarch **cobra** (Plus $199,99/ano). A gente pode usar versão simples **grátis** como isca de aquisição + avançado no pago. **Casal** deixa mais forte (2 patrimônios, "ter filho" é decisão do casal). **Esforço:** L.

---

## P3 — local BR (nossa brecha, Monarch não tem)
- **PIX/boleto** no billing + **settle-up do casal via PIX** (Monarch só cartão/Stripe — [notificacoes-e-topo.md](./paginas/notificacoes-e-topo.md)).
- **Receipts via NFC-e/QR** (SEFAZ) — Monarch faz "Retail Sync" US; BR tem QR de graça em toda nota → anexar/itemizar ([transactions.md](./paginas/transactions.md)).
- **Open Finance BR** — sync automático (holdings/transações) vs. manual.
- **Benchmarks BR** (CDI/IBOV/IPCA) nos investimentos ([investments.md](./paginas/investments.md)).
- **Categorias BR** — trocar US-específicas (401k/Student Loans) por BR no `CategoriaSeeder`.
- **Disclaimers regulatórios** (advice/forecasting/goals): "estimativa, não é recomendação" — obrigatório p/ conformidade (CONFORMIDADE_BR).

---

## Ordem sugerida (mínimo esforço → máximo fecho de gap)
1. **Recorrente 11 freq** (S, fecha gap fácil) → 2. **Metas alocação + meta-por-data** (M, resolve P2 + casa com casal) → 3. **Toggle solo/shared** (M, exibe o fosso) → 4. **Merchant** (M, destrava rules/recorrência) → 5. **Rules** (M-L) → 6. **Sankey + savings rate** (M, wow) → 7. **Budget Flex/buckets/metas** (M) → 8. **IA grounded de casal** (L, marketing) → 9. **Forecasting isca** (L) → local BR ao longo.

> Cada item vira tarefa priorizada no `ROADMAP.md` (protocolo `PROMPT_NOVA_SESSAO.md §8.5). `1.0.0` só com segurança/LGPD fechados (CLAUDE.md).
