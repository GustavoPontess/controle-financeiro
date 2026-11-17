// Instalar o Pontes como app (2026-11-17, mesmo molde do CRM). Chrome/Edge/Android: o navegador oferece
// (beforeinstallprompt) e o botão de Configurações abre a janela de instalar. iPhone/iPad: não tem botão; é pelo
// Compartilhar > Adicionar à Tela de Início.
import { useSyncExternalStore } from "react"

type PedidoDeInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

export type JeitoDeInstalar =
  | "instalado" // já está aberto como app
  | "botao" // o navegador deixa instalar pelo botão
  | "iphone" // Safari do iPhone/iPad: pelo Compartilhar
  | "menu" // navegador sem o pedido (Firefox, Safari do Mac, ou já recusado): pelo menu do navegador

let pedido: PedidoDeInstalar | null = null
let instaladoAgora = false
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((l) => l())

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault() // o app mostra o próprio botão, em Configurações
    pedido = e as PedidoDeInstalar
    avisar()
  })
  window.addEventListener("appinstalled", () => { pedido = null; instaladoAgora = true; avisar() })
}

export function abertoComoApp(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(display-mode: standalone)").matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Link pra uma tela do próprio app que, no navegador, abre em aba nova (Termos, Privacidade). Instalado, abre ali
 *  mesmo: aba nova no app instalado é o navegador, com a barra de endereço e os menus. */
export function propsDeLinkInterno(): { target?: "_blank"; rel?: string } {
  return abertoComoApp() ? {} : { target: "_blank", rel: "noreferrer" }
}

export function ehIphone(ua: string = navigator.userAgent, toques: number = navigator.maxTouchPoints ?? 0): boolean {
  // iPad novo se apresenta como Mac; o que entrega é ter tela de toque.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && toques > 1)
}

function jeito(): JeitoDeInstalar {
  if (instaladoAgora || abertoComoApp()) return "instalado"
  if (pedido) return "botao"
  if (ehIphone()) return "iphone"
  return "menu"
}

export function useInstalar(): [JeitoDeInstalar, () => Promise<boolean>] {
  const atual = useSyncExternalStore((l) => { ouvintes.add(l); return () => { ouvintes.delete(l) } }, jeito, jeito)
  const instalar = async () => {
    if (!pedido) return false
    const p = pedido
    await p.prompt()
    const { outcome } = await p.userChoice
    pedido = null // o pedido só vale uma vez
    avisar()
    return outcome === "accepted"
  }
  return [atual, instalar]
}
