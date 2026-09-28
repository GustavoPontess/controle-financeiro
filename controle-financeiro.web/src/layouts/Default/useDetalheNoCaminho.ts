import { useEffect } from "react"
import { useOutletContext } from "react-router-dom"

export type DetalheNoCaminho = { path: string; label: string }
type Ctx = { definirDetalheNoCaminho?: (label: string | null) => void } | undefined

// Tela de detalhe (/parcelamentos/:id, /emprestimos/:id) põe o nome do item no caminho do topo:
// "Início / Parcelamentos / Fone Teste". O layout amarra o rótulo à rota atual (a Navbar só mostra
// se o path bate) e ele sai no unmount — trocar de tela nunca deixa um nome velho no topo.
export function useDetalheNoCaminho(label: string | null | undefined) {
  const definir = useOutletContext<Ctx>()?.definirDetalheNoCaminho
  useEffect(() => {
    if (!definir || !label) return
    definir(label)
    return () => definir(null)
  }, [definir, label])
}
