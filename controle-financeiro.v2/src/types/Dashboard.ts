export interface CategoriaGasto {
  descricao: string
  valor: number
  percentual: number
}

export interface TransacaoRecente {
  id: string
  descricao: string
  valor: number
  tipo: number
  categoriaId?: string
  categoria?: string
  contaId?: string
  cartaoCreditoId?: string
  conta?: string
  meioPagamento?: number
  meioPagamentoDescricao?: string
  /** Dia do lançamento, "YYYY-MM-DD" (date puro, sem fuso). */
  data: string
  /** Hora do lançamento, "HH:MM:SS" — ou null quando não tem hora. */
  hora?: string | null
  /** Perna de transferência entre contas próprias — neutra. */
  ehTransferencia?: boolean
  /** Pagamento de fatura de cartão — sai da conta, mas não é gasto novo. */
  ehPagamentoFatura?: boolean
}

export interface SaldoConta {
  id: string
  nome: string
  saldo: number
  tipo: number
  tipoDescricao: string
  isCarteira?: boolean
  bancoNome?: string
  logoUrl?: string
  cor?: string
}

export interface EvolucaoMes {
  label: string
  ano: number
  mes: number
  saldo: number
}

export interface CartaoResumo {
  id: string
  nome: string
  /** Últimos 4 dígitos do cartão. */
  ultimosDigitos?: string | null
  bancoNome?: string
  bancoLogoUrl?: string
  bancoCor?: string
  limiteTotal: number
  limiteUsado: number
  limiteDisponivel: number
  /** 0..100 */
  percentualUsado: number
  /** ISO date or null. */
  proximoFechamento?: string | null
  /** Negativo = passou. */
  diasAteFechamento?: number | null
}

export interface DashboardData {
  saldoTotal: number
  /** Saldo das contas no fim do mês passado (em relação a hoje) — mesma base do saldoTotal. */
  saldoMesAnterior: number
  receitasMes: number
  despesasMes: number
  saldoMes: number
  /** Entradas/Saídas de caixa do mês anterior — pros cards "Entrou/Saiu" mostrarem variação % (#1.3). */
  entradasCaixaMesAnterior: number
  saidasCaixaMesAnterior: number
  recebido: number
  aReceber: number
  pago: number
  aPagar: number
  /** Caixa real do mês — exclui crédito (alinha com /transacoes/stats). */
  entradasCaixa: number
  saidasCaixa: number
  saldoCaixaMes: number
  evolucaoSaldo: EvolucaoMes[]
  topCategorias: CategoriaGasto[]
  transacoesRecentes: TransacaoRecente[]
  saldoContas: SaldoConta[]
  cartoesResumo: CartaoResumo[]
  /** Gasto no cartão de crédito no mês, À PARTE do caixa (soma de comprasCartaoMes). */
  gastoCartaoMes?: number
  /** Compras no crédito do mês: à vista pela data da compra; parcelamento só com a parcela do mês. */
  comprasCartaoMes?: CompraCartao[]
}

/** Uma compra (ou a parcela do mês) no cartão de crédito. */
export interface CompraCartao {
  descricao: string
  valor: number
  /** Data da compra "YYYY-MM-DD" (no parcelamento, a da compra original). */
  data: string
  /** Parcela que cai neste mês (null = à vista). */
  parcela?: number | null
  totalParcelas?: number | null
  cartao?: string | null
  categoria?: string | null
}
