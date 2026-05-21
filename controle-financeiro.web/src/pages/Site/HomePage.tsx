/**
 * Home — página de entrada pública do site Pontes.
 * Rota pública /site (será `/` quando o app suportar root público).
 *
 * Trocador de paleta e fonte ao vivo no topo (sai quando paleta vier de
 * personalização do usuário).
 */

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Play, Plus, ChevronUp, ChevronDown } from "lucide-react"
import { PontesNavbar, PontesFooter, PontesButton, PontesLink, PontesButtonGroup, PontesTabs, applyPontesScrollbar, usePontesBodyScrollbar } from "../../components/pontes"
import { palettes, fonts, type Palette } from "./theme"
import {
  ResponsiveContainer, AreaChart, Area, BarChart as RBarChart, Bar,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts"

// (palettes, fonts, types extraídos pra ./theme.ts — resolve react-refresh/only-export-components)

// =============================================================================
// PRIMITIVOS VISUAIS
// =============================================================================

// Wordmark removido — usar <Logo /> direto ou PontesNavbar/PontesFooter da biblioteca.

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6.5" fill={color} fillOpacity="0.25" stroke={color} />
      <path d="M4 7 L6.2 9 L10 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function GridPattern({ color = "#FFFFFF", opacity = 0.06 }: { color?: string; opacity?: number }) {
  const id = `grid-${useId().replace(/[:]/g, "")}`
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <defs>
        <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={color} strokeWidth="1" opacity={opacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/** Dot animado pulsando — pra badge "live". */
function PulseDot({ color }: { color: string }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 8, height: 8 }}>
      <style>{`
        @keyframes bp-pulse { 0% { transform: scale(1); opacity: 0.65 } 100% { transform: scale(2.4); opacity: 0 } }
      `}</style>
      <span
        style={{
          position: "absolute", inset: 0, borderRadius: "50%", background: color,
          animation: "bp-pulse 1.6s ease-out infinite",
        }}
      />
      <span style={{ position: "relative", display: "block", width: 8, height: 8, borderRadius: "50%", background: color }} />
    </span>
  )
}

/** Keyframes globais. */
function GlobalAnims() {
  return (
    <style>{`
      @keyframes bp-pulse { 0% { transform: scale(1); opacity: 0.65 } 100% { transform: scale(2.4); opacity: 0 } }
      @keyframes bp-spin { to { transform: rotate(360deg) } }
      @keyframes bp-spin-slow { to { transform: rotate(360deg) } }
      @keyframes bp-marquee { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
      @keyframes bp-fade-up { 0% { opacity: 0; transform: translateY(24px) } 100% { opacity: 1; transform: translateY(0) } }
      @keyframes bp-toast-in { 0% { opacity: 0; transform: translateY(-20px) scale(0.9) } 100% { opacity: 1; transform: translateY(0) scale(1) } }
      @keyframes bp-glow { 0%, 100% { opacity: 0.5 } 50% { opacity: 0.85 } }
      @keyframes bp-slide-in { 0% { opacity: 0; transform: translateX(20px) } 100% { opacity: 1; transform: translateX(0) } }
      @keyframes bp-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
      @keyframes bp-mesh-move {
        0%, 100% { transform: translate(0, 0) scale(1) }
        33% { transform: translate(30px, -20px) scale(1.1) }
        66% { transform: translate(-20px, 30px) scale(0.95) }
      }
      @keyframes bp-typing-fade { 0%, 100% { opacity: 0; transform: translateY(8px) } 15%, 85% { opacity: 1; transform: translateY(0) } }
      @keyframes bp-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
      .bp-fade-up { animation: bp-fade-up 0.6s ease-out backwards }
      .bp-marquee-track { animation: bp-marquee 30s linear infinite }
      .bp-marquee-track:hover { animation-play-state: paused }
      .bp-noise {
        position: absolute; inset: 0; pointer-events: none; opacity: 0.05;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E");
      }
      .bp-spotlight { position: relative; overflow: hidden; transition: transform 200ms; }
      .bp-spotlight::before {
        content: ''; position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), var(--spot, rgba(255,255,255,0.1)), transparent 40%);
        opacity: 0; transition: opacity 200ms;
      }
      .bp-spotlight:hover::before { opacity: 1 }
      .bp-tilt { transition: transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1) }
    `}</style>
  )
}

/** Hook: progresso do scroll [0, 1]. */
function useScrollProgress() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setP(max > 0 ? window.scrollY / max : 0)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return p
}

/** Card com spotlight cursor-follow. */
function SpotlightCard({ children, style, spotColor = "rgba(255,255,255,0.12)" }: { children: React.ReactNode; style?: React.CSSProperties; spotColor?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className="bp-spotlight"
      onMouseMove={(e) => {
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        el.style.setProperty("--mx", `${e.clientX - rect.left}px`)
        el.style.setProperty("--my", `${e.clientY - rect.top}px`)
      }}
      style={{ "--spot": spotColor, ...style } as React.CSSProperties}
    >
      {children}
    </div>
  )
}

/** Card com tilt 3D mouse-follow. */
function TiltCard({ children, style, intensity = 8 }: { children: React.ReactNode; style?: React.CSSProperties; intensity?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className="bp-tilt"
      onMouseMove={(e) => {
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const rx = ((e.clientY - cy) / rect.height) * -intensity
        const ry = ((e.clientX - cx) / rect.width) * intensity
        el.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`
      }}
      onMouseLeave={() => {
        const el = ref.current
        if (el) el.style.transform = "perspective(1200px) rotateX(0) rotateY(0) translateZ(0)"
      }}
      style={{ transformStyle: "preserve-3d", ...style }}
    >
      {children}
    </div>
  )
}

/** Typing headline — palavra trocando. */
function TypingWord({ words, color, intervalMs = 2500 }: { words: string[]; color: string; intervalMs?: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % words.length), intervalMs)
    return () => clearInterval(id)
  }, [words.length, intervalMs])
  return (
    <span style={{ position: "relative", display: "inline-block", color, minWidth: "5ch", textAlign: "left" }}>
      {words.map((w, idx) => (
        <span
          key={w}
          style={{
            position: idx === i ? "relative" : "absolute",
            left: 0, top: 0,
            opacity: idx === i ? 1 : 0,
            transform: idx === i ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 350ms ease, transform 350ms ease",
            whiteSpace: "nowrap",
          }}
        >
          {w}
        </span>
      ))}
      <span style={{ display: "inline-block", width: 4, height: "0.85em", background: color, marginLeft: 4, animation: "bp-glow 1s infinite", verticalAlign: "middle" }} />
    </span>
  )
}

/** Comparison slider antes/depois — drag horizontal. */
/** Utilitário reutilizável (exportado pra outras páginas). */
export function ComparisonSlider({ leftLabel, rightLabel, leftContent, rightContent, p }: { leftLabel: string; rightLabel: string; leftContent: React.ReactNode; rightContent: React.ReactNode; p: Palette }) {
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const onMove = (clientX: number) => {
    if (!dragging.current || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    setPos((x / rect.width) * 100)
  }

  return (
    <div
      ref={ref}
      style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 18, overflow: "hidden", cursor: "ew-resize", userSelect: "none", border: `1px solid ${p.border}` }}
      onMouseDown={() => (dragging.current = true)}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onMouseMove={(e) => onMove(e.clientX)}
    >
      {/* Direita (Pontes) — fundo completo */}
      <div style={{ position: "absolute", inset: 0 }}>{rightContent}</div>
      <div style={{ position: "absolute", top: 12, right: 16, background: p.primary, color: p.heroFg, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{rightLabel}</div>

      {/* Esquerda (planilha) — clipada pela posição */}
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - pos}% 0 0)` }}>{leftContent}</div>
      <div style={{ position: "absolute", top: 12, left: 16, background: "#0B1220", color: "#FFFFFF", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, opacity: pos > 10 ? 1 : 0, transition: "opacity 150ms" }}>{leftLabel}</div>

      {/* Handle */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 3, background: "#FFFFFF", boxShadow: "0 0 0 1px rgba(0,0,0,0.15), 0 4px 14px rgba(0,0,0,0.3)" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 40, height: 40, background: "#FFFFFF", borderRadius: "50%", boxShadow: "0 6px 20px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: p.text, fontWeight: 800 }}>↔</div>
      </div>
    </div>
  )
}

/** Logos clouds 3D — rotação suave dos logos. */
/** Utilitário reutilizável. */
export function LogosCloud3D({ p, font, logos }: { p: Palette; font: string; logos: string[] }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap", perspective: "800px" }}>
      {logos.map((l, i) => (
        <div
          key={l}
          style={{
            fontWeight: 700, fontSize: 22, color: p.text, fontFamily: font, opacity: 0.55,
            animation: `bp-float 3.5s ease-in-out ${i * 0.18}s infinite`,
            transform: `rotateY(${(i % 2 === 0 ? 1 : -1) * 4}deg)`,
          }}
        >
          {l}
        </div>
      ))}
    </div>
  )
}

