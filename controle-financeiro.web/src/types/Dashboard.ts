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
  data: string
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
  saldoMesAnterior: number
  receitasMes: number
  despesasMes: number
  saldoMes: number
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
}
