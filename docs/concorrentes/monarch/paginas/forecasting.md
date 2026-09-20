# Monarch — **Forecasting** (`/forecast`) ⭐⭐⭐ CARRO-CHEFE (Gustavo vai fazer no nosso)

> Mapeado POR DENTRO (Plus ativado, trial 7d). Projeta o **patrimônio (net worth) do HOUSEHOLD** ao longo da vida e deixa você **modelar eventos de vida** (comprar casa, ter filho, aposentar…) e ver o impacto ao vivo. É a feature "wow" que o Gustavo mais quer.

## Gate / posicionamento
- **Monarch Plus** ($199,99/ano). Grátis = só teaser (chart de demo). O motor real é pago.
- É **household** (casal-aware): usa renda/despesa/patrimônio combinados das duas pessoas + idade de cada uma.
- Disclaimer forte (estimativas, não é aconselhamento).

## Setup wizard (6 passos) — "Build my forecast"
1. **Review your household's forecast** — por pessoa: **Birthday** (obrigatório → calcula idade/aposentadoria) + **Assumptions** auto (take-home income/ano = média 12m, living expenses/ano = média 12m, assets, liabilities dos linked accounts). Botão **Edit assumptions**.
2. **Add take-home income** — Name+icon · **Yearly take-home income** (hoje, líquido) · **"Add another income source"** (= *multiple income streams*, feature Plus).
3. **Choose your forecast accounts** — quais contas participam ("save into, pay down, draw from during retirement").
4. **Choose a retirement age** — por pessoa, slider + dropdown de ano (ex.: 2055 / age 65).
5. **You're good to go** — dicas (add events, drag no chart, edit assumptions). Defaults revelados: **Inflation 3% · Growth rate 7% · Withdraw during retirement ✓**.
6. → **Go to forecast**.

## ⭐ Premissas globais (Edit assumptions) — o motor
Por pessoa + global:
- **Birthday / Age**.
- **Use actuals as baseline** (toggle) — usa últimos 12m de renda/despesa como ponto de partida.
- **Yearly take-home income** / **Yearly living expenses** (em hoje).
- **Change over time** — "Match inflation (3%)" ou custom (crescimento de renda/despesa).
- **Yearly inflation rate** — slider **3%** (default; "plans use 2-3%").
- **Growth rate** — **7%** default (retorno de investimento por conta).
- **Show future values in** — **Today's dollars** (recomendado, inflação-ajustado) × **Future dollars** (nominal).
- **Expense withdrawal order** — ordem de sacar de poupança/investimentos na aposentadoria (drawdown strategy) → "Change withdrawal order".
- **Split extra savings** — quando sobra (renda > despesa), distribui o excedente entre contas → "Change savings splits".

## A ferramenta (tela principal)
- **Cenários em abas** no topo: **Baseline forecast** + **"+"** (novo). "+" → **Start from scratch** OU **Duplicate existing scenario** → múltiplos cenários pra **comparar** planos. **Auto-save** ("Saved just now").
- Header: nome do cenário + **···** + **Watch walkthrough** + **Edit assumptions** + **Add event**.
- **4 KPIs:** Net worth (EOY) · **Net worth at retirement** · Retirement age · Net worth at end.
- **Chart:** linha de net worth do ano atual até ~90 anos (ex.: 2026→2077). Markers de eventos na timeline (🏠🎂🏖…). **Arrastável** — mover evento muda a data → recomputa ao vivo.
- **Tabela** (abas **Accounts / Cash Flow / Events**): valores **ano a ano** (Net Worth → Assets → Cash/cada conta; Cash Flow = renda/despesa/poupança por ano; Events = eventos por ano).

## ⭐⭐ Eventos de vida (Add event) — 9 tipos
Cada evento = **Year** + params específicos + Name/icon. Aplica na hora (recalcula KPIs + curva) e vira **marker/região** na timeline (arrastável, deletável via ··· → Delete event).

