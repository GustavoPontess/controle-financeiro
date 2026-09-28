export interface CartaoCredito {
  id: string
  nome: string
  ultimosDigitos?: string
  bandeira: number
  bandeiraDescricao: string
  temCredito: boolean
  temDebito: boolean
  ehPrePago: boolean
  limite?: number
  /** Limite − usado. Negativo quando estourou o limite. */
  limiteDisponivel?: number
  /** Quanto do limite está em uso: o que as faturas cobram (parcelas futuras incluídas) menos o pago. */
  limiteUsado?: number
  diaFechamento?: number
  diaVencimento?: number
  contaId?: string
  contaNome?: string
  bancoId?: string
  bancoNome?: string
  bancoLogoUrl?: string
  bancoCor?: string
  ativo: boolean
}

export interface CriarCartaoCredito {
  nome: string
  ultimosDigitos?: string
  bandeira: number
  temCredito: boolean
  temDebito: boolean
  ehPrePago: boolean
  limite?: number
  diaFechamento?: number
  diaVencimento?: number
  contaId?: string
  bancoId?: string
}
