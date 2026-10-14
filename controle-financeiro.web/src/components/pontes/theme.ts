/**
 * theme.ts — fonte da verdade de tokens da biblioteca Pontes.
 *
 * Inclui:
 * - Paletas (15 — escolha de personalização #90)
 * - Fontes (7 — escolha de personalização #90)
 * - Tokens de espaçamento, radii, sombras, transições
 *
 * Componentes da biblioteca recebem `palette` + `font` por prop até #90
 * entregar context global. Default exposto via `defaultPalette` / `defaultFont`.
 */

export type Palette = {
  id: string
  label: string
  description: string
  primary: string
  primaryDark: string
  primarySoft: string
  accent: string
  accentSoft: string
  text: string
  textMuted: string
  bg: string
  surface: string
  border: string
  heroFg: string
}

export const palettes: Palette[] = [
  { id: "A", label: "Cobalto + Âmbar", description: "Azul vibrante + âmbar quente",
    primary: "#1E40AF", primaryDark: "#1E3A8A", primarySoft: "#EEF2FF",
    accent: "#F59E0B", accentSoft: "#FEF3C7",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7F9FC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "B", label: "Marinho + Esmeralda", description: "Azul-marinho + verde-esmeralda",
    primary: "#0F2A47", primaryDark: "#0A1F35", primarySoft: "#E8EEF6",
    accent: "#10B981", accentSoft: "#D1FAE5",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7F9FC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "C", label: "Petróleo + Coral", description: "Azul-petróleo + laranja-coral",
    primary: "#0E4F6E", primaryDark: "#083B54", primarySoft: "#E0F2F1",
    accent: "#FB923C", accentSoft: "#FFEDD5",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7F9FC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "D", label: "Floresta + Mostarda", description: "Verde-floresta + amarelo-mostarda",
    primary: "#14532D", primaryDark: "#0F3D1F", primarySoft: "#E7F4EC",
    accent: "#EAB308", accentSoft: "#FEF9C3",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E7E5E4", heroFg: "#FFFFFF" },
  { id: "E", label: "Grafite + Lima", description: "Quase-preto + verde-lima",
    primary: "#0A0A0A", primaryDark: "#000000", primarySoft: "#F1F1F1",
    accent: "#A3E635", accentSoft: "#ECFCCB",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAFA", surface: "#FFFFFF", border: "#E5E5E5", heroFg: "#FFFFFF" },
  { id: "F", label: "Roxo-Real + Pêssego", description: "Roxo profundo + pêssego",
    primary: "#4338CA", primaryDark: "#3730A3", primarySoft: "#EEF2FF",
    accent: "#FDA4AF", accentSoft: "#FFE4E6",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E5E5E5", heroFg: "#FFFFFF" },
  { id: "G", label: "Vinho + Dourado", description: "Bordô profundo + dourado luxo",
    primary: "#7F1D1D", primaryDark: "#5F0E0E", primarySoft: "#FEE2E2",
    accent: "#D4AF37", accentSoft: "#FEF3C7",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E5E5E5", heroFg: "#FFFFFF" },
  { id: "H", label: "Ciano + Magenta", description: "Ciano elétrico + magenta vibrante",
    primary: "#0891B2", primaryDark: "#0E7490", primarySoft: "#CFFAFE",
    accent: "#D946EF", accentSoft: "#FAE8FF",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7FBFC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "I", label: "Lavanda + Pêssego", description: "Lavanda suave + pêssego claro",
    primary: "#7C3AED", primaryDark: "#6D28D9", primarySoft: "#EDE9FE",
    accent: "#FFAB9F", accentSoft: "#FFE4E6",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E7E5E4", heroFg: "#FFFFFF" },
  { id: "J", label: "Verde-menta + Coral", description: "Menta moderno + coral vibrante",
    primary: "#047857", primaryDark: "#065F46", primarySoft: "#D1FAE5",
    accent: "#F97316", accentSoft: "#FFEDD5",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7FCF9", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "K", label: "Azul-céu + Coral", description: "Azul claro vivido + coral",
    primary: "#0284C7", primaryDark: "#0369A1", primarySoft: "#E0F2FE",
    accent: "#FB7185", accentSoft: "#FFE4E6",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7F9FC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
  { id: "L", label: "Terracota + Sálvia", description: "Terra brasileira + verde sálvia",
    primary: "#B45309", primaryDark: "#92400E", primarySoft: "#FEF3C7",
    accent: "#84CC16", accentSoft: "#ECFCCB",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E7E5E4", heroFg: "#FFFFFF" },
  { id: "M", label: "Marrom-café + Creme", description: "Café terroso + creme aconchego",
    primary: "#78350F", primaryDark: "#5F2A0A", primarySoft: "#FEF3C7",
    accent: "#FBBF24", accentSoft: "#FEF9C3",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E7E5E4", heroFg: "#FFFFFF" },
  { id: "N", label: "Rosa-pink + Verde", description: "Rosa vibrante + verde-folha",
    primary: "#DB2777", primaryDark: "#BE185D", primarySoft: "#FCE7F3",
    accent: "#10B981", accentSoft: "#D1FAE5",
    text: "#0B1220", textMuted: "#5A6679", bg: "#FAFAF9", surface: "#FFFFFF", border: "#E5E5E5", heroFg: "#FFFFFF" },
  { id: "O", label: "Índigo + Limão", description: "Índigo profundo + limão elétrico",
    primary: "#312E81", primaryDark: "#1E1B4B", primarySoft: "#E0E7FF",
    accent: "#D9F99D", accentSoft: "#ECFCCB",
    text: "#0B1220", textMuted: "#5A6679", bg: "#F7F9FC", surface: "#FFFFFF", border: "#E5EAF2", heroFg: "#FFFFFF" },
]

export type FontOption = { id: string; label: string; description: string; family: string; url: string }

export const fonts: FontOption[] = [
  { id: "inter", label: "Inter", description: "Neutra SaaS",
    family: "'Inter', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" },
  { id: "geist", label: "Geist", description: "Vercel/Linear",
    family: "'Geist', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&display=swap" },
  { id: "manrope", label: "Manrope", description: "Humanista",
    family: "'Manrope', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" },
  { id: "ibm", label: "IBM Plex Sans", description: "Fintech séria",
    family: "'IBM Plex Sans', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" },
  { id: "outfit", label: "Outfit", description: "Moderna redonda",
    family: "'Outfit', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" },
  { id: "plus-jakarta", label: "Plus Jakarta Sans", description: "Acolhedora",
    family: "'Plus Jakarta Sans', system-ui, sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" },
  { id: "satoshi", label: "Satoshi", description: "Premium",
    family: "'Satoshi', system-ui, sans-serif",
    url: "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap" },
]

export const defaultPalette: Palette = palettes[0]
export const defaultFont: FontOption = fonts.find((f) => f.id === "manrope") ?? fonts[0]

/**
 * Override de tema escopado pra um componente/elemento.
 *
 * Transição (#122): os componentes Pontes leem cor/fonte de `var(--pontes-*)`.
 * Enquanto as telas ainda passam `p`/`font` por prop, o componente aplica esses
 * valores como CSS vars inline (escopo local) — herda do :root se não vier nada.
 * Comportamento idêntico ao legado; quando as telas pararem de passar, vira no-op.
 */
export function scopedThemeVars(p?: Palette, font?: string): Record<string, string> {
  const out: Record<string, string> = p ? paletteVars(p) : {}
  if (font) out["--pontes-font"] = font
  return out
}

/**
 * Mapeia uma Palette para o objeto de CSS vars `--pontes-*`.
 * Usado pelo ThemeProvider (global, no :root) e por wrappers de tema escopado
 * (ex: showroom /design-system previewa paleta sem mexer no tema global).
 */
export function paletteVars(p: Palette): Record<string, string> {
  return {
    "--pontes-primary": p.primary,
    "--pontes-primary-dark": p.primaryDark,
    "--pontes-primary-soft": p.primarySoft,
    "--pontes-accent": p.accent,
    "--pontes-accent-soft": p.accentSoft,
    "--pontes-text": p.text,
    "--pontes-text-muted": p.textMuted,
    "--pontes-bg": p.bg,
    "--pontes-surface": p.surface,
    "--pontes-border": p.border,
    "--pontes-hero-fg": p.heroFg,
  }
}

/** Tokens de espaçamento (4-base scale). */
export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 32, "4xl": 48, "5xl": 64, "6xl": 96,
} as const

/** Tokens de raio. */
export const radii = {
  none: 0, xs: 4, sm: 6, md: 8, lg: 10, xl: 12, "2xl": 14, "3xl": 18, "4xl": 22, full: 999,
} as const

/** Tokens de sombra. */
export const shadows = {
  xs: "0 1px 2px rgba(0,0,0,0.05)",
  sm: "0 4px 8px -2px rgba(0,0,0,0.08)",
  md: "0 8px 24px -8px rgba(0,0,0,0.12)",
  lg: "0 18px 40px -10px rgba(0,0,0,0.18)",
  xl: "0 24px 60px -20px rgba(0,0,0,0.22)",
  "2xl": "0 30px 80px rgba(0,0,0,0.3)",
} as const

/** Tokens de transição. */
export const transitions = {
  fast: "all 150ms ease",
  normal: "all 250ms ease",
  slow: "all 400ms ease",
} as const

/** Tokens semânticos de feedback (independem de paleta). */
export const semantic = {
  success: "#10B981", successSoft: "#D1FAE5",
  warning: "#F59E0B", warningSoft: "#FEF3C7",
  danger: "#DC2626", dangerSoft: "#FEE2E2",
  info: "#0EA5E9", infoSoft: "#E0F2FE",
} as const

/** Utilitário: ajusta lightness e saturação de cor hex via HSL. */
export function adjustColor(hex: string, dl: number, ds = 0): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return hslToHex(h, Math.max(0, Math.min(1, s + ds)), Math.max(0, Math.min(1, l + dl)))
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
