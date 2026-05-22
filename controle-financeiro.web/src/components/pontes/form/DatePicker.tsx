/**
 * DatePicker — mini calendar inline (não popover, ainda).
 * Suporta marcação de "hoje", data selecionada e dias com evento.
 */

import { useState } from "react"
import type { Palette } from "../theme"

const MES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
const DIA_PT = ["D", "S", "T", "Q", "Q", "S", "S"]

export type PontesDatePickerProps = {
  p: Palette
  font: string
  /** Data selecionada (UTC midnight ou Date local — usa só day/month/year). */
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

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) } else { setMonth(month - 1) }
  }
  const next = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) } else { setMonth(month + 1) }
  }

  const isSameDay = (a: Date | null, y: number, m: number, d: number) =>
    a && a.getFullYear() === y && a.getMonth() === m && a.getDate() === d

  const hasEvent = (d: number) =>
    events.some((ev) => isSameDay(ev, year, month, d))

  return (
    <div style={{
      background: p.surface, border: `1px solid ${p.border}`,
      borderRadius: 14, padding: 18, maxWidth: 320, fontFamily: font,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button type="button" onClick={prev}
          style={{ background: "transparent", border: "none", color: p.text, fontSize: 16, cursor: "pointer", padding: 4 }}>‹</button>
        <div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>{MES_PT[month]} {year}</div>
        <button type="button" onClick={next}
          style={{ background: "transparent", border: "none", color: p.text, fontSize: 16, cursor: "pointer", padding: 4 }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {DIA_PT.map((d, i) => (
          <div key={i} style={{ fontSize: 11, color: p.textMuted, fontWeight: 700, textAlign: "center", padding: 4 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          if (d == null) return <span key={i} />
          const isToday = isSameDay(today, year, month, d)
          const isSelected = isSameDay(value, year, month, d)
          const evt = hasEvent(d)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(new Date(year, month, d))}
              style={{
                aspectRatio: "1", border: "none", cursor: "pointer",
                background: isToday ? p.primary : isSelected ? p.primarySoft : "transparent",
                color: isToday ? p.heroFg : isSelected ? p.primary : p.text,
                borderRadius: 8, fontSize: 12,
                fontWeight: isToday || isSelected ? 700 : 500, fontFamily: font,
                position: "relative",
              }}
            >
              {d}
              {evt && <span style={{
                position: "absolute", bottom: 4, left: "50%",
                transform: "translateX(-50%)",
                width: 4, height: 4, borderRadius: "50%", background: p.accent,
              }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
