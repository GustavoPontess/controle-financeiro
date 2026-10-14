/**
 * PontesBankBadge — círculo de banco com logo real ou iniciais como fallback.
 *
 * - `logoUrl` fornecido e sem erro → renderiza <img> sobre fundo `cor`
 * - Sem logo ou erro de carregamento → círculo colorido com iniciais
 *
 * Cor de fundo: prop `cor` (hex do banco) ou var(--pontes-primary) via CSS.
 */

import { useState, type CSSProperties } from "react"
import styles from "./BankBadge.module.css"

export type PontesBankBadgeProps = {
  /** Nome usado para calcular iniciais no fallback. */
  name: string
  /** URL do logo (src da img). Ausente ou quebrado → iniciais. */
  logoUrl?: string
  /** Cor hex da marca (fundo do círculo). Padrão: var(--pontes-primary). */
  cor?: string
  /** Tamanho em px. Padrão: 36. */
  size?: number
  /** Redondo (lista de contas/cartões) em vez do quadrado-arredondado (cartão físico). */
  round?: boolean
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function PontesBankBadge({ name, logoUrl, cor, size = 36, round }: PontesBankBadgeProps) {
  const [imgErr, setImgErr] = useState(false)
  const showImg = !!logoUrl && !imgErr
  const fontSize = Math.max(10, Math.floor(size * 0.35))

  return (
    <span
      className={styles.badge}
      data-round={round ? "true" : undefined}
      style={
        {
          width: size,
          height: size,
          fontSize,
          "--badge-bg": cor ?? undefined,
        } as CSSProperties
      }
    >
      {showImg ? (
        <img
          src={logoUrl}
          alt={name}
          className={styles.img}
          onError={() => setImgErr(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  )
}
