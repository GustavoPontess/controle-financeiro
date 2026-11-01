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
  /** Banco vinculado (empréstimo bancário — Open Finance Fase 1). Null/undefined = P2P (pessoa). */
  bancoId?: string
  bancoNome?: string
  bancoLogoUrl?: string
  bancoCor?: string
  /** Origem dos dados: 1 = Manual, 2 = OpenFinance. */
  origem: number
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
  /** Só preenchido se formaPagamento === AVista e taxaJuroMensal informada. */
  valorComJuros?: number
  /** Só preenchido se formaPagamento === AVista, percentualMultaAtraso informada, e venceu. */
  valorComMulta?: number
  /** Relativo a quem pediu — true se EU arquivei, não reflete o lado da contraparte. Só existe
   * pra empréstimo quitado (arquivar sem apagar nada). */
  arquivado: boolean
  /** Setado se este empréstimo foi absorvido por uma consolidação aceita — aponta pro empréstimo
   * novo que o substituiu (por isso está Quitado sem pagamento de verdade). */
  consolidadoNoEmprestimoId?: string
}

/** Tipo do empréstimo, sempre relativo a quem olha (o backend inverte pra contraparte). */
export const TipoEmprestimo = {
  Emprestei: 1,
  PeguiEmprestado: 2,
} as const

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
  /** Soma já aplicada nesta parcela — pode ser parcial (adiantamento), menor que o valor devido. */
  valorPago: number
  atrasada: boolean
  solicitacaoPagamentoId?: string
  /** Solicitação Pendente (aguardando aprovação) ligada a essa parcela, se houver. */
  solicitacaoPendenteId?: string
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
  /** Opcional. Banco da instituição (empréstimo bancário). Se informado, tem que existir e estar ativo. */
  bancoId?: string
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
  /** Opcional. Parcelado: % mensal sobre o valor de cada parcela. À vista: % sobre o total. */
  taxaJuroMensal?: number
  /** Opcional, parcelado, no lugar dos juros: o valor de cada parcela do contrato (banco). O app acha a taxa efetiva
   *  e separa juros e amortização de cada parcela (Tabela Price). */
  valorParcela?: number
  /** Opcional. % livre (sem teto/mínimo) sobre o valor (parcela ou total) quando atrasa. */
  percentualMultaAtraso?: number
}

/** Uma parcela (ou o empréstimo à vista) que vence nos próximos 30 dias, ou que já venceu e ainda falta. */
export interface VencimentoEmprestimo {
  emprestimoId: string
  /** A pessoa ou o banco do outro lado. */
  quem: string
  descricao: string
  data: string
  valor: number
  venceu: boolean
  /** "4 de 12" (null à vista). */
  parcela: number | null
  deParcelas: number | null
}

/** O topo de Empréstimos (GET /emprestimos/proximos): a frase, o que você devolve e o que volta pra você em 30 dias. */
export interface ProximosEmprestimos {
  resposta: { tom: "positivo" | "alerta" | "negativo" | "neutro"; texto: string; acoes: { rotulo: string; para: string }[] } | null
  devolver: VencimentoEmprestimo[]
  voltar: VencimentoEmprestimo[]
  saldoNasContas: number
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

/** Sem escolha de parcela (2026-08-12) — pra empréstimo Parcelado, o valor é aplicado
 * automaticamente em sequência nas parcelas pendentes mais antigas, quantas cobrir por completo. */
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
  /** Se informado, vincula essa receita já lançada em vez de criar uma nova. */
  transacaoExistenteId?: string
}

export interface EmprestimoPagamentoSolicitacao {
  id: string
  emprestimoId: string
  /** Se o empréstimo é Parcelado, qual EmprestimoParcela essa solicitação mira. */
  parcelaId?: string
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

// ── Unificar/consolidar (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md) ──

export const StatusConsolidacaoEmprestimo = {
  Pendente: 1,
  Aceita: 2,
  Recusada: 3,
  Cancelada: 4,
} as const

export interface EmprestimoConsolidacaoItem {
  emprestimoOriginalId: string
  descricao: string
  valorRestanteSnapshot: number
}

/** Contraparte com 2+ empréstimos ativos onde eu sou credor — candidata a consolidação. */
export interface EmprestimoConsolidacaoCandidato {
  contraparteUsuarioId: string
  contraparteNome: string
  itens: EmprestimoConsolidacaoItem[]
}

export interface ProporConsolidacao {
  emprestimoIds: string[]
  descricao: string
  formaPagamento: number
  quantidadeParcelas?: number
  primeiroVencimento?: string
  /** Só usado se formaPagamento === AVista. */
  dataVencimento?: string
  taxaJuroMensal?: number
  percentualMultaAtraso?: number
}

export interface EmprestimoConsolidacaoProposta {
  id: string
  credorUsuarioId: string
  credorNome: string
  devedorUsuarioId: string
  devedorNome: string
  descricao: string
  formaPagamento: number
  quantidadeParcelas?: number
  primeiroVencimento?: string
  dataVencimento?: string
  taxaJuroMensal?: number
  percentualMultaAtraso?: number
  valorTotalProposto: number
  status: number
  statusDescricao: string
  criadoEm: string
  respondidoEm?: string
  motivoRecusa?: string
  emprestimoConsolidadoId?: string
  /** Perspectiva de quem pediu a lista — true se ele propôs, false se precisa responder. */
  souCredor: boolean
  itens: EmprestimoConsolidacaoItem[]
}
