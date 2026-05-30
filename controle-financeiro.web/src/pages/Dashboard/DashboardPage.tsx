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
  ArrowDownLeft, ArrowUpRight, ArrowRight, PiggyBank, Clock,
  Plus, CreditCard, ArrowLeftRight, Receipt,
  TrendingUp, TrendingDown, type LucideIcon,
} from "lucide-react"
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts"
import { PontesCard, PontesIconButton, PontesBadge, PontesBankBadge, PontesCategoryDonut, usePontesTheme } from "@/components/pontes"
import { getDashboard } from "../../services/dashboardService"
import type { DashboardData, SaldoConta, TransacaoRecente, CartaoResumo } from "../../types/Dashboard"
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

  // Atalhos teclado globais — só quando foco NÃO está em input/textarea.
  // N → Nova transação, T → /transactions, C → /credit-cards, ←/→ navega mês.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      switch (e.key.toLowerCase()) {
        case "n":
          // Dispara o modal global de Nova Transação (escutado pelo Shell).
          window.dispatchEvent(new Event("openNewTransaction"))
          e.preventDefault(); break
        case "t":
          navigate("/transactions"); e.preventDefault(); break
        case "c":
          navigate("/credit-cards"); e.preventDefault(); break
        case "f":
          navigate("/transfers"); e.preventDefault(); break
        case "arrowleft":
          prevMonth(); e.preventDefault(); break
        case "arrowright":
          nextMonth(); e.preventDefault(); break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate])

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
          <HeroBalance
            saldoTotal={data.saldoTotal}
            saldoMesAnterior={data.saldoMesAnterior}
            fmt={fmt}
            hide={hide}
          />

          {/* Atalhos rápidos — 4 ações principais. Teclado em parens. */}
          <QuickActions navigate={navigate} />

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

            {/* 3 números humanos — usam FLUXO DE CAIXA (exclui crédito não-pago),
                igual /transacoes/stats. "Entrou/Saiu" só conta o que de fato
                moveu caixa; compras no crédito aparecem em Pendências abaixo
                como "ainda vai sair" via APagar. */}
            <div className={styles.monthGrid}>
              <MonthStat label="Entrou" value={fmt(data.entradasCaixa)} icon={ArrowUpRight} tone="success" />
              <MonthStat label="Saiu" value={fmt(data.saidasCaixa)} icon={ArrowDownLeft} tone="danger" />
              <MonthStat
                label="Sobrou" value={fmt(data.saldoCaixaMes)} icon={PiggyBank}
                tone={data.saldoCaixaMes >= 0 ? "success" : "danger"}
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
              <PontesCategoryDonut
                data={data.topCategorias.map((c) => ({ label: c.descricao, valor: c.valor, percentual: c.percentual }))}
                formatMoney={fmt}
                emptyLabel="Nenhuma despesa no período"
              />
            </PontesCard>
          </div>

          {/* Cartões — top 3 por % limite usado, com próximo fechamento */}
          {data.cartoesResumo.length > 0 && (
            <PontesCard padding={24} radius={18}>
              <div className={styles.contasHead}>
                <div className={styles.contasTitle}>Seus cartões</div>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => navigate("/credit-cards")}
                >
                  Ver todos <ArrowRight size={14} strokeWidth={2.5} />
                </button>
              </div>
              <div className={styles.cartoesGrid}>
                {data.cartoesResumo.map((c) => (
                  <CartaoTile key={c.id} cartao={c} fmt={fmt} onClick={() => navigate("/credit-cards")} />
                ))}
              </div>
            </PontesCard>
          )}

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
  const neg = conta.saldo < 0
  return (
    <div className={styles.tile}>
      <div className={styles.tileHead}>
        <PontesBankBadge
          name={conta.bancoNome ?? conta.nome}
          logoUrl={conta.logoUrl}
          cor={conta.cor}
          size={36}
        />
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

/**
 * HeroBalance — saldo total + delta vs mês anterior.
 *
 * Delta é a história: "subiu R$ 850 (+3,2%)" é mais útil que só "R$ 27.430".
 * Se saldoMesAnterior === 0 e atual !== 0, esconde %  (divisão estouraria).
 * `hide` aplica máscara no delta também — coerência com toggle do olho.
 */
function HeroBalance({ saldoTotal, saldoMesAnterior, fmt, hide }: {
  saldoTotal: number; saldoMesAnterior: number;
  fmt: (v: number) => string; hide: boolean
}) {
  const delta = saldoTotal - saldoMesAnterior
  const hasBaseline = Math.abs(saldoMesAnterior) > 0.005
  const pct = hasBaseline ? (delta / Math.abs(saldoMesAnterior)) * 100 : null
  const tone = delta >= 0 ? "up" : "down"
  const TrendIcon = delta >= 0 ? TrendingUp : TrendingDown
  return (
    <div className={styles.hero}>
      <div className={styles.heroBlob} />
      <div className={styles.heroBlob2} />
      <div className={styles.heroInner}>
        <div className={styles.heroLabel}>Saldo total</div>
        <div className={styles.heroValue}>{fmt(saldoTotal)}</div>
        {/* Delta — só renderiza se houve mês anterior com saldo */}
        {hasBaseline && (
          <div className={styles.heroDelta} data-tone={tone}>
            <TrendIcon size={15} strokeWidth={2.5} />
            <span>
              {hide ? "•••• " : `${delta >= 0 ? "+" : ""}${fmt(delta)} `}
              {pct !== null && (
                <span className={styles.heroDeltaPct}>
                  ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                </span>
              )}
            </span>
            <span className={styles.heroDeltaLabel}>vs mês anterior</span>
          </div>
        )}
        {!hasBaseline && (
          <div className={styles.heroSub}>Soma de todas as contas</div>
        )}
      </div>
      <div className={styles.heroIcon}>
        <Wallet size={26} strokeWidth={2} />
      </div>
    </div>
  )
}

/**
 * QuickActions — 4 atalhos horizontais. Cada um tem hover, ícone, label
 * e dica de teclado (kbd). Específicos do dashboard.
 *
 * "Nova transação" dispara evento global `openNewTransaction` que o Shell
 * já escuta pra abrir o modal (mesma porta de N do teclado).
 */
function QuickActions({ navigate }: { navigate: (to: string) => void }) {
  const items: { icon: LucideIcon; label: string; kbd: string; action: () => void }[] = [
    { icon: Plus, label: "Nova transação", kbd: "N", action: () => window.dispatchEvent(new Event("openNewTransaction")) },
    { icon: Receipt, label: "Transações", kbd: "T", action: () => navigate("/transactions") },
    { icon: CreditCard, label: "Cartões", kbd: "C", action: () => navigate("/credit-cards") },
    { icon: ArrowLeftRight, label: "Transferir", kbd: "F", action: () => navigate("/transfers") },
  ]
  return (
    <div className={styles.quickActions}>
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.action}
          className={styles.quickAction}
        >
          <span className={styles.quickActionIcon}>
            <it.icon size={18} strokeWidth={2.4} />
          </span>
          <span className={styles.quickActionLabel}>{it.label}</span>
          {it.kbd && <span className={styles.quickActionKbd}>{it.kbd}</span>}
        </button>
      ))}
    </div>
  )
}