/** Card stack — 3 cards empilhados que se separam no hover do pai. */
/** Utilitário reutilizável. */
export function CardStack({ p, items }: { p: Palette; items: { icon: string; title: string; v: string }[] }) {
  return (
    <div style={{ position: "relative", height: 200, width: 280 }} className="bp-card-stack-host">
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            position: "absolute", top: 0, left: 0, right: 0,
            background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 18,
            transform: `translateY(${i * 14}px) scale(${1 - i * 0.05})`,
            zIndex: items.length - i,
            transition: "transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            boxShadow: "0 10px 24px -8px rgba(0,0,0,0.12)",
          }}
        >
          <style>{`
            .bp-card-stack-host:hover > div:nth-child(1) { transform: translateY(0) translateX(-40px) rotate(-4deg) scale(1) !important }
            .bp-card-stack-host:hover > div:nth-child(2) { transform: translateY(40px) translateX(0) rotate(0deg) scale(1) !important }
            .bp-card-stack-host:hover > div:nth-child(3) { transform: translateY(80px) translateX(40px) rotate(4deg) scale(1) !important }
          `}</style>
          <div style={{ fontSize: 22, marginBottom: 6 }}>{it.icon}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: p.text, marginBottom: 2 }}>{it.title}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: p.primary }}>{it.v}</div>
        </div>
      ))}
    </div>
  )
}

/** Mesh gradient com 3 blobs animados — bolinhas inteiras, sem corte nas bordas. */
function MeshGradientAnimated({ c1, c2, c3 }: { c1: string; c2: string; c3: string }) {
  const blobBase = {
    position: "absolute" as const,
    borderRadius: "50%",
    filter: "blur(70px)",
    willChange: "transform",
  }
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{
        ...blobBase,
        top: "15%", left: "12%", width: 360, height: 360,
        background: `${c1}55`,
        animation: "bp-mesh-move 14s ease-in-out infinite",
      }} />
      <div style={{
        ...blobBase,
        top: "45%", right: "10%", width: 300, height: 300,
        background: `${c2}45`,
        animation: "bp-mesh-move 18s ease-in-out infinite reverse",
      }} />
      <div style={{
        ...blobBase,
        bottom: "18%", left: "38%", width: 280, height: 280,
        background: `${c3}40`,
        animation: "bp-mesh-move 22s ease-in-out infinite",
      }} />
    </div>
  )
}

/** Animated counter — interpola de 0 ao valor final no mount. */
function AnimatedNumber({ value, suffix = "", prefix = "", duration = 1400, decimals = 0 }: { value: number; suffix?: string; prefix?: string; duration?: number; decimals?: number }) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - t, 3)
            setN(value * eased)
            if (t < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      })
    }, { threshold: 0.4 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [value, duration])
  return <span ref={ref}>{prefix}{n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}{suffix}</span>
}

/** Reveal on scroll via IntersectionObserver. */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setVisible(true) })
    }, { threshold: 0.15 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: `opacity 700ms ease-out ${delay}ms, transform 700ms ease-out ${delay}ms` }}>
      {children}
    </div>
  )
}

/** Mesh gradient estática — bolinhas inteiras, sem corte nas bordas. */
function MeshGradient({ c1, c2, c3 }: { c1: string; c2: string; c3: string }) {
  const blobBase = {
    position: "absolute" as const,
    borderRadius: "50%",
    filter: "blur(70px)",
  }
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ ...blobBase, top: "15%", left: "12%", width: 360, height: 360, background: `${c1}55` }} />
      <div style={{ ...blobBase, top: "45%", right: "10%", width: 300, height: 300, background: `${c2}45` }} />
      <div style={{ ...blobBase, bottom: "18%", left: "38%", width: 280, height: 280, background: `${c3}40` }} />
    </div>
  )
}

// =============================================================================
// MOCKUPS
// =============================================================================

