import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
  ResponsiveContainer, AreaChart, Area, ReferenceLine,
} from "recharts"
import {
  PontesCard, PontesIconButton, PontesSelect, PontesLoadingDots,
  PontesCategoryDonut, PontesStatCard, usePontesTheme,
} from "@/components/pontes"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"
import { getRelatorio } from "../../services/relatorioService"
import type { RelatorioData } from "../../types/Relatorio"
import styles from "./ReportsPage.module.css"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatMoneyShort = (v: number) => {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return `R$${v.toFixed(0)}`
}

// Tooltip rico compartilhado pelos gráficos — card com ponto colorido, nome e
// valor formatado por série (substitui o tooltip cru do recharts).
type TooltipPayload = { name: string; value: number; color?: string; stroke?: string; fill?: string }
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color ?? p.stroke ?? p.fill }} />
          <span className={styles.tooltipName}>{p.name}</span>
          <span className={styles.tooltipValue}>{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

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

  // KPIs do ano (somatório) + média mensal de despesa.
  const totalReceitas = evolucaoComDados.reduce((s, m) => s + m.receitas, 0)
  const totalDespesas = evolucaoComDados.reduce((s, m) => s + m.despesas, 0)
  const saldoAno = totalReceitas - totalDespesas
  const mediaDespesa = evolucaoComDados.length ? totalDespesas / evolucaoComDados.length : 0

  // Comparação último mês com dados vs o anterior — variação % por dimensão.
  const ultimo = evolucaoComDados[evolucaoComDados.length - 1]
  const penultimo = evolucaoComDados[evolucaoComDados.length - 2]
  const variacao = (atual: number, ant: number): number | null =>
    ant > 0 ? ((atual - ant) / ant) * 100 : null
  const fmtPct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`)


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
          {/* KPIs do ano */}
          <div className={styles.kpiGrid}>
            <PontesStatCard label={`Receitas em ${ano}`} value={formatMoney(totalReceitas)} tone="success" />
            <PontesStatCard label={`Despesas em ${ano}`} value={formatMoney(totalDespesas)} tone="danger" />
            <PontesStatCard label="Saldo do ano" value={formatMoney(saldoAno)} tone={saldoAno < 0 ? "danger" : "default"} />
            <PontesStatCard label="Média de gastos/mês" value={formatMoney(mediaDespesa)} hint={`${evolucaoComDados.length} ${evolucaoComDados.length === 1 ? "mês" : "meses"} com lançamentos`} />
          </div>

          {/* Comparação com o mês anterior */}
          {ultimo && penultimo && (
            <PontesCard padding={24} radius={14}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>{ultimo.mesLabel} vs {penultimo.mesLabel}</span>
                <span className={styles.cardSub}>Variação em relação ao mês anterior</span>
              </div>
              <div className={styles.compareGrid}>
                {([
                  { label: "Receitas", atual: ultimo.receitas, ant: penultimo.receitas, bom: "up" as const },
                  { label: "Despesas", atual: ultimo.despesas, ant: penultimo.despesas, bom: "down" as const },
                  { label: "Saldo", atual: ultimo.saldo, ant: penultimo.saldo, bom: "up" as const },
                ]).map((row) => {
                  const v = variacao(row.atual, row.ant)
                  const subiu = v !== null && v >= 0
                  // "bom" = direção desejada. Verde quando vai pro lado bom.
                  const positivo = v === null ? null : (row.bom === "up" ? subiu : !subiu)
                  const tone = positivo === null ? "muted" : positivo ? "good" : "bad"
                  return (
                    <div key={row.label} className={styles.compareItem}>
                      <span className={styles.compareLabel}>{row.label}</span>
                      <span className={styles.compareValue}>{formatMoney(row.atual)}</span>
                      <span className={styles.compareDelta} data-tone={tone}>
                        {v !== null && (subiu ? <ArrowUpRight size={14} strokeWidth={2.5} /> : <ArrowDownRight size={14} strokeWidth={2.5} />)}
                        {fmtPct(v)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </PontesCard>
          )}

          {/* Evolução mensal — área */}
          <PontesCard padding={24} radius={14}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Evolução do saldo mensal</span>
              <span className={styles.cardSub}>Receitas, despesas e saldo acumulado</span>
            </div>
            {evolucaoComDados.length === 0 ? (
              <div className={styles.emptyChart}>Nenhuma transação em {ano}</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={evolucaoComDados} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colorPrimary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={colorPrimary} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colorSuccess} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={colorSuccess} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colorDanger} stopOpacity={0.16} />
                      <stop offset="100%" stopColor={colorDanger} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke={colorBorder} vertical={false} />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 12, fill: colorAxis }} axisLine={false} tickLine={false} dy={4} />
                  <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 12, fill: colorAxis }} axisLine={false} tickLine={false} width={52} />
                  <RTooltip content={<ChartTooltip />} cursor={{ stroke: colorBorder, strokeWidth: 1 }} />
                  <Legend wrapperStyle={{ fontSize: 13, paddingTop: 16, color: "var(--pontes-text-muted)" }} iconType="circle" iconSize={9} />
                  {/* Saldo é o protagonista: área cheia + linha grossa. Receitas e
                      despesas viram linhas-contexto finas, sem competir. */}
                  <Area type="monotone" dataKey="saldo" name="Saldo"
                    stroke={colorPrimary} strokeWidth={3} fill="url(#gradSaldo)"
                    dot={false} activeDot={{ r: 6, strokeWidth: 3, stroke: "var(--pontes-surface)", fill: colorPrimary }} />
                  <Area type="monotone" dataKey="receitas" name="Receitas"
                    stroke={colorSuccess} strokeWidth={2} fill="url(#gradReceitas)"
                    dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--pontes-surface)", fill: colorSuccess }} />
                  <Area type="monotone" dataKey="despesas" name="Despesas"
                    stroke={colorDanger} strokeWidth={2} fill="url(#gradDespesas)"
                    dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--pontes-surface)", fill: colorDanger }} />
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
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={evolucaoComDados} barSize={26} barGap={6} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colorSuccess} stopOpacity={1} />
                      <stop offset="100%" stopColor={colorSuccess} stopOpacity={0.55} />
                    </linearGradient>
                    <linearGradient id="barDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colorDanger} stopOpacity={1} />
                      <stop offset="100%" stopColor={colorDanger} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke={colorBorder} vertical={false} />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 12, fill: colorAxis }} axisLine={false} tickLine={false} dy={4} />
                  <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 12, fill: colorAxis }} axisLine={false} tickLine={false} width={52} />
                  <RTooltip content={<ChartTooltip />} cursor={{ fill: "color-mix(in srgb, var(--pontes-primary) 6%, transparent)", radius: 6 }} />
                  <Legend wrapperStyle={{ fontSize: 13, paddingTop: 16, color: "var(--pontes-text-muted)" }} iconType="circle" iconSize={9} />
                  <ReferenceLine y={0} stroke={colorBorder} />
                  <Bar dataKey="receitas" name="Receitas" fill="url(#barReceitas)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="url(#barDespesas)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </PontesCard>

          {/* Distribuição de despesas — donut + lista (componente da biblioteca) */}
          <PontesCard padding={24} radius={14}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Distribuição de despesas</span>
            </div>
            <PontesCategoryDonut
              data={data.gastosPorCategoria.map((c) => ({ label: c.descricao, valor: c.valor, percentual: c.percentual }))}
              formatMoney={formatMoney}
              emptyLabel={`Nenhuma despesa em ${ano}`}
            />
          </PontesCard>
        </>
      )}
    </div>
  )
}
