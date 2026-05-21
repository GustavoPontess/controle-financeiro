/**
 * Navbar — barra de navegação flutuante do site público.
 *
 * Visual:
 *  - Sobre o hero: glass branco translúcido (texto claro).
 *  - Após rolar 400px: sólida (texto escuro).
 * Logo é botão pra "/", links navegam via prop `onNavigate` (default: window.history).
 *
 * Move/atualiza SiteNavbar.
 */

import { useEffect, useState } from "react"
import Logo from "../../Logo/Logo"
import { PontesButton, PontesNavLink } from "../buttons/Button"
import { ensurePontesGlobalStyles } from "../_globalStyles"
import { type Palette } from "../theme"

export type PontesNavbarLink = { label: string; to: string }

export type PontesNavbarProps = {
  p: Palette
  font: string
  /** Marca item ativo no menu (match em `to`). */
  activePath?: string
  links?: PontesNavbarLink[]
  /** Override de navegação (default: pushState do browser). */
  onNavigate?: (to: string) => void
  /** Esconde botões de auth (login/register). */
  hideAuth?: boolean
  /** Posição do topo quando NÃO scrolled (px). Default 110 (flutua sobre o hero).
   *  Páginas com banner/control bar acima passam o valor que posiciona a navbar logo abaixo. */
  topOffset?: number
  /** Posição do topo quando scrolled (px). Default 16. Páginas com control bar fixo
   *  somam a altura dele aqui pra navbar não ficar por baixo. */
  scrolledTop?: number
}

const DEFAULT_LINKS: PontesNavbarLink[] = [
  { label: "Recursos", to: "/recursos" },
  { label: "Para Casais", to: "/casais" },
  { label: "Para Contadores", to: "/contadores" },
  { label: "Sobre", to: "/sobre" },
]

export function PontesNavbar({
  p, font, activePath, links = DEFAULT_LINKS, onNavigate, hideAuth, topOffset = 110, scrolledTop = 16,
}: PontesNavbarProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(ensurePontesGlobalStyles, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const go = (to: string) => {
    if (onNavigate) onNavigate(to)
    else { window.history.pushState({}, "", to); window.dispatchEvent(new PopStateEvent("popstate")) }
  }

  const bg = scrolled ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.12)"
  const border = scrolled ? p.border : "rgba(255,255,255,0.2)"
  const textColor = scrolled ? p.text : p.heroFg
  const wordmarkColor = scrolled ? p.primary : p.heroFg

  const navTop = scrolled ? scrolledTop : topOffset

  return (
    <nav style={{
      position: "fixed", top: navTop, left: 0, right: 0, padding: "0 48px",
      display: "flex", justifyContent: "center", zIndex: 90,
      transition: "top 250ms ease, background 250ms ease",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 32, padding: "10px 16px 10px 22px",
        background: bg,
        border: `1px solid ${border}`, borderRadius: 999,
        boxShadow: scrolled
          ? "0 8px 24px -8px rgba(0,0,0,0.12)"
          : "0 8px 24px -8px rgba(0,0,0,0.18)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        minWidth: 920, maxWidth: 1100, width: "100%",
        transition: "all 250ms ease",
      }}>
        <button
          type="button"
          onClick={() => go("/")}
          className="pontes-clickable"
          data-pontes-variant="ghost"
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}
          aria-label="Pontes — Home"
        >
          <Logo color={wordmarkColor} size={22} />
        </button>

        <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
          {links.map((link) => (
            <PontesNavLink
              key={link.to}
              p={p} font={font}
              color={textColor}
              hoverColor={scrolled ? p.primary : p.accent}
              active={activePath === link.to}
              onClick={() => go(link.to)}
              style={{ opacity: scrolled ? 1 : 0.92 }}
            >
              {link.label}
            </PontesNavLink>
          ))}
        </div>

        {!hideAuth ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <PontesButton
              p={p} font={font}
              variant={scrolled ? "outline" : "outline-light"} size="sm"
              onClick={() => go("/auth/login")}
              style={{ padding: "8px 16px", borderRadius: 999, fontSize: 13 }}
            >Entrar</PontesButton>
            <PontesButton
              p={p} font={font}
              variant={scrolled ? "primary" : "accent"} size="sm"
              onClick={() => go("/auth/register")}
              style={{ padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700 }}
            >Criar conta</PontesButton>
          </div>
        ) : <span style={{ width: 1 }} />}
      </div>
    </nav>
  )
}
