/**
 * SidebarItem / SidebarSection — primitivos de navegação lateral.
 *
 * Item: ícone + label, estado ativo (pill primarySoft + barra de acento),
 * modo colapsado (só ícone, centralizado, tooltip via title). Section: rótulo
 * de grupo (vira divisor quando colapsado). Cor + fonte por prop.
 */

import { type ReactNode } from "react"
import type { Palette } from "../theme"

export type PontesSidebarItemProps = {
  p: Palette
  font: string
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
      className="pontes-clickable"
      data-pontes-variant={active ? "soft" : "ghost"}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: collapsed ? "10px 0" : "10px 12px", marginBottom: 2,
        justifyContent: collapsed ? "center" : "flex-start",
        border: "none", borderRadius: 10, cursor: "pointer",
        background: active ? p.primarySoft : "transparent",
        color: active ? p.primary : p.text,
        fontSize: 14, fontWeight: active ? 700 : 500, fontFamily: font,
        position: "relative",
        ["--pontes-hover-bg" as string]: active ? p.primarySoft : p.bg,
        ["--pontes-active-bg" as string]: p.primarySoft,
      }}
    >
      {active && !collapsed && (
        <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, background: p.primary }} />
      )}
      <span style={{ display: "flex", flexShrink: 0, color: active ? p.primary : p.textMuted }}>{icon}</span>
      {!collapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
    </button>
  )
}

export type PontesSidebarSectionProps = {
  p: Palette
  label: string
  collapsed?: boolean
}

export function PontesSidebarSection({ p, label, collapsed = false }: PontesSidebarSectionProps) {
  if (collapsed) return <div style={{ height: 1, background: p.border, margin: "10px 8px" }} />
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: p.textMuted, padding: "12px 12px 6px" }}>
      {label}
    </div>
  )
}
