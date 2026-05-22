/**
 * SidebarItem / SidebarSection — primitivos de navegação lateral.
 * Cor via var(--pontes-*); hover/active/collapsed via CSS (data-attr).
 * `p`/`font` override escopado opcional (#122).
 */

import { type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./SidebarItem.module.css"

export type PontesSidebarItemProps = {
  p?: Palette
  font?: string
  icon: ReactNode
  label: string
  active?: boolean
  collapsed?: boolean
  onClick?: () => void
}

export function PontesSidebarItem({
  p, font, icon, label, active = false, collapsed = false, onClick,
}: PontesSidebarItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={styles.item}
      data-active={active ? "true" : undefined}
      data-collapsed={collapsed ? "true" : undefined}
      style={scopedThemeVars(p, font) as CSSProperties}
    >
      <span className={styles.bar} />
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{label}</span>
    </button>
  )
}

export type PontesSidebarSectionProps = {
  p?: Palette
  label: string
  collapsed?: boolean
}

export function PontesSidebarSection({ p, label, collapsed = false }: PontesSidebarSectionProps) {
  return (
    <div className={styles.section} data-collapsed={collapsed ? "true" : undefined} style={scopedThemeVars(p) as CSSProperties}>
      <span className={styles.sectionLabel}>{label}</span>
      <span className={styles.sectionLine} />
    </div>
  )
}
