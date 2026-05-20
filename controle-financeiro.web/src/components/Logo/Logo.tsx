/**
 * Pontes — logo oficial (conceito 20: wordmark + arco sublinhado).
 *
 * Fonte: Plus Jakarta Sans (carregada globalmente em index.html).
 * Cor: passa via prop `color` (default herda `currentColor` do pai).
 * Tamanho: passa via prop `size` em px (default 32).
 *
 * Variantes:
 * - "full"     — wordmark + arco sublinhado (default)
 * - "wordmark" — só texto, sem arco
 */

type LogoProps = {
  /** Cor do logo. Default: `currentColor` (herda do pai via CSS). */
  color?: string
  /** Altura do logo em px. Default: 32. */
  size?: number
  /** Variante de exibição. Default: "full". */
  variant?: "full" | "wordmark"
  /** Override de className/style opcional. */
  className?: string
  style?: React.CSSProperties
}

export default function Logo({ color = "currentColor", size = 32, variant = "full", className, style }: LogoProps) {
  // fontSize calculado: size é a altura visual aprox; texto ocupa ~80% da altura
  const fontSize = size
  const archHeight = Math.max(8, size * 0.22)
  const archOffset = Math.max(4, size * 0.12)
  const strokeWidth = Math.max(2, size * 0.06)

  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        lineHeight: 1,
        ...style,
      }}
      aria-label="Pontes"
    >
      <span
        style={{
          fontSize,
          fontWeight: 700,
          color,
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          letterSpacing: "-0.035em",
          lineHeight: 0.85,
          display: "inline-block",
        }}
      >
        Pontes
      </span>
      {variant === "full" && (
        <svg
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -archOffset,
            width: "100%",
            height: archHeight,
            pointerEvents: "none",
          }}
          viewBox="0 0 200 16"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 12 Q100 -4 196 12"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  )
}
