/**
 * siteTheme — atalho de tema pras páginas do site.
 * Lê do PontesThemeProvider global (#90). Retorna { p, font } pra ergonomia.
 */

import { usePontesTheme } from "../../components/pontes"

export function useSiteTheme() {
  const { palette, font } = usePontesTheme()
  return { p: palette, font }
}
