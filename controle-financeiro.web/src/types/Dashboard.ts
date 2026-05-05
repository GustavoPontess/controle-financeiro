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
}

export interface DashboardData {
  saldoTotal: number
  receitasMes: number
  despesasMes: number
  saldoMes: number
  topCategorias: CategoriaGasto[]
  transacoesRecentes: TransacaoRecente[]
  saldoContas: SaldoConta[]
}
