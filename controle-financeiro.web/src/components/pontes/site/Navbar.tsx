/**
 * Navbar — barra flutuante do site público. Glass sobre o hero, sólida ao rolar.
 * Cor via var(--pontes-*); estados via data-scrolled (CSS). Cores dinâmicas
 * passadas como strings var() pros subcomponentes. `p`/`font` escopado (#122).
 */

import { useEffect, useState, type CSSProperties } from "react"
import Logo from "../../Logo/Logo"
import { PontesButton, PontesNavLink } from "../buttons/Button"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Navbar.module.css"

export type PontesNavbarLink = { label: string; to: string }

export type PontesNavbarProps = {
  p?: Palette
  font?: string
  /** Marca item ativo no menu (match em `to`). */
  activePath?: string
  links?: PontesNavbarLink[]
  /** Override de navegação (default: pushState do browser). */
  onNavigate?: (to: string) => void
  /** Esconde botões de auth (login/register). */
  hideAuth?: boolean
  /** Posição do topo quando NÃO scrolled (px). Default 110. */
  topOffset?: number
  /** Posição do topo quando scrolled (px). Default 16. */
  scrolledTop?: number
  /** Página sem hero escura por trás (ex: páginas legais) — força o visual
   * "sólido" (fundo opaco, texto escuro) desde o início. Só afeta COR/fundo,
   * não a posição — a posição continua seguindo o scroll de verdade, senão a
   * barra nasce alta demais e sobrepõe o banner promocional/dev bar acima dela. */
  forceSolid?: boolean
}

const DEFAULT_LINKS: PontesNavbarLink[] = [
  { label: "Recursos", to: "/recursos" },
  { label: "Para Casais", to: "/casais" },
  { label: "Para Contadores", to: "/contadores" },
  { label: "Sobre", to: "/sobre" },
]

export function PontesNavbar({
  p, font, activePath, links = DEFAULT_LINKS, onNavigate, hideAuth, topOffset = 110, scrolledTop = 16,
  forceSolid = false,
}: PontesNavbarProps) {
  // `scrolled` (posição/top) segue o scroll real sempre — senão a barra nasce
  // colada no topo e sobrepõe o banner promocional/dev bar. `solid` (cor/fundo)
  // pode ser forçado por página sem hero, independente de já ter rolado ou não.
  const [scrolled, setScrolled] = useState(false)
  const solid = forceSolid || scrolled

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

  const textColor = solid ? "var(--pontes-text)" : "var(--pontes-hero-fg)"
  const wordmarkColor = solid ? "var(--pontes-primary)" : "var(--pontes-hero-fg)"
  const hoverColor = solid ? "var(--pontes-primary)" : "var(--pontes-accent)"

  return (
    <nav className={styles.nav} style={{ top: scrolled ? scrolledTop : topOffset, ...scopedThemeVars(p, font) } as CSSProperties}>
      <div className={styles.bar} data-scrolled={solid ? "true" : undefined}>
        <Logo color={wordmarkColor} size={22} onClick={() => go("/")} />

        <div className={styles.links}>
          {links.map((link) => (
            <PontesNavLink
              key={link.to}
              color={textColor}
              hoverColor={hoverColor}
              active={activePath === link.to}
              onClick={() => go(link.to)}
              style={{ opacity: solid ? 1 : 0.92 }}
            >
              {link.label}
            </PontesNavLink>
          ))}
        </div>

        {!hideAuth ? (
          <div className={styles.auth}>
            <PontesButton
              variant={solid ? "outline" : "outline-light"} size="sm"
              onClick={() => go("/auth/login")}
              style={{ padding: "8px 16px", borderRadius: 999, fontSize: 13 }}
            >Entrar</PontesButton>
            <PontesButton
              variant={solid ? "primary" : "accent"} size="sm"
              onClick={() => go("/auth/register")}
              style={{ padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700 }}
            >Criar conta</PontesButton>
          </div>
        ) : <span style={{ width: 1 }} />}
      </div>
    </nav>
  )
}
