/**
 * PontesCategoryDonut — donut de distribuição por categoria + lista lateral.
 * Donut (recharts) com centro que mostra o total (ou a fatia em foco) e uma
 * lista com cor, nome, %, valor e barra. Hover sincroniza donut ↔ lista.
 *
 * Genérico: recebe itens {label, valor, percentual} já calculados. Usado em
 * Relatórios e no Dashboard (mesma visualização, fonte única).
 */
import { useState, type CSSProperties } from "react"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip } from "recharts"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./CategoryDonut.module.css"

export type PontesCategoryDonutItem = {
  label: string
  valor: number
  percentual: number
}

// Paleta de fatias — cores fixas de dado (não seguem a paleta do tema, pra
// manter as categorias distinguíveis em qualquer tema). Interna: quem não passa
// `colors` herda essas, garantindo a MESMA visualização em Relatórios e Dashboard.
const DONUT_COLORS = [
  "#0d9488", "#6366f1", "#f59e0b", "#e5484d", "#10b981",
  "#8b5cf6", "#00a2c7", "#ec4899", "#84cc16", "#f97316",
]

export type PontesCategoryDonutProps = {
  p?: Palette
  font?: string
  data: PontesCategoryDonutItem[]
  /** Formata moeda (ex.: Intl pt-BR BRL). */
  formatMoney: (v: number) => string
  /** Rótulo do total no centro (default "Total"). */
  totalLabel?: string
  /** Altura do donut em px (default 220). */
  height?: number
  colors?: string[]
  emptyLabel?: string
}

export function PontesCategoryDonut({
  p, font, data, formatMoney, totalLabel = "Total", height = 220,
  colors = DONUT_COLORS, emptyLabel = "Sem dados no período",
}: PontesCategoryDonutProps) {
  const [active, setActive] = useState<number | null>(null)

  if (data.length === 0) {
    return <div className={styles.empty} style={scopedThemeVars(p, font) as CSSProperties}>{emptyLabel}</div>
  }

  const total = data.reduce((s, c) => s + c.valor, 0)
  const tooltipStyle = {
    background: "var(--pontes-surface)", border: "1px solid var(--pontes-border)",
    borderRadius: 10, fontSize: 13, color: "var(--pontes-text)",
    boxShadow: "0 6px 20px -8px rgba(0,0,0,0.18)",
  } as const

  return (
    <div className={styles.root} style={scopedThemeVars(p, font) as CSSProperties}>
    <div className={styles.grid}>
      <div className={styles.donutWrap}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data} dataKey="valor" nameKey="label"
              // Raio em % do espaço disponível: acompanha `height` e a largura da coluna sem cortar
              // (com 200×220 dá os mesmos ~62/90px de antes).
              cx="50%" cy="50%" innerRadius="65%" outerRadius="95%" paddingAngle={2}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]}
                  opacity={active === null || active === i ? 1 : 0.35} stroke="none" />
              ))}
            </Pie>
            <RTooltip
              // @ts-expect-error recharts formatter types are loose
              formatter={(val: number, name: string) => [formatMoney(val), name]}
              contentStyle={tooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.center}>
          {active !== null ? (
            <>
              <div className={styles.pct} style={{ color: colors[active % colors.length] }}>
                {data[active].percentual.toLocaleString("pt-BR")}%
              </div>
              <div className={styles.activeLabel}>{data[active].label}</div>
            </>
          ) : (
            <>
              <div className={styles.totalLabel}>{totalLabel}</div>
              <div className={styles.totalValue}>{formatMoney(total)}</div>
            </>
          )}
        </div>
      </div>

      <div className={styles.list}>
        {data.map((cat, i) => {
          const color = colors[i % colors.length]
          const isActive = active === i
          return (
            <div key={cat.label} className={styles.item} data-active={isActive ? "true" : undefined}
              title={formatMoney(cat.valor)}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
              <div className={styles.row}>
                <div className={styles.left}>
                  <span className={styles.dot} style={{ background: color }} />
                  <span className={styles.name} data-bold={isActive ? "true" : undefined} title={cat.label}>{cat.label}</span>
                </div>
                <div className={styles.right}>
                  <span className={styles.itemPct}>{cat.percentual.toLocaleString("pt-BR")}%</span>
                  <span className={styles.itemValue}>{formatMoney(cat.valor)}</span>
                </div>
              </div>
              <div className={styles.bar}>
                <div className={styles.barFill} style={{ width: `${cat.percentual}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
    </div>
  )
}
