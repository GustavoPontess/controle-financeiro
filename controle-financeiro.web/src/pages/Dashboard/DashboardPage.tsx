/**
 * DashboardPage — visão de relance, no padrão DENSO das telas internas (docs/DESIGN_SYSTEM.md →
 * "Densidade"). Cabe numa tela e responde, nesta ordem:
 * 1) Quanto tenho e como foi o mês? — faixa de saldo com Entrou / Saiu / Sobrou e a troca de mês
 * 2) Pra onde está indo? — saldo nos últimos meses + maiores gastos, lado a lado
 * 3) O que aconteceu e onde está o dinheiro? — transações recentes + orçamento, contas e cartões
 *
 * O título da página fica só no Navbar. Cor/fonte vêm de CSS vars; usePontesTheme() é usado APENAS
 * pras cores do gráfico recharts (var() não resolve em atributo SVG).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ArrowRight,
  CreditCard, Target, TrendingUp, TrendingDown,
} from "lucide-react"
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts"
import { PontesButton, PontesBankBadge, PontesCategoryDonut, usePontesTheme, useHideBalance } from "@/components/pontes"
import { getDashboard } from "../../services/dashboardService"
import { getOrcamentos } from "../../services/orcamentoService"
import type { Orcamento } from "../../types/Orcamento"
import type { DashboardData, SaldoConta, TransacaoRecente, CartaoResumo } from "../../types/Dashboard"
import { formatMoney, MONEY_MASK } from "@/utils/money"
import { dataLocalISO } from "@/utils/dateTime"
import styles from "./DashboardPage.module.css"

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

/** Dia "YYYY-MM-DD" (sem fuso) → "Hoje" / "Ontem" / "15/10", mais a hora quando existe. */
function fmtQuando(data: string, hora?: string | null): string {
  const hoje = dataLocalISO()
  const ontem = dataLocalISO(new Date(Date.now() - 86400000))
  const dia = data === hoje ? "Hoje" : data === ontem ? "Ontem" : `${data.slice(8, 10)}/${data.slice(5, 7)}`
  return hora ? `${dia} ${hora.slice(0, 5)}` : dia
}

