import { useEffect, useState } from "react"

/** Espera a pessoa parar de digitar antes de bater no servidor. */
export function useAtrasado<T>(valor: T, ms = 300): T {
  const [v, setV] = useState(valor)
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t) }, [valor, ms])
  return v
}
