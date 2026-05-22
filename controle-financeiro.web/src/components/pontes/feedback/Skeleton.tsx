/**
 * Skeleton — placeholder de loading com shimmer. Cor via var(--pontes-*).
 * width/height/radius por-instância (inline). `p` override escopado opcional (#122).
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Skeleton.module.css"

export type PontesSkeletonProps = {
  p?: Palette
  width?: number | string
  height?: number | string
  radius?: number | string
  style?: React.CSSProperties
}

export function PontesSkeleton({ p, width = "100%", height = 12, radius = 4, style }: PontesSkeletonProps) {
  return (
    <span
      aria-hidden
      className={styles.sk}
      style={{ width, height, borderRadius: radius, ...scopedThemeVars(p), ...style } as CSSProperties}
    />
  )
}

export type PontesSkeletonRowProps = { p?: Palette }

export function PontesSkeletonRow({ p }: PontesSkeletonRowProps) {
  return (
    <div className={styles.row}>
      <PontesSkeleton p={p} width={36} height={36} radius={10} />
      <div className={styles.rowMid}>
        <PontesSkeleton p={p} width="60%" height={12} style={{ marginBottom: 6 }} />
        <PontesSkeleton p={p} width="40%" height={10} />
      </div>
      <PontesSkeleton p={p} width={60} height={14} />
    </div>
  )
}

export type PontesSkeletonListProps = { p?: Palette; rows?: number }

export function PontesSkeletonList({ p, rows = 3 }: PontesSkeletonListProps) {
  return (
    <div className={styles.list} style={scopedThemeVars(p) as CSSProperties}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.listItem}>
          <PontesSkeletonRow p={p} />
        </div>
      ))}
    </div>
  )
}
