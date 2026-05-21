/**
 * Footer — rodapé compartilhado do site público.
 *
 * Variantes:
 *  - "rich" (default): 4 colunas (Produto, Recursos, Sobre, Legal) + brand + social
 *  - "minimal": apenas brand + links curtos numa única linha
 */

import { useEffect } from "react"
import Logo from "../../Logo/Logo"
import { ensurePontesGlobalStyles } from "../_globalStyles"
import type { Palette } from "../theme"

export type PontesFooterLink = { label: string; to: string }

export type PontesFooterColumn = {
  title: string
  links: PontesFooterLink[]
}

export type PontesFooterAppBadge = {
  label: string
  href?: string
  onClick?: () => void
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
  /** Badges de app store (ex: App Store, Google Play). Só aparece em variant=rich. */
  appBadges?: PontesFooterAppBadge[]
}

const DEFAULT_COLUMNS: PontesFooterColumn[] = [
  { title: "Produto", links: [
    { label: "Recursos", to: "/recursos" },
    { label: "Para Casais", to: "/casais" },
    { label: "Para Contadores", to: "/contadores" },
    { label: "Preços", to: "/precos" },
  ] },
  { title: "Empresa", links: [
    { label: "Sobre", to: "/sobre" },
    { label: "Blog", to: "/blog" },
    { label: "Contato", to: "/contato" },
  ] },
  { title: "Recursos", links: [
    { label: "Central de ajuda", to: "/ajuda" },
    { label: "Status", to: "/status" },
    { label: "API", to: "/api" },
  ] },
  { title: "Legal", links: [
    { label: "Termos", to: "/termos" },
    { label: "Privacidade", to: "/privacidade" },
    { label: "LGPD", to: "/lgpd" },
  ] },
]

const DEFAULT_MINIMAL_LINKS: PontesFooterLink[] = [
  { label: "Home", to: "/" },
  { label: "Para Casais", to: "/casais" },
  { label: "Entrar", to: "/auth/login" },
]

/** Mesh gradient — blobs blur animados, cores da paleta. Fundo escuro do footer. */
function FooterMesh({ p }: { p: Palette }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: "10%", top: "10%", width: 360, height: 360, background: p.primary, borderRadius: "50%", filter: "blur(90px)", opacity: 0.35, animation: "pontes-mesh-move 16s ease-in-out infinite" }} />
      <div style={{ position: "absolute", right: "8%", top: "20%", width: 320, height: 320, background: p.accent, borderRadius: "50%", filter: "blur(90px)", opacity: 0.28, animation: "pontes-mesh-move 19s ease-in-out infinite reverse" }} />
      <div style={{ position: "absolute", left: "45%", bottom: "5%", width: 300, height: 300, background: p.primary, borderRadius: "50%", filter: "blur(90px)", opacity: 0.25, animation: "pontes-mesh-move 22s ease-in-out infinite" }} />
    </div>
  )
}

export function PontesFooter({
  p, font, variant = "rich", onNavigate, columns = DEFAULT_COLUMNS, minimalLinks = DEFAULT_MINIMAL_LINKS,
  copyright = "© 2026 Pontes — Finanças pra família brasileira",
  appBadges,
}: PontesFooterProps) {
  useEffect(ensurePontesGlobalStyles, [])
  const go = (to: string) => {
    if (onNavigate) onNavigate(to)
    else { window.history.pushState({}, "", to); window.dispatchEvent(new PopStateEvent("popstate")) }
  }

  if (variant === "minimal") {
    return (
      <footer style={{ padding: 48, background: "#0B1220", color: "#FFFFFF", fontFamily: font, position: "relative", overflow: "hidden" }}>
        <FooterMesh p={p} />
        <div className="pontes-noise" />
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 16, position: "relative", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Logo color="#FFFFFF" size={20} onClick={() => go("/")} />
            <span style={{ fontSize: 12, opacity: 0.5 }}>{copyright}</span>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {minimalLinks.map((link) => (
              <button
                key={link.to}
                type="button"
                onClick={() => go(link.to)}
                className="pontes-link-hover"
                style={{
                  background: "transparent", border: "none", color: "#FFFFFF",
                  fontSize: 13, opacity: 0.75, cursor: "pointer", fontFamily: font,
                  ["--pontes-hover-color" as never]: "#FFFFFF",
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
    <footer style={{ padding: "72px 48px 32px", background: "#0B1220", color: "#FFFFFF", fontFamily: font, position: "relative", overflow: "hidden" }}>
      <FooterMesh p={p} />
      <div className="pontes-noise" />
      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.4fr repeat(4, 1fr)",
          gap: 40, marginBottom: 56,
        }}>
          {/* Brand column */}
          <div>
            <Logo color="#FFFFFF" size={24} onClick={() => go("/")} style={{ marginBottom: 16 }} />
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
                  className="pontes-clickable"
                  data-pontes-variant="ghost"
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#FFFFFF", fontSize: 11, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    textDecoration: "none", fontFamily: font,
                    ["--pontes-hover-bg" as never]: "rgba(255,255,255,0.14)",
                    ["--pontes-hover-text" as never]: "#FFFFFF",
                    ["--pontes-hover-border" as never]: "rgba(255,255,255,0.3)",
                  }}
                >{s.sym}</a>
              ))}
            </div>

            {/* App store badges opcionais */}
            {appBadges && appBadges.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
                {appBadges.map((b) => (
                  <a
                    key={b.label}
                    href={b.href ?? "#"}
                    onClick={b.onClick ? (e) => { e.preventDefault(); b.onClick?.() } : undefined}
                    className="pontes-clickable"
                    data-pontes-variant="ghost"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      padding: "8px 14px", borderRadius: 8,
                      fontSize: 12, fontWeight: 600, color: "#FFFFFF",
                      textDecoration: "none", fontFamily: font,
                      border: "1px solid rgba(255,255,255,0.12)",
                      ["--pontes-hover-bg" as never]: "rgba(255,255,255,0.16)",
                      ["--pontes-hover-text" as never]: "#FFFFFF",
                      ["--pontes-hover-border" as never]: "rgba(255,255,255,0.3)",
                    }}
                  >{b.label}</a>
                ))}
              </div>
            )}
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
                    className="pontes-link-hover"
                    style={{
                      background: "transparent", border: "none", padding: 0,
                      color: "#FFFFFF", opacity: 0.75, fontSize: 13,
                      cursor: "pointer", fontFamily: font, textAlign: "left",
                      ["--pontes-hover-color" as never]: "#FFFFFF",
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
