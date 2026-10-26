/**
 * Pontes — marca compacta (mark): só o "P" + arco sublinhado.
 *
 * Versão reduzida do PontesLogo (wordmark). Usada onde não cabe o nome inteiro
 * — rail colapsada do sidebar, favicon, avatar de marca. Mesmo estilo: Plus
 * Jakarta Sans + arco que re-traça no hover.
 *
 * Uso:
 *   <PontesLogoMark color={p.primary} size={28} />
 *   <PontesLogoMark color="#fff" size={32} onClick={() => navigate("/dashboard")} />
 */

import { useState, useRef, useEffect } from "react"

const STYLE_ID = "pontes-logomark-keyframes"

function ensureKeyframes() {
  if (typeof document === "undefined") return
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement("style")
  s.id = STYLE_ID
  s.textContent = `@keyframes pontesMarkArcDraw { from { stroke-dashoffset: 120 } to { stroke-dashoffset: 0 } }`
  document.head.appendChild(s)
}

type LogoMarkProps = {
  /** Cor da marca. Default: currentColor. */
  color?: string
  /** Altura visual em px. Default: 32. */
  size?: number
  className?: string
  style?: React.CSSProperties
  onClick?: React.MouseEventHandler<HTMLDivElement>
}

export default function LogoMark({
  color = "currentColor",
  size = 32,
  className,
  style,
  onClick,
}: LogoMarkProps) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const arcRef = useRef<SVGPathElement>(null)

  const archHeight = Math.max(6, size * 0.22)
  const archOffset = Math.max(2, size * 0.1)
  const strokeWidth = Math.max(1.4, size * 0.07)

  useEffect(() => { ensureKeyframes() }, [])

  function handleMouseEnter() {
    setHovered(true)
    const path = arcRef.current
    if (path) {
      path.style.animation = "none"
      void path.getBoundingClientRect()
      path.style.animation = "pontesMarkArcDraw 420ms cubic-bezier(0.4,0,0.2,1) forwards"
    }
  }
  function handleMouseLeave() { setHovered(false); setPressed(false) }

  const scale = pressed ? 0.92 : hovered ? 1.08 : 1
  const transition = pressed
    ? "transform 70ms ease-in"
    : "transform 280ms cubic-bezier(0.34,1.56,0.64,1)"

  return (
    <div
      className={className}
      style={{
        position: "relative", display: "inline-block", lineHeight: 1,
        cursor: onClick ? "pointer" : "default",
        transform: `scale(${scale})`, transition, transformOrigin: "center center",
        userSelect: "none", WebkitUserSelect: "none",
        ...style,
      }}
      aria-label="Pontes"
      role={onClick ? "button" : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={onClick}
    >
      <span style={{
        fontSize: size, fontWeight: 700, color,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        letterSpacing: "-0.04em", lineHeight: 0.85, display: "inline-block",
        padding: "0 1px",
      }}>
        P
      </span>

      <svg
        style={{
          position: "absolute", left: 0, right: 0, bottom: -archOffset,
          width: "100%", height: archHeight, pointerEvents: "none", overflow: "visible",
        }}
        viewBox="0 0 100 16"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <path
          ref={arcRef}
          d="M4 12 Q50 -4 96 12"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
          strokeDasharray="120"
          strokeDashoffset="0"
        />
      </svg>
    </div>
  )
}
