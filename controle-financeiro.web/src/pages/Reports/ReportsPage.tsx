import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
  ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie, ReferenceLine,
} from "recharts"
import {
  PontesCard, PontesIconButton, PontesSelect, PontesLoadingDots,
  usePontesTheme,
} from "@/components/pontes"
import { getRelatorio } from "../../services/relatorioService"
import type { RelatorioData } from "../../types/Relatorio"
import styles from "./ReportsPage.module.css"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatMoneyShort = (v: number) => {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return `R$${v.toFixed(0)}`
}

const PIE_COLORS = [
  "#0d9488", "#6366f1", "#f59e0b", "#e5484d", "#10b981",
  "#8b5cf6", "#00a2c7", "#ec4899", "#84cc16", "#f97316",
]

export default function ReportsPage() {
  // recharts precisa de cor hex real (não CSS var) em atributos SVG.
  // usePontesTheme dá acesso à palette ativa em tempo de render.
  const { palette } = usePontesTheme()
  const colorSuccess = "#16a34a"
  const colorDanger = "#dc2626"
  const colorPrimary = palette?.primary ?? "#1e40af"
  const colorBorder = "rgba(0,0,0,0.08)"
  const colorAxis = "rgba(0,0,0,0.55)"

  const [data, setData] = useState<RelatorioData | null>(null)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [activeSlice, setActiveSlice] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        setData(await getRelatorio(ano))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [ano])

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const anosOpts = anos.map((a) => ({ value: String(a), label: String(a) }))
  const evolucaoComDados = data?.evolucaoMensal.filter((m) => m.receitas > 0 || m.despesas > 0) ?? []

  const tooltipStyle = {
    borderRadius: 10,
    border: "1px solid var(--pontes-border)",
    background: "var(--pontes-surface)",
    fontSize: 13,
    boxShadow: "0 6px 20px -8px rgba(0,0,0,0.18)",
    color: "var(--pontes-text)",
  } as const

  const labelStyle = { fontWeight: 600, marginBottom: 4, color: "var(--pontes-text)" } as const

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Relatórios</h1>
          <p className={styles.subtitle}>Análise financeira detalhada</p>
        </div>
        <div className={styles.yearNav}>
          <PontesIconButton size={32} variant="outline" aria-label="Ano anterior" onClick={() => setAno((a) => a - 1)}>
            <ChevronLeft size={16} />
          </PontesIconButton>
          <div className={styles.yearSelect}>
            <PontesSelect value={String(ano)} onChange={(v) => setAno(Number(v))} options={anosOpts} />
          </div>
          <PontesIconButton size={32} variant="outline" aria-label="Próximo ano" onClick={() => setAno((a) => a + 1)}>
            <ChevronRight size={16} />
          </PontesIconButton>
        </div>
      </header>

      {loading && (
        <div className={styles.loading}><PontesLoadingDots /></div>
      )}

      {data && !loading && (
        <>
          {/* Evolução mensal — área */}
          <PontesCard padding={24} radius={14}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Evolução do saldo mensal</span>
              <span className={styles.cardSub}>Receitas, despesas e saldo acumulado</span>
            </div>
            {evolucaoComDados.length === 0 ? (
              <div className={styles.emptyChart}>Nenhuma transação em {ano}</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={evolucaoComDados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colorSuccess} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={colorSuccess} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colorDanger} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={colorDanger} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colorPrimary} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={colorPrimary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colorBorder} vertical={false} />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 12, fill: colorAxis }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 12, fill: colorAxis }} axisLine={false} tickLine={false} width={52} />
                  <RTooltip
                    // @ts-expect-error recharts formatter types are loose
                    formatter={(val: number, name: string) => [formatMoney(val), name]}
                    contentStyle={tooltipStyle}
                    labelStyle={labelStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12, color: "var(--pontes-text-muted)" }} />
                  <Area type="monotone" dataKey="receitas" name="Receitas"
                    stroke={colorSuccess} strokeWidth={2} fill="url(#gradReceitas)"
                    dot={{ r: 4, fill: colorSuccess, strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }} />
                  <Area type="monotone" dataKey="despesas" name="Despesas"
                    stroke={colorDanger} strokeWidth={2} fill="url(#gradDespesas)"
                    dot={{ r: 4, fill: colorDanger, strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }} />
                  <Area type="monotone" dataKey="saldo" name="Saldo"
                    stroke={colorPrimary} strokeWidth={2} strokeDasharray="5 3" fill="url(#gradSaldo)"
                    dot={{ r: 4, fill: colorPrimary, strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </PontesCard>

          {/* Receitas vs Despesas — barra */}
          <PontesCard padding={24} radius={14}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Receitas vs despesas por mês</span>
              <span className={styles.cardSub}>Comparativo mensal</span>
            </div>
            {evolucaoComDados.length === 0 ? (
              <div className={styles.emptyChart}>Nenhuma transação em {ano}</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={evolucaoComDados} barSize={20} barGap={6} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colorBorder} vertical={false} />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 12, fill: colorAxis }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 12, fill: colorAxis }} axisLine={false} tickLine={false} width={52} />
                  <RTooltip
                    // @ts-expect-error recharts formatter types are loose
                    formatter={(val: number, name: string) => [formatMoney(val), name]}
                    contentStyle={tooltipStyle}
                    labelStyle={labelStyle}
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12, color: "var(--pontes-text-muted)" }} />
                  <ReferenceLine y={0} stroke={colorBorder} />
                  <Bar dataKey="receitas" name="Receitas" fill={colorSuccess} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill={colorDanger} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </PontesCard>

          {/* Distribuição de despesas (donut + lista) */}
          <PontesCard padding={24} radius={14}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Distribuição de despesas</span>
            </div>
            {data.gastosPorCategoria.length === 0 ? (
              <div className={styles.emptyChart}>Nenhuma despesa em {ano}</div>
            ) : (
              <div className={styles.distGrid}>
                <div className={styles.donutWrap}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.gastosPorCategoria}
                        dataKey="valor" nameKey="descricao"
                        cx="50%" cy="50%"
                        innerRadius={62} outerRadius={90}
                        paddingAngle={2}
                        onMouseEnter={(_, index) => setActiveSlice(index)}
                        onMouseLeave={() => setActiveSlice(null)}
                      >
                        {data.gastosPorCategoria.map((_, index) => (
                          <Cell key={index}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                            opacity={activeSlice === null || activeSlice === index ? 1 : 0.35}
                            stroke="none" />
                        ))}
                      </Pie>
                      <RTooltip
                        // @ts-expect-error recharts formatter types are loose
                        formatter={(val: number, name: string) => [formatMoney(val), name]}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.donutCenter}>
                    {activeSlice !== null ? (
                      <>
                        <div className={styles.donutPct} style={{ color: PIE_COLORS[activeSlice % PIE_COLORS.length] }}>
                          {data.gastosPorCategoria[activeSlice].percentual}%
                        </div>
                        <div className={styles.donutLabel}>{data.gastosPorCategoria[activeSlice].descricao}</div>
                      </>
                    ) : (
                      <>
                        <div className={styles.donutTotalLabel}>Total</div>
                        <div className={styles.donutTotalValue}>
                          {formatMoney(data.gastosPorCategoria.reduce((s, c) => s + c.valor, 0))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.catList}>
                  {data.gastosPorCategoria.map((cat, index) => {
                    const color = PIE_COLORS[index % PIE_COLORS.length]
                    const isActive = activeSlice === index
                    return (
                      <div
                        key={cat.descricao}
                        className={styles.catItem}
                        data-active={isActive ? "true" : undefined}
                        title={formatMoney(cat.valor)}
                        onMouseEnter={() => setActiveSlice(index)}
                        onMouseLeave={() => setActiveSlice(null)}
                      >
                        <div className={styles.catRow}>
                          <div className={styles.catLeft}>
                            <span className={styles.catDot} style={{ background: color }} />
                            <span className={styles.catName} data-bold={isActive ? "true" : undefined}>{cat.descricao}</span>
                          </div>
                          <div className={styles.catRight}>
                            <span className={styles.catPct}>{cat.percentual}%</span>
                            <span className={styles.catValue}>{formatMoney(cat.valor)}</span>
                          </div>
                        </div>
                        <div className={styles.catBar}>
                          <div className={styles.catBarFill} style={{ width: `${cat.percentual}%`, background: color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </PontesCard>
        </>
      )}
    </div>
  )
}
