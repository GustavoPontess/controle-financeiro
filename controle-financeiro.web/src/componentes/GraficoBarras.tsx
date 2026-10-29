// Mês a mês do v2 (sem lib, no molde do GraficoLinha): duas colunas por mês (entrou × saiu), 3 linhas de grade com
// valor curto, o que sobrou embaixo de cada mês (cor pela direção), o mês escolhido em destaque e a dica com os três
// valores ao passar o mouse ou tocar. Tocar num mês leva pra ele. No celular mostra os últimos 6 (com "ver 12"). Mede a
// largura real do bloco pra não esticar o desenho. Lista equivalente pra leitor de tela.
import { useLayoutEffect, useRef, useState } from "react"
import { useHideBalance } from "../estado/ocultar"
import { MONEY_MASK, formatMoney } from "../utils/money"
import Botao from "./Botao"
import { curto } from "./GraficoLinha"
import styles from "./GraficoBarras.module.css"

export type MesDoGrafico = { ano: number; mes: number; entrou: number; saiu: number; sobrou: number }

const CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const ALTURA = 210, TOPO = 10, BASE = 46, ESQ = 4, DIR = 40
/** Abaixo desta largura (celular), só os últimos 6 meses até a pessoa pedir os 12. */
const ESTREITO = 520

export const rotuloDoMes = (m: { ano: number; mes: number }) => `${CURTOS[m.mes - 1]}/${String(m.ano).slice(2)}`

export default function GraficoBarras({ meses, escolhido, aoEscolher }: {
  meses: MesDoGrafico[]
  /** O mês em destaque (o da tela). */
  escolhido?: { ano: number; mes: number }
  aoEscolher?: (m: { ano: number; mes: number }) => void
}) {
  const caixa = useRef<HTMLDivElement | null>(null)
  const [largura, setLargura] = useState(0)
  const [ativo, setAtivo] = useState<number | null>(null)
  const [todos, setTodos] = useState(false)
  const [oculto] = useHideBalance()

  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => setLargura(el.clientWidth)
    medir()
    if (typeof ResizeObserver === "undefined") return // ambiente sem (testes): mede uma vez
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const estreito = largura > 0 && largura < ESTREITO
  const visiveis = estreito && !todos ? meses.slice(-6) : meses
  const W = Math.max(largura, 10)
  const max = Math.max(1, ...visiveis.map((m) => Math.max(m.entrou, m.saiu)))
  // Com poucos meses a coluna não estica a tela toda (as barras ficariam longe umas das outras).
  const coluna = Math.min(110, (W - ESQ - DIR) / Math.max(visiveis.length, 1))
  const barra = Math.max(4, Math.min(16, coluna * 0.26))
  const y = (v: number) => TOPO + (ALTURA - TOPO - BASE) * (1 - v / max)
  const chao = y(0)
  const grade = [max, max / 2]
  const ehEscolhido = (m: MesDoGrafico) => !!escolhido && m.ano === escolhido.ano && m.mes === escolhido.mes
  const sel = ativo ?? visiveis.findIndex(ehEscolhido)
  const dinheiro = (v: number) => (oculto ? MONEY_MASK : formatMoney(v))

  return (
    <div ref={caixa} className={styles.caixa}>
      <div className={styles.legenda}>
        <span><i data-tipo="entrou" aria-hidden="true" />Entrou</span>
        <span><i data-tipo="saiu" aria-hidden="true" />Saiu</span>
        {sel >= 0 && visiveis[sel] && (
          <span className={styles.dica} aria-hidden="true">
            <b>{rotuloDoMes(visiveis[sel])}</b> entrou {dinheiro(visiveis[sel].entrou)} · saiu {dinheiro(visiveis[sel].saiu)} · sobrou {dinheiro(visiveis[sel].sobrou)}
          </span>
        )}
      </div>
      {largura > 0 && (
        <svg className={styles.svg} width={W} height={ALTURA} viewBox={`0 0 ${W} ${ALTURA}`} role="img" aria-label="Entrou e saiu por mês"
          onPointerLeave={() => setAtivo(null)}>
          {grade.map((v, i) => (
            <g key={i} className={styles.grade}>
              <line x1={ESQ} x2={W - DIR} y1={y(v)} y2={y(v)} />
              <text x={W - 2} y={y(v) + 4} textAnchor="end">{curto(v, oculto)}</text>
            </g>
          ))}
          <line className={styles.chao} x1={ESQ} x2={W - DIR} y1={chao} y2={chao} />
          {visiveis.map((m, i) => {
            const cx = ESQ + coluna * i + coluna / 2
            const destaque = i === sel
            return (
              <g key={`${m.ano}-${m.mes}`} className={styles.mes} data-sel={destaque || undefined}
                onPointerEnter={() => setAtivo(i)} onClick={() => aoEscolher?.(m)} style={{ cursor: aoEscolher ? "pointer" : undefined }}>
                {/* Alvo de toque: a coluna inteira (bem maior que as barras). */}
                <rect className={styles.alvo} x={cx - coluna / 2} y={TOPO} width={coluna} height={ALTURA - TOPO} rx={10} />
                <rect className={styles.barra} data-tipo="entrou" x={cx - barra - 1} y={y(m.entrou)} width={barra} height={Math.max(0, chao - y(m.entrou))} rx={4} />
                <rect className={styles.barra} data-tipo="saiu" x={cx + 1} y={y(m.saiu)} width={barra} height={Math.max(0, chao - y(m.saiu))} rx={4} />
                <text className={styles.rotulo} x={cx} y={ALTURA - 26} textAnchor="middle">{rotuloDoMes(m)}</text>
                <text className={styles.sobrou} x={cx} y={ALTURA - 8} textAnchor="middle" data-tom={m.sobrou < 0 ? "negativo" : "positivo"}>
                  {m.sobrou < 0 && !oculto ? "−" : ""}{curto(Math.abs(m.sobrou), oculto)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      {estreito && meses.length > 6 && (
        <Botao variante="texto" onClick={() => setTodos((t) => !t)}>{todos ? "Ver os últimos 6" : `Ver ${meses.length}`}</Botao>
      )}
      <ul className={styles.leitor}>
        {meses.map((m) => <li key={`${m.ano}-${m.mes}`}>{rotuloDoMes(m)}: entrou {dinheiro(m.entrou)}, saiu {dinheiro(m.saiu)}, sobrou {dinheiro(m.sobrou)}</li>)}
      </ul>
    </div>
  )
}
