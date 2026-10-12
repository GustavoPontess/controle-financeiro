import { useEffect, useRef } from "react"
import { PontesDialog } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { notificacaoDeErro, type SeveridadeErro } from "@/utils/apiError"
import { estornarPagamento } from "../../services/faturaService"

type Notificar = (n: { open: boolean; message: string; severity: "success" | SeveridadeErro }) => void

type Props = {
  /** Pagamento a estornar (o lançamento na conta). null = fechado. */
  pagamento: { id: string; valor: number } | null
  onClose: () => void
  /** Depois do estorno: recarregar o que ele mexe (saldo, fatura, limite). */
  onEstornado: () => void
  notify: Notificar
}

/**
 * Confirmação do estorno de um pagamento de fatura — a mesma na fatura (Cartões) e nas Transações.
 * Idempotency-Key nasce quando a confirmação ABRE e vale pra toda tentativa dela: se a rede cair depois de
 * o servidor estornar, confirmar de novo devolve o mesmo estorno em vez de falhar ou estornar 2x.
 */
export default function EstornarPagamentoDialog({ pagamento, onClose, onEstornado, notify }: Props) {
  const chave = useRef("")
  const enviando = useRef(false)
  const pagamentoId = pagamento?.id

  useEffect(() => {
    if (pagamentoId) chave.current = crypto.randomUUID()
  }, [pagamentoId])

  const confirmar = async () => {
    if (!pagamento || enviando.current) return
    enviando.current = true
    try {
      await estornarPagamento(pagamento.id, chave.current)
    } catch (err) {
      // 4xx com mensagem (ex.: "Este pagamento já foi estornado.") vira aviso; rede/5xx deixa a
      // confirmação aberta pro retry com a mesma chave.
      notify({ open: true, ...notificacaoDeErro(err, "Erro ao estornar pagamento") })
      if ((err as { response?: { status?: number } })?.response?.status === 409) {
        onClose()
        onEstornado()
      }
      return
    } finally {
      enviando.current = false
    }
    notify({ open: true, message: "Pagamento estornado", severity: "success" })
    onClose()
    onEstornado()
  }

  return (
    <PontesDialog
      open={pagamento !== null}
      title="Estornar pagamento?"
      description={pagamento
        ? `${formatMoney(pagamento.valor)} voltam pra conta e a fatura volta a dever esse valor.`
        : undefined}
      tone="warning"
      confirmLabel="Estornar"
      onConfirm={() => { void confirmar() }}
      onCancel={onClose}
    />
  )
}
