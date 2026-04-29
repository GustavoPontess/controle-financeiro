export interface Conta {
  id: string
  nome: string
  numeroConta?: string
  tipo: number
  tipoDescricao: string
  tipoCartao?: number
  tipoCartaoDescricao?: string
  saldoInicial: number
  isCarteira: boolean
  bancoId?: string
  bancoNome?: string
}
