# Monarch — **Forecasting** (`/forecast`) ⭐⭐⭐ a joia da coroa ("comprar casa ano que vem → ver impacto")

> É a feature que o Gustavo mais quer. **Atenção: é gated no Monarch Plus (upsell pago).** Não comprei (regra: não comprar). Documentado pelo intro grátis + modal de upsell + demo chart.

## O conceito (headline deles)
> **"See how your future plays out"** — "Use your real Monarch data to model life events, then drag and play with scenarios to see exactly how each decision shapes your future."

Projeta o **patrimônio (net worth) no futuro** (demo vai de ~$500k em 2026 até ~$2.5M em 2050) a partir dos **dados reais** (saldos das contas conectadas + recorrentes + crescimento de investimento). Você **coloca eventos de vida** na linha do tempo e **arrasta** pra ver o impacto ao vivo.

## Eventos de vida modeláveis (na timeline)
| Evento | Ícone | O que modela (inferido) |
|---|---|---|
| **Buy a home** | 🏠 | entrada (despesa lump) + financiamento (passivo recorrente) + imóvel (ativo) — "Plan for home ownership" |
| **Have a kid** | 👶 | despesas recorrentes de criança — "Model the impact of raising children" |
| **Expense** | 🏷 | custo pontual ou recorrente arbitrário |
| **Income** | 📈 | mudança de renda (aumento, novo emprego) |
| **Retire** | 🏆 | para a renda + começa saque; tem **slider de idade de aposentadoria** |

## Os 3 casos de uso (cards do intro)
1. **When can I retire?** — slider **"Choose a retirement age" (default 65)** → "Test different assumptions to land on a plan you understand and trust, grounded in real numbers." (modal preview: *"Net worth at retirement $3.00M / Retirement age 58"*).
2. **Can I afford this house?** — combina Buy a home + Have a kid → "Understand how big decisions affect your long-term picture. Weigh the trade-offs and choose what fits the future you want." ← **exatamente o cenário do Gustavo.**
3. **How does my future look?** — projeção base → "See where your money is headed based on your actual habits and life plans."

## Modelo mental (motor de projeção — determinístico, NÃO é IA)
```
saldo_futuro(t) = saldo_hoje
                + Σ (renda_recorrente − despesa_recorrente) até t
                + crescimento_investimento (APY/retorno assumido) capitalizado
                + Σ efeito de cada evento de vida com data <= t
status/afford  = trajetória fica positiva / bate meta na data?
```
- Base vem dos **recorrentes** (ver [recurring](./recurring.md)) + **saldos/net worth** (ver [accounts](./accounts.md)) + **APY por conta** + retorno de investimento.
- Cada **evento** é um delta parametrizado (data + valor + se é lump/recorrente + ativo/passivo).
- **Arrastar** o evento = mudar a data → recomputa a curva. Interação drag-and-drop na timeline.
- Disclaimer forte (como em Goals): estimativas, não é aconselhamento.

## ⭐ Monetização (data point estratégico)
- **Forecasting = Monarch Plus** (tier pago acima do base). Modal: *"Plus — See further. Plan smarter. Build with confidence. Plan for retirement, track your business, go deeper on your investments."* + **Explore Plus**.
- O intro/demo é **teaser** (chart bonito, eventos), mas o motor interativo é **paywall**.
- **Leitura pro nosso produto:** a feature "wow" mais impressionante deles é **premium**, não base. Duas jogadas possíveis pra gente:
  - (a) usar Forecasting simplificado como **isca grátis** (diferenciação de aquisição) e cobrar o avançado; ou
  - (b) espelhar o modelo deles (base grátis + Forecasting no nosso tier pago).
- Combina com nosso eixo: **casal/família** deixa o Forecasting mais forte (dois patrimônios, "ter filho" é decisão de casal).

## Como fazer no nosso (stack)
- **Chart:** `recharts` — `LineChart` da projeção (linha tracejada) + `ReferenceDot`/markers custom por evento na timeline; drag via `onMouseDown` no marker + recomputo.
- **Motor:** serviço backend `ForecastService` puro (sem IA): recebe saldos atuais + recorrentes + eventos + assumções (retorno, inflação, idade aposentadoria) → devolve série mensal/anual de net worth. Determinístico e testável.
- **Eventos:** entidade `EventoFinanceiro { Tipo(BuyHome/Kid/Expense/Income/Retire), Data, Parametros(json) }` por cenário; cenários salvos por usuário/household.
- **Casal:** projeção do household soma patrimônios; eventos podem ser marcados por pessoa.
- **Conformidade:** disclaimer obrigatório ("estimativa, não é recomendação de investimento") — ver CONFORMIDADE_BR + [[feedback_baseline_seguranca_qualidade]].

## Pendente (bloqueado por paywall)
- Parâmetros exatos de cada evento (campos do form "Buy a home": preço, entrada %, taxa, prazo?).
- Assumções globais (retorno de investimento, inflação) — onde se configura.
- Se dá pra salvar múltiplos cenários e comparar.
> Se o Gustavo quiser, dá pra assinar o Plus (decisão dele — é compra, não faço sozinho) pra mapear o motor por dentro.
