/**
 * Avatar — círculo com inicial ou foto, status dot opcional.
 * Avatar stack para grupos.
 */

import { semantic, type Palette } from "./theme"

export type AvatarStatus = "online" | "away" | "busy" | "offline"

export type PontesAvatarProps = {
  p: Palette
  size?: number
  name?: string
  photoUrl?: string
  status?: AvatarStatus
  /** Sobrescreve background quando não há foto. Default: p.primary. */
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
  const showText = !photoUrl

  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{
        width: size, height: size, borderRadius: radius,
        background: bg ?? p.primary, color: fg ?? "#FFFFFF",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.max(11, Math.floor(size * 0.35)), fontWeight: 700,
        overflow: "hidden",
      }}>
        {showText ? initials(name) : (
          <img src={photoUrl} alt={name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </span>
      {status && (
        <span style={{
          position: "absolute", bottom: 0, right: 0,
          width: dotSize, height: dotSize, borderRadius: "50%",
          background: statusColor(status),
          border: `2px solid ${p.surface}`,
        }} />
      )}
    </span>
  )
}

// =============================================================================
// PontesAvatarStack
// =============================================================================

export type PontesAvatarStackProps = {
  p: Palette
  avatars: { name?: string; photoUrl?: string; bg?: string }[]
  size?: number
  max?: number
}

export function PontesAvatarStack({ p, avatars, size = 36, max = 4 }: PontesAvatarStackProps) {
  const shown = avatars.slice(0, max)
  const extra = avatars.length - shown.length

  return (
    <span style={{ display: "inline-flex" }}>
      {shown.map((a, i) => (
        <span key={i} style={{ marginLeft: i > 0 ? -10 : 0 }}>
          <span style={{
            display: "inline-block",
            border: `2px solid ${p.surface}`, borderRadius: "50%",
          }}>
            <PontesAvatar p={p} size={size} name={a.name} photoUrl={a.photoUrl} bg={a.bg} />
          </span>
        </span>
      ))}
      {extra > 0 && (
        <span style={{ marginLeft: -10 }}>
          <span style={{
            display: "inline-block", border: `2px solid ${p.surface}`, borderRadius: "50%",
          }}>
            <PontesAvatar p={p} size={size} name={`+${extra}`} bg="#94A3B8" />
          </span>
        </span>
      )}
    </span>
  )
}
