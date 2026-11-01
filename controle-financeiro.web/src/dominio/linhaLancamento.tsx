// Como um lançamento vira uma linha da ListaPorDia — o mesmo em Transações e no extrato da conta
// (Bancos). Transferência e pagamento de fatura são neutros: mexem no caixa, não são ganho nem gasto.
// Compra parcelada (Transações › Gastos) é uma linha só, com o total, e abre a página do parcelamento.
// Dinheiro de empréstimo leva a etiqueta "Empréstimo" (com os juros, quando tem): mexe no saldo, mas só os juros contam no
// mês. Na visão Gastos (soOGasto), a parcela de empréstimo aparece pelo gasto dela: os juros.
import { ArrowLeftRight, CreditCard } from "lucide-react"
import type { Transaction } from "../types/Transaction"
import type { TomDinheiro } from "../componentes/Dinheiro"
import type { ItemDoDia } from "../componentes/ListaPorDia"
import Etiqueta from "../componentes/Etiqueta"
import { formatMoney } from "../utils/money"

export type NaturezaLancamento = "entrada" | "saida" | "transferencia" | "fatura"

export const naturezaDe = (t: Transaction): NaturezaLancamento =>
  t.ehTransferencia ? "transferencia" : t.ehPagamentoFatura ? "fatura" : t.tipo === 2 ? "entrada" : "saida"

/** `detalhe`: o que vai na 2ª linha além da categoria e do meio (Transações mostra a conta; o extrato da conta não repete). */
export function linhaDoLancamento(t: Transaction, categoria?: string, opcoes: { semConta?: boolean; soOGasto?: boolean } = {}): ItemDoDia {
  const soJuros = !!(opcoes.soOGasto && t.ehEmprestimo && t.valorJuros)
  const n = naturezaDe(t)
  const tom: TomDinheiro | undefined = n === "entrada" ? "positivo" : n === "saida" || n === "fatura" ? "negativo" : "neutro"
  const icone = n === "transferencia" ? <ArrowLeftRight size={16} strokeWidth={2} aria-hidden="true" />
    : n === "fatura" ? <CreditCard size={16} strokeWidth={2} aria-hidden="true" />
    : t.descricao.trim().charAt(0).toUpperCase() || "•"
  const parcelada = !!t.ehCompraParcelada && !!t.cartaoCreditoId
  const deOnde = opcoes.semConta ? null : t.contaNome ?? t.cartaoCreditoNome
  const comoPagou = parcelada && t.parcelas && t.valorParcela != null
    ? `${t.parcelas}x de ${formatMoney(t.valorParcela)}`
    : t.meioPagamentoDescricao
  return {
    id: t.id,
    dia: t.data,
    para: parcelada ? `/cartoes/${t.cartaoCreditoId}/parcelamentos/${t.id}` : `/transacoes/${t.id}`,
    estado: parcelada ? { voltarPara: "/transacoes" } : undefined,
    icone,
    tomIcone: n === "entrada" ? "positivo" : n === "saida" ? undefined : "neutro",
    nome: t.descricao,
    sub: [deOnde, categoria, comoPagou].filter(Boolean).join(" · ") || undefined,
    hora: t.hora ? t.hora.slice(0, 5) : null,
    etiqueta: t.statusTransacao === 0 ? <Etiqueta tom="alerta">Previsto</Etiqueta> : t.ehEmprestimo ? <Etiqueta>{soJuros ? "Juros do empréstimo" : t.valorJuros ? `Empréstimo · ${formatMoney(t.valorJuros)} de juros` : "Empréstimo"}</Etiqueta> : t.ehAcerto ? <Etiqueta>Acerto</Etiqueta> : undefined,
    valor: soJuros ? t.valorJuros! : t.valor,
    tom,
  }
}
