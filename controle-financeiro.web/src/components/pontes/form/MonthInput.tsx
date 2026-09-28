/**
 * PontesMonthInput — campo de MÊS estilo Pontes: mesmo trigger do PontesDateInput e popover com a
 * grade dos 12 meses + navegação de ano. Substitui `<input type="month">`, cujo seletor é o nativo
 * do navegador (visual diferente em cada browser/SO e fora do Design System).
 *
 * Valor "YYYY-MM" (mesma API do nativo); `min`/`max` também "YYYY-MM" — mês fora da faixa aparece
 * desabilitado. Teclado: setas andam entre meses (↑↓ pulam uma linha), PageUp/PageDown trocam o
 * ano, Home/End vão ao início/fim do ano, Enter/Espaço escolhem, Esc fecha e devolve o foco.
 */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { scopedThemeVars, type Palette } from "../theme"
import { useAnchoredPopover } from "./useAnchoredPopover"
import triggerStyles from "./DateInput.module.css"
import styles from "./MonthInput.module.css"

export type PontesMonthInputProps = {
  p?: Palette
  font?: string
  /** Valor "YYYY-MM". String vazia = sem mês. */
  value: string
  /** Recebe "YYYY-MM". */
  onChange: (v: string) => void
  /** Mínimo "YYYY-MM" (inclusive). */
  min?: string
  /** Máximo "YYYY-MM" (inclusive). */
  max?: string
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}

const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
const COLUNAS = 3

// Mês como índice absoluto (ano*12 + mês0): comparar/somar meses vira aritmética simples.
const paraIndice = (ym: string | undefined): number | null => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? "")
  if (!m) return null
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return null
  return Number(m[1]) * 12 + (mes - 1)
}
const paraYm = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`

/** "Outubro de 2026" — mesmo formato do rótulo das faturas na tela Cartões. */
const rotulo = (i: number) => {
  const s = new Date(Date.UTC(Math.floor(i / 12), i % 12, 1))
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const POPOVER_WIDTH = 280
const POPOVER_HEIGHT = 260

export function PontesMonthInput({
  p, font, value, onChange, min, max, invalid, disabled, placeholder, autoFocus,
}: PontesMonthInputProps) {
  const { open, setOpen, pos, wrapRef, triggerRef, popoverRef } = useAnchoredPopover(POPOVER_WIDTH, POPOVER_HEIGHT)
  const selecionado = paraIndice(value)
  const minI = paraIndice(min)
  const maxI = paraIndice(max)
  const hoje = new Date()
  const mesDeHoje = hoje.getFullYear() * 12 + hoje.getMonth()

  const limitar = (i: number) => {
    if (minI != null && i < minI) return minI
    if (maxI != null && i > maxI) return maxI
    return i
  }
  const foraDaFaixa = (i: number) => (minI != null && i < minI) || (maxI != null && i > maxI)

  // Mês com foco na grade (roving tabindex). O ano exibido é o dele.
  const [focado, setFocado] = useState(() => limitar(selecionado ?? mesDeHoje))
  // Só puxa o foco pra grade ao abrir e ao navegar pelo teclado — clicar em ‹ › mantém o foco no botão.
  const focarNaGrade = useRef(false)
  const ano = Math.floor(focado / 12)

  // Depende de `pos`: na 1ª abertura o portal só monta depois que a posição é calculada, então o
  // pedido de foco espera o botão existir em vez de se perder.
  useEffect(() => {
    if (!open || !focarNaGrade.current) return
    const botao = popoverRef.current?.querySelector<HTMLButtonElement>(`[data-idx="${focado}"]`)
    if (!botao) return
    focarNaGrade.current = false
    botao.focus()
  }, [open, focado, pos, popoverRef])

  const abrir = () => {
    if (disabled) return
    if (open) { setOpen(false); return }
    setFocado(limitar(selecionado ?? mesDeHoje))
    focarNaGrade.current = true
    setOpen(true)
  }

  const fechar = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const escolher = (i: number) => {
    // Respeita min/max mesmo se chegar aqui por teclado (o botão fora da faixa já é disabled).
    if (foraDaFaixa(i)) return
    onChange(paraYm(i))
    fechar()
  }

  const trocarAno = (delta: number) => setFocado((f) => limitar(f + delta * 12))
  const anoAnteriorBloqueado = minI != null && ano * 12 - 1 < minI
  const proximoAnoBloqueado = maxI != null && (ano + 1) * 12 > maxI

  // Esc é tratado no useAnchoredPopover (fecha só o popover, não o modal, e devolve o foco ao campo).
  const onGradeKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const passos: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLUNAS, ArrowDown: COLUNAS, PageUp: -12, PageDown: 12,
    }
    let alvo: number | null = null
    if (e.key in passos) alvo = focado + passos[e.key]
    else if (e.key === "Home") alvo = ano * 12
    else if (e.key === "End") alvo = ano * 12 + 11
    if (alvo == null) return
    e.preventDefault()
    focarNaGrade.current = true
    setFocado(limitar(alvo))
  }

  return (
    <div
      ref={wrapRef}
      className={triggerStyles.wrap}
      style={scopedThemeVars(p, font) as CSSProperties}
      data-invalid={invalid ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        className={triggerStyles.trigger}
        onClick={abrir}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar size={14} className={triggerStyles.icon} />
        <span className={triggerStyles.value} data-empty={selecionado != null ? undefined : "true"}>
          {selecionado != null ? rotulo(selecionado) : (placeholder ?? "Selecione")}
        </span>
      </button>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className={triggerStyles.popover}
          role="dialog"
          aria-label="Escolher mês"
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, ...scopedThemeVars(p, font) } as CSSProperties}
        >
          <div className={styles.panel}>
            <div className={styles.head}>
              <button
                type="button" className={styles.nav} aria-label="Ano anterior"
                disabled={anoAnteriorBloqueado} onClick={() => trocarAno(-1)}
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <div className={styles.title} aria-live="polite">{ano}</div>
              <button
                type="button" className={styles.nav} aria-label="Próximo ano"
                disabled={proximoAnoBloqueado} onClick={() => trocarAno(1)}
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
            <div className={styles.grid} onKeyDown={onGradeKeyDown}>
              {MES_CURTO.map((nome, m) => {
                const i = ano * 12 + m
                return (
                  <button
                    key={i}
                    type="button"
                    className={styles.month}
                    data-idx={i}
                    tabIndex={i === focado ? 0 : -1}
                    disabled={foraDaFaixa(i)}
                    aria-label={rotulo(i)}
                    aria-pressed={i === selecionado}
                    aria-current={i === mesDeHoje ? "date" : undefined}
                    data-selected={i === selecionado ? "true" : undefined}
                    data-current={i === mesDeHoje ? "true" : undefined}
                    onClick={() => escolher(i)}
                  >
                    {nome}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
