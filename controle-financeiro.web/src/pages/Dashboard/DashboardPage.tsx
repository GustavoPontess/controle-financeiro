/**
 * DashboardPage — refator Q5 (#81), estilo via CSS Modules + var(--pontes-*) (#122).
 *
 * Foco: leitura de relance, sem assustar. Responde 3 perguntas em ordem:
 * 1) Quanto tenho? (Saldo total — hero)
 * 2) Como foi o mês? (Entrou / Saiu / Sobrou — linguagem humana)
 * 3) Tem pendência? (A receber / A pagar — strip secundário, só se > 0)
 * Depois: evolução do saldo, maiores gastos, contas e transações recentes.
 *
 * Cor/fonte vêm de CSS vars (tema global). usePontesTheme() é usado APENAS
 * para as cores dos gráficos recharts — var() não resolve em atributos SVG.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Eye, EyeOff, ChevronLeft, ChevronRight, Wallet,
  ArrowDownLeft, ArrowUpRight, ArrowRight, Landmark, PiggyBank, Clock, type LucideIcon,
} from "lucide-react"
import {
  AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts"
import { PontesCard, PontesIconButton, PontesBadge, usePontesTheme, semantic } from "@/components/pontes"
import { getDashboard } from "../../services/dashboardService"
import type { DashboardData, SaldoConta, TransacaoRecente } from "../../types/Dashboard"
import { useAuth } from "../../hooks/useAuth"
import styles from "./DashboardPage.module.css"

const fmtFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

/** Data humana: Hoje / Ontem / "12 mai". */
function fmtRelDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((a.getTime() - b.getTime()) / 86400000)
  if (diff === 0) return "Hoje"
  if (diff === 1) return "Ontem"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

