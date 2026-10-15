// Como um lançamento vira uma linha da ListaPorDia — o mesmo em Transações e no extrato da conta
// (Bancos). Transferência e pagamento de fatura são neutros: mexem no caixa, não são ganho nem gasto.
import { ArrowLeftRight, CreditCard } from "lucide-react"
import type { Transaction } from "../types/Transaction"
import type { TomDinheiro } from "../componentes/Dinheiro"
import type { ItemDoDia } from "../componentes/ListaPorDia"
import Etiqueta from "../componentes/Etiqueta"

export type NaturezaLancamento = "entrada" | "saida" | "transferencia" | "fatura"

export const naturezaDe = (t: Transaction): NaturezaLancamento =>
  t.ehTransferencia ? "transferencia" : t.ehPagamentoFatura ? "fatura" : t.tipo === 2 ? "entrada" : "saida"

/** `detalhe`: o que vai na 2ª linha além da categoria e do meio (Transações mostra a conta; o extrato da conta não repete). */
export function linhaDoLancamento(t: Transaction, categoria?: string, opcoes: { semConta?: boolean } = {}): ItemDoDia {
  const n = naturezaDe(t)
  const tom: TomDinheiro | undefined = n === "entrada" ? "positivo" : n === "saida" || n === "fatura" ? "negativo" : "neutro"
  const icone = n === "transferencia" ? <ArrowLeftRight size={16} strokeWidth={2} aria-hidden="true" />
    : n === "fatura" ? <CreditCard size={16} strokeWidth={2} aria-hidden="true" />
    : t.descricao.trim().charAt(0).toUpperCase() || "•"
  return {
    id: t.id,
    dia: t.data,
    para: `/transacoes/${t.id}`,
    icone,
    tomIcone: n === "entrada" ? "positivo" : n === "saida" ? undefined : "neutro",
    nome: t.descricao,
    sub: [opcoes.semConta ? null : t.contaNome, categoria, t.meioPagamentoDescricao].filter(Boolean).join(" · ") || undefined,
    hora: t.hora ? t.hora.slice(0, 5) : null,
    etiqueta: t.statusTransacao === 0 ? <Etiqueta tom="alerta">Previsto</Etiqueta> : undefined,
    valor: t.valor,
    tom,
  }
}
