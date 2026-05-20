/**
 * theme.ts — paletas e fontes do site público + design system.
 * Extraído de HomePage.tsx pra evitar `react-refresh/only-export-components` error.
 *
 * Marca decidida (sessão 30, 2026-05-21):
 * - Logo wordmark: Plus Jakarta Sans (fixa)
 * - Paleta + fonte do produto: escolha do usuário (#90 personalização)
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
