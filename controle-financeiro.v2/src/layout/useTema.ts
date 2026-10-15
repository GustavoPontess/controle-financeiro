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
  // O tema vale pro documento inteiro (tokens no :root): <html data-tema>. O index.html já aplica antes
  // do 1º desenho; aqui mantém em dia ao alternar.
  useEffect(() => {
    document.documentElement.dataset.tema = tema
    try { localStorage.setItem(CHAVE, tema) } catch { /* ignore */ }
  }, [tema])
  return [tema, () => setTema((t) => (t === "claro" ? "escuro" : "claro"))]
}
