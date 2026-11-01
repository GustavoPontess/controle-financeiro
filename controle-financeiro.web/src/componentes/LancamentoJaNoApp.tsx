// Escolher um lançamento que já está no app (importado do extrato ou lançado na mão) pra ligar ao empréstimo, em vez de
// lançar outro: sem isso, o dinheiro aparecia duas vezes (2026-11-01; o servidor já aceitava `transacaoExistenteId`).
// Lista os efetivados dos últimos 120 dias com a natureza certa (entrada ou saída); os do mesmo valor vêm primeiro.
import { useEffect, useMemo, useState } from "react"
import { listTransactionsPage } from "../services/transactionService"
import type { Transaction } from "../types/Transaction"
import { dataBR, dataLocalISO, somaDias } from "../utils/dateTime"
import { formatMoney } from "../utils/money"
import Selecao from "./Selecao"

/** Valor da opção "Já está no app" na escolha de conta (não é id de conta). */
export const JA_NO_APP = "ja-no-app"

export default function LancamentoJaNoApp({ entrada, valor, escolhido, onChange }: {
  /** true: entrou dinheiro (receita); false: saiu (despesa). */
  entrada: boolean
  /** O valor digitado no formulário, pra pôr os iguais primeiro. */
  valor: number
  escolhido: string
  onChange: (t: Transaction) => void
}) {
  const [lancamentos, setLancamentos] = useState<Transaction[] | null>(null)

  useEffect(() => {
    let vivo = true
    // Só o que já aconteceu (efetivado, até hoje): previsão de conta fixa não é dinheiro que entrou ou saiu.
    const hoje = dataLocalISO()
    listTransactionsPage(1, 100, { natureza: entrada ? "entrada" : "saida", status: 1, from: somaDias(hoje, -120), to: somaDias(hoje, 1) })
      .then((r) => { if (vivo) setLancamentos(r.items) })
      .catch(() => { if (vivo) setLancamentos([]) })
    return () => { vivo = false }
  }, [entrada])

  const opcoes = useMemo(() => [...(lancamentos ?? [])]
    .sort((a, b) => Number(b.valor === valor) - Number(a.valor === valor) || b.data.localeCompare(a.data))
    .map((t) => ({ valor: t.id, rotulo: `${dataBR(t.data)} · ${t.descricao}`, detalhe: formatMoney(t.valor) })), [lancamentos, valor])

  return (
    <Selecao valor={escolhido} placeholder={lancamentos === null ? "Carregando…" : opcoes.length ? "Escolha o lançamento" : "Nenhum nos últimos 120 dias"}
      onChange={(id) => { const t = lancamentos?.find((x) => x.id === id); if (t) onChange(t) }} opcoes={opcoes} />
  )
}
