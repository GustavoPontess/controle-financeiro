/**
 * Footer — rodapé do site público (rich/minimal). Tema escuro fixo; mesh usa
 * a paleta via var(--pontes-*). `p`/`font` override escopado opcional (#122).
 */

import Logo from "../../Logo/Logo"
import { scopedThemeVars, type Palette } from "../theme"
import { type CSSProperties } from "react"
import styles from "./Footer.module.css"

export type PontesFooterLink = { label: string; to: string }
export type PontesFooterColumn = { title: string; links: PontesFooterLink[] }
export type PontesFooterAppBadge = { label: string; href?: string; onClick?: () => void }

export type PontesFooterProps = {
  p?: Palette
  font?: string
  variant?: "rich" | "minimal"
  /** Override de navegação (default: pushState do browser). */
  onNavigate?: (to: string) => void
  columns?: PontesFooterColumn[]
  minimalLinks?: PontesFooterLink[]
  copyright?: string
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

export function PontesFooter({
  p, font, variant = "rich", onNavigate, columns = DEFAULT_COLUMNS, minimalLinks = DEFAULT_MINIMAL_LINKS,
  copyright = "© 2026 Pontes — Finanças pra família brasileira",
  appBadges,
}: PontesFooterProps) {
  const go = (to: string) => {
    if (onNavigate) onNavigate(to)
    else { window.history.pushState({}, "", to); window.dispatchEvent(new PopStateEvent("popstate")) }
  }

  const mesh = (
    <div className={styles.mesh}>
      <div className={`${styles.blob} ${styles.blob1}`} />
      <div className={`${styles.blob} ${styles.blob2}`} />
      <div className={`${styles.blob} ${styles.blob3}`} />
    </div>
  )

  if (variant === "minimal") {
    return (
      <footer className={styles.footer} data-variant="minimal" style={scopedThemeVars(p, font) as CSSProperties}>
        {mesh}
        <div className="pontes-noise" />
        <div className={styles.minimalInner}>
          <div className={styles.minimalBrand}>
            <Logo color="#FFFFFF" size={20} onClick={() => go("/")} />
            <span className={styles.copy}>{copyright}</span>
          </div>
          <div className={styles.minimalLinks}>
            {minimalLinks.map((link) => (
              <button key={link.to} type="button" onClick={() => go(link.to)} className={styles.linkBtn}>{link.label}</button>
            ))}
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className={styles.footer} data-variant="rich" style={scopedThemeVars(p, font) as CSSProperties}>
      {mesh}
      <div className="pontes-noise" />
      <div className={styles.richInner}>
        <div className={styles.cols}>
          <div>
            <Logo color="#FFFFFF" size={24} onClick={() => go("/")} style={{ marginBottom: 16 }} />
            <p className={styles.brandText}>
              Finanças pra família brasileira. Conecte bancos, divida despesas com seu parceiro e abra acesso pro seu contador.
            </p>
            <div className={styles.social}>
              {[
                { sym: "𝕏", label: "X / Twitter" },
                { sym: "in", label: "LinkedIn" },
                { sym: "ig", label: "Instagram" },
              ].map((s) => (
                <a key={s.label} href="#" aria-label={s.label} className={styles.socialLink}>{s.sym}</a>
              ))}
            </div>
            {appBadges && appBadges.length > 0 && (
              <div className={styles.badges}>
                {appBadges.map((b) => (
                  <a
                    key={b.label}
                    href={b.href ?? "#"}
                    onClick={b.onClick ? (e) => { e.preventDefault(); b.onClick?.() } : undefined}
                    className={styles.badge}
                  >{b.label}</a>
                ))}
              </div>
            )}
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <div className={styles.colTitle}>{col.title}</div>
              <div className={styles.colLinks}>
                {col.links.map((link) => (
                  <button key={link.to} type="button" onClick={() => go(link.to)} className={styles.linkBtn}>{link.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.bottom}>
          <span>{copyright}</span>
          <span>CNPJ XX.XXX.XXX/0001-XX · Brasil</span>
        </div>
      </div>
    </footer>
  )
}
