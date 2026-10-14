// Bancada de layout de Cartões — dados da aba Parcelamentos (mesmos serviços da tela real): lista com o
// filtro de situação NO SERVIDOR, KPIs do servidor, cartões, e o "Novo parcelamento" (o mesmo modal).
// Bancada lê até 100 (ParcelamentoService.listar); o filtro POR CARTÃO das variantes B/C é na tela — se
// uma delas vencer, o filtro por cartão vai pro servidor antes de virar a tela real.
import React, { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { ParcelamentoService } from "../../../services/ParcelamentoService"
import { getCartoes } from "../../../services/cartaoCreditoService"
import type { Parcelamento } from "../../../types/Parcelamento"
import type { CartaoCredito } from "../../../types/CartaoCredito"
import { rotuloMesFatura, somarMeses } from "../ciclosFatura"

type Notification = { open: boolean; message: string; severity: "success" | "error" | "warning" }
type Notify = React.Dispatch<React.SetStateAction<Notification>>

export type FiltroParcelamentos = "ativos" | "encerrados" | "todos"

export function useParcelamentosLab() {
  const { notify } = useOutletContext<{ notify: Notify }>()
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [itens, setItens] = useState<Parcelamento[] | null>(null)
  const [stats, setStats] = useState({ ativos: 0, totalRestante: 0, qtdTotal: 0 })
  const [filtro, setFiltro] = useState<FiltroParcelamentos>("ativos")
  const [novo, setNovo] = useState<{ aberto: boolean; key: number; cartaoId?: string }>({ aberto: false, key: 0 })

  const carregar = useCallback(async () => {
    try {
      const [lista, s, cs] = await Promise.all([
        ParcelamentoService.listar(filtro === "todos" ? undefined : filtro === "ativos"),
        ParcelamentoService.obterStats(),
        getCartoes(),
      ])
      setItens(lista)
      setStats(s)
      setCartoes(cs)
    } catch {
      setItens([])
      notify({ open: true, message: "Erro ao carregar parcelamentos", severity: "error" })
    }
  }, [filtro, notify])

  useEffect(() => { void carregar() }, [carregar])

  return {
    notify, cartoes, itens, stats, filtro, setFiltro, carregar,
    novo,
    // O modal remonta a cada abertura (key): form zerado e Idempotency-Key nova.
    abrirNovo: (cartaoId?: string) => setNovo((n) => ({ aberto: true, key: n.key + 1, cartaoId })),
    fecharNovo: () => setNovo((n) => ({ ...n, aberto: false })),
  }
}

/** Quantas faltam, em que fatura vem a próxima e em qual termina ("mar/27"). */
export function progressoParcelamento(p: Parcelamento) {
  const faltam = Math.max(0, p.quantidadeParcelas - p.parcelasPagas)
  const proximaMes = p.proximaParcela?.faturaMesReferencia.slice(0, 7)
  const ultimoMes = proximaMes && faltam > 0 ? somarMeses(proximaMes, faltam - 1) : undefined
  const curto = (mes?: string) => {
    if (!mes) return undefined
    const r = rotuloMesFatura(`${mes}-01T00:00:00Z`)
    return `${r.slice(0, 3).toLowerCase()}/${mes.slice(2, 4)}`
  }
  return {
    faltam,
    pct: p.quantidadeParcelas ? (p.parcelasPagas / p.quantidadeParcelas) * 100 : 0,
    proxima: curto(proximaMes),
    termina: curto(ultimoMes),
  }
}