/** Mockup desktop completo do dashboard, tilt 3D, sombra cinematográfica. */
function DesktopMockup({ p, font }: { p: Palette; font: string }) {
  return (
    <div
      style={{
        background: "#FFFFFF", borderRadius: 18,
        boxShadow: "0 50px 100px -25px rgba(0,0,0,0.45), 0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)",
        overflow: "hidden", width: 620, maxWidth: "100%",
        transform: "perspective(1800px) rotateY(-8deg) rotateX(4deg)",
        transformOrigin: "center", fontFamily: font,
      }}
    >
      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "#F1F5F9", borderBottom: "1px solid #E2E8F0" }}>
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#FF5F57" }} />
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#FEBC2E" }} />
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28C840" }} />
        <div style={{ marginLeft: 14, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 14px", fontSize: 11, color: "#94A3B8" }}>
          pontes.app/dashboard
        </div>
      </div>

      <div style={{ display: "flex", minHeight: 420 }}>
        {/* Sidebar */}
        <div style={{ width: 64, background: p.primary, padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 32, height: 32, background: "rgba(255,255,255,0.18)", borderRadius: 8 }} />
          {[0.4, 0.2, 0.2, 0.2, 0.2].map((o, i) => (
            <div key={i} style={{ width: 28, height: 28, background: `rgba(255,255,255,${o})`, borderRadius: 6 }} />
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: 22, background: "#FAFBFC" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#0B1220", marginBottom: 4 }}>Olá, Gustavo</div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 16 }}>Terça-feira, 20 de maio</div>

          <div style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.primaryDark})`, borderRadius: 14, padding: "16px 18px", color: "#FFFFFF", marginBottom: 14, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", opacity: 0.75, marginBottom: 6 }}>SALDO TOTAL</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>R$ 31.970,91</div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>3 contas conectadas</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Receitas", value: "R$ 8.2k", color: "#16A34A" },
              { label: "Despesas", value: "R$ 5.1k", color: "#DC2626" },
              { label: "Saldo", value: "+ R$ 3.1k", color: p.primary },
            ].map((k) => (
              <div key={k.label} style={{ background: "#FFFFFF", border: "1px solid #E5EAF2", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 3 }}>{k.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid #E5EAF2", borderRadius: 10, padding: 14, display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="86" height="86" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" fill="none" stroke="#F1F5F9" strokeWidth="10" />
              <circle cx="40" cy="40" r="30" fill="none" stroke={p.primary} strokeWidth="10" strokeDasharray="80 110" strokeDashoffset="0" transform="rotate(-90 40 40)" />
              <circle cx="40" cy="40" r="30" fill="none" stroke={p.accent} strokeWidth="10" strokeDasharray="50 140" strokeDashoffset="-80" transform="rotate(-90 40 40)" />
              <circle cx="40" cy="40" r="30" fill="none" stroke="#94A3B8" strokeWidth="10" strokeDasharray="30 160" strokeDashoffset="-130" transform="rotate(-90 40 40)" />
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0B1220", marginBottom: 8 }}>Top categorias</div>
              {[
                { c: p.primary, label: "Mercado", v: "R$ 1.840" },
                { c: p.accent, label: "Casa", v: "R$ 1.150" },
                { c: "#94A3B8", label: "Lazer", v: "R$ 690" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: row.c }} />
                  <span style={{ flex: 1, color: "#64748B" }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: "#0B1220" }}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Mockup mobile flutuando. Vai sobreposto ao mockup desktop. */
function MobileMockup({ p, font }: { p: Palette; font: string }) {
  return (
    <div
      style={{
        position: "absolute", left: "-50px", bottom: "-30px",
        background: "#0B1220", padding: 6, borderRadius: 28,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 2px #1E293B",
        transform: "perspective(1500px) rotateY(8deg) rotateX(-2deg)",
        fontFamily: font,
      }}
    >
      <div style={{ background: "#FFFFFF", borderRadius: 22, width: 200, height: 380, overflow: "hidden", position: "relative" }}>
        {/* Notch */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 80, height: 18, background: "#0B1220", borderRadius: "0 0 12px 12px" }} />

        {/* Conteúdo */}
        <div style={{ padding: "30px 14px 14px" }}>
          <div style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Família Pontes</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0B1220", marginBottom: 12 }}>R$ 12.480</div>

          <div style={{ background: p.primarySoft, borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: p.primary, fontWeight: 700, marginBottom: 4 }}>RATEIO PENDENTE</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#0B1220" }}>Conta de luz · R$ 240</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <PontesButton p={p} font={font} variant="primary" size="xs" fullWidth>Aprovar</PontesButton>
              <PontesButton p={p} font={font} variant="outline" size="xs" fullWidth>Negar</PontesButton>
            </div>
          </div>

          <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", marginBottom: 6, letterSpacing: "0.08em" }}>HOJE</div>
          {[
            { label: "Mercado Pão de Açúcar", v: "- R$ 142", c: "#DC2626" },
            { label: "Salário Gustavo", v: "+ R$ 4.200", c: "#16A34A" },
            { label: "Netflix", v: "- R$ 55,90", c: "#DC2626" },
          ].map((tx, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < 2 ? "1px solid #F1F5F9" : "none" }}>
              <div style={{ fontSize: 10, color: "#0B1220" }}>{tx.label}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: tx.c }}>{tx.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Ilustração abstrata. */
/** Ilustração abstrata de feature (rateio, familia, etc). */
export function FeatureIllustration({ kind, p }: { kind: string; p: Palette }) {
  const stroke = p.primary, fill = p.primarySoft
  switch (kind) {
    case "rateio": return (
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
        <circle cx="20" cy="32" r="14" fill={fill} stroke={stroke} strokeWidth="2.2" />
        <circle cx="44" cy="32" r="14" fill={p.accentSoft} stroke={p.accent} strokeWidth="2.2" />
        <path d="M28 32 L36 32" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    )
    case "familia": return (
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
        <circle cx="22" cy="22" r="8" fill={fill} stroke={stroke} strokeWidth="2.2" />
        <circle cx="42" cy="22" r="8" fill={p.accentSoft} stroke={p.accent} strokeWidth="2.2" />
        <path d="M14 50 Q14 38 22 38 Q30 38 30 50" fill={fill} stroke={stroke} strokeWidth="2.2" />
        <path d="M34 50 Q34 38 42 38 Q50 38 50 50" fill={p.accentSoft} stroke={p.accent} strokeWidth="2.2" />
      </svg>
    )
    case "visao": return (
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
        <rect x="8" y="14" width="48" height="36" rx="4" fill={fill} stroke={stroke} strokeWidth="2.2" />
        <path d="M14 40 L22 28 L30 34 L40 22 L50 30" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <circle cx="40" cy="22" r="2.5" fill={p.accent} />
      </svg>
    )
    case "cartao": return (
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
        <rect x="8" y="18" width="48" height="32" rx="4" fill={fill} stroke={stroke} strokeWidth="2.2" />
        <rect x="8" y="24" width="48" height="6" fill={stroke} />
        <rect x="14" y="38" width="14" height="3" rx="1" fill={p.accent} />
      </svg>
    )
    case "recorrente": return (
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
        <path d="M20 22 A14 14 0 1 1 18 42" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M18 16 L18 24 L26 24" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="32" cy="32" r="6" fill={p.accent} />
      </svg>
    )
    case "metas": return (
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="20" fill={fill} stroke={stroke} strokeWidth="2.2" />
        <circle cx="32" cy="32" r="12" fill="none" stroke={stroke} strokeWidth="2.2" />
        <circle cx="32" cy="32" r="4" fill={p.accent} />
      </svg>
    )
    default: return null
  }
}

// =============================================================================
// GRÁFICOS INLINE (SVG, sem libs)
// =============================================================================

/** Bar chart real via recharts. */
function BarChartReal({ p, data, height = 160 }: { p: Palette; data: { label: string; v: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 6" stroke={p.border} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: p.textMuted }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: p.textMuted }} axisLine={false} tickLine={false} width={42} tickFormatter={(v: number) => `R$ ${v}k`} />
        <Tooltip
          cursor={{ fill: p.primarySoft, opacity: 0.5 }}
          contentStyle={{ background: p.text, border: "none", borderRadius: 10, fontSize: 12, color: "#FFFFFF", padding: "10px 12px" }}
          labelStyle={{ color: "#FFFFFF", fontWeight: 700, marginBottom: 4 }}
          itemStyle={{ color: "#FFFFFF" }}
          formatter={(v) => [`R$ ${Number(v).toFixed(1)}k`, "Gasto"]}
        />
        <Bar dataKey="v" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === data.length - 1 ? p.accent : p.primary} />
          ))}
        </Bar>
      </RBarChart>
    </ResponsiveContainer>
  )
}

/** Area chart real via recharts com gradiente. */
function LineAreaChartReal({ p, data, height = 160 }: { p: Palette; data: { label: string; v: number }[]; height?: number }) {
  const gradId = `area-${useId().replace(/[:]/g, "")}`
  const fmt = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v.toFixed(0)}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={p.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke={p.border} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: p.textMuted }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: p.textMuted }} axisLine={false} tickLine={false} width={42} tickFormatter={fmt} />
        <Tooltip
          contentStyle={{ background: p.text, border: "none", borderRadius: 10, fontSize: 12, color: "#FFFFFF", padding: "10px 12px" }}
          labelStyle={{ color: "#FFFFFF", fontWeight: 700, marginBottom: 4 }}
          itemStyle={{ color: "#FFFFFF" }}
          formatter={(v) => [fmt(Number(v)), "Saldo"]}
        />
        <Area type="monotone" dataKey="v" stroke={p.primary} strokeWidth={2.5} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 5, fill: p.accent, stroke: "#FFFFFF", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Line chart real com 2 séries (atual sólido + comparativo tracejado), sem dots, hover rico. */

// =============================================================================
// LIVE ACTIVITY FEED — notificações entrando ao vivo
// =============================================================================
function LiveActivity({ p, font }: { p: Palette; font: string }) {
  const items = useMemo(() => ([
    { icon: "💸", title: "Maria adicionou despesa", sub: "Mercado · R$ 142,30", time: "agora", color: p.primary },
    { icon: "✓", title: "Aprovou rateio", sub: "Conta de luz · 60/40", time: "1min", color: "#10B981" },
    { icon: "💼", title: "Salário recebido", sub: "Itaú · R$ 4.200,00", time: "3min", color: "#10B981" },
    { icon: "🎯", title: "Meta atingida", sub: "Reserva de emergência · 92%", time: "12min", color: p.accent },
    { icon: "⚠", title: "Limite do cartão", sub: "Nubank · 85% usado", time: "1h", color: "#F59E0B" },
    { icon: "📊", title: "Relatório mensal", sub: "Pronto pra revisar", time: "2h", color: p.primary },
  ]), [p.primary, p.accent])
  const [list, setList] = useState(items.slice(0, 4))

  // Cicla itens a cada 3.5s
  useEffect(() => {
    let i = 4
    const id = setInterval(() => {
      setList((prev) => [items[i % items.length], ...prev.slice(0, 3)])
      i++
    }, 3500)
    return () => clearInterval(id)
  }, [items])

  return (
    <section style={{ padding: "120px 48px", background: p.bg, position: "relative", overflow: "hidden" }}>
      <MeshGradient c1={p.primary} c2={p.accent} c3={p.primary} />
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 14 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <PulseDot color={p.accent} /> Ao vivo
              </span>
            </div>
            <h2 style={{ fontSize: 44, fontWeight: 800, color: p.text, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.05, marginBottom: 20 }}>
              Sua família, <span style={{ color: p.primary }}>em tempo real</span>
            </h2>
            <p style={{ fontSize: 18, color: p.textMuted, lineHeight: 1.5, marginBottom: 28 }}>
              Cada despesa, aprovação, meta atingida — todo mundo vê na hora. Sem planilha, sem WhatsApp, sem &quot;achismo&quot;.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
              {[
                { n: 6, l: "membros ativos" },
                { n: 247, l: "transações esse mês" },
                { n: 18, l: "aprovações pendentes resolvidas" },
                { n: 3, l: "metas conjuntas" },
              ].map((s) => (
                <div key={s.l} style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: p.primary, letterSpacing: "-0.02em" }}>
                    <AnimatedNumber value={s.n} />
                  </div>
                  <div style={{ fontSize: 12, color: p.textMuted, fontWeight: 500 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 22, padding: 24, boxShadow: "0 30px 60px -20px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>Feed da família</div>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "#10B981" }}>
                <PulseDot color="#10B981" /> AO VIVO
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {list.map((it, i) => (
                <div key={it.title + i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  background: i === 0 ? p.primarySoft : p.bg,
                  border: `1px solid ${i === 0 ? p.primary + "40" : p.border}`,
                  borderRadius: 12, fontFamily: font,
                  animation: i === 0 ? "bp-slide-in 400ms ease-out" : undefined,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: it.color, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{it.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{it.title}</div>
                    <div style={{ fontSize: 11, color: p.textMuted }}>{it.sub}</div>
                  </div>
                  <div style={{ fontSize: 11, color: p.textMuted, fontWeight: 500 }}>{it.time}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// =============================================================================
// SECTION "VEJA POR DENTRO" com tabs
// =============================================================================
function InsideTabs({ p, font }: { p: Palette; font: string }) {
  const [tab, setTab] = useState<"transacoes" | "cartao" | "familia">("transacoes")

  return (
    <section style={{ padding: "120px 48px", background: p.surface }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 14 }}>Veja por dentro</div>
          <h2 style={{ fontSize: 44, fontWeight: 800, color: p.text, margin: 0, letterSpacing: "-0.025em" }}>
            Cada tela <span style={{ color: p.primary }}>pensada</span> pra família brasileira
          </h2>
        </div>

        {/* Tabs — biblioteca Pontes */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
          <PontesTabs<"transacoes" | "cartao" | "familia">
            p={p} font={font}
            value={tab}
            onChange={setTab}
            options={[
              { value: "transacoes", label: "Transações" },
              { value: "cartao", label: "Cartão" },
              { value: "familia", label: "Família" },
            ]}
          />
        </div>

        {/* Conteúdo */}
        <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 22, padding: 32 }}>
          {tab === "transacoes" && <TabTransacoes p={p} font={font} />}
          {tab === "cartao" && <TabCartao p={p} font={font} />}
          {tab === "familia" && <TabFamilia p={p} font={font} />}
        </div>
      </div>
    </section>
  )
}

function TabTransacoes({ p, font }: { p: Palette; font: string }) {
  const txs = [
    { date: "20/05", icon: "🛒", label: "Mercado Pão de Açúcar", category: "Mercado", value: -142.30, account: "Nubank", member: "G" },
    { date: "20/05", icon: "💼", label: "Salário Gustavo", category: "Renda", value: 4200.00, account: "Itaú", member: "G" },
    { date: "19/05", icon: "🎬", label: "Netflix", category: "Lazer", value: -55.90, account: "Nubank", member: "G" },
    { date: "19/05", icon: "⚡", label: "Conta de Luz · rateada", category: "Casa", value: -240.00, account: "Itaú", member: "G+M" },
    { date: "18/05", icon: "🍕", label: "iFood", category: "Alimentação", value: -68.50, account: "Nubank", member: "M" },
    { date: "18/05", icon: "💼", label: "Salário Maria", category: "Renda", value: 3800.00, account: "BB", member: "M" },
  ]

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, fontFamily: font }}>
      <div style={{ background: p.surface, borderRadius: 14, border: `1px solid ${p.border}`, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${p.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>Transações recentes</div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ background: p.primarySoft, color: p.primary, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Tudo</span>
            <span style={{ color: p.textMuted, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>Despesa</span>
            <span style={{ color: p.textMuted, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>Receita</span>
          </div>
        </div>
        <div>
          {txs.map((tx, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < txs.length - 1 ? `1px solid ${p.border}` : "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: p.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{tx.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: p.text }}>{tx.label}</div>
                <div style={{ fontSize: 11, color: p.textMuted, marginTop: 2 }}>{tx.date} · {tx.category} · {tx.account}</div>
              </div>
              <div style={{ background: p.accentSoft, color: p.text, padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{tx.member}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: tx.value > 0 ? "#16A34A" : "#DC2626", minWidth: 90, textAlign: "right" }}>
                {tx.value > 0 ? "+ " : "- "}R$ {Math.abs(tx.value).toFixed(2).replace(".", ",")}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: p.surface, borderRadius: 14, border: `1px solid ${p.border}`, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Evolução do saldo</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: p.text, marginBottom: 4 }}>R$ 31.970</div>
          <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 600, marginBottom: 12 }}>↑ 12,4% vs mês anterior</div>
          <LineAreaChartReal p={p} data={[
            { label: "S1", v: 29800 }, { label: "S2", v: 30420 }, { label: "S3", v: 29950 }, { label: "S4", v: 30880 },
            { label: "S5", v: 31200 }, { label: "S6", v: 31040 }, { label: "S7", v: 31650 }, { label: "S8", v: 31970 },
          ]} height={120} />
        </div>
        <div style={{ background: p.surface, borderRadius: 14, border: `1px solid ${p.border}`, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Gastos por mês</div>
          <BarChartReal p={p} data={[
            { label: "Dez", v: 6.8 }, { label: "Jan", v: 5.4 }, { label: "Fev", v: 4.6 }, { label: "Mar", v: 5.0 }, { label: "Abr", v: 4.8 }, { label: "Mai", v: 5.4 },
          ]} height={120} />
        </div>
      </div>
    </div>
  )
}

function TabCartao({ p, font }: { p: Palette; font: string }) {
  const fatura = [
    { d: "20/05", label: "Amazon", v: 89.90, cat: "Compras" },
    { d: "19/05", label: "Uber", v: 24.50, cat: "Transporte" },
    { d: "18/05", label: "iFood", v: 68.50, cat: "Alimentação" },
    { d: "17/05", label: "Spotify", v: 21.90, cat: "Assinatura" },
    { d: "15/05", label: "Shopee · 3x", v: 120.00, cat: "Compras" },
  ]
  const total = fatura.reduce((s, t) => s + t.v, 0)

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24, fontFamily: font }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Card visual */}
        <div style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.primaryDark})`, borderRadius: 18, padding: 24, color: "#FFFFFF", aspectRatio: "1.586/1", position: "relative", boxShadow: "0 20px 40px -10px rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: "0.1em", fontWeight: 700 }}>NUBANK · GOLD</div>
          <div style={{ position: "absolute", bottom: 20, left: 24 }}>
            <div style={{ fontSize: 14, letterSpacing: "0.2em", fontWeight: 700, marginBottom: 4 }}>•••• 4218</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>GUSTAVO N PONTES</div>
          </div>
          <div style={{ position: "absolute", top: 24, right: 24, width: 38, height: 28, background: "rgba(255,255,255,0.2)", borderRadius: 4 }} />
        </div>

        {/* Limite */}
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: p.textMuted, fontWeight: 600 }}>Limite usado</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: p.text }}>R$ {total.toFixed(0)} / R$ 4.000</span>
          </div>
          <div style={{ height: 8, background: p.bg, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(total / 4000) * 100}%`, height: "100%", background: p.primary, borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11, color: p.textMuted }}>
            <span>Fecha em 18 dias</span>
            <span>Vence 10/06</span>
          </div>
        </div>

        {/* Status */}
        <div style={{ background: p.accentSoft, border: `1px solid ${p.accent}`, borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.accent }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: p.text }}>Fatura aberta</span>
          </div>
          <div style={{ fontSize: 11, color: p.textMuted, marginTop: 4 }}>Você pode pagar parcial ou esperar fechar.</div>
        </div>
      </div>

      <div style={{ background: p.surface, borderRadius: 14, border: `1px solid ${p.border}`, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${p.border}` }}>
          <div style={{ fontSize: 13, color: p.textMuted, marginBottom: 4 }}>Fatura atual · maio</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: p.text, letterSpacing: "-0.02em" }}>R$ {total.toFixed(2).replace(".", ",")}</div>
        </div>
        {fatura.map((tx, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: i < fatura.length - 1 ? `1px solid ${p.border}` : "none" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: p.text }}>{tx.label}</div>
              <div style={{ fontSize: 11, color: p.textMuted, marginTop: 2 }}>{tx.d} · {tx.cat}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>R$ {tx.v.toFixed(2).replace(".", ",")}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabFamilia({ p, font }: { p: Palette; font: string }) {
  const members = [
    { name: "Gustavo Pontes", role: "Administrador", avatar: "GP", color: p.primary, balance: "+ R$ 18.400" },
    { name: "Maria Silva", role: "Parceira", avatar: "MS", color: p.accent, balance: "+ R$ 13.570" },
    { name: "Lucas Pontes", role: "Dependente · 16 anos", avatar: "LP", color: "#94A3B8", balance: "R$ 250" },
  ]

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24, fontFamily: font }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Família Pontes</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: p.text, letterSpacing: "-0.02em", marginBottom: 4 }}>R$ 32.220</div>
          <div style={{ fontSize: 12, color: p.textMuted }}>3 membros · 4 contas conectadas</div>
        </div>

        {members.map((m) => (
          <div key={m.name} style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: m.color, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{m.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{m.name}</div>
              <div style={{ fontSize: 11, color: p.textMuted }}>{m.role}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{m.balance}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>Despesas para aprovar</div>
            <span style={{ background: p.accent, color: "#0B1220", padding: "2px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800 }}>2 PENDENTES</span>
          </div>
          {[
            { label: "Conta de luz", v: 240.00, by: "Gustavo", split: "50/50" },
            { label: "Mercado mensal", v: 1200.00, by: "Maria", split: "60/40" },
          ].map((d, i) => (
            <div key={i} style={{ padding: "12px 0", borderTop: i > 0 ? `1px solid ${p.border}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: p.text }}>{d.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>R$ {d.v.toFixed(2).replace(".", ",")}</div>
              </div>
              <div style={{ fontSize: 11, color: p.textMuted, marginBottom: 8 }}>Lançada por {d.by} · rateio {d.split}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <PontesButton p={p} font={font} variant="primary" size="sm" fullWidth>Aprovar</PontesButton>
                <PontesButton p={p} font={font} variant="outline" size="sm" fullWidth>Negar</PontesButton>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: p.text, marginBottom: 14 }}>Acerto do mês</div>
          <div style={{ background: p.primarySoft, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: p.primary, fontWeight: 700, marginBottom: 4 }}>MARIA DEVE A GUSTAVO</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: p.text, letterSpacing: "-0.02em" }}>R$ 180,00</div>
            <div style={{ fontSize: 11, color: p.textMuted, marginTop: 4 }}>Referente a 3 despesas compartilhadas</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// LANDING
// =============================================================================
// NavbarFloating removido (#77) — migrado pra <PontesNavbar> da biblioteca @/components/pontes.

/** Bloco de feature zig-zag (texto + mockup alternando lado). */
function FeatureBlock({ p, font, reverse, tag, title, text, mockup }: { p: Palette; font: string; reverse: boolean; tag: string; title: string; text: string; mockup: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center", padding: "60px 0", direction: reverse ? "rtl" : "ltr" }}>
      <div style={{ direction: "ltr" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 18 }}>{tag}</div>
        <h3 style={{ fontSize: 40, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 20, fontFamily: "'Fraunces', serif" }}>{title}</h3>
        <p style={{ fontSize: 17, color: p.textMuted, lineHeight: 1.6, margin: 0, marginBottom: 24 }}>{text}</p>
        <PontesLink p={p} font={font} style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          Saiba mais <ArrowRight size={14} strokeWidth={2.5} />
        </PontesLink>
      </div>
      <div style={{ direction: "ltr", display: "flex", justifyContent: "center" }}>
        {mockup}
      </div>
    </div>
  )
}

/** Mockup do rateio (Conta de luz). */
function RateioMockup({ p, font }: { p: Palette; font: string }) {
  return (
    <div style={{ position: "relative", width: 420, fontFamily: font }}>
      {/* Card principal */}
      <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 18, padding: 24, boxShadow: "0 24px 60px -20px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: p.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>Conta de luz</div>
              <div style={{ fontSize: 11, color: p.textMuted }}>Maio · vence 25/05</div>
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: p.text }}>R$ 240,00</div>
        </div>
        <div style={{ borderTop: `1px solid ${p.border}`, paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Rateio</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 6, background: p.primary, color: "#FFFFFF", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&auto=format&fit=crop&q=80" alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", border: "1.5px solid rgba(255,255,255,0.5)" }} />
                <span style={{ fontSize: 11, opacity: 0.85 }}>Gustavo · 60%</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>R$ 144</div>
            </div>
            <div style={{ flex: 4, background: p.accent, color: "#0B1220", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&auto=format&fit=crop&q=80" alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", border: "1.5px solid rgba(11,18,32,0.3)" }} />
                <span style={{ fontSize: 11, opacity: 0.85 }}>Maria · 40%</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>R$ 96</div>
            </div>
          </div>
        </div>
      </div>
      {/* Mini card flutuante */}
      <div style={{ position: "absolute", top: -20, right: -40, background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: "12px 14px", boxShadow: "0 18px 40px -10px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#10B981", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
          MARIA APROVOU
        </div>
        <div style={{ fontSize: 11, color: p.textMuted }}>Há 2 minutos</div>
      </div>
    </div>
  )
}

/** Mockup da família — membros com avatares. */
function FamiliaMockup({ p, font }: { p: Palette; font: string }) {
  const members = [
    { name: "Gustavo", role: "Admin", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&auto=format&fit=crop&q=80", saldo: "R$ 18.4k" },
    { name: "Maria", role: "Parceira", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&auto=format&fit=crop&q=80", saldo: "R$ 13.6k" },
    { name: "Lucas (16)", role: "Dependente", photo: "https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=120&h=120&auto=format&fit=crop&q=80", saldo: "R$ 250" },
    { name: "Pedro (CPA)", role: "Contador", photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&auto=format&fit=crop&q=80", saldo: "—" },
  ]
  return (
    <div style={{ position: "relative", width: 420, fontFamily: font }}>
      <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 18, padding: 24, boxShadow: "0 24px 60px -20px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: p.textMuted, textTransform: "uppercase" }}>Família Pontes</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: p.text, marginTop: 4, letterSpacing: "-0.02em" }}>R$ 32.220</div>
          </div>
          <PontesButton p={p} font={font} variant="primary" size="sm" iconStart={<Plus size={14} strokeWidth={2.5} />}>Convidar</PontesButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((m) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: p.bg, borderRadius: 12 }}>
              <div style={{ position: "relative", width: 32, height: 32 }}>
                <img src={m.photo} alt={m.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", display: "block" }} />
                <span style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: "#10B981", border: `2px solid ${p.bg}` }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{m.name}</div>
                <div style={{ fontSize: 10, color: p.textMuted }}>{m.role}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.text }}>{m.saldo}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Mockup do cartão — fatura + limite. */
function CartaoMockup({ p, font }: { p: Palette; font: string }) {
  return (
    <div style={{ position: "relative", width: 420, fontFamily: font }}>
      {/* Cartão visual */}
      <div style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.primaryDark})`, borderRadius: 16, padding: 22, color: "#FFFFFF", aspectRatio: "1.586/1", position: "relative", boxShadow: "0 20px 50px -10px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: "0.12em", fontWeight: 700 }}>NUBANK · GOLD</div>
        <div style={{ position: "absolute", bottom: 20, left: 22 }}>
          <div style={{ fontSize: 16, letterSpacing: "0.2em", fontWeight: 700, marginBottom: 4 }}>•••• 4218</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>GUSTAVO N PONTES</div>
        </div>
        <div style={{ position: "absolute", top: 22, right: 22, width: 36, height: 26, background: "rgba(255,255,255,0.2)", borderRadius: 4 }} />
      </div>
      {/* Fatura sobreposta */}
      <div style={{ position: "absolute", bottom: -40, right: -30, background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 16, boxShadow: "0 24px 50px -10px rgba(0,0,0,0.25)", width: 220 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Fatura aberta</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: p.text, marginBottom: 12 }}>R$ 4.456,30</div>
        <div style={{ height: 6, background: p.bg, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ width: "55%", height: "100%", background: p.primary }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: p.textMuted }}>
          <span>Fecha em 18d</span>
          <span style={{ fontWeight: 700, color: p.text }}>55% limite</span>
        </div>
      </div>
    </div>
  )
}

/** CTA flutuante fixo no canto inferior direito. */
function FloatCTA({ p, font }: { p: Palette; font: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  // Wrapper fixed pra animação show/hide; PontesButton dentro pra hover/active automáticos.
  return (
    <div
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 999,
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(20px)",
        pointerEvents: show ? "auto" : "none",
        transition: "opacity 300ms ease, transform 300ms ease",
      }}
    >
      <PontesButton
        p={p} font={font}
        variant="accent" size="md"
        iconStart={<span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0B1220", display: "inline-block" }} />}
      >
        Criar conta grátis
      </PontesButton>
    </div>
  )
}

/** Barra de progresso de scroll no topo absoluto. */
function ScrollProgressBar({ p }: { p: Palette }) {
  const progress = useScrollProgress()
  // Sempre no topo do viewport — o control bar (em flow) rola junto com a página.
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, background: "transparent", zIndex: 999 }}>
      <div style={{ height: "100%", width: `${progress * 100}%`, background: `linear-gradient(90deg, ${p.primary}, ${p.accent})`, transition: "width 80ms linear" }} />
    </div>
  )
}

function Landing({ p, font, topOffset = 0 }: { p: Palette; font: string; topOffset?: number }) {
  const [annual, setAnnual] = useState(true)
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: font, color: p.text, background: p.surface, position: "relative" }}>
      <GlobalAnims />
      {/* TOPBAR PROMOCIONAL — topo da Landing (relativo ao container). */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: `linear-gradient(90deg, ${p.primary}, ${p.accent}, ${p.primary})`, color: "#FFFFFF", padding: "10px 24px", textAlign: "center", fontSize: 13, fontWeight: 600, letterSpacing: "0.01em", zIndex: 5 }}>
        ✦ Beta aberto · vagas limitadas pra famílias brasileiras · <span style={{ textDecoration: "underline" }}>quero entrar →</span>
      </div>

      {/* NAVBAR pill — abaixo do brand preview + topbar promo. Scrolled: abaixo só do brand preview. */}
      <PontesNavbar p={p} font={font} activePath="/site" onNavigate={(to) => navigate(to)} topOffset={topOffset + 50} scrolledTop={topOffset + 16} />

      {/* HERO com mesh animado + noise + headline typing */}
      <section style={{ background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primaryDark} 100%)`, padding: "180px 48px 160px", color: p.heroFg, position: "relative", overflow: "hidden" }}>
        <GridPattern color={p.heroFg} opacity={0.08} />
        <MeshGradientAnimated c1={p.accent} c2={p.primary} c3={p.accent} />
        <div className="bp-noise" />

        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 56, alignItems: "center", position: "relative", zIndex: 1 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 28 }}>
              <PulseDot color={p.accent} />
              Beta aberto · vagas limitadas
            </div>

            <h1 style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.035em", margin: 0, marginBottom: 28, fontFamily: "'Fraunces', serif" }}>
              Finanças pra{" "}
              <TypingWord
                words={["casal", "família", "contador", "você"]}
                color={p.accent}
              />
              <br />
              <em style={{
                fontStyle: "italic", fontFamily: "'Instrument Serif', serif", fontWeight: 400,
                color: p.accent,
              }}>
                sem briga
              </em>{" "}
              e sem planilha.
            </h1>
            <p style={{ fontSize: 21, opacity: 0.88, lineHeight: 1.5, marginBottom: 40, maxWidth: 520 }}>
              Conecte bancos, divida despesas com seu parceiro e abra acesso pro seu contador. Um produto, uma família, uma fonte da verdade.
            </p>

            <div style={{ display: "flex", gap: 12, marginBottom: 40 }}>
              <PontesButton
                p={p} font={font}
                variant="accent" size="lg"
                iconEnd={<ArrowRight size={16} strokeWidth={2.5} />}
                onClick={() => navigate("/auth/register")}
              >
                Criar conta grátis
              </PontesButton>
              <PontesButton
                p={p} font={font}
                variant="outline-light" size="lg"
                iconStart={<Play size={14} strokeWidth={2.5} />}
              >
                Ver demo 90s
              </PontesButton>
            </div>

            <div style={{ display: "flex", gap: 28, fontSize: 13, opacity: 0.85 }}>
              {["Grátis pra começar", "Sem cartão", "Casal incluído"].map((t) => (
                <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckIcon color={p.accent} /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Mockups com glow + toast */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 480 }}>
            {/* Glow pulsando */}
            <div style={{ position: "absolute", inset: -40, background: `radial-gradient(ellipse at center, ${p.accent}55 0%, transparent 60%)`, filter: "blur(40px)", animation: "bp-glow 4s ease-in-out infinite", pointerEvents: "none" }} />
            <DesktopMockup p={p} font={font} />
            <MobileMockup p={p} font={font} />

            {/* Floating toast */}
            <div style={{
              position: "absolute", top: 30, right: -20, background: "#FFFFFF", borderRadius: 12,
              boxShadow: "0 18px 40px -10px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.05)",
              padding: "14px 18px", minWidth: 240, fontFamily: font,
              animation: "bp-toast-in 600ms ease-out 600ms backwards",
              transform: "perspective(1500px) rotateY(-6deg) rotateX(2deg)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✓</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0B1220" }}>Maria aprovou despesa</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Conta de luz · R$ 240,00</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BANNER com números animados */}
      <section style={{ padding: "64px 48px", background: p.surface, borderBottom: `1px solid ${p.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          <Reveal delay={0}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: p.primary, letterSpacing: "-0.03em", marginBottom: 4 }}>
                <AnimatedNumber value={10} suffix="×" />
              </div>
              <div style={{ fontSize: 13, color: p.textMuted, fontWeight: 500 }}>Mais rápido que planilha</div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: p.primary, letterSpacing: "-0.03em", marginBottom: 4 }}>
                R$ <AnimatedNumber value={1.2} decimals={1} suffix="bi" />
              </div>
              <div style={{ fontSize: 13, color: p.textMuted, fontWeight: 500 }}>Em despesas organizadas</div>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: p.primary, letterSpacing: "-0.03em", marginBottom: 4 }}>
                <AnimatedNumber value={98} suffix="%" />
              </div>
              <div style={{ fontSize: 13, color: p.textMuted, fontWeight: 500 }}>Casais recomendam</div>
            </div>
          </Reveal>
          <Reveal delay={300}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: p.primary, letterSpacing: "-0.03em", marginBottom: 4 }}>
                &lt;<AnimatedNumber value={2} />min
              </div>
              <div style={{ fontSize: 13, color: p.textMuted, fontWeight: 500 }}>Pra criar conta</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SOCIAL PROOF — MARQUEE INFINITO DE BANCOS */}
      <section style={{ padding: "48px 0", background: p.bg, overflow: "hidden", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.textMuted, textTransform: "uppercase" }}>
            Conecta com os bancos que você já usa
          </div>
        </div>
        {/* Marquee — duplica conteúdo pra loop seamless */}
        <div style={{ position: "relative" }}>
          <div className="bp-marquee-track" style={{ display: "flex", gap: 48, width: "max-content" }}>
            {[...Array(2)].map((_, k) => (
              <div key={k} style={{ display: "flex", gap: 48, alignItems: "center", paddingLeft: 24 }}>
                {["Nubank", "Itaú", "Bradesco", "Santander", "Banco do Brasil", "Inter", "C6 Bank", "Caixa", "BTG Pactual", "Will Bank"].map((b) => (
                  <div key={b + k} style={{ fontWeight: 700, fontSize: 22, color: p.text, fontFamily: font, letterSpacing: "-0.01em", opacity: 0.45, whiteSpace: "nowrap" }}>{b}</div>
                ))}
              </div>
            ))}
          </div>
          {/* Fade nas bordas */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 100, background: `linear-gradient(to right, ${p.bg}, transparent)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 100, background: `linear-gradient(to left, ${p.bg}, transparent)`, pointerEvents: "none" }} />
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section style={{ padding: "120px 48px", background: p.surface }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 72 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 18 }}>Como funciona</div>
            <h2 style={{ fontSize: 52, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05, fontFamily: "'Fraunces', serif" }}>
              3 passos. <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>Nada de planilha.</em>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {[
              { n: "01", t: "Conecte seus bancos", d: "Via Open Finance autorizado pelo BCB. Transações chegam sozinhas, sem digitação." },
              { n: "02", t: "Convide sua família", d: "Parceiro, filhos, contador. Cada um com papel próprio e privacidade respeitada." },
              { n: "03", t: "Acompanhe junto", d: "Visão única ou família. Rateio claro. Aprovação de despesa. Tudo num só lugar." },
            ].map((step) => (
              <SpotlightCard key={step.n} spotColor={`${p.primary}22`} style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 22, padding: 32 }}>
                <div style={{ fontSize: 72, fontWeight: 900, color: p.primary, opacity: 0.12, lineHeight: 1, letterSpacing: "-0.04em", marginBottom: 16 }}>{step.n}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: p.text, marginBottom: 10, letterSpacing: "-0.01em" }}>{step.t}</div>
                <div style={{ fontSize: 15, color: p.textMuted, lineHeight: 1.6 }}>{step.d}</div>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION HUMANA — foto de família grande */}
      <section style={{ padding: "120px 48px", background: p.surface }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 64, alignItems: "center" }}>
          <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", aspectRatio: "4/5", boxShadow: "0 30px 60px -20px rgba(0,0,0,0.18)" }}>
            <img
              src="https://images.unsplash.com/photo-1609220136736-443140cffec6?w=900&auto=format&fit=crop&q=80"
              alt="Família brasileira"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {/* Card flutuante sobre foto */}
            <div style={{ position: "absolute", bottom: 24, left: 24, right: 24, background: "rgba(255,255,255,0.95)", padding: 18, borderRadius: 16, fontFamily: font, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex" }}>
                {[
                  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&auto=format&fit=crop&q=80",
                  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&auto=format&fit=crop&q=80",
                  "https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=120&h=120&auto=format&fit=crop&q=80",
                ].map((src, i) => (
                  <img key={i} src={src} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", marginLeft: i > 0 ? -10 : 0, border: "3px solid #FFFFFF" }} />
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: p.textMuted }}>Família Pontes</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>3 membros · ativos hoje</div>
              </div>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 18 }}>POR QUE FAMÍLIA</div>
            <h2 style={{ fontSize: 52, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: 24, fontFamily: "'Fraunces', serif" }}>
              Família brasileira não é{" "}
              <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>uma planilha</em>
            </h2>
            <p style={{ fontSize: 17, color: p.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
              Casal, dependentes, contador — cada um com sua parte na história. Aplicativos foram feitos pra solteiro. Pontes foi pensado pra família brasileira de verdade.
            </p>
            <p style={{ fontSize: 17, color: p.textMuted, lineHeight: 1.6 }}>
              Sem complicar. Sem expor o que ninguém precisa ver. Com respeito ao que cada um decide compartilhar.
            </p>
          </div>
        </div>
      </section>

      {/* LIVE ACTIVITY FEED */}
      <LiveActivity p={p} font={font} />

      {/* VEJA POR DENTRO — TABS INTERATIVAS */}
      <InsideTabs p={p} font={font} />

      {/* FEATURES — 3 blocos alternados (Monarch style) */}
      <section style={{ padding: "120px 48px", background: p.bg }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 80, maxWidth: 720, marginInline: "auto" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 14 }}>O que é Pontes</div>
            <h2 style={{ fontSize: 52, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: 16, fontFamily: "'Fraunces', serif" }}>
              Sua família, sua grana,<br />
              <em style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontStyle: "italic", color: p.primary }}>no mesmo lugar</em>
            </h2>
          </div>

          {/* Bloco 1 — Rateio (texto esq + mockup dir) */}
          <FeatureBlock p={p} font={font} reverse={false}
            tag="RATEIO"
            title="Cada centavo onde ele deve estar"
            text="A despesa cai 50/50, por porcentagem, valor fixo ou consumo real. Cada um vê o que pagou, o que deve, o que recebe. Sem 'achismo'."
            mockup={<RateioMockup p={p} font={font} />} />

          {/* Bloco 2 — Família (mockup esq + texto dir) */}
          <FeatureBlock p={p} font={font} reverse={true}
            tag="FAMÍLIA"
            title="Cada um vê o que precisa ver"
            text="Convide parceiro, filhos, contador. Cada um com papel próprio e privacidade respeitada. Você decide o que compartilha e o que fica só seu."
            mockup={<FamiliaMockup p={p} font={font} />} />

          {/* Bloco 3 — Cartão (texto esq + mockup dir) */}
          <FeatureBlock p={p} font={font} reverse={false}
            tag="CARTÃO"
            title="Fatura na régua"
            text="Aberta, fechada, paga. Limite real em barra. Pagamento parcial mantido. Cada compra parcelada distribuída automaticamente nas faturas certas."
            mockup={<CartaoMockup p={p} font={font} />} />
        </div>
      </section>

      {/* COMPARATIVO */}
      <section style={{ padding: "120px 48px", background: p.surface }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 18 }}>Comparativo</div>
            <h2 style={{ fontSize: 52, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05, fontFamily: "'Fraunces', serif" }}>
              Por que <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>Pontes</em> e não os outros
            </h2>
          </div>

          <div style={{ overflow: "hidden", borderRadius: 18, border: `1px solid ${p.border}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
              <thead>
                <tr style={{ background: p.bg }}>
                  <th style={{ textAlign: "left", padding: "20px 24px", fontWeight: 600, fontSize: 14, color: p.textMuted }}></th>
                  <th style={{ textAlign: "center", padding: "20px 24px", fontWeight: 800, fontSize: 16, color: p.primary, background: p.primarySoft }}>Pontes</th>
                  <th style={{ textAlign: "center", padding: "20px 24px", fontWeight: 600, fontSize: 14, color: p.textMuted }}>Mobills</th>
                  <th style={{ textAlign: "center", padding: "20px 24px", fontWeight: 600, fontSize: 14, color: p.textMuted }}>Despezzas</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { f: "Conexão Open Finance", a: true, b: false, c: true },
                  { f: "Rateio entre casal", a: true, b: false, c: false },
                  { f: "Aprovação de despesa", a: true, b: false, c: false },
                  { f: "Acesso pra contador", a: true, b: false, c: false },
                  { f: "Visão única ↔ família", a: true, b: false, c: false },
                  { f: "Categorias + subcategorias", a: true, b: true, c: true },
                  { f: "Importação OFX/CSV", a: true, b: true, c: true },
                ].map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${p.border}` }}>
                    <td style={{ padding: "16px 24px", fontSize: 14, color: p.text, fontWeight: 500 }}>{row.f}</td>
                    <td style={{ padding: "16px 24px", textAlign: "center", background: p.primarySoft }}>
                      {row.a ? <CheckIcon color={p.primary} /> : <span style={{ color: p.textMuted, opacity: 0.5 }}>—</span>}
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "center" }}>
                      {row.b ? <CheckIcon color={p.textMuted} /> : <span style={{ color: p.textMuted, opacity: 0.5 }}>—</span>}
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "center" }}>
                      {row.c ? <CheckIcon color={p.textMuted} /> : <span style={{ color: p.textMuted, opacity: 0.5 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* COMUNIDADE — estilo Monarch (foto + 2 cards) */}
      <section style={{ padding: "120px 48px", background: p.bg }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 64, alignItems: "center" }}>
          <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", aspectRatio: "4/5" }}>
            <img
              src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&auto=format&fit=crop&q=80"
              alt="Pessoa sorrindo usando Pontes"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            <div style={{ position: "absolute", bottom: 20, left: 20, background: "rgba(255,255,255,0.95)", padding: "10px 16px", borderRadius: 12, fontFamily: font, fontSize: 13, color: p.text, fontWeight: 600 }}>
              💬 &quot;Mudou nossa rotina financeira em 2 semanas&quot;
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: 52, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: 32, fontFamily: "'Fraunces', serif" }}>
              Comunidade Pontes
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 18, padding: 24, fontFamily: font }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: p.text, marginBottom: 8 }}>WhatsApp BR</div>
                <p style={{ fontSize: 14, color: p.textMuted, lineHeight: 1.55, margin: 0, marginBottom: 18 }}>
                  Entre na nossa comunidade brasileira no WhatsApp. Famílias trocando dicas, primeiros usuários do beta.
                </p>
                <PontesButton p={p} font={font} variant="outline" size="sm">Entrar</PontesButton>
              </div>
              <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 18, padding: 24, fontFamily: font }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: p.text, marginBottom: 8 }}>Blog</div>
                <p style={{ fontSize: 14, color: p.textMuted, lineHeight: 1.55, margin: 0, marginBottom: 18 }}>
                  Artigos sobre finanças de casal, dependentes, como conversar com contador sem trauma.
                </p>
                <PontesButton p={p} font={font} variant="outline" size="sm">Ler agora</PontesButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS GRID */}
      <section style={{ padding: "120px 48px", background: p.bg }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 18 }}>Quem usa, fala</div>
            <h2 style={{ fontSize: 52, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05, fontFamily: "'Fraunces', serif" }}>
              Famílias reais. <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>Resultados reais.</em>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {[
              { name: "Ricardo Moraes", role: "Casal · SP", quote: "Eu e minha esposa vivíamos discutindo dinheiro. Em duas semanas paramos. Tudo virou explícito.", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&auto=format&fit=crop&q=80" },
              { name: "Ana Pereira", role: "Família com filhos · RJ", quote: "Finalmente um app que entende que minha família não é uma planilha. O rateio mudou a casa.", photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&auto=format&fit=crop&q=80" },
              { name: "Carlos Silveira", role: "Contador · MG", quote: "Acompanho 12 clientes pelo Pontes. Em vez de cobrar PDF, vejo em tempo real. Mudou meu fluxo.", photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&auto=format&fit=crop&q=80" },
            ].map((t) => (
              <div key={t.name} style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 18, padding: 28 }}>
                <div style={{ display: "flex", gap: 2, marginBottom: 16, color: p.accent }}>
                  {[0,1,2,3,4].map((s) => (
                    <svg key={s} width="16" height="16" viewBox="0 0 16 16" fill={p.accent}>
                      <path d="M8 0 L10 6 L16 6 L11 9.5 L13 16 L8 12 L3 16 L5 9.5 L0 6 L6 6 Z" />
                    </svg>
                  ))}
                </div>
                <p style={{ fontSize: 15, color: p.text, lineHeight: 1.55, margin: 0, marginBottom: 24 }}>&ldquo;{t.quote}&rdquo;</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={t.photo} alt={t.name} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                  <div>
                    <div style={{ fontWeight: 700, color: p.text, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: p.textMuted }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: "120px 48px", background: p.surface }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 18 }}>Planos</div>
            <h2 style={{ fontSize: 52, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: 14, fontFamily: "'Fraunces', serif" }}>
              Sem pegadinha. <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>Pra todo bolso.</em>
            </h2>
            <p style={{ fontSize: 17, color: p.textMuted, marginBottom: 24 }}>Começa grátis. Cresce com você.</p>

            {/* Toggle mensal/anual */}
            <PontesButtonGroup<"mensal" | "anual">
              p={p} font={font}
              value={annual ? "anual" : "mensal"}
              onChange={(v) => setAnnual(v === "anual")}
              options={[
                { value: "mensal", label: "Mensal" },
                { value: "anual", label: (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    Anual <span style={{ background: p.accent, color: "#0B1220", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800 }}>-20%</span>
                  </span>
                ) },
              ]}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {/* Tilt 3D em cada card */}
            <TiltCard intensity={6}>
            <PriceCard p={p} font={font} name="Solo" price="Grátis" period="" tagline="Pra começar a organizar"
              features={["1 conta + 1 cartão", "Lançamento ilimitado", "Categorias e relatórios", "Importação OFX/CSV"]}
              cta="Criar conta" highlight={false} />
            </TiltCard>
            <TiltCard intensity={6}>
            <PriceCard p={p} font={font} name="Família" price={annual ? "R$ 15" : "R$ 19"} period="/mês" tagline="Casal + dependentes"
              features={["Tudo do Solo", "Até 6 membros", "Rateio e aprovação", "Metas conjuntas", "Suporte por chat"]}
              cta="Escolher Família" highlight={true} note={annual ? "Cobrado anualmente · R$ 180" : "Cobrado mensalmente"} />
            </TiltCard>
            <TiltCard intensity={6}>
            <PriceCard p={p} font={font} name="Contador" price={annual ? "R$ 39" : "R$ 49"} period="/mês" tagline="Pra profissionais"
              features={["Tudo do Família", "Até 20 clientes", "Dashboard multi-cliente", "Relatórios contábeis", "Suporte prioritário"]}
              cta="Falar com vendas" highlight={false} note={annual ? "Cobrado anualmente · R$ 468" : "Cobrado mensalmente"} />
            </TiltCard>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "120px 48px", background: p.bg }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 18 }}>FAQ</div>
            <h2 style={{ fontSize: 52, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05, fontFamily: "'Fraunces', serif" }}>
              Perguntas <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>frequentes</em>
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { q: "Pontes conecta com meu banco?", a: "Sim. Via Open Finance autorizado pelo Banco Central. Leitura apenas — não transferimos grana." },
              { q: "Meu parceiro vê tudo que eu lanço?", a: "Você decide. Cada conta tem privacidade. Despesas compartilhadas pedem aprovação dos dois." },
              { q: "Posso usar grátis pra sempre?", a: "Sim no plano Solo. Família e Contador destravam recursos colaborativos." },
              { q: "Como cancelo a assinatura?", a: "Um clique nas configurações. Sem fidelidade, sem multa." },
              { q: "Meus dados ficam seguros?", a: "Criptografia ponta a ponta, ISO 27001, LGPD-compliant. Você é dono dos seus dados." },
            ].map((item, i) => (
              <details key={i} style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: "18px 22px", fontFamily: font }}>
                <summary style={{ fontWeight: 600, fontSize: 16, color: p.text, cursor: "pointer", listStyle: "none" }}>{item.q}</summary>
                <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: p.textMuted }}>{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL com foto de celular estilo Monarch */}
      <section style={{ padding: "60px 48px", background: p.bg }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", background: p.surface, borderRadius: 24, border: `1px solid ${p.border}`, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "stretch", minHeight: 380 }}>
          <div style={{ padding: "64px 56px", display: "flex", flexDirection: "column", justifyContent: "center", fontFamily: font }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 18 }}>PREÇOS</div>
            <h2 style={{ fontSize: 52, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.02, marginBottom: 20, fontFamily: "'Fraunces', serif" }}>
              Use Pontes <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>grátis</em> por 14 dias
            </h2>
            <p style={{ fontSize: 17, color: p.textMuted, lineHeight: 1.5, marginBottom: 32, maxWidth: 420 }}>
              Veja todas as suas finanças num só lugar. Sem ads, sem fidelidade. Convide parceiro e contador sem custo extra.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <PontesButton
                p={p} font={font}
                variant="primary" size="md"
                iconEnd={<ArrowRight size={16} strokeWidth={2.5} />}
                onClick={() => navigate("/auth/register")}
              >
                Começar grátis
              </PontesButton>
              <PontesButton p={p} font={font} variant="outline" size="md">Ver planos</PontesButton>
            </div>
          </div>
          <div style={{ position: "relative", overflow: "hidden", minHeight: 380, background: `linear-gradient(135deg, ${p.primary}, ${p.primaryDark})` }}>
            <img
              src="https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=900&auto=format&fit=crop&q=80"
              alt="Pontes no celular"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: 0.92 }}
            />
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(45deg, ${p.primary}55, transparent 60%)` }} />
          </div>
        </div>
      </section>

      {/* FOOTER com mesh gradient */}
      <PontesFooter
        p={p} font={font} variant="rich"
        onNavigate={(to) => navigate(to)}
        appBadges={[
          { label: "App Store" },
          { label: "Google Play" },
        ]}
      />
    </div>
  )
}

