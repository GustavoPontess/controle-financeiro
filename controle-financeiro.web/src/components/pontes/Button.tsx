/**
 * Button — família de botões da biblioteca Pontes.
 *
 * Exports:
 *  - PontesButton  (variants + sizes + loading/success states + ícone)
 *  - PontesIconButton  (icon-only, com badge contador opcional)
 *  - PontesFab  (floating action button)
 *  - PontesButtonGroup  (segmented controle de seleção única)
 *  - PontesLink  (anchor estilizado como link)
 */

import { type ButtonHTMLAttributes, type ReactNode, type CSSProperties, useEffect } from "react"
import { adjustColor, semantic, type Palette } from "./theme"
import { ensurePontesGlobalStyles } from "./_globalStyles"

/**
 * Cores de hover por variant — respeitam paleta runtime.
 * adjustColor(c, -0.08) = ~8% mais escuro (escurece primary/accent).
 * adjustColor(c, +0.08) = ~8% mais claro (suaviza soft).
 */
function hoverVarsFor(variant: string, p: Palette): CSSProperties {
  switch (variant) {
    case "primary":
      return { ["--pontes-hover-bg" as never]: adjustColor(p.primary, -0.08), ["--pontes-hover-text" as never]: p.heroFg }
    case "accent":
      return { ["--pontes-hover-bg" as never]: adjustColor(p.accent, -0.06), ["--pontes-hover-text" as never]: "#0B1220" }
    case "soft":
      return { ["--pontes-hover-bg" as never]: adjustColor(p.primarySoft, -0.04), ["--pontes-hover-text" as never]: p.primary }
    case "outline":
      // Hover: bg soft + texto primary (não colide com primary vizinho).
      // Active: vira primary full momentaneamente (preview do destino).
      return {
        ["--pontes-hover-bg" as never]: p.primarySoft, ["--pontes-hover-text" as never]: p.primary, ["--pontes-hover-border" as never]: p.primary,
        ["--pontes-active-bg" as never]: p.primary, ["--pontes-active-text" as never]: p.heroFg, ["--pontes-active-border" as never]: p.primary,
      }
    case "ghost":
      return {
        ["--pontes-hover-bg" as never]: p.primarySoft, ["--pontes-hover-text" as never]: p.primary,
        ["--pontes-active-bg" as never]: p.primary, ["--pontes-active-text" as never]: p.heroFg, ["--pontes-active-border" as never]: "transparent",
      }
    case "danger":
      return { ["--pontes-hover-bg" as never]: adjustColor(semantic.danger, -0.08), ["--pontes-hover-text" as never]: "#FFFFFF" }
    case "danger-outline":
      // Mesma lógica: hover soft + active danger full.
      return {
        ["--pontes-hover-bg" as never]: semantic.dangerSoft, ["--pontes-hover-text" as never]: semantic.danger, ["--pontes-hover-border" as never]: semantic.danger,
        ["--pontes-active-bg" as never]: semantic.danger, ["--pontes-active-text" as never]: "#FFFFFF", ["--pontes-active-border" as never]: semantic.danger,
      }
    case "outline-light":
      // Glass branco translúcido — pra uso sobre fundo escuro (hero, gradient, dark hero).
      return {
        ["--pontes-hover-bg" as never]: "rgba(255,255,255,0.16)",
        ["--pontes-hover-text" as never]: "#FFFFFF",
        ["--pontes-hover-border" as never]: "rgba(255,255,255,0.55)",
        ["--pontes-active-bg" as never]: "rgba(255,255,255,0.30)",
        ["--pontes-active-text" as never]: "#FFFFFF",
        ["--pontes-active-border" as never]: "rgba(255,255,255,0.85)",
      }
    case "ghost-light":
      // Ghost sobre fundo escuro (apenas texto branco, hover ganha bg sutil).
      return {
        ["--pontes-hover-bg" as never]: "rgba(255,255,255,0.10)",
        ["--pontes-hover-text" as never]: "#FFFFFF",
        ["--pontes-active-bg" as never]: "rgba(255,255,255,0.20)",
        ["--pontes-active-text" as never]: "#FFFFFF",
      }
    default:
      return { ["--pontes-hover-bg" as never]: adjustColor(p.primary, -0.08) }
  }
}

// =============================================================================
// PontesButton
// =============================================================================

export type PontesButtonVariant =
  | "primary" | "accent" | "outline" | "ghost" | "soft"
  | "danger" | "danger-outline"
  | "outline-light" | "ghost-light"

export type PontesButtonSize = "xs" | "sm" | "md" | "lg" | "xl"

type PontesButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  p: Palette
  font: string
  variant?: PontesButtonVariant
  size?: PontesButtonSize
  loading?: boolean
  success?: boolean
  iconStart?: ReactNode
  iconEnd?: ReactNode
  type?: "button" | "submit" | "reset"
  fullWidth?: boolean
}

