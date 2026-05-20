/**
 * Design System — rota pública /design-system.
 * Página dedicada com showcase de componentes + tokens.
 * Tem control bar próprio (paleta + fonte) independente da landing.
 */

import { useEffect, useState } from "react"
import { ComponentShowcase } from "../Site/HomePage"
import { palettes, fonts } from "../Site/theme"

export default function DesignSystemPage() {
  const [paletteId, setPaletteId] = useState("A")
  const [fontId, setFontId] = useState("plus-jakarta")

  const palette = palettes.find((x) => x.id === paletteId) ?? palettes[0]
  const font = fonts.find((x) => x.id === fontId) ?? fonts[0]

  // Override body { overflow: hidden } global pra liberar scroll
  useEffect(() => {
    const prev = {
      bodyO: document.body.style.overflow,
      htmlO: document.documentElement.style.overflow,
      bodyH: document.body.style.height,
      htmlH: document.documentElement.style.height,
    }
    document.body.style.overflow = "auto"
    document.documentElement.style.overflow = "auto"
    document.body.style.height = "auto"
    document.documentElement.style.height = "auto"
    const root = document.getElementById("root")
    if (root) root.style.height = "auto"
    return () => {
      document.body.style.overflow = prev.bodyO
      document.documentElement.style.overflow = prev.htmlO
      document.body.style.height = prev.bodyH
      document.documentElement.style.height = prev.htmlH
    }
  }, [])

  // Injeta a fonte escolhida
  useEffect(() => {
    const linkId = `ds-font-${font.id}`
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link")
      link.id = linkId
      link.rel = "stylesheet"
      link.href = font.url
      document.head.appendChild(link)
    }
  }, [font])

  return (
    <div>
      {/* Control bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: "#0B1220",
          color: "#FFFFFF",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          borderBottom: "2px solid #1E293B",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ fontWeight: 700, letterSpacing: "0.1em", fontSize: 11 }}>📐 DESIGN SYSTEM</div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ opacity: 0.6 }}>Paleta:</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {palettes.map((pp) => (
              <button
                key={pp.id}
                onClick={() => setPaletteId(pp.id)}
                title={pp.label}
                style={{
                  background: paletteId === pp.id ? "#FFFFFF" : "transparent",
                  color: paletteId === pp.id ? "#0B1220" : "#FFFFFF",
                  border: `1px solid ${paletteId === pp.id ? "#FFFFFF" : "#334155"}`,
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ width: 12, height: 12, background: pp.primary, borderRadius: 3 }} />
                <span style={{ width: 12, height: 12, background: pp.accent, borderRadius: 3 }} />
                <span>{pp.id}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ opacity: 0.6 }}>Fonte:</span>
          <select
            value={fontId}
            onChange={(e) => setFontId(e.target.value)}
            style={{
              background: "#1E293B",
              color: "#FFFFFF",
              border: "1px solid #334155",
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} — {f.description}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: "auto", opacity: 0.55, fontSize: 11 }}>
          {palette.label} · {font.label}
        </div>
      </div>

      {/* Header */}
      <div style={{ paddingTop: 80, background: palette.bg, fontFamily: font.family }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px 0", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: palette.primary, textTransform: "uppercase", marginBottom: 14 }}>
            Documentação
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, color: palette.text, margin: 0, letterSpacing: "-0.025em" }}>
            Pontes — Design System
          </h1>
          <p style={{ fontSize: 16, color: palette.textMuted, marginTop: 12, maxWidth: 640, marginInline: "auto" }}>
            Componentes, tokens e padrões usados no produto. Trocar paleta e fonte no topo aplica em tudo ao vivo.
          </p>
        </div>
        <ComponentShowcase p={palette} font={font.family} />
      </div>
    </div>
  )
}