export default function DashboardPage() {
  // Tema só pras cores dos gráficos (recharts SVG não lê var(--pontes-*)).
  const { palette: p, font } = usePontesTheme()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const firstName = currentUser?.nome?.trim().split(" ")[0] ?? ""

  // Cores do donut: paleta + semantic (sem hex solto).
  const chartColors = [p.primary, p.accent, semantic.warning, semantic.info, semantic.success, p.textMuted]

  const [data, setData] = useState<DashboardData | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [hide, setHide] = useState(false)

  const fmt = useCallback((v: number) => (hide ? "R$ ••••" : fmtFull(v)), [hide])

  // Eixo Y: valor compacto ("R$ 5 mil"). Em branco quando olho fechado.
  const fmtAxis = useCallback(
    (v: number) => (hide ? "" : new Intl.NumberFormat("pt-BR", {
      notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1,
    }).format(v)),
    [hide]
  )

  const todayLabel = useMemo(
    () => new Date()
      .toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
      .replace(/^\w/, (c) => c.toUpperCase()),
    []
  )
  const monthLabel = currentDate
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getDashboard(currentDate.getFullYear(), currentDate.getMonth() + 1))
    } finally {
      setLoading(false)
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

  return (
    <div className={styles.root}>
      {/* Saudação + olho */}
      <div className={styles.greetRow}>
        <div>
          <h1 className={styles.greetTitle}>
            {firstName ? `Olá, ${firstName}` : "Visão geral"}
          </h1>
          <div className={styles.greetSub}>
            {todayLabel} · <em className={styles.greetSubEm}>resumo das suas finanças</em>
          </div>
        </div>
        <PontesIconButton
          variant="outline" size={40}
          onClick={() => setHide((h) => !h)}
          aria-label={hide ? "Mostrar valores" : "Esconder valores"}
        >
          {hide ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
        </PontesIconButton>
      </div>

      {loading && !data && (
        <div className={styles.loadBar}>
          <div className={styles.loadBarFill} />
        </div>
      )}

      {data && (
        <>
          <HeroBalance value={fmt(data.saldoTotal)} />

          {/* Seu mês — Entrou / Saiu / Sobrou (resposta de relance) */}
          <PontesCard padding={0} radius={18}>
            {/* Header: título + navegação de mês */}
            <div className={styles.monthHead}>
              <div className={styles.monthTitle}>Seu mês</div>
              <div className={styles.monthNav}>
                <PontesIconButton variant="outline" size={32} onClick={prevMonth} aria-label="Mês anterior">
                  <ChevronLeft size={16} strokeWidth={2.5} />
                </PontesIconButton>
                <div className={styles.monthLabel}>{monthLabel}</div>
                <PontesIconButton variant="outline" size={32} onClick={nextMonth} aria-label="Próximo mês">
                  <ChevronRight size={16} strokeWidth={2.5} />
                </PontesIconButton>
              </div>
            </div>

            {/* 3 números humanos */}
            <div className={styles.monthGrid}>
              <MonthStat label="Entrou" value={fmt(data.recebido)} icon={ArrowUpRight} tone="success" />
              <MonthStat label="Saiu" value={fmt(data.pago)} icon={ArrowDownLeft} tone="danger" />
              <MonthStat
                label="Sobrou" value={fmt(data.recebido - data.pago)} icon={PiggyBank}
                tone={data.recebido - data.pago >= 0 ? "success" : "danger"}
                emphasis
              />
            </div>

            {/* Pendências — só se houver algo a receber ou pagar */}
            {(data.aReceber > 0 || data.aPagar > 0) && (
              <div className={styles.pendings}>
                {data.aReceber > 0 && (
                  <span className={styles.pendItem}>
                    <Clock size={15} strokeWidth={2} className={styles.pendIcon} />
                    Ainda vai entrar <strong className={styles.pendStrong}>{fmt(data.aReceber)}</strong>
                  </span>
                )}
                {data.aPagar > 0 && (
                  <span className={styles.pendItem}>
                    <Clock size={15} strokeWidth={2} className={styles.pendIcon} />
                    Ainda vai sair <strong className={styles.pendStrong}>{fmt(data.aPagar)}</strong>
                  </span>
                )}
              </div>
            )}
          </PontesCard>

          {/* Gráficos lado a lado no desktop */}
          <div className={styles.chartsGrid}>
            {/* Evolução do saldo (área) */}
            <PontesCard padding={24} radius={18} hover style={{ minWidth: 0 }}>
              <div className={styles.cardTitle}>Saldo nos últimos meses</div>
              <div className={styles.cardSub}>Pra ver se está subindo ou caindo</div>
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.evolucaoSaldo} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="dash-saldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={p.primary} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={p.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={p.border} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: p.textMuted }} axisLine={false} tickLine={false} dy={4} />
                    <YAxis
                      width={64}
                      tick={{ fontSize: 12, fill: p.textMuted }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={fmtAxis}
                    />
                    <Tooltip
                      formatter={(v) => [hide ? "R$ ••••" : fmtFull(Number(v)), "Saldo"] as [string, string]}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${p.border}`, fontFamily: font, fontSize: 13 }}
                    />
                    <Area type="monotone" dataKey="saldo" stroke={p.primary} strokeWidth={2.5} fill="url(#dash-saldo)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </PontesCard>

            {/* Maiores gastos (donut) */}
            <PontesCard padding={24} radius={18} hover style={{ minWidth: 0 }}>
              <div className={styles.cardTitle}>Maiores gastos</div>
              <div className={styles.cardSub}>Onde seu dinheiro foi este mês</div>
              {data.topCategorias.length === 0 ? (
                <div className={styles.donutEmpty}>Nenhuma despesa no período</div>
              ) : (
                <div className={styles.donutWrap}>
                  <div className={styles.donutChart}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.topCategorias} dataKey="valor" nameKey="descricao" innerRadius={54} outerRadius={80} paddingAngle={2} stroke="none">
                          {data.topCategorias.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className={styles.donutCenter}>
                      <div className={styles.donutCenterLabel}>Total</div>
                      <div className={styles.donutCenterValue}>{fmt(data.topCategorias.reduce((s, c) => s + c.valor, 0))}</div>
                    </div>
                  </div>
                  <div className={styles.legend}>
                    {data.topCategorias.map((cat, i) => (
                      <div key={cat.descricao} className={styles.legendRow}>
                        <span className={styles.legendDot} style={{ background: chartColors[i % chartColors.length] }} />
                        <span className={styles.legendName}>{cat.descricao}</span>
                        <span className={styles.legendPct}>{cat.percentual}%</span>
                        <span className={styles.legendValue}>{fmt(cat.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </PontesCard>
          </div>

          {/* Suas contas */}
          <PontesCard padding={24} radius={18}>
            <div className={styles.contasHead}>
              <div className={styles.contasTitle}>Suas contas</div>
              {data.saldoContas.length > 0 && (
                <div className={styles.contasMeta}>
                  {data.saldoContas.length} {data.saldoContas.length === 1 ? "conta" : "contas"} ·{" "}
                  <strong>{fmt(data.saldoContas.reduce((s, c) => s + c.saldo, 0))}</strong>
                </div>
              )}
            </div>
            {data.saldoContas.length === 0 ? (
              <div className={styles.empty}>Nenhuma conta cadastrada</div>
            ) : (
              <div className={styles.contasGrid}>
                {(() => {
                  const total = data.saldoContas.reduce((s, c) => s + c.saldo, 0)
                  // % do total só faz sentido se tudo positivo (sem conta negativa).
                  const podeMostrar = total > 0 && data.saldoContas.every((c) => c.saldo >= 0)
                  return data.saldoContas.map((conta) => (
                    <AccountTile key={conta.id} conta={conta} fmt={fmt} share={podeMostrar ? (conta.saldo / total) * 100 : null} />
                  ))
                })()}
              </div>
            )}
          </PontesCard>

          {/* Transações recentes */}
          <PontesCard padding={0} radius={18}>
            <div className={styles.txHead}>Transações recentes</div>
            {data.transacoesRecentes.length === 0 ? (
              <div className={styles.empty} style={{ padding: "32px 0" }}>Nenhuma transação encontrada</div>
            ) : (
              <>
                {data.transacoesRecentes.map((t) => (
                  <TxRow key={t.id} t={t} fmt={fmt} />
                ))}
                <button onClick={() => navigate("/transactions")} className={styles.seeAll}>
                  Ver todas as transações <ArrowRight size={15} strokeWidth={2.5} />
                </button>
              </>
            )}
          </PontesCard>
        </>
      )}
    </div>
  )
}

/**
 * AccountTile — card de uma conta com hover (lift + borda). Quando `share`
 * vem preenchido, mostra "X% do seu dinheiro" + barra (fatia do total entre
 * as contas). `share` é null se houver conta negativa (% não faz sentido).
 * Específico do dashboard. Cor da logo (conta.cor) é dado dinâmico do banco.
 */
function AccountTile({ conta, fmt, share }: {
  conta: SaldoConta; fmt: (v: number) => string; share: number | null
}) {
  const [imgErr, setImgErr] = useState(false)
  const neg = conta.saldo < 0
  // Carteira → Wallet; Poupança (tipo 2) → PiggyBank; Corrente/outros → Landmark.
  const Icon = conta.isCarteira ? Wallet : conta.tipo === 2 ? PiggyBank : Landmark
  const showLogo = !!conta.logoUrl && !imgErr
  return (
    <div className={styles.tile}>
      <div className={styles.tileHead}>
        <div
          className={styles.tileLogo}
          style={showLogo && conta.cor ? { background: conta.cor } : undefined}
        >
          {showLogo ? (
            <img
              src={conta.logoUrl}
              alt={conta.bancoNome ?? conta.nome}
              onError={() => setImgErr(true)}
              className={styles.tileLogoImg}
            />
          ) : (
            <Icon size={18} strokeWidth={2} />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className={styles.tileName}>{conta.nome}</div>
          <div className={styles.tileSub}>{conta.bancoNome ?? conta.tipoDescricao}</div>
        </div>
      </div>
      <div>
        <div className={styles.tileSaldo} data-neg={neg}>{fmt(conta.saldo)}</div>
        {share !== null && (
          <>
            <div className={styles.shareRow}>
              <span className={styles.shareLabel}>do seu dinheiro</span>
              <span className={styles.sharePct}>{Math.round(share)}%</span>
            </div>
            <div className={styles.shareTrack}>
              <div className={styles.shareFill} style={{ width: `${share}%` }} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * TxRow — linha de transação recente com hover. Específico do dashboard.
 */
function TxRow({ t, fmt }: { t: TransacaoRecente; fmt: (v: number) => string }) {
  const receita = t.tipo === 2
  return (
    <div className={styles.txRow}>
      <div className={styles.txIcon} data-tone={receita ? "receita" : "despesa"}>
        {receita ? <ArrowUpRight size={18} strokeWidth={2.5} /> : <ArrowDownLeft size={18} strokeWidth={2.5} />}
      </div>
      <div className={styles.txInfo}>
        <div className={styles.txTitle}>{t.descricao}</div>
        <div className={styles.txSub}>
          {t.categoria ?? "Sem categoria"}{t.conta ? ` · ${t.conta}` : ""} · {fmtRelDate(t.data)}
        </div>
      </div>
      {t.meioPagamentoDescricao && (
        <PontesBadge tone="neutral" size="sm">{t.meioPagamentoDescricao}</PontesBadge>
      )}
      <div className={styles.txValue} data-tone={receita ? "receita" : undefined}>
        {receita ? "+ " : "− "}{fmt(t.valor)}
      </div>
    </div>
  )
}

/**
 * MonthStat — um dos 3 números do mês (Entrou/Saiu/Sobrou).
 * Entrou/Saiu: valor neutro, só o ícone colorido (menos ruído).
 * Sobrou (emphasis): fundo soft + valor colorido — é a resposta que salta.
 */
function MonthStat({ label, value, icon: Icon, tone, emphasis }: {
  label: string; value: string; icon: LucideIcon
  tone: "success" | "danger"; emphasis?: boolean
}) {
  return (
    <div className={styles.stat} data-emphasis={!!emphasis} data-tone={tone}>
      <div className={styles.statHead}>
        <span className={styles.statIcon} data-tone={tone}>
          <Icon size={17} strokeWidth={2.4} />
        </span>
        <span className={styles.statLabel}>{label}</span>
      </div>
      <div className={styles.statValue} data-emphasis={!!emphasis} data-tone={tone}>{value}</div>
    </div>
  )
}

function HeroBalance({ value }: { value: string }) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroBlob} />
      <div className={styles.heroInner}>
        <div className={styles.heroLabel}>Saldo total</div>
        <div className={styles.heroValue}>{value}</div>
        <div className={styles.heroSub}>Soma de todas as contas</div>
      </div>
      <div className={styles.heroIcon}>
        <Wallet size={26} strokeWidth={2} />
      </div>
    </div>
  )
}
