import { api } from "../api/cliente"
import type { Conta } from "../types/Conta"

type ContaBase = Omit<Conta, "id" | "tipoDescricao" | "tipoCartaoDescricao" | "bancoNome" | "bancoLogoUrl" | "bancoCor" | "saldoAtual" | "encerradaEm">

export type CriarContaPayload = ContaBase & {
  saldoInicial?: number
  /** Data de abertura do saldo inicial ("YYYY-MM-DD"). Omitido = hoje. */
  dataSaldoInicial?: string
}

/** Contas abertas (seleções do app). A tela de contas pede as encerradas também. */
export const getContas = async (opcoes: { incluirEncerradas?: boolean } = {}): Promise<Conta[]> => {
  const res = await api.get("/contas", { params: opcoes.incluirEncerradas ? { incluirEncerradas: true } : undefined })
  return res.data
}

export const getConta = async (id: string): Promise<Conta> => {
  const res = await api.get(`/contas/${id}`)
  return res.data
}

export type EncerrarContaPayload = {
  /** O saldo foi pra outra conta: vira uma transferência. */
  contaDestinoId?: string
  /** No banco já está zerado: vira um ajuste (fora do resultado). */
  ajustar?: boolean
  /** "YYYY-MM-DD"; omitido = hoje. */
  data?: string
}

// Encerrar com saldo move dinheiro: a chave nasce ao abrir a tela e vale pra toda tentativa — o servidor
// devolve o mesmo resultado pra mesma chave (não transfere 2x).
export const encerrarConta = async (id: string, dto: EncerrarContaPayload, idempotencyKey: string) => {
  const res = await api.post(`/contas/${id}/encerrar`, dto, { headers: { "Idempotency-Key": idempotencyKey } })
  return res.data as { contaId: string; encerradaEm: string; resolucao: string; saldoAntes: number }
}

export const reabrirConta = async (id: string) => {
  await api.post(`/contas/${id}/reabrir`)
}

export const createConta = async (conta: CriarContaPayload) => {
  const res = await api.post("/contas", conta)
  return res.data
}

export const updateConta = async (id: string, conta: ContaBase) => {
  await api.put(`/contas/${id}`, conta)
}

export const deleteConta = async (id: string) => {
  await api.delete(`/contas/${id}`)
}

/** Edita o saldo inicial (ponto de partida) da conta — valor e data ("YYYY-MM-DD"). */
export const atualizarSaldoInicial = async (contaId: string, dto: { valor: number; data?: string }) => {
  await api.put(`/contas/${contaId}/saldo-inicial`, dto)
}
