/**
 * Kbd — tecla de atalho estilo teclado. Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122).
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Kbd.module.css"

export type PontesKbdProps = {
  p?: Palette
  children: React.ReactNode
}

export function PontesKbd({ p, children }: PontesKbdProps) {
  return (
    <kbd className={styles.kbd} style={scopedThemeVars(p) as CSSProperties}>{children}</kbd>
  )
}

export type PontesKbdGroupProps = {
  p?: Palette
  font?: string
  keys: string[]
  label?: string
}

export function PontesKbdGroup({ p, font, keys, label }: PontesKbdGroupProps) {
  return (
    <span className={styles.group} style={scopedThemeVars(p, font) as CSSProperties}>
      <span className={styles.keys}>
        {keys.map((k) => <PontesKbd key={k} p={p}>{k}</PontesKbd>)}
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </span>
  )
}
