// Moldura do site público pra páginas do app que precisam vestir a roupa do site (Termos de Uso, Política de
// Privacidade): o mesmo topo (logo, menu, Entrar, tema) e o mesmo rodapé das páginas do rascunho, tirados da home pelo
// scripts/importarSite.py (paginas/_topo.html e _rodape.html), com a folha e os comportamentos do site (menu ☰, tema).
// O miolo é React normal; só o topo e o rodapé são HTML do rascunho.
import { useEffect, useLayoutEffect, useRef, type MouseEvent, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { definirTema, type Tema } from "../layout/useTema"
import { ligarSite } from "./comportamentos"
import { usarFolhaDoSite } from "./usarFolhaDoSite"
import topo from "./paginas/_topo.html?raw"
import rodape from "./paginas/_rodape.html?raw"

export default function MolduraSite({ titulo, children }: { titulo: string; children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  usarFolhaDoSite()

  useEffect(() => { document.title = titulo }, [titulo])

  // Menu ☰ e botão de tema do topo, os mesmos do site.
  useLayoutEffect(() => {
    const el = raiz.current
    if (!el) return
    const atual = (): Tema => (document.documentElement.dataset.tema === "escuro" ? "escuro" : "claro")
    return ligarSite(el, { tema: atual, alternarTema: () => definirTema(atual() === "escuro" ? "claro" : "escuro") })
  }, [])

  // Link interno do topo e do rodapé navega pelo app, sem recarregar a página.
  const aoClicar = (ev: MouseEvent) => {
    const a = (ev.target as Element).closest("a")
    const href = a?.getAttribute("href")
    if (!a || !href?.startsWith("/") || a.target || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
    ev.preventDefault()
    navigate(href)
  }

  return (
    <div ref={raiz} onClick={aoClicar}>
      <header className="topo interna" dangerouslySetInnerHTML={{ __html: topo }} />
      {children}
      <div className="wrap" dangerouslySetInnerHTML={{ __html: rodape }} />
    </div>
  )
}
