// Tema do front v2 (claro/escuro): lembrado por dispositivo; sem escolha, segue o sistema.
import { useEffect, useState } from "react"

export type Tema = "claro" | "escuro"
const CHAVE = "v2:tema"

function inicial(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE)
    if (salvo === "claro" || salvo === "escuro") return salvo
  } catch { /* privado/bloqueado → segue o sistema */ }
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "escuro" : "claro"
}

export function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(inicial)
  useEffect(() => { try { localStorage.setItem(CHAVE, tema) } catch { /* ignore */ } }, [tema])
  return [tema, () => setTema((t) => (t === "claro" ? "escuro" : "claro"))]
}
