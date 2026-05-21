/**
 * SiteLayout — shell compartilhado de TODAS as páginas públicas do site.
 *
 * Dono de: control bar dev (brand preview), paleta/fonte ao vivo, scrollbar
 * overlay, navbar, footer, FloatCTA, progress bar. As páginas (HomePage,
 * CouplesPage, etc) renderizam SÓ conteúdo e consomem `{ p, font }` via
 * `useSiteTheme()` (Outlet context).
 *
 * Quando #90 (personalização in-app) entregar context global, o state de
 * paleta/fonte aqui vira o provider real e o control bar dev sai.
 */

import { useEffect, useRef, useState } from "react"
import { type ReactNode } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import { ChevronUp, ChevronDown } from "lucide-react"
import {
  PontesNavbar, PontesFooter, PontesButton,
  usePontesTheme, usePontesBodyScrollbar,
  type Palette,
} from "../../components/pontes"

/**
 * Renderiza `children` quando passado direto (ex: RootRoute deslogado),
 * senão usa `<Outlet/>` (rotas filhas aninhadas).
 */
export default function SiteLayout({ children }: { children?: ReactNode }) {
  // Paleta/fonte vêm do provider global (#90) — persiste e vale em todas as telas.
  const { palette, fontOption, paletteId, fontId, setPaletteId, setFontId, palettes, fonts } = usePontesTheme()
  const fontOpt = fontOption
  const [barOpen, setBarOpen] = useState(true)
  const [barHeight, setBarHeight] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)

  const navigate = useNavigate()
  const location = useLocation()

  // Libera scroll natural (body overflow hidden por padrão no global.css).
  useEffect(() => {
    const prev = {
      bodyOverflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
      htmlHeight: document.documentElement.style.height,
      bodyHeight: document.body.style.height,
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

  // Scrollbar overlay (accent) sempre visível. (Fonte + scroll bg → provider.)
  usePontesBodyScrollbar(palette.accent)

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
  return (
    <div>
      {/* Control bar de dev (BRAND PREVIEW) — fixed overlay, recolhível. Sai no #90. */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        transform: barOpen ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        <div ref={barRef} style={{ background: "#0B1220", color: "#FFFFFF", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontFamily: "system-ui, sans-serif", fontSize: 13, borderBottom: "2px solid #1E293B", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
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

          <div style={{ marginLeft: "auto", opacity: 0.55, fontSize: 11 }}>{palette.label} · {fontOpt.label}</div>
        </div>
      </div>

      {/* Reabrir onde estiver (seta pra baixo) — esquerda fixa */}
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

      {/* Navbar compartilhada — activePath pela rota atual */}
      <PontesNavbar
        p={palette} font={fontOpt.family}
        activePath={location.pathname}
        onNavigate={(to) => navigate(to)}
        topOffset={topOffset + 50}
        scrolledTop={topOffset + 16}
      />

      {/* Conteúdo da página (empurrado abaixo da bar fixa quando aberta) */}
      <div style={{ paddingTop: barOpen ? barHeight : 0, transition: "padding-top 300ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
        {children ?? <Outlet />}
      </div>

      {/* Footer compartilhado */}
      <PontesFooter
        p={palette} font={fontOpt.family} variant="rich"
        onNavigate={(to) => navigate(to)}
        appBadges={[{ label: "App Store" }, { label: "Google Play" }]}
      />

      <FloatCTA p={palette} font={fontOpt.family} />
      <ScrollProgressBar p={palette} />
    </div>
  )
}

// =============================================================================
// Chrome global (FloatCTA + progress bar)
// =============================================================================

function useScrollProgress() {
  const [prog, setProg] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProg(max > 0 ? window.scrollY / max : 0)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return prog
}

function FloatCTA({ p, font }: { p: Palette; font: string }) {
  const [show, setShow] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 999,
      opacity: show ? 1 : 0,
      transform: show ? "translateY(0)" : "translateY(20px)",
      pointerEvents: show ? "auto" : "none",
      transition: "opacity 300ms ease, transform 300ms ease",
    }}>
      <PontesButton
        p={p} font={font} variant="accent" size="md"
        onClick={() => navigate("/auth/register")}
        iconStart={<span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0B1220", display: "inline-block" }} />}
      >
        Criar conta grátis
      </PontesButton>
    </div>
  )
}

function ScrollProgressBar({ p }: { p: Palette }) {
  const progress = useScrollProgress()
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, background: "transparent", zIndex: 999 }}>
      <div style={{ height: "100%", width: `${progress * 100}%`, background: `linear-gradient(90deg, ${p.primary}, ${p.accent})`, transition: "width 80ms linear" }} />
    </div>
  )
}
