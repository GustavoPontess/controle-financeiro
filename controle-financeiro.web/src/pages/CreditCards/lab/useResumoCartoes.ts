// Bancada de layout de Cartões — resumo de CADA cartão pra visão geral "Meus cartões": fatura atual
// (o ciclo de hoje), a fechada que ainda deve (se houver) e o parcelado a pagar.
// Bancada busca as faturas cartão a cartão (o usuário tem poucos); se a visão geral virar a tela real,
// a fatura atual vem junto no DTO do cartão (sem N chamadas).
import { useEffect, useState } from "react"
import { getFaturasByCartao } from "../../../services/faturaService"
import type { CartaoCredito } from "../../../types/CartaoCredito"
import type { Fatura } from "../../../types/Fatura"
import type { Parcelamento } from "../../../types/Parcelamento"
import { indiceMes, indiceMesDeHoje } from "../ciclosFatura"

export type ResumoCartao = {
  /** Fatura do ciclo de hoje (aberta). Undefined = nenhum lançamento no ciclo ainda. */
  atual?: Fatura
  /** Fatura fechada que ainda deve — a que precisa ser paga primeiro. */
  aPagar?: Fatura
  parcelado: number
  parcelamentosAtivos: number
}

export function useResumoCartoes(cartoes: CartaoCredito[], parcelamentos: Parcelamento[] | null) {
  const [faturasPorCartao, setFaturasPorCartao] = useState<Record<string, Fatura[]> | null>(null)
  const ids = cartoes.filter((c) => c.temCredito).map((c) => c.id).join(",")

  useEffect(() => {
    if (!ids) { setFaturasPorCartao({}); return }
    let vivo = true
    Promise.all(ids.split(",").map((id) => getFaturasByCartao(id).then((fs) => [id, fs] as const).catch(() => [id, [] as Fatura[]] as const)))
      .then((pares) => { if (vivo) setFaturasPorCartao(Object.fromEntries(pares)) })
    return () => { vivo = false }
  }, [ids])

  const hoje = new Date()
  const resumo: Record<string, ResumoCartao> = {}
  for (const c of cartoes) {
    const fs = faturasPorCartao?.[c.id] ?? []
    const mesHoje = indiceMesDeHoje(hoje, c.diaFechamento)
    const atual = fs.find((f) => indiceMes(f.dataFechamento) === mesHoje)
    const aPagar = fs
      .filter((f) => f.estadoCiclo === 1 && f.valorRestante > 0)
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))[0]
    const ativos = (parcelamentos ?? []).filter((p) => p.cartaoCreditoId === c.id && p.ativo)
    resumo[c.id] = {
      atual, aPagar,
      parcelado: ativos.reduce((s, p) => s + p.valorRestante, 0),
      parcelamentosAtivos: ativos.length,
    }
  }
  return { carregando: faturasPorCartao === null, resumo }
}

/** "vence em 25 dias" / "vence hoje" / "venceu 08/11". */
export function textoVencimento(f: Fatura | undefined, agora: number) {
  if (!f) return "sem lançamentos no ciclo"
  const dias = Math.round((new Date(f.dataVencimento).getTime() - agora) / 86_400_000)
  const dia = new Date(f.dataVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
  if (f.vencida || dias < 0) return `venceu ${dia}`
  if (dias === 0) return "vence hoje"
  if (dias === 1) return "vence amanhã"
  return `vence ${dia} · em ${dias} dias`
}