export default function DashboardPage() {
  // Tema só pras cores do gráfico (recharts SVG não lê var(--pontes-*)).
  const { palette: p, font } = usePontesTheme()
  const navigate = useNavigate()

  const [data, setData] = useState<DashboardData | null>(null)
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null) // orçamento GERAL do mês
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  // Olho global (ocultar saldo): o navbar controla; assinar aqui força o re-render do formatMoney.
  const [hide] = useHideBalance()

  // Eixo Y: valor compacto ("R$ 5 mil"). Em branco quando o olho está fechado.
  const fmtAxis = useCallback(
    (v: number) => (hide ? "" : new Intl.NumberFormat("pt-BR", {
      notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1,
    }).format(v)),
    [hide]
  )

  // Trocar de mês rápido dispara várias buscas; só a ÚLTIMA pode escrever na tela. Sem isso, a
  // resposta atrasada de um mês antigo sobrescrevia os números do mês que está no rótulo.
  const pedidoAtual = useRef(0)

  const load = useCallback(async () => {
    const pedido = ++pedidoAtual.current
    const valeAinda = () => pedido === pedidoAtual.current
    setLoading(true)
    setErro(false)
    const ano = currentDate.getFullYear()
    const mes = currentDate.getMonth() + 1
    try {
      const dash = await getDashboard(ano, mes)
      if (!valeAinda()) return
      setData(dash)
      // Orçamento GERAL do mês (categoriaId null). Falha aqui não derruba o dashboard.
      try {
        const { data: orcs } = await getOrcamentos(mes, ano)
        if (valeAinda()) setOrcamento(orcs.find((o) => o.categoriaId === null) ?? null)
      } catch { if (valeAinda()) setOrcamento(null) }
    } catch {
      if (valeAinda()) setErro(true)
    } finally {
      if (valeAinda()) setLoading(false)
    }
  }, [currentDate])

  useEffect(() => {
    void load()
    const handler = () => { void load() }
    window.addEventListener("transactionCreated", handler)
    return () => window.removeEventListener("transactionCreated", handler)
  }, [load])

  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))
  const monthLabel = `${MESES_CURTOS[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  return (
    <div className={styles.root}>
      {loading && !data && (
        <div className={styles.loadBar}><div className={styles.loadBarFill} /></div>
      )}

      {erro && (
        <div className={styles.erro} role="alert">
          <span>Não deu pra carregar o resumo.</span>
          <PontesButton variant="outline" size="sm" onClick={() => { void load() }}>Tentar de novo</PontesButton>
        </div>
      )}

      {data && (
        <>
          {/* Faixa de saldo: quanto tenho (hoje) + como foi o mês escolhido. É o único bloco grande. */}
          <div className={styles.hero}>
            <div className={styles.heroBlob} />
            <div className={styles.heroMain}>
              <div className={styles.heroLabel}>Saldo total</div>
              <div className={styles.heroValue}>{formatMoney(data.saldoTotal)}</div>
              <HeroDelta saldoTotal={data.saldoTotal} saldoMesAnterior={data.saldoMesAnterior} hide={hide} />
            </div>

            <div className={styles.heroMes} data-atualizando={loading ? "true" : undefined}>
              <div className={styles.monthNav}>
                <button type="button" className={styles.monthBtn} onClick={prevMonth} aria-label="Mês anterior">
                  <ChevronLeft size={15} strokeWidth={2.5} />
                </button>
                <span className={styles.monthLabel}>{monthLabel}</span>
                <button type="button" className={styles.monthBtn} onClick={nextMonth} aria-label="Próximo mês">
                  <ChevronRight size={15} strokeWidth={2.5} />
                </button>
              </div>

              {/* Fluxo de CAIXA do mês (o mesmo número de /transactions): compra no crédito não entra. */}
              <div className={styles.heroStats}>
                <HeroStat label="Entrou" value={formatMoney(data.entradasCaixa)}
                  current={data.entradasCaixa} prev={data.entradasCaixaMesAnterior} higherIsBetter hide={hide} />
                <div className={styles.heroStatDivider} />
                <HeroStat label="Saiu" value={formatMoney(data.saidasCaixa)}
                  current={data.saidasCaixa} prev={data.saidasCaixaMesAnterior} hide={hide} />
                <div className={styles.heroStatDivider} />
                <HeroStat label="Sobrou" value={formatMoney(data.saldoCaixaMes)}
                  tone={data.saldoCaixaMes >= 0 ? "up" : "down"} />
              </div>

              {(data.aReceber > 0 || data.aPagar > 0) && (
                <div className={styles.pendencias}>
                  {data.aReceber > 0 && <span>Ainda vai entrar <strong>{formatMoney(data.aReceber)}</strong></span>}
                  {data.aPagar > 0 && <span>Ainda vai sair <strong>{formatMoney(data.aPagar)}</strong></span>}
                </div>
              )}
            </div>
          </div>

          {/* Gráficos lado a lado */}
          <div className={styles.grid2} data-atualizando={loading ? "true" : undefined}>
            <section className={styles.caixa}>
              <div className={styles.caixaTopo}>
                <h2 className={styles.caixaTitulo}>Saldo nos últimos meses</h2>
              </div>
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.evolucaoSaldo} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="dash-saldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={p.primary} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={p.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={p.border} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: p.textMuted }} axisLine={false} tickLine={false} dy={4} />
                    <YAxis width={58} tick={{ fontSize: 11, fill: p.textMuted }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} />
                    <Tooltip
                      formatter={(v) => [hide ? MONEY_MASK : formatMoney(Number(v)), "Saldo"] as [string, string]}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${p.border}`, fontFamily: font, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="saldo" stroke={p.primary} strokeWidth={2} fill="url(#dash-saldo)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className={styles.caixa}>
              <div className={styles.caixaTopo}>
                <h2 className={styles.caixaTitulo}>Maiores gastos</h2>
              </div>
              <div className={styles.donutBox}>
                <PontesCategoryDonut
                  data={data.topCategorias.map((c) => ({ label: c.descricao, valor: c.valor, percentual: c.percentual }))}
                  formatMoney={formatMoney}
                  height={170}
                  emptyLabel="Nenhuma despesa no período"
                />
              </div>
            </section>
          </div>

          {/* O que aconteceu (esquerda) + onde está o dinheiro (direita) */}
          <div className={styles.grid2} data-topo="true">
            <section className={styles.caixa}>
              <div className={styles.caixaTopo}>
                <h2 className={styles.caixaTitulo}>Transações recentes</h2>
                <button type="button" className={styles.linkBtn} onClick={() => navigate("/transactions")}>
                  Ver todas <ArrowRight size={13} strokeWidth={2.5} />
                </button>
              </div>
              {data.transacoesRecentes.length === 0 ? (
                <div className={styles.vazio}>Nenhuma transação ainda</div>
              ) : (
                data.transacoesRecentes.map((t) => <TxRow key={t.id} t={t} />)
              )}
            </section>

            <div className={styles.coluna}>
              <div data-atualizando={loading ? "true" : undefined}>
                <OrcamentoBox orcamento={orcamento} onConfigurar={() => navigate("/limites")} />
              </div>

              <section className={styles.caixa}>
                <div className={styles.caixaTopo}>
                  <h2 className={styles.caixaTitulo}>Contas</h2>
                  <button type="button" className={styles.linkBtn} onClick={() => navigate("/accounts")}>
                    Ver todas <ArrowRight size={13} strokeWidth={2.5} />
                  </button>
                </div>
                {data.saldoContas.length === 0 ? (
                  <div className={styles.vazio}>Nenhuma conta cadastrada</div>
                ) : (
                  data.saldoContas.map((c) => <ContaRow key={c.id} conta={c} />)
                )}
              </section>

              {data.cartoesResumo.length > 0 && (
                <section className={styles.caixa}>
                  <div className={styles.caixaTopo}>
                    <h2 className={styles.caixaTitulo}>Cartões</h2>
                    <button type="button" className={styles.linkBtn} onClick={() => navigate("/credit-cards")}>
                      Ver todos <ArrowRight size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                  {data.cartoesResumo.map((c) => <CartaoRow key={c.id} cartao={c} />)}
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * HeroDelta — quanto o saldo andou desde o fim do mês passado (mês do calendário, não o navegado:
 * o saldo do hero é o de hoje). Sem sinal de +/−: o ícone, o texto e a cor dizem a direção.
 */
function HeroDelta({ saldoTotal, saldoMesAnterior, hide }: {
  saldoTotal: number; saldoMesAnterior: number; hide: boolean
}) {
  const delta = saldoTotal - saldoMesAnterior
  if (Math.abs(delta) < 0.005) return null
  const subiu = delta > 0
  const Icone = subiu ? TrendingUp : TrendingDown
  const agora = new Date()
  const mesPassado = MESES[new Date(agora.getFullYear(), agora.getMonth() - 1, 1).getMonth()]
  return (
    <div className={styles.heroDelta} data-tone={subiu ? "up" : "down"}>
      <Icone size={14} strokeWidth={2.5} />
      <span>
        {hide ? MONEY_MASK : formatMoney(Math.abs(delta))} {subiu ? "a mais" : "a menos"}
      </span>
      <span className={styles.heroDeltaLabel}>que no fim de {mesPassado}</span>
    </div>
  )
}

/**
 * HeroStat — um dos 3 números do mês (Entrou / Saiu / Sobrou). Entrou e Saiu mostram a variação %
 * contra o mês anterior (verde = bom pra aquela métrica: mais entrada ou menos saída).
 */
function HeroStat({ label, value, tone, current, prev, higherIsBetter, hide }: {
  label: string; value: string; tone?: "up" | "down"
  current?: number; prev?: number; higherIsBetter?: boolean; hide?: boolean
}) {
  let variacao: ReactNode = null
  if (current !== undefined && prev !== undefined && Math.abs(prev) > 0.005) {
    const pct = ((current - prev) / Math.abs(prev)) * 100
    const subiu = pct >= 0
    const bom = subiu === !!higherIsBetter
    const Icone = subiu ? TrendingUp : TrendingDown
    variacao = (
      <span className={styles.heroStatVar} data-tone={bom ? "up" : "down"} title="comparado ao mês anterior">
        <Icone size={11} strokeWidth={2.5} />
        {hide ? "••" : `${Math.abs(pct).toFixed(0)}%`}
      </span>
    )
  }
  return (
    <div className={styles.heroStat}>
      <span className={styles.heroStatLabel}>{label}{variacao}</span>
      <span className={styles.heroStatValue} data-tone={tone}>{value}</span>
    </div>
  )
}

/** Linha de transação recente — mesma anatomia da linha do PontesTabela (ícone 34, nome, sub). */
function TxRow({ t }: { t: TransacaoRecente }) {
  // Transferência e pagamento de fatura são neutros: mexem no saldo, mas não são ganho nem gasto.
  const neutra = !!t.ehTransferencia || !!t.ehPagamentoFatura
  const entrada = t.tipo === 2
  const tom = neutra ? "neutro" : entrada ? "entrada" : "saida"
  const Icone = t.ehTransferencia ? ArrowLeftRight : t.ehPagamentoFatura ? CreditCard : entrada ? ArrowUpRight : ArrowDownLeft
  const detalhe = [t.categoria, t.conta, fmtQuando(t.data, t.hora)].filter(Boolean).join(" · ")
  return (
    <div className={styles.linha}>
      <span className={styles.linhaIcone} data-tom={tom}><Icone size={16} strokeWidth={2.4} /></span>
      <div className={styles.linhaTexto}>
        <span className={styles.linhaNome}>{t.descricao}</span>
        <span className={styles.linhaSub}>{detalhe}</span>
      </div>
      <span className={styles.linhaValor} data-tom={tom}>{formatMoney(t.valor)}</span>
    </div>
  )
}

/** Linha de conta: logo do banco, nome e saldo. Cor do logo (conta.cor) é dado do banco. */
function ContaRow({ conta }: { conta: SaldoConta }) {
  return (
    <div className={styles.linha}>
      <PontesBankBadge name={conta.bancoNome ?? conta.nome} logoUrl={conta.logoUrl} cor={conta.cor} size={28} />
      <div className={styles.linhaTexto}>
        <span className={styles.linhaNome}>{conta.nome}</span>
        <span className={styles.linhaSub}>{conta.bancoNome ?? conta.tipoDescricao}</span>
      </div>
      <span className={styles.linhaValor} data-tom={conta.saldo < 0 ? "saida" : undefined}>{formatMoney(conta.saldo)}</span>
    </div>
  )
}

/** Linha de cartão: quanto do limite está usado (barra) e quando fecha a fatura. */
function CartaoRow({ cartao }: { cartao: CartaoResumo }) {
  const pct = Math.max(0, Math.min(100, cartao.percentualUsado))
  const tone = pct >= 90 ? "danger" : pct >= 70 ? "warning" : "ok"
  const dias = cartao.diasAteFechamento
  const fecha = dias == null ? null : dias === 0 ? "fecha hoje" : dias === 1 ? "fecha amanhã" : `fecha em ${dias} dias`
  return (
    <div className={styles.bloco}>
      <div className={styles.blocoTopo}>
        <span className={styles.linhaNome}>
          {cartao.nome}{cartao.ultimosDigitos ? <span className={styles.digitos}> •••• {cartao.ultimosDigitos}</span> : null}
        </span>
        <span className={styles.blocoValor}>{formatMoney(cartao.limiteUsado)} de {formatMoney(cartao.limiteTotal)}</span>
      </div>
      <div className={styles.barra}><div className={styles.barraFill} data-tone={tone} style={{ width: `${pct}%` }} /></div>
      {fecha && <div className={styles.linhaSub}>{fecha}</div>}
    </div>
  )
}

/**
 * OrcamentoBox — quanto ainda dá pra gastar no mês, sobre o orçamento GERAL. Sem orçamento,
 * só o atalho pra configurar em /limites.
 */
function OrcamentoBox({ orcamento, onConfigurar }: { orcamento: Orcamento | null; onConfigurar: () => void }) {
  if (!orcamento) {
    return (
      <section className={styles.caixa}>
        <div className={styles.caixaTopo} data-semborda="true">
          <h2 className={styles.caixaTitulo}>Orçamento do mês</h2>
          <PontesButton variant="outline" size="sm" iconStart={<Target size={14} strokeWidth={2.5} />} onClick={onConfigurar}>
            Configurar
          </PontesButton>
        </div>
      </section>
    )
  }
  const pct = Math.min(100, Math.max(0, orcamento.percentualConsumido))
  const tone = orcamento.ultrapassado ? "danger" : orcamento.emAlerta ? "warning" : "ok"
  return (
    <section className={styles.caixa}>
      <div className={styles.bloco}>
        <div className={styles.blocoTopo}>
          <h2 className={styles.caixaTitulo}>Orçamento do mês</h2>
          <span className={styles.orcPct} data-tone={tone}>{pct.toFixed(0)}%</span>
        </div>
        <div className={styles.barra}><div className={styles.barraFill} data-tone={tone} style={{ width: `${pct}%` }} /></div>
        <div className={styles.orcPe}>
          <span>
            {orcamento.ultrapassado
              ? `Passou ${formatMoney(orcamento.valorGasto - orcamento.valorLimite)} do limite`
              : `Ainda pode gastar ${formatMoney(orcamento.valorRestante)}`}
          </span>
          <span>{formatMoney(orcamento.valorGasto)} de {formatMoney(orcamento.valorLimite)}</span>
        </div>
      </div>
    </section>
  )
}
