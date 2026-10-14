import { api } from "../api/cliente"
import type { EstornoPagamentoResultado, Fatura, FaturaDetalhe, PagarFaturaPayload } from "../types/Fatura"

export const getFaturasByCartao = async (cartaoCreditoId: string): Promise<Fatura[]> => {
  const res = await api.get(`/cartoes/${cartaoCreditoId}/faturas`)
  return res.data
}

export const getFaturaDetalhe = async (cartaoCreditoId: string, faturaId: string): Promise<FaturaDetalhe> => {
  const res = await api.get(`/cartoes/${cartaoCreditoId}/faturas/${faturaId}`)
  return res.data
}

// Pagar debita a conta: a API exige o header Idempotency-Key (400 sem ele). Quem chama gera a
// chave uma vez por tentativa de pagamento e a REUSA no retry — assim duplo clique/retry de rede
// não paga 2x (o backend devolve o mesmo sucesso pra chave repetida).
export const pagarFatura = async (
  cartaoCreditoId: string,
  faturaId: string,
  payload: PagarFaturaPayload,
  idempotencyKey: string,
): Promise<void> => {
  await api.post(`/cartoes/${cartaoCreditoId}/faturas/${faturaId}/pagar`, payload, {
    headers: { "Idempotency-Key": idempotencyKey },
  })
}

// Estornar devolve dinheiro à conta e faz a fatura voltar a dever: mesma regra de chave do pagar — gerada
// ao abrir a confirmação e reusada no retry (a API nunca estorna 2x a mesma chave).
export const estornarPagamento = async (
  pagamentoId: string,
  idempotencyKey: string,
  motivo?: string,
): Promise<EstornoPagamentoResultado> => {
  const res = await api.post(`/faturas/pagamentos/${pagamentoId}/estornar`, { motivo }, {
    headers: { "Idempotency-Key": idempotencyKey },
  })
  return res.data
}
