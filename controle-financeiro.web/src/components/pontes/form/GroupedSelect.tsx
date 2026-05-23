/**
 * GroupedSelect — dropdown agrupado: grupo-cabeçalho (selecionável) + itens
 * indentados (selecionáveis). Genérico (ex: categoria → subcategoria).
 *
 * Não usa <select> nativo. O painel é in-flow (empurra o conteúdo, não absoluto)
 * com max-height + scroll — assim nunca vaza pra fora de um modal/popup.
 * Estilo via GroupedSelect.module.css + var(--pontes-*). `p`/`font` override opcional.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ChevronDown, Check } from "lucide-react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./GroupedSelect.module.css"

export type PontesGroupedItem<T extends string = string> = {
  value: T
  label: string
}

export type PontesGroupedOption<T extends string = string> = {
  value: T
  label: string
  items?: PontesGroupedItem<T>[]
}

export type PontesGroupedSelectProps<T extends string = string> = {
  p?: Palette
  font?: string
  groups: PontesGroupedOption<T>[]
  /** Valor do grupo selecionado ("" = nenhum). */
  groupValue: T | ""
  /** Valor do item selecionado ("" = só grupo, sem item). */
  itemValue: T | ""
  /** itemValue "" quando o usuário escolhe só o cabeçalho do grupo. */
  onChange: (groupValue: T, itemValue: T | "") => void
  placeholder?: string
  /** Texto quando não há grupos. */
  emptyLabel?: string
  invalid?: boolean
}

export function PontesGroupedSelect<T extends string = string>({
  p, font, groups, groupValue, itemValue, onChange,
  placeholder = "Selecione", emptyLabel = "Nenhuma opção", invalid,
}: PontesGroupedSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const selGroup = groups.find((g) => g.value === groupValue)
  const selItem = selGroup?.items?.find((i) => i.value === itemValue)
  const label = selItem ? `${selGroup?.label ?? ""} · ${selItem.label}` : selGroup?.label ?? ""

  const pick = (g: T, i: T | "") => { onChange(g, i); setOpen(false) }

  return (
    <div className={styles.wrap} ref={ref} style={scopedThemeVars(p, font) as CSSProperties}>
      <button
        type="button"
        className={styles.trigger}
        data-empty={!groupValue ? "true" : undefined}
        data-invalid={invalid ? "true" : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.triggerText}>{label || placeholder}</span>
        <span className={styles.chev} data-open={open ? "true" : undefined}><ChevronDown size={16} /></span>
      </button>

      {open && (
        <div className={styles.panel}>
          {groups.length === 0 ? (
            <div className={styles.empty}>{emptyLabel}</div>
          ) : (
            groups.map((g) => (
              <div key={g.value}>
                <button
                  type="button"
                  className={styles.groupRow}
                  data-active={groupValue === g.value && !itemValue ? "true" : undefined}
                  onClick={() => pick(g.value, "")}
                >
                  <span className={styles.label}>{g.label}</span>
                  {groupValue === g.value && !itemValue && (
                    <span className={styles.check}><Check size={14} strokeWidth={2.5} /></span>
                  )}
                </button>
                {(g.items ?? []).map((it) => (
                  <button
                    key={it.value}
                    type="button"
                    className={styles.itemRow}
                    data-active={itemValue === it.value ? "true" : undefined}
                    onClick={() => pick(g.value, it.value)}
                  >
                    <span className={styles.label}>{it.label}</span>
                    {itemValue === it.value && (
                      <span className={styles.check}><Check size={14} strokeWidth={2.5} /></span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
