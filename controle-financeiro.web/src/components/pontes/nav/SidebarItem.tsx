/**
 * SidebarItem / SidebarSection — primitivos de navegação lateral.
 *
 * Item: ícone + label, estado ativo (pill primarySoft + barra de acento),
 * modo colapsado (só ícone, centralizado, tooltip via title). Section: rótulo
 * de grupo (vira divisor quando colapsado). Cor + fonte por prop.
 */

import { useState, type ReactNode } from "react"
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
  const [hover, setHover] = useState(false)

  // Indicador lateral: bolinha no hover → cresce numa barrinha curva quando ativo.
  const showDot = !active && hover
  const visible = active || showDot
  const indicator: React.CSSProperties = {
    position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
    width: showDot ? 7 : 4,
    height: active ? 22 : showDot ? 7 : 0,
    borderRadius: 999,
    background: p.primary,
    opacity: visible ? 1 : 0,
    transition: "height 260ms cubic-bezier(0.34,1.56,0.64,1), width 200ms ease, opacity 180ms ease",
    pointerEvents: "none",
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
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
      {!collapsed && <span style={indicator} />}
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