| Evento | Modela |
|---|---|
| **Income** | entrada extra: herança, bônus, venda de ações |
| **Expense** | gasto: comprar carro, abrir negócio, reforma |
| **Retire** | transição pra renda de aposentadoria |
| **Buy a home** | compra de imóvel + financiamento (detalhe abaixo) |
| **Social Security** | começar a receber previdência (INSS no BR) |
| **New job** | mudança de renda por novo emprego |
| **Have a kid** | custo de criar filho (detalhe abaixo) |
| **Career break** | pausa na carreira (tempo sem renda) |
| **Windfall** | ganho único |
| *(Coming soon)* | mais tipos anunciados |

### ⭐ "Buy a home" (o cenário do Gustavo) — params completos
- **Year** (quando compra).
- **Home value** ($400.000, em hoje).
- Abas **Finance** (financiar) × **Pay Cash** (à vista).
- **Down payment** ($ e **%**; "20% recomendado p/ evitar PMI").
- **Mortgage:** prazo (30 year…) + **taxa (6.5%)**.
- **Property tax** (1%) · **Home insurance** (0.5%).
- → **Monthly payment calculado** ($2.522,62) com breakdown: **Principal+interest · Property tax · Home insurance**.
- **Yearly home ownership costs** ($4.000 / 1% = manutenção).
- **Change over time** (valorização do imóvel = Match inflation 3%).
- **Replace existing Housing expenses** (toggle — troca o aluguel atual, evita contar em dobro).
- **Impacto ao vivo:** net worth na aposentadoria caiu $2.34M → $2.06M ao adicionar a casa.

### ⭐ "Have a kid" — params
- **Year** · **Years of child expenses** (duração, ex.: 13) · **Yearly child expenses** ($18.000 — creche/comida/saúde/educação) · **Change over time** · **Upfront child costs** ($4.500 — parto/adoção/licença). Chart mostra **região sombreada** pela duração; net worth caiu $2.34M→$2.10M.

## ⭐⭐⭐ COMO FAZER NO NOSSO (spec de implementação)
Motor **determinístico** (NÃO é IA), testável:
```
Para cada ano t de hoje até (idade_max):
  saldo(t) = saldo(t-1)
           + renda_liquida(t)                 // por pessoa, cresce por "change over time"
           - despesa_vida(t)                   // idem
           + rendimento(saldo_investivel, growth_rate 7%)   // capitaliza
           ± Σ efeito dos eventos com data <= t // cada evento é um delta parametrizado
  aplica inflação(3%) conforme "today's vs future dollars"
  na aposentadoria: para renda de trabalho, começa drawdown na ordem definida
KPIs: net worth EOY, net worth na aposentadoria, net worth ao fim
```
- **Entidades:** `Cenario { Usuario/HouseholdId, Nome, Premissas(json) }` + `EventoForecast { CenarioId, Tipo, Ano, Parametros(json) }`. Múltiplos cenários por household.
- **Premissas:** inflação, growth rate, income/expense por pessoa, retirement age, withdrawal order, savings split, today/future dollars.
- **Eventos:** cada tipo tem um sub-form (Buy a home = valor/entrada/prazo/taxa/tax/seguro/manutenção/valorização/replace-housing; Have a kid = duração/anual/upfront; etc). Efeito calculado no motor.
- **Chart:** `recharts LineChart` (net worth por ano) + markers/regiões custom por evento + **drag** (onDrag muda `Ano` → recomputa). Tabela ano-a-ano (Accounts/Cash Flow/Events).
- **Base vem de:** recorrentes (renda/despesa) + saldos + APY/growth por conta ([recurring](./recurring.md), [accounts](./accounts.md)).

### Jogada estratégica (nossa)
- **Isca grátis:** Monarch cobra no Plus. A gente pode dar uma versão simples **grátis** (1 evento tipo "comprar casa", 1 cenário) como aquisição, e o avançado (multi-cenário, todos os eventos, drawdown) no nosso tier pago.
- **Fosso casal:** o forecast já é **household** no Monarch, mas eles não têm rateio. Nosso: "ter filho" e "comprar casa" como **decisão do casal**, com quem contribui quanto (liga no nosso rateio/acerto que já temos).
- **BR:** Social Security → **INSS**; benchmarks/growth → CDI/IBOV; "Buy a home" → financiamento SAC/Price BR (não só 30-year fixed US).
- **Conformidade:** disclaimer obrigatório "estimativa, não é recomendação de investimento" (CONFORMIDADE_BR).
