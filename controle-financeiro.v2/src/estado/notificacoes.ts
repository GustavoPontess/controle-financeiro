// Contador de notificações não lidas (o sino do topo). Um só pedido pro app inteiro: o layout consulta
// de minuto em minuto e a cada troca de tela; a página de notificações pede recarga ao marcar como lida.
import { useEffect, useState, useSyncExternalStore } from "react"
import { getContagemNaoLidas, getNotificacoes, marcarNotificacaoLida, marcarTodasLidas } from "../services/notificacaoService"
import type { Notificacao } from "../types/Notificacao"

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

/** Lista de notificações (a página e o painel do sino): carrega ao montar; marcar lida já reflete na tela
 *  e no contador do sino, sem esperar o servidor. */
export function useListaNotificacoes() {
  const [itens, setItens] = useState<Notificacao[] | null>(null)
  const [erro, setErro] = useState(false)
  const [marcandoTodas, setMarcandoTodas] = useState(false)

  useEffect(() => {
    let vivo = true
    getNotificacoes().then((n) => { if (vivo) setItens(n) }).catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [])

  const marcarLida = async (n: Notificacao) => {
    if (n.lida) return
    setItens((prev) => prev?.map((x) => (x.id === n.id ? { ...x, lida: true } : x)) ?? prev)
    definirNaoLidas(Math.max(0, naoLidas - 1))
    try { await marcarNotificacaoLida(n.id) } catch { /* a tela já mostrou como lida; o servidor acerta na próxima carga */ }
    void recarregarNaoLidas()
  }

  const marcarTodas = async () => {
    setMarcandoTodas(true)
    try {
      await marcarTodasLidas()
      setItens((prev) => prev?.map((n) => ({ ...n, lida: true })) ?? prev)
      definirNaoLidas(0)
    } catch { /* o botão continua disponível pra tentar de novo */ } finally { setMarcandoTodas(false) }
  }

  return { itens, erro, naoLidas: itens?.filter((n) => !n.lida).length ?? 0, marcarLida, marcarTodas, marcandoTodas }
}
