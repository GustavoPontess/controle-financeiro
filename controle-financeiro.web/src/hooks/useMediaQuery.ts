import { useEffect, useState } from "react"

/** Celular: abaixo de 768px (tablet em pé pra cima continua com o layout de desktop). */
export const CELULAR = "(max-width: 767px)"
/** Tablet e menores: abaixo de 1024px (a barra lateral começa recolhida pra sobrar espaço). */
export const ATE_TABLET = "(max-width: 1023px)"

/** A query casa AGORA (leitura única, sem acompanhar). Sem matchMedia (SSR / teste): trata como desktop. */
export const casa = (query: string) =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches

/**
 * A media query casa agora? Acompanha mudança de tamanho/orientação. Use só onde o COMPORTAMENTO muda
 * (ex.: barra lateral vira gaveta); só aparência continua em `@media` no CSS Module.
 */
export function useMediaQuery(query: string): boolean {
  const [casou, setCasou] = useState(() => casa(query))

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const mql = window.matchMedia(query)
    const atualizar = () => setCasou(mql.matches)
    atualizar()
    mql.addEventListener("change", atualizar)
    return () => mql.removeEventListener("change", atualizar)
  }, [query])

  return casou
}
