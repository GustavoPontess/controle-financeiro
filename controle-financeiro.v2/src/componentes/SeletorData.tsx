// Seletor de data do v2 (no lugar do <input type="date">, cujo calendário é do sistema e não segue o
// visual nem o tema): gatilho com a moldura dos campos e calendário próprio (domingo primeiro).
// Teclado: setas andam o dia, PageUp/PageDown o mês (com Shift, o ano), Home/End a semana, Enter
// escolhe, Esc fecha. Respeita min/max (dia fora fica apagado e não escolhe). Valor sempre "YYYY-MM-DD"
// (data pura, sem fuso). Dentro de um Campo, herda id e erro.
import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { useCampo } from "./campoContexto"
import Botao from "./Botao"
import { dataLocalISO, somaDias } from "../utils/dateTime"
import g from "./gatilho.module.css"
import styles from "./SeletorData.module.css"

const LARGURA = 296
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"]
const NOMES_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
const fmtDiaLongo = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

/** "YYYY-MM-DD" → Date local ao meio-dia (meio-dia: mudança de horário nunca empurra pro dia vizinho). */
const deISO = (iso: string) => { const [a, m, d] = iso.split("-").map(Number); return new Date(a, m - 1, d, 12) }
const somaMeses = (iso: string, n: number) => {
  const d = deISO(iso)
  const dia = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(dia, ultimo))
  return dataLocalISO(d)
}
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** "YYYY-MM-DD" → "dd/mm/aaaa" lendo o texto (sem fuso). */
export const formatarData = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

