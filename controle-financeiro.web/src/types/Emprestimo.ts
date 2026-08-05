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
