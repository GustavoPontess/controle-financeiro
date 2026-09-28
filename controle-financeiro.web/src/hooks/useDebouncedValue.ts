import { useEffect, useState } from "react"

/**
 * Valor "atrasado": só muda depois de `ms` sem alteração. Pra busca server-side — 1 request por
 * pausa na digitação, não 1 por tecla (as telas do padrão PontesToolbar usam isto).
 */
export function useDebouncedValue<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