/**
 * CartaoTile — resumo de UM cartão (top 3 do dashboard).
 * Limite usado em barra + status do próximo fechamento.
 * Cor da barra varia com % usado (safe/warning/danger) — sinal visual rápido.
 */
function CartaoTile({ cartao, fmt, onClick }: {
  cartao: CartaoResumo; fmt: (v: number) => string; onClick: () => void
}) {
  const pct = Math.max(0, Math.min(100, cartao.percentualUsado))
  // Pressão: <60 ok, 60-85 atenção, >85 perigo. Não-linear porque user só sente
  // dor quando passa de 80%.
  const tone = pct >= 85 ? "danger" : pct >= 60 ? "warning" : "ok"
  const dias = cartao.diasAteFechamento
  const fechaLabel =
    dias == null ? null :
      dias === 0 ? "fecha hoje" :
        dias === 1 ? "fecha amanhã" :
          dias > 0 ? `fecha em ${dias} dias` :
            `fechou há ${Math.abs(dias)}d`
  const fechaUrgente = dias != null && dias >= 0 && dias <= 5
  return (
    <button type="button" onClick={onClick} className={styles.cartaoTile}>
      <div className={styles.cartaoHead}>
        <PontesBankBadge
          name={cartao.bancoNome ?? cartao.nome}
          logoUrl={cartao.bancoLogoUrl ?? undefined}
          cor={cartao.bancoCor ?? undefined}
          size={36}
        />
        <div className={styles.cartaoInfo}>
          <div className={styles.cartaoNome}>{cartao.nome}</div>
          <div className={styles.cartaoBanco}>{cartao.bancoNome ?? "Cartão"}</div>
        </div>
        <span className={styles.cartaoPct} data-tone={tone}>{pct.toFixed(0)}%</span>
      </div>
      <div className={styles.cartaoBar} data-tone={tone}>
        <div className={styles.cartaoBarFill} data-tone={tone} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.cartaoFoot}>
        <span>{fmt(cartao.limiteUsado)} <span className={styles.cartaoMuted}>de {fmt(cartao.limiteTotal)}</span></span>
        {fechaLabel && (
          <span className={styles.cartaoFecha} data-urgent={fechaUrgente}>
            {fechaLabel}
          </span>
        )}
      </div>
    </button>
  )
}
