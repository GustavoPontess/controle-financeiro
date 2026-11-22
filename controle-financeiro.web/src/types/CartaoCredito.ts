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
  /** Cartão da casa: as compras à vista nele já nascem divididas com essa família. */
  familiaId?: string | null
}

/** Uma cobrança que se repete no cartão (3+ faturas seguidas, valor parecido) e pode virar conta fixa. */
export interface SugestaoContaFixa {
  chave: string
  /** O nome do lugar ("Claude.ai"). */
  nome: string
  /** O texto da última cobrança, como veio. */
  descricao: string
  valor: number
  /** AAAA-MM-DD da última cobrança. */
  ultima: string
  /** Um mês depois da última: onde a conta fixa começa (a última já está na fatura). */
  proxima: string
  /** Quantas faturas seguidas. */
  meses: number
  categoriaId?: string | null
  subcategoriaId?: string | null
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
