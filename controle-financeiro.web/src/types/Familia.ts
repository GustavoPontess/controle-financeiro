export interface Familia {
  id: string
  nome: string
  criadoPorUsuarioId: string
  criadoEm: string
  ehAdmin: boolean
  totalMembros: number
}

export interface MembroFamilia {
  id: string
  usuarioId: string
  nomeUsuario: string
  emailUsuario: string
  papel: string
  entrouEm: string
  rendaMensal: number | null
}

// ── Modos de rateio (#25) ──

export type ModoRateio = 1 | 2 | 3 // Igualitário, Proporcional, Personalizado

export interface RateioItem {
  usuarioId: string
  percentual: number
}

export interface RateioMembro {
  usuarioId: string
  nome: string
  percentual: number
}

export interface RateioTransacao {
  modo: ModoRateio | null
  familiaId: string | null
  membros: RateioMembro[]
}

export type StatusConvite = 1 | 2 | 3 | 4 | 5 // Pendente, Aceito, Recusado, Revogado, Expirado

export interface ConviteFamilia {
  id: string
  familiaId: string
  nomeFamilia: string
  emailConvidado: string
  papel: string
  status: StatusConvite
  expiraEm: string
  criadoEm: string
  token: string
}

export interface FamiliaDetalhe {
  id: string
  nome: string
  criadoPorUsuarioId: string
  criadoEm: string
  ehAdmin: boolean
  modoRateioPadrao: ModoRateio
  membros: MembroFamilia[]
  convitesPendentes: ConviteFamilia[]
  limiteAprovacao: number | null
}

// ── Aprovação de despesa (2.4) ──
// NaoRequerida, Pendente, Aprovada, Rejeitada
export type StatusAprovacaoDespesa = 0 | 1 | 2 | 3

export interface DespesaCompartilhada {
  id: string
  descricao: string
  valor: number
  data: string
  categoriaNome: string | null
  pagadorUsuarioId: string
  pagadorNome: string
  statusAprovacao: StatusAprovacaoDespesa
  aprovadoPorNome: string | null
  responsavelUsuarioId: string | null
  responsavelNome: string | null
}

export interface SaldoMembro {
  usuarioId: string
  nome: string
  pagou: number
  cota: number
  saldo: number
}

export interface BalancoFamilia {
  mes: number
  ano: number
  modo: ModoRateio
  total: number
  cota: number
  saldos: SaldoMembro[]
}

// ── Dependentes (#24) ──

export type TipoDependente = 1 | 2 | 3 | 4 // Crianca, Idoso, Pet, Outro

export interface Dependente {
  id: string
  familiaId: string
  nome: string
  apelido: string | null
  dataNascimento: string | null
  tipo: TipoDependente
  ativo: boolean
}

export interface GastoDependente {
  dependenteId: string
  nome: string
  mes: number
  ano: number
  total: number
}

// ── Acerto de contas (#26) ──

export interface AcertoContas {
  id: string
  deUsuarioId: string
  deNome: string
  paraUsuarioId: string
  paraNome: string
  valor: number
  mes: number
  ano: number
  observacao: string | null
  criadoEm: string
}