const SIZE_MAP: Record<PontesButtonSize, { padding: string; radius: number; fontSize: number }> = {
  xs: { padding: "4px 10px", radius: 6, fontSize: 11 },
  sm: { padding: "6px 12px", radius: 8, fontSize: 12 },
  md: { padding: "10px 18px", radius: 10, fontSize: 14 },
  lg: { padding: "14px 26px", radius: 12, fontSize: 16 },
  xl: { padding: "18px 32px", radius: 14, fontSize: 18 },
}

export function PontesButton({
  p, font, variant = "primary", size = "md", loading, success,
  iconStart, iconEnd, fullWidth, disabled, children, style, type = "button", className, ...rest
}: PontesButtonProps) {
  useEffect(ensurePontesGlobalStyles, [])
  const s = SIZE_MAP[size]

  const baseStyle: React.CSSProperties = {
    padding: s.padding, borderRadius: s.radius, fontSize: s.fontSize,
    fontWeight: 600, fontFamily: font, cursor: disabled || loading ? "not-allowed" : "pointer",
    border: "none", transition: "all 150ms ease",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
    width: fullWidth ? "100%" : undefined,
    opacity: disabled ? 0.6 : 1,
  }

  // Wrapper de ícone: garante tamanho proporcional ao label (~1.3em) e line-height
  // 1 pra centralizar caracteres de texto curtos como "+" / "→".
  const iconStyle: React.CSSProperties = {
    fontSize: "1.3em", lineHeight: 1, display: "inline-flex",
    alignItems: "center", justifyContent: "center",
  }

  let v: React.CSSProperties = {}
  if (success) {
    v = { background: semantic.success, color: "#FFFFFF" }
  } else if (variant === "primary") {
    v = { background: p.primary, color: p.heroFg, boxShadow: `0 4px 14px ${p.primary}44` }
  } else if (variant === "accent") {
    v = { background: p.accent, color: "#0B1220", boxShadow: `0 4px 14px ${p.accent}44` }
  } else if (variant === "outline") {
    v = { background: "transparent", color: p.primary, border: `1.5px solid ${p.primary}` }
  } else if (variant === "ghost") {
    v = { background: "transparent", color: p.text }
  } else if (variant === "soft") {
    v = { background: p.primarySoft, color: p.primary }
  } else if (variant === "danger") {
    v = { background: semantic.danger, color: "#FFFFFF" }
  } else if (variant === "danger-outline") {
    v = { background: "transparent", color: semantic.danger, border: `1.5px solid ${semantic.danger}` }
  } else if (variant === "outline-light") {
    v = { background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.3)" }
  } else if (variant === "ghost-light") {
    v = { background: "transparent", color: "#FFFFFF" }
  }

  if (disabled && !success) {
    v = { background: p.border, color: p.textMuted, border: "none", boxShadow: "none" }
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={["pontes-clickable", className].filter(Boolean).join(" ")}
      data-pontes-variant={variant}
      style={{ ...baseStyle, ...v, ...hoverVarsFor(variant, p), ...style }}
      {...rest}
    >
      {loading && <Spinner color={variant === "outline" || variant === "ghost" ? p.primary : "#FFFFFF"} />}
      {!loading && success && <span aria-hidden style={iconStyle}>✓</span>}
      {!loading && !success && iconStart && <span style={iconStyle} aria-hidden>{iconStart}</span>}
      {children}
      {!loading && !success && iconEnd && <span style={iconStyle} aria-hidden>{iconEnd}</span>}
    </button>
  )
}

function Spinner({ color }: { color: string }) {
  return (
    <>
      <style>{`@keyframes pontes-spin { to { transform: rotate(360deg) } }`}</style>
      <span
        aria-hidden
        style={{
          width: 14, height: 14, borderRadius: "50%",
          border: `2px solid ${color}40`, borderTopColor: color,
          animation: "pontes-spin 0.7s linear infinite",
          display: "inline-block",
        }}
      />
    </>
  )
}

// =============================================================================
// PontesIconButton
// =============================================================================

export type PontesIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  p: Palette
  font?: string
  size?: 32 | 40 | 48
  variant?: "primary" | "soft" | "outline" | "ghost"
  badge?: number | string
  type?: "button" | "submit"
}

export function PontesIconButton({
  p, font, size = 40, variant = "primary", badge, style, children, type = "button", className, ...rest
}: PontesIconButtonProps) {
  useEffect(ensurePontesGlobalStyles, [])
  const radius = size === 32 ? 8 : size === 40 ? 10 : 12
  const fontSize = size === 32 ? 14 : size === 40 ? 18 : 20

  let v: React.CSSProperties = {}
  if (variant === "primary") v = { background: p.primary, color: p.heroFg }
  if (variant === "soft") v = { background: p.primarySoft, color: p.primary }
  if (variant === "outline") v = { background: "transparent", border: `1px solid ${p.border}`, color: p.text }
  if (variant === "ghost") v = { background: "transparent", color: p.text }

  return (
    <button
      type={type}
      className={["pontes-clickable", className].filter(Boolean).join(" ")}
      data-pontes-variant={variant}
      style={{
        width: size, height: size, borderRadius: radius, fontSize,
        border: variant === "outline" ? `1px solid ${p.border}` : "none",
        cursor: "pointer", position: "relative", fontFamily: font,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        ...v, ...hoverVarsFor(variant, p), ...style,
      }}
      {...rest}
    >
      {children}
      {badge != null && (
        <span style={{
          position: "absolute", top: -4, right: -4, background: semantic.danger,
          color: "#FFFFFF", borderRadius: 999, fontSize: 10, fontWeight: 700,
          padding: "2px 6px", border: "2px solid #FFFFFF",
        }}>{badge}</span>
      )}
    </button>
  )
}

