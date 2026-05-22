/**
 * Skeleton — placeholder de loading com shimmer.
 *
 * PontesSkeleton: bloco único.
 * PontesSkeletonRow: linha avatar + 2 textos + valor (item de lista).
 */

import type { Palette } from "../theme"

export type PontesSkeletonProps = {
  p: Palette
  width?: number | string
  height?: number | string
  radius?: number | string
  style?: React.CSSProperties
}

export function PontesSkeleton({ p, width = "100%", height = 12, radius = 4, style }: PontesSkeletonProps) {
  return (
    <>
      <style>{`@keyframes pontes-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }`}</style>
      <span
        aria-hidden
        style={{
          display: "inline-block", width, height, borderRadius: radius,
          background: `linear-gradient(90deg, ${p.bg} 25%, ${p.border} 50%, ${p.bg} 75%)`,
          backgroundSize: "200% 100%",
          animation: "pontes-shimmer 1.5s infinite linear",
          ...style,
        }}
      />
    </>
  )
}

export type PontesSkeletonRowProps = { p: Palette }

export function PontesSkeletonRow({ p }: PontesSkeletonRowProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
      <PontesSkeleton p={p} width={36} height={36} radius={10} />
      <div style={{ flex: 1 }}>
        <PontesSkeleton p={p} width="60%" height={12} style={{ marginBottom: 6 }} />
        <PontesSkeleton p={p} width="40%" height={10} />
      </div>
      <PontesSkeleton p={p} width={60} height={14} />
    </div>
  )
}

export type PontesSkeletonListProps = { p: Palette; rows?: number }

export function PontesSkeletonList({ p, rows = 3 }: PontesSkeletonListProps) {
  return (
    <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 20 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ borderBottom: i < rows - 1 ? `1px solid ${p.border}` : "none" }}>
          <PontesSkeletonRow p={p} />
        </div>
      ))}
    </div>
  )
}
