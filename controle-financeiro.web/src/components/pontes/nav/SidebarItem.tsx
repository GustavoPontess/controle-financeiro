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
  const RADIUS = 14 // = raio do pill

  // Ativo: borda esquerda curva acompanhando o contorno do pill. Hover
  // (inativo): barrinha curta via scaleY.
  // Borda completa do pill, recortada (clip-path) pra mostrar só a faixa
  // esquerda — cobre TODA a parte arredondada (canto sup + lateral + canto inf).
  // Ativo: barrinha vertical simples. Hover (inativo): barra mais curta.
  const activeBar: React.CSSProperties = {
    position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
    width: 4, height: 14, borderRadius: 999, background: p.primary, pointerEvents: "none",
  }
  const hoverBar: React.CSSProperties = {
    position: "absolute", left: 0, top: "50%", transformOrigin: "center",
    transform: `translateY(-50%) scaleY(${hover ? 1 : 0})`,
    width: 4, height: 14, borderRadius: 999, background: p.primary,
    opacity: hover ? 1 : 0,
    transition: "transform 240ms cubic-bezier(0.34,1.56,0.64,1), opacity 180ms ease",
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
        width: "100%", display: "flex", alignItems: "center", gap: collapsed ? 0 : 12,
        padding: "10px 12px", marginBottom: 2, justifyContent: "flex-start",
        border: "none", borderRadius: RADIUS, cursor: "pointer",
        transition: "gap 200ms ease",
        background: active ? p.primarySoft : "transparent",
        color: active ? p.primary : p.text,
        fontSize: 14, fontWeight: active ? 700 : 500, fontFamily: font,
        position: "relative",
        ["--pontes-hover-bg" as string]: active ? p.primarySoft : p.bg,
        ["--pontes-active-bg" as string]: p.primarySoft,
      }}
    >
      {active && <span style={activeBar} />}
      {!active && <span style={hoverBar} />}
      <span style={{ display: "flex", flexShrink: 0, color: active ? p.primary : p.textMuted }}>{icon}</span>
      <span style={{
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : 180,
        transition: "opacity 160ms ease, max-width 220ms ease",
      }}>{label}</span>
    </button>
  )
}

export type PontesSidebarSectionProps = {
  p: Palette
  label: string
  collapsed?: boolean
}

export function PontesSidebarSection({ p, label, collapsed = false }: PontesSidebarSectionProps) {
  // Caixa de altura fixa: texto e traço ocupam o MESMO espaço (cross-fade),
  // então colapsar não causa pulo de layout.
  return (
    <div style={{ position: "relative", height: 30 }}>
      <span style={{
        position: "absolute", left: 12, right: 12, bottom: 6,
        fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
        color: p.textMuted, whiteSpace: "nowrap", overflow: "hidden",
        opacity: collapsed ? 0 : 1, transition: "opacity 160ms ease", pointerEvents: "none",
      }}>{label}</span>
      <span style={{
        position: "absolute", left: 8, right: 8, bottom: 10, height: 1, background: p.border,
        opacity: collapsed ? 1 : 0, transition: "opacity 200ms ease", pointerEvents: "none",
      }} />
    </div>
  )
}
