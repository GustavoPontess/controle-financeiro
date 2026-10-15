// Caminho do topo ("Início / Transações / Mercado"): a tela de detalhe põe o nome do item no último nível.
// O layout amarra o rótulo à rota atual (só mostra se o path bate) e ele sai quando a tela desmonta —
// trocar de tela nunca deixa um nome velho no topo.
import { useEffect } from "react"
import { useOutletContext } from "react-router-dom"

export type ContextoLayout = { definirDetalheNoCaminho: (rotulo: string | null) => void }

export function useDetalheNoCaminho(rotulo: string | null | undefined) {
  const definir = useOutletContext<ContextoLayout | undefined>()?.definirDetalheNoCaminho
  useEffect(() => {
    if (!definir || !rotulo) return
    definir(rotulo)
    return () => definir(null)
  }, [definir, rotulo])
}
