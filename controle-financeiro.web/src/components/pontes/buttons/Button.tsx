/**
 * Button — família de botões da biblioteca Pontes.
 *
 * Estilo via Button.module.css + CSS vars (var(--pontes-*)). As props p/font
 * são override de tema escopado opcional (transição #122): se passadas, aplicam
 * as vars inline; se não, herdam do :root. Variants/sizes via data-attr.
 *
 * Exports: PontesButton, PontesIconButton, PontesFab, PontesButtonGroup,
 * PontesNavLink, PontesLink.
 */

import { type ButtonHTMLAttributes, type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Button.module.css"

// =============================================================================
// PontesButton
// =============================================================================

export type PontesButtonVariant =
  | "primary" | "accent" | "outline" | "ghost" | "soft"
  | "danger" | "danger-outline"
  | "success" | "success-outline"
  | "outline-light" | "ghost-light"

export type PontesButtonSize = "xs" | "sm" | "md" | "lg" | "xl"

type PontesButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  p?: Palette
  font?: string
  variant?: PontesButtonVariant
  size?: PontesButtonSize
  loading?: boolean
  success?: boolean
  iconStart?: ReactNode
  iconEnd?: ReactNode
  type?: "button" | "submit" | "reset"
  fullWidth?: boolean
}

export function PontesButton({
  p, font, variant = "primary", size = "md", loading, success,
  iconStart, iconEnd, fullWidth, disabled, children, style, type = "button", className, ...rest
}: PontesButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[styles.btn, className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      data-state={success ? "success" : undefined}
      data-fullwidth={fullWidth ? "true" : undefined}
      style={{ ...scopedThemeVars(p, font), ...style } as CSSProperties}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden />}
      {!loading && success && <span className={styles.icon} aria-hidden>✓</span>}
      {!loading && !success && iconStart && <span className={styles.icon} aria-hidden>{iconStart}</span>}
      {children}
      {!loading && !success && iconEnd && <span className={styles.icon} aria-hidden>{iconEnd}</span>}
    </button>
  )
}

// =============================================================================
// PontesIconButton
// =============================================================================

export type PontesIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  p?: Palette
  font?: string
  size?: 32 | 40 | 48
  variant?: "primary" | "soft" | "outline" | "ghost" | "danger" | "success"
  badge?: number | string
  type?: "button" | "submit"
}

export function PontesIconButton({
  p, font, size = 40, variant = "primary", badge, style, children, type = "button", className, ...rest
}: PontesIconButtonProps) {
  return (
    <button
      type={type}
      className={[styles.iconBtn, className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      style={{ ...scopedThemeVars(p, font), ...style } as CSSProperties}
      {...rest}
    >
      {children}
      {badge != null && <span className={styles.badge}>{badge}</span>}
    </button>
  )
}

// =============================================================================
// PontesFab
// =============================================================================

export type PontesFabProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  p?: Palette
  font?: string
  size?: 48 | 56 | 64
  variant?: "primary" | "accent"
  type?: "button" | "submit"
}

export function PontesFab({
  p, font, size = 56, variant = "accent", style, children, type = "button", className, ...rest
}: PontesFabProps) {
  return (
    <button
      type={type}
      className={[styles.fab, className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      style={{ ...scopedThemeVars(p, font), ...style } as CSSProperties}
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
  p?: Palette
  font?: string
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  variant?: "pills" | "joined"
}

export function PontesButtonGroup<T extends string = string>({
  p, font, options, value, onChange, variant = "pills",
}: PontesButtonGroupProps<T>) {
  const joined = variant === "joined"
  return (
    <div
      className={joined ? styles.groupJoined : styles.groupPills}
      style={scopedThemeVars(p, font) as CSSProperties}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[styles.seg, joined ? styles.segJoined : styles.segPill].join(" ")}
          data-active={opt.value === value ? "true" : "false"}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// =============================================================================
// PontesNavLink — link de menu de navegação com underline animado.
// color/hoverColor: override por-instância (ex: navbar sobre fundo escuro).
// =============================================================================

export type PontesNavLinkProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  p?: Palette
  font?: string
  /** Cor base do texto (fora hover). Default: var(--pontes-text). */
  color?: string
  /** Cor do hover + underline + estado ativo. Default: var(--pontes-primary). */
  hoverColor?: string
  /** Marca como item ativo (underline sempre visível, peso 700). */
  active?: boolean
}

export function PontesNavLink({
  p, font, color, hoverColor, active, style, className, children, ...rest
}: PontesNavLinkProps) {
  return (
    <button
      type="button"
      className={[styles.navlink, className].filter(Boolean).join(" ")}
      data-active={active ? "true" : "false"}
      style={{
        ...scopedThemeVars(p, font),
        ...(color ? { "--nav-color": color } : {}),
        ...(hoverColor ? { "--nav-hover": hoverColor } : {}),
        ...style,
      } as CSSProperties}
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
  p?: Palette
  font?: string
}

export function PontesLink({ p, font, children, style, className, ...rest }: PontesLinkProps) {
  return (
    <a
      className={[styles.link, className].filter(Boolean).join(" ")}
      style={{ ...scopedThemeVars(p, font), ...style } as CSSProperties}
      {...rest}
    >
      {children}
    </a>
  )
}
