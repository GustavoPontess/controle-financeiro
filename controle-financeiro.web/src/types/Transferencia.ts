export interface Transferencia {
  id: string
  contaOrigemId: string
  contaOrigemNome: string
  contaDestinoId: string
  contaDestinoNome: string
  valor: number
  data: string
  descricao: string
}

export interface CriarTransferencia {
  contaOrigemId: string
  contaDestinoId: string
  valor: number
  data: string
  descricao: string
}
