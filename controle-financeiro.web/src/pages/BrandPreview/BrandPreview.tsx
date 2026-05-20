/**
 * Brand Preview — landing premium nível Linear/Vercel/Stripe/Pierre.
 * Rota pública /brand-preview. Sem mascote.
 *
 * Trocador de paleta e fonte ao vivo no topo.
 */

import { useEffect, useRef, useState } from "react"
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart as RBarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts"

// =============================================================================
// PALETAS
// =============================================================================
type Palette = {
  id: string
  label: string
  description: string
  primary: string
  primaryDark: string
  primarySoft: string
  accent: string
  accentSoft: string
  text: string
  textMuted: string
  bg: string
  surface: string
  border: string
  heroFg: string
}

const palettes: Palette[] = [
  { id: "A", label: "Cobalto + Âmbar", description: "Azul vibrante + âmbar quente",
    primary: "#1E40AF", primaryDark: "#1E3A8A", primarySoft: "#EEF2FF",
    accent: "#F59E0B", accentSoft: "#FEF3C7",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7F9FC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "B", label: "Marinho + Esmeralda", description: "Azul-marinho + verde-esmeralda",
    primary: "#0F2A47", primaryDark: "#0A1F35", primarySoft: "#E8EEF6",
    accent: "#10B981", accentSoft: "#D1FAE5",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7F9FC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "C", label: "Petróleo + Coral", description: "Azul-petróleo + laranja-coral",
    primary: "#0E4F6E", primaryDark: "#083B54", primarySoft: "#E0F2F1",
    accent: "#FB923C", accentSoft: "#FFEDD5",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7F9FC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "D", label: "Floresta + Mostarda", description: "Verde-floresta + amarelo-mostarda",
    primary: "#14532D", primaryDark: "#0F3D1F", primarySoft: "#E7F4EC",
    accent: "#EAB308", accentSoft: "#FEF9C3",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E7E5E4", heroFg: "#FFFFFF" },
  { id: "E", label: "Grafite + Lima", description: "Quase-preto + verde-lima",
    primary: "#0A0A0A", primaryDark: "#000000", primarySoft: "#F1F1F1",
    accent: "#A3E635", accentSoft: "#ECFCCB",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAFA", surface: "#FFFFFF", border: "#E5E5E5", heroFg: "#FFFFFF" },
  { id: "F", label: "Roxo-Real + Pêssego", description: "Roxo profundo + pêssego",
    primary: "#4338CA", primaryDark: "#3730A3", primarySoft: "#EEF2FF",
    accent: "#FDA4AF", accentSoft: "#FFE4E6",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E5E5E5", heroFg: "#FFFFFF" },
  { id: "G", label: "Vinho + Dourado", description: "Bordô profundo + dourado luxo",
    primary: "#7F1D1D", primaryDark: "#5F0E0E", primarySoft: "#FEE2E2",
    accent: "#D4AF37", accentSoft: "#FEF3C7",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E5E5E5", heroFg: "#FFFFFF" },
  { id: "H", label: "Ciano + Magenta", description: "Ciano elétrico + magenta vibrante",
    primary: "#0891B2", primaryDark: "#0E7490", primarySoft: "#CFFAFE",
    accent: "#D946EF", accentSoft: "#FAE8FF",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7FBFC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "I", label: "Lavanda + Pêssego", description: "Lavanda suave + pêssego claro",
    primary: "#7C3AED", primaryDark: "#6D28D9", primarySoft: "#EDE9FE",
    accent: "#FFAB9F", accentSoft: "#FFE4E6",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E7E5E4", heroFg: "#FFFFFF" },
  { id: "J", label: "Verde-menta + Coral", description: "Menta moderno + coral vibrante",
    primary: "#047857", primaryDark: "#065F46", primarySoft: "#D1FAE5",
    accent: "#F97316", accentSoft: "#FFEDD5",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7FCF9", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "K", label: "Azul-céu + Coral", description: "Azul claro vivido + coral",
    primary: "#0284C7", primaryDark: "#0369A1", primarySoft: "#E0F2FE",
    accent: "#FB7185", accentSoft: "#FFE4E6",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7F9FC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "L", label: "Terracota + Sálvia", description: "Terra brasileira + verde sálvia",
    primary: "#B45309", primaryDark: "#92400E", primarySoft: "#FEF3C7",
    accent: "#84CC16", accentSoft: "#ECFCCB",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E7E5E4", heroFg: "#FFFFFF" },
  { id: "M", label: "Marrom-café + Creme", description: "Café terroso + creme aconchego",
    primary: "#78350F", primaryDark: "#5F2A0A", primarySoft: "#FEF3C7",
    accent: "#FBBF24", accentSoft: "#FEF9C3",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E7E5E4", heroFg: "#FFFFFF" },
  { id: "N", label: "Rosa-pink + Verde", description: "Rosa vibrante + verde-folha",
    primary: "#DB2777", primaryDark: "#BE185D", primarySoft: "#FCE7F3",
    accent: "#10B981", accentSoft: "#D1FAE5",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E5E5E5", heroFg: "#FFFFFF" },
  { id: "O", label: "Índigo + Limão", description: "Índigo profundo + limão elétrico",
    primary: "#312E81", primaryDark: "#1E1B4B", primarySoft: "#E0E7FF",
    accent: "#D9F99D", accentSoft: "#ECFCCB",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7F9FC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
]

// =============================================================================
// FONTES
// =============================================================================
type FontOption = { id: string; label: string; description: string; family: string; url: string }

const fonts: FontOption[] = [
  { id: "inter", label: "Inter", description: "Neutra SaaS",
    family: "'Inter', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" },
  { id: "geist", label: "Geist", description: "Vercel/Linear",
    family: "'Geist', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&display=swap" },
  { id: "manrope", label: "Manrope", description: "Humanista",
    family: "'Manrope', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" },
  { id: "ibm", label: "IBM Plex Sans", description: "Fintech séria",
    family: "'IBM Plex Sans', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" },
  { id: "outfit", label: "Outfit", description: "Moderna redonda",
    family: "'Outfit', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" },
  { id: "plus-jakarta", label: "Plus Jakarta Sans", description: "Acolhedora",
    family: "'Plus Jakarta Sans', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" },
  { id: "satoshi", label: "Satoshi", description: "Premium",
    family: "'Satoshi', system-ui, sans-serif",
    url: "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap" },
]

// =============================================================================
// PRIMITIVOS VISUAIS
// =============================================================================

function Wordmark({ color, font, size = 22 }: { color: string; font: string; size?: number }) {
  const icon = Math.round(size * 1.45)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={icon} height={icon} viewBox="0 0 32 32" fill="none">
        <path d="M3 23 Q16 6 29 23" stroke={color} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <line x1="3" y1="25" x2="29" y2="25" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
        <line x1="9" y1="25" x2="9" y2="19" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        <line x1="16" y1="25" x2="16" y2="14" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        <line x1="23" y1="25" x2="23" y2="19" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: size, fontWeight: 700, color, letterSpacing: "-0.02em", fontFamily: font }}>
        Pontes
      </span>
    </div>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6.5" fill={color} fillOpacity="0.25" stroke={color} />
      <path d="M4 7 L6.2 9 L10 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function GridPattern({ color = "#FFFFFF", opacity = 0.06 }: { color?: string; opacity?: number }) {
  const id = `grid-${Math.random().toString(36).slice(2)}`
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
      @keyframes bp-marquee { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
      @keyframes bp-fade-up { 0% { opacity: 0; transform: translateY(24px) } 100% { opacity: 1; transform: translateY(0) } }
      @keyframes bp-toast-in { 0% { opacity: 0; transform: translateY(-20px) scale(0.9) } 100% { opacity: 1; transform: translateY(0) scale(1) } }
      @keyframes bp-glow { 0%, 100% { opacity: 0.5 } 50% { opacity: 0.85 } }
      @keyframes bp-slide-in { 0% { opacity: 0; transform: translateX(20px) } 100% { opacity: 1; transform: translateX(0) } }
      @keyframes bp-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
      .bp-fade-up { animation: bp-fade-up 0.6s ease-out backwards }
      .bp-marquee-track { animation: bp-marquee 30s linear infinite }
      .bp-marquee-track:hover { animation-play-state: paused }
    `}</style>
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

/** Mesh gradient background (3 blobs). */
function MeshGradient({ c1, c2, c3 }: { c1: string; c2: string; c3: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "70%", background: `radial-gradient(circle, ${c1}66 0%, transparent 60%)` }} />
      <div style={{ position: "absolute", top: "30%", right: "-10%", width: "55%", height: "70%", background: `radial-gradient(circle, ${c2}55 0%, transparent 60%)` }} />
      <div style={{ position: "absolute", bottom: "-20%", left: "30%", width: "55%", height: "70%", background: `radial-gradient(circle, ${c3}44 0%, transparent 60%)` }} />
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
              <button style={{ flex: 1, background: p.primary, color: "#FFFFFF", border: "none", borderRadius: 6, padding: "5px 0", fontSize: 9, fontWeight: 700 }}>Aprovar</button>
              <button style={{ flex: 1, background: "#FFFFFF", color: p.text, border: "1px solid #E2E8F0", borderRadius: 6, padding: "5px 0", fontSize: 9, fontWeight: 600 }}>Negar</button>
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
function FeatureIllustration({ kind, p }: { kind: string; p: Palette }) {
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
          formatter={(v: number) => [`R$ ${v.toFixed(1)}k`, "Gasto"]}
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
  const gradId = `area-${Math.random().toString(36).slice(2)}`
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
          formatter={(v: number) => [fmt(v), "Saldo"]}
        />
        <Area type="monotone" dataKey="v" stroke={p.primary} strokeWidth={2.5} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 5, fill: p.accent, stroke: "#FFFFFF", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Line chart real com 2 séries (atual sólido + comparativo tracejado), sem dots, hover rico. */
type LinePoint = { label: string | number; v: number; v2?: number }

function CustomLineTooltip({ active, payload, label, p, labelPrefix = "Dia" }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string | number; p: Palette; labelPrefix?: string }) {
  if (!active || !payload?.length) return null
  const cur = payload.find((x) => x.name === "Este mês")?.value ?? payload[0]?.value
  const prev = payload.find((x) => x.name === "Mês passado")?.value
  const diff = prev !== undefined ? cur - prev : null
  const pct = prev && prev !== 0 ? (((cur - prev) / prev) * 100).toFixed(0) : null
  return (
    <div style={{ background: p.text, color: "#FFFFFF", borderRadius: 12, padding: 14, minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", fontFamily: "inherit" }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{labelPrefix} {label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 13 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.85 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.accent }} />Este mês
        </span>
        <span style={{ fontWeight: 700 }}>R$ {cur.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
      </div>
      {prev !== undefined && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 13 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#94A3B8" }} />Mês passado
          </span>
          <span style={{ fontWeight: 700, opacity: 0.75 }}>R$ {prev.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
      )}
      {diff !== null && pct !== null && (
        <div style={{ paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: diff > 0 ? "#FCA5A5" : "#86EFAC" }}>
            {diff > 0 ? "↗" : "↘"} {diff > 0 ? "Aumento" : "Queda"} {diff > 0 ? "+" : ""}R$ {Math.abs(diff).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </span>
          <span style={{ color: diff > 0 ? "#FCA5A5" : "#86EFAC", fontWeight: 700 }}>({diff > 0 ? "+" : ""}{pct}%)</span>
        </div>
      )}
    </div>
  )
}

function LineChartReal({ p, data, height = 220, labelPrefix = "Dia" }: { p: Palette; data: LinePoint[]; height?: number; labelPrefix?: string }) {
  const hasV2 = data[0]?.v2 !== undefined
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 14, right: 20, left: 0, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 6" stroke={p.border} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: p.textMuted }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: p.textMuted }} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`} />
        <Tooltip content={<CustomLineTooltip p={p} labelPrefix={labelPrefix} />} cursor={{ stroke: p.textMuted, strokeWidth: 1, strokeDasharray: "3 3" }} />
        {hasV2 && (
          <Line type="monotone" dataKey="v2" stroke="#94A3B8" strokeWidth={2} strokeDasharray="6 5" dot={false} activeDot={{ r: 4, fill: "#94A3B8", stroke: "#FFFFFF", strokeWidth: 2 }} name="Mês passado" />
        )}
        <Line type="monotone" dataKey="v" stroke={p.accent} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: p.accent, stroke: "#FFFFFF", strokeWidth: 2 }} name="Este mês" />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Donut chart real. */
function DonutChartReal({ p, data, height = 200 }: { p: Palette; data: { name: string; value: number }[]; height?: number }) {
  const colors = [p.primary, p.accent, "#94A3B8", "#22C55E", "#A78BFA"]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`R$ ${v}`, ""]} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// =============================================================================
// LIVE ACTIVITY FEED — notificações entrando ao vivo
// =============================================================================
function LiveActivity({ p, font }: { p: Palette; font: string }) {
  const items = [
    { icon: "💸", title: "Maria adicionou despesa", sub: "Mercado · R$ 142,30", time: "agora", color: p.primary },
    { icon: "✓", title: "Aprovou rateio", sub: "Conta de luz · 60/40", time: "1min", color: "#10B981" },
    { icon: "💼", title: "Salário recebido", sub: "Itaú · R$ 4.200,00", time: "3min", color: "#10B981" },
    { icon: "🎯", title: "Meta atingida", sub: "Reserva de emergência · 92%", time: "12min", color: p.accent },
    { icon: "⚠", title: "Limite do cartão", sub: "Nubank · 85% usado", time: "1h", color: "#F59E0B" },
    { icon: "📊", title: "Relatório mensal", sub: "Pronto pra revisar", time: "2h", color: p.primary },
  ]
  const [list, setList] = useState(items.slice(0, 4))

  // Cicla itens a cada 3.5s
  useEffect(() => {
    let i = 4
    const id = setInterval(() => {
      setList((prev) => [items[i % items.length], ...prev.slice(0, 3)])
      i++
    }, 3500)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

        {/* Tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 40 }}>
          {[
            { id: "transacoes", label: "Transações" },
            { id: "cartao", label: "Cartão" },
            { id: "familia", label: "Família" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as "transacoes" | "cartao" | "familia")}
              style={{
                background: tab === t.id ? p.primary : "transparent",
                color: tab === t.id ? p.heroFg : p.text,
                border: `1px solid ${tab === t.id ? p.primary : p.border}`,
                padding: "10px 22px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font,
              }}
            >
              {t.label}
            </button>
          ))}
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
                <button style={{ flex: 1, background: p.primary, color: "#FFFFFF", border: "none", borderRadius: 8, padding: "8px", fontSize: 11, fontWeight: 700, fontFamily: font }}>Aprovar</button>
                <button style={{ flex: 1, background: "transparent", color: p.text, border: `1px solid ${p.border}`, borderRadius: 8, padding: "8px", fontSize: 11, fontWeight: 600, fontFamily: font }}>Negar</button>
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
function Landing({ p, font }: { p: Palette; font: string }) {
  const [annual, setAnnual] = useState(true)

  return (
    <div style={{ fontFamily: font, color: p.text, background: p.surface }}>
      <GlobalAnims />
      {/* NAVBAR */}
      <nav style={{ padding: "18px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.95)", borderBottom: `1px solid ${p.border}`, position: "sticky", top: 0, zIndex: 10 }}>
        <Wordmark color={p.primary} font={font} />
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {["Recursos", "Família", "Contador", "Preços", "Blog"].map((l) => (
            <a key={l} style={{ color: p.text, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>{l}</a>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a style={{ color: p.text, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Entrar</a>
          <button style={{ background: p.primary, color: p.heroFg, border: "none", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
            Criar conta grátis
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primaryDark} 100%)`, padding: "110px 48px 160px", color: p.heroFg, position: "relative", overflow: "hidden" }}>
        <GridPattern color={p.heroFg} opacity={0.08} />

        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 56, alignItems: "center", position: "relative", zIndex: 1 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 28 }}>
              <PulseDot color={p.accent} />
              Beta aberto · vagas limitadas
            </div>

            <h1 style={{ fontSize: 72, fontWeight: 900, lineHeight: 0.98, letterSpacing: "-0.04em", margin: 0, marginBottom: 28 }}>
              Finanças em família,<br />
              <span style={{ color: p.accent }}>sem briga</span> e <span style={{ color: p.accent }}>sem planilha.</span>
            </h1>
            <p style={{ fontSize: 21, opacity: 0.88, lineHeight: 1.5, marginBottom: 40, maxWidth: 520 }}>
              Conecte bancos, divida despesas com seu parceiro e abra acesso pro seu contador. Um produto, uma família, uma fonte da verdade.
            </p>

            <div style={{ display: "flex", gap: 12, marginBottom: 40 }}>
              <button style={{ background: p.accent, color: "#0B1220", border: "none", padding: "17px 30px", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: font, boxShadow: `0 12px 32px ${p.accent}88, 0 0 0 1px ${p.accent}22`, position: "relative" }}>
                Criar conta grátis →
              </button>
              <button style={{ background: "rgba(255,255,255,0.08)", color: p.heroFg, border: "1px solid rgba(255,255,255,0.25)", padding: "17px 30px", borderRadius: 14, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
                ▷ Ver demo 90s
              </button>
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
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 14 }}>Como funciona</div>
            <h2 style={{ fontSize: 44, fontWeight: 800, color: p.text, margin: 0, letterSpacing: "-0.025em" }}>3 passos. Nada de planilha.</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
            {[
              { n: "01", t: "Conecte seus bancos", d: "Via Open Finance autorizado pelo BCB. Transações chegam sozinhas, sem digitação." },
              { n: "02", t: "Convide sua família", d: "Parceiro, filhos, contador. Cada um com papel próprio e privacidade respeitada." },
              { n: "03", t: "Acompanhe junto", d: "Visão única ou família. Rateio claro. Aprovação de despesa. Tudo num só lugar." },
            ].map((step) => (
              <div key={step.n} style={{ position: "relative" }}>
                <div style={{ fontSize: 72, fontWeight: 900, color: p.primary, opacity: 0.12, lineHeight: 1, letterSpacing: "-0.04em", marginBottom: 16 }}>{step.n}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: p.text, marginBottom: 10, letterSpacing: "-0.01em" }}>{step.t}</div>
                <div style={{ fontSize: 15, color: p.textMuted, lineHeight: 1.6 }}>{step.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LIVE ACTIVITY FEED */}
      <LiveActivity p={p} font={font} />

      {/* VEJA POR DENTRO — TABS INTERATIVAS */}
      <InsideTabs p={p} font={font} />

      {/* FEATURES BENTO */}
      <section style={{ padding: "120px 48px", background: p.bg }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64, maxWidth: 720, marginInline: "auto" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 14 }}>Recursos</div>
            <h2 style={{ fontSize: 48, fontWeight: 800, color: p.text, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.05, marginBottom: 16 }}>
              Tudo que casal e família precisam.
              <br />
              <span style={{ color: p.primary }}>Nada que confunda.</span>
            </h2>
            <p style={{ fontSize: 18, color: p.textMuted, lineHeight: 1.5, margin: 0 }}>
              Aplicativos foram feitos pra solteiro. Pontes foi feito pra família brasileira.
            </p>
          </div>

          {/* Bento grid 4x2 com tamanhos mistos */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 20, minHeight: 560 }}>
            {/* Card grande — Rateio */}
            <div style={{ gridColumn: "1 / 2", gridRow: "1 / 3", background: p.surface, border: `1px solid ${p.border}`, borderRadius: 22, padding: 40, display: "flex", flexDirection: "column" }}>
              <div style={{ marginBottom: 28 }}><FeatureIllustration kind="rateio" p={p} /></div>
              <div style={{ fontSize: 26, fontWeight: 800, color: p.text, marginBottom: 12, letterSpacing: "-0.02em" }}>Rateio explícito.<br />Sem &quot;achismo&quot;.</div>
              <div style={{ fontSize: 16, color: p.textMuted, lineHeight: 1.55, marginBottom: 24 }}>
                50/50, por porcentagem, valor fixo ou consumo real. Cada despesa cai pra quem deve, com histórico de quem decidiu o quê.
              </div>
              {/* Mini-mockup do rateio */}
              <div style={{ marginTop: "auto", background: p.bg, border: `1px solid ${p.border}`, borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Conta de luz</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: p.text, marginBottom: 14 }}>R$ 240,00</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, background: p.primary, color: "#FFFFFF", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, opacity: 0.75 }}>Gustavo · 60%</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>R$ 144</div>
                  </div>
                  <div style={{ flex: 1, background: p.accent, color: "#0B1220", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, opacity: 0.75 }}>Parceira · 40%</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>R$ 96</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card médio — Família */}
            <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 22, padding: 28 }}>
              <div style={{ marginBottom: 18 }}><FeatureIllustration kind="familia" p={p} /></div>
              <div style={{ fontSize: 18, fontWeight: 700, color: p.text, marginBottom: 8, letterSpacing: "-0.01em" }}>Família com papéis</div>
              <div style={{ fontSize: 14, color: p.textMuted, lineHeight: 1.55 }}>Convide parceiro, filhos e contador. Cada um vê só o que precisa.</div>
            </div>

            {/* Card médio — Visão */}
            <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 22, padding: 28 }}>
              <div style={{ marginBottom: 18 }}><FeatureIllustration kind="visao" p={p} /></div>
              <div style={{ fontSize: 18, fontWeight: 700, color: p.text, marginBottom: 8, letterSpacing: "-0.01em" }}>6 KPIs do mês</div>
              <div style={{ fontSize: 14, color: p.textMuted, lineHeight: 1.55 }}>Receitas, despesas, pago, a pagar, recebido, a receber.</div>
            </div>

            {/* Card médio — Cartão */}
            <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 22, padding: 28 }}>
              <div style={{ marginBottom: 18 }}><FeatureIllustration kind="cartao" p={p} /></div>
              <div style={{ fontSize: 18, fontWeight: 700, color: p.text, marginBottom: 8, letterSpacing: "-0.01em" }}>Cartão na régua</div>
              <div style={{ fontSize: 14, color: p.textMuted, lineHeight: 1.55 }}>Fatura aberta, fechada, paga. Limite real em barra.</div>
            </div>

            {/* Card médio com fundo destaque — Recorrente */}
            <div style={{ background: p.primary, color: p.heroFg, borderRadius: 22, padding: 28 }}>
              <div style={{ marginBottom: 18 }}>
                <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                  <path d="M20 22 A14 14 0 1 1 18 42" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M18 16 L18 24 L26 24" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  <circle cx="32" cy="32" r="6" fill={p.accent} />
                </svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>Recorrente sem dor</div>
              <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.55 }}>Aluguel, streaming, salário. Cadastra uma vez.</div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARATIVO */}
      <section style={{ padding: "120px 48px", background: p.surface }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 42, fontWeight: 800, color: p.text, margin: 0, letterSpacing: "-0.025em" }}>
              Por que <span style={{ color: p.primary }}>Pontes</span> e não os outros
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

      {/* TESTIMONIALS GRID */}
      <section style={{ padding: "120px 48px", background: p.bg }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 14 }}>Quem usa, fala</div>
            <h2 style={{ fontSize: 42, fontWeight: 800, color: p.text, margin: 0, letterSpacing: "-0.025em" }}>Famílias reais. Resultados reais.</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {[
              { name: "Ricardo Moraes", role: "Casal · SP", quote: "Eu e minha esposa vivíamos discutindo dinheiro. Em duas semanas paramos. Tudo virou explícito." },
              { name: "Ana Pereira", role: "Família com filhos · RJ", quote: "Finalmente um app que entende que minha família não é uma planilha. O rateio mudou a casa." },
              { name: "Carlos Silveira", role: "Contador · MG", quote: "Acompanho 12 clientes pelo Pontes. Em vez de cobrar PDF, vejo em tempo real. Mudou meu fluxo." },
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
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${p.primary}, ${p.accent})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontWeight: 700, fontSize: 14 }}>
                    {t.name.split(" ").map((n) => n[0]).join("").slice(0,2)}
                  </div>
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
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 14 }}>Planos</div>
            <h2 style={{ fontSize: 44, fontWeight: 800, color: p.text, margin: 0, letterSpacing: "-0.025em", marginBottom: 12 }}>Sem pegadinha. Pra todo bolso.</h2>
            <p style={{ fontSize: 17, color: p.textMuted, marginBottom: 24 }}>Começa grátis. Cresce com você.</p>

            {/* Toggle mensal/anual */}
            <div style={{ display: "inline-flex", background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: 4 }}>
              <button onClick={() => setAnnual(false)} style={{ background: !annual ? p.primary : "transparent", color: !annual ? p.heroFg : p.textMuted, border: "none", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
                Mensal
              </button>
              <button onClick={() => setAnnual(true)} style={{ background: annual ? p.primary : "transparent", color: annual ? p.heroFg : p.textMuted, border: "none", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", gap: 8 }}>
                Anual <span style={{ background: p.accent, color: "#0B1220", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800 }}>-20%</span>
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            <PriceCard p={p} font={font} name="Solo" price="Grátis" period="" tagline="Pra começar a organizar"
              features={["1 conta + 1 cartão", "Lançamento ilimitado", "Categorias e relatórios", "Importação OFX/CSV"]}
              cta="Criar conta" highlight={false} />
            <PriceCard p={p} font={font} name="Família" price={annual ? "R$ 15" : "R$ 19"} period="/mês" tagline="Casal + dependentes"
              features={["Tudo do Solo", "Até 6 membros", "Rateio e aprovação", "Metas conjuntas", "Suporte por chat"]}
              cta="Escolher Família" highlight={true} note={annual ? "Cobrado anualmente · R$ 180" : "Cobrado mensalmente"} />
            <PriceCard p={p} font={font} name="Contador" price={annual ? "R$ 39" : "R$ 49"} period="/mês" tagline="Pra profissionais"
              features={["Tudo do Família", "Até 20 clientes", "Dashboard multi-cliente", "Relatórios contábeis", "Suporte prioritário"]}
              cta="Falar com vendas" highlight={false} note={annual ? "Cobrado anualmente · R$ 468" : "Cobrado mensalmente"} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "120px 48px", background: p.bg }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 40, fontWeight: 800, color: p.text, margin: 0, letterSpacing: "-0.025em" }}>Perguntas frequentes</h2>
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

      {/* COMPONENTES */}
      <ComponentShowcase p={p} font={font} />

      {/* CTA FINAL */}
      <section style={{ padding: "120px 48px", background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primaryDark} 100%)`, color: p.heroFg, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <GridPattern color={p.heroFg} opacity={0.06} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: 56, fontWeight: 900, margin: 0, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 20 }}>
            Coloque sua família em Pontes.
          </h2>
          <p style={{ fontSize: 19, opacity: 0.88, marginBottom: 40, lineHeight: 1.5 }}>
            Crie sua conta em 2 minutos. Sem cartão, sem fidelidade.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button style={{ background: p.accent, color: "#0B1220", border: "none", padding: "18px 36px", borderRadius: 14, fontSize: 17, fontWeight: 700, cursor: "pointer", fontFamily: font, boxShadow: "0 12px 28px rgba(0,0,0,0.3)" }}>
              Criar conta grátis →
            </button>
            <button style={{ background: "rgba(255,255,255,0.1)", color: p.heroFg, border: "1px solid rgba(255,255,255,0.25)", padding: "18px 36px", borderRadius: 14, fontSize: 17, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
              Falar com vendas
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER com mesh gradient */}
      <footer style={{ background: "#0B1220", color: "rgba(255,255,255,0.7)", padding: "72px 48px 28px", fontFamily: font, position: "relative", overflow: "hidden" }}>
        <MeshGradient c1={p.primary} c2={p.accent} c3={p.primary} />
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr", gap: 40, marginBottom: 56, position: "relative", zIndex: 1 }}>
          <div>
            <Wordmark color="#FFFFFF" font={font} />
            <p style={{ fontSize: 14, marginTop: 16, lineHeight: 1.55, maxWidth: 280 }}>Controle financeiro pra famílias brasileiras. Casal, dependentes e contador no mesmo lugar.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <a style={{ background: "rgba(255,255,255,0.08)", padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#FFFFFF", textDecoration: "none" }}>App Store</a>
              <a style={{ background: "rgba(255,255,255,0.08)", padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#FFFFFF", textDecoration: "none" }}>Google Play</a>
            </div>
          </div>
          <FooterCol title="Produto" items={["Recursos", "Família", "Contador", "Preços", "Roadmap"]} />
          <FooterCol title="Empresa" items={["Sobre", "Blog", "Carreiras", "Imprensa", "Contato"]} />
          <FooterCol title="Recursos" items={["Central de Ajuda", "Tutoriais", "Comunidade", "Status", "API"]} />
          <FooterCol title="Legal" items={["Termos", "Privacidade", "Segurança", "LGPD"]} />
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, opacity: 0.55, position: "relative", zIndex: 1 }}>
          <div>© 2026 Pontes · CNPJ XX.XXX.XXX/0001-XX</div>
          <div>Feito no Brasil 🇧🇷</div>
        </div>
      </footer>
    </div>
  )
}

// =============================================================================
// COMPONENT SHOWCASE — design system completo (6 abas)
// =============================================================================
type TabId = "botoes" | "form" | "data" | "graficos" | "feedback" | "navegacao" | "tokens"

function ComponentShowcase({ p, font }: { p: Palette; font: string }) {
  const [tab, setTab] = useState<TabId>("botoes")
  return (
    <section style={{ padding: "120px 48px", background: p.surface, borderTop: `1px solid ${p.border}` }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 14 }}>Design system ao vivo</div>
          <h2 style={{ fontSize: 42, fontWeight: 800, color: p.text, margin: 0, letterSpacing: "-0.025em", marginBottom: 12 }}>
            Componentes do <span style={{ color: p.primary }}>app real</span>
          </h2>
          <p style={{ fontSize: 16, color: p.textMuted, margin: 0 }}>
            Tudo na paleta + fonte selecionada. Botões, inputs, tabela, toast, modal, skeleton, stepper, gráficos.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 32, flexWrap: "wrap" }}>
          {[
            { id: "botoes" as TabId, label: "Botões" },
            { id: "form" as TabId, label: "Form & Inputs" },
            { id: "data" as TabId, label: "Cards & Dados" },
            { id: "feedback" as TabId, label: "Feedback" },
            { id: "navegacao" as TabId, label: "Navegação" },
            { id: "graficos" as TabId, label: "Gráficos" },
            { id: "tokens" as TabId, label: "Tokens" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ background: tab === t.id ? p.primary : "transparent", color: tab === t.id ? p.heroFg : p.text, border: `1px solid ${tab === t.id ? p.primary : p.border}`, padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 22, padding: 36 }}>
          {tab === "botoes" && <CSButtons p={p} font={font} />}
          {tab === "form" && <CSForm p={p} font={font} />}
          {tab === "data" && <CSData p={p} font={font} />}
          {tab === "feedback" && <CSFeedback p={p} font={font} />}
          {tab === "navegacao" && <CSNavegacao p={p} font={font} />}
          {tab === "graficos" && <CSGraficos p={p} font={font} />}
          {tab === "tokens" && <CSTokens p={p} font={font} />}
        </div>
      </div>
    </section>
  )
}

function CSGroup({ title, p, children }: { title: string; p: Palette; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>{title}</div>
      <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 24 }}>
        {children}
      </div>
    </div>
  )
}

/** Hex -> HSL com ajuste de lightness e saturação. */
function adjustColor(hex: string, dl: number, ds = 0): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return hslToHex(h, Math.max(0, Math.min(1, s + ds)), Math.max(0, Math.min(1, l + dl)))
}

/** Preview de um botão num estado específico — cores forçadamente distintas. */
function StatePreview({ p, font, variant, state }: { p: Palette; font: string; variant: "primary" | "outline" | "ghost"; state: "rest" | "hover" | "focus" | "active" | "disabled" }) {
  const hoverBg = adjustColor(p.primary, 0.08)
  const activeBg = adjustColor(p.primary, -0.10)

  let style: React.CSSProperties = {
    width: "100%", padding: "12px 18px", borderRadius: 10, fontSize: 13,
    fontWeight: 600, border: "none", cursor: "pointer", fontFamily: font,
    transition: "all 150ms ease",
  }

  if (variant === "primary") {
    if (state === "rest") style = { ...style, background: p.primary, color: p.heroFg }
    if (state === "hover") style = { ...style, background: hoverBg, color: p.heroFg, boxShadow: `0 8px 20px ${p.primary}55`, transform: "translateY(-1px)" }
    if (state === "focus") style = { ...style, background: p.primary, color: p.heroFg, boxShadow: `0 0 0 4px ${p.primary}44, 0 0 0 2px #FFFFFF inset` }
    if (state === "active") style = { ...style, background: activeBg, color: p.heroFg, transform: "translateY(1px) scale(0.97)", boxShadow: `inset 0 2px 6px ${activeBg}` }
    if (state === "disabled") style = { ...style, background: p.border, color: p.textMuted, cursor: "not-allowed", opacity: 0.7 }
  }
  if (variant === "outline") {
    if (state === "rest") style = { ...style, background: "transparent", color: p.primary, border: `1.5px solid ${p.primary}` }
    if (state === "hover") style = { ...style, background: p.primarySoft, color: p.primary, border: `1.5px solid ${p.primary}`, transform: "translateY(-1px)" }
    if (state === "focus") style = { ...style, background: "transparent", color: p.primary, border: `1.5px solid ${p.primary}`, boxShadow: `0 0 0 4px ${p.primary}33` }
    if (state === "active") style = { ...style, background: p.primary, color: p.heroFg, border: `1.5px solid ${p.primary}`, transform: "scale(0.97)" }
    if (state === "disabled") style = { ...style, background: "transparent", color: p.textMuted, border: `1.5px solid ${p.border}`, cursor: "not-allowed" }
  }
  if (variant === "ghost") {
    if (state === "rest") style = { ...style, background: "transparent", color: p.text }
    if (state === "hover") style = { ...style, background: p.bg, color: p.text }
    if (state === "focus") style = { ...style, background: "transparent", color: p.text, boxShadow: `0 0 0 3px ${p.primary}33` }
    if (state === "active") style = { ...style, background: p.border, color: p.text, transform: "scale(0.97)" }
    if (state === "disabled") style = { ...style, background: "transparent", color: p.textMuted, cursor: "not-allowed", opacity: 0.5 }
  }

  return (
    <div style={{ textAlign: "center" }}>
      <button style={style}>Botão</button>
      <div style={{ fontSize: 10, color: p.textMuted, marginTop: 8, fontWeight: 700, letterSpacing: "0.1em" }}>{state.toUpperCase()}</div>
    </div>
  )
}

function CSButtons({ p, font }: { p: Palette; font: string }) {
  const baseBtn = { border: "none", cursor: "pointer", fontFamily: font, fontWeight: 600 }
  return (
    <div>
      <CSGroup title="Variantes" p={p}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, padding: "12px 22px", borderRadius: 10, fontSize: 14, boxShadow: `0 4px 14px ${p.primary}44` }}>Primário</button>
          <button style={{ ...baseBtn, background: p.accent, color: "#0B1220", padding: "12px 22px", borderRadius: 10, fontSize: 14, boxShadow: `0 4px 14px ${p.accent}44` }}>Acento</button>
          <button style={{ ...baseBtn, background: "transparent", color: p.primary, border: `1.5px solid ${p.primary}`, padding: "12px 22px", borderRadius: 10, fontSize: 14 }}>Outline</button>
          <button style={{ ...baseBtn, background: "transparent", color: p.text, padding: "12px 22px", borderRadius: 10, fontSize: 14 }}>Ghost</button>
          <button style={{ ...baseBtn, background: p.primarySoft, color: p.primary, padding: "12px 22px", borderRadius: 10, fontSize: 14 }}>Soft</button>
          <button style={{ ...baseBtn, background: "#DC2626", color: "#FFFFFF", padding: "12px 22px", borderRadius: 10, fontSize: 14 }}>Perigo</button>
          <button style={{ ...baseBtn, background: "transparent", color: "#DC2626", border: "1.5px solid #DC2626", padding: "12px 22px", borderRadius: 10, fontSize: 14 }}>Perigo outline</button>
          <a style={{ color: p.primary, fontSize: 14, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>Link</a>
          <button disabled style={{ ...baseBtn, background: p.border, color: p.textMuted, padding: "12px 22px", borderRadius: 10, fontSize: 14, cursor: "not-allowed" }}>Desabilitado</button>
        </div>
      </CSGroup>

      <CSGroup title="Tamanhos" p={p}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, padding: "4px 10px", borderRadius: 6, fontSize: 11 }}>XS</button>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, padding: "6px 12px", borderRadius: 8, fontSize: 12 }}>Small</button>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, padding: "10px 18px", borderRadius: 10, fontSize: 14 }}>Medium</button>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, padding: "14px 26px", borderRadius: 12, fontSize: 16 }}>Large</button>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, padding: "18px 32px", borderRadius: 14, fontSize: 18 }}>XL</button>
        </div>
      </CSGroup>

      <CSGroup title="Com ícone" p={p}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, padding: "12px 22px", borderRadius: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>+</span> Nova transação
          </button>
          <button style={{ ...baseBtn, background: p.accent, color: "#0B1220", padding: "12px 22px", borderRadius: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            ↓ Importar OFX
          </button>
          <button style={{ ...baseBtn, background: "transparent", color: p.primary, border: `1.5px solid ${p.primary}`, padding: "12px 22px", borderRadius: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            Salvar e continuar →
          </button>
        </div>
      </CSGroup>

      <CSGroup title="Icon-only" p={p}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, width: 32, height: 32, borderRadius: 8, fontSize: 14 }}>+</button>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, width: 40, height: 40, borderRadius: 10, fontSize: 18 }}>+</button>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, width: 48, height: 48, borderRadius: 12, fontSize: 20 }}>+</button>
          <button style={{ ...baseBtn, background: p.primarySoft, color: p.primary, width: 40, height: 40, borderRadius: 10, fontSize: 16 }}>⚙</button>
          <button style={{ ...baseBtn, background: "transparent", border: `1px solid ${p.border}`, color: p.text, width: 40, height: 40, borderRadius: 10, fontSize: 16 }}>⋯</button>
          {/* Com badge contador */}
          <button style={{ ...baseBtn, background: "transparent", border: `1px solid ${p.border}`, color: p.text, width: 40, height: 40, borderRadius: 10, fontSize: 16, position: "relative" }}>
            🔔
            <span style={{ position: "absolute", top: -4, right: -4, background: "#DC2626", color: "#FFFFFF", borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "2px 6px", border: "2px solid #FFFFFF" }}>3</span>
          </button>
          {/* FAB */}
          <button style={{ ...baseBtn, background: p.accent, color: "#0B1220", width: 56, height: 56, borderRadius: "50%", fontSize: 24, boxShadow: `0 12px 28px ${p.accent}66`, marginLeft: 12 }}>+</button>
        </div>
      </CSGroup>

      <CSGroup title="Button group" p={p}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          {/* Segmented */}
          <div style={{ display: "inline-flex", background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, padding: 4 }}>
            <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>Dia</button>
            <button style={{ ...baseBtn, background: "transparent", color: p.text, padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>Semana</button>
            <button style={{ ...baseBtn, background: "transparent", color: p.text, padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>Mês</button>
            <button style={{ ...baseBtn, background: "transparent", color: p.text, padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>Ano</button>
          </div>
          {/* Conjunto colado */}
          <div style={{ display: "inline-flex", border: `1px solid ${p.border}`, borderRadius: 10, overflow: "hidden" }}>
            <button style={{ ...baseBtn, background: p.surface, color: p.text, padding: "10px 16px", fontSize: 13, borderRight: `1px solid ${p.border}` }}>← Anterior</button>
            <button style={{ ...baseBtn, background: p.surface, color: p.text, padding: "10px 16px", fontSize: 13, borderRight: `1px solid ${p.border}` }}>Hoje</button>
            <button style={{ ...baseBtn, background: p.surface, color: p.text, padding: "10px 16px", fontSize: 13 }}>Próximo →</button>
          </div>
        </div>
      </CSGroup>

      <CSGroup title="Estados interativos · 3 variantes" p={p}>
        {/* Cor primária */}
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 24, fontFamily: font, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", marginBottom: 14 }}>PRIMÁRIO</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
            <StatePreview p={p} font={font} variant="primary" state="rest" />
            <StatePreview p={p} font={font} variant="primary" state="hover" />
            <StatePreview p={p} font={font} variant="primary" state="focus" />
            <StatePreview p={p} font={font} variant="primary" state="active" />
            <StatePreview p={p} font={font} variant="primary" state="disabled" />
          </div>
        </div>
        {/* Outline */}
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 24, fontFamily: font, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", marginBottom: 14 }}>OUTLINE</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
            <StatePreview p={p} font={font} variant="outline" state="rest" />
            <StatePreview p={p} font={font} variant="outline" state="hover" />
            <StatePreview p={p} font={font} variant="outline" state="focus" />
            <StatePreview p={p} font={font} variant="outline" state="active" />
            <StatePreview p={p} font={font} variant="outline" state="disabled" />
          </div>
        </div>
        {/* Ghost */}
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 24, fontFamily: font }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", marginBottom: 14 }}>GHOST</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
            <StatePreview p={p} font={font} variant="ghost" state="rest" />
            <StatePreview p={p} font={font} variant="ghost" state="hover" />
            <StatePreview p={p} font={font} variant="ghost" state="focus" />
            <StatePreview p={p} font={font} variant="ghost" state="active" />
            <StatePreview p={p} font={font} variant="ghost" state="disabled" />
          </div>
        </div>
      </CSGroup>

      <CSGroup title="Estados (loading / sucesso)" p={p}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, padding: "12px 22px", borderRadius: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 14, height: 14, border: `2px solid ${p.heroFg}40`, borderTopColor: p.heroFg, borderRadius: "50%", animation: "bp-spin 0.7s linear infinite", display: "inline-block" }} />
            Salvando...
          </button>
          <button style={{ ...baseBtn, background: "#10B981", color: "#FFFFFF", padding: "12px 22px", borderRadius: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            ✓ Salvo
          </button>
          <button style={{ ...baseBtn, background: p.primary, color: p.heroFg, padding: "12px 22px", borderRadius: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 8, position: "relative", overflow: "hidden" }}>
            <span style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent, ${p.heroFg}22, transparent)`, animation: "bp-shimmer 2s linear infinite", backgroundSize: "200% 100%" }} />
            <span style={{ position: "relative" }}>Processando pagamento</span>
          </button>
        </div>
      </CSGroup>
    </div>
  )
}

// =============================================================================
// CS FEEDBACK — toast, modal, alert, skeleton, empty, dialog
// =============================================================================
function CSFeedback({ p, font }: { p: Palette; font: string }) {
  const [openModal, setOpenModal] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  return (
    <div>
      <CSGroup title="Toast notifications" p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
          {[
            { c: "#10B981", icon: "✓", title: "Despesa salva", sub: "R$ 142,30 · Mercado · Nubank", time: "agora" },
            { c: p.primary, icon: "ℹ", title: "Maria comentou", sub: "Sobre a conta de luz", time: "1 min" },
            { c: "#F59E0B", icon: "⚠", title: "Limite do cartão", sub: "Atingiu 85% do limite Nubank", time: "5 min" },
            { c: "#DC2626", icon: "✕", title: "Erro ao sincronizar", sub: "Tentando reconectar...", time: "10 min" },
          ].map((t) => (
            <div key={t.title} style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.08)", fontFamily: font }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: t.c, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{t.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{t.title}</div>
                <div style={{ fontSize: 11, color: p.textMuted }}>{t.sub}</div>
              </div>
              <div style={{ fontSize: 11, color: p.textMuted }}>{t.time}</div>
              <button style={{ background: "transparent", border: "none", color: p.textMuted, cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Modal / Dialog (clique pra abrir)" p={p}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => setOpenModal(true)} style={{ background: p.primary, color: p.heroFg, border: "none", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Abrir modal</button>
          <button onClick={() => setOpenDialog(true)} style={{ background: "#DC2626", color: "#FFFFFF", border: "none", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Diálogo de confirmação</button>
        </div>

        {openModal && (
          <div onClick={() => setOpenModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(11,18,32,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", animation: "bp-fade-up 200ms ease-out" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: p.surface, borderRadius: 18, padding: 0, maxWidth: 480, width: "90%", boxShadow: "0 30px 80px rgba(0,0,0,0.4)", fontFamily: font, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: `1px solid ${p.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: p.text }}>Nova transação</div>
                <button onClick={() => setOpenModal(false)} style={{ background: "transparent", border: "none", fontSize: 20, color: p.textMuted, cursor: "pointer" }}>×</button>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: p.text, marginBottom: 6, display: "block" }}>Descrição</label>
                  <input style={{ width: "100%", border: `1px solid ${p.border}`, padding: "10px 12px", borderRadius: 8, fontSize: 14, fontFamily: font, background: p.surface, color: p.text, outline: "none", boxSizing: "border-box" }} placeholder="Ex: Almoço com Maria" />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: p.text, marginBottom: 6, display: "block" }}>Valor</label>
                  <input style={{ width: "100%", border: `1px solid ${p.border}`, padding: "10px 12px", borderRadius: 8, fontSize: 24, fontWeight: 700, fontFamily: font, background: p.surface, color: p.text, outline: "none", boxSizing: "border-box" }} defaultValue="R$ 0,00" />
                </div>
              </div>
              <div style={{ padding: "16px 24px", background: p.bg, display: "flex", justifyContent: "flex-end", gap: 10, borderTop: `1px solid ${p.border}` }}>
                <button onClick={() => setOpenModal(false)} style={{ background: "transparent", color: p.text, border: `1px solid ${p.border}`, padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Cancelar</button>
                <button onClick={() => setOpenModal(false)} style={{ background: p.primary, color: p.heroFg, border: "none", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Salvar transação</button>
              </div>
            </div>
          </div>
        )}

        {openDialog && (
          <div onClick={() => setOpenDialog(false)} style={{ position: "fixed", inset: 0, background: "rgba(11,18,32,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", animation: "bp-fade-up 200ms ease-out" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: p.surface, borderRadius: 18, padding: 28, maxWidth: 400, width: "90%", boxShadow: "0 30px 80px rgba(0,0,0,0.4)", fontFamily: font, textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>⚠</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: p.text, marginBottom: 8 }}>Excluir transação?</div>
              <div style={{ fontSize: 14, color: p.textMuted, lineHeight: 1.5, marginBottom: 24 }}>Esta ação não pode ser desfeita. A transação será removida permanentemente.</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setOpenDialog(false)} style={{ flex: 1, background: "transparent", color: p.text, border: `1px solid ${p.border}`, padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Cancelar</button>
                <button onClick={() => setOpenDialog(false)} style={{ flex: 1, background: "#DC2626", color: "#FFFFFF", border: "none", padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Sim, excluir</button>
              </div>
            </div>
          </div>
        )}
      </CSGroup>

      <CSGroup title="Skeleton (loading)" p={p}>
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 20, maxWidth: 480 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 2 ? `1px solid ${p.border}` : "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(90deg, ${p.bg} 25%, ${p.border} 50%, ${p.bg} 75%)`, backgroundSize: "200% 100%", animation: "bp-shimmer 1.5s infinite linear" }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: "60%", height: 12, borderRadius: 4, background: `linear-gradient(90deg, ${p.bg} 25%, ${p.border} 50%, ${p.bg} 75%)`, backgroundSize: "200% 100%", animation: "bp-shimmer 1.5s infinite linear", marginBottom: 6 }} />
                <div style={{ width: "40%", height: 10, borderRadius: 4, background: `linear-gradient(90deg, ${p.bg} 25%, ${p.border} 50%, ${p.bg} 75%)`, backgroundSize: "200% 100%", animation: "bp-shimmer 1.5s infinite linear" }} />
              </div>
              <div style={{ width: 60, height: 14, borderRadius: 4, background: `linear-gradient(90deg, ${p.bg} 25%, ${p.border} 50%, ${p.bg} 75%)`, backgroundSize: "200% 100%", animation: "bp-shimmer 1.5s infinite linear" }} />
            </div>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Empty state" p={p}>
        <div style={{ background: p.surface, border: `1px dashed ${p.border}`, borderRadius: 14, padding: 48, textAlign: "center", maxWidth: 480 }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 16px", background: p.primarySoft, color: p.primary, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: p.text, marginBottom: 6 }}>Nenhuma transação ainda</div>
          <div style={{ fontSize: 13, color: p.textMuted, marginBottom: 18, lineHeight: 1.5 }}>Adicione manualmente ou conecte uma conta pra importar tudo.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button style={{ background: p.primary, color: p.heroFg, border: "none", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>+ Nova transação</button>
            <button style={{ background: "transparent", color: p.primary, border: `1px solid ${p.primary}`, padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Conectar banco</button>
          </div>
        </div>
      </CSGroup>

      <CSGroup title="Loading dots" p={p}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              width: 10, height: 10, borderRadius: "50%", background: p.primary,
              animation: `bp-glow 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Drawer lateral (mockup)" p={p}>
        <div style={{ background: p.bg, borderRadius: 14, padding: 20, position: "relative", overflow: "hidden", minHeight: 280, border: `1px solid ${p.border}` }}>
          <div style={{ fontSize: 13, color: p.textMuted, marginBottom: 12 }}>Conteúdo da página atrás do drawer →</div>
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 320, background: p.surface, borderLeft: `1px solid ${p.border}`, boxShadow: "-12px 0 28px rgba(0,0,0,0.08)", padding: 24, fontFamily: font }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: p.text }}>Detalhes da transação</div>
              <button style={{ background: "transparent", border: "none", color: p.textMuted, fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ background: p.bg, padding: 14, borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", marginBottom: 4, textTransform: "uppercase" }}>Valor</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#DC2626" }}>- R$ 142,30</div>
            </div>
            <div style={{ fontSize: 12, color: p.textMuted, marginBottom: 4 }}>Descrição</div>
            <div style={{ fontSize: 14, color: p.text, fontWeight: 600, marginBottom: 14 }}>Mercado Pão de Açúcar</div>
            <div style={{ fontSize: 12, color: p.textMuted, marginBottom: 4 }}>Conta</div>
            <div style={{ fontSize: 14, color: p.text, fontWeight: 600 }}>Nubank · final 4218</div>
          </div>
        </div>
      </CSGroup>

      <CSGroup title="Tooltip / Popover" p={p}>
        <div style={{ display: "flex", gap: 40, alignItems: "center", padding: 40, background: p.surface, borderRadius: 14, border: `1px solid ${p.border}` }}>
          {/* Tooltip */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <button style={{ background: p.primary, color: p.heroFg, border: "none", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Hover sobre mim</button>
            <div style={{ position: "absolute", top: -42, left: "50%", transform: "translateX(-50%)", background: p.text, color: "#FFFFFF", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", fontFamily: font }}>
              Atalho: ⌘N
              <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 8, height: 8, background: p.text }} />
            </div>
          </div>

          {/* Popover */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <button style={{ background: "transparent", color: p.text, border: `1px solid ${p.border}`, padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>⋯ Mais ações</button>
            <div style={{ position: "absolute", top: 48, left: 0, background: p.surface, border: `1px solid ${p.border}`, borderRadius: 10, boxShadow: "0 12px 28px rgba(0,0,0,0.15)", padding: 6, minWidth: 200, fontFamily: font, zIndex: 5 }}>
              {[
                { i: "✎", label: "Editar" },
                { i: "↗", label: "Duplicar" },
                { i: "🔗", label: "Compartilhar" },
                { i: "✕", label: "Excluir", danger: true },
              ].map((item, idx, arr) => (
                <div key={item.label}>
                  {item.danger && idx > 0 && <div style={{ height: 1, background: p.border, margin: "4px 0" }} />}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", fontSize: 13, color: item.danger ? "#DC2626" : p.text, cursor: "pointer", borderRadius: 6 }}>
                    <span>{item.i}</span>
                    <span>{item.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CSGroup>
    </div>
  )
}

// =============================================================================
// CS NAVEGACAO — tabs, stepper, breadcrumb, pagination, command palette
// =============================================================================
function CSNavegacao({ p, font }: { p: Palette; font: string }) {
  const [pillTab, setPillTab] = useState("Visão geral")
  const [underTab, setUnderTab] = useState("Transações")
  const [page, setPage] = useState(3)
  return (
    <div>
      <CSGroup title="Breadcrumb" p={p}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontFamily: font }}>
          <a style={{ color: p.textMuted, textDecoration: "none" }}>Início</a>
          <span style={{ color: p.textMuted }}>/</span>
          <a style={{ color: p.textMuted, textDecoration: "none" }}>Família</a>
          <span style={{ color: p.textMuted }}>/</span>
          <a style={{ color: p.textMuted, textDecoration: "none" }}>Membros</a>
          <span style={{ color: p.textMuted }}>/</span>
          <span style={{ color: p.text, fontWeight: 600 }}>Maria Silva</span>
        </div>
      </CSGroup>

      <CSGroup title="Tabs — pills" p={p}>
        <div style={{ display: "flex", gap: 6 }}>
          {["Visão geral", "Transações", "Categorias", "Relatórios"].map((t) => (
            <button key={t} onClick={() => setPillTab(t)} style={{ background: pillTab === t ? p.primary : "transparent", color: pillTab === t ? p.heroFg : p.text, border: `1px solid ${pillTab === t ? p.primary : p.border}`, padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>{t}</button>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Tabs — underline" p={p}>
        <div style={{ borderBottom: `1px solid ${p.border}`, display: "flex", gap: 28 }}>
          {["Transações", "Faturas", "Recorrentes", "Parcelamentos"].map((t) => (
            <button key={t} onClick={() => setUnderTab(t)} style={{ background: "none", border: "none", padding: "10px 0", fontSize: 14, fontWeight: 600, color: underTab === t ? p.primary : p.textMuted, borderBottom: `2px solid ${underTab === t ? p.primary : "transparent"}`, marginBottom: "-1px", cursor: "pointer", fontFamily: font }}>{t}</button>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Stepper" p={p}>
        <div style={{ display: "flex", alignItems: "center", gap: 0, maxWidth: 700 }}>
          {[
            { n: 1, label: "Dados", done: true },
            { n: 2, label: "Categoria", done: true },
            { n: 3, label: "Confirmação", done: false, current: true },
            { n: 4, label: "Pronto", done: false },
          ].map((s, i, arr) => (
            <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < arr.length - 1 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 90 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: s.done ? p.primary : s.current ? p.surface : p.bg,
                  color: s.done ? p.heroFg : s.current ? p.primary : p.textMuted,
                  border: s.current ? `2px solid ${p.primary}` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                  boxShadow: s.current ? `0 0 0 4px ${p.primary}22` : undefined,
                }}>
                  {s.done ? "✓" : s.n}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: s.done || s.current ? p.text : p.textMuted, fontFamily: font }}>{s.label}</div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ flex: 1, height: 2, background: s.done ? p.primary : p.border, marginBottom: 22 }} />
              )}
            </div>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Pagination" p={p}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => setPage(Math.max(1, page - 1))} style={{ background: "transparent", border: `1px solid ${p.border}`, color: p.text, width: 36, height: 36, borderRadius: 8, cursor: "pointer", fontFamily: font }}>‹</button>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setPage(n)} style={{ background: page === n ? p.primary : "transparent", color: page === n ? p.heroFg : p.text, border: `1px solid ${page === n ? p.primary : p.border}`, width: 36, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>{n}</button>
          ))}
          <span style={{ color: p.textMuted, padding: "0 8px" }}>…</span>
          <button style={{ background: "transparent", border: `1px solid ${p.border}`, color: p.text, width: 36, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>24</button>
          <button onClick={() => setPage(page + 1)} style={{ background: "transparent", border: `1px solid ${p.border}`, color: p.text, width: 36, height: 36, borderRadius: 8, cursor: "pointer", fontFamily: font }}>›</button>
          <span style={{ color: p.textMuted, fontSize: 13, marginLeft: 14, fontFamily: font }}>Mostrando 21–30 de 240</span>
        </div>
      </CSGroup>

      <CSGroup title="Command palette (estilo Cmd+K)" p={p}>
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 0, maxWidth: 540, boxShadow: "0 20px 50px rgba(0,0,0,0.18)", overflow: "hidden", fontFamily: font }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${p.border}` }}>
            <span style={{ color: p.textMuted, fontSize: 16 }}>🔍</span>
            <input style={{ flex: 1, border: "none", background: "transparent", fontSize: 15, fontFamily: font, color: p.text, outline: "none" }} placeholder="Buscar transação, categoria, ação..." defaultValue="luz" />
            <span style={{ fontSize: 11, color: p.textMuted, background: p.bg, padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>ESC</span>
          </div>
          <div>
            {[
              { icon: "⚡", label: "Conta de luz · R$ 240,00", hint: "Transação · 18/05" },
              { icon: "💡", label: "Categoria: Energia elétrica", hint: "Ir pra categoria" },
              { icon: "✦", label: "Nova despesa — Conta de luz", hint: "Ação rápida" },
            ].map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", cursor: "pointer", background: i === 0 ? p.primarySoft : "transparent" }}>
                <span style={{ fontSize: 18 }}>{it.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: p.text, fontWeight: 600 }}>{it.label}</div>
                  <div style={{ fontSize: 11, color: p.textMuted }}>{it.hint}</div>
                </div>
                {i === 0 && <span style={{ fontSize: 11, color: p.textMuted, background: p.surface, padding: "2px 8px", borderRadius: 6, fontWeight: 600, border: `1px solid ${p.border}` }}>⏎</span>}
              </div>
            ))}
          </div>
        </div>
      </CSGroup>
    </div>
  )
}

/** Select custom totalmente estilizado. */
function PontesSelect({ p, font, options, value, onChange, placeholder = "Selecione" }: { p: Palette; font: string; options: string[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} type="button"
        style={{ width: "100%", border: `1px solid ${open ? p.primary : p.border}`, padding: "12px 14px", borderRadius: 10, fontSize: 14, fontFamily: font, background: p.surface, color: value ? p.text : p.textMuted, outline: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: open ? `0 0 0 3px ${p.primary}22` : undefined }}>
        <span>{value || placeholder}</span>
        <span style={{ color: p.textMuted, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: p.surface, border: `1px solid ${p.border}`, borderRadius: 10, boxShadow: "0 12px 28px rgba(0,0,0,0.12)", overflow: "hidden", zIndex: 50 }}>
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false) }}
              style={{ width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 14, color: p.text, background: opt === value ? p.primarySoft : "transparent", border: "none", cursor: "pointer", fontFamily: font, display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseEnter={(e) => { if (opt !== value) (e.currentTarget as HTMLElement).style.background = p.bg }}
              onMouseLeave={(e) => { if (opt !== value) (e.currentTarget as HTMLElement).style.background = "transparent" }}>
              <span>{opt}</span>
              {opt === value && <span style={{ color: p.primary, fontWeight: 700 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CSForm({ p, font }: { p: Palette; font: string }) {
  const inputBase = { width: "100%", border: `1px solid ${p.border}`, padding: "12px 14px", borderRadius: 10, fontSize: 14, fontFamily: font, background: p.surface, color: p.text, outline: "none", boxSizing: "border-box" as const }
  const [categoria, setCategoria] = useState("Mercado")
  const [conta, setConta] = useState("Nubank")
  const [notifOn, setNotifOn] = useState(true)
  const [darkOn, setDarkOn] = useState(false)
  const [rememberOn, setRememberOn] = useState(true)
  const [termsOn, setTermsOn] = useState(false)
  const [period, setPeriod] = useState<"mensal" | "anual">("mensal")

  return (
    <div>
      <CSGroup title="Inputs" p={p}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 6, display: "block" }}>E-mail</label>
            <input style={inputBase} placeholder="voce@email.com" onFocus={(e) => { e.currentTarget.style.borderColor = p.primary; e.currentTarget.style.boxShadow = `0 0 0 3px ${p.primary}22` }} onBlur={(e) => { e.currentTarget.style.borderColor = p.border; e.currentTarget.style.boxShadow = "" }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 6, display: "block" }}>Senha</label>
            <input type="password" style={inputBase} defaultValue="senha123" onFocus={(e) => { e.currentTarget.style.borderColor = p.primary; e.currentTarget.style.boxShadow = `0 0 0 3px ${p.primary}22` }} onBlur={(e) => { e.currentTarget.style.borderColor = p.border; e.currentTarget.style.boxShadow = "" }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 6, display: "block" }}>Valor</label>
            <input style={{ ...inputBase, fontSize: 24, fontWeight: 700, color: p.text }} defaultValue="R$ 1.240,00" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 6, display: "block" }}>Buscar</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: p.textMuted }}>🔍</span>
              <input style={{ ...inputBase, paddingLeft: 38 }} placeholder="Buscar transação..." />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#DC2626", marginBottom: 6, display: "block" }}>Com erro</label>
            <input style={{ ...inputBase, borderColor: "#DC2626", background: "#FEF2F2" }} defaultValue="email-invalido" />
            <div style={{ fontSize: 12, color: "#DC2626", marginTop: 6 }}>E-mail inválido</div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 6, display: "block" }}>Categoria</label>
            <PontesSelect p={p} font={font} options={["Mercado", "Lazer", "Casa", "Transporte", "Assinatura", "Saúde", "Outros"]} value={categoria} onChange={setCategoria} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 6, display: "block" }}>Conta</label>
            <PontesSelect p={p} font={font} options={["Nubank", "Itaú", "Bradesco", "Banco do Brasil", "Inter", "C6 Bank", "Carteira"]} value={conta} onChange={setConta} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 6, display: "block" }}>Textarea</label>
            <textarea style={{ ...inputBase, resize: "none", minHeight: 80 }} placeholder="Observação..." />
          </div>
        </div>
      </CSGroup>

      <CSGroup title="Money input gigante" p={p}>
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 24, maxWidth: 380 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.12em", marginBottom: 8, textTransform: "uppercase" }}>Valor da transação</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 28, color: p.textMuted, fontWeight: 600 }}>R$</span>
            <input style={{ fontSize: 48, fontWeight: 800, color: p.text, border: "none", background: "transparent", outline: "none", letterSpacing: "-0.025em", width: "100%", fontFamily: font }} defaultValue="1.240,00" />
          </div>
          <div style={{ height: 1, background: p.border, marginTop: 8 }} />
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            {["+100", "+500", "+1.000", "+5.000"].map((s) => (
              <button key={s} style={{ flex: 1, background: p.bg, color: p.text, border: `1px solid ${p.border}`, padding: "6px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>{s}</button>
            ))}
          </div>
        </div>
      </CSGroup>

      <CSGroup title="OTP code input" p={p}>
        <div style={{ display: "flex", gap: 10 }}>
          {["8", "3", "5", "", "", ""].map((d, i) => (
            <div key={i} style={{
              width: 52, height: 60, border: `2px solid ${i === 3 ? p.primary : p.border}`,
              borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, fontWeight: 800, color: p.text, fontFamily: font, background: p.surface,
              boxShadow: i === 3 ? `0 0 0 4px ${p.primary}22` : undefined, position: "relative",
            }}>
              {d}
              {i === 3 && <span style={{ position: "absolute", width: 2, height: 28, background: p.primary, animation: "bp-glow 1s infinite" }} />}
            </div>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Range slider" p={p}>
        <div style={{ maxWidth: 480, background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 13 }}>
            <span style={{ color: p.textMuted }}>Limite mensal</span>
            <span style={{ color: p.text, fontWeight: 700 }}>R$ 4.500</span>
          </div>
          <div style={{ position: "relative", height: 24, display: "flex", alignItems: "center" }}>
            <div style={{ position: "absolute", left: 0, right: 0, height: 6, background: p.bg, borderRadius: 999 }} />
            <div style={{ position: "absolute", left: 0, width: "55%", height: 6, background: p.primary, borderRadius: 999 }} />
            <div style={{ position: "absolute", left: "55%", transform: "translateX(-50%)", width: 22, height: 22, background: "#FFFFFF", border: `2px solid ${p.primary}`, borderRadius: "50%", boxShadow: `0 4px 12px ${p.primary}44`, cursor: "grab" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: p.textMuted }}>
            <span>R$ 0</span>
            <span>R$ 8.000</span>
          </div>
        </div>
      </CSGroup>

      <CSGroup title="Date picker (mini calendar)" p={p}>
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 18, maxWidth: 320, fontFamily: font }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <button style={{ background: "transparent", border: "none", color: p.text, fontSize: 16, cursor: "pointer", padding: 4 }}>‹</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>Maio 2026</div>
            <button style={{ background: "transparent", border: "none", color: p.text, fontSize: 16, cursor: "pointer", padding: 4 }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <div key={i} style={{ fontSize: 11, color: p.textMuted, fontWeight: 700, textAlign: "center", padding: 4 }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {[null, null, null, null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].map((d, i) => {
              const isToday = d === 20
              const isSelected = d === 13
              const hasEvent = d === 10 || d === 18 || d === 25
              return (
                <button key={i} disabled={!d} style={{
                  aspectRatio: "1", border: "none", cursor: d ? "pointer" : "default",
                  background: isToday ? p.primary : isSelected ? p.primarySoft : "transparent",
                  color: isToday ? p.heroFg : isSelected ? p.primary : d ? p.text : "transparent",
                  borderRadius: 8, fontSize: 12, fontWeight: isToday || isSelected ? 700 : 500, fontFamily: font,
                  position: "relative",
                }}>
                  {d}
                  {hasEvent && <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: p.accent }} />}
                </button>
              )
            })}
          </div>
        </div>
      </CSGroup>

      <CSGroup title="File upload drop zone" p={p}>
        <div style={{ background: p.surface, border: `2px dashed ${p.primary}`, borderRadius: 14, padding: 32, textAlign: "center", maxWidth: 480 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: p.primarySoft, color: p.primary, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>↑</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: p.text, marginBottom: 4 }}>Arraste seu arquivo OFX aqui</div>
          <div style={{ fontSize: 13, color: p.textMuted, marginBottom: 16 }}>ou <a style={{ color: p.primary, fontWeight: 600, cursor: "pointer" }}>clique pra selecionar</a></div>
          <div style={{ fontSize: 11, color: p.textMuted }}>OFX, CSV, QIF · até 10MB</div>
        </div>
      </CSGroup>

      <CSGroup title="Tag input com chips removíveis" p={p}>
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", maxWidth: 480 }}>
          {["Família", "Mensal", "Recorrente"].map((tag) => (
            <span key={tag} style={{ background: p.primarySoft, color: p.primary, padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, fontFamily: font }}>
              {tag}
              <button style={{ background: "transparent", border: "none", color: p.primary, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
          <input style={{ flex: 1, minWidth: 100, border: "none", background: "transparent", padding: "6px 8px", fontSize: 13, color: p.text, outline: "none", fontFamily: font }} placeholder="Adicionar tag..." />
        </div>
      </CSGroup>

      <CSGroup title="Color picker" p={p}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 320 }}>
          {[p.primary, p.accent, "#10B981", "#F59E0B", "#DC2626", "#3B82F6", "#A855F7", "#EC4899", "#14B8A6", "#64748B"].map((c, i) => (
            <button key={c} style={{
              width: 36, height: 36, borderRadius: 10, background: c,
              border: i === 0 ? `3px solid ${p.text}` : `2px solid ${p.surface}`,
              cursor: "pointer", boxShadow: i === 0 ? `0 0 0 2px ${c}` : `0 0 0 1px ${p.border}`,
              outline: "none",
            }} />
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Rating ★" p={p}>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill={n <= 4 ? p.accent : "none"} stroke={p.accent} strokeWidth="2">
                <path d="M12 2 L15 9 L22 9 L17 14 L19 22 L12 18 L5 22 L7 14 L2 9 L9 9 Z" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
          <span style={{ marginLeft: 10, fontSize: 14, color: p.text, fontWeight: 600, alignSelf: "center", fontFamily: font }}>4.0 de 5</span>
        </div>
      </CSGroup>

      <CSGroup title="Kbd shortcuts" p={p}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          {[
            { keys: ["⌘", "K"], label: "Busca rápida" },
            { keys: ["⌘", "N"], label: "Nova transação" },
            { keys: ["G", "D"], label: "Dashboard" },
            { keys: ["?"], label: "Atalhos" },
            { keys: ["Esc"], label: "Fechar" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {s.keys.map((k) => (
                  <kbd key={k} style={{ display: "inline-block", padding: "3px 8px", background: p.surface, border: `1px solid ${p.border}`, borderBottomWidth: 2, borderRadius: 6, fontSize: 11, fontWeight: 700, color: p.text, fontFamily: "monospace", boxShadow: "0 1px 0 rgba(0,0,0,0.05)" }}>{k}</kbd>
                ))}
              </div>
              <span style={{ fontSize: 12, color: p.textMuted, fontFamily: font }}>{s.label}</span>
            </div>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Toggle / Checkbox / Radio (clicáveis)" p={p}>
        <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setNotifOn(!notifOn)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }}>
            <div style={{ width: 40, height: 22, background: notifOn ? p.primary : p.border, borderRadius: 999, position: "relative", transition: "background 200ms" }}>
              <div style={{ position: "absolute", top: 2, left: notifOn ? 20 : 2, width: 18, height: 18, background: "#FFFFFF", borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 200ms" }} />
            </div>
            <span style={{ fontSize: 14, color: p.text }}>Notificações</span>
          </button>
          <button onClick={() => setDarkOn(!darkOn)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }}>
            <div style={{ width: 40, height: 22, background: darkOn ? p.primary : p.border, borderRadius: 999, position: "relative", transition: "background 200ms" }}>
              <div style={{ position: "absolute", top: 2, left: darkOn ? 20 : 2, width: 18, height: 18, background: "#FFFFFF", borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 200ms" }} />
            </div>
            <span style={{ fontSize: 14, color: p.text }}>Modo escuro</span>
          </button>
          <button onClick={() => setRememberOn(!rememberOn)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }}>
            {rememberOn ? (
              <div style={{ width: 20, height: 20, background: p.primary, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontSize: 14, fontWeight: 700 }}>✓</div>
            ) : (
              <div style={{ width: 20, height: 20, border: `2px solid ${p.border}`, borderRadius: 5 }} />
            )}
            <span style={{ fontSize: 14, color: p.text }}>Lembrar acesso</span>
          </button>
          <button onClick={() => setTermsOn(!termsOn)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }}>
            {termsOn ? (
              <div style={{ width: 20, height: 20, background: p.primary, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontSize: 14, fontWeight: 700 }}>✓</div>
            ) : (
              <div style={{ width: 20, height: 20, border: `2px solid ${p.border}`, borderRadius: 5 }} />
            )}
            <span style={{ fontSize: 14, color: termsOn ? p.text : p.textMuted }}>Aceitar termos</span>
          </button>
          <button onClick={() => setPeriod("mensal")} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }}>
            <div style={{ width: 20, height: 20, border: `2px solid ${period === "mensal" ? p.primary : p.border}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {period === "mensal" && <div style={{ width: 10, height: 10, background: p.primary, borderRadius: "50%" }} />}
            </div>
            <span style={{ fontSize: 14, color: period === "mensal" ? p.text : p.textMuted }}>Mensal</span>
          </button>
          <button onClick={() => setPeriod("anual")} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }}>
            <div style={{ width: 20, height: 20, border: `2px solid ${period === "anual" ? p.primary : p.border}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {period === "anual" && <div style={{ width: 10, height: 10, background: p.primary, borderRadius: "50%" }} />}
            </div>
            <span style={{ fontSize: 14, color: period === "anual" ? p.text : p.textMuted }}>Anual</span>
          </button>
        </div>
      </CSGroup>
    </div>
  )
}

function CSData({ p, font }: { p: Palette; font: string }) {
  return (
    <div>
      <CSGroup title="Chips & Badges" p={p}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ background: p.primary, color: p.heroFg, padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: font }}>Família</span>
          <span style={{ background: p.accent, color: "#0B1220", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: font }}>Pro</span>
          <span style={{ background: p.primarySoft, color: p.primary, padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: font }}>Pendente</span>
          <span style={{ background: "#D1FAE5", color: "#065F46", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: font }}>Pago</span>
          <span style={{ background: "#FEE2E2", color: "#991B1B", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: font }}>Atrasado</span>
          <span style={{ background: "#FEF3C7", color: "#92400E", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: font }}>Vence hoje</span>
          <span style={{ border: `1px solid ${p.border}`, color: p.textMuted, padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: font }}>Mercado</span>
        </div>
      </CSGroup>

      <CSGroup title="Avatares · com status dot" p={p}>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: p.primary, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>GP</div>
          {/* online */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: p.accent, color: "#0B1220", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>MS</div>
            <span style={{ position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: "50%", background: "#10B981", border: `2px solid ${p.surface}` }} />
          </div>
          {/* away */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg, ${p.primary}, ${p.accent})`, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>LP</div>
            <span style={{ position: "absolute", bottom: 2, right: 2, width: 14, height: 14, borderRadius: "50%", background: "#F59E0B", border: `2px solid ${p.surface}` }} />
          </div>
          {/* busy */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#94A3B8", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>+3</div>
            <span style={{ position: "absolute", bottom: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "#DC2626", border: `2px solid ${p.surface}` }} />
          </div>
          {/* Stack */}
          <div style={{ display: "flex" }}>
            {[p.primary, p.accent, "#94A3B8", "#22C55E"].map((c, i) => (
              <div key={i} style={{ width: 36, height: 36, borderRadius: "50%", background: c, marginLeft: i > 0 ? -10 : 0, border: `2px solid ${p.surface}` }} />
            ))}
          </div>
          {/* Squared rounded */}
          <div style={{ width: 40, height: 40, borderRadius: 10, background: p.primary, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>BR</div>
        </div>
      </CSGroup>

      <CSGroup title="Alerts / Banners" p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: p.primarySoft, border: `1px solid ${p.primary}40`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>ℹ</span>
            <div style={{ flex: 1, fontSize: 13, color: p.text }}><strong>Info:</strong> Sua fatura fecha em 3 dias.</div>
          </div>
          <div style={{ background: "#D1FAE5", border: "1px solid #10B98140", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <div style={{ flex: 1, fontSize: 13, color: "#065F46" }}><strong>Pago:</strong> Conta de luz paga com sucesso.</div>
          </div>
          <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B40", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>⚠</span>
            <div style={{ flex: 1, fontSize: 13, color: "#92400E" }}><strong>Atenção:</strong> Limite do cartão em 85%.</div>
          </div>
          <div style={{ background: "#FEE2E2", border: "1px solid #DC262640", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>✕</span>
            <div style={{ flex: 1, fontSize: 13, color: "#991B1B" }}><strong>Erro:</strong> Não foi possível conectar com o banco.</div>
          </div>
        </div>
      </CSGroup>

      <CSGroup title="Progress" p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "Meta de viagem", v: 45, color: p.primary },
            { label: "Limite usado", v: 78, color: p.accent },
            { label: "Reserva de emergência", v: 92, color: "#22C55E" },
          ].map((b) => (
            <div key={b.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: p.text, fontWeight: 600, fontFamily: font }}>{b.label}</span>
                <span style={{ fontSize: 13, color: p.textMuted, fontWeight: 600, fontFamily: font }}>{b.v}%</span>
              </div>
              <div style={{ height: 8, background: p.bg, borderRadius: 4 }}>
                <div style={{ width: `${b.v}%`, height: "100%", background: b.color, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Stat cards" p={p}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            { label: "Saldo total", v: "R$ 31.970", trend: "+12.4%", up: true },
            { label: "Despesas mês", v: "R$ 5.140", trend: "-3.1%", up: false },
            { label: "Receitas mês", v: "R$ 8.200", trend: "+5.8%", up: true },
            { label: "Economia", v: "R$ 3.060", trend: "+8.2%", up: true },
          ].map((s) => (
            <div key={s.label} style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 16, fontFamily: font }}>
              <div style={{ fontSize: 11, color: p.textMuted, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: p.text, letterSpacing: "-0.02em", marginBottom: 6 }}>{s.v}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: s.up ? "#16A34A" : "#DC2626" }}>{s.up ? "↑" : "↓"} {s.trend} vs mês anterior</div>
            </div>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Tabela com sort + ações" p={p}>
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, overflow: "hidden", fontFamily: font }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${p.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>Transações de maio</div>
              <div style={{ fontSize: 11, color: p.textMuted }}>247 lançamentos · R$ 5.140,00 em despesas</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ background: "transparent", color: p.text, border: `1px solid ${p.border}`, padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Filtros</button>
              <button style={{ background: p.primary, color: p.heroFg, border: "none", padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>+ Nova</button>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: p.bg, borderBottom: `1px solid ${p.border}` }}>
                {["Data ↓", "Descrição", "Categoria", "Conta", "Membro", "Valor", ""].map((h, i) => (
                  <th key={i} style={{ textAlign: i === 5 ? "right" : "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { date: "20/05", desc: "Mercado Pão de Açúcar", cat: "Mercado", account: "Nubank", member: "G", v: -142.30 },
                { date: "20/05", desc: "Salário Gustavo", cat: "Renda", account: "Itaú", member: "G", v: 4200 },
                { date: "19/05", desc: "Netflix", cat: "Lazer", account: "Nubank", member: "G", v: -55.90 },
                { date: "19/05", desc: "Conta de Luz · rateada", cat: "Casa", account: "Itaú", member: "G+M", v: -240 },
                { date: "18/05", desc: "iFood", cat: "Alimentação", account: "Nubank", member: "M", v: -68.50 },
              ].map((row, i, arr) => (
                <tr key={i} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${p.border}` : "none" }}>
                  <td style={{ padding: "12px 16px", color: p.textMuted, fontSize: 12 }}>{row.date}</td>
                  <td style={{ padding: "12px 16px", color: p.text, fontWeight: 600 }}>{row.desc}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: p.primarySoft, color: p.primary, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{row.cat}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: p.textMuted, fontSize: 12 }}>{row.account}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: p.accentSoft, color: p.text, padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{row.member}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: row.v > 0 ? "#16A34A" : "#DC2626", fontWeight: 700, textAlign: "right" }}>{row.v > 0 ? "+ " : "- "}R$ {Math.abs(row.v).toFixed(2).replace(".", ",")}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button style={{ background: "transparent", border: "none", color: p.textMuted, cursor: "pointer", padding: 4, fontSize: 16 }}>⋯</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "12px 20px", borderTop: `1px solid ${p.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: p.bg, fontSize: 12, color: p.textMuted }}>
            <span>Mostrando 5 de 247</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={{ background: "transparent", border: `1px solid ${p.border}`, color: p.text, width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontFamily: font }}>‹</button>
              <button style={{ background: "transparent", border: `1px solid ${p.border}`, color: p.text, width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontFamily: font }}>›</button>
            </div>
          </div>
        </div>
      </CSGroup>
    </div>
  )
}

function CSGraficos({ p, font }: { p: Palette; font: string }) {
  // Ritmo de gastos cumulativo — mês atual acelerou no dia 13 (compra grande), mês passado mais suave.
  // Valores realistas: família média BR gasta ~R$ 5k/mês.
  const rythmRaw = [
    { dia: 1, gastoMes: 142, gastoPrev: 89 },
    { dia: 2, gastoMes: 210, gastoPrev: 156 },
    { dia: 3, gastoMes: 380, gastoPrev: 245 },
    { dia: 4, gastoMes: 425, gastoPrev: 318 },
    { dia: 5, gastoMes: 620, gastoPrev: 412 },
    { dia: 6, gastoMes: 890, gastoPrev: 510 },
    { dia: 7, gastoMes: 1140, gastoPrev: 720 },
    { dia: 8, gastoMes: 1320, gastoPrev: 880 },
    { dia: 9, gastoMes: 1580, gastoPrev: 1050 },
    { dia: 10, gastoMes: 1820, gastoPrev: 1240 },
    { dia: 11, gastoMes: 2150, gastoPrev: 1410 },
    { dia: 12, gastoMes: 2480, gastoPrev: 1620 },
    { dia: 13, gastoMes: 3444, gastoPrev: 1840 }, // pico — compra grande
    { dia: 14, gastoMes: 3580, gastoPrev: 1990 },
    { dia: 15, gastoMes: 3720, gastoPrev: 2180 },
    { dia: 16, gastoMes: 3860, gastoPrev: 2320 },
    { dia: 17, gastoMes: 3980, gastoPrev: 2510 },
    { dia: 18, gastoMes: 4120, gastoPrev: 2680 },
    { dia: 19, gastoMes: 4280, gastoPrev: 2820 },
    { dia: 20, gastoMes: 4456, gastoPrev: 2950 },
    { dia: 21, gastoMes: null, gastoPrev: 3100 },
    { dia: 22, gastoMes: null, gastoPrev: 3210 },
    { dia: 23, gastoMes: null, gastoPrev: 3340 },
    { dia: 24, gastoMes: null, gastoPrev: 3420 },
    { dia: 25, gastoMes: null, gastoPrev: 3493 },
    { dia: 26, gastoMes: null, gastoPrev: 3493 },
    { dia: 27, gastoMes: null, gastoPrev: 3493 },
    { dia: 28, gastoMes: null, gastoPrev: 3493 },
    { dia: 29, gastoMes: null, gastoPrev: 3493 },
    { dia: 30, gastoMes: null, gastoPrev: 3493 },
    { dia: 31, gastoMes: null, gastoPrev: 3493 },
  ]
  const rythm: LinePoint[] = rythmRaw.map((r) => ({ label: r.dia, v: r.gastoMes ?? undefined, v2: r.gastoPrev } as LinePoint))

  // Categorias do mês atual (R$ 4.456 total).
  const donutData = [
    { name: "Moradia", value: 1180 },
    { name: "Mercado", value: 1840 },
    { name: "Transporte", value: 520 },
    { name: "Lazer", value: 690 },
    { name: "Saúde", value: 226 },
  ]

  // Receita vs Despesa últimos 6 meses. Salário fixo + extras. Despesas variam.
  const lineData: LinePoint[] = [
    { label: "Dez", v: 8000, v2: 6800 }, // Dez gasta mais (Natal)
    { label: "Jan", v: 8200, v2: 5400 },
    { label: "Fev", v: 8000, v2: 4600 },
    { label: "Mar", v: 8500, v2: 5000 }, // bônus março
    { label: "Abr", v: 8000, v2: 4800 },
    { label: "Mai", v: 8200, v2: 5140 },
  ]

  // Evolução do saldo últimos 8 semanas.
  const saldoData = [
    { label: "S1", v: 29800 },
    { label: "S2", v: 30420 },
    { label: "S3", v: 29950 },
    { label: "S4", v: 30880 },
    { label: "S5", v: 31200 },
    { label: "S6", v: 31040 },
    { label: "S7", v: 31650 },
    { label: "S8", v: 31970 },
  ]

  // Gastos por mês últimos 6.
  const gastosMes = [
    { label: "Dez", v: 6.8 },
    { label: "Jan", v: 5.4 },
    { label: "Fev", v: 4.6 },
    { label: "Mar", v: 5.0 },
    { label: "Abr", v: 4.8 },
    { label: "Mai", v: 5.4 },
  ]

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, fontFamily: font }}>
      {/* Ritmo de gastos — full width */}
      <div style={{ gridColumn: "1 / -1", background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Ritmo de gastos</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: p.text, letterSpacing: "-0.02em", display: "flex", alignItems: "baseline", gap: 8 }}>
              R$ 963,60 <span style={{ fontSize: 14, fontWeight: 500, color: p.textMuted }}>acima</span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FEE2E2", color: "#991B1B", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, marginTop: 8 }}>
              ↗ +27.6%
              <span style={{ color: p.textMuted, fontWeight: 500, marginLeft: 6 }}>vs R$ 3.493,82 mês anterior</span>
            </div>
          </div>
          <a style={{ color: p.primary, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>ver todas ↗</a>
        </div>
        <LineChartReal p={p} data={rythm} height={260} labelPrefix="Dia" />
        <div style={{ display: "flex", gap: 22, marginTop: 14, fontSize: 13, color: p.textMuted }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 3, background: p.accent, borderRadius: 2 }} /> Este mês
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 0, borderTop: "2.5px dashed #94A3B8" }} /> Mês passado
          </span>
        </div>
      </div>
      {/* Receita vs Despesa */}
      <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>Receita vs Despesa</div>
            <div style={{ fontSize: 11, color: p.textMuted, marginTop: 2 }}>Últimos 6 meses</div>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: p.textMuted }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 2, background: p.accent }} /> Receita
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 0, borderTop: `2px dashed #94A3B8` }} /> Despesa
            </span>
          </div>
        </div>
        <LineChartReal p={p} data={lineData} height={200} labelPrefix="" />
      </div>

      {/* Evolução do saldo */}
      <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: p.text, marginBottom: 2 }}>Evolução do saldo</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: p.text, letterSpacing: "-0.02em", marginBottom: 2 }}>R$ 31.970,00</div>
        <div style={{ fontSize: 12, color: "#16A34A", fontWeight: 600, marginBottom: 14 }}>↑ 7.3% nas últimas 8 semanas</div>
        <LineAreaChartReal p={p} data={saldoData} height={180} />
      </div>

      {/* Gastos por mês */}
      <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>Gastos por mês</div>
            <div style={{ fontSize: 11, color: p.textMuted, marginTop: 2 }}>Em milhares (R$)</div>
          </div>
          <div style={{ fontSize: 11, color: p.textMuted }}>Média: <strong style={{ color: p.text }}>R$ 5.333</strong></div>
        </div>
        <BarChartReal p={p} data={gastosMes} height={200} />
      </div>

      {/* Categorias */}
      <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>Top categorias</div>
            <div style={{ fontSize: 11, color: p.textMuted, marginTop: 2 }}>Maio 2026</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 16, alignItems: "center" }}>
          <DonutChartReal p={p} data={donutData} height={180} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {donutData.map((d, i) => {
              const colors = [p.primary, p.accent, "#94A3B8", "#22C55E", "#A78BFA"]
              const total = donutData.reduce((s, x) => s + x.value, 0)
              const pct = ((d.value / total) * 100).toFixed(0)
              return (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[i] }} />
                  <span style={{ flex: 1, color: p.text, fontWeight: 500 }}>{d.name}</span>
                  <span style={{ color: p.textMuted, fontSize: 11 }}>{pct}%</span>
                  <span style={{ fontWeight: 700, color: p.text, minWidth: 70, textAlign: "right" }}>R$ {d.value.toLocaleString("pt-BR")}</span>
                </div>
              )
            })}
            <div style={{ marginTop: 6, paddingTop: 10, borderTop: `1px solid ${p.border}`, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: p.textMuted, fontWeight: 600 }}>Total</span>
              <span style={{ fontWeight: 700, color: p.text }}>R$ 4.456</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// CS TOKENS — cor, tipografia, spacing, radii, shadows
