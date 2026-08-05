/** Status do vínculo bilateral — ver docs/features/emprestimo-compartilhado/spec.md. */
export const StatusVinculoEmprestimo = {
  SemVinculo: 0,
  PendenteAceite: 1,
  Vinculado: 2,
  Recusado: 3,
} as const

export interface Emprestimo {
  id: string
  descricao: string
  pessoa: string
  valorTotal: number
  valorPago: number
  valorRestante: number
  percentualPago: number
  tipo: number
  tipoDescricao: string
  dataInicio: string
  dataVencimento?: string
  quitado: boolean
  vencido: boolean
  observacao?: string
  statusVinculo: number
  contraparteNome?: string
  /** Só quem é credor confirma pagamento/quitação — nunca o devedor, mesmo vinculado. */
  souCredor: boolean
  /** Lançamento (Transacao) vinculado — só existe se criado junto com o empréstimo. */
  transacaoId?: string
}

export interface CriarEmprestimo {
  descricao: string
  pessoa: string
  valorTotal: number
  tipo: number
  dataInicio: string
  dataVencimento?: string
  observacao?: string
  idempotencyKey: string
  /** Se informado (junto com categoriaId), cria também o lançamento real da saída/entrada. */
  contaId?: string
  categoriaId?: string
  /** Se informado, vincula um lançamento já existente em vez de criar outro. */
  transacaoExistenteId?: string
}

export interface EmprestimoConviteResultado {
  linkConvite: string
}

export interface EmprestimoConvitePendente {
  emprestimoId: string
  descricao: string
  valorTotal: number
  credorOuDevedorNome: string
  tipoDescricao: string
}

/** Status de aprovação de uma solicitação de pagamento — docs/features/emprestimo-compartilhado/pagamento-aprovacao.md. */
export const StatusAprovacaoPagamentoEmprestimo = {
  Pendente: 1,
  Aprovada: 2,
  Rejeitada: 3,
} as const

export interface SolicitarPagamentoEmprestimo {
  valor: number
  contaId?: string
  categoriaId?: string
  data: string
  /** Se informado, vincula essa despesa já lançada em vez de criar uma nova (evita duplicar a saída). */
  transacaoExistenteId?: string
  idempotencyKey: string
}

export interface AprovarPagamentoEmprestimo {
  contaId?: string
  categoriaId?: string
}

export interface EmprestimoPagamentoSolicitacao {
  id: string
  emprestimoId: string
  valor: number
  statusAprovacao: number
  statusAprovacaoDescricao: string
  solicitadoPor: string
  solicitadoPorNome: string
  criadoEm: string
  aprovadoEm?: string
  transacaoRecebimentoId?: string
  /** Data real do lançamento de saída (comprovante) — pro histórico ler como extrato. */
  comprovanteData: string
  comprovanteContaNome?: string
  /** Só preenchido quando o credor informou conta ao aprovar (criou a entrada de verdade). */
  recebimentoData?: string
  recebimentoContaNome?: string
}
