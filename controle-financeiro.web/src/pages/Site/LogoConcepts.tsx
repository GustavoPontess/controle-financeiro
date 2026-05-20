/**
 * Logo Concepts — propostas de logo Pontes desenhadas em SVG inline.
 * Rota pública /logo-concepts (sem login).
 *
 * RODADA 2: direções mais ousadas, com tipografia customizada e símbolos
 * abstratos puros.
 */

import { useEffect, useState } from "react"

const fontUrls = [
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
  "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&display=swap",
  "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap",
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap",
  "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700;900&display=swap",
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap",
  "https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap",
]

type RenderFn = (color: string) => React.ReactNode

type Concept = {
  id: string
  title: string
  description: string
  render: RenderFn
}

/** Conceito 09 — Wordmark monolítico com "o" sublinhada por arco. */
const c09: RenderFn = (color) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <span style={{ fontSize: 56, fontWeight: 800, color, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.05em", lineHeight: 0.85 }}>P</span>
    <div style={{ position: "relative" }}>
      <span style={{ fontSize: 56, fontWeight: 800, color, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.05em", lineHeight: 0.85 }}>ontes</span>
      <svg style={{ position: "absolute", left: -2, bottom: -6, width: 60, height: 12 }} viewBox="0 0 60 12" fill="none">
        <path d="M2 10 Q30 -2 58 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  </div>
)

/** Conceito 10 — Símbolo abstrato puro (sem wordmark) — Pixinguinha / Vercel vibe. */
const c10: RenderFn = (color) => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <path d="M10 60 Q40 10 70 60" stroke={color} strokeWidth="9" strokeLinecap="round" fill="none" />
    <circle cx="40" cy="35" r="5" fill={color} />
  </svg>
)

/** Conceito 11 — "P" como contraforma de arco gigante. */
const c11: RenderFn = (color) => (
  <svg width="80" height="64" viewBox="0 0 80 64" fill="none">
    <path d="M6 56 L6 16 Q6 6 16 6 L40 6 Q56 6 56 22 Q56 38 40 38 L24 38 L24 56 Z" fill={color} />
    <circle cx="34" cy="22" r="6" fill="#FFFFFF" fillOpacity="1" />
    <path d="M58 30 Q70 18 78 30" stroke={color} strokeWidth="4" strokeLinecap="round" fill="none" />
  </svg>
)

/** Conceito 12 — 4 colunas verticais (pilares da ponte) + tampo. */
const c12: RenderFn = (color) => (
  <svg width="72" height="64" viewBox="0 0 80 64" fill="none">
    <rect x="6" y="20" width="68" height="6" rx="1" fill={color} />
    <rect x="10" y="26" width="6" height="32" rx="1" fill={color} />
    <rect x="26" y="26" width="6" height="32" rx="1" fill={color} />
    <rect x="42" y="26" width="6" height="32" rx="1" fill={color} />
    <rect x="58" y="26" width="6" height="32" rx="1" fill={color} />
  </svg>
)

/** Conceito 13 — Ligadura "P-o" — duas letras se conectam por arco interno. */
const c13: RenderFn = (color) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
    <span style={{ fontSize: 64, fontWeight: 700, color, fontFamily: "'Fraunces', serif", letterSpacing: "-0.05em", lineHeight: 0.85 }}>Pontes</span>
  </div>
)

/** Conceito 14 — Símbolo "barco-ponte": ponte que parece um arco caligráfico. */
const c14: RenderFn = (color) => (
  <svg width="84" height="56" viewBox="0 0 84 56" fill="none">
    <path d="M6 44 C 14 16, 70 16, 78 44" stroke={color} strokeWidth="7" strokeLinecap="round" fill="none" />
    <line x1="6" y1="48" x2="78" y2="48" stroke={color} strokeWidth="4" strokeLinecap="round" />
    <line x1="14" y1="48" x2="14" y2="44" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <line x1="42" y1="48" x2="42" y2="32" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <line x1="70" y1="48" x2="70" y2="44" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
)

/** Conceito 15 — Lockup wordmark sem ícone, com kerning ousado. */
const c15: RenderFn = (color) => (
  <div style={{ display: "flex", alignItems: "baseline" }}>
    <span style={{ fontSize: 58, fontWeight: 900, color, fontFamily: "'Geist', sans-serif", letterSpacing: "-0.06em", lineHeight: 0.85 }}>Pontes</span>
    <span style={{ fontSize: 58, fontWeight: 900, color, fontFamily: "'Geist', sans-serif", lineHeight: 0.85, marginLeft: 2 }}>.</span>
  </div>
)

/** Conceito 16 — Símbolo construído com 2 semicírculos opostos formando lente/olho. */
const c16: RenderFn = (color) => (
  <svg width="80" height="56" viewBox="0 0 80 56" fill="none">
    <path d="M8 28 A 32 24 0 0 1 72 28" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
    <path d="M8 28 A 32 24 0 0 0 72 28" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
  </svg>
)

/** Conceito 17 — Letra inicial "P" GIGANTE com tampo de ponte saindo. */
const c17: RenderFn = (color) => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <path d="M8 72 L8 12 Q8 8 12 8 L44 8 Q60 8 60 24 Q60 40 44 40 L24 40" stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M16 48 Q40 28 64 48" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.6" />
  </svg>
)