// =============================================================================
// COMPONENT SHOWCASE — design system completo (6 abas)
// =============================================================================

function PriceCard({ p, font, name, price, period, tagline, features, cta, highlight, note }: { p: Palette; font: string; name: string; price: string; period: string; tagline: string; features: string[]; cta: string; highlight: boolean; note?: string }) {
  const fg = highlight ? p.heroFg : p.text
  const mutedFg = highlight ? "rgba(255,255,255,0.75)" : p.textMuted
  return (
    <div style={{ background: highlight ? p.primary : p.surface, border: highlight ? "none" : `1px solid ${p.border}`, borderRadius: 22, padding: 36, color: fg, position: "relative", boxShadow: highlight ? "0 24px 50px -12px rgba(0,0,0,0.3)" : "none", fontFamily: font, transform: highlight ? "translateY(-12px)" : undefined }}>
      {highlight && (
        <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: p.accent, color: "#0B1220", padding: "5px 16px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>
          MAIS POPULAR
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: mutedFg, marginBottom: 10 }}>{name}</div>
      <div style={{ fontSize: 14, color: mutedFg, marginBottom: 22 }}>{tagline}</div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.025em" }}>{price}</span>
        {period && <span style={{ fontSize: 16, opacity: 0.7, marginLeft: 6 }}>{period}</span>}
      </div>
      {note && <div style={{ fontSize: 12, color: mutedFg, marginBottom: 22 }}>{note}</div>}
      <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 28px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {features.map((f) => (
          <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <CheckIcon color={highlight ? p.accent : p.primary} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <PontesButton
        p={p} font={font}
        variant={highlight ? "accent" : "outline"}
        size="md" fullWidth
      >
        {cta}
      </PontesButton>
    </div>
  )
}

// FooterCol removido — substituído por PontesFooter (biblioteca).

// =============================================================================
// PÁGINA + CONTROLES
// =============================================================================
export default function HomePage() {
  const [paletteId, setPaletteId] = useState("A")
  const [fontId, setFontId] = useState("inter")
  const [barOpen, setBarOpen] = useState(true)
  const [barHeight, setBarHeight] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)

  const palette = palettes.find((x) => x.id === paletteId) ?? palettes[0]
  const font = fonts.find((x) => x.id === fontId) ?? fonts[0]

  // Mede altura do brand preview (ResizeObserver pega wrap dos botões de paleta).
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const measure = () => setBarHeight(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const topOffset = barOpen ? barHeight : 0

  useEffect(() => {
    const prev = {
      bodyOverflow: document.body.style.overflow, htmlOverflow: document.documentElement.style.overflow,
      htmlHeight: document.documentElement.style.height, bodyHeight: document.body.style.height,
      rootHeight: (document.getElementById("root") as HTMLElement | null)?.style.height,
    }
    document.body.style.overflow = "auto"; document.documentElement.style.overflow = "auto"
    document.documentElement.style.height = "auto"; document.body.style.height = "auto"
    const root = document.getElementById("root"); if (root) root.style.height = "auto"
    return () => {
      document.body.style.overflow = prev.bodyOverflow
      document.documentElement.style.overflow = prev.htmlOverflow
      document.documentElement.style.height = prev.htmlHeight
      document.body.style.height = prev.bodyHeight
      if (root) root.style.height = prev.rootHeight ?? ""
    }
  }, [])

  useEffect(() => {
    const linkId = `bp-font-${font.id}`
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link")
      link.id = linkId; link.rel = "stylesheet"; link.href = font.url
      document.head.appendChild(link)
    }
  }, [font])

  // Scrollbar overlay (accent) sempre visível + fundo da página no body.
  usePontesBodyScrollbar(palette.accent)
  useEffect(() => { applyPontesScrollbar(palette.accent, palette.bg) }, [palette])

  return (
    <div>
      {/* Control bar de dev (BRAND PREVIEW) — fixed overlay no topo do viewport.
          Aparece onde você estiver (reabrir em qualquer scroll). Sai no #90. */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        transform: barOpen ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        <div ref={barRef} style={{ background: "#0B1220", color: "#FFFFFF", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontFamily: "system-ui, sans-serif", fontSize: 13, borderBottom: "2px solid #1E293B", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
          {/* Toggle recolher (seta pra cima) — esquerda */}
          <button
            onClick={() => setBarOpen(false)}
            aria-label="Esconder brand preview"
            style={{ background: "transparent", color: "#FFFFFF", border: "1px solid #334155", borderRadius: 8, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <ChevronUp size={16} strokeWidth={2.5} />
          </button>

          <div style={{ fontWeight: 700, letterSpacing: "0.1em", fontSize: 11 }}>🎨 BRAND PREVIEW</div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ opacity: 0.6 }}>Paleta:</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {palettes.map((pp) => (
                <button key={pp.id} onClick={() => setPaletteId(pp.id)} title={pp.label}
                  style={{ background: paletteId === pp.id ? "#FFFFFF" : "transparent", color: paletteId === pp.id ? "#0B1220" : "#FFFFFF", border: `1px solid ${paletteId === pp.id ? "#FFFFFF" : "#334155"}`, padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, background: pp.primary, borderRadius: 3 }} />
                  <span style={{ width: 12, height: 12, background: pp.accent, borderRadius: 3 }} />
                  <span>{pp.id}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ opacity: 0.6 }}>Fonte:</span>
            <select value={fontId} onChange={(e) => setFontId(e.target.value)}
              style={{ background: "#1E293B", color: "#FFFFFF", border: "1px solid #334155", padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
              {fonts.map((f) => (<option key={f.id} value={f.id}>{f.label} — {f.description}</option>))}
            </select>
          </div>

          <div style={{ marginLeft: "auto", opacity: 0.55, fontSize: 11 }}>{palette.label} · {font.label}</div>
        </div>
      </div>

      {/* Pontinha pra reabrir onde você estiver (seta pra baixo) — esquerda fixa */}
      {!barOpen && (
        <button
          onClick={() => setBarOpen(true)}
          aria-label="Mostrar brand preview"
          style={{
            position: "fixed", top: 0, left: 16, zIndex: 1000,
            background: "#0B1220", color: "#FFFFFF", border: "2px solid #1E293B", borderTop: "none",
            borderRadius: "0 0 10px 10px", padding: "4px 14px", cursor: "pointer",
            display: "flex", alignItems: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <ChevronDown size={16} strokeWidth={2.5} />
        </button>
      )}

      {/* Conteúdo empurrado abaixo da bar fixa quando aberta */}
      <div style={{ paddingTop: barOpen ? barHeight : 0, transition: "padding-top 300ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
        <Landing p={palette} font={font.family} topOffset={topOffset} />
      </div>
      <FloatCTA p={palette} font={font.family} />
      <ScrollProgressBar p={palette} />
    </div>
  )
}
