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
  /** Soma das solicitações Pendentes — informativo, não conta no saldo real. */
  valorPendente: number
  /** Soma das solicitações Rejeitadas — só histórico visual. */
  valorRecusado: number
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

  // Forma de pagamento (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md)
  formaPagamento: number
  taxaJuroMensal?: number
  percentualMultaAtraso?: number
  /** Só preenchido se formaPagamento === Parcelado. */
  quantidadeParcelas?: number
}

/** Forma de pagamento combinada de um empréstimo. */
export const FormaPagamentoEmprestimo = {
  AVista: 1,
  Parcelado: 2,
} as const

/** Status de uma parcela — "Atrasada" vem calculado (statusDescricao/atrasada), não é um valor deste enum. */
export const StatusParcelaEmprestimo = {
  Pendente: 1,
  Paga: 2,
  Cancelada: 3,
} as const

export interface EmprestimoParcela {
  id: string
  emprestimoId: string
  numero: number
  quantidadeTotal: number
  dataVencimento: string
  valor: number
  valorComJuros?: number
  valorComMulta?: number
  status: number
  statusDescricao: string
  atrasada: boolean
  solicitacaoPagamentoId?: string
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

  // Forma de pagamento — default AVista quando omitido (comportamento igual ao de antes).
  formaPagamento?: number
  /** Obrigatório se formaPagamento === Parcelado. Range 2-36. */
  quantidadeParcelas?: number
  /** Obrigatório se formaPagamento === Parcelado — vencimento da parcela 1. */
  primeiroVencimento?: string
  /** Opcional, só usado se Parcelado. % mensal sobre o valor de cada parcela. */
  taxaJuroMensal?: number
  /** Opcional, só usado se Parcelado. % livre (sem teto/mínimo) sobre a parcela quando atrasa. */
  percentualMultaAtraso?: number
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
  /** Se o empréstimo é Parcelado, qual EmprestimoParcela esse pagamento quita. */
  parcelaId?: string
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
  /** Texto livre que o credor escreveu ao rejeitar — opcional. */
  motivoRejeicao?: string
  /** True quando foi o credor quem registrou (nasceu já aprovada, sem comprovante de saída). */
  registradoPeloCredor: boolean
}