/** Conceito 18 — Tipografia serif elegante "Pontes." com ponto sobre i estilizado. */
const c18: RenderFn = (color) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
    <span style={{ fontSize: 64, fontWeight: 400, color, fontFamily: "'Instrument Serif', serif", letterSpacing: "-0.02em", lineHeight: 0.85, fontStyle: "italic" }}>Pontes</span>
  </div>
)

/** Conceito 19 — Glifo "P" + barra de ponte sob ele. */
const c19: RenderFn = (color) => (
  <svg width="68" height="80" viewBox="0 0 68 80" fill="none">
    <path d="M14 60 L14 16 L40 16 Q56 16 56 30 Q56 44 40 44 L24 44" stroke={color} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <rect x="6" y="66" width="56" height="6" rx="3" fill={color} />
    <circle cx="14" cy="74" r="4" fill={color} />
    <circle cx="54" cy="74" r="4" fill={color} />
  </svg>
)

/** Conceito 20 — Wordmark com sublinhado em arco (sem ícone separado). */
const c20: RenderFn = (color) => (
  <div style={{ position: "relative", display: "inline-block" }}>
    <span style={{ fontSize: 54, fontWeight: 700, color, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.035em", lineHeight: 0.85 }}>Pontes</span>
    <svg style={{ position: "absolute", left: 0, right: 0, bottom: -16, width: "100%", height: 16 }} viewBox="0 0 200 16" preserveAspectRatio="none" fill="none">
      <path d="M4 12 Q100 -4 196 12" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  </div>
)

const concepts: Concept[] = [
  { id: "09", title: "Pontes + arco sob 'ontes'", description: "Wordmark Bricolage com microdetalhe — arco fino sob 'ontes' lembra ponte sem competir.", render: c09 },
  { id: "10", title: "Símbolo puro (sem wordmark)", description: "Arco isolado + ponto central. Vira identidade independente — favicon, perfil social.", render: c10 },
  { id: "11", title: "P sólido + arco lateral", description: "Letra P em bloco sólido + microarco do lado. Wordmark separado embaixo (versão lockup).", render: c11 },
  { id: "12", title: "Pilares da ponte", description: "4 colunas + tampo. Geometria pura. Lembra ponte ferroviária reduzida ao essencial.", render: c12 },
  { id: "13", title: "Pontes em Fraunces serif", description: "Só wordmark serif elegante. Sem ícone. Estilo Mercury, sobrenome de marca.", render: c13 },
  { id: "14", title: "Arco caligráfico + tabuleiro", description: "Arco curvo solto, 3 apoios pequenos + tampo. Mais artístico, menos engenharia.", render: c14 },
  { id: "15", title: "Pontes. com ponto", description: "Wordmark Geist Black extra-condensed + ponto final. Estilo Stone, lacônico.", render: c15 },
  { id: "16", title: "Lente (2 arcos opostos)", description: "Ponte + reflexo formando lente/olho. Abstrato premium.", render: c16 },
  { id: "17", title: "P aberto + arco etéreo", description: "P em outline + arco solto sob ele em opacidade. Aéreo, contemporâneo.", render: c17 },
  { id: "18", title: "Pontes itálico Instrument", description: "Serif itálico fluida. Acolhedor, humano, sobrenome elegante.", render: c18 },
  { id: "19", title: "P estendido + tabuleiro", description: "P em outline + barra de ponte horizontal embaixo com pilares pontuais.", render: c19 },
  { id: "20", title: "Wordmark sublinhado em arco", description: "Pontes sem ícone, com arco sutil passando sob a palavra. Compacto.", render: c20 },
]

function ConceptCard({
  concept, color, bg, textColor, borderColor,
}: { concept: Concept; color: string; bg: string; textColor: string; borderColor: string }) {
  return (
    <div style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 18, padding: 32, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#94A3B8", fontFamily: "monospace" }}>CONCEITO {concept.id}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 16px", minHeight: 140 }}>
        {concept.render(color)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, paddingTop: 14, borderTop: `1px solid ${borderColor}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ transform: "scale(0.4)", transformOrigin: "left center", height: 28 }}>{concept.render(color)}</div>
          <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace" }}>~24px</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ transform: "scale(0.6)", transformOrigin: "left center", height: 40 }}>{concept.render(color)}</div>
          <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace" }}>~36px</span>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: textColor, marginBottom: 4 }}>{concept.title}</div>
        <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>{concept.description}</div>
      </div>
    </div>
  )
}

export default function LogoConcepts() {
  const [color, setColor] = useState("#0B1220")
  const [bg, setBg] = useState<"light" | "dark">("light")

  useEffect(() => {
    const prev = { body: document.body.style.overflow, html: document.documentElement.style.overflow, bodyH: document.body.style.height, htmlH: document.documentElement.style.height }
    document.body.style.overflow = "auto"; document.documentElement.style.overflow = "auto"
    document.body.style.height = "auto"; document.documentElement.style.height = "auto"
    const root = document.getElementById("root"); if (root) root.style.height = "auto"
    return () => { document.body.style.overflow = prev.body; document.documentElement.style.overflow = prev.html; document.body.style.height = prev.bodyH; document.documentElement.style.height = prev.htmlH }
  }, [])

  useEffect(() => {
    fontUrls.forEach((url, i) => {
      const id = `lc-font-${i}`
      if (!document.getElementById(id)) {
        const link = document.createElement("link"); link.id = id; link.rel = "stylesheet"; link.href = url
        document.head.appendChild(link)
      }
    })
  }, [])

  const isDark = bg === "dark"
  const pageBg = isDark ? "#0B1220" : "#F7F9FC"
  const cardBg = isDark ? "#0F172A" : "#FFFFFF"
  const textColor = isDark ? "#FFFFFF" : "#0B1220"
  const borderColor = isDark ? "#1E293B" : "#E5EAF2"

  const colorOptions = [
    { name: "Preto", v: "#0B1220" },
    { name: "Cobalto", v: "#1E40AF" },
    { name: "Petróleo", v: "#0E4F6E" },
    { name: "Esmeralda", v: "#047857" },
    { name: "Vinho", v: "#7F1D1D" },
    { name: "Índigo", v: "#312E81" },
    { name: "Coral", v: "#EA580C" },
    { name: "Roxo", v: "#4338CA" },
  ]

  return (
    <div style={{ minHeight: "100vh", background: pageBg, fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 80 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#0B1220", color: "#FFFFFF", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontSize: 13, borderBottom: "2px solid #1E293B" }}>
        <div style={{ fontWeight: 700, letterSpacing: "0.1em", fontSize: 11 }}>🎨 LOGO CONCEPTS · RODADA 2</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ opacity: 0.6 }}>Cor:</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {colorOptions.map((c) => (
              <button key={c.v} onClick={() => setColor(c.v)} title={c.name}
                style={{ width: 28, height: 28, borderRadius: 6, background: c.v, border: color === c.v ? "2px solid #FFFFFF" : "2px solid #334155", cursor: "pointer" }} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ opacity: 0.6 }}>Fundo:</span>
          <button onClick={() => setBg("light")} style={{ background: bg === "light" ? "#FFFFFF" : "transparent", color: bg === "light" ? "#0B1220" : "#FFFFFF", border: "1px solid #334155", padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Claro</button>
          <button onClick={() => setBg("dark")} style={{ background: bg === "dark" ? "#FFFFFF" : "transparent", color: bg === "dark" ? "#0B1220" : "#FFFFFF", border: "1px solid #334155", padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Escuro</button>
        </div>
        <div style={{ marginLeft: "auto", opacity: 0.55, fontSize: 11 }}>{color} · {bg}</div>
      </div>

      <div style={{ textAlign: "center", padding: "48px 24px 32px", maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: textColor, margin: 0, letterSpacing: "-0.025em", marginBottom: 10 }}>
          Pontes — rodada 2 (12 conceitos)
        </h1>
        <p style={{ fontSize: 15, color: isDark ? "#94A3B8" : "#64748B", margin: 0, lineHeight: 1.55 }}>
          Direções diferentes — wordmarks tipográficos, símbolos abstratos puros, ligaduras, monogramas. Troca cor/fundo no topo. Diz o número que bater.
        </p>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        {concepts.map((c) => (
          <ConceptCard key={c.id} concept={c} color={color} bg={cardBg} textColor={textColor} borderColor={borderColor} />
        ))}
      </div>
    </div>
  )
}
