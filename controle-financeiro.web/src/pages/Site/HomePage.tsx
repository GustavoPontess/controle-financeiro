/**
 * Home — página de entrada pública do site Pontes. Rota `/`.
 *
 * Estilo via CSS Modules + var(--pontes-*) (#122). Como a página é pesada em
 * SVG/recharts, mantém `useSiteTheme()` ({ p, font }) só pra alimentar cores de
 * gráfico, ilustrações SVG, gradientes e cores dinâmicas — var() não resolve em
 * atributo de apresentação SVG. Layout/texto/superfícies usam classes.
 * Keyframes e classes `bp-*` ficam globais (GlobalAnims <style>).
 */

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Play, Plus } from "lucide-react"
import { PontesButton, PontesLink, PontesButtonGroup, PontesTabs } from "../../components/pontes"
import { type Palette } from "./theme"
import { useSiteTheme } from "./siteTheme"
import {
  ResponsiveContainer, AreaChart, Area, BarChart as RBarChart, Bar,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts"
import styles from "./HomePage.module.css"

// =============================================================================
// PRIMITIVOS VISUAIS (SVG/decorativos — cor real via `p`, var() não vale em SVG)
// =============================================================================

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
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "bp-pulse 1.6s ease-out infinite" }} />
      <span style={{ position: "relative", display: "block", width: 8, height: 8, borderRadius: "50%", background: color }} />
    </span>
  )
}

/** Keyframes globais + classes utilitárias `bp-*` (precisam ser globais). */
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

/** Card com spotlight cursor-follow. */
function SpotlightCard({ children, className, spotColor = "rgba(255,255,255,0.12)" }: { children: React.ReactNode; className?: string; spotColor?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className={`bp-spotlight ${className ?? ""}`}
      onMouseMove={(e) => {
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        el.style.setProperty("--mx", `${e.clientX - rect.left}px`)
        el.style.setProperty("--my", `${e.clientY - rect.top}px`)
      }}
      style={{ "--spot": spotColor } as React.CSSProperties}
    >
      {children}
    </div>
  )
}

