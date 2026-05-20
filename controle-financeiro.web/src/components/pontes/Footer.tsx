/**
 * Footer — rodapé compartilhado do site público.
 *
 * Variantes:
 *  - "rich" (default): 4 colunas (Produto, Recursos, Sobre, Legal) + brand + social
 *  - "minimal": apenas brand + links curtos numa única linha
 */

import Logo from "../Logo/Logo"
import type { Palette } from "./theme"

export type PontesFooterLink = { label: string; to: string }

export type PontesFooterColumn = {
  title: string
  links: PontesFooterLink[]
}

export type PontesFooterProps = {
  p: Palette
  font: string
  variant?: "rich" | "minimal"
  /** Override de navegação (default: pushState do browser). */
  onNavigate?: (to: string) => void
  /** Colunas customizadas pro variant rich (default: estrutura padrão Pontes). */
  columns?: PontesFooterColumn[]
  /** Links pro variant minimal. */
  minimalLinks?: PontesFooterLink[]
  /** Texto de copyright (default 2026). */
  copyright?: string
}

const DEFAULT_COLUMNS: PontesFooterColumn[] = [
  { title: "Produto", links: [
    { label: "Recursos", to: "/site/recursos" },
    { label: "Para Casais", to: "/site/casais" },
    { label: "Para Contadores", to: "/site/contadores" },
    { label: "Preços", to: "/site/precos" },
  ] },
  { title: "Empresa", links: [
    { label: "Sobre", to: "/site/sobre" },
    { label: "Blog", to: "/site/blog" },
    { label: "Contato", to: "/site/contato" },
  ] },
  { title: "Recursos", links: [
    { label: "Central de ajuda", to: "/site/ajuda" },
    { label: "Status", to: "/site/status" },
    { label: "API", to: "/site/api" },
  ] },
  { title: "Legal", links: [
    { label: "Termos", to: "/site/termos" },
    { label: "Privacidade", to: "/site/privacidade" },
    { label: "LGPD", to: "/site/lgpd" },
  ] },
]

const DEFAULT_MINIMAL_LINKS: PontesFooterLink[] = [
  { label: "Home", to: "/" },
  { label: "Para Casais", to: "/site/casais" },
  { label: "Entrar", to: "/auth/login" },
]

export function PontesFooter({
  p: _p, font, variant = "rich", onNavigate, columns = DEFAULT_COLUMNS, minimalLinks = DEFAULT_MINIMAL_LINKS,
  copyright = "© 2026 Pontes — Finanças pra família brasileira",
}: PontesFooterProps) {
  // _p reservado pra futura paleta dark-aware do footer (#90). Hoje footer é fixo escuro.
  void _p
  const go = (to: string) => {
    if (onNavigate) onNavigate(to)
    else { window.history.pushState({}, "", to); window.dispatchEvent(new PopStateEvent("popstate")) }
  }

  if (variant === "minimal") {
    return (
      <footer style={{ padding: 48, background: "#0B1220", color: "#FFFFFF", fontFamily: font }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              onClick={() => go("/")}
              style={{ background: "transparent", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
              aria-label="Pontes — Home"
            >
              <Logo color="#FFFFFF" size={20} variant="full" />
            </button>
            <span style={{ fontSize: 12, opacity: 0.5 }}>{copyright}</span>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {minimalLinks.map((link) => (
              <button
                key={link.to}
                type="button"
                onClick={() => go(link.to)}
                style={{
                  background: "transparent", border: "none", color: "#FFFFFF",
                  fontSize: 13, opacity: 0.75, cursor: "pointer", fontFamily: font,
                }}
              >{link.label}</button>
            ))}
          </div>
        </div>
      </footer>
    )
  }

  // RICH variant — 4 colunas + brand
  return (
    <footer style={{ padding: "72px 48px 32px", background: "#0B1220", color: "#FFFFFF", fontFamily: font }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.4fr repeat(4, 1fr)",
          gap: 40, marginBottom: 56,
        }}>
          {/* Brand column */}
          <div>
            <button
              type="button"
              onClick={() => go("/")}
              style={{ background: "transparent", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", marginBottom: 16, padding: 0 }}
              aria-label="Pontes — Home"
            >
              <Logo color="#FFFFFF" size={24} variant="full" />
            </button>
            <p style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.6, margin: 0, maxWidth: 280 }}>
              Finanças pra família brasileira. Conecte bancos, divida despesas com seu parceiro e abra acesso pro seu contador.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {[
                { sym: "𝕏", label: "X / Twitter" },
                { sym: "in", label: "LinkedIn" },
                { sym: "ig", label: "Instagram" },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#FFFFFF", fontSize: 11, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    textDecoration: "none", fontFamily: font,
                  }}
                >{s.sym}</a>
              ))}
            </div>
          </div>

          {/* Columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
                textTransform: "uppercase", opacity: 0.5, marginBottom: 16,
              }}>{col.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map((link) => (
                  <button
                    key={link.to}
                    type="button"
                    onClick={() => go(link.to)}
                    style={{
                      background: "transparent", border: "none", padding: 0,
                      color: "#FFFFFF", opacity: 0.75, fontSize: 13,
                      cursor: "pointer", fontFamily: font, textAlign: "left",
                    }}
                  >{link.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 12, fontSize: 12, opacity: 0.55,
        }}>
          <span>{copyright}</span>
          <span>CNPJ XX.XXX.XXX/0001-XX · Brasil</span>
        </div>
      </div>
    </footer>
  )
}
