/**
 * SiteLayout — shell compartilhado de TODAS as páginas públicas do site.
 *
 * Dono de: control bar dev (brand preview), paleta/fonte ao vivo, scrollbar
 * overlay, navbar, footer, FloatCTA, progress bar. As páginas (HomePage,
 * CouplesPage, etc) renderizam SÓ conteúdo e consomem o tema via CSS vars
 * (`var(--pontes-*)`) aplicadas globalmente pelo PontesThemeProvider.
 *
 * Estilo via CSS Modules + var(--pontes-*) (#122). O control bar dev usa cores
 * escuras fixas de propósito (tema-independente) e sai quando #90 entregar a
 * personalização in-app definitiva.
 */

import { useEffect, useRef, useState } from "react"
import { type ReactNode } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import { ChevronUp, ChevronDown } from "lucide-react"
import {
  PontesNavbar, PontesFooter, PontesButton,
  usePontesTheme, usePontesBodyScrollbar,
} from "../../components/pontes"
import styles from "./SiteLayout.module.css"

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

  // Scrollbar overlay (accent) sempre visível. Precisa do hex real da paleta.
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
      <div className={styles.barFixed} data-open={barOpen}>
        <div ref={barRef} className={styles.bar}>
          <button onClick={() => setBarOpen(false)} aria-label="Esconder brand preview" className={styles.barBtn}>
            <ChevronUp size={16} strokeWidth={2.5} />
          </button>

          <div className={styles.barTitle}>🎨 BRAND PREVIEW</div>

          <div className={styles.barGroup}>
            <span className={styles.barDim}>Paleta:</span>
            <div className={styles.swatchWrap}>
              {palettes.map((pp) => (
                <button key={pp.id} onClick={() => setPaletteId(pp.id)} title={pp.label} className={styles.swatch} data-active={paletteId === pp.id}>
                  <span className={styles.swatchChip} style={{ background: pp.primary }} />
                  <span className={styles.swatchChip} style={{ background: pp.accent }} />
                  <span>{pp.id}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.barGroup}>
            <span className={styles.barDim}>Fonte:</span>
            <select value={fontId} onChange={(e) => setFontId(e.target.value)} className={styles.fontSelect}>
              {fonts.map((f) => (<option key={f.id} value={f.id}>{f.label} — {f.description}</option>))}
            </select>
          </div>

          <div className={styles.barMeta}>{palette.label} · {fontOpt.label}</div>
        </div>
      </div>

      {/* Reabrir onde estiver (seta pra baixo) — esquerda fixa */}
      {!barOpen && (
        <button onClick={() => setBarOpen(true)} aria-label="Mostrar brand preview" className={styles.reopen}>
          <ChevronDown size={16} strokeWidth={2.5} />
        </button>
      )}

      {/* Navbar compartilhada — activePath pela rota atual */}
      <PontesNavbar
        activePath={location.pathname}
        onNavigate={(to) => navigate(to)}
        topOffset={topOffset + 50}
        scrolledTop={topOffset + 16}
      />

      {/* Conteúdo da página (empurrado abaixo da bar fixa quando aberta) */}
      <div className={styles.content} style={{ paddingTop: barOpen ? barHeight : 0 }}>
        {/* TOPBAR PROMOCIONAL — site-wide (acompanha o nav em todas as páginas) */}
        <button onClick={() => navigate("/auth/register")} className={styles.promo}>
          ✦ Beta aberto · vagas limitadas pra famílias brasileiras · <span className={styles.promoUnderline}>quero entrar →</span>
        </button>
        {children ?? <Outlet />}
      </div>

      {/* Footer compartilhado */}
      <PontesFooter
        variant="rich"
        onNavigate={(to) => navigate(to)}
        appBadges={[{ label: "App Store" }, { label: "Google Play" }]}
      />

      <FloatCTA />
      <ScrollProgressBar />
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

function FloatCTA() {
  const [show, setShow] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return (
    <div className={styles.floatCta} data-show={show}>
      <PontesButton
        variant="accent" size="md"
        onClick={() => navigate("/auth/register")}
        iconStart={<span className={styles.floatDot} />}
      >
        Criar conta grátis
      </PontesButton>
    </div>
  )
}

function ScrollProgressBar() {
  const progress = useScrollProgress()
  return (
    <div className={styles.progressTrack}>
      <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
    </div>
  )
}
