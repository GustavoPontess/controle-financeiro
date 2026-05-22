/**
 * DatePicker — mini calendário inline. Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122).
 */

import { useState, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./DatePicker.module.css"

const MES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
const DIA_PT = ["D", "S", "T", "Q", "Q", "S", "S"]

export type PontesDatePickerProps = {
  p?: Palette
  font?: string
  /** Data selecionada. */
  value: Date | null
  onChange: (d: Date) => void
  /** Datas com bolinha de evento. */
  events?: Date[]
}

export function PontesDatePicker({ p, font, value, onChange, events = [] }: PontesDatePickerProps) {
  const today = new Date()
  const initial = value ?? today
  const [year, setYear] = useState(initial.getFullYear())
  const [month, setMonth] = useState(initial.getMonth())

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prev = () => { if (month === 0) { setMonth(11); setYear(year - 1) } else setMonth(month - 1) }
  const next = () => { if (month === 11) { setMonth(0); setYear(year + 1) } else setMonth(month + 1) }

  const isSameDay = (a: Date | null, y: number, m: number, d: number) =>
    !!a && a.getFullYear() === y && a.getMonth() === m && a.getDate() === d
  const hasEvent = (d: number) => events.some((ev) => isSameDay(ev, year, month, d))

  return (
    <div className={styles.wrap} style={scopedThemeVars(p, font) as CSSProperties}>
      <div className={styles.head}>
        <button type="button" onClick={prev} className={styles.nav}>‹</button>
        <div className={styles.title}>{MES_PT[month]} {year}</div>
        <button type="button" onClick={next} className={styles.nav}>›</button>
      </div>
      <div className={styles.dows}>
        {DIA_PT.map((d, i) => <div key={i} className={styles.dow}>{d}</div>)}
      </div>
      <div className={styles.grid}>
        {cells.map((d, i) => {
          if (d == null) return <span key={i} />
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(new Date(year, month, d))}
              className={styles.day}
              data-today={isSameDay(today, year, month, d) ? "true" : undefined}
              data-selected={isSameDay(value, year, month, d) ? "true" : undefined}
            >
              {d}
              {hasEvent(d) && <span className={styles.dot} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