export default function SeletorData({ valor, onChange, min, max, placeholder = "dd/mm/aaaa", limpavel, invalido, desabilitado, tamanho = "md", ariaLabel, id }: {
  /** "YYYY-MM-DD" ou "" (vazio). */
  valor: string
  onChange: (valor: string) => void
  min?: string
  max?: string
  placeholder?: string
  /** Mostra "Limpar" no calendário (data opcional). */
  limpavel?: boolean
  invalido?: boolean
  desabilitado?: boolean
  /** md = 44px (formulário) · sm = 40px (painel de filtros) */
  tamanho?: "md" | "sm"
  ariaLabel?: string
  id?: string
}) {
  const campo = useCampo()
  const idGatilho = id ?? campo?.id
  const inv = invalido ?? campo?.invalido ?? false
  const [aberto, setAberto] = useState(false)
  const [foco, setFoco] = useState(() => valor || dataLocalISO())
  const [paraCima, setParaCima] = useState(false)
  const [aDireita, setADireita] = useState(false)
  const raiz = useRef<HTMLDivElement | null>(null)
  const gatilho = useRef<HTMLButtonElement | null>(null)
  const grade = useRef<HTMLTableElement | null>(null)
  const idMes = useId()
  const hoje = dataLocalISO()

  const foraDoLimite = (iso: string) => (!!min && iso < min) || (!!max && iso > max)
  const prender = (iso: string) => (min && iso < min ? min : max && iso > max ? max : iso)

  const abrir = () => { if (desabilitado) return; setFoco(prender(valor || hoje)); setAberto(true) }
  const fechar = (devolverFoco = true) => { setAberto(false); if (devolverFoco) gatilho.current?.focus() }
  const escolher = (iso: string) => { if (foraDoLimite(iso)) return; onChange(iso); fechar() }

  // Ao abrir: cabe embaixo? cabe à direita do gatilho?
  useLayoutEffect(() => {
    if (!aberto) return
    const r = gatilho.current?.getBoundingClientRect()
    if (!r) return
    const abaixo = window.innerHeight - r.bottom
    setParaCima(abaixo < 360 && r.top > abaixo)
    setADireita(r.left + LARGURA > window.innerWidth - 8)
  }, [aberto])

  // Foco no dia ativo (ao abrir, nas setas, ao trocar de mês).
  useEffect(() => {
    if (!aberto) return
    grade.current?.querySelector<HTMLButtonElement>(`[data-iso="${foco}"]`)?.focus()
  }, [aberto, foco])

  // Fecha no clique fora.
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false) }
    document.addEventListener("mousedown", fora)
    return () => document.removeEventListener("mousedown", fora)
  }, [aberto])

  const teclaNaGrade = (e: KeyboardEvent) => {
    let novo: string
    switch (e.key) {
      case "ArrowLeft": novo = somaDias(foco, -1); break
      case "ArrowRight": novo = somaDias(foco, 1); break
      case "ArrowUp": novo = somaDias(foco, -7); break
      case "ArrowDown": novo = somaDias(foco, 7); break
      case "Home": novo = somaDias(foco, -deISO(foco).getDay()); break
      case "End": novo = somaDias(foco, 6 - deISO(foco).getDay()); break
      case "PageUp": novo = somaMeses(foco, e.shiftKey ? -12 : -1); break
      case "PageDown": novo = somaMeses(foco, e.shiftKey ? 12 : 1); break
      case "Enter": case " ": e.preventDefault(); escolher(foco); return
      default: return
    }
    e.preventDefault()
    setFoco(prender(novo))
  }

  // Grade de 6 semanas fixas (a altura não pula de um mês pro outro).
  const mesAtual = foco.slice(0, 7)
  const primeiro = deISO(`${mesAtual}-01`)
  const inicio = somaDias(`${mesAtual}-01`, -primeiro.getDay())
  const semanas = Array.from({ length: 6 }, (_, s) => Array.from({ length: 7 }, (_, d) => somaDias(inicio, s * 7 + d)))
  const semAnterior = !!min && mesAtual <= min.slice(0, 7)
  const semProximo = !!max && mesAtual >= max.slice(0, 7)
  const mostraHoje = !foraDoLimite(hoje)
  const mostraLimpar = !!limpavel && !!valor

  // Tab pra fora fecha. Foco sem destino (botão de mês que desabilita no clique) não fecha — o clique
  // fora já é tratado no mousedown.
  const aoSairFoco = (e: FocusEvent) => {
    if (aberto && e.relatedTarget && !raiz.current?.contains(e.relatedTarget as Node)) setAberto(false)
  }

  return (
    <div className={styles.raiz} ref={raiz} onBlur={aoSairFoco}>
      <button ref={gatilho} id={idGatilho} type="button" className={g.gatilho} data-tamanho={tamanho}
        aria-haspopup="dialog" aria-expanded={aberto} aria-label={ariaLabel} aria-invalid={inv || undefined}
        aria-describedby={inv && campo ? campo.erroId : undefined}
        data-invalido={inv ? "true" : undefined} data-vazio={valor ? undefined : "true"} disabled={desabilitado}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); abrir() } }}>
        <span className={g.texto}>{valor ? formatarData(valor) : placeholder}</span>
        <CalendarDays size={16} strokeWidth={2.25} aria-hidden="true" className={g.icone} />
      </button>

      {aberto && (
        <div className={`${g.painel} ${styles.painel}`} role="dialog" aria-labelledby={idMes}
          data-cima={paraCima ? "true" : undefined} data-direita={aDireita ? "true" : undefined}
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar() } }}>
          <div className={styles.topo}>
            <Botao variante="texto" soIcone aria-label="Mês anterior" disabled={semAnterior}
              onClick={() => setFoco(prender(somaMeses(foco, -1)))} icone={<ChevronLeft size={16} strokeWidth={2.25} />} />
            <span id={idMes} className={styles.mes} aria-live="polite">{maiuscula(fmtMes.format(primeiro))}</span>
            <Botao variante="texto" soIcone aria-label="Próximo mês" disabled={semProximo}
              onClick={() => setFoco(prender(somaMeses(foco, 1)))} icone={<ChevronRight size={16} strokeWidth={2.25} />} />
          </div>
          <table ref={grade} role="grid" aria-labelledby={idMes} className={styles.grade} onKeyDown={teclaNaGrade}>
            <thead>
              <tr>{SEMANA.map((d, i) => <th key={i} scope="col" abbr={NOMES_SEMANA[i]}>{d}</th>)}</tr>
            </thead>
            <tbody>
              {semanas.map((semana) => (
                <tr key={semana[0]}>
                  {semana.map((iso) => {
                    const fora = foraDoLimite(iso)
                    return (
                      <td key={iso} aria-selected={iso === valor || undefined}>
                        <button type="button" className={styles.dia} data-iso={iso} tabIndex={iso === foco ? 0 : -1}
                          data-outro-mes={iso.slice(0, 7) !== mesAtual || undefined} data-hoje={iso === hoje || undefined}
                          data-escolhido={iso === valor || undefined} aria-disabled={fora || undefined}
                          aria-label={maiuscula(fmtDiaLongo.format(deISO(iso)))}
                          onClick={() => escolher(iso)}>
                          {Number(iso.slice(8, 10))}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {(mostraHoje || mostraLimpar) && (
            <div className={styles.rodape}>
              {mostraLimpar ? <Botao variante="texto" onClick={() => { onChange(""); fechar() }}>Limpar</Botao> : <span />}
              {mostraHoje && <Botao variante="texto" onClick={() => escolher(hoje)}>Hoje</Botao>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
