/**
 * Avatar — círculo com inicial ou foto, status dot opcional. Avatar stack.
 * Cor via var(--pontes-*). `bg`/`fg`/`size` são overrides por-instância (inline).
 * `p` é override de tema escopado opcional (transição #122).
 */

import { type CSSProperties } from "react"
import { semantic, scopedThemeVars, type Palette } from "../theme"
import styles from "./Avatar.module.css"

export type AvatarStatus = "online" | "away" | "busy" | "offline"

export type PontesAvatarProps = {
  p?: Palette
  size?: number
  name?: string
  photoUrl?: string
  status?: AvatarStatus
  /** Sobrescreve background quando não há foto. Default: var(--pontes-primary). */
  bg?: string
  /** Cor do texto quando renderiza iniciais. */
  fg?: string
  rounded?: "full" | "square"
}

function statusColor(s: AvatarStatus): string {
  if (s === "online") return semantic.success
  if (s === "away") return semantic.warning
  if (s === "busy") return semantic.danger
  return "#94A3B8"
}

function initials(name?: string): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function PontesAvatar({
  p, size = 40, name, photoUrl, status, bg, fg, rounded = "full",
}: PontesAvatarProps) {
  const radius = rounded === "full" ? "50%" : 10
  const dotSize = Math.max(10, Math.floor(size / 4))

  return (
    <span className={styles.wrap} style={{ width: size, height: size, ...scopedThemeVars(p) } as CSSProperties}>
      <span
        className={styles.circle}
        style={{
          width: size, height: size, borderRadius: radius,
          fontSize: Math.max(11, Math.floor(size * 0.35)),
          background: bg || undefined, color: fg || undefined,
        }}
      >
        {photoUrl
          ? <img src={photoUrl} alt={name ?? ""} className={styles.img} />
          : initials(name)}
      </span>
      {status && (
        <span className={styles.dot} style={{ width: dotSize, height: dotSize, background: statusColor(status) }} />
      )}
    </span>
  )
}

// =============================================================================
// PontesAvatarStack
// =============================================================================

export type PontesAvatarStackProps = {
  p?: Palette
  avatars: { name?: string; photoUrl?: string; bg?: string }[]
  size?: number
  max?: number
}

export function PontesAvatarStack({ p, avatars, size = 36, max = 4 }: PontesAvatarStackProps) {
  const shown = avatars.slice(0, max)
  const extra = avatars.length - shown.length

  return (
    <span className={styles.stack} style={scopedThemeVars(p) as CSSProperties}>
      {shown.map((a, i) => (
        <span key={i} className={styles.ring} style={{ marginLeft: i > 0 ? -10 : 0 }}>
          <PontesAvatar p={p} size={size} name={a.name} photoUrl={a.photoUrl} bg={a.bg} />
        </span>
      ))}
      {extra > 0 && (
        <span className={styles.ring} style={{ marginLeft: -10 }}>
          <PontesAvatar p={p} size={size} name={`+${extra}`} bg="#94A3B8" />
        </span>
      )}
    </span>
  )
}