// =============================================================================
// PontesFab
// =============================================================================

export type PontesFabProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  p: Palette
  font?: string
  size?: 48 | 56 | 64
  variant?: "primary" | "accent"
  type?: "button" | "submit"
}

export function PontesFab({
  p, font, size = 56, variant = "accent", style, children, type = "button", className, ...rest
}: PontesFabProps) {
  useEffect(ensurePontesGlobalStyles, [])
  // Sombra neutra (sem glow tintado) — usuário pediu mais sutil.
  const v = variant === "primary"
    ? { background: p.primary, color: p.heroFg, shadow: "0 8px 20px rgba(11,18,32,0.18)" }
    : { background: p.accent, color: "#0B1220", shadow: "0 8px 20px rgba(11,18,32,0.18)" }

  return (
    <button
      type={type}
      className={["pontes-clickable", className].filter(Boolean).join(" ")}
      data-pontes-variant={variant}
      style={{
        width: size, height: size, borderRadius: "50%",
        fontSize: size === 48 ? 20 : size === 56 ? 24 : 28,
        background: v.background, color: v.color, border: "none",
        cursor: "pointer", fontFamily: font, fontWeight: 700,
        boxShadow: v.shadow,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        ...hoverVarsFor(variant, p), ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

// =============================================================================
// PontesButtonGroup (segmented)
// =============================================================================

export type PontesButtonGroupProps<T extends string = string> = {
  p: Palette
  font: string
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  variant?: "pills" | "joined"
}

export function PontesButtonGroup<T extends string = string>({
  p, font, options, value, onChange, variant = "pills",
}: PontesButtonGroupProps<T>) {
  useEffect(ensurePontesGlobalStyles, [])
  if (variant === "joined") {
    return (
      <div style={{ display: "inline-flex", border: `1px solid ${p.border}`, borderRadius: 10, overflow: "hidden" }}>
        {options.map((opt, i) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="pontes-clickable pontes-no-lift"
              data-pontes-variant={active ? "primary" : "ghost"}
              style={{
                background: active ? p.primary : p.surface,
                color: active ? p.heroFg : p.text,
                border: "none",
                borderRight: i < options.length - 1 ? `1px solid ${p.border}` : "none",
                padding: "10px 16px", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: font,
                ...hoverVarsFor(active ? "primary" : "ghost", p),
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{
      display: "inline-flex", background: p.bg, border: `1px solid ${p.border}`,
      borderRadius: 10, padding: 4,
    }}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="pontes-clickable pontes-no-lift"
            data-pontes-variant={active ? "primary" : "ghost"}
            style={{
              background: active ? p.primary : "transparent",
              color: active ? p.heroFg : p.text,
              border: "none", padding: "8px 16px", borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
              ...hoverVarsFor(active ? "primary" : "ghost", p),
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// =============================================================================
// PontesNavLink — link de menu de navegação com underline animado.
// Texto não se desloca no hover (underline é pseudo-element absolute).
// =============================================================================

export type PontesNavLinkProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  p: Palette
  font: string
  /** Cor base do texto (fora hover). Default: p.text. */
  color?: string
  /** Cor do hover + underline + estado ativo. Default: p.primary. */
  hoverColor?: string
  /** Marca como item ativo (underline sempre visível, peso 700). */
  active?: boolean
}

export function PontesNavLink({
  p, font, color, hoverColor, active, style, className, children, ...rest
}: PontesNavLinkProps) {
  useEffect(ensurePontesGlobalStyles, [])
  const baseColor = color ?? p.text
  const hover = hoverColor ?? p.primary
  return (
    <button
      type="button"
      className={["pontes-navlink", className].filter(Boolean).join(" ")}
      data-pontes-active={active ? "true" : "false"}
      style={{
        fontFamily: font,
        fontSize: 14,
        ["--pontes-navlink-color" as never]: baseColor,
        ["--pontes-navlink-hover" as never]: hover,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

// =============================================================================
// PontesLink
// =============================================================================

export type PontesLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  p: Palette
  font?: string
}

export function PontesLink({ p, font, children, style, className, ...rest }: PontesLinkProps) {
  useEffect(ensurePontesGlobalStyles, [])
  return (
    <a
      className={["pontes-link-hover", className].filter(Boolean).join(" ")}
      style={{
        color: p.primary, fontSize: 14, fontWeight: 600,
        textDecoration: "underline", cursor: "pointer", fontFamily: font,
        ["--pontes-hover-color" as never]: adjustColor(p.primary, -0.12),
        ...style,
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