// =============================================================================

/** Gera shades 50-900 a partir de uma cor base via HSL manipulation. */
function genShades(hex: string): { name: string; v: string }[] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  const lightnesses = [0.97, 0.92, 0.85, 0.72, 0.58, l, 0.38, 0.28, 0.18, 0.10]
  const names = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"]
  return lightnesses.map((targetL, i) => ({ name: names[i], v: hslToHex(h, s, targetL) }))
}

function hslToHex(h: number, s: number, l: number): string {
  let r: number, g: number, b: number
  if (s === 0) { r = g = b = l }
  else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p2 = 2 * l - q
    r = hue2rgb(p2, q, h + 1/3)
    g = hue2rgb(p2, q, h)
    b = hue2rgb(p2, q, h - 1/3)
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function ShadeRow({ label, hex, p }: { label: string; hex: string; p: Palette }) {
  const shades = genShades(hex)
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: p.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        {label}
        <span style={{ color: p.textMuted, fontWeight: 500, fontSize: 11, fontFamily: "monospace" }}>{hex}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
        {shades.map((s) => (
          <div key={s.name}>
            <div style={{ background: s.v, height: 48, borderRadius: 6, border: `1px solid ${p.border}` }} />
            <div style={{ fontSize: 10, color: p.textMuted, marginTop: 4, textAlign: "center", fontWeight: 600 }}>{s.name}</div>
            <div style={{ fontSize: 9, color: p.textMuted, textAlign: "center", fontFamily: "monospace", opacity: 0.7 }}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CSTokens({ p, font }: { p: Palette; font: string }) {
  return (
    <div style={{ fontFamily: font }}>
      <CSGroup title="Cores · escala 50-900" p={p}>
        <ShadeRow label="Primária" hex={p.primary} p={p} />
        <ShadeRow label="Acento" hex={p.accent} p={p} />
        <ShadeRow label="Sucesso" hex="#10B981" p={p} />
        <ShadeRow label="Atenção" hex="#F59E0B" p={p} />
        <ShadeRow label="Perigo" hex="#DC2626" p={p} />
        <ShadeRow label="Neutro" hex="#64748B" p={p} />
      </CSGroup>

      <CSGroup title="Tipografia · escala" p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 24 }}>
          {[
            { name: "display-2xl", size: 72, weight: 800, letterSpacing: "-0.04em" },
            { name: "display-xl", size: 56, weight: 800, letterSpacing: "-0.035em" },
            { name: "display-lg", size: 44, weight: 800, letterSpacing: "-0.03em" },
            { name: "h1", size: 36, weight: 700, letterSpacing: "-0.025em" },
            { name: "h2", size: 28, weight: 700, letterSpacing: "-0.02em" },
            { name: "h3", size: 22, weight: 700, letterSpacing: "-0.01em" },
            { name: "body-lg", size: 18, weight: 400 },
            { name: "body", size: 15, weight: 400 },
            { name: "body-sm", size: 13, weight: 400 },
            { name: "caption", size: 11, weight: 600, letterSpacing: "0.08em", upper: true },
          ].map((t) => (
            <div key={t.name} style={{ display: "flex", alignItems: "baseline", gap: 24, paddingBottom: 12, borderBottom: `1px solid ${p.border}` }}>
              <div style={{ minWidth: 110, fontSize: 11, color: p.textMuted, fontFamily: "monospace", fontWeight: 600 }}>
                {t.name} · {t.size}/{t.weight}
              </div>
              <div style={{ fontSize: t.size, fontWeight: t.weight, color: p.text, letterSpacing: t.letterSpacing, fontFamily: font, lineHeight: 1.1, textTransform: t.upper ? "uppercase" : undefined }}>
                Finanças em família
              </div>
            </div>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Spacing · escala 4-base" p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 24 }}>
          {[
            { name: "0", v: 0 }, { name: "1", v: 4 }, { name: "2", v: 8 }, { name: "3", v: 12 }, { name: "4", v: 16 },
            { name: "6", v: 24 }, { name: "8", v: 32 }, { name: "10", v: 40 }, { name: "12", v: 48 }, { name: "16", v: 64 }, { name: "20", v: 80 },
          ].map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ minWidth: 80, fontSize: 11, color: p.textMuted, fontFamily: "monospace", fontWeight: 600 }}>space-{s.name}</div>
              <div style={{ minWidth: 60, fontSize: 11, color: p.text, fontWeight: 600 }}>{s.v}px</div>
              <div style={{ height: 12, width: s.v || 1, background: p.primary, borderRadius: 2 }} />
            </div>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Border radius" p={p}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 24 }}>
          {[
            { name: "none", v: 0 }, { name: "sm", v: 4 }, { name: "md", v: 8 }, { name: "lg", v: 12 }, { name: "xl", v: 18 }, { name: "full", v: 999 },
          ].map((r) => (
            <div key={r.name} style={{ textAlign: "center" }}>
              <div style={{ width: 80, height: 80, background: p.primary, borderRadius: r.v, margin: "0 auto 10px" }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: p.text }}>{r.name}</div>
              <div style={{ fontSize: 11, color: p.textMuted, fontFamily: "monospace" }}>{r.v === 999 ? "9999px" : r.v + "px"}</div>
            </div>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Shadows" p={p}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, background: p.bg, padding: 32, borderRadius: 14, border: `1px solid ${p.border}` }}>
          {[
            { name: "xs", shadow: "0 1px 2px rgba(0,0,0,0.05)" },
            { name: "sm", shadow: "0 2px 4px rgba(0,0,0,0.08)" },
            { name: "md", shadow: "0 8px 16px -4px rgba(0,0,0,0.1)" },
            { name: "lg", shadow: "0 16px 32px -8px rgba(0,0,0,0.15)" },
            { name: "xl", shadow: "0 30px 60px -15px rgba(0,0,0,0.25)" },
          ].map((sh) => (
            <div key={sh.name} style={{ textAlign: "center" }}>
              <div style={{ width: 80, height: 80, background: p.surface, borderRadius: 12, margin: "0 auto 14px", boxShadow: sh.shadow }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: p.text }}>shadow-{sh.name}</div>
            </div>
          ))}
        </div>
      </CSGroup>

      <CSGroup title="Easing · animation curves" p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: 24 }}>
          {[
            { name: "linear", v: "linear" },
            { name: "ease-out", v: "ease-out" },
            { name: "ease-in-out", v: "ease-in-out" },
            { name: "spring", v: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
          ].map((e, i) => (
            <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ minWidth: 120, fontSize: 12, fontWeight: 700, color: p.text }}>{e.name}</div>
              <div style={{ flex: 1, height: 4, background: p.bg, borderRadius: 2, position: "relative" }}>
                <div style={{ position: "absolute", top: -6, left: 0, width: 16, height: 16, borderRadius: "50%", background: p.primary, animation: `bp-easing-${i} 2.4s ${e.v} infinite` }} />
              </div>
            </div>
          ))}
          <style>{`
            @keyframes bp-easing-0 { 0%, 100% { left: 0 } 50% { left: calc(100% - 16px) } }
            @keyframes bp-easing-1 { 0%, 100% { left: 0 } 50% { left: calc(100% - 16px) } }
            @keyframes bp-easing-2 { 0%, 100% { left: 0 } 50% { left: calc(100% - 16px) } }
            @keyframes bp-easing-3 { 0%, 100% { left: 0 } 50% { left: calc(100% - 16px) } }
          `}</style>
        </div>
      </CSGroup>
    </div>
  )
}

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
      <button style={{ width: "100%", background: highlight ? p.accent : "transparent", color: highlight ? "#0B1220" : p.primary, border: highlight ? "none" : `1.5px solid ${p.primary}`, padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: font }}>
        {cta}
      </button>
    </div>
  )
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontWeight: 700, color: "#FFFFFF", fontSize: 14, marginBottom: 16 }}>{title}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <li key={item} style={{ fontSize: 14 }}><a style={{ color: "inherit", textDecoration: "none" }}>{item}</a></li>
        ))}
      </ul>
    </div>
  )
}

// =============================================================================
// PÁGINA + CONTROLES
// =============================================================================
export default function BrandPreview() {
  const [paletteId, setPaletteId] = useState("A")
  const [fontId, setFontId] = useState("inter")

  const palette = palettes.find((x) => x.id === paletteId) ?? palettes[0]
  const font = fonts.find((x) => x.id === fontId) ?? fonts[0]

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

  return (
    <div>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, background: "#0B1220", color: "#FFFFFF", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontFamily: "system-ui, sans-serif", fontSize: 13, borderBottom: "2px solid #1E293B", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
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

      {/* Padding-top pra compensar control bar fixo (altura aprox 56px) */}
      <div style={{ paddingTop: 56 }}>
        <Landing p={palette} font={font.family} />
      </div>
    </div>
  )
}
