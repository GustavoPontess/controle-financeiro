// Quantos lançamentos pendentes (sem categoria) a pessoa tem: o número ao lado de "Pendentes" no menu. Um só pedido
// pro app inteiro: o layout consulta a cada troca de tela; a fila e o Importar avisam quando o número muda.
import { useEffect, useSyncExternalStore } from "react"
import { getQuantidadePendentes } from "../services/importacaoService"

let pendentes = 0
const ouvintes = new Set<() => void>()
const assinar = (l: () => void) => { ouvintes.add(l); return () => { ouvintes.delete(l) } }
const ler = () => pendentes

export async function recarregarPendentes(): Promise<void> {
  try {
    definirPendentes(await getQuantidadePendentes())
  } catch { /* o número não é crítico */ }
}

/** Já atualiza no local (a fila sabe quantos restaram ao gravar). */
export function definirPendentes(n: number): void {
  if (n === pendentes) return
  pendentes = n
  ouvintes.forEach((l) => l())
}

/** Número vivo: recarrega ao montar e a cada troca de `chave` (a rota). */
export function usePendentes(chave: string): number {
  useEffect(() => { void recarregarPendentes() }, [chave])
  return useSyncExternalStore(assinar, ler, ler)
}
