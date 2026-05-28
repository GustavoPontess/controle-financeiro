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
  limiteDisponivel?: number
  gastosNoCicloAtual: number
  diaFechamento?: number
  diaVencimento?: number
  contaId?: string
  contaNome?: string
  bancoId?: string
  bancoNome?: string
  bancoLogoUrl?: string
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
