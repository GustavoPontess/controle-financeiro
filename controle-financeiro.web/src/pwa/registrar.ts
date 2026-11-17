// Liga o service worker (src/pwa/sw.js, publicado como /sw.js) e a cor da barra do celular. Sem o worker o Pontes
// não instala como app; sem ele segue funcionando como site. Chamado uma vez no main.tsx (o admin não registra).
import { COR_DA_BARRA } from "./manifesto"

export function registrarServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return
  const registrar = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* sem worker: segue como site */ })
  }
  // Depois do load (não disputa banda com a 1ª tela); se ele já passou, na hora.
  if (document.readyState === "complete") registrar()
  else window.addEventListener("load", registrar, { once: true })
}

/** A barra do celular (meta theme-color) acompanha o tema: o do 1º desenho (index.html) e cada troca (useTema). */
export function acompanharCorDaBarra(): void {
  const raiz = document.documentElement
  const aplicar = () => {
    const cor = raiz.dataset.tema === "escuro" ? COR_DA_BARRA.escuro : COR_DA_BARRA.claro
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", cor)
  }
  aplicar()
  new MutationObserver(aplicar).observe(raiz, { attributes: true, attributeFilter: ["data-tema"] })
}
