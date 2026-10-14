/**
 * PontesGraficoLinha — gráfico de linha sem lib (portado da bancada v2): curva suave sem "sobressalto"
 * (monotônica), área com degradê, um ponto por mês, 3 linhas de grade com o valor curto (sem "R$") e
 * realce do mês sob o mouse, com o valor cheio numa dica. Mede a largura real da caixa pra não esticar
 * o desenho (traço e pontos ficam redondos em qualquer tamanho). Cor: `currentColor` — a caixa usa
 * var(--pontes-primary) (CSS), então a paleta escolhida vale aqui também.
 */

import { useId, useLayoutEffect, useRef, useState, type PointerEvent } from "react"
import { useHideBalance } from "./useHideBalance"
import { MONEY_MASK, formatMoney } from "@/utils/money"
import styles from "./GraficoLinha.module.css"

export type PontesPontoLinha = { rotulo: string; valor: number }

const ALTURA = 190, TOPO = 14, BASE = 30, ESQ = 8, DIR = 8
// Sem largura medida (jsdom, 1º paint) desenha com esta; o ResizeObserver corrige em seguida.
const LARGURA_PADRAO = 600

/** Dinheiro curto pra grade: 1.200 → "1,2 mil", 350 → "350". Em branco ("••") com o olho fechado. */
function curto(v: number, oculto: boolean) {
  if (oculto) return "••"
  const a = Math.abs(v)
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : a >= 1000 ? `${(a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
  return `${v < 0 ? "−" : ""}${s}`
}

/** Curva monotônica (Fritsch–Carlson): suave, mas nunca passa do valor real entre dois pontos. */
function caminhoSuave(p: { x: number; y: number }[]): string {
  const n = p.length
  if (n === 0) return ""
  if (n === 1) return `M${p[0].x} ${p[0].y}`
  const dx: number[] = [], m: number[] = []
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x; m[i] = (p[i + 1].y - p[i].y) / dx[i] }
  const t: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t[i] = 0
    else { const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1]; t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]) }
  }
  t[n - 1] = m[n - 2]
  let d = `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const c1x = p[i].x + dx[i] / 3, c1y = p[i].y + (t[i] * dx[i]) / 3
    const c2x = p[i + 1].x - dx[i] / 3, c2y = p[i + 1].y - (t[i + 1] * dx[i]) / 3
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p[i + 1].x.toFixed(1)} ${p[i + 1].y.toFixed(1)}`
  }
  return d
}

export type PontesGraficoLinhaProps = {
  pontos: PontesPontoLinha[]
  /** Texto quando há menos de 2 pontos. */
  vazio?: string
  /** Nome acessível do desenho. */
  rotulo?: string
}

export function PontesGraficoLinha({ pontos, vazio = "Ainda não há meses pra comparar.", rotulo = "Evolução por mês" }: PontesGraficoLinhaProps) {
  const caixa = useRef<HTMLDivElement | null>(null)
  const [largura, setLargura] = useState(0)
  const [ativo, setAtivo] = useState<number | null>(null)
  const [oculto] = useHideBalance()
  // id estável do degradê (um por instância); sem ":" porque vai dentro de url(#…).
  const id = `pgl-${useId().replace(/:/g, "")}`

  useLayoutEffect(() => {
    const el = caixa.current
    if (!el || typeof ResizeObserver === "undefined") return
    const medir = () => setLargura(el.clientWidth)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (pontos.length < 2) return <p className={styles.vazio}>{vazio}</p>

  const vals = pontos.map((p) => p.valor)
  const min = Math.min(0, ...vals)
  const max = Math.max(...vals)
  const folga = (max - min || 1) * 0.08
  const yMin = min === 0 ? 0 : min - folga
  const yMax = max + folga
  const W = Math.max(largura || LARGURA_PADRAO, 10)
  const x = (i: number) => ESQ + (i * (W - ESQ - DIR)) / (pontos.length - 1)
  const y = (v: number) => TOPO + (ALTURA - TOPO - BASE) * (1 - (v - yMin) / (yMax - yMin || 1))
  const pts = pontos.map((p, i) => ({ x: x(i), y: y(p.valor) }))
  const linha = caminhoSuave(pts)
  const area = `${linha} L${pts[pts.length - 1].x.toFixed(1)} ${(ALTURA - BASE).toFixed(1)} L${pts[0].x.toFixed(1)} ${(ALTURA - BASE).toFixed(1)} Z`
  const grade = [yMax, (yMax + yMin) / 2, yMin]
  const ult = pts.length - 1
  const sel = ativo ?? ult

  const aoMover = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    let melhor = 0
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].x - px) < Math.abs(pts[melhor].x - px)) melhor = i
    setAtivo(melhor)
  }

  return (
    <div ref={caixa} className={styles.caixa}>
      <div className={styles.dica} style={{ left: `${(pts[sel].x / W) * 100}%` }}
        data-fim={sel >= pts.length - 2 ? "true" : undefined} data-inicio={sel <= 1 ? "true" : undefined}>
        <span className={styles.dicaMes}>{pontos[sel].rotulo}</span>
        <span className={styles.dicaValor}>{oculto ? MONEY_MASK : formatMoney(pontos[sel].valor)}</span>
      </div>
      <svg className={styles.svg} width={W} height={ALTURA} viewBox={`0 0 ${W} ${ALTURA}`} role="img" aria-label={rotulo}
        onPointerMove={aoMover} onPointerLeave={() => setAtivo(null)}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        {grade.map((v, i) => (
          <g key={i} className={styles.grade}>
            <line x1={ESQ} x2={W - DIR} y1={y(v)} y2={y(v)} />
            <text x={W - DIR} y={y(v) - 4} textAnchor="end">{curto(v, oculto)}</text>
          </g>
        ))}
        {min < 0 && <line className={styles.zero} x1={ESQ} x2={W - DIR} y1={y(0)} y2={y(0)} />}
        <path d={area} fill={`url(#${id})`} />
        <path d={linha} className={styles.linha} />
        <line className={styles.guia} x1={pts[sel].x} x2={pts[sel].x} y1={TOPO} y2={ALTURA - BASE} />
        {pts.map((p, i) => (
          <circle key={i} className={styles.ponto} cx={p.x} cy={p.y} r={i === sel ? 5 : 3} data-sel={i === sel ? "true" : undefined} />
        ))}
        {pontos.map((p, i) => (
          <text key={`${p.rotulo}-${i}`} className={styles.mes} x={pts[i].x} y={ALTURA - 8}
            textAnchor={i === 0 ? "start" : i === ult ? "end" : "middle"} data-sel={i === sel ? "true" : undefined}>{p.rotulo}</text>
        ))}
      </svg>
    </div>
  )
}
