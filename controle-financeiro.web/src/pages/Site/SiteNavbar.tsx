/**
 * SiteNavbar — navbar pill flutuante reutilizada por todas as páginas públicas do site.
 *
 * Usado em HomePage, CouplesPage e futuras (Contadores, Recursos, Sobre).
 * Recebe palette + font (até #90 entregar personalização global, cada página
 * usa o default A + inter).
 *
 * Visual: glass sobre o hero, sólido após rolar 400px (`scrolled` state).
 */

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Logo from "../../components/Logo/Logo"
import type { Palette } from "./theme"

type NavLink = { label: string; to: string }

type SiteNavbarProps = {
  p: Palette
  font: string
  /** Página ativa pra destacar item do menu. Match com `NavLink.to` ou substring. */
  activePath?: string
  /** Pode customizar os links (default: menu padrão do site). */
  links?: NavLink[]
}

const DEFAULT_LINKS: NavLink[] = [
  { label: "Recursos", to: "/site/recursos" },
  { label: "Para Casais", to: "/site/casais" },
  { label: "Para Contadores", to: "/site/contadores" },
  { label: "Sobre", to: "/site/sobre" },
]

export default function SiteNavbar({ p, font, activePath, links = DEFAULT_LINKS }: SiteNavbarProps) {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 400)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Sobre o hero: glass sobre gradient escuro. Após rolar: sólido claro.
  const bg = scrolled ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.12)"
  const border = scrolled ? p.border : "rgba(255,255,255,0.2)"
  const textColor = scrolled ? p.text : p.heroFg
  const wordmarkColor = scrolled ? p.primary : p.heroFg
  const outlineBorder = scrolled ? p.border : "rgba(255,255,255,0.3)"

  return (
    <nav style={{
      position: "fixed", top: scrolled ? 70 : 110, left: 0, right: 0, padding: "0 48px",
      display: "flex", justifyContent: "center", zIndex: 90,
      transition: "top 250ms ease, background 250ms ease",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 32, padding: "10px 16px 10px 22px",
        background: bg,
        border: `1px solid ${border}`, borderRadius: 999,
        boxShadow: scrolled ? "0 8px 24px -8px rgba(0,0,0,0.12)" : "0 8px 24px -8px rgba(0,0,0,0.18)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        minWidth: 920, maxWidth: 1100, width: "100%",
        transition: "all 250ms ease",
      }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}
          aria-label="Pontes — Home"
        >
          <Logo color={wordmarkColor} size={22} variant="full" />
        </button>

        <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
          {links.map((link) => {
            const active = activePath ? activePath === link.to : false
            return (
              <button
                key={link.to}
                onClick={() => navigate(link.to)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  color: textColor,
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  textDecoration: active ? "underline" : "none",
                  textUnderlineOffset: 6,
                  textDecorationThickness: 2,
                  cursor: "pointer",
                  opacity: scrolled ? 1 : 0.92,
                  transition: "color 250ms",
                  fontFamily: font,
                }}
              >
                {link.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => navigate("/auth/login")}
            style={{ background: "transparent", color: textColor, border: `1px solid ${outlineBorder}`, padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "all 250ms" }}
          >
            Entrar
          </button>
          <button
            onClick={() => navigate("/auth/register")}
            style={{ background: scrolled ? p.primary : p.accent, color: scrolled ? p.heroFg : "#0B1220", border: "none", padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font, transition: "all 250ms" }}
          >
            Criar conta
          </button>
        </div>
      </div>
    </nav>
  )
}
