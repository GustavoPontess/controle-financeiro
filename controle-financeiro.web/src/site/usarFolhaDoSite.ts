// Liga, só enquanto uma tela pública está aberta (site e telas de acesso), o que vem do rascunho aprovado:
// a folha do site (site.css, carregada como arquivo pra não vazar nas telas do app logado) e a classe .js no <html>.
// A fonte Plus Jakarta Sans e o preload desta folha já vêm no index.html (vite.config.ts, preloadDoSite), pra não
// entrarem na fila depois do JS.
// Sem tema escolhido, a tela pública abre no claro (decisão do Gustavo; o app logado segue o sistema). Ao sair, tudo
// volta como estava.
import { useLayoutEffect } from "react"
import folha from "./site.css?url"

let abertas = 0

function temaEscolhido(): boolean {
  try { const t = localStorage.getItem("v2:tema"); return t === "claro" || t === "escuro" } catch { return false }
}

export function usarFolhaDoSite() {
  useLayoutEffect(() => {
    const html = document.documentElement
    abertas++
    if (!document.getElementById("pontes-site-css")) {
      const l = document.createElement("link")
      l.id = "pontes-site-css"; l.rel = "stylesheet"; l.href = folha
      document.head.appendChild(l)
    }
    html.classList.add("js")
    const temaAntes = html.dataset.tema
    if (!temaEscolhido()) html.dataset.tema = "claro"
    return () => {
      abertas--
      // Trocar de uma tela pública pra outra não pisca: só tira quando a última fecha.
      if (abertas > 0) return
      document.getElementById("pontes-site-css")?.remove()
      html.classList.remove("js")
      if (!temaEscolhido() && temaAntes) html.dataset.tema = temaAntes
    }
  }, [])
}
