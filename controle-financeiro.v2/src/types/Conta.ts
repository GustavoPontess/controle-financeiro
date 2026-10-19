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
  /** Ponto de partida (lançamento de saldo inicial vivo). 0 = começou do zero. */
  saldoInicial?: number
  /** "YYYY-MM-DD" do saldo inicial; null quando não há. */
  dataSaldoInicial?: string | null
  isCarteira: boolean
  bancoId?: string
  bancoNome?: string
  bancoLogoUrl?: string | null
  bancoCor?: string | null
  /** Encerrada (fechada no banco): fora das listas, sem lançamento novo. Null/ausente = aberta. */
  encerradaEm?: string | null
  /** Parte do saldo reservada em metas (o dinheiro continua na conta). Livre = saldoAtual − isto. */
  reservadoEmMetas?: number
}
