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

import { type ButtonHTMLAttributes, type ReactNode } from "react"
import { semantic, type Palette } from "./theme"

// =============================================================================
// PontesButton
// =============================================================================

export type PontesButtonVariant =
  | "primary" | "accent" | "outline" | "ghost" | "soft"
  | "danger" | "danger-outline"

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
  iconStart, iconEnd, fullWidth, disabled, children, style, type = "button", ...rest
}: PontesButtonProps) {
  const s = SIZE_MAP[size]

  const baseStyle: React.CSSProperties = {
    padding: s.padding, borderRadius: s.radius, fontSize: s.fontSize,
    fontWeight: 600, fontFamily: font, cursor: disabled || loading ? "not-allowed" : "pointer",
    border: "none", transition: "all 150ms ease",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: fullWidth ? "100%" : undefined,
    opacity: disabled ? 0.6 : 1,
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
  }

  if (disabled && !success) {
    v = { background: p.border, color: p.textMuted, border: "none", boxShadow: "none" }
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      style={{ ...baseStyle, ...v, ...style }}
      {...rest}
    >
      {loading && <Spinner color={variant === "outline" || variant === "ghost" ? p.primary : "#FFFFFF"} />}
      {!loading && success && <span aria-hidden>✓</span>}
      {!loading && !success && iconStart}
      {children}
      {!loading && !success && iconEnd}
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
  p, font, size = 40, variant = "primary", badge, style, children, type = "button", ...rest
}: PontesIconButtonProps) {
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
      style={{
        width: size, height: size, borderRadius: radius, fontSize,
        border: variant === "outline" ? `1px solid ${p.border}` : "none",
        cursor: "pointer", position: "relative", fontFamily: font,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        ...v, ...style,
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
  p, font, size = 56, variant = "accent", style, children, type = "button", ...rest
}: PontesFabProps) {
  const v = variant === "primary"
    ? { background: p.primary, color: p.heroFg, shadow: `0 12px 28px ${p.primary}66` }
    : { background: p.accent, color: "#0B1220", shadow: `0 12px 28px ${p.accent}66` }

  return (
    <button
      type={type}
      style={{
        width: size, height: size, borderRadius: "50%",
        fontSize: size === 48 ? 20 : size === 56 ? 24 : 28,
        background: v.background, color: v.color, border: "none",
        cursor: "pointer", fontFamily: font, fontWeight: 700,
        boxShadow: v.shadow,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        ...style,
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
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  variant?: "pills" | "joined"
}

export function PontesButtonGroup<T extends string = string>({
  p, font, options, value, onChange, variant = "pills",
}: PontesButtonGroupProps<T>) {
  if (variant === "joined") {
    return (
      <div style={{ display: "inline-flex", border: `1px solid ${p.border}`, borderRadius: 10, overflow: "hidden" }}>
        {options.map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              background: opt.value === value ? p.primary : p.surface,
              color: opt.value === value ? p.heroFg : p.text,
              border: "none",
              borderRight: i < options.length - 1 ? `1px solid ${p.border}` : "none",
              padding: "10px 16px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: font,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div style={{
      display: "inline-flex", background: p.bg, border: `1px solid ${p.border}`,
      borderRadius: 10, padding: 4,
    }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            background: opt.value === value ? p.primary : "transparent",
            color: opt.value === value ? p.heroFg : p.text,
            border: "none", padding: "8px 16px", borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// =============================================================================
// PontesLink
// =============================================================================

export type PontesLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  p: Palette
  font?: string
}

export function PontesLink({ p, font, children, style, ...rest }: PontesLinkProps) {
  return (
    <a
      style={{
        color: p.primary, fontSize: 14, fontWeight: 600,
        textDecoration: "underline", cursor: "pointer", fontFamily: font,
        ...style,
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