/** Card com tilt 3D mouse-follow. */
function TiltCard({ children, intensity = 8 }: { children: React.ReactNode; intensity?: number }) {
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
      style={{ transformStyle: "preserve-3d" }}
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

/** Comparison slider antes/depois — drag horizontal. Utilitário exportado. */
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
      <div style={{ position: "absolute", inset: 0 }}>{rightContent}</div>
      <div style={{ position: "absolute", top: 12, right: 16, background: p.primary, color: p.heroFg, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{rightLabel}</div>
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - pos}% 0 0)` }}>{leftContent}</div>
      <div style={{ position: "absolute", top: 12, left: 16, background: "#0B1220", color: "#FFFFFF", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, opacity: pos > 10 ? 1 : 0, transition: "opacity 150ms" }}>{leftLabel}</div>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 3, background: "#FFFFFF", boxShadow: "0 0 0 1px rgba(0,0,0,0.15), 0 4px 14px rgba(0,0,0,0.3)" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 40, height: 40, background: "#FFFFFF", borderRadius: "50%", boxShadow: "0 6px 20px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: p.text, fontWeight: 800 }}>↔</div>
      </div>
    </div>
  )
}

/** Logos clouds 3D. Utilitário exportado. */
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

/** Card stack — 3 cards empilhados. Utilitário exportado. */
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

/** Mesh gradient com 3 blobs animados. */
function MeshGradientAnimated({ c1, c2, c3 }: { c1: string; c2: string; c3: string }) {
  const blobBase = { position: "absolute" as const, borderRadius: "50%", filter: "blur(70px)", willChange: "transform" }
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ ...blobBase, top: "15%", left: "12%", width: 360, height: 360, background: `${c1}55`, animation: "bp-mesh-move 14s ease-in-out infinite" }} />
      <div style={{ ...blobBase, top: "45%", right: "10%", width: 300, height: 300, background: `${c2}45`, animation: "bp-mesh-move 18s ease-in-out infinite reverse" }} />
      <div style={{ ...blobBase, bottom: "18%", left: "38%", width: 280, height: 280, background: `${c3}40`, animation: "bp-mesh-move 22s ease-in-out infinite" }} />
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

/** Mesh gradient estática. */
function MeshGradient({ c1, c2, c3 }: { c1: string; c2: string; c3: string }) {
  const blobBase = { position: "absolute" as const, borderRadius: "50%", filter: "blur(70px)" }
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ ...blobBase, top: "15%", left: "12%", width: 360, height: 360, background: `${c1}55` }} />
      <div style={{ ...blobBase, top: "45%", right: "10%", width: 300, height: 300, background: `${c2}45` }} />
      <div style={{ ...blobBase, bottom: "18%", left: "38%", width: 280, height: 280, background: `${c3}40` }} />
    </div>
  )
}

// =============================================================================
// MOCKUPS de dispositivo (decorativos — chrome de cor fixa + gradiente `p`)
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
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "#F1F5F9", borderBottom: "1px solid #E2E8F0" }}>
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#FF5F57" }} />
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#FEBC2E" }} />
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28C840" }} />
        <div style={{ marginLeft: 14, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 14px", fontSize: 11, color: "#94A3B8" }}>
          pontes.app/dashboard
        </div>
      </div>

      <div style={{ display: "flex", minHeight: 420 }}>
        <div style={{ width: 64, background: p.primary, padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 32, height: 32, background: "rgba(255,255,255,0.18)", borderRadius: 8 }} />
          {[0.4, 0.2, 0.2, 0.2, 0.2].map((o, i) => (
            <div key={i} style={{ width: 28, height: 28, background: `rgba(255,255,255,${o})`, borderRadius: 6 }} />
          ))}
        </div>

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
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 80, height: 18, background: "#0B1220", borderRadius: "0 0 12px 12px" }} />

        <div style={{ padding: "30px 14px 14px" }}>
          <div style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Família Pontes</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0B1220", marginBottom: 12 }}>R$ 12.480</div>

          <div style={{ background: p.primarySoft, borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: p.primary, fontWeight: 700, marginBottom: 4 }}>RATEIO PENDENTE</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#0B1220" }}>Conta de luz · R$ 240</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <PontesButton variant="primary" size="xs" fullWidth>Aprovar</PontesButton>
              <PontesButton variant="outline" size="xs" fullWidth>Negar</PontesButton>
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

/** Ilustração abstrata de feature (SVG — cor real via `p`). Exportada. */
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
// GRÁFICOS (recharts — cor real via `p`)
// =============================================================================

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

// =============================================================================
// LIVE ACTIVITY FEED
// =============================================================================
function LiveActivity({ p }: { p: Palette }) {
  const items = useMemo(() => ([
    { icon: "💸", title: "Maria adicionou despesa", sub: "Mercado · R$ 142,30", time: "agora", color: p.primary },
    { icon: "✓", title: "Aprovou rateio", sub: "Conta de luz · 60/40", time: "1min", color: "#10B981" },
    { icon: "💼", title: "Salário recebido", sub: "Itaú · R$ 4.200,00", time: "3min", color: "#10B981" },
    { icon: "🎯", title: "Meta atingida", sub: "Reserva de emergência · 92%", time: "12min", color: p.accent },
    { icon: "⚠", title: "Limite do cartão", sub: "Nubank · 85% usado", time: "1h", color: "#F59E0B" },
    { icon: "📊", title: "Relatório mensal", sub: "Pronto pra revisar", time: "2h", color: p.primary },
  ]), [p.primary, p.accent])
  const [list, setList] = useState(items.slice(0, 4))

  useEffect(() => {
    let i = 4
    const id = setInterval(() => {
      setList((prev) => [items[i % items.length], ...prev.slice(0, 3)])
      i++
    }, 3500)
    return () => clearInterval(id)
  }, [items])

  return (
    <section className={styles.liveSec}>
      <MeshGradient c1={p.primary} c2={p.accent} c3={p.primary} />
      <div className={styles.liveGrid}>
        <Reveal>
          <div>
            <div className={styles.liveLabel}>
              <span className={styles.liveLabelInline}>
                <PulseDot color={p.accent} /> Ao vivo
              </span>
            </div>
            <h2 className={styles.h2Bold} style={{ marginBottom: 20 }}>
              Sua família, <span className={styles.primaryText}>em tempo real</span>
            </h2>
            <p className={styles.liveLead}>
              Cada despesa, aprovação, meta atingida — todo mundo vê na hora. Sem planilha, sem WhatsApp, sem &quot;achismo&quot;.
            </p>
            <div className={styles.liveStats}>
              {[
                { n: 6, l: "membros ativos" },
                { n: 247, l: "transações esse mês" },
                { n: 18, l: "aprovações pendentes resolvidas" },
                { n: 3, l: "metas conjuntas" },
              ].map((s) => (
                <div key={s.l} className={styles.liveStatCard}>
                  <div className={styles.liveStatN}><AnimatedNumber value={s.n} /></div>
                  <div className={styles.liveStatL}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div className={styles.feedCard}>
            <div className={styles.feedHead}>
              <div className={styles.feedTitle}>Feed da família</div>
              <span className={styles.feedLive}>
                <PulseDot color="#10B981" /> AO VIVO
              </span>
            </div>
            <div className={styles.feedList}>
              {list.map((it, i) => (
                <div key={it.title + i} className={`${styles.feedRow} ${i === 0 ? styles.feedRowFresh : styles.feedRowOld}`}>
                  <div className={styles.feedIcon} style={{ background: it.color }}>{it.icon}</div>
                  <div className={styles.flex1}>
                    <div className={styles.feedItemTitle}>{it.title}</div>
                    <div className={styles.feedItemSub}>{it.sub}</div>
                  </div>
                  <div className={styles.feedItemTime}>{it.time}</div>
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
// VEJA POR DENTRO — tabs
// =============================================================================
function InsideTabs({ p }: { p: Palette }) {
  const [tab, setTab] = useState<"transacoes" | "cartao" | "familia">("transacoes")

  return (
    <section className={styles.secSurface}>
      <div className={styles.wide1200}>
        <div className={styles.centerMb56}>
          <div className={styles.eyebrowSm}>Veja por dentro</div>
          <h2 className={styles.h2Bold}>
            Cada tela <span className={styles.primaryText}>pensada</span> pra família brasileira
          </h2>
        </div>

        <div className={styles.insideTabsRow}>
          <PontesTabs<"transacoes" | "cartao" | "familia">
            value={tab}
            onChange={setTab}
            options={[
              { value: "transacoes", label: "Transações" },
              { value: "cartao", label: "Cartão" },
              { value: "familia", label: "Família" },
            ]}
          />
        </div>

        <div className={styles.insidePanel}>
          {tab === "transacoes" && <TabTransacoes p={p} />}
          {tab === "cartao" && <TabCartao />}
          {tab === "familia" && <TabFamilia p={p} />}
        </div>
      </div>
    </section>
  )
}

function TabTransacoes({ p }: { p: Palette }) {
  const txs = [
    { date: "20/05", icon: "🛒", label: "Mercado Pão de Açúcar", category: "Mercado", value: -142.30, account: "Nubank", member: "G" },
    { date: "20/05", icon: "💼", label: "Salário Gustavo", category: "Renda", value: 4200.00, account: "Itaú", member: "G" },
    { date: "19/05", icon: "🎬", label: "Netflix", category: "Lazer", value: -55.90, account: "Nubank", member: "G" },
    { date: "19/05", icon: "⚡", label: "Conta de Luz · rateada", category: "Casa", value: -240.00, account: "Itaú", member: "G+M" },
    { date: "18/05", icon: "🍕", label: "iFood", category: "Alimentação", value: -68.50, account: "Nubank", member: "M" },
    { date: "18/05", icon: "💼", label: "Salário Maria", category: "Renda", value: 3800.00, account: "BB", member: "M" },
  ]

  return (
    <div className={styles.tab2col}>
      <div className={styles.panelCard}>
        <div className={styles.panelHead}>
          <div className={styles.panelHeadTitle}>Transações recentes</div>
          <div className={styles.filterPills}>
            <span className={styles.pillActive}>Tudo</span>
            <span className={styles.pillIdle}>Despesa</span>
            <span className={styles.pillIdle}>Receita</span>
          </div>
        </div>
        <div>
          {txs.map((tx, i) => (
            <div key={i} className={`${styles.txRow} ${i === txs.length - 1 ? styles.txRowLast : ""}`}>
              <div className={styles.txIcon}>{tx.icon}</div>
              <div className={styles.flex1}>
                <div className={styles.txLabel}>{tx.label}</div>
                <div className={styles.txMeta}>{tx.date} · {tx.category} · {tx.account}</div>
              </div>
              <div className={styles.txMember}>{tx.member}</div>
              <div className={styles.txValue} data-pos={tx.value > 0}>
                {tx.value > 0 ? "+ " : "- "}R$ {Math.abs(tx.value).toFixed(2).replace(".", ",")}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.col16}>
        <div className={styles.panelCardPad}>
          <div className={styles.miniLabel}>Evolução do saldo</div>
          <div className={styles.miniBig}>R$ 31.970</div>
          <div className={styles.miniGreen}>↑ 12,4% vs mês anterior</div>
          <LineAreaChartReal p={p} data={[
            { label: "S1", v: 29800 }, { label: "S2", v: 30420 }, { label: "S3", v: 29950 }, { label: "S4", v: 30880 },
            { label: "S5", v: 31200 }, { label: "S6", v: 31040 }, { label: "S7", v: 31650 }, { label: "S8", v: 31970 },
          ]} height={120} />
        </div>
        <div className={styles.panelCardPad}>
          <div className={styles.miniLabel}>Gastos por mês</div>
          <BarChartReal p={p} data={[
            { label: "Dez", v: 6.8 }, { label: "Jan", v: 5.4 }, { label: "Fev", v: 4.6 }, { label: "Mar", v: 5.0 }, { label: "Abr", v: 4.8 }, { label: "Mai", v: 5.4 },
          ]} height={120} />
        </div>
      </div>
    </div>
  )
}

function TabCartao() {
  const fatura = [
    { d: "20/05", label: "Amazon", v: 89.90, cat: "Compras" },
    { d: "19/05", label: "Uber", v: 24.50, cat: "Transporte" },
    { d: "18/05", label: "iFood", v: 68.50, cat: "Alimentação" },
    { d: "17/05", label: "Spotify", v: 21.90, cat: "Assinatura" },
    { d: "15/05", label: "Shopee · 3x", v: 120.00, cat: "Compras" },
  ]
  const total = fatura.reduce((s, t) => s + t.v, 0)

  return (
    <div className={styles.tab2colB}>
      <div className={styles.col16}>
        <div className={styles.cardVisual}>
          <div className={styles.cardBrand}>NUBANK · GOLD</div>
          <div className={styles.cardBottom}>
            <div className={styles.cardNumber}>•••• 4218</div>
            <div className={styles.cardName}>GUSTAVO N PONTES</div>
          </div>
          <div className={styles.cardChip} />
        </div>

        <div className={styles.panelCardPad}>
          <div className={styles.limitRow}>
            <span className={styles.limitLabel}>Limite usado</span>
            <span className={styles.limitVal}>R$ {total.toFixed(0)} / R$ 4.000</span>
          </div>
          <div className={styles.track8}>
            <div className={styles.fillPrimary} style={{ width: `${(total / 4000) * 100}%` }} />
          </div>
          <div className={styles.limitFoot}>
            <span>Fecha em 18 dias</span>
            <span>Vence 10/06</span>
          </div>
        </div>

        <div className={styles.statusBox}>
          <div className={styles.statusRow}>
            <span className={styles.statusDot} />
            <span className={styles.statusTitle}>Fatura aberta</span>
          </div>
          <div className={styles.statusSub}>Você pode pagar parcial ou esperar fechar.</div>
        </div>
      </div>

      <div className={styles.panelCard}>
        <div className={styles.faturaHead}>
          <div className={styles.faturaLabel}>Fatura atual · maio</div>
          <div className={styles.faturaBig}>R$ {total.toFixed(2).replace(".", ",")}</div>
        </div>
        {fatura.map((tx, i) => (
          <div key={i} className={`${styles.faturaRow} ${i === fatura.length - 1 ? styles.faturaRowLast : ""}`}>
            <div>
              <div className={styles.faturaItemLabel}>{tx.label}</div>
              <div className={styles.faturaItemMeta}>{tx.d} · {tx.cat}</div>
            </div>
            <div className={styles.faturaItemVal}>R$ {tx.v.toFixed(2).replace(".", ",")}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabFamilia({ p }: { p: Palette }) {
  const members = [
    { name: "Gustavo Pontes", role: "Administrador", avatar: "GP", color: p.primary, balance: "+ R$ 18.400" },
    { name: "Maria Silva", role: "Parceira", avatar: "MS", color: p.accent, balance: "+ R$ 13.570" },
    { name: "Lucas Pontes", role: "Dependente · 16 anos", avatar: "LP", color: "#94A3B8", balance: "R$ 250" },
  ]

  return (
    <div className={styles.tab2colB}>
      <div className={styles.col14}>
        <div className={styles.famSummary}>
          <div className={styles.miniLabel}>Família Pontes</div>
          <div className={styles.famSummaryBig}>R$ 32.220</div>
          <div className={styles.famSummarySub}>3 membros · 4 contas conectadas</div>
        </div>

        {members.map((m) => (
          <div key={m.name} className={styles.memberRow}>
            <div className={styles.memberAvatar} style={{ background: m.color }}>{m.avatar}</div>
            <div className={styles.flex1}>
              <div className={styles.memberName}>{m.name}</div>
              <div className={styles.memberRole}>{m.role}</div>
            </div>
            <div className={styles.memberBalance}>{m.balance}</div>
          </div>
        ))}
      </div>

      <div className={styles.col16}>
        <div className={styles.panelCardPad20}>
          <div className={styles.approveHead}>
            <div className={styles.feedTitle}>Despesas para aprovar</div>
            <span className={styles.approveBadge}>2 PENDENTES</span>
          </div>
          {[
            { label: "Conta de luz", v: 240.00, by: "Gustavo", split: "50/50" },
            { label: "Mercado mensal", v: 1200.00, by: "Maria", split: "60/40" },
          ].map((d, i) => (
            <div key={i} className={`${styles.approveItem} ${i > 0 ? styles.approveItemBorder : ""}`}>
              <div className={styles.approveItemHead}>
                <div className={styles.approveItemLabel}>{d.label}</div>
                <div className={styles.approveItemVal}>R$ {d.v.toFixed(2).replace(".", ",")}</div>
              </div>
              <div className={styles.approveItemMeta}>Lançada por {d.by} · rateio {d.split}</div>
              <div className={styles.approveBtns}>
                <PontesButton variant="primary" size="sm" fullWidth>Aprovar</PontesButton>
                <PontesButton variant="outline" size="sm" fullWidth>Negar</PontesButton>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.panelCardPad20}>
          <div className={styles.acertoTitle}>Acerto do mês</div>
          <div className={styles.acertoBox}>
            <div className={styles.acertoLabel}>MARIA DEVE A GUSTAVO</div>
            <div className={styles.acertoBig}>R$ 180,00</div>
            <div className={styles.acertoSub}>Referente a 3 despesas compartilhadas</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// LANDING
// =============================================================================

/** Bloco de feature zig-zag (texto + mockup alternando lado). */
function FeatureBlock({ reverse, tag, title, text, mockup }: { reverse: boolean; tag: string; title: string; text: string; mockup: React.ReactNode }) {
  return (
    <div className={`${styles.featBlock} ${reverse ? styles.featBlockRev : ""}`}>
      <div className={styles.featLtr}>
        <div className={styles.eyebrow}>{tag}</div>
        <h3 className={styles.featTitle}>{title}</h3>
        <p className={styles.featText}>{text}</p>
        <PontesLink style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          Saiba mais <ArrowRight size={14} strokeWidth={2.5} />
        </PontesLink>
      </div>
      <div className={styles.featMock}>{mockup}</div>
    </div>
  )
}

/** Mockup do rateio (Conta de luz). */
function RateioMockup() {
  return (
    <div className={styles.mockRel}>
      <div className={styles.mockMain}>
        <div className={styles.rateHead}>
          <div className={styles.rateLeft}>
            <div className={styles.rateEmoji}>⚡</div>
            <div>
              <div className={styles.rateName}>Conta de luz</div>
              <div className={styles.rateMeta}>Maio · vence 25/05</div>
            </div>
          </div>
          <div className={styles.rateTotal}>R$ 240,00</div>
        </div>
        <div className={styles.rateSplit}>
          <div className={styles.rateSplitLabel}>Rateio</div>
          <div className={styles.rateChips}>
            <div className={styles.rateChipP} style={{ flex: 6 }}>
              <div className={styles.rateChipHead}>
                <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&auto=format&fit=crop&q=80" alt="" className={styles.rateChipImg} style={{ border: "1.5px solid rgba(255,255,255,0.5)" }} />
                <span className={styles.rateChipWho}>Gustavo · 60%</span>
              </div>
              <div className={styles.rateChipVal}>R$ 144</div>
            </div>
            <div className={styles.rateChipA} style={{ flex: 4 }}>
              <div className={styles.rateChipHead}>
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&auto=format&fit=crop&q=80" alt="" className={styles.rateChipImg} style={{ border: "1.5px solid rgba(11,18,32,0.3)" }} />
                <span className={styles.rateChipWho}>Maria · 40%</span>
              </div>
              <div className={styles.rateChipVal}>R$ 96</div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.floatMini}>
        <div className={styles.floatMiniLabel}>
          <span className={styles.floatMiniDot} />
          MARIA APROVOU
        </div>
        <div className={styles.floatMiniSub}>Há 2 minutos</div>
      </div>
    </div>
  )
}

/** Mockup da família — membros com avatares. */
function FamiliaMockup() {
  const members = [
    { name: "Gustavo", role: "Admin", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&auto=format&fit=crop&q=80", saldo: "R$ 18.4k" },
    { name: "Maria", role: "Parceira", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&auto=format&fit=crop&q=80", saldo: "R$ 13.6k" },
    { name: "Lucas (16)", role: "Dependente", photo: "https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=120&h=120&auto=format&fit=crop&q=80", saldo: "R$ 250" },
    { name: "Pedro (CPA)", role: "Contador", photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&auto=format&fit=crop&q=80", saldo: "—" },
  ]
  return (
    <div className={styles.mockRel}>
      <div className={styles.mockMain}>
        <div className={styles.famMockHead}>
          <div>
            <div className={styles.famMockLabel}>Família Pontes</div>
            <div className={styles.famMockBig}>R$ 32.220</div>
          </div>
          <PontesButton variant="primary" size="sm" iconStart={<Plus size={14} strokeWidth={2.5} />}>Convidar</PontesButton>
        </div>
        <div className={styles.famMockList}>
          {members.map((m) => (
            <div key={m.name} className={styles.famMockRow}>
              <div className={styles.famMockAvatarWrap}>
                <img src={m.photo} alt={m.name} className={styles.famMockAvatar} />
                <span className={styles.famMockOnline} />
              </div>
              <div className={styles.flex1}>
                <div className={styles.famMockName}>{m.name}</div>
                <div className={styles.famMockRole}>{m.role}</div>
              </div>
              <div className={styles.famMockSaldo}>{m.saldo}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Mockup do cartão — fatura + limite. */
function CartaoMockup() {
  return (
    <div className={styles.mockRel}>
      <div className={styles.cardVisual} style={{ borderRadius: 16, padding: 22 }}>
        <div className={styles.cardBrand}>NUBANK · GOLD</div>
        <div className={styles.cardBottom} style={{ left: 22 }}>
          <div className={styles.cardNumber} style={{ fontSize: 16 }}>•••• 4218</div>
          <div className={styles.cardName}>GUSTAVO N PONTES</div>
        </div>
        <div className={styles.cardChip} style={{ top: 22, right: 22, width: 36, height: 26 }} />
      </div>
      <div className={styles.faturaOver}>
        <div className={styles.faturaOverLabel}>Fatura aberta</div>
        <div className={styles.faturaOverBig}>R$ 4.456,30</div>
        <div className={styles.track6}>
          <div className={styles.fill55} />
        </div>
        <div className={styles.faturaOverFoot}>
          <span>Fecha em 18d</span>
          <span style={{ fontWeight: 700, color: "var(--pontes-text)" }}>55% limite</span>
        </div>
      </div>
    </div>
  )
}

function Landing({ p, font }: { p: Palette; font: string }) {
  const [annual, setAnnual] = useState(true)
  const navigate = useNavigate()

  return (
    <div className={styles.root}>
      <GlobalAnims />

      {/* HERO */}
      <section className={styles.hero}>
        <GridPattern color={p.heroFg} opacity={0.08} />
        <MeshGradientAnimated c1={p.accent} c2={p.primary} c3={p.accent} />
        <div className="bp-noise" />

        <div className={styles.heroGrid}>
          <div>
            <div className={styles.heroBadge}>
              <PulseDot color={p.accent} />
              Beta aberto · vagas limitadas
            </div>

            <h1 className={styles.heroTitle}>
              Finanças pra{" "}
              <TypingWord words={["casal", "família", "contador", "você"]} color={p.accent} />
              <br />
              <em className={styles.emAccent}>sem briga</em>{" "}
              e sem planilha.
            </h1>
            <p className={styles.heroLead}>
              Conecte bancos, divida despesas com seu parceiro e abra acesso pro seu contador. Um produto, uma família, uma fonte da verdade.
            </p>

            <div className={styles.heroBtns}>
              <PontesButton variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>
                Criar conta grátis
              </PontesButton>
              <PontesButton variant="outline-light" size="lg" iconStart={<Play size={14} strokeWidth={2.5} />}>
                Ver demo 90s
              </PontesButton>
            </div>

            <div className={styles.heroChecks}>
              {["Grátis pra começar", "Sem cartão", "Casal incluído"].map((t) => (
                <span key={t} className={styles.heroCheck}>
                  <CheckIcon color={p.accent} /> {t}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.heroArt}>
            <div style={{ position: "absolute", inset: -40, background: `radial-gradient(ellipse at center, ${p.accent}55 0%, transparent 60%)`, filter: "blur(40px)", animation: "bp-glow 4s ease-in-out infinite", pointerEvents: "none" }} />
            <DesktopMockup p={p} font={font} />
            <MobileMockup p={p} font={font} />

            <div className={styles.heroToast}>
              <div className={styles.heroToastRow}>
                <div className={styles.heroToastIcon}>✓</div>
                <div className={styles.flex1}>
                  <div className={styles.heroToastTitle}>Maria aprovou despesa</div>
                  <div className={styles.heroToastSub}>Conta de luz · R$ 240,00</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BANNER */}
      <section className={styles.statsBanner}>
        <div className={styles.statsGrid}>
          <Reveal delay={0}>
            <div className={styles.center}>
              <div className={styles.statBig}><AnimatedNumber value={10} suffix="×" /></div>
              <div className={styles.statLabel}>Mais rápido que planilha</div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className={styles.center}>
              <div className={styles.statBig}>R$ <AnimatedNumber value={1.2} decimals={1} suffix="bi" /></div>
              <div className={styles.statLabel}>Em despesas organizadas</div>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className={styles.center}>
              <div className={styles.statBig}><AnimatedNumber value={98} suffix="%" /></div>
              <div className={styles.statLabel}>Casais recomendam</div>
            </div>
          </Reveal>
          <Reveal delay={300}>
            <div className={styles.center}>
              <div className={styles.statBig}>&lt;<AnimatedNumber value={2} />min</div>
              <div className={styles.statLabel}>Pra criar conta</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SOCIAL PROOF — MARQUEE */}
      <section className={styles.marqueeSec}>
        <div className={styles.marqueeHead}>
          <div className={styles.eyebrowMuted}>Conecta com os bancos que você já usa</div>
        </div>
        <div className={styles.marqueeRel}>
          <div className="bp-marquee-track" style={{ display: "flex", gap: 48, width: "max-content" }}>
            {[...Array(2)].map((_, k) => (
              <div key={k} className={styles.marqueeGroup}>
                {["Nubank", "Itaú", "Bradesco", "Santander", "Banco do Brasil", "Inter", "C6 Bank", "Caixa", "BTG Pactual", "Will Bank"].map((b) => (
                  <div key={b + k} className={styles.marqueeItem}>{b}</div>
                ))}
              </div>
            ))}
          </div>
          <div className={styles.fadeLeft} />
          <div className={styles.fadeRight} />
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className={styles.secSurface}>
        <div className={styles.wide1100}>
          <div className={styles.centerMb72}>
            <div className={styles.eyebrow}>Como funciona</div>
            <h2 className={styles.h2}>
              3 passos. <em className={styles.em}>Nada de planilha.</em>
            </h2>
          </div>

          <div className={styles.steps3}>
            {[
              { n: "01", t: "Conecte seus bancos", d: "Via Open Finance autorizado pelo BCB. Transações chegam sozinhas, sem digitação." },
              { n: "02", t: "Convide sua família", d: "Parceiro, filhos, contador. Cada um com papel próprio e privacidade respeitada." },
              { n: "03", t: "Acompanhe junto", d: "Visão única ou família. Rateio claro. Aprovação de despesa. Tudo num só lugar." },
            ].map((step) => (
              <SpotlightCard key={step.n} spotColor={`${p.primary}22`} className={styles.stepCard}>
                <div className={styles.stepNum}>{step.n}</div>
                <div className={styles.stepTitle}>{step.t}</div>
                <div className={styles.stepDesc}>{step.d}</div>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION HUMANA */}
      <section className={styles.secSurface}>
        <div className={styles.humanGrid}>
          <div className={styles.humanPhoto}>
            <img src="https://images.unsplash.com/photo-1609220136736-443140cffec6?w=900&auto=format&fit=crop&q=80" alt="Família brasileira" className={styles.coverImg} />
            <div className={styles.humanFloat}>
              <div className={styles.avatarStack}>
                {[
                  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&auto=format&fit=crop&q=80",
                  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&auto=format&fit=crop&q=80",
                  "https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=120&h=120&auto=format&fit=crop&q=80",
                ].map((src, i) => (
                  <img key={i} src={src} alt="" className={styles.avatarStackImg} />
                ))}
              </div>
              <div className={styles.flex1}>
                <div className={styles.humanFloatLabel}>Família Pontes</div>
                <div className={styles.humanFloatName}>3 membros · ativos hoje</div>
              </div>
              <span className={styles.dotGreen} />
            </div>
          </div>
          <div>
            <div className={styles.eyebrow}>POR QUE FAMÍLIA</div>
            <h2 className={`${styles.h2} ${styles.h2Mb24}`}>
              Família brasileira não é{" "}
              <em className={styles.em}>uma planilha</em>
            </h2>
            <p className={styles.paraMutedMb16}>
              Casal, dependentes, contador — cada um com sua parte na história. Aplicativos foram feitos pra solteiro. Pontes foi pensado pra família brasileira de verdade.
            </p>
            <p className={styles.paraMuted}>
              Sem complicar. Sem expor o que ninguém precisa ver. Com respeito ao que cada um decide compartilhar.
            </p>
          </div>
        </div>
      </section>

      <LiveActivity p={p} />
      <InsideTabs p={p} />

      {/* FEATURES zig-zag */}
      <section className={styles.secBg}>
        <div className={styles.wide1200}>
          <div className={styles.featHeadCenter}>
            <div className={styles.eyebrowSm}>O que é Pontes</div>
            <h2 className={styles.h2}>
              Sua família, sua grana,<br />
              <em className={styles.em}>no mesmo lugar</em>
            </h2>
          </div>

          <FeatureBlock reverse={false}
            tag="RATEIO"
            title="Cada centavo onde ele deve estar"
            text="A despesa cai 50/50, por porcentagem, valor fixo ou consumo real. Cada um vê o que pagou, o que deve, o que recebe. Sem 'achismo'."
            mockup={<RateioMockup />} />

          <FeatureBlock reverse={true}
            tag="FAMÍLIA"
            title="Cada um vê o que precisa ver"
            text="Convide parceiro, filhos, contador. Cada um com papel próprio e privacidade respeitada. Você decide o que compartilha e o que fica só seu."
            mockup={<FamiliaMockup />} />

          <FeatureBlock reverse={false}
            tag="CARTÃO"
            title="Fatura na régua"
            text="Aberta, fechada, paga. Limite real em barra. Pagamento parcial mantido. Cada compra parcelada distribuída automaticamente nas faturas certas."
            mockup={<CartaoMockup />} />
        </div>
      </section>

      {/* COMPARATIVO */}
      <section className={styles.secSurface}>
        <div className={styles.wide1000}>
          <div className={styles.centerMb56}>
            <div className={styles.eyebrow}>Comparativo</div>
            <h2 className={styles.h2}>
              Por que <em className={styles.em}>Pontes</em> e não os outros
            </h2>
          </div>

          <div className={styles.cmpWrap}>
            <table className={styles.cmpTable}>
              <thead>
                <tr className={styles.cmpTheadRow}>
                  <th className={styles.cmpThEmpty}></th>
                  <th className={styles.cmpThMain}>Pontes</th>
                  <th className={styles.cmpThOther}>Mobills</th>
                  <th className={styles.cmpThOther}>Despezzas</th>
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
                  <tr key={i} className={styles.cmpRow}>
                    <td className={styles.cmpTdFeature}>{row.f}</td>
                    <td className={styles.cmpTdMain}>{row.a ? <CheckIcon color={p.primary} /> : <span className={styles.cmpDash}>—</span>}</td>
                    <td className={styles.cmpTdOther}>{row.b ? <CheckIcon color={p.textMuted} /> : <span className={styles.cmpDash}>—</span>}</td>
                    <td className={styles.cmpTdOther}>{row.c ? <CheckIcon color={p.textMuted} /> : <span className={styles.cmpDash}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* COMUNIDADE */}
      <section className={styles.secBg}>
        <div className={styles.comGrid}>
          <div className={styles.comPhoto}>
            <img src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&auto=format&fit=crop&q=80" alt="Pessoa sorrindo usando Pontes" className={styles.coverImg} />
            <div className={styles.comQuote}>💬 &quot;Mudou nossa rotina financeira em 2 semanas&quot;</div>
          </div>
          <div>
            <h2 className={`${styles.h2} ${styles.comH2}`}>Comunidade Pontes</h2>
            <div className={styles.comCards}>
              <div className={styles.comCard}>
                <div className={styles.comCardTitle}>WhatsApp BR</div>
                <p className={styles.comCardText}>
                  Entre na nossa comunidade brasileira no WhatsApp. Famílias trocando dicas, primeiros usuários do beta.
                </p>
                <PontesButton variant="outline" size="sm">Entrar</PontesButton>
              </div>
              <div className={styles.comCard}>
                <div className={styles.comCardTitle}>Blog</div>
                <p className={styles.comCardText}>
                  Artigos sobre finanças de casal, dependentes, como conversar com contador sem trauma.
                </p>
                <PontesButton variant="outline" size="sm">Ler agora</PontesButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className={styles.secBg}>
        <div className={styles.wide1200}>
          <div className={styles.centerMb56}>
            <div className={styles.eyebrow}>Quem usa, fala</div>
            <h2 className={styles.h2}>
              Famílias reais. <em className={styles.em}>Resultados reais.</em>
            </h2>
          </div>

          <div className={styles.testiGrid}>
            {[
              { name: "Ricardo Moraes", role: "Casal · SP", quote: "Eu e minha esposa vivíamos discutindo dinheiro. Em duas semanas paramos. Tudo virou explícito.", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&auto=format&fit=crop&q=80" },
              { name: "Ana Pereira", role: "Família com filhos · RJ", quote: "Finalmente um app que entende que minha família não é uma planilha. O rateio mudou a casa.", photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&auto=format&fit=crop&q=80" },
              { name: "Carlos Silveira", role: "Contador · MG", quote: "Acompanho 12 clientes pelo Pontes. Em vez de cobrar PDF, vejo em tempo real. Mudou meu fluxo.", photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&auto=format&fit=crop&q=80" },
            ].map((t) => (
              <div key={t.name} className={styles.testiCard}>
                <div className={styles.testiStars}>
                  {[0, 1, 2, 3, 4].map((s) => (
                    <svg key={s} width="16" height="16" viewBox="0 0 16 16" fill={p.accent}>
                      <path d="M8 0 L10 6 L16 6 L11 9.5 L13 16 L8 12 L3 16 L5 9.5 L0 6 L6 6 Z" />
                    </svg>
                  ))}
                </div>
                <p className={styles.testiQuote}>&ldquo;{t.quote}&rdquo;</p>
                <div className={styles.testiWho}>
                  <img src={t.photo} alt={t.name} className={styles.testiImg} />
                  <div>
                    <div className={styles.testiName}>{t.name}</div>
                    <div className={styles.testiRole}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className={styles.secSurface}>
        <div className={styles.wide1100}>
          <div className={styles.priceHead}>
            <div className={styles.eyebrow}>Planos</div>
            <h2 className={`${styles.h2}`} style={{ marginBottom: 14 }}>
              Sem pegadinha. <em className={styles.em}>Pra todo bolso.</em>
            </h2>
            <p className={styles.priceLead}>Começa grátis. Cresce com você.</p>

            <PontesButtonGroup<"mensal" | "anual">
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

          <div className={styles.priceGrid}>
            <TiltCard intensity={6}>
              <PriceCard p={p} name="Solo" price="Grátis" period="" tagline="Pra começar a organizar"
                features={["1 conta + 1 cartão", "Lançamento ilimitado", "Categorias e relatórios", "Importação OFX/CSV"]}
                cta="Criar conta" highlight={false} />
            </TiltCard>
            <TiltCard intensity={6}>
              <PriceCard p={p} name="Família" price={annual ? "R$ 15" : "R$ 19"} period="/mês" tagline="Casal + dependentes"
                features={["Tudo do Solo", "Até 6 membros", "Rateio e aprovação", "Metas conjuntas", "Suporte por chat"]}
                cta="Escolher Família" highlight={true} note={annual ? "Cobrado anualmente · R$ 180" : "Cobrado mensalmente"} />
            </TiltCard>
            <TiltCard intensity={6}>
              <PriceCard p={p} name="Contador" price={annual ? "R$ 39" : "R$ 49"} period="/mês" tagline="Pra profissionais"
                features={["Tudo do Família", "Até 20 clientes", "Dashboard multi-cliente", "Relatórios contábeis", "Suporte prioritário"]}
                cta="Falar com vendas" highlight={false} note={annual ? "Cobrado anualmente · R$ 468" : "Cobrado mensalmente"} />
            </TiltCard>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.secBg}>
        <div className={styles.faqWrap}>
          <div className={styles.priceHead}>
            <div className={styles.eyebrow}>FAQ</div>
            <h2 className={styles.h2}>
              Perguntas <em className={styles.em}>frequentes</em>
            </h2>
          </div>

          <div className={styles.faqList}>
            {[
              { q: "Pontes conecta com meu banco?", a: "Sim. Via Open Finance autorizado pelo Banco Central. Leitura apenas — não transferimos grana." },
              { q: "Meu parceiro vê tudo que eu lanço?", a: "Você decide. Cada conta tem privacidade. Despesas compartilhadas pedem aprovação dos dois." },
              { q: "Posso usar grátis pra sempre?", a: "Sim no plano Solo. Família e Contador destravam recursos colaborativos." },
              { q: "Como cancelo a assinatura?", a: "Um clique nas configurações. Sem fidelidade, sem multa." },
              { q: "Meus dados ficam seguros?", a: "Criptografia ponta a ponta, ISO 27001, LGPD-compliant. Você é dono dos seus dados." },
            ].map((item, i) => (
              <details key={i} className={styles.faqItem}>
                <summary className={styles.faqSummary}>{item.q}</summary>
                <div className={styles.faqAnswer}>{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className={styles.ctaSec}>
        <div className={styles.ctaCard}>
          <div className={styles.ctaLeft}>
            <div className={styles.eyebrow}>PREÇOS</div>
            <h2 className={styles.ctaTitle}>
              Use Pontes <em className={styles.em}>grátis</em> por 14 dias
            </h2>
            <p className={styles.ctaText}>
              Veja todas as suas finanças num só lugar. Sem ads, sem fidelidade. Convide parceiro e contador sem custo extra.
            </p>
            <div className={styles.ctaBtns}>
              <PontesButton variant="primary" size="md" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>
                Começar grátis
              </PontesButton>
              <PontesButton variant="outline" size="md">Ver planos</PontesButton>
            </div>
          </div>
          <div className={styles.ctaRight}>
            <img src="https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=900&auto=format&fit=crop&q=80" alt="Pontes no celular" className={styles.ctaRightImg} />
            <div className={styles.ctaRightOverlay} />
          </div>
        </div>
      </section>
    </div>
  )
}

// =============================================================================
// PRICE CARD
// =============================================================================

function PriceCard({ p, name, price, period, tagline, features, cta, highlight, note }: { p: Palette; name: string; price: string; period: string; tagline: string; features: string[]; cta: string; highlight: boolean; note?: string }) {
  const mutedCls = highlight ? styles.priceMutedHi : styles.priceMutedPlain
  return (
    <div className={`${styles.priceCard} ${highlight ? styles.priceCardHi : styles.priceCardPlain}`}>
      {highlight && <div className={styles.priceTag}>MAIS POPULAR</div>}
      <div className={`${styles.priceName} ${mutedCls}`}>{name}</div>
      <div className={`${styles.priceTagline} ${mutedCls}`}>{tagline}</div>
      <div className={styles.priceMb8}>
        <span className={styles.priceValue}>{price}</span>
        {period && <span className={styles.pricePeriod}>{period}</span>}
      </div>
      {note && <div className={`${styles.priceNote} ${mutedCls}`}>{note}</div>}
      <ul className={styles.priceFeatures}>
        {features.map((f) => (
          <li key={f} className={styles.priceFeature}>
            <CheckIcon color={highlight ? p.accent : p.primary} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <PontesButton variant={highlight ? "accent" : "outline"} size="md" fullWidth>{cta}</PontesButton>
    </div>
  )
}

// =============================================================================
// PÁGINA
// =============================================================================
export default function HomePage() {
  // Paleta/fonte vêm do SiteLayout (Outlet context) — usadas só pra SVG/charts.
  const { p, font } = useSiteTheme()
  return <Landing p={p} font={font} />
}
