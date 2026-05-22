/**
 * DashboardPage — refator Q5 (#81). 100% biblioteca Pontes + recharts.
 *
 * Foco: leitura de relance, sem assustar. Responde 3 perguntas em ordem:
 * 1) Quanto tenho? (Saldo total — hero)
 * 2) Como foi o mês? (Entrou / Saiu / Sobrou — linguagem humana)
 * 3) Tem pendência? (A receber / A pagar — strip secundário, só se > 0)
 * Depois: evolução do saldo, maiores gastos, contas e transações recentes.
 * Cor + fonte via usePontesTheme; feedback via semantic. Olho esconde valores.
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
import { PontesCard, PontesIconButton, PontesBadge, usePontesTheme, semantic, type Palette } from "@/components/pontes"
import { getDashboard } from "../../services/dashboardService"
import type { DashboardData, SaldoConta, TransacaoRecente } from "../../types/Dashboard"
import { useAuth } from "../../hooks/useAuth"

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
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: font, color: p.text }}>
      {/* Saudação + olho */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", color: p.text, margin: 0, fontFamily: "'Fraunces', serif" }}>
            {firstName ? `Olá, ${firstName}` : "Visão geral"}
          </h1>
          <div style={{ fontSize: 14, color: p.textMuted, marginTop: 4 }}>
            {todayLabel} · <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>resumo das suas finanças</em>
          </div>
        </div>
        <PontesIconButton
          p={p} font={font} variant="outline" size={40}
          onClick={() => setHide((h) => !h)}
          aria-label={hide ? "Mostrar valores" : "Esconder valores"}
        >
          {hide ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
        </PontesIconButton>
      </div>

      {loading && !data && (
        <div style={{ height: 4, background: p.primarySoft, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: "40%", background: p.primary, borderRadius: 2 }} />
        </div>
      )}

      {data && (
        <>
          <HeroBalance p={p} font={font} value={fmt(data.saldoTotal)} />

          {/* Seu mês — Entrou / Saiu / Sobrou (resposta de relance) */}
          <PontesCard p={p} padding={0} radius={18}>
            {/* Header: título + navegação de mês */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "18px 24px", borderBottom: `1px solid ${p.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: p.text }}>Seu mês</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PontesIconButton p={p} font={font} variant="outline" size={32} onClick={prevMonth} aria-label="Mês anterior">
                  <ChevronLeft size={16} strokeWidth={2.5} />
                </PontesIconButton>
                <div style={{ minWidth: 150, textAlign: "center", fontWeight: 700, fontSize: 15, color: p.primary }}>{monthLabel}</div>
                <PontesIconButton p={p} font={font} variant="outline" size={32} onClick={nextMonth} aria-label="Próximo mês">
                  <ChevronRight size={16} strokeWidth={2.5} />
                </PontesIconButton>
              </div>
            </div>

            {/* 3 números humanos */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 4, padding: 12 }}>
              <MonthStat p={p} label="Entrou" value={fmt(data.recebido)} icon={ArrowUpRight} accent={semantic.success} accentSoft={semantic.successSoft} />
              <MonthStat p={p} label="Saiu" value={fmt(data.pago)} icon={ArrowDownLeft} accent={semantic.danger} accentSoft={semantic.dangerSoft} />
              <MonthStat
                p={p} label="Sobrou" value={fmt(data.recebido - data.pago)} icon={PiggyBank}
                accent={data.recebido - data.pago >= 0 ? semantic.success : semantic.danger}
                accentSoft={data.recebido - data.pago >= 0 ? semantic.successSoft : semantic.dangerSoft}
                emphasis
              />
            </div>

            {/* Pendências — só se houver algo a receber ou pagar */}
            {(data.aReceber > 0 || data.aPagar > 0) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: "14px 24px", borderTop: `1px solid ${p.border}`, fontSize: 13, color: p.textMuted }}>
                {data.aReceber > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <Clock size={15} strokeWidth={2} style={{ color: semantic.warning }} />
                    Ainda vai entrar <strong style={{ color: p.text, fontWeight: 700 }}>{fmt(data.aReceber)}</strong>
                  </span>
                )}
                {data.aPagar > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <Clock size={15} strokeWidth={2} style={{ color: semantic.warning }} />
                    Ainda vai sair <strong style={{ color: p.text, fontWeight: 700 }}>{fmt(data.aPagar)}</strong>
                  </span>
                )}
              </div>
            )}
          </PontesCard>

          {/* Gráficos lado a lado no desktop */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
            {/* Evolução do saldo (área) */}
            <PontesCard p={p} padding={24} radius={18} hover style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: p.text, marginBottom: 4 }}>Saldo nos últimos meses</div>
              <div style={{ fontSize: 13, color: p.textMuted, marginBottom: 16 }}>Pra ver se está subindo ou caindo</div>
              <div style={{ width: "100%", minWidth: 0, height: 220 }}>
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
            <PontesCard p={p} padding={24} radius={18} hover style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: p.text, marginBottom: 4 }}>Maiores gastos</div>
              <div style={{ fontSize: 13, color: p.textMuted, marginBottom: 16 }}>Onde seu dinheiro foi este mês</div>
              {data.topCategorias.length === 0 ? (
                <div style={{ fontSize: 14, color: p.textMuted, textAlign: "center", padding: "40px 0" }}>Nenhuma despesa no período</div>
              ) : (
                <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ width: 170, height: 170, position: "relative", flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.topCategorias} dataKey="valor" nameKey="descricao" innerRadius={54} outerRadius={80} paddingAngle={2} stroke="none">
                          {data.topCategorias.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      <div style={{ fontSize: 11, color: p.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: p.text }}>{fmt(data.topCategorias.reduce((s, c) => s + c.valor, 0))}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 12 }}>
                    {data.topCategorias.map((cat, i) => (
                      <div key={cat.descricao} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: chartColors[i % chartColors.length], flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: p.text }}>{cat.descricao}</span>
                        <span style={{ fontSize: 12, color: p.textMuted }}>{cat.percentual}%</span>
                        <span style={{ minWidth: 88, textAlign: "right", fontSize: 14, fontWeight: 700, color: p.text }}>{fmt(cat.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </PontesCard>
          </div>

          {/* Suas contas */}
          <PontesCard p={p} padding={24} radius={18}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: p.text }}>Suas contas</div>
              {data.saldoContas.length > 0 && (
                <div style={{ fontSize: 13, color: p.textMuted }}>
                  {data.saldoContas.length} {data.saldoContas.length === 1 ? "conta" : "contas"} ·{" "}
                  <strong style={{ color: p.text, fontWeight: 700 }}>{fmt(data.saldoContas.reduce((s, c) => s + c.saldo, 0))}</strong>
                </div>
              )}
            </div>
            {data.saldoContas.length === 0 ? (
              <div style={{ fontSize: 14, color: p.textMuted, textAlign: "center", padding: "24px 0" }}>Nenhuma conta cadastrada</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {(() => {
                  const total = data.saldoContas.reduce((s, c) => s + c.saldo, 0)
                  // % do total só faz sentido se tudo positivo (sem conta negativa).
                  const podeMostrar = total > 0 && data.saldoContas.every((c) => c.saldo >= 0)
                  return data.saldoContas.map((conta) => (
                    <AccountTile key={conta.id} p={p} conta={conta} fmt={fmt} share={podeMostrar ? (conta.saldo / total) * 100 : null} />
                  ))
                })()}
              </div>
            )}
          </PontesCard>

          {/* Transações recentes */}
          <PontesCard p={p} padding={0} radius={18}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${p.border}`, fontSize: 16, fontWeight: 700, color: p.text }}>
              Transações recentes
            </div>
            {data.transacoesRecentes.length === 0 ? (
              <div style={{ fontSize: 14, color: p.textMuted, textAlign: "center", padding: "32px 0" }}>Nenhuma transação encontrada</div>
            ) : (
              <>
                {data.transacoesRecentes.map((t) => (
                  <TxRow key={t.id} p={p} font={font} t={t} fmt={fmt} />
                ))}
                <button
                  onClick={() => navigate("/transactions")}
                  style={{
                    width: "100%", padding: "14px 24px", border: "none", background: "transparent",
                    color: p.primary, fontFamily: font, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
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
 * Específico do dashboard.
 */
function AccountTile({ p, conta, fmt, share }: {
  p: Palette; conta: SaldoConta; fmt: (v: number) => string; share: number | null
}) {
  const [hover, setHover] = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const neg = conta.saldo < 0
  // Carteira → Wallet; Poupança (tipo 2) → PiggyBank; Corrente/outros → Landmark.
  const Icon = conta.isCarteira ? Wallet : conta.tipo === 2 ? PiggyBank : Landmark
  const showLogo = !!conta.logoUrl && !imgErr
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", flexDirection: "column", gap: 14, padding: 16, borderRadius: 14,
        border: `1px solid ${hover ? p.primary : p.border}`,
        background: hover ? p.primarySoft : p.surface,
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 180ms cubic-bezier(0.4,0,0.2,1), border-color 180ms ease, background 180ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, boxSizing: "border-box", borderRadius: 10, background: showLogo ? (conta.cor || p.surface) : p.primarySoft, color: p.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: `1px solid ${p.border}`, transform: "translateZ(0)" }}>
          {showLogo ? (
            <img
              src={conta.logoUrl}
              alt={conta.bancoNome ?? conta.nome}
              onError={() => setImgErr(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: "scale(1.0)" }}
            />
          ) : (
            <Icon size={18} strokeWidth={2} />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: p.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{conta.nome}</div>
          <div style={{ fontSize: 12, color: p.textMuted }}>{conta.bancoNome ?? conta.tipoDescricao}</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: neg ? semantic.danger : p.text }}>{fmt(conta.saldo)}</div>
        {share !== null && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: p.textMuted }}>do seu dinheiro</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: p.text }}>{Math.round(share)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: p.border, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${share}%`, borderRadius: 999, background: p.primary, transition: "width 240ms ease" }} />
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
function TxRow({ p, font, t, fmt }: {
  p: Palette; font: string; t: TransacaoRecente; fmt: (v: number) => string
}) {
  const [hover, setHover] = useState(false)
  const receita = t.tipo === 2
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "14px 24px",
        borderBottom: `1px solid ${p.border}`,
        background: hover ? p.primarySoft : "transparent",
        transition: "background 140ms ease",
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: receita ? semantic.successSoft : semantic.dangerSoft, color: receita ? semantic.success : semantic.danger }}>
        {receita ? <ArrowUpRight size={18} strokeWidth={2.5} /> : <ArrowDownLeft size={18} strokeWidth={2.5} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: p.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.descricao}</div>
        <div style={{ fontSize: 12, color: p.textMuted }}>
          {t.categoria ?? "Sem categoria"}{t.conta ? ` · ${t.conta}` : ""} · {fmtRelDate(t.data)}
        </div>
      </div>
      {t.meioPagamentoDescricao && (
        <PontesBadge p={p} font={font} tone="neutral" size="sm">{t.meioPagamentoDescricao}</PontesBadge>
      )}
      <div style={{ fontSize: 15, fontWeight: 800, color: receita ? semantic.success : p.text, whiteSpace: "nowrap" }}>
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
function MonthStat({ p, label, value, icon: Icon, accent, accentSoft, emphasis }: {
  p: Palette; label: string; value: string; icon: LucideIcon
  accent: string; accentSoft: string; emphasis?: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20, borderRadius: 14, background: emphasis ? accentSoft : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: accentSoft, color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={17} strokeWidth={2.4} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: p.textMuted }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, color: emphasis ? accent : p.text }}>{value}</div>
    </div>
  )
}

function HeroBalance({ p, font, value }: { p: Palette; font: string; value: string }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 18, padding: 32, color: p.heroFg,
      background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primaryDark} 100%)`, fontFamily: font,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ position: "absolute", right: -40, top: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.85 }}>Saldo total</div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 6 }}>{value}</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Soma de todas as contas</div>
      </div>
      <div style={{ position: "relative", width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Wallet size={26} strokeWidth={2} />
      </div>
    </div>
  )
}
