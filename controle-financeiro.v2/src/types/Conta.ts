export interface Conta {
  id: string
  nome: string
  numeroConta?: string
  agencia?: string
  tipo: number
  tipoDescricao: string
  tipoCartao?: number
  tipoCartaoDescricao?: string
  saldoAtual: number
  isCarteira: boolean
  bancoId?: string
  bancoNome?: string
  bancoLogoUrl?: string | null
  bancoCor?: string | null
  /** Encerrada (fechada no banco): fora das listas, sem lançamento novo. Null/ausente = aberta. */
  encerradaEm?: string | null
}
