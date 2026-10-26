// Liga, só enquanto uma tela pública está aberta (site e telas de acesso), o que vem do rascunho aprovado:
// a folha do site (site.css, carregada como arquivo pra não vazar nas telas do app logado), a fonte Plus Jakarta Sans
// e a classe .js no <html>. Sem tema escolhido, a tela pública abre no claro (decisão do Gustavo; o app logado segue
// o sistema). Ao sair, tudo volta como estava.
import { useLayoutEffect } from "react"
import folha from "./site.css?url"

const FONTE = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
let abertas = 0

function link(id: string, href: string) {
  if (document.getElementById(id)) return
  const l = document.createElement("link")
  l.id = id; l.rel = "stylesheet"; l.href = href
  document.head.appendChild(l)
}

function temaEscolhido(): boolean {
  try { const t = localStorage.getItem("v2:tema"); return t === "claro" || t === "escuro" } catch { return false }
}

export function usarFolhaDoSite() {
  useLayoutEffect(() => {
    const html = document.documentElement
    abertas++
    link("pontes-site-fonte", FONTE)
    link("pontes-site-css", folha)
    html.classList.add("js")
    const temaAntes = html.dataset.tema
    if (!temaEscolhido()) html.dataset.tema = "claro"
    return () => {
      abertas--
      // Trocar de uma tela pública pra outra não pisca: só tira quando a última fecha.
      if (abertas > 0) return
      document.getElementById("pontes-site-fonte")?.remove()
      document.getElementById("pontes-site-css")?.remove()
      html.classList.remove("js")
      if (!temaEscolhido() && temaAntes) html.dataset.tema = temaAntes
    }
  }, [])
}
