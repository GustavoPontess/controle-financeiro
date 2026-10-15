// Contador de notificações não lidas (o sino do topo). Um só pedido pro app inteiro: o layout consulta
// de minuto em minuto e a cada troca de tela; a página de notificações pede recarga ao marcar como lida.
import { useEffect, useSyncExternalStore } from "react"
import { getContagemNaoLidas } from "../services/notificacaoService"

const INTERVALO_MS = 60_000
let naoLidas = 0
const ouvintes = new Set<() => void>()
const assinar = (l: () => void) => { ouvintes.add(l); return () => { ouvintes.delete(l) } }
const ler = () => naoLidas

export async function recarregarNaoLidas(): Promise<void> {
  try {
    const c = await getContagemNaoLidas()
    if (c.naoLidas !== naoLidas) { naoLidas = c.naoLidas; ouvintes.forEach((l) => l()) }
  } catch { /* contador não é crítico */ }
}

/** Já atualiza no local (sem esperar o servidor) — ex.: "marcar todas" zera na hora. */
export function definirNaoLidas(n: number): void {
  if (n === naoLidas) return
  naoLidas = n
  ouvintes.forEach((l) => l())
}

/** Contador vivo: recarrega ao montar, a cada troca de `chave` (a rota) e de minuto em minuto. */
export function useNaoLidas(chave: string): number {
  useEffect(() => {
    recarregarNaoLidas()
    const timer = setInterval(recarregarNaoLidas, INTERVALO_MS)
    return () => clearInterval(timer)
  }, [chave])
  return useSyncExternalStore(assinar, ler, ler)
}
