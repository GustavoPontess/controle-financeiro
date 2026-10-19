import { api } from "../api/cliente"
import type { Transaction } from "../types/Transaction"
import type { PagedResult } from "../types/Paged"
import type { RespostaDoMes } from "../types/DinheiroDoMes"

export type ListTransactionsFilter = {
  /** ISO date — `Data >= from`. */
  from?: string
  /** ISO date — `Data < to` (semi-aberto). */
  to?: string
  categoriaId?: string
  /** Busca na descrição (LIKE no banco). */
  q?: string
  /** 1=despesa, 2=receita. */
  tipo?: number
  /** Filtra por conta de origem. */
  contaId?: string
  /** Filtra por cartão de crédito de origem. */
  cartaoId?: string
  /** Meio de pagamento: 1=Dinheiro,2=Débito,3=Crédito,4=Pix,5=Ted,6=Boleto. */
  meioPagamento?: number
  /** Faixa de valor. */
  valorMin?: number
  valorMax?: number
  /** 0=previsto (Previsao), 1=efetivado (Executado). */
  status?: number
  /** data_asc | valor_desc | valor_asc (default no back: data desc). */
  ordenacao?: string
  /** Extrato de caixa: só o que mexe no saldo da conta (exclui compra no crédito e saldo inicial; mantém pagamento de fatura e transferência). */
  apenasCaixa?: boolean
  /** Natureza do lançamento: entrada | saida | transferencia | fatura. */
  natureza?: string
  /** "gastos": o que a pessoa gastou, na data em que gastou (conta e cartão; compra parcelada uma vez, com o total). */
  visao?: "gastos"
}

export type TransacaoStats = {
  /** Total registrado (inclui crédito). */
  entradas: number
  saidas: number
  /** Movimento real de caixa do período. */
  entradasCaixa: number
  saidasCaixa: number
  /** = entradasCaixa - saidasCaixa */
  saldoPeriodo: number
  qtdTransacoes: number
}

/**
 * KPIs agregados — entradas, saídas, saldo do período, qtd.
 * Calculado server-side, exato pra qualquer volume.
 */
export const getTransactionStats = async (
  filter: ListTransactionsFilter = {},
): Promise<TransacaoStats> => {
  const params: Record<string, unknown> = {}
  if (filter.from) params.from = filter.from
  if (filter.to) params.to = filter.to
  if (filter.categoriaId) params.categoriaId = filter.categoriaId
  const res = await api.get("/transacoes/stats", { params })
  return res.data
}

/**
 * Lista paginada com filtros opcionais aplicados no banco. Use sempre que
 * possível — backend faz Clamp(pageSize, 1, 100), então não adianta pedir
 * mais que 100 por chamada.
 */
export const listTransactionsPage = async (
  page: number,
  pageSize: number,
  filter: ListTransactionsFilter = {},
): Promise<PagedResult<Transaction>> => {
  const params: Record<string, unknown> = { page, pageSize }
  if (filter.from) params.from = filter.from
  if (filter.to) params.to = filter.to
  if (filter.categoriaId) params.categoriaId = filter.categoriaId
  if (filter.q) params.q = filter.q
  if (filter.tipo) params.tipo = filter.tipo
  if (filter.contaId) params.contaId = filter.contaId
  if (filter.cartaoId) params.cartaoId = filter.cartaoId
  if (filter.meioPagamento != null) params.meioPagamento = filter.meioPagamento
  if (filter.valorMin != null) params.valorMin = filter.valorMin
  if (filter.valorMax != null) params.valorMax = filter.valorMax
  if (filter.status != null) params.status = filter.status
  if (filter.ordenacao) params.ordenacao = filter.ordenacao
  if (filter.apenasCaixa) params.apenasCaixa = true
  if (filter.natureza) params.natureza = filter.natureza
  if (filter.visao) params.visao = filter.visao
  const res = await api.get("/transacoes", { params })
  return res.data
}

/**
 * @deprecated Backend clampa em 100 — esta função silenciosamente trunca quem
 * tiver mais de 100 transações. Use `listTransactionsPage` em telas novas.
 * Mantida só pra callers que agregam tudo (Dashboard, etc).
 */
export const getTransactions = async (): Promise<Transaction[]> => {
  const res = await api.get("/transacoes", { params: { page: 1, pageSize: 100 } })
  return res.data.items
}

/**
 * Antes de salvar uma compra: ela tira o dinheiro das contas fixas dos próximos 30 dias? No cartão o servidor olha o
 * limite, na conta o saldo. Devolve a resposta pronta (tom + frase) ou null quando não aperta nada (204). Só avisa.
 */
export const avisoDeCompra = async (valor: number, origem: { contaId?: string; cartaoId?: string }): Promise<RespostaDoMes | null> => {
  const res = await api.get("/transacoes/aviso", { params: { valor, ...origem } })
  return res.status === 204 || !res.data ? null : res.data
}

const comChave = (idempotencyKey?: string) => (idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined)

/** Idempotency-Key (uma por abertura da tela): repetir o pedido (duplo clique, retry) não lança duas vezes. */
export const createTransaction = async (transaction: Omit<Transaction, "id">, idempotencyKey?: string) => {
  const res = await api.post("/transacoes", transaction, comChave(idempotencyKey))
  return res.data
}

/**
 * Edição completa — o mesmo formulário de criar. Conta, cartão e status mudam no lugar; `transferencia`,
 * `contaFixa` ou `parcelas > 1` trocam o registro numa transação só do servidor (o antigo é cancelado).
 * Campos nulos de conta/cartão e `efetivado` mantêm o que está.
 */
export type EditarLancamento = {
  descricao: string
  valor: number
  tipo: number
  categoriaId?: string | null
  subcategoriaId?: string | null
  contaId?: string | null
  cartaoCreditoId?: string | null
  meioPagamento?: number | null
  parcelas?: number | null
  efetivado?: boolean | null
  data: string
  hora?: string | null
  transferencia?: { contaOrigemId: string; contaDestinoId: string } | null
  contaFixa?: { frequencia: number; dataFim?: string | null } | null
}
export type EdicaoLancamentoResultado = { tipo: "transacao" | "transferencia" | "contaFixa" | "parcelamento"; id: string }

export const updateTransaction = async (id: string, dados: EditarLancamento, idempotencyKey?: string): Promise<EdicaoLancamentoResultado> => {
  const res = await api.put(`/transacoes/${id}`, dados, comChave(idempotencyKey))
  return res.data
}

export const deleteTransaction = async (id: string): Promise<void> => {
  await api.delete(`/transacoes/${id}`)
}

/** Uma transação pelo id (tela de ver/editar). 404 se não existe ou é de outro usuário. */
export const getTransaction = async (id: string): Promise<Transaction> => {
  const res = await api.get(`/transacoes/${id}`)
  return res.data
}
