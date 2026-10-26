/**
 * Pontes — logo oficial (wordmark + arco sublinhado).
 *
 * Fonte: Plus Jakarta Sans (carregada globalmente em index.html).
 * Cor: passa via prop `color` (default herda `currentColor` do pai).
 * Tamanho: passa via prop `size` em px (default 32).
 *
 * Animações embutidas:
 *   hover  — scale(1.06) com spring (cubic-bezier com overshoot leve)
 *   press  — scale(0.93) rápido (feedback de clique)
 *   release— spring de volta a 1 ou 1.06 se ainda hovering
 *   arc    — re-traça o arco da esquerda pra direita a cada hover
 *
 * Uso:
 *   <PontesLogo color={p.primary} size={32} />
 *   <PontesLogo color="#fff" size={28} onClick={() => navigate("/")} />
 */

import { useState, useRef, useEffect } from "react"

// ---------------------------------------------------------------------------
// Keyframes injetados uma única vez no <head>
// ---------------------------------------------------------------------------
const STYLE_ID = "pontes-logo-keyframes"

function ensureLogoKeyframes() {
  if (typeof document === "undefined") return
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement("style")
  s.id = STYLE_ID
  s.textContent = `
    @keyframes pontesArcDraw {
      from { stroke-dashoffset: 210 }
      to   { stroke-dashoffset: 0   }
    }
  `
  document.head.appendChild(s)
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type LogoProps = {
  /** Cor do logo. Default: currentColor. */
  color?: string
  /** Altura visual em px. Default: 32. */
  size?: number
  /** Classe CSS extra. */
  className?: string
  /** Style extra (aplicado no wrapper). */
  style?: React.CSSProperties
  /** Se passado, o logo fica clicável (cursor pointer). */
  onClick?: React.MouseEventHandler<HTMLDivElement>
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function Logo({
  color = "currentColor",
  size = 32,
  className,
  style,
  onClick,
}: LogoProps) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const arcRef = useRef<SVGPathElement>(null)

  // Métricas proporcionais ao tamanho
  const archHeight  = Math.max(7, size * 0.22)
  const archOffset  = Math.max(3, size * 0.11)
  const strokeWidth = Math.max(1.4, size * 0.052)

  // Injeta os keyframes uma vez no mount
  useEffect(() => { ensureLogoKeyframes() }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleMouseEnter() {
    setHovered(true)
    // Re-traça o arco da esquerda pra direita
    const path = arcRef.current
    if (path) {
      path.style.animation = "none"
      void path.getBoundingClientRect() // força reflow
      path.style.animation = "pontesArcDraw 420ms cubic-bezier(0.4, 0, 0.2, 1) forwards"
    }
  }

  function handleMouseLeave() {
    setHovered(false)
    setPressed(false)
  }

  function handleMouseDown() { setPressed(true) }
  function handleMouseUp()   { setPressed(false) }

  // Touch (mobile)
  function handleTouchStart() { setPressed(true) }
  function handleTouchEnd()   { setPressed(false) }

  // ── Estilos de animação ───────────────────────────────────────────────────

  const scale = pressed ? 0.93 : hovered ? 1.06 : 1

  const transition = pressed
    ? "transform 70ms ease-in"
    : "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)"

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        lineHeight: 1,
        cursor: onClick ? "pointer" : "default",
        transform: `scale(${scale})`,
        transition,
        transformOrigin: "center center",
        userSelect: "none",
        WebkitUserSelect: "none",
        ...style,
      }}
      aria-label="Pontes"
      role={onClick ? "button" : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={onClick}
    >
      {/* Wordmark */}
      <span
        style={{
          fontSize: size,
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

      {/* Arco sublinhado */}
      <svg
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -archOffset,
          width: "100%",
          height: archHeight,
          pointerEvents: "none",
          overflow: "visible",
        }}
        viewBox="0 0 200 16"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <path
          ref={arcRef}
          d="M4 12 Q100 -4 196 12"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
          strokeDasharray="210"
          strokeDashoffset="0"
        />
      </svg>
    </div>
  )
}
